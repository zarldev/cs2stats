package repository

import (
	"context"
	"testing"
	"time"
)

func newTestRepo(t *testing.T) *SQLite {
	t.Helper()
	repo, err := New(":memory:")
	if err != nil {
		t.Fatalf("create test repo: %v", err)
	}
	t.Cleanup(func() { repo.Close() })
	return repo
}

func seedMatch(t *testing.T, repo *SQLite) Match {
	t.Helper()
	now := time.Now().Truncate(time.Second)
	m := Match{
		ID:              "match-001",
		MapName:         "de_dust2",
		Date:            now.Add(-time.Hour),
		DurationSeconds: 2400,
		TeamA:           "Team Alpha",
		TeamB:           "Team Beta",
		ScoreA:          16,
		ScoreB:          12,
		DemoHash:        "abc123hash",
		CreatedAt:       now,
		Players: []PlayerStats{
			{
				PlayerID: "p1", SteamID: "76561198001", Name: "Player One",
				Team: "CT", Kills: 25, Deaths: 15, Assists: 5,
				ADR: 85.3, KAST: 72.0, HeadshotPct: 55.0, Rating: 1.25,
				FlashAssists: 3, UtilityDamage: 120,
			},
			{
				PlayerID: "p2", SteamID: "76561198002", Name: "Player Two",
				Team: "T", Kills: 18, Deaths: 20, Assists: 7,
				ADR: 70.1, KAST: 65.0, HeadshotPct: 40.0, Rating: 0.95,
				FlashAssists: 1, UtilityDamage: 80,
			},
		},
		Rounds: []Round{
			{
				ID: "r1", Number: 1, WinnerTeam: "CT", WinMethod: "Elimination",
				FirstKillPlayerID: "p1", FirstDeathPlayerID: "p2",
			},
			{
				ID: "r2", Number: 2, WinnerTeam: "T", WinMethod: "BombExploded",
				FirstKillPlayerID: "p2", FirstDeathPlayerID: "p1",
				Clutch: &Clutch{
					RoundID: "r2", PlayerID: "p2", Opponents: 2, Success: true,
				},
			},
		},
		Economy: []EconomyRound{
			{RoundID: "r1", Team: "CT", Spend: 4100, EquipmentValue: 4500, BuyType: "Eco"},
			{RoundID: "r1", Team: "T", Spend: 3900, EquipmentValue: 4200, BuyType: "Eco"},
			{RoundID: "r2", Team: "CT", Spend: 16000, EquipmentValue: 20000, BuyType: "Full"},
			{RoundID: "r2", Team: "T", Spend: 12000, EquipmentValue: 14000, BuyType: "Force"},
		},
		KillEvents: []KillEvent{
			{
				ID: "k1", RoundID: "r1", Attacker: "p1", Victim: "p2",
				Weapon: "AK-47", Headshot: true,
				AttackerX: 100.5, AttackerY: 200.3, AttackerZ: 10.0,
				VictimX: 300.1, VictimY: 400.2, VictimZ: 10.0,
			},
			{
				ID: "k2", RoundID: "r2", Attacker: "p2", Victim: "p1",
				Weapon: "AWP", Headshot: false,
				AttackerX: 150.0, AttackerY: 250.0, AttackerZ: 12.0,
				VictimX: 350.0, VictimY: 450.0, VictimZ: 12.0,
			},
		},
	}

	id, err := repo.StoreMatch(context.Background(), m)
	if err != nil {
		t.Fatalf("seed match: %v", err)
	}
	if id != "match-001" {
		t.Fatalf("expected match ID match-001, got %s", id)
	}
	return m
}

func TestStoreAndGetMatch(t *testing.T) {
	repo := newTestRepo(t)
	want := seedMatch(t, repo)

	got, err := repo.GetMatch(context.Background(), "match-001")
	if err != nil {
		t.Fatalf("get match: %v", err)
	}

	if got.ID != want.ID {
		t.Errorf("ID: got %s, want %s", got.ID, want.ID)
	}
	if got.MapName != want.MapName {
		t.Errorf("MapName: got %s, want %s", got.MapName, want.MapName)
	}
	if got.DurationSeconds != want.DurationSeconds {
		t.Errorf("DurationSeconds: got %d, want %d", got.DurationSeconds, want.DurationSeconds)
	}
	if got.TeamA != want.TeamA {
		t.Errorf("TeamA: got %s, want %s", got.TeamA, want.TeamA)
	}
	if got.ScoreA != want.ScoreA {
		t.Errorf("ScoreA: got %d, want %d", got.ScoreA, want.ScoreA)
	}
	if got.ScoreB != want.ScoreB {
		t.Errorf("ScoreB: got %d, want %d", got.ScoreB, want.ScoreB)
	}
	if got.DemoHash != want.DemoHash {
		t.Errorf("DemoHash: got %s, want %s", got.DemoHash, want.DemoHash)
	}
}

func TestGetMatchNotFound(t *testing.T) {
	repo := newTestRepo(t)

	_, err := repo.GetMatch(context.Background(), "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestDuplicateDemo(t *testing.T) {
	repo := newTestRepo(t)
	seedMatch(t, repo)

	dup := Match{
		ID: "match-002", MapName: "de_inferno", DemoHash: "abc123hash",
		Date: time.Now(), CreatedAt: time.Now(),
		TeamA: "A", TeamB: "B",
	}
	_, err := repo.StoreMatch(context.Background(), dup)
	if err != ErrDuplicateDemo {
		t.Errorf("expected ErrDuplicateDemo, got %v", err)
	}
}

func TestListMatches(t *testing.T) {
	repo := newTestRepo(t)
	now := time.Now().Truncate(time.Second)

	matches := []Match{
		{
			ID: "m1", MapName: "de_dust2", Date: now.Add(-3 * time.Hour),
			DurationSeconds: 2400, TeamA: "A", TeamB: "B", ScoreA: 16, ScoreB: 10,
			DemoHash: "hash1", CreatedAt: now.Add(-3 * time.Hour),
			Players: []PlayerStats{
				{PlayerID: "p1", SteamID: "steam1", Name: "P1", Team: "CT"},
			},
		},
		{
			ID: "m2", MapName: "de_inferno", Date: now.Add(-2 * time.Hour),
			DurationSeconds: 2200, TeamA: "C", TeamB: "D", ScoreA: 14, ScoreB: 16,
			DemoHash: "hash2", CreatedAt: now.Add(-2 * time.Hour),
			Players: []PlayerStats{
				{PlayerID: "p2", SteamID: "steam2", Name: "P2", Team: "T"},
			},
		},
		{
			ID: "m3", MapName: "de_dust2", Date: now.Add(-time.Hour),
			DurationSeconds: 1800, TeamA: "E", TeamB: "F", ScoreA: 16, ScoreB: 5,
			DemoHash: "hash3", CreatedAt: now.Add(-time.Hour),
			Players: []PlayerStats{
				{PlayerID: "p1-m3", SteamID: "steam1", Name: "P1", Team: "CT"},
			},
		},
	}

	ctx := context.Background()
	for _, m := range matches {
		if _, err := repo.StoreMatch(ctx, m); err != nil {
			t.Fatalf("store match %s: %v", m.ID, err)
		}
	}

	tests := []struct {
		name   string
		filter MatchFilter
		want   int
		first  string
	}{
		{
			name:   "all matches",
			filter: MatchFilter{},
			want:   3,
			first:  "m3",
		},
		{
			name:   "filter by map",
			filter: MatchFilter{MapName: "de_dust2"},
			want:   2,
			first:  "m3",
		},
		{
			name:   "filter by player steam ID",
			filter: MatchFilter{PlayerSteam: "steam2"},
			want:   1,
			first:  "m2",
		},
		{
			name:   "filter by date range",
			filter: MatchFilter{DateFrom: now.Add(-150 * time.Minute), DateTo: now.Add(-90 * time.Minute)},
			want:   1,
			first:  "m2",
		},
		{
			name:   "limit results",
			filter: MatchFilter{Limit: 2},
			want:   2,
			first:  "m3",
		},
		{
			name:   "cursor pagination",
			filter: MatchFilter{CursorTime: now.Add(-time.Hour), CursorID: "m3"},
			want:   2,
			first:  "m2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := repo.ListMatches(ctx, tt.filter)
			if err != nil {
				t.Fatalf("list matches: %v", err)
			}
			if len(got) != tt.want {
				t.Errorf("count: got %d, want %d", len(got), tt.want)
			}
			if len(got) > 0 && got[0].ID != tt.first {
				t.Errorf("first ID: got %s, want %s", got[0].ID, tt.first)
			}
		})
	}
}

func TestGetPlayerStats(t *testing.T) {
	repo := newTestRepo(t)
	seedMatch(t, repo)

	stats, err := repo.GetPlayerStats(context.Background(), "match-001")
	if err != nil {
		t.Fatalf("get player stats: %v", err)
	}

	if len(stats) != 2 {
		t.Fatalf("expected 2 players, got %d", len(stats))
	}

	// ordered by rating DESC, so Player One first
	p := stats[0]
	if p.SteamID != "76561198001" {
		t.Errorf("first player SteamID: got %s, want 76561198001", p.SteamID)
	}
	if p.Kills != 25 {
		t.Errorf("kills: got %d, want 25", p.Kills)
	}
	if p.Rating != 1.25 {
		t.Errorf("rating: got %f, want 1.25", p.Rating)
	}
}

func TestGetRounds(t *testing.T) {
	repo := newTestRepo(t)
	seedMatch(t, repo)

	rounds, err := repo.GetRounds(context.Background(), "match-001")
	if err != nil {
		t.Fatalf("get rounds: %v", err)
	}

	if len(rounds) != 2 {
		t.Fatalf("expected 2 rounds, got %d", len(rounds))
	}

	r1 := rounds[0]
	if r1.Number != 1 {
		t.Errorf("round 1 number: got %d", r1.Number)
	}
	if r1.WinnerTeam != "CT" {
		t.Errorf("round 1 winner: got %s, want CT", r1.WinnerTeam)
	}
	if r1.Clutch != nil {
		t.Error("round 1 should have no clutch")
	}

	r2 := rounds[1]
	if r2.Clutch == nil {
		t.Fatal("round 2 should have a clutch")
	}
	if !r2.Clutch.Success {
		t.Error("round 2 clutch should be successful")
	}
	if r2.Clutch.Opponents != 2 {
		t.Errorf("clutch opponents: got %d, want 2", r2.Clutch.Opponents)
	}
}

func TestGetEconomy(t *testing.T) {
	repo := newTestRepo(t)
	seedMatch(t, repo)

	econ, err := repo.GetEconomy(context.Background(), "match-001")
	if err != nil {
		t.Fatalf("get economy: %v", err)
	}

	if len(econ) != 4 {
		t.Fatalf("expected 4 economy rows, got %d", len(econ))
	}

	// r1 CT
	if econ[0].BuyType != "Eco" {
		t.Errorf("r1 CT buy type: got %s, want Eco", econ[0].BuyType)
	}
	// r2 CT
	if econ[2].BuyType != "Full" {
		t.Errorf("r2 CT buy type: got %s, want Full", econ[2].BuyType)
	}
}

func TestGetKillPositions(t *testing.T) {
	repo := newTestRepo(t)
	seedMatch(t, repo)

	kills, err := repo.GetKillPositions(context.Background(), "match-001")
	if err != nil {
		t.Fatalf("get kill positions: %v", err)
	}

	if len(kills) != 2 {
		t.Fatalf("expected 2 kills, got %d", len(kills))
	}

	k1 := kills[0]
	if k1.Weapon != "AK-47" {
		t.Errorf("kill 1 weapon: got %s, want AK-47", k1.Weapon)
	}
	if !k1.Headshot {
		t.Error("kill 1 should be headshot")
	}
	if k1.AttackerX != 100.5 {
		t.Errorf("kill 1 attacker X: got %f, want 100.5", k1.AttackerX)
	}

	k2 := kills[1]
	if k2.Headshot {
		t.Error("kill 2 should not be headshot")
	}
}

func TestPlayerUpsert(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()
	now := time.Now().Truncate(time.Second)

	// first match with player name "OldName"
	m1 := Match{
		ID: "m1", MapName: "de_dust2", Date: now, DurationSeconds: 1200,
		TeamA: "A", TeamB: "B", DemoHash: "hash-a", CreatedAt: now,
		Players: []PlayerStats{
			{PlayerID: "p-a", SteamID: "steam-99", Name: "OldName", Team: "CT", Kills: 10},
		},
	}
	if _, err := repo.StoreMatch(ctx, m1); err != nil {
		t.Fatalf("store m1: %v", err)
	}

	// second match, same steam ID, new player ID, updated name
	m2 := Match{
		ID: "m2", MapName: "de_dust2", Date: now, DurationSeconds: 1200,
		TeamA: "A", TeamB: "B", DemoHash: "hash-b", CreatedAt: now.Add(time.Second),
		Players: []PlayerStats{
			{PlayerID: "p-b", SteamID: "steam-99", Name: "NewName", Team: "T", Kills: 15},
		},
	}
	if _, err := repo.StoreMatch(ctx, m2); err != nil {
		t.Fatalf("store m2: %v", err)
	}

	// the player name should be updated
	stats, err := repo.GetPlayerStats(ctx, "m2")
	if err != nil {
		t.Fatalf("get player stats: %v", err)
	}
	if len(stats) != 1 {
		t.Fatalf("expected 1 player, got %d", len(stats))
	}
	// the upsert should have updated the name to NewName
	if stats[0].Name != "NewName" {
		t.Errorf("player name: got %s, want NewName", stats[0].Name)
	}
}
