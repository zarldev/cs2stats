package parser

import (
	common "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	events "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

// mapWinMethod converts a demoinfocs RoundEndReason to our WinMethod type.
func mapWinMethod(reason events.RoundEndReason) WinMethod {
	switch reason {
	case events.RoundEndReasonTargetBombed:
		return WinMethodBombExploded
	case events.RoundEndReasonBombDefused:
		return WinMethodBombDefused
	case events.RoundEndReasonCTWin, events.RoundEndReasonTerroristsWin:
		return WinMethodElimination
	case events.RoundEndReasonTargetSaved:
		return WinMethodTimeExpired
	default:
		return WinMethodUnknown
	}
}

// mapSide converts a demoinfocs Team to our Side type.
func mapSide(team common.Team) Side {
	if team == common.TeamCounterTerrorists {
		return SideCT
	}
	return SideT
}

// detectClutch checks the round's kill events to find clutch situations.
// A clutch occurs when a player is the last alive on their team and faces
// one or more opponents. We detect this by tracking alive counts at each kill.
func detectClutch(kills []KillEvent, aliveCT, aliveT map[uint64]bool) *ClutchInfo {
	if len(kills) == 0 {
		return nil
	}

	// rebuild alive state from initial counts, replaying kills
	ctAlive := copyAliveMap(aliveCT)
	tAlive := copyAliveMap(aliveT)

	var clutcher *ClutchInfo

	for i := range kills {
		k := &kills[i]
		// remove victim from alive
		delete(ctAlive, k.VictimSteamID)
		delete(tAlive, k.VictimSteamID)

		// check if this creates a 1vN situation
		if len(ctAlive) == 1 && len(tAlive) > 0 && clutcher == nil {
			for sid := range ctAlive {
				clutcher = &ClutchInfo{
					PlayerSteamID: sid,
					PlayerName:    k.AttackerName, // may not match; corrected below
					Opponents:     len(tAlive),
					Success:       false,
				}
				// find the correct name
				for j := range kills {
					if kills[j].AttackerSteamID == sid {
						clutcher.PlayerName = kills[j].AttackerName
						break
					}
					if kills[j].VictimSteamID == sid {
						clutcher.PlayerName = kills[j].VictimName
						break
					}
				}
			}
		}
		if len(tAlive) == 1 && len(ctAlive) > 0 && clutcher == nil {
			for sid := range tAlive {
				clutcher = &ClutchInfo{
					PlayerSteamID: sid,
					PlayerName:    k.AttackerName,
					Opponents:     len(ctAlive),
					Success:       false,
				}
				for j := range kills {
					if kills[j].AttackerSteamID == sid {
						clutcher.PlayerName = kills[j].AttackerName
						break
					}
					if kills[j].VictimSteamID == sid {
						clutcher.PlayerName = kills[j].VictimName
						break
					}
				}
			}
		}

		// track clutch kills
		if clutcher != nil && k.AttackerSteamID == clutcher.PlayerSteamID {
			clutcher.Kills++
		}
	}

	// determine success: the clutcher must still be alive at end of round
	if clutcher != nil {
		_, inCT := ctAlive[clutcher.PlayerSteamID]
		_, inT := tAlive[clutcher.PlayerSteamID]
		if inCT || inT {
			clutcher.Success = true
		}
	}

	return clutcher
}

func copyAliveMap(m map[uint64]bool) map[uint64]bool {
	out := make(map[uint64]bool, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
