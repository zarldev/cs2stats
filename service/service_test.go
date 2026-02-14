package service

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/zarldev/cs2stats/parser"
	"github.com/zarldev/cs2stats/repository"
)

func newTestService(t *testing.T) (*Service, *repository.SQLite) {
	t.Helper()
	repo, err := repository.New(":memory:")
	if err != nil {
		t.Fatalf("create test repo: %v", err)
	}
	t.Cleanup(func() { repo.Close() })

	p := ParserFunc(func(r io.Reader) (*parser.Match, error) {
		return &parser.Match{
			Map:      "de_dust2",
			Date:     time.Date(2025, 1, 15, 14, 0, 0, 0, time.UTC),
			Duration: 40 * time.Minute,
			Teams: [2]parser.Team{
				{Name: "Navi", Score: 16, StartedAs: parser.SideCT},
				{Name: "FaZe", Score: 12, StartedAs: parser.SideT},
			},
			Players: []parser.Player{
				{
					SteamID: 76561198001, Name: "s1mple", Team: "CT",
					Stats: parser.PlayerStats{
						Kills: 30, Deaths: 15, Assists: 5,
						ADR: 90.5, KAST: 78.0, HeadshotPct: 60.0, Rating: 1.45,
						FlashAssists: 4, UtilityDamage: 150,
					},
				},
				{
					SteamID: 76561198002, Name: "rain", Team: "T",
					Stats: parser.PlayerStats{
						Kills: 20, Deaths: 18, Assists: 8,
						ADR: 75.0, KAST: 68.0, HeadshotPct: 45.0, Rating: 1.05,
						FlashAssists: 2, UtilityDamage: 90,
					},
				},
			},
			Rounds: []parser.Round{
				{
					Number:    1,
					Winner:    parser.SideCT,
					WinMethod: parser.WinMethodElimination,
					FirstKill: &parser.KillEvent{
						AttackerSteamID:  76561198001,
						VictimSteamID:    76561198002,
						Weapon:           "AK-47",
						IsHeadshot:       true,
						AttackerPosition: parser.Position{X: 100, Y: 200, Z: 10},
						VictimPosition:   parser.Position{X: 300, Y: 400, Z: 10},
					},
					Kills: []parser.KillEvent{
						{
							AttackerSteamID:  76561198001,
							VictimSteamID:    76561198002,
							Weapon:           "AK-47",
							IsHeadshot:       true,
							AttackerPosition: parser.Position{X: 100, Y: 200, Z: 10},
							VictimPosition:   parser.Position{X: 300, Y: 400, Z: 10},
						},
					},
					CTEconomy: parser.EconomySnapshot{TeamSpend: 4000, EquipmentValue: 4500, BuyType: parser.BuyTypeEco},
					TEconomy:  parser.EconomySnapshot{TeamSpend: 3800, EquipmentValue: 4100, BuyType: parser.BuyTypeEco},
				},
				{
					Number:    2,
					Winner:    parser.SideT,
					WinMethod: parser.WinMethodBombExploded,
					FirstKill: &parser.KillEvent{
						AttackerSteamID: 76561198002,
						VictimSteamID:   76561198001,
						Weapon:          "AWP",
					},
					Kills: []parser.KillEvent{
						{
							AttackerSteamID: 76561198002,
							VictimSteamID:   76561198001,
							Weapon:          "AWP",
						},
					},
					Clutch: &parser.ClutchInfo{
						PlayerSteamID: 76561198002,
						PlayerName:    "rain",
						Opponents:     2,
						Success:       true,
						Kills:         2,
					},
					CTEconomy: parser.EconomySnapshot{TeamSpend: 16000, EquipmentValue: 20000, BuyType: parser.BuyTypeFull},
					TEconomy:  parser.EconomySnapshot{TeamSpend: 6000, EquipmentValue: 8000, BuyType: parser.BuyTypeForce},
				},
			},
		}, nil
	})

	svc := New(repo, p)
	return svc, repo
}

// seedViaRepo stores a match directly in the repository,
// bypassing the parser, for service query tests.
func seedViaRepo(t *testing.T, repo *repository.SQLite) string {
	t.Helper()
	now := time.Now().Truncate(time.Second)
	m := repository.Match{
		ID: "test-match-id", MapName: "de_mirage",
		Date: now, DurationSeconds: 2100,
		TeamA: "Astralis", TeamB: "Liquid",
		ScoreA: 16, ScoreB: 14,
		DemoHash: "seed-hash-123", CreatedAt: now,
		Players: []repository.PlayerStats{
			{
				PlayerID: "pid1", SteamID: "76561198001", Name: "device",
				Team: "CT", Kills: 22, Deaths: 16, Assists: 4,
				ADR: 82.0, KAST: 70.0, HeadshotPct: 50.0, Rating: 1.20,
				FlashAssists: 2, UtilityDamage: 100,
			},
			{
				PlayerID: "pid2", SteamID: "76561198002", Name: "NAF",
				Team: "T", Kills: 19, Deaths: 18, Assists: 6,
				ADR: 74.0, KAST: 66.0, HeadshotPct: 42.0, Rating: 1.00,
				FlashAssists: 1, UtilityDamage: 70,
			},
		},
		Rounds: []repository.Round{
			{
				ID: "rd1", Number: 1, WinnerTeam: "CT", WinMethod: "Elimination",
				FirstKillPlayerID: "pid1", FirstDeathPlayerID: "pid2",
			},
			{
				ID: "rd2", Number: 2, WinnerTeam: "T", WinMethod: "BombExploded",
				FirstKillPlayerID: "pid2", FirstDeathPlayerID: "pid1",
				Clutch: &repository.Clutch{
					RoundID: "rd2", PlayerID: "pid2", Opponents: 3, Success: false,
				},
			},
		},
		Economy: []repository.EconomyRound{
			{RoundID: "rd1", Team: "CT", Spend: 4200, EquipmentValue: 4800, BuyType: "Eco"},
			{RoundID: "rd1", Team: "T", Spend: 3900, EquipmentValue: 4300, BuyType: "Eco"},
			{RoundID: "rd2", Team: "CT", Spend: 16500, EquipmentValue: 21000, BuyType: "Full"},
			{RoundID: "rd2", Team: "T", Spend: 11000, EquipmentValue: 13000, BuyType: "Force"},
		},
		KillEvents: []repository.KillEvent{
			{
				ID: "ke1", RoundID: "rd1", Attacker: "pid1", Victim: "pid2",
				Weapon: "M4A4", Headshot: true,
				AttackerX: 50, AttackerY: 60, AttackerZ: 5,
				VictimX: 150, VictimY: 160, VictimZ: 5,
			},
		},
	}
	_, err := repo.StoreMatch(context.Background(), m)
	if err != nil {
		t.Fatalf("seed repo: %v", err)
	}
	return m.ID
}

func TestIngestDemo(t *testing.T) {
	svc, _ := newTestService(t)

	id, err := svc.IngestDemo(context.Background(), []byte("fake demo data"))
	if err != nil {
		t.Fatalf("ingest demo: %v", err)
	}
	if id == "" {
		t.Fatal("expected non-empty match ID")
	}

	// verify we can retrieve the match
	detail, err := svc.GetMatch(context.Background(), id)
	if err != nil {
		t.Fatalf("get match after ingest: %v", err)
	}
	if detail.MapName != "de_dust2" {
		t.Errorf("map: got %s, want de_dust2", detail.MapName)
	}
	if detail.ScoreA != 16 || detail.ScoreB != 12 {
		t.Errorf("score: got %d-%d, want 16-12", detail.ScoreA, detail.ScoreB)
	}
	if detail.DemoHash == "" {
		t.Error("expected non-empty demo hash after ingest")
	}
	if detail.Date.IsZero() {
		t.Error("expected non-zero date after ingest")
	}
}

func TestIngestDemoDuplicate(t *testing.T) {
	svc, _ := newTestService(t)
	ctx := context.Background()

	demo := []byte("same demo content")
	_, err := svc.IngestDemo(ctx, demo)
	if err != nil {
		t.Fatalf("first ingest: %v", err)
	}

	_, err = svc.IngestDemo(ctx, demo)
	if err == nil {
		t.Fatal("expected error on duplicate demo")
	}
}

func TestGetMatch(t *testing.T) {
	_, repo := newTestService(t)
	matchID := seedViaRepo(t, repo)

	svc := New(repo, nil) // parser not needed for queries

	detail, err := svc.GetMatch(context.Background(), matchID)
	if err != nil {
		t.Fatalf("get match: %v", err)
	}

	if detail.MapName != "de_mirage" {
		t.Errorf("map: got %s, want de_mirage", detail.MapName)
	}
	if detail.TeamA != "Astralis" {
		t.Errorf("team A: got %s, want Astralis", detail.TeamA)
	}
	if detail.DemoHash != "seed-hash-123" {
		t.Errorf("demo hash: got %s, want seed-hash-123", detail.DemoHash)
	}
}

func TestGetMatchNotFound(t *testing.T) {
	svc, _ := newTestService(t)

	_, err := svc.GetMatch(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent match")
	}
}

func TestListMatches(t *testing.T) {
	_, repo := newTestService(t)
	seedViaRepo(t, repo)

	svc := New(repo, nil)

	results, err := svc.ListMatches(context.Background(), MatchFilter{})
	if err != nil {
		t.Fatalf("list matches: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 match, got %d", len(results))
	}
	if results[0].MapName != "de_mirage" {
		t.Errorf("map: got %s, want de_mirage", results[0].MapName)
	}
}

func TestGetPlayerStats(t *testing.T) {
	_, repo := newTestService(t)
	matchID := seedViaRepo(t, repo)

	svc := New(repo, nil)

	stats, err := svc.GetPlayerStats(context.Background(), matchID)
	if err != nil {
		t.Fatalf("get player stats: %v", err)
	}
	if len(stats) != 2 {
		t.Fatalf("expected 2 players, got %d", len(stats))
	}

	// ordered by rating DESC
	if stats[0].Name != "device" {
		t.Errorf("first player: got %s, want device", stats[0].Name)
	}
	if stats[0].Kills != 22 {
		t.Errorf("kills: got %d, want 22", stats[0].Kills)
	}
}

func TestGetRoundTimeline(t *testing.T) {
	_, repo := newTestService(t)
	matchID := seedViaRepo(t, repo)

	svc := New(repo, nil)

	rounds, err := svc.GetRoundTimeline(context.Background(), matchID)
	if err != nil {
		t.Fatalf("get round timeline: %v", err)
	}
	if len(rounds) != 2 {
		t.Fatalf("expected 2 rounds, got %d", len(rounds))
	}

	if rounds[0].WinnerTeam != "CT" {
		t.Errorf("round 1 winner: got %s, want CT", rounds[0].WinnerTeam)
	}
	if rounds[1].Clutch == nil {
		t.Fatal("round 2 should have clutch")
	}
	if rounds[1].Clutch.Opponents != 3 {
		t.Errorf("clutch opponents: got %d, want 3", rounds[1].Clutch.Opponents)
	}
	if rounds[1].Clutch.Success {
		t.Error("clutch should not be successful")
	}
}

func TestGetEconomyStats(t *testing.T) {
	_, repo := newTestService(t)
	matchID := seedViaRepo(t, repo)

	svc := New(repo, nil)

	econ, err := svc.GetEconomyStats(context.Background(), matchID)
	if err != nil {
		t.Fatalf("get economy stats: %v", err)
	}
	if len(econ) != 4 {
		t.Fatalf("expected 4 economy entries, got %d", len(econ))
	}

	// first entry: round 1 CT
	if econ[0].BuyType != "Eco" {
		t.Errorf("round 1 CT buy type: got %s, want Eco", econ[0].BuyType)
	}
	if econ[0].RoundNumber != 1 {
		t.Errorf("round number: got %d, want 1", econ[0].RoundNumber)
	}
}

func TestGetPositionalData(t *testing.T) {
	_, repo := newTestService(t)
	matchID := seedViaRepo(t, repo)

	svc := New(repo, nil)

	kills, err := svc.GetPositionalData(context.Background(), matchID)
	if err != nil {
		t.Fatalf("get positional data: %v", err)
	}
	if len(kills) != 1 {
		t.Fatalf("expected 1 kill, got %d", len(kills))
	}
	if kills[0].Weapon != "M4A4" {
		t.Errorf("weapon: got %s, want M4A4", kills[0].Weapon)
	}
	if !kills[0].Headshot {
		t.Error("expected headshot")
	}
}
