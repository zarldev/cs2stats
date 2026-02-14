package parser

import (
	"math"
	"testing"
)

func TestCalculateADR(t *testing.T) {
	tests := []struct {
		name         string
		totalDamage  int
		roundsPlayed int
		want         float64
	}{
		{name: "zero rounds", totalDamage: 1000, roundsPlayed: 0, want: 0},
		{name: "zero damage", totalDamage: 0, roundsPlayed: 10, want: 0},
		{name: "even split", totalDamage: 1000, roundsPlayed: 10, want: 100},
		{name: "low adr", totalDamage: 450, roundsPlayed: 30, want: 15},
		{name: "high adr", totalDamage: 3200, roundsPlayed: 25, want: 128},
		{name: "fractional", totalDamage: 100, roundsPlayed: 3, want: 100.0 / 3.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateADR(tt.totalDamage, tt.roundsPlayed)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("CalculateADR(%d, %d) = %f, want %f",
					tt.totalDamage, tt.roundsPlayed, got, tt.want)
			}
		})
	}
}

func TestCalculateKAST(t *testing.T) {
	tests := []struct {
		name         string
		kastRounds   int
		roundsPlayed int
		want         float64
	}{
		{name: "zero rounds", kastRounds: 5, roundsPlayed: 0, want: 0},
		{name: "perfect kast", kastRounds: 30, roundsPlayed: 30, want: 100},
		{name: "half kast", kastRounds: 15, roundsPlayed: 30, want: 50},
		{name: "typical kast", kastRounds: 22, roundsPlayed: 30, want: 22.0 / 30.0 * 100},
		{name: "low kast", kastRounds: 10, roundsPlayed: 30, want: 10.0 / 30.0 * 100},
		{name: "zero kast rounds", kastRounds: 0, roundsPlayed: 20, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateKAST(tt.kastRounds, tt.roundsPlayed)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("CalculateKAST(%d, %d) = %f, want %f",
					tt.kastRounds, tt.roundsPlayed, got, tt.want)
			}
		})
	}
}

func TestCalculateHeadshotPct(t *testing.T) {
	tests := []struct {
		name      string
		headshots int
		kills     int
		want      float64
	}{
		{name: "zero kills", headshots: 0, kills: 0, want: 0},
		{name: "all headshots", headshots: 20, kills: 20, want: 100},
		{name: "half headshots", headshots: 10, kills: 20, want: 50},
		{name: "no headshots", headshots: 0, kills: 15, want: 0},
		{name: "typical", headshots: 12, kills: 25, want: 48},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateHeadshotPct(tt.headshots, tt.kills)
			if math.Abs(got-tt.want) > 0.001 {
				t.Errorf("CalculateHeadshotPct(%d, %d) = %f, want %f",
					tt.headshots, tt.kills, got, tt.want)
			}
		})
	}
}

func TestClassifyBuyType(t *testing.T) {
	tests := []struct {
		name           string
		equipmentValue int
		want           BuyType
	}{
		{name: "eco low", equipmentValue: 0, want: BuyTypeEco},
		{name: "eco pistol round", equipmentValue: 2000, want: BuyTypeEco},
		{name: "eco boundary below", equipmentValue: 4999, want: BuyTypeEco},
		{name: "force boundary", equipmentValue: 5000, want: BuyTypeForce},
		{name: "force mid", equipmentValue: 10000, want: BuyTypeForce},
		{name: "force boundary upper", equipmentValue: 15000, want: BuyTypeForce},
		{name: "full buy just above", equipmentValue: 15001, want: BuyTypeFull},
		{name: "full buy rifles", equipmentValue: 25000, want: BuyTypeFull},
		{name: "full buy awp round", equipmentValue: 35000, want: BuyTypeFull},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ClassifyBuyType(tt.equipmentValue)
			if got != tt.want {
				t.Errorf("ClassifyBuyType(%d) = %v, want %v",
					tt.equipmentValue, got, tt.want)
			}
		})
	}
}

func TestCalculateRating(t *testing.T) {
	tests := []struct {
		name         string
		kills        int
		deaths       int
		assists      int
		roundsPlayed int
		survived     int
		kastPct      float64
		adr          float64
		wantMin      float64 // rating should be within this range
		wantMax      float64
	}{
		{
			name:         "zero rounds",
			kills:        0,
			deaths:       0,
			assists:      0,
			roundsPlayed: 0,
			survived:     0,
			kastPct:      0,
			adr:          0,
			wantMin:      0,
			wantMax:      0,
		},
		{
			name:         "average player",
			kills:        20,
			deaths:       18,
			assists:      5,
			roundsPlayed: 30,
			survived:     12,
			kastPct:      70,
			adr:          75,
			wantMin:      0.8,
			wantMax:      1.3,
		},
		{
			name:         "star player",
			kills:        30,
			deaths:       10,
			assists:      8,
			roundsPlayed: 25,
			survived:     15,
			kastPct:      90,
			adr:          110,
			wantMin:      1.3,
			wantMax:      2.5,
		},
		{
			name:         "struggling player",
			kills:        8,
			deaths:       22,
			assists:      3,
			roundsPlayed: 30,
			survived:     8,
			kastPct:      40,
			adr:          40,
			wantMin:      0.0,
			wantMax:      0.8,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateRating(tt.kills, tt.deaths, tt.assists,
				tt.roundsPlayed, tt.survived, tt.kastPct, tt.adr)

			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("CalculateRating() = %f, want between %f and %f",
					got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestPlayerTrackerFinalize(t *testing.T) {
	pt := newPlayerTracker(12345, "TestPlayer", "CT")

	// simulate a 5-round match
	// round 1: kill + survived
	pt.recordKill(1, true)
	pt.recordDamage(100)
	pt.markSurvived(1)

	// round 2: death, no contribution
	pt.recordDeath(2)
	pt.recordDamage(30)

	// round 3: assist + survived
	pt.recordAssist(3)
	pt.recordDamage(50)
	pt.markSurvived(3)

	// round 4: kill + death (traded)
	pt.recordKill(4, false)
	pt.recordDeath(4)
	pt.recordDamage(100)
	pt.markTraded(4)

	// round 5: kill + headshot + survived
	pt.recordKill(5, true)
	pt.recordKill(5, false)
	pt.recordDamage(200)
	pt.markSurvived(5)

	player := pt.finalize(5)

	if player.Stats.Kills != 4 {
		t.Errorf("kills = %d, want 4", player.Stats.Kills)
	}
	if player.Stats.Deaths != 2 {
		t.Errorf("deaths = %d, want 2", player.Stats.Deaths)
	}
	if player.Stats.Assists != 1 {
		t.Errorf("assists = %d, want 1", player.Stats.Assists)
	}
	if player.Stats.Headshots != 2 {
		t.Errorf("headshots = %d, want 2", player.Stats.Headshots)
	}
	if player.Stats.TotalDamage != 480 {
		t.Errorf("total damage = %d, want 480", player.Stats.TotalDamage)
	}
	if player.Stats.Survived != 3 {
		t.Errorf("survived = %d, want 3", player.Stats.Survived)
	}

	// KAST: rounds 1 (kill), 3 (assist), 4 (traded), 5 (kill) = 4/5 = 80%
	if math.Abs(player.Stats.KAST-80.0) > 0.1 {
		t.Errorf("KAST = %f, want 80.0", player.Stats.KAST)
	}

	// ADR: 480 / 5 = 96
	if math.Abs(player.Stats.ADR-96.0) > 0.1 {
		t.Errorf("ADR = %f, want 96.0", player.Stats.ADR)
	}

	// HS%: 2/4 = 50%
	if math.Abs(player.Stats.HeadshotPct-50.0) > 0.1 {
		t.Errorf("HeadshotPct = %f, want 50.0", player.Stats.HeadshotPct)
	}

	// multi-kills: round 5 had 2 kills
	if player.Stats.MultiKills[2] != 1 {
		t.Errorf("multi-kills[2] = %d, want 1", player.Stats.MultiKills[2])
	}

	// rating should be positive for a decent performance
	if player.Stats.Rating <= 0 {
		t.Errorf("rating = %f, want > 0", player.Stats.Rating)
	}
}

func TestPlayerTrackerMultiKills(t *testing.T) {
	pt := newPlayerTracker(99999, "AcePlayer", "T")

	// round with 5 kills (ace)
	for i := 0; i < 5; i++ {
		pt.recordKill(1, i%2 == 0) // alternate headshots
		pt.recordDamage(100)
	}
	pt.markSurvived(1)

	// round with 3 kills
	for i := 0; i < 3; i++ {
		pt.recordKill(2, false)
		pt.recordDamage(80)
	}
	pt.markSurvived(2)

	// round with 1 kill (not a multi-kill)
	pt.recordKill(3, true)
	pt.recordDamage(100)
	pt.markSurvived(3)

	player := pt.finalize(3)

	if player.Stats.Kills != 9 {
		t.Errorf("kills = %d, want 9", player.Stats.Kills)
	}
	if player.Stats.MultiKills[5] != 1 {
		t.Errorf("multi-kills[5] (aces) = %d, want 1", player.Stats.MultiKills[5])
	}
	if player.Stats.MultiKills[3] != 1 {
		t.Errorf("multi-kills[3] = %d, want 1", player.Stats.MultiKills[3])
	}
	if _, ok := player.Stats.MultiKills[1]; ok {
		t.Errorf("multi-kills[1] should not exist, single kills are not multi-kills")
	}
}

func TestDetectClutch(t *testing.T) {
	tests := []struct {
		name    string
		kills   []KillEvent
		aliveCT map[uint64]bool
		aliveT  map[uint64]bool
		wantNil bool
		wantID  uint64
		wantOpp int
		wantWin bool
	}{
		{
			name:    "no kills no clutch",
			kills:   nil,
			aliveCT: map[uint64]bool{1: true, 2: true},
			aliveT:  map[uint64]bool{3: true, 4: true},
			wantNil: true,
		},
		{
			name: "1v2 clutch success",
			kills: []KillEvent{
				// first kill eliminates a CT, creating 1v2
				{AttackerSteamID: 3, AttackerName: "T1", VictimSteamID: 2, VictimName: "CT2"},
				// clutcher kills first opponent
				{AttackerSteamID: 1, AttackerName: "CT1", VictimSteamID: 3, VictimName: "T1"},
				// clutcher kills second opponent
				{AttackerSteamID: 1, AttackerName: "CT1", VictimSteamID: 4, VictimName: "T2"},
			},
			aliveCT: map[uint64]bool{1: true, 2: true},
			aliveT:  map[uint64]bool{3: true, 4: true},
			wantNil: false,
			wantID:  1,
			wantOpp: 2,
			wantWin: true,
		},
		{
			name: "1v2 clutch fail",
			kills: []KillEvent{
				// T1 kills CT1, creating 1v2 for CT2
				{AttackerSteamID: 3, AttackerName: "T1", VictimSteamID: 1, VictimName: "CT1"},
				// clutcher CT2 trades one opponent
				{AttackerSteamID: 2, AttackerName: "CT2", VictimSteamID: 4, VictimName: "T2"},
				// T1 kills the clutcher
				{AttackerSteamID: 3, AttackerName: "T1", VictimSteamID: 2, VictimName: "CT2"},
			},
			aliveCT: map[uint64]bool{1: true, 2: true},
			aliveT:  map[uint64]bool{3: true, 4: true},
			wantNil: false,
			wantID:  2,
			wantOpp: 2,
			wantWin: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := detectClutch(tt.kills, tt.aliveCT, tt.aliveT)
			if tt.wantNil {
				if got != nil {
					t.Errorf("expected nil clutch, got %+v", got)
				}
				return
			}
			if got == nil {
				t.Fatal("expected clutch info, got nil")
			}
			if got.PlayerSteamID != tt.wantID {
				t.Errorf("clutcher steam ID = %d, want %d", got.PlayerSteamID, tt.wantID)
			}
			if got.Opponents != tt.wantOpp {
				t.Errorf("opponents = %d, want %d", got.Opponents, tt.wantOpp)
			}
			if got.Success != tt.wantWin {
				t.Errorf("success = %v, want %v", got.Success, tt.wantWin)
			}
		})
	}
}

func TestWinMethodString(t *testing.T) {
	tests := []struct {
		method WinMethod
		want   string
	}{
		{WinMethodElimination, "Elimination"},
		{WinMethodBombExploded, "BombExploded"},
		{WinMethodBombDefused, "BombDefused"},
		{WinMethodTimeExpired, "TimeExpired"},
		{WinMethodUnknown, "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.method.String(); got != tt.want {
				t.Errorf("WinMethod.String() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestBuyTypeString(t *testing.T) {
	tests := []struct {
		bt   BuyType
		want string
	}{
		{BuyTypeEco, "Eco"},
		{BuyTypeForce, "Force"},
		{BuyTypeFull, "Full"},
		{BuyType(99), "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.bt.String(); got != tt.want {
				t.Errorf("BuyType.String() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestSideString(t *testing.T) {
	tests := []struct {
		side Side
		want string
	}{
		{SideCT, "CT"},
		{SideT, "T"},
		{Side(99), "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := tt.side.String(); got != tt.want {
				t.Errorf("Side.String() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestRatingFormulaDeterministic(t *testing.T) {
	// same inputs should always produce same output
	r1 := CalculateRating(20, 15, 5, 30, 15, 70, 80)
	r2 := CalculateRating(20, 15, 5, 30, 15, 70, 80)
	if r1 != r2 {
		t.Errorf("rating not deterministic: %f != %f", r1, r2)
	}
}

func TestRatingRelativeOrdering(t *testing.T) {
	// a player with better stats should have a higher rating
	good := CalculateRating(25, 10, 8, 25, 15, 85, 100)
	avg := CalculateRating(15, 15, 5, 25, 10, 65, 70)
	bad := CalculateRating(5, 20, 2, 25, 5, 30, 30)

	if good <= avg {
		t.Errorf("good rating (%f) should be > avg rating (%f)", good, avg)
	}
	if avg <= bad {
		t.Errorf("avg rating (%f) should be > bad rating (%f)", avg, bad)
	}
}

func TestPlayerTrackerTradeKills(t *testing.T) {
	pt := newPlayerTracker(1, "Trader", "CT")

	pt.recordKill(1, false)
	pt.recordTradeKill(1)
	pt.markSurvived(1)
	pt.recordDamage(100)

	player := pt.finalize(1)
	if player.Stats.TradeKills != 1 {
		t.Errorf("trade kills = %d, want 1", player.Stats.TradeKills)
	}
}

func TestPlayerTrackerFlashAssists(t *testing.T) {
	pt := newPlayerTracker(1, "Flasher", "CT")

	pt.recordFlashAssist(1)
	pt.recordFlashAssist(1)
	pt.markSurvived(1)

	player := pt.finalize(1)
	if player.Stats.FlashAssists != 2 {
		t.Errorf("flash assists = %d, want 2", player.Stats.FlashAssists)
	}
}

func TestPlayerTrackerFirstKillsDeath(t *testing.T) {
	pt := newPlayerTracker(1, "EntryFragger", "T")

	pt.recordFirstKill(1)
	pt.recordFirstKill(2)
	pt.recordFirstDeath(3)
	pt.markSurvived(1)
	pt.markSurvived(2)
	pt.recordDeath(3)

	player := pt.finalize(3)
	if player.Stats.FirstKills != 2 {
		t.Errorf("first kills = %d, want 2", player.Stats.FirstKills)
	}
	if player.Stats.FirstDeaths != 1 {
		t.Errorf("first deaths = %d, want 1", player.Stats.FirstDeaths)
	}
}
