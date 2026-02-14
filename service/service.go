package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/zarldev/cs2stats/parser"
	"github.com/zarldev/cs2stats/repository"
)

// Parser defines the demo parsing interface the service depends on.
type Parser interface {
	Parse(io.Reader) (*parser.Match, error)
}

// ParserFunc adapts a plain function to the Parser interface.
type ParserFunc func(io.Reader) (*parser.Match, error)

func (f ParserFunc) Parse(r io.Reader) (*parser.Match, error) {
	return f(r)
}

// Service orchestrates demo ingestion and stat queries.
type Service struct {
	repo   repository.Repository
	parser Parser
}

// New creates a Service with the given repository and parser.
func New(repo repository.Repository, p Parser) *Service {
	return &Service{repo: repo, parser: p}
}

// IngestDemo parses a demo file and stores the result.
// Returns the match ID on success.
func (s *Service) IngestDemo(ctx context.Context, demoBytes []byte) (string, error) {
	hash := sha256sum(demoBytes)

	parsed, err := s.parser.Parse(bytes.NewReader(demoBytes))
	if err != nil {
		return "", fmt.Errorf("parse demo: %w", err)
	}

	repoMatch := mapParsedMatch(parsed, hash)

	id, err := s.repo.StoreMatch(ctx, repoMatch)
	if err != nil {
		return "", fmt.Errorf("store match: %w", err)
	}

	return id, nil
}

// GetMatch returns match details by ID.
func (s *Service) GetMatch(ctx context.Context, id string) (MatchDetail, error) {
	m, err := s.repo.GetMatch(ctx, id)
	if err != nil {
		return MatchDetail{}, fmt.Errorf("get match %s: %w", id, err)
	}
	return mapRepoMatchToDetail(m), nil
}

// ListMatches returns a paginated list of matches.
func (s *Service) ListMatches(ctx context.Context, filter MatchFilter) ([]MatchSummary, error) {
	repoFilter := repository.MatchFilter{
		MapName:     filter.MapName,
		DateFrom:    filter.DateFrom,
		DateTo:      filter.DateTo,
		PlayerSteam: filter.PlayerSteam,
		Limit:       filter.Limit,
		CursorTime:  filter.CursorTime,
		CursorID:    filter.CursorID,
	}

	ms, err := s.repo.ListMatches(ctx, repoFilter)
	if err != nil {
		return nil, fmt.Errorf("list matches: %w", err)
	}
	return mapRepoSummaries(ms), nil
}

// GetPlayerStats returns player stats for a match.
func (s *Service) GetPlayerStats(ctx context.Context, matchID string) ([]PlayerStats, error) {
	ps, err := s.repo.GetPlayerStats(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("get player stats for %s: %w", matchID, err)
	}
	return mapRepoPlayerStats(ps), nil
}

// GetRoundTimeline returns round-by-round events for a match.
func (s *Service) GetRoundTimeline(ctx context.Context, matchID string) ([]RoundEvent, error) {
	rs, err := s.repo.GetRounds(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("get rounds for %s: %w", matchID, err)
	}
	return mapRepoRounds(rs), nil
}

// GetEconomyStats returns economy data per round for a match.
func (s *Service) GetEconomyStats(ctx context.Context, matchID string) ([]EconomyData, error) {
	es, err := s.repo.GetEconomy(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("get economy for %s: %w", matchID, err)
	}
	return mapRepoEconomy(es), nil
}

// GetPositionalData returns kill positions for map visualization.
func (s *Service) GetPositionalData(ctx context.Context, matchID string) ([]KillPosition, error) {
	ks, err := s.repo.GetKillPositions(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("get kill positions for %s: %w", matchID, err)
	}
	return mapRepoKills(ks), nil
}

func sha256sum(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
