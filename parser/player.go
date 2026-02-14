package parser

import (
	"time"
)

// tradeWindow is the maximum time between a teammate's death and a kill
// on their killer for it to count as a trade.
const tradeWindow = 5 * time.Second

// playerTracker accumulates per-player stats across the match.
type playerTracker struct {
	steamID uint64
	name    string
	team    string

	kills         int
	deaths        int
	assists       int
	headshots     int
	flashAssists  int
	utilityDamage int
	tradeKills    int
	totalDamage   int
	firstKills    int
	firstDeaths   int

	// per-round tracking for KAST
	roundKill     map[int]bool // round -> had a kill
	roundAssist   map[int]bool // round -> had an assist
	roundSurvived map[int]bool // round -> survived
	roundTraded   map[int]bool // round -> was traded (died but teammate traded)
	roundDeath    map[int]bool // round -> died this round

	// multi-kill tracking: round -> kill count
	roundKillCount map[int]int

	roundsPlayed int
}

func newPlayerTracker(steamID uint64, name, team string) *playerTracker {
	return &playerTracker{
		steamID:        steamID,
		name:           name,
		team:           team,
		roundKill:      make(map[int]bool),
		roundAssist:    make(map[int]bool),
		roundSurvived:  make(map[int]bool),
		roundTraded:    make(map[int]bool),
		roundDeath:     make(map[int]bool),
		roundKillCount: make(map[int]int),
	}
}

func (pt *playerTracker) recordKill(round int, isHeadshot bool) {
	pt.kills++
	pt.roundKill[round] = true
	pt.roundKillCount[round]++
	if isHeadshot {
		pt.headshots++
	}
}

func (pt *playerTracker) recordDeath(round int) {
	pt.deaths++
	pt.roundDeath[round] = true
}

func (pt *playerTracker) recordAssist(round int) {
	pt.assists++
	pt.roundAssist[round] = true
}

func (pt *playerTracker) recordFlashAssist(round int) {
	pt.flashAssists++
	pt.roundAssist[round] = true
}

func (pt *playerTracker) recordDamage(damage int) {
	pt.totalDamage += damage
}

func (pt *playerTracker) recordUtilityDamage(damage int) {
	pt.utilityDamage += damage
}

func (pt *playerTracker) recordTradeKill(round int) {
	pt.tradeKills++
}

func (pt *playerTracker) markTraded(round int) {
	pt.roundTraded[round] = true
}

func (pt *playerTracker) markSurvived(round int) {
	pt.roundSurvived[round] = true
}

func (pt *playerTracker) recordFirstKill(round int) {
	pt.firstKills++
}

func (pt *playerTracker) recordFirstDeath(round int) {
	pt.firstDeaths++
}

func (pt *playerTracker) finalize(totalRounds int) Player {
	pt.roundsPlayed = totalRounds

	kastRounds := 0
	for r := 1; r <= totalRounds; r++ {
		if pt.roundKill[r] || pt.roundAssist[r] || pt.roundSurvived[r] || pt.roundTraded[r] {
			kastRounds++
		}
	}

	adr := CalculateADR(pt.totalDamage, totalRounds)
	kastPct := CalculateKAST(kastRounds, totalRounds)
	hsPct := CalculateHeadshotPct(pt.headshots, pt.kills)

	survived := 0
	for r := 1; r <= totalRounds; r++ {
		if pt.roundSurvived[r] {
			survived++
		}
	}

	rating := CalculateRating(pt.kills, pt.deaths, pt.assists, totalRounds, survived, kastPct, adr)

	multiKills := make(map[int]int)
	for _, count := range pt.roundKillCount {
		if count >= 2 {
			multiKills[count]++
		}
	}

	return Player{
		SteamID: pt.steamID,
		Name:    pt.name,
		Team:    pt.team,
		Stats: PlayerStats{
			Kills:         pt.kills,
			Deaths:        pt.deaths,
			Assists:       pt.assists,
			ADR:           adr,
			KAST:          kastPct,
			HeadshotPct:   hsPct,
			FlashAssists:  pt.flashAssists,
			UtilityDamage: pt.utilityDamage,
			TradeKills:    pt.tradeKills,
			Rating:        rating,
			TotalDamage:   pt.totalDamage,
			Headshots:     pt.headshots,
			RoundsPlayed:  totalRounds,
			Survived:      survived,
			FirstKills:    pt.firstKills,
			FirstDeaths:   pt.firstDeaths,
			MultiKills:    multiKills,
		},
	}
}

// recentDeath holds info about a recent death for trade detection.
type recentDeath struct {
	victimSteamID  uint64
	killerSteamID  uint64
	victimTeam     string
	time           time.Duration
	round          int
}
