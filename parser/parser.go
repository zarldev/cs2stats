package parser

import (
	"fmt"
	"io"
	"time"

	demoinfocs "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	common "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	events "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
	msgs2 "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/msgs2"
)

// Parse reads a CS2 demo from r and returns a complete match analysis.
func Parse(r io.Reader) (*Match, error) {
	p := demoinfocs.NewParser(r)
	defer p.Close()

	s := newParseState(p)
	s.registerHandlers()

	// CS2 demos (Source 2) do not populate header fields like MapName or
	// PlaybackTime. Register a net message handler for CSVCMsg_ServerInfo
	// which carries the map name in CS2 demos.
	p.RegisterNetMessageHandler(func(m *msgs2.CSVCMsg_ServerInfo) {
		if name := m.GetMapName(); name != "" {
			s.match.Map = name
		}
	})

	header, err := p.ParseHeader()
	if err != nil {
		return nil, fmt.Errorf("parse header: %w", err)
	}

	// header fields work for CS:GO demos; CS2 overrides via ServerInfo above
	if header.MapName != "" {
		s.match.Map = header.MapName
	}
	s.match.Duration = header.PlaybackTime

	err = p.ParseToEnd()
	if err != nil {
		return nil, fmt.Errorf("parse demo: %w", err)
	}

	// CS2 headers always report zero PlaybackTime. Fall back to the parser's
	// current game time which, after ParseToEnd, equals the demo length.
	if s.match.Duration == 0 {
		s.match.Duration = p.CurrentTime()
	}

	return s.buildMatch(), nil
}

// parseState holds mutable state accumulated during parsing.
type parseState struct {
	p     demoinfocs.Parser
	match matchState

	players     map[uint64]*playerTracker
	roundKills  []KillEvent
	roundNum    int
	roundStart  time.Duration
	roundBomb   *BombEvent
	roundDefuse *BombEvent

	// alive tracking per round for clutch detection
	// initial* maps are snapshots at freeze time end (not modified by kills)
	// alive* maps are modified during the round as kills happen
	initialAliveCT map[uint64]bool
	initialAliveT  map[uint64]bool
	aliveCT        map[uint64]bool
	aliveT         map[uint64]bool

	// trade detection: recent deaths in current round
	recentDeaths []recentDeath

	// first kill tracking per round
	roundHasFirstKill bool

	// team name tracking
	ctName string
	tName  string

	// economy snapshots taken at freeze time end
	ctEconomy EconomySnapshot
	tEconomy  EconomySnapshot

	// entity-based damage tracking for CS2 demos (no PlayerHurt events)
	prevDamage     map[uint64]int
	hasHurtEvents  bool

	// CS2 demos don't fire RoundFreezetimeEnd events. Track whether
	// we received one so we can fall back to round-end economy capture.
	hasFreezetimeEnd bool

	rounds []Round
}

type matchState struct {
	Map      string
	Duration time.Duration
}

func newParseState(p demoinfocs.Parser) *parseState {
	return &parseState{
		p:              p,
		players:        make(map[uint64]*playerTracker),
		initialAliveCT: make(map[uint64]bool),
		initialAliveT:  make(map[uint64]bool),
		aliveCT:        make(map[uint64]bool),
		aliveT:         make(map[uint64]bool),
		prevDamage:     make(map[uint64]int),
	}
}

func (s *parseState) registerHandlers() {
	s.p.RegisterEventHandler(s.onMatchStart)
	s.p.RegisterEventHandler(s.onRoundStart)
	s.p.RegisterEventHandler(s.onRoundFreezetimeEnd)
	s.p.RegisterEventHandler(s.onKill)
	s.p.RegisterEventHandler(s.onPlayerHurt)
	s.p.RegisterEventHandler(s.onBombPlanted)
	s.p.RegisterEventHandler(s.onBombDefused)
	s.p.RegisterEventHandler(s.onRoundEnd)
}

func (s *parseState) onMatchStart(_ events.MatchStart) {
	// reset state for the actual match start (ignore warmup rounds)
	s.rounds = nil
	s.roundNum = 0
	for _, pt := range s.players {
		*pt = *newPlayerTracker(pt.steamID, pt.name, pt.team)
	}
}

func (s *parseState) onRoundStart(_ events.RoundStart) {
	s.roundNum++
	s.roundKills = nil
	s.recentDeaths = nil
	s.roundBomb = nil
	s.roundDefuse = nil
	s.roundHasFirstKill = false

	s.initialAliveCT = make(map[uint64]bool)
	s.initialAliveT = make(map[uint64]bool)
	s.aliveCT = make(map[uint64]bool)
	s.aliveT = make(map[uint64]bool)
}

func (s *parseState) onRoundFreezetimeEnd(_ events.RoundFreezetimeEnd) {
	s.hasFreezetimeEnd = true
	gs := s.p.GameState()

	s.roundStart = s.p.CurrentTime()

	// snapshot alive players
	s.initialAliveCT = make(map[uint64]bool)
	s.initialAliveT = make(map[uint64]bool)
	s.aliveCT = make(map[uint64]bool)
	s.aliveT = make(map[uint64]bool)
	for _, pl := range gs.Participants().Playing() {
		if pl == nil || pl.SteamID64 == 0 {
			continue
		}
		s.ensurePlayer(pl)
		if pl.Team == common.TeamCounterTerrorists && pl.IsAlive() {
			s.initialAliveCT[pl.SteamID64] = true
			s.aliveCT[pl.SteamID64] = true
		} else if pl.Team == common.TeamTerrorists && pl.IsAlive() {
			s.initialAliveT[pl.SteamID64] = true
			s.aliveT[pl.SteamID64] = true
		}
	}

	// snapshot team names
	ct := gs.TeamCounterTerrorists()
	t := gs.TeamTerrorists()
	if ct != nil {
		s.ctName = ct.ClanName()
	}
	if t != nil {
		s.tName = t.ClanName()
	}

	// snapshot economy at freeze time end for CS:GO demos.
	// CS2 demos do not fire this event, so economy is captured at round end.
	s.ctEconomy = snapshotTeamEconomy(ct, s.roundNum)
	s.tEconomy = snapshotTeamEconomy(t, s.roundNum)
}

func (s *parseState) onKill(e events.Kill) {
	if s.roundNum == 0 {
		return // warmup or pre-match
	}

	var (
		attackerID   uint64
		attackerName string
		attackerPos  Position
		victimID     uint64
		victimName   string
		victimPos    Position
		assisterID   uint64
		assisterName string
		weapon       string
	)

	killTime := s.p.CurrentTime()

	if e.Killer != nil {
		attackerID = e.Killer.SteamID64
		attackerName = e.Killer.Name
		attackerPos = vecToPosition(e.Killer.Position())
		s.ensurePlayer(e.Killer)
	}
	if e.Victim != nil {
		victimID = e.Victim.SteamID64
		victimName = e.Victim.Name
		victimPos = vecToPosition(e.Victim.Position())
		s.ensurePlayer(e.Victim)
	}
	if e.Assister != nil {
		assisterID = e.Assister.SteamID64
		assisterName = e.Assister.Name
		s.ensurePlayer(e.Assister)
	}

	if e.Weapon != nil {
		weapon = e.Weapon.String()
	}

	kill := KillEvent{
		Tick:             s.p.GameState().IngameTick(),
		RoundNumber:      s.roundNum,
		AttackerSteamID:  attackerID,
		AttackerName:     attackerName,
		AttackerPosition: attackerPos,
		VictimSteamID:    victimID,
		VictimName:       victimName,
		VictimPosition:   victimPos,
		Weapon:           weapon,
		IsHeadshot:       e.IsHeadshot,
		IsWallbang:       e.PenetratedObjects > 0,
		AssisterSteamID:  assisterID,
		AssisterName:     assisterName,
		IsFlashAssist:    e.AssistedFlash,
		Time:             killTime,
	}

	// trade detection: check if this kill avenges a recent teammate death
	if e.Killer != nil && e.Victim != nil {
		for i := range s.recentDeaths {
			rd := &s.recentDeaths[i]
			// the victim of this kill must be the killer from the recent death,
			// and the current killer must be on the same team as the recent victim
			if rd.killerSteamID == e.Victim.SteamID64 &&
				killTime-rd.time <= tradeWindow &&
				rd.round == s.roundNum {
				kill.IsTrade = true
				if pt := s.players[attackerID]; pt != nil {
					pt.recordTradeKill(s.roundNum)
				}
				// mark the traded player for KAST
				if pt := s.players[rd.victimSteamID]; pt != nil {
					pt.markTraded(s.roundNum)
				}
				break
			}
		}
	}

	s.roundKills = append(s.roundKills, kill)

	// update player stats
	if pt := s.players[attackerID]; pt != nil && attackerID != 0 {
		pt.recordKill(s.roundNum, e.IsHeadshot)
	}
	if pt := s.players[victimID]; pt != nil && victimID != 0 {
		pt.recordDeath(s.roundNum)
	}
	if assisterID != 0 {
		if e.AssistedFlash {
			if pt := s.players[assisterID]; pt != nil {
				pt.recordFlashAssist(s.roundNum)
			}
		} else {
			if pt := s.players[assisterID]; pt != nil {
				pt.recordAssist(s.roundNum)
			}
		}
	}

	// first kill/death of the round
	if !s.roundHasFirstKill {
		s.roundHasFirstKill = true
		if pt := s.players[attackerID]; pt != nil && attackerID != 0 {
			pt.recordFirstKill(s.roundNum)
		}
		if pt := s.players[victimID]; pt != nil && victimID != 0 {
			pt.recordFirstDeath(s.roundNum)
		}
	}

	// record death for trade detection
	if e.Victim != nil {
		victimTeam := ""
		if e.Victim.Team == common.TeamCounterTerrorists {
			victimTeam = "CT"
		} else if e.Victim.Team == common.TeamTerrorists {
			victimTeam = "T"
		}
		s.recentDeaths = append(s.recentDeaths, recentDeath{
			victimSteamID: victimID,
			killerSteamID: attackerID,
			victimTeam:    victimTeam,
			time:          killTime,
			round:         s.roundNum,
		})
	}

	// update alive maps
	delete(s.aliveCT, victimID)
	delete(s.aliveT, victimID)
}

func (s *parseState) onPlayerHurt(e events.PlayerHurt) {
	if s.roundNum == 0 {
		return
	}
	if e.Attacker == nil || e.Player == nil {
		return
	}
	if e.Attacker.SteamID64 == 0 {
		return
	}

	// only count damage between enemies
	if e.Attacker.Team == e.Player.Team {
		return
	}

	s.ensurePlayer(e.Attacker)
	s.hasHurtEvents = true

	// prefer HealthDamageTaken (excludes overkill), fall back to HealthDamage
	dmg := e.HealthDamageTaken
	if dmg <= 0 {
		dmg = e.HealthDamage
		if e.Health < 0 {
			dmg += e.Health
		}
		if dmg < 0 {
			dmg = 0
		}
	}

	if pt := s.players[e.Attacker.SteamID64]; pt != nil {
		pt.recordDamage(dmg)

		// track utility damage (grenades)
		if e.Weapon != nil && e.Weapon.Class() == common.EqClassGrenade {
			pt.recordUtilityDamage(dmg)
		}
	}
}

func (s *parseState) onBombPlanted(e events.BombPlanted) {
	if s.roundNum == 0 {
		return
	}
	be := &BombEvent{
		Site: string(e.Site),
		Tick: s.p.GameState().IngameTick(),
	}
	if e.Player != nil {
		be.PlayerSteamID = e.Player.SteamID64
		be.PlayerName = e.Player.Name
	}
	s.roundBomb = be
}

func (s *parseState) onBombDefused(e events.BombDefused) {
	if s.roundNum == 0 {
		return
	}
	be := &BombEvent{
		Site: string(e.Site),
		Tick: s.p.GameState().IngameTick(),
	}
	if e.Player != nil {
		be.PlayerSteamID = e.Player.SteamID64
		be.PlayerName = e.Player.Name
	}
	s.roundDefuse = be
}

func (s *parseState) onRoundEnd(e events.RoundEnd) {
	if s.roundNum == 0 {
		return
	}

	duration := s.p.CurrentTime() - s.roundStart

	// mark surviving players for KAST
	gs := s.p.GameState()
	for _, pl := range gs.Participants().Playing() {
		if pl == nil || pl.SteamID64 == 0 || !pl.IsAlive() {
			continue
		}
		if pt := s.players[pl.SteamID64]; pt != nil {
			pt.markSurvived(s.roundNum)
		}
	}

	// CS2 demos don't fire RoundFreezetimeEnd, so economy data captured
	// there will be zero. Fall back to reading at round end where the
	// entity properties are populated.
	if !s.hasFreezetimeEnd {
		ct := gs.TeamCounterTerrorists()
		t := gs.TeamTerrorists()
		s.ctEconomy = snapshotTeamEconomy(ct, s.roundNum)
		s.tEconomy = snapshotTeamEconomy(t, s.roundNum)
	}

	var firstKill *KillEvent
	if len(s.roundKills) > 0 {
		fk := s.roundKills[0]
		firstKill = &fk
	}

	clutch := detectClutch(s.roundKills, s.initialAliveCT, s.initialAliveT)

	round := Round{
		Number:     s.roundNum,
		Winner:     mapSide(e.Winner),
		WinMethod:  mapWinMethod(e.Reason),
		Kills:      s.roundKills,
		FirstKill:  firstKill,
		Clutch:     clutch,
		CTEconomy:  s.ctEconomy,
		TEconomy:   s.tEconomy,
		Duration:   duration,
		BombPlant:  s.roundBomb,
		BombDefuse: s.roundDefuse,
	}

	s.rounds = append(s.rounds, round)

	// CS2 demos don't fire PlayerHurt events. Read cumulative damage
	// from entity properties and compute the per-round delta.
	if !s.hasHurtEvents {
		s.collectEntityDamage()
	}
}

// collectEntityDamage reads m_pActionTrackingServices.m_iDamage from
// player entities. The value is cumulative, so we track the previous
// reading and record the delta as the round damage.
func (s *parseState) collectEntityDamage() {
	gs := s.p.GameState()
	for _, pl := range gs.Participants().Playing() {
		if pl == nil || pl.SteamID64 == 0 || pl.Entity == nil {
			continue
		}
		prop := pl.Entity.Property("m_pActionTrackingServices.m_iDamage")
		if prop == nil {
			continue
		}
		cur := prop.Value().Int()
		prev := s.prevDamage[pl.SteamID64]
		delta := cur - prev
		if delta < 0 {
			delta = 0
		}
		s.prevDamage[pl.SteamID64] = cur

		if delta > 0 {
			s.ensurePlayer(pl)
			if pt := s.players[pl.SteamID64]; pt != nil {
				pt.recordDamage(delta)
			}
		}
	}
}

func (s *parseState) buildMatch() *Match {
	totalRounds := len(s.rounds)

	gs := s.p.GameState()
	ct := gs.TeamCounterTerrorists()
	t := gs.TeamTerrorists()

	ctScore := 0
	tScore := 0
	if ct != nil {
		ctScore = ct.Score()
	}
	if t != nil {
		tScore = t.Score()
	}

	// CS2 matchmaking demos leave ClanName empty. Fall back to side labels.
	ctName := s.ctName
	tName := s.tName
	if ctName == "" {
		ctName = "Counter-Terrorists"
	}
	if tName == "" {
		tName = "Terrorists"
	}

	// collect steam IDs per team
	var ctPlayers, tPlayers []uint64
	for _, pt := range s.players {
		switch pt.team {
		case "CT":
			ctPlayers = append(ctPlayers, pt.steamID)
		case "T":
			tPlayers = append(tPlayers, pt.steamID)
		}
	}

	match := &Match{
		Map:      s.match.Map,
		Date:     time.Now(),
		Duration: s.match.Duration,
		Teams: [2]Team{
			{
				Name:       ctName,
				Score:      ctScore,
				StartedAs:  SideCT,
				Players:    ctPlayers,
				RoundsWon:  ctScore,
				RoundsLost: tScore,
			},
			{
				Name:       tName,
				Score:      tScore,
				StartedAs:  SideT,
				Players:    tPlayers,
				RoundsWon:  tScore,
				RoundsLost: ctScore,
			},
		},
		Rounds: s.rounds,
	}

	for _, pt := range s.players {
		match.Players = append(match.Players, pt.finalize(totalRounds))
	}

	return match
}

func (s *parseState) ensurePlayer(pl *common.Player) {
	if pl == nil || pl.SteamID64 == 0 {
		return
	}
	if _, ok := s.players[pl.SteamID64]; ok {
		return
	}
	team := ""
	switch pl.Team {
	case common.TeamCounterTerrorists:
		team = "CT"
	case common.TeamTerrorists:
		team = "T"
	}
	s.players[pl.SteamID64] = newPlayerTracker(pl.SteamID64, pl.Name, team)
}
