package service

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/zarldev/cs2stats/parser"
	"github.com/zarldev/cs2stats/repository"
)

// mapParsedMatch converts a parsed demo into repository types for storage.
// It generates all IDs and maps every nested structure.
func mapParsedMatch(pm *parser.Match, demoHash string) repository.Match {
	matchID := uuid.New().String()
	now := time.Now()

	// build player ID lookup: steam_id string -> generated player UUID
	playerIDs := make(map[string]string)
	for _, p := range pm.Players {
		sid := steamIDStr(p.SteamID)
		if _, ok := playerIDs[sid]; !ok {
			playerIDs[sid] = uuid.New().String()
		}
	}

	// map player stats
	players := make([]repository.PlayerStats, 0, len(pm.Players))
	for _, p := range pm.Players {
		sid := steamIDStr(p.SteamID)
		players = append(players, repository.PlayerStats{
			MatchID:       matchID,
			PlayerID:      playerIDs[sid],
			SteamID:       sid,
			Name:          p.Name,
			Team:          p.Team,
			Kills:         p.Stats.Kills,
			Deaths:        p.Stats.Deaths,
			Assists:       p.Stats.Assists,
			ADR:           p.Stats.ADR,
			KAST:          p.Stats.KAST,
			HeadshotPct:   p.Stats.HeadshotPct,
			Rating:        p.Stats.Rating,
			FlashAssists:  p.Stats.FlashAssists,
			UtilityDamage: p.Stats.UtilityDamage,
		})
	}

	// map rounds, economy, kill events
	var (
		rounds []repository.Round
		econ   []repository.EconomyRound
		kills  []repository.KillEvent
	)

	for _, r := range pm.Rounds {
		roundID := uuid.New().String()

		firstKillPID := ""
		firstDeathPID := ""
		firstKillSteamID := ""
		firstDeathSteamID := ""
		firstKillWeapon := ""
		var firstKillRoundTime float64
		if r.FirstKill != nil {
			firstKillPID = playerIDs[steamIDStr(r.FirstKill.AttackerSteamID)]
			firstDeathPID = playerIDs[steamIDStr(r.FirstKill.VictimSteamID)]
			firstKillSteamID = steamIDStr(r.FirstKill.AttackerSteamID)
			firstDeathSteamID = steamIDStr(r.FirstKill.VictimSteamID)
			firstKillWeapon = r.FirstKill.Weapon
			firstKillRoundTime = (r.FirstKill.Time - r.StartTime).Seconds()
		}

		round := repository.Round{
			ID:                  roundID,
			MatchID:             matchID,
			Number:              r.Number,
			WinnerTeam:          r.Winner.String(),
			WinMethod:           r.WinMethod.String(),
			FirstKillPlayerID:   firstKillPID,
			FirstDeathPlayerID:  firstDeathPID,
			FirstKillSteamID:    firstKillSteamID,
			FirstDeathSteamID:   firstDeathSteamID,
			FirstKillWeapon:     firstKillWeapon,
			FirstKillRoundTime:  firstKillRoundTime,
		}

		if r.BombPlant != nil {
			round.BombPlantSteamID = steamIDStr(r.BombPlant.PlayerSteamID)
			round.BombPlantSite = r.BombPlant.Site
		}
		if r.BombDefuse != nil {
			round.BombDefuseSteamID = steamIDStr(r.BombDefuse.PlayerSteamID)
		}

		if r.Clutch != nil {
			round.Clutch = &repository.Clutch{
				RoundID:       roundID,
				PlayerID:      playerIDs[steamIDStr(r.Clutch.PlayerSteamID)],
				PlayerSteamID: steamIDStr(r.Clutch.PlayerSteamID),
				Opponents:     r.Clutch.Opponents,
				Success:       r.Clutch.Success,
			}
		}

		rounds = append(rounds, round)

		// economy: two entries per round (CT and T)
		econ = append(econ,
			repository.EconomyRound{
				RoundID:        roundID,
				MatchID:        matchID,
				RoundNumber:    r.Number,
				Team:           "CT",
				Spend:          r.CTEconomy.TeamSpend,
				EquipmentValue: r.CTEconomy.EquipmentValue,
				BuyType:        r.CTEconomy.BuyType.String(),
			},
			repository.EconomyRound{
				RoundID:        roundID,
				MatchID:        matchID,
				RoundNumber:    r.Number,
				Team:           "T",
				Spend:          r.TEconomy.TeamSpend,
				EquipmentValue: r.TEconomy.EquipmentValue,
				BuyType:        r.TEconomy.BuyType.String(),
			},
		)

		// kill events
		for _, k := range r.Kills {
			kills = append(kills, repository.KillEvent{
				ID:              uuid.New().String(),
				RoundID:         roundID,
				Attacker:        playerIDs[steamIDStr(k.AttackerSteamID)],
				Victim:          playerIDs[steamIDStr(k.VictimSteamID)],
				AttackerSteamID: steamIDStr(k.AttackerSteamID),
				VictimSteamID:   steamIDStr(k.VictimSteamID),
				Weapon:          k.Weapon,
				Headshot:        k.IsHeadshot,
				AttackerX:       k.AttackerPosition.X,
				AttackerY:       k.AttackerPosition.Y,
				AttackerZ:       k.AttackerPosition.Z,
				VictimX:         k.VictimPosition.X,
				VictimY:         k.VictimPosition.Y,
				VictimZ:         k.VictimPosition.Z,
			})
		}
	}

	// Bug 4: prefer per-round winner counts when they match total rounds
	ctScore := pm.Teams[0].Score
	tScore := pm.Teams[1].Score
	if len(rounds) > 0 {
		roundCT := 0
		roundT := 0
		for _, r := range rounds {
			switch r.WinnerTeam {
			case "CT":
				roundCT++
			case "T":
				roundT++
			}
		}
		// use round counts when they cover all rounds (i.e. sum equals total rounds played)
		if roundCT+roundT == len(rounds) && roundCT+roundT == ctScore+tScore {
			ctScore = roundCT
			tScore = roundT
		}
	}

	return repository.Match{
		ID:              matchID,
		MapName:         pm.Map,
		Date:            pm.Date,
		DurationSeconds: int(pm.Duration.Seconds()),
		TeamA:           pm.Teams[0].Name,
		TeamB:           pm.Teams[1].Name,
		ScoreA:          ctScore,
		ScoreB:          tScore,
		DemoHash:        demoHash,
		TeamAStartedAs:  pm.Teams[0].StartedAs.String(),
		CreatedAt:       now,
		Players:         players,
		Rounds:          rounds,
		Economy:         econ,
		KillEvents:      kills,
	}
}

func steamIDStr(id uint64) string {
	return fmt.Sprintf("%d", id)
}

// mapRepoMatchToDetail converts a repository Match to a service MatchDetail.
func mapRepoMatchToDetail(m repository.Match) MatchDetail {
	return MatchDetail{
		ID:              m.ID,
		MapName:         m.MapName,
		Date:            m.Date,
		DurationSeconds: m.DurationSeconds,
		TeamA:           m.TeamA,
		TeamB:           m.TeamB,
		ScoreA:          m.ScoreA,
		ScoreB:          m.ScoreB,
		DemoHash:        m.DemoHash,
		TeamAStartedAs:  m.TeamAStartedAs,
	}
}

// mapRepoSummaries converts repository summaries to service summaries.
func mapRepoSummaries(ms []repository.MatchSummary) []MatchSummary {
	out := make([]MatchSummary, len(ms))
	for i, m := range ms {
		out[i] = MatchSummary{
			ID:              m.ID,
			MapName:         m.MapName,
			Date:            m.Date,
			DurationSeconds: m.DurationSeconds,
			TeamA:           m.TeamA,
			TeamB:           m.TeamB,
			ScoreA:          m.ScoreA,
			ScoreB:          m.ScoreB,
			TeamAStartedAs:  m.TeamAStartedAs,
			CreatedAt:       m.CreatedAt,
		}
	}
	return out
}

// mapRepoPlayerStats converts repository player stats to service player stats.
func mapRepoPlayerStats(ps []repository.PlayerStats) []PlayerStats {
	out := make([]PlayerStats, len(ps))
	for i, p := range ps {
		out[i] = PlayerStats{
			PlayerID:      p.PlayerID,
			SteamID:       p.SteamID,
			Name:          p.Name,
			Team:          p.Team,
			Kills:         p.Kills,
			Deaths:        p.Deaths,
			Assists:       p.Assists,
			ADR:           p.ADR,
			KAST:          p.KAST,
			HeadshotPct:   p.HeadshotPct,
			Rating:        p.Rating,
			FlashAssists:  p.FlashAssists,
			UtilityDamage: p.UtilityDamage,
		}
	}
	return out
}

// mapRepoRounds converts repository rounds to service round events.
func mapRepoRounds(rs []repository.Round) []RoundEvent {
	out := make([]RoundEvent, len(rs))
	for i, r := range rs {
		out[i] = RoundEvent{
			Number:             r.Number,
			WinnerTeam:         r.WinnerTeam,
			WinMethod:          r.WinMethod,
			FirstKillPlayerID:  r.FirstKillPlayerID,
			FirstDeathPlayerID: r.FirstDeathPlayerID,
			FirstKillSteamID:   r.FirstKillSteamID,
			FirstDeathSteamID:  r.FirstDeathSteamID,
			FirstKillWeapon:    r.FirstKillWeapon,
			FirstKillRoundTime: r.FirstKillRoundTime,
		}
		if r.BombPlantSteamID != "" {
			out[i].Plant = &PlantEvent{
				PlanterSteamID: r.BombPlantSteamID,
				Site:           r.BombPlantSite,
				RoundTime:      r.BombPlantRoundTime,
			}
		}
		if r.BombDefuseSteamID != "" {
			out[i].Defuse = &DefuseEvent{
				DefuserSteamID: r.BombDefuseSteamID,
				RoundTime:      r.BombDefuseRoundTime,
			}
		}
		if r.Clutch != nil {
			out[i].Clutch = &ClutchEvent{
				PlayerID:      r.Clutch.PlayerID,
				PlayerSteamID: r.Clutch.PlayerSteamID,
				Opponents:     r.Clutch.Opponents,
				Success:       r.Clutch.Success,
			}
		}
	}
	return out
}

// mapRepoEconomy converts repository economy data to service economy data.
func mapRepoEconomy(es []repository.EconomyRound) []EconomyData {
	out := make([]EconomyData, len(es))
	for i, e := range es {
		out[i] = EconomyData{
			RoundNumber:    e.RoundNumber,
			Team:           e.Team,
			Spend:          e.Spend,
			EquipmentValue: e.EquipmentValue,
			BuyType:        e.BuyType,
		}
	}
	return out
}

// mapRepoKills converts repository kill events to service kill positions.
func mapRepoKills(ks []repository.KillEvent) []KillPosition {
	out := make([]KillPosition, len(ks))
	for i, k := range ks {
		out[i] = KillPosition{
			RoundNumber:     k.RoundNum,
			AttackerID:      k.Attacker,
			VictimID:        k.Victim,
			AttackerSteamID: k.AttackerSteamID,
			VictimSteamID:   k.VictimSteamID,
			Weapon:          k.Weapon,
			Headshot:        k.Headshot,
			AttackerX:       k.AttackerX,
			AttackerY:       k.AttackerY,
			AttackerZ:       k.AttackerZ,
			VictimX:         k.VictimX,
			VictimY:         k.VictimY,
			VictimZ:         k.VictimZ,
		}
	}
	return out
}
