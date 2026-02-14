package grpc

import (
	"encoding/base64"
	"encoding/json"
	"sort"
	"strings"
	"time"

	demov1 "github.com/zarldev/cs2stats/transport/grpc/gen/demo/v1"
	statsv1 "github.com/zarldev/cs2stats/transport/grpc/gen/stats/v1"

	"github.com/zarldev/cs2stats/service"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// request mapping: proto -> service

func listMatchesFilter(req *demov1.ListMatchesRequest) service.MatchFilter {
	f := service.MatchFilter{
		MapName:     req.GetMapName(),
		PlayerSteam: req.GetPlayerSteamId(),
		Limit:       int(req.GetPageSize()),
	}
	if req.GetDateFrom() != nil {
		f.DateFrom = req.GetDateFrom().AsTime()
	}
	if req.GetDateTo() != nil {
		f.DateTo = req.GetDateTo().AsTime()
	}
	if tok := req.GetPageToken(); tok != "" {
		ct, cid := decodeCursor(tok)
		f.CursorTime = ct
		f.CursorID = cid
	}
	return f
}

// response mapping: service -> proto

func matchDetailToProto(m service.MatchDetail) *demov1.Match {
	return &demov1.Match{
		Id:              m.ID,
		MapName:         m.MapName,
		Date:            timestamppb.New(m.Date),
		DurationSeconds: int32(m.DurationSeconds),
		TeamAName:       m.TeamA,
		TeamBName:       m.TeamB,
		TeamAScore:      int32(m.ScoreA),
		TeamBScore:      int32(m.ScoreB),
		DemoFileHash:    m.DemoHash,
		TeamAStartedAs:  m.TeamAStartedAs,
	}
}

func matchSummaryToProto(m service.MatchSummary) *demov1.Match {
	return &demov1.Match{
		Id:              m.ID,
		MapName:         m.MapName,
		Date:            timestamppb.New(m.Date),
		DurationSeconds: int32(m.DurationSeconds),
		TeamAName:       m.TeamA,
		TeamBName:       m.TeamB,
		TeamAScore:      int32(m.ScoreA),
		TeamBScore:      int32(m.ScoreB),
		DemoFileHash:    m.DemoHash,
		TeamAStartedAs:  m.TeamAStartedAs,
	}
}

func playerStatsToProto(ps service.PlayerStats) *demov1.Player {
	return &demov1.Player{
		SteamId: ps.SteamID,
		Name:    ps.Name,
		Team:    ps.Team,
	}
}

func playerStatsToStatsProto(ps service.PlayerStats) *statsv1.PlayerStats {
	return &statsv1.PlayerStats{
		SteamId:       ps.SteamID,
		Name:          ps.Name,
		Team:          ps.Team,
		Kills:         int32(ps.Kills),
		Deaths:        int32(ps.Deaths),
		Assists:       int32(ps.Assists),
		Adr:           float32(ps.ADR),
		Kast:          float32(ps.KAST),
		HsPct:         float32(ps.HeadshotPct),
		Rating:        float32(ps.Rating),
		FlashAssists:  int32(ps.FlashAssists),
		UtilityDamage: int32(ps.UtilityDamage),
	}
}

// mergeEconomyRounds pairs CT and T economy rows into proto EconomyRound messages.
// The service returns one row per team per round; the proto expects one row per round.
func mergeEconomyRounds(rows []service.EconomyData) []*statsv1.EconomyRound {
	type pair struct {
		ct *service.EconomyData
		t  *service.EconomyData
	}
	byRound := make(map[int]*pair)

	for i := range rows {
		r := &rows[i]
		p, ok := byRound[r.RoundNumber]
		if !ok {
			p = &pair{}
			byRound[r.RoundNumber] = p
		}
		switch r.Team {
		case "CT":
			p.ct = r
		case "T":
			p.t = r
		}
	}

	out := make([]*statsv1.EconomyRound, 0, len(byRound))
	for rn, p := range byRound {
		er := &statsv1.EconomyRound{
			RoundNumber: int32(rn),
		}
		if p.ct != nil {
			er.TeamASpend = int32(p.ct.Spend)
			er.TeamAEquipmentValue = int32(p.ct.EquipmentValue)
			er.TeamABuyType = parseBuyType(p.ct.BuyType)
		}
		if p.t != nil {
			er.TeamBSpend = int32(p.t.Spend)
			er.TeamBEquipmentValue = int32(p.t.EquipmentValue)
			er.TeamBBuyType = parseBuyType(p.t.BuyType)
		}
		out = append(out, er)
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].RoundNumber < out[j].RoundNumber
	})

	return out
}

func parseBuyType(s string) statsv1.BuyType {
	switch strings.ToUpper(s) {
	case "ECO":
		return statsv1.BuyType_BUY_TYPE_ECO
	case "FORCE":
		return statsv1.BuyType_BUY_TYPE_FORCE
	case "FULL":
		return statsv1.BuyType_BUY_TYPE_FULL
	case "PISTOL":
		return statsv1.BuyType_BUY_TYPE_PISTOL
	default:
		return statsv1.BuyType_BUY_TYPE_UNSPECIFIED
	}
}

func roundEventToProto(r service.RoundEvent) *statsv1.RoundEvent {
	pe := &statsv1.RoundEvent{
		RoundNumber: int32(r.Number),
		Winner:      r.WinnerTeam,
		WinMethod:   parseWinMethod(r.WinMethod),
	}
	if r.FirstKillSteamID != "" || r.FirstDeathSteamID != "" {
		pe.FirstKill = &statsv1.FirstKill{
			AttackerSteamId: r.FirstKillSteamID,
			VictimSteamId:   r.FirstDeathSteamID,
			Weapon:          r.FirstKillWeapon,
			RoundTime:       float32(r.FirstKillRoundTime),
		}
	}
	if r.Plant != nil {
		pe.Plant = &statsv1.PlantEvent{
			PlanterSteamId: r.Plant.PlanterSteamID,
			Site:           r.Plant.Site,
			RoundTime:      float32(r.Plant.RoundTime),
		}
	}
	if r.Defuse != nil {
		pe.Defuse = &statsv1.DefuseEvent{
			DefuserSteamId: r.Defuse.DefuserSteamID,
			RoundTime:      float32(r.Defuse.RoundTime),
		}
	}
	if r.Clutch != nil {
		pe.Clutch = &statsv1.ClutchInfo{
			PlayerSteamId:  r.Clutch.PlayerSteamID,
			OpponentsAlive: int32(r.Clutch.Opponents),
			Won:            r.Clutch.Success,
		}
	}
	return pe
}

func parseWinMethod(s string) statsv1.WinMethod {
	switch strings.ToUpper(s) {
	case "ELIMINATION":
		return statsv1.WinMethod_WIN_METHOD_ELIMINATION
	case "BOMBEXPLODED", "BOMB_EXPLODED":
		return statsv1.WinMethod_WIN_METHOD_BOMB_EXPLODED
	case "BOMBDEFUSED", "BOMB_DEFUSED":
		return statsv1.WinMethod_WIN_METHOD_BOMB_DEFUSED
	case "TIMEEXPIRED", "TIME_EXPIRED":
		return statsv1.WinMethod_WIN_METHOD_TIME_EXPIRED
	default:
		return statsv1.WinMethod_WIN_METHOD_UNSPECIFIED
	}
}

func killPositionToProto(k service.KillPosition) *statsv1.KillPosition {
	return &statsv1.KillPosition{
		RoundNumber:     int32(k.RoundNumber),
		AttackerSteamId: k.AttackerSteamID,
		VictimSteamId:   k.VictimSteamID,
		Weapon:          k.Weapon,
		IsHeadshot:      k.Headshot,
		AttackerPos: &statsv1.Position{
			X: float32(k.AttackerX),
			Y: float32(k.AttackerY),
			Z: float32(k.AttackerZ),
		},
		VictimPos: &statsv1.Position{
			X: float32(k.VictimX),
			Y: float32(k.VictimY),
			Z: float32(k.VictimZ),
		},
	}
}

// cursor encoding for pagination

type cursor struct {
	Time time.Time `json:"t"`
	ID   string    `json:"id"`
}

func encodeCursor(t time.Time, id string) string {
	data, _ := json.Marshal(cursor{Time: t, ID: id})
	return base64.RawURLEncoding.EncodeToString(data)
}

func decodeCursor(tok string) (time.Time, string) {
	data, err := base64.RawURLEncoding.DecodeString(tok)
	if err != nil {
		return time.Time{}, ""
	}
	var c cursor
	if err := json.Unmarshal(data, &c); err != nil {
		return time.Time{}, ""
	}
	return c.Time, c.ID
}
