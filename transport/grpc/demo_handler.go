package grpc

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	"github.com/zarldev/cs2stats/repository"
	"github.com/zarldev/cs2stats/service"
	demov1 "github.com/zarldev/cs2stats/transport/grpc/gen/demo/v1"
	"github.com/zarldev/cs2stats/transport/grpc/gen/demo/v1/demov1connect"
)

// DemoHandler implements the DemoService ConnectRPC handler.
type DemoHandler struct {
	demov1connect.UnimplementedDemoServiceHandler
	svc *service.Service
}

// NewDemoHandler creates a DemoHandler backed by the given service.
func NewDemoHandler(svc *service.Service) *DemoHandler {
	return &DemoHandler{svc: svc}
}

func (h *DemoHandler) UploadDemo(
	ctx context.Context,
	req *connect.Request[demov1.UploadDemoRequest],
) (*connect.Response[demov1.UploadDemoResponse], error) {
	data := req.Msg.GetDemoFile()
	if len(data) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("demo_file is required"))
	}

	matchID, err := h.svc.IngestDemo(ctx, data)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateDemo) {
			return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("demo already uploaded"))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("ingest demo: %w", err))
	}

	return connect.NewResponse(&demov1.UploadDemoResponse{
		MatchId: matchID,
	}), nil
}

func (h *DemoHandler) ListMatches(
	ctx context.Context,
	req *connect.Request[demov1.ListMatchesRequest],
) (*connect.Response[demov1.ListMatchesResponse], error) {
	filter := listMatchesFilter(req.Msg)

	// default page size
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	// fetch one extra to detect next page
	filter.Limit++

	matches, err := h.svc.ListMatches(ctx, filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("list matches: %w", err))
	}

	hasMore := len(matches) >= filter.Limit
	if hasMore {
		matches = matches[:filter.Limit-1]
	}

	pbMatches := make([]*demov1.Match, len(matches))
	for i, m := range matches {
		pbMatches[i] = matchSummaryToProto(m)
	}

	resp := &demov1.ListMatchesResponse{
		Matches: pbMatches,
	}
	if hasMore {
		last := matches[len(matches)-1]
		resp.NextPageToken = encodeCursor(last.CreatedAt, last.ID)
	}

	return connect.NewResponse(resp), nil
}

func (h *DemoHandler) GetMatch(
	ctx context.Context,
	req *connect.Request[demov1.GetMatchRequest],
) (*connect.Response[demov1.GetMatchResponse], error) {
	id := req.Msg.GetMatchId()
	if id == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("match_id is required"))
	}

	detail, err := h.svc.GetMatch(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("match %s not found", id))
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get match %s: %w", id, err))
	}

	// fetch players for this match
	ps, err := h.svc.GetPlayerStats(ctx, id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("get players for match %s: %w", id, err))
	}

	players := make([]*demov1.Player, len(ps))
	for i, p := range ps {
		players[i] = playerStatsToProto(p)
	}

	return connect.NewResponse(&demov1.GetMatchResponse{
		Match:   matchDetailToProto(detail),
		Players: players,
	}), nil
}
