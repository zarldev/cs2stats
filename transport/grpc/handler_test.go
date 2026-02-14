package grpc_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"

	"github.com/zarldev/cs2stats/parser"
	"github.com/zarldev/cs2stats/repository"
	"github.com/zarldev/cs2stats/service"
	transportgrpc "github.com/zarldev/cs2stats/transport/grpc"
	demov1 "github.com/zarldev/cs2stats/transport/grpc/gen/demo/v1"
	"github.com/zarldev/cs2stats/transport/grpc/gen/demo/v1/demov1connect"
	statsv1 "github.com/zarldev/cs2stats/transport/grpc/gen/stats/v1"
	"github.com/zarldev/cs2stats/transport/grpc/gen/stats/v1/statsv1connect"
)

// stubParser returns a fixed Match for any input.
func stubParser() service.ParserFunc {
	return func(r io.Reader) (*parser.Match, error) {
		return &parser.Match{
			Map:      "de_dust2",
			Date:     time.Date(2025, 1, 15, 14, 30, 0, 0, time.UTC),
			Duration: 45 * time.Minute,
			Teams: [2]parser.Team{
				{Name: "Team Alpha", Score: 16},
				{Name: "Team Beta", Score: 12},
			},
			Players: []parser.Player{
				{
					SteamID: 76561198000000001,
					Name:    "player1",
					Team:    "Team Alpha",
					Stats: parser.PlayerStats{
						Kills:       25,
						Deaths:      18,
						Assists:     5,
						ADR:         85.2,
						KAST:        72.0,
						HeadshotPct: 48.0,
						Rating:      1.25,
					},
				},
				{
					SteamID: 76561198000000002,
					Name:    "player2",
					Team:    "Team Beta",
					Stats: parser.PlayerStats{
						Kills:       20,
						Deaths:      22,
						Assists:     3,
						ADR:         70.1,
						KAST:        65.0,
						HeadshotPct: 35.0,
						Rating:      0.95,
					},
				},
			},
			Rounds: []parser.Round{
				{
					Number:    1,
					Winner:    parser.SideCT,
					WinMethod: parser.WinMethodElimination,
					FirstKill: &parser.KillEvent{
						AttackerSteamID: 76561198000000001,
						VictimSteamID:   76561198000000002,
					},
					CTEconomy: parser.EconomySnapshot{
						TeamSpend:      4750,
						EquipmentValue: 4750,
						BuyType:        parser.BuyTypeEco,
					},
					TEconomy: parser.EconomySnapshot{
						TeamSpend:      4000,
						EquipmentValue: 4000,
						BuyType:        parser.BuyTypeEco,
					},
					Kills: []parser.KillEvent{
						{
							AttackerSteamID:  76561198000000001,
							VictimSteamID:    76561198000000002,
							Weapon:           "ak47",
							IsHeadshot:       true,
							AttackerPosition: parser.Position{X: 100.5, Y: 200.3, Z: 10.0},
							VictimPosition:   parser.Position{X: 150.1, Y: 180.7, Z: 10.0},
						},
					},
				},
			},
		}, nil
	}
}

func setupTestServer(t *testing.T) (*httptest.Server, demov1connect.DemoServiceClient, statsv1connect.StatsServiceClient) {
	t.Helper()

	repo, err := repository.New(":memory:")
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { repo.Close() })

	svc := service.New(repo, stubParser())

	demoHandler := transportgrpc.NewDemoHandler(svc)
	statsHandler := transportgrpc.NewStatsHandler(svc)

	mux := http.NewServeMux()
	demoPath, demoHTTP := demov1connect.NewDemoServiceHandler(demoHandler)
	statsPath, statsHTTP := statsv1connect.NewStatsServiceHandler(statsHandler)
	mux.Handle(demoPath, demoHTTP)
	mux.Handle(statsPath, statsHTTP)

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	demoClient := demov1connect.NewDemoServiceClient(srv.Client(), srv.URL)
	statsClient := statsv1connect.NewStatsServiceClient(srv.Client(), srv.URL)

	return srv, demoClient, statsClient
}

func uploadDemo(t *testing.T, client demov1connect.DemoServiceClient) string {
	t.Helper()

	resp, err := client.UploadDemo(context.Background(), connect.NewRequest(&demov1.UploadDemoRequest{
		DemoFile: []byte("fake-demo-data"),
		FileName: "test.dem",
	}))
	if err != nil {
		t.Fatalf("upload demo: %v", err)
	}
	if resp.Msg.MatchId == "" {
		t.Fatal("expected non-empty match ID")
	}
	return resp.Msg.MatchId
}

func TestUploadDemo(t *testing.T) {
	_, demoClient, _ := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)
	if matchID == "" {
		t.Fatal("expected match ID")
	}
}

func TestUploadDemoDuplicate(t *testing.T) {
	_, demoClient, _ := setupTestServer(t)

	// first upload succeeds
	uploadDemo(t, demoClient)

	// second upload with same data returns AlreadyExists
	_, err := demoClient.UploadDemo(context.Background(), connect.NewRequest(&demov1.UploadDemoRequest{
		DemoFile: []byte("fake-demo-data"),
		FileName: "test.dem",
	}))
	if err == nil {
		t.Fatal("expected error for duplicate upload")
	}
	if connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatalf("expected AlreadyExists, got %v", connect.CodeOf(err))
	}
}

func TestUploadDemoEmptyFile(t *testing.T) {
	_, demoClient, _ := setupTestServer(t)

	_, err := demoClient.UploadDemo(context.Background(), connect.NewRequest(&demov1.UploadDemoRequest{
		DemoFile: nil,
		FileName: "empty.dem",
	}))
	if err == nil {
		t.Fatal("expected error for empty demo file")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestGetMatch(t *testing.T) {
	_, demoClient, _ := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	resp, err := demoClient.GetMatch(context.Background(), connect.NewRequest(&demov1.GetMatchRequest{
		MatchId: matchID,
	}))
	if err != nil {
		t.Fatalf("get match: %v", err)
	}

	m := resp.Msg.Match
	if m.MapName != "de_dust2" {
		t.Errorf("expected map de_dust2, got %s", m.MapName)
	}
	if m.TeamAName != "Team Alpha" {
		t.Errorf("expected Team Alpha, got %s", m.TeamAName)
	}
	if m.TeamAScore != 16 {
		t.Errorf("expected score 16, got %d", m.TeamAScore)
	}
	if len(resp.Msg.Players) != 2 {
		t.Errorf("expected 2 players, got %d", len(resp.Msg.Players))
	}
}

func TestGetMatchNotFound(t *testing.T) {
	_, demoClient, _ := setupTestServer(t)

	_, err := demoClient.GetMatch(context.Background(), connect.NewRequest(&demov1.GetMatchRequest{
		MatchId: "nonexistent-id",
	}))
	if err == nil {
		t.Fatal("expected error for nonexistent match")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound, got %v", connect.CodeOf(err))
	}
}

func TestListMatches(t *testing.T) {
	_, demoClient, _ := setupTestServer(t)

	uploadDemo(t, demoClient)

	resp, err := demoClient.ListMatches(context.Background(), connect.NewRequest(&demov1.ListMatchesRequest{
		PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("list matches: %v", err)
	}
	if len(resp.Msg.Matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(resp.Msg.Matches))
	}
	if resp.Msg.Matches[0].MapName != "de_dust2" {
		t.Errorf("expected de_dust2, got %s", resp.Msg.Matches[0].MapName)
	}
}

func TestGetPlayerStats(t *testing.T) {
	_, demoClient, statsClient := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	resp, err := statsClient.GetPlayerStats(context.Background(), connect.NewRequest(&statsv1.GetPlayerStatsRequest{
		MatchId: matchID,
	}))
	if err != nil {
		t.Fatalf("get player stats: %v", err)
	}
	if len(resp.Msg.Players) != 2 {
		t.Fatalf("expected 2 players, got %d", len(resp.Msg.Players))
	}

	for _, p := range resp.Msg.Players {
		if p.SteamId == "" {
			t.Error("expected non-empty steam ID")
		}
		if p.Name == "" {
			t.Error("expected non-empty player name")
		}
	}
}

func TestGetPlayerStatsFilterBySteamID(t *testing.T) {
	_, demoClient, statsClient := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	resp, err := statsClient.GetPlayerStats(context.Background(), connect.NewRequest(&statsv1.GetPlayerStatsRequest{
		MatchId: matchID,
		SteamId: "76561198000000001",
	}))
	if err != nil {
		t.Fatalf("get player stats: %v", err)
	}
	if len(resp.Msg.Players) != 1 {
		t.Fatalf("expected 1 player, got %d", len(resp.Msg.Players))
	}
	if resp.Msg.Players[0].Kills != 25 {
		t.Errorf("expected 25 kills, got %d", resp.Msg.Players[0].Kills)
	}
}

func TestGetEconomyStats(t *testing.T) {
	_, demoClient, statsClient := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	resp, err := statsClient.GetEconomyStats(context.Background(), connect.NewRequest(&statsv1.GetEconomyStatsRequest{
		MatchId: matchID,
	}))
	if err != nil {
		t.Fatalf("get economy stats: %v", err)
	}
	if len(resp.Msg.Rounds) != 1 {
		t.Fatalf("expected 1 economy round, got %d", len(resp.Msg.Rounds))
	}
	r := resp.Msg.Rounds[0]
	if r.RoundNumber != 1 {
		t.Errorf("expected round 1, got %d", r.RoundNumber)
	}
	if r.TeamABuyType != statsv1.BuyType_BUY_TYPE_ECO {
		t.Errorf("expected ECO buy type for team A, got %v", r.TeamABuyType)
	}
}

func TestGetRoundTimeline(t *testing.T) {
	_, demoClient, statsClient := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	resp, err := statsClient.GetRoundTimeline(context.Background(), connect.NewRequest(&statsv1.GetRoundTimelineRequest{
		MatchId: matchID,
	}))
	if err != nil {
		t.Fatalf("get round timeline: %v", err)
	}
	if len(resp.Msg.Rounds) != 1 {
		t.Fatalf("expected 1 round, got %d", len(resp.Msg.Rounds))
	}
	if resp.Msg.Rounds[0].Winner != "CT" {
		t.Errorf("expected CT winner, got %s", resp.Msg.Rounds[0].Winner)
	}
	if resp.Msg.Rounds[0].WinMethod != statsv1.WinMethod_WIN_METHOD_ELIMINATION {
		t.Errorf("expected ELIMINATION, got %v", resp.Msg.Rounds[0].WinMethod)
	}
}

func TestGetPositionalData(t *testing.T) {
	_, demoClient, statsClient := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	resp, err := statsClient.GetPositionalData(context.Background(), connect.NewRequest(&statsv1.GetPositionalDataRequest{
		MatchId: matchID,
	}))
	if err != nil {
		t.Fatalf("get positional data: %v", err)
	}
	if resp.Msg.MapName != "de_dust2" {
		t.Errorf("expected de_dust2, got %s", resp.Msg.MapName)
	}
	if len(resp.Msg.Kills) != 1 {
		t.Fatalf("expected 1 kill position, got %d", len(resp.Msg.Kills))
	}
	k := resp.Msg.Kills[0]
	if k.Weapon != "ak47" {
		t.Errorf("expected ak47, got %s", k.Weapon)
	}
	if !k.IsHeadshot {
		t.Error("expected headshot")
	}
}

func TestGetPositionalDataFilterByRound(t *testing.T) {
	_, demoClient, statsClient := setupTestServer(t)

	matchID := uploadDemo(t, demoClient)

	// round 1 has kills
	resp, err := statsClient.GetPositionalData(context.Background(), connect.NewRequest(&statsv1.GetPositionalDataRequest{
		MatchId:     matchID,
		RoundNumber: 1,
	}))
	if err != nil {
		t.Fatalf("get positional data: %v", err)
	}
	if len(resp.Msg.Kills) != 1 {
		t.Fatalf("expected 1 kill for round 1, got %d", len(resp.Msg.Kills))
	}

	// round 99 has no kills
	resp, err = statsClient.GetPositionalData(context.Background(), connect.NewRequest(&statsv1.GetPositionalDataRequest{
		MatchId:     matchID,
		RoundNumber: 99,
	}))
	if err != nil {
		t.Fatalf("get positional data: %v", err)
	}
	if len(resp.Msg.Kills) != 0 {
		t.Fatalf("expected 0 kills for round 99, got %d", len(resp.Msg.Kills))
	}
}
