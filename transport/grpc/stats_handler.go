package grpc

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	"github.com/zarldev/cs2stats/repository"
	"github.com/zarldev/cs2stats/service"
	statsv1 "github.com/zarldev/cs2stats/transport/grpc/gen/stats/v1"
	"github.com/zarldev/cs2stats/transport/grpc/gen/stats/v1/statsv1connect"
)

// StatsHandler implements the StatsService ConnectRPC handler.
type StatsHandler struct {
	statsv1connect.UnimplementedStatsServiceHandler
	svc *service.Service
}

// NewStatsHandler creates a StatsHandler backed by the given service.
func NewStatsHandler(svc *service.Service) *StatsHandler {
	return &StatsHandler{svc: svc}
}

func (h *StatsHandler) GetPlayerStats(
	ctx context.Context,
	req *connect.Request[statsv1.GetPlayerStatsRequest],
) (*connect.Response[statsv1.GetPlayerStatsResponse], error) {
	matchID := req.Msg.GetMatchId()
	if matchID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("match_id is required"))
	}

	ps, err := h.svc.GetPlayerStats(ctx, matchID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("match %s not found", matchID))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get player stats for %s: %w", matchID, err))
	}

	// filter by steam_id if provided
	steamID := req.Msg.GetSteamId()

	out := make([]*statsv1.PlayerStats, 0, len(ps))
	for _, p := range ps {
		if steamID != "" && p.SteamID != steamID {
			continue
		}
		out = append(out, playerStatsToStatsProto(p))
	}

	return connect.NewResponse(&statsv1.GetPlayerStatsResponse{
		Players: out,
	}), nil
}

func (h *StatsHandler) GetEconomyStats(
	ctx context.Context,
	req *connect.Request[statsv1.GetEconomyStatsRequest],
) (*connect.Response[statsv1.GetEconomyStatsResponse], error) {
	matchID := req.Msg.GetMatchId()
	if matchID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("match_id is required"))
	}

	rows, err := h.svc.GetEconomyStats(ctx, matchID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("match %s not found", matchID))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get economy stats for %s: %w", matchID, err))
	}

	return connect.NewResponse(&statsv1.GetEconomyStatsResponse{
		Rounds: mergeEconomyRounds(rows),
	}), nil
}

func (h *StatsHandler) GetRoundTimeline(
	ctx context.Context,
	req *connect.Request[statsv1.GetRoundTimelineRequest],
) (*connect.Response[statsv1.GetRoundTimelineResponse], error) {
	matchID := req.Msg.GetMatchId()
	if matchID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("match_id is required"))
	}

	rounds, err := h.svc.GetRoundTimeline(ctx, matchID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("match %s not found", matchID))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get round timeline for %s: %w", matchID, err))
	}

	out := make([]*statsv1.RoundEvent, len(rounds))
	for i, r := range rounds {
		out[i] = roundEventToProto(r)
	}

	return connect.NewResponse(&statsv1.GetRoundTimelineResponse{
		Rounds: out,
	}), nil
}

func (h *StatsHandler) GetPositionalData(
	ctx context.Context,
	req *connect.Request[statsv1.GetPositionalDataRequest],
) (*connect.Response[statsv1.GetPositionalDataResponse], error) {
	matchID := req.Msg.GetMatchId()
	if matchID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("match_id is required"))
	}

	kills, err := h.svc.GetPositionalData(ctx, matchID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("match %s not found", matchID))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get positional data for %s: %w", matchID, err))
	}

	// need map name for response
	detail, err := h.svc.GetMatch(ctx, matchID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("match %s not found", matchID))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get match %s: %w", matchID, err))
	}

	// filter by round number if provided
	roundNum := req.Msg.GetRoundNumber()
	out := make([]*statsv1.KillPosition, 0, len(kills))
	for _, k := range kills {
		if roundNum > 0 && int32(k.RoundNumber) != roundNum {
			continue
		}
		out = append(out, killPositionToProto(k))
	}

	return connect.NewResponse(&statsv1.GetPositionalDataResponse{
		MapName: detail.MapName,
		Kills:   out,
	}), nil
}
