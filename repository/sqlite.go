package repository

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Repository defines the data access interface for cs2stats.
type Repository interface {
	StoreMatch(ctx context.Context, m Match) (string, error)
	GetMatch(ctx context.Context, id string) (Match, error)
	ListMatches(ctx context.Context, filter MatchFilter) ([]MatchSummary, error)
	GetPlayerStats(ctx context.Context, matchID string) ([]PlayerStats, error)
	GetRounds(ctx context.Context, matchID string) ([]Round, error)
	GetEconomy(ctx context.Context, matchID string) ([]EconomyRound, error)
	GetKillPositions(ctx context.Context, matchID string) ([]KillEvent, error)
}

// SQLite implements Repository backed by a SQLite database.
type SQLite struct {
	db *sql.DB
}

// New opens a SQLite database at the given path and runs migrations.
// Use ":memory:" for an in-memory database.
func New(dsn string) (*SQLite, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// enable WAL mode and foreign keys
	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("set pragma %q: %w", pragma, err)
		}
	}

	s := &SQLite{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return s, nil
}

// Close closes the underlying database connection.
func (s *SQLite) Close() error {
	return s.db.Close()
}

func (s *SQLite) migrate() error {
	// create version tracking table
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`)
	if err != nil {
		return fmt.Errorf("create schema_version table: %w", err)
	}

	var current int
	row := s.db.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_version`)
	if err := row.Scan(&current); err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}

	type migration struct {
		version int
		file    string
	}
	all := []migration{
		{1, "migrations/001_initial.sql"},
		{2, "migrations/002_round_first_kill_details.sql"},
	}

	for _, m := range all {
		if m.version <= current {
			continue
		}
		data, err := migrations.ReadFile(m.file)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", m.file, err)
		}
		_, err = s.db.Exec(string(data))
		if err != nil {
			return fmt.Errorf("execute migration %s: %w", m.file, err)
		}
		_, err = s.db.Exec(`INSERT INTO schema_version (version) VALUES (?)`, m.version)
		if err != nil {
			return fmt.Errorf("record migration version %d: %w", m.version, err)
		}
	}
	return nil
}

func (s *SQLite) StoreMatch(ctx context.Context, m Match) (string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// insert match
	_, err = tx.ExecContext(ctx,
		`INSERT INTO matches (id, map_name, date, duration_seconds, team_a, team_b, score_a, score_b, demo_hash, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.MapName, m.Date.Format(time.RFC3339), m.DurationSeconds,
		m.TeamA, m.TeamB, m.ScoreA, m.ScoreB, m.DemoHash, m.CreatedAt.Format(time.RFC3339Nano),
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint") && strings.Contains(err.Error(), "demo_hash") {
			return "", ErrDuplicateDemo
		}
		return "", fmt.Errorf("insert match: %w", err)
	}

	// upsert players and insert match_players
	for _, ps := range m.Players {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO players (id, steam_id, name) VALUES (?, ?, ?)
			 ON CONFLICT(steam_id) DO UPDATE SET name = excluded.name`,
			ps.PlayerID, ps.SteamID, ps.Name,
		)
		if err != nil {
			return "", fmt.Errorf("upsert player %s: %w", ps.SteamID, err)
		}

		// resolve the actual player ID (may differ from ps.PlayerID on conflict)
		var playerID string
		err = tx.QueryRowContext(ctx,
			`SELECT id FROM players WHERE steam_id = ?`, ps.SteamID,
		).Scan(&playerID)
		if err != nil {
			return "", fmt.Errorf("resolve player ID for %s: %w", ps.SteamID, err)
		}

		_, err = tx.ExecContext(ctx,
			`INSERT INTO match_players (match_id, player_id, team, kills, deaths, assists, adr, kast, hs_pct, rating, flash_assists, utility_damage)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			m.ID, playerID, ps.Team, ps.Kills, ps.Deaths, ps.Assists,
			ps.ADR, ps.KAST, ps.HeadshotPct, ps.Rating, ps.FlashAssists, ps.UtilityDamage,
		)
		if err != nil {
			return "", fmt.Errorf("insert match_player %s: %w", ps.SteamID, err)
		}
	}

	// insert rounds, clutches, economy
	for _, r := range m.Rounds {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO rounds (id, match_id, number, winner_team, win_method,
			 first_kill_player_id, first_death_player_id,
			 first_kill_steam_id, first_death_steam_id, first_kill_weapon, first_kill_round_time,
			 bomb_plant_steam_id, bomb_plant_site, bomb_plant_round_time,
			 bomb_defuse_steam_id, bomb_defuse_round_time)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			r.ID, m.ID, r.Number, r.WinnerTeam, r.WinMethod,
			nullString(r.FirstKillPlayerID), nullString(r.FirstDeathPlayerID),
			nullString(r.FirstKillSteamID), nullString(r.FirstDeathSteamID),
			nullString(r.FirstKillWeapon), nullFloat(r.FirstKillRoundTime),
			nullString(r.BombPlantSteamID), nullString(r.BombPlantSite), nullFloat(r.BombPlantRoundTime),
			nullString(r.BombDefuseSteamID), nullFloat(r.BombDefuseRoundTime),
		)
		if err != nil {
			return "", fmt.Errorf("insert round %d: %w", r.Number, err)
		}

		if r.Clutch != nil {
			_, err = tx.ExecContext(ctx,
				`INSERT INTO clutches (round_id, player_id, opponents, success) VALUES (?, ?, ?, ?)`,
				r.ID, r.Clutch.PlayerID, r.Clutch.Opponents, boolToInt(r.Clutch.Success),
			)
			if err != nil {
				return "", fmt.Errorf("insert clutch round %d: %w", r.Number, err)
			}
		}
	}

	// insert economy rounds
	for _, e := range m.Economy {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO economy_rounds (round_id, team, spend, equipment_value, buy_type) VALUES (?, ?, ?, ?, ?)`,
			e.RoundID, e.Team, e.Spend, e.EquipmentValue, e.BuyType,
		)
		if err != nil {
			return "", fmt.Errorf("insert economy round %s/%s: %w", e.RoundID, e.Team, err)
		}
	}

	// insert kill events
	for _, ke := range m.KillEvents {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO kill_events (id, round_id, attacker_id, victim_id, weapon, headshot, attacker_x, attacker_y, attacker_z, victim_x, victim_y, victim_z)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			ke.ID, ke.RoundID, nullString(ke.Attacker), nullString(ke.Victim),
			ke.Weapon, boolToInt(ke.Headshot),
			ke.AttackerX, ke.AttackerY, ke.AttackerZ,
			ke.VictimX, ke.VictimY, ke.VictimZ,
		)
		if err != nil {
			return "", fmt.Errorf("insert kill event: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit transaction: %w", err)
	}

	return m.ID, nil
}

func (s *SQLite) GetMatch(ctx context.Context, id string) (Match, error) {
	var m Match
	var dateStr, createdStr string
	err := s.db.QueryRowContext(ctx,
		`SELECT id, map_name, date, duration_seconds, team_a, team_b, score_a, score_b, demo_hash, created_at
		 FROM matches WHERE id = ?`, id,
	).Scan(&m.ID, &m.MapName, &dateStr, &m.DurationSeconds, &m.TeamA, &m.TeamB,
		&m.ScoreA, &m.ScoreB, &m.DemoHash, &createdStr)
	if err == sql.ErrNoRows {
		return Match{}, ErrNotFound
	}
	if err != nil {
		return Match{}, fmt.Errorf("query match %s: %w", id, err)
	}

	m.Date, _ = time.Parse(time.RFC3339, dateStr)
	m.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)

	return m, nil
}

func (s *SQLite) ListMatches(ctx context.Context, filter MatchFilter) ([]MatchSummary, error) {
	var (
		clauses []string
		args    []any
	)

	if filter.MapName != "" {
		clauses = append(clauses, "m.map_name = ?")
		args = append(args, filter.MapName)
	}
	if !filter.DateFrom.IsZero() {
		clauses = append(clauses, "m.date >= ?")
		args = append(args, filter.DateFrom.Format(time.RFC3339))
	}
	if !filter.DateTo.IsZero() {
		clauses = append(clauses, "m.date <= ?")
		args = append(args, filter.DateTo.Format(time.RFC3339))
	}
	if filter.PlayerSteam != "" {
		clauses = append(clauses, `EXISTS (
			SELECT 1 FROM match_players mp
			JOIN players p ON p.id = mp.player_id
			WHERE mp.match_id = m.id AND p.steam_id = ?
		)`)
		args = append(args, filter.PlayerSteam)
	}

	// cursor-based pagination: older items (created_at < cursor OR same time with id < cursor)
	if !filter.CursorTime.IsZero() && filter.CursorID != "" {
		clauses = append(clauses, "(m.created_at < ? OR (m.created_at = ? AND m.id < ?))")
		ct := filter.CursorTime.Format(time.RFC3339Nano)
		args = append(args, ct, ct, filter.CursorID)
	}

	where := ""
	if len(clauses) > 0 {
		where = "WHERE " + strings.Join(clauses, " AND ")
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := fmt.Sprintf(
		`SELECT id, map_name, date, duration_seconds, team_a, team_b, score_a, score_b, created_at
		 FROM matches m %s ORDER BY m.created_at DESC, m.id DESC LIMIT ?`, where,
	)
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list matches: %w", err)
	}
	defer rows.Close()

	var results []MatchSummary
	for rows.Next() {
		var ms MatchSummary
		var dateStr, createdStr string
		if err := rows.Scan(&ms.ID, &ms.MapName, &dateStr, &ms.DurationSeconds,
			&ms.TeamA, &ms.TeamB, &ms.ScoreA, &ms.ScoreB, &createdStr); err != nil {
			return nil, fmt.Errorf("scan match summary: %w", err)
		}
		ms.Date, _ = time.Parse(time.RFC3339, dateStr)
		ms.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdStr)
		results = append(results, ms)
	}
	return results, rows.Err()
}

func (s *SQLite) GetPlayerStats(ctx context.Context, matchID string) ([]PlayerStats, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT mp.match_id, mp.player_id, p.steam_id, p.name, mp.team,
		        mp.kills, mp.deaths, mp.assists, mp.adr, mp.kast, mp.hs_pct,
		        mp.rating, mp.flash_assists, mp.utility_damage
		 FROM match_players mp
		 JOIN players p ON p.id = mp.player_id
		 WHERE mp.match_id = ?
		 ORDER BY mp.rating DESC`, matchID,
	)
	if err != nil {
		return nil, fmt.Errorf("query player stats for match %s: %w", matchID, err)
	}
	defer rows.Close()

	var stats []PlayerStats
	for rows.Next() {
		var ps PlayerStats
		if err := rows.Scan(&ps.MatchID, &ps.PlayerID, &ps.SteamID, &ps.Name, &ps.Team,
			&ps.Kills, &ps.Deaths, &ps.Assists, &ps.ADR, &ps.KAST, &ps.HeadshotPct,
			&ps.Rating, &ps.FlashAssists, &ps.UtilityDamage); err != nil {
			return nil, fmt.Errorf("scan player stats: %w", err)
		}
		stats = append(stats, ps)
	}
	return stats, rows.Err()
}

func (s *SQLite) GetRounds(ctx context.Context, matchID string) ([]Round, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT r.id, r.match_id, r.number, r.winner_team, r.win_method,
		        COALESCE(r.first_kill_player_id, ''), COALESCE(r.first_death_player_id, ''),
		        COALESCE(r.first_kill_steam_id, ''), COALESCE(r.first_death_steam_id, ''),
		        COALESCE(r.first_kill_weapon, ''), COALESCE(r.first_kill_round_time, 0),
		        COALESCE(r.bomb_plant_steam_id, ''), COALESCE(r.bomb_plant_site, ''),
		        COALESCE(r.bomb_plant_round_time, 0),
		        COALESCE(r.bomb_defuse_steam_id, ''), COALESCE(r.bomb_defuse_round_time, 0)
		 FROM rounds r
		 WHERE r.match_id = ?
		 ORDER BY r.number`, matchID,
	)
	if err != nil {
		return nil, fmt.Errorf("query rounds for match %s: %w", matchID, err)
	}
	defer rows.Close()

	var rounds []Round
	for rows.Next() {
		var r Round
		if err := rows.Scan(&r.ID, &r.MatchID, &r.Number, &r.WinnerTeam, &r.WinMethod,
			&r.FirstKillPlayerID, &r.FirstDeathPlayerID,
			&r.FirstKillSteamID, &r.FirstDeathSteamID,
			&r.FirstKillWeapon, &r.FirstKillRoundTime,
			&r.BombPlantSteamID, &r.BombPlantSite, &r.BombPlantRoundTime,
			&r.BombDefuseSteamID, &r.BombDefuseRoundTime); err != nil {
			return nil, fmt.Errorf("scan round: %w", err)
		}
		rounds = append(rounds, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// load clutches
	for i := range rounds {
		var c Clutch
		var success int
		err := s.db.QueryRowContext(ctx,
			`SELECT round_id, player_id, opponents, success FROM clutches WHERE round_id = ?`,
			rounds[i].ID,
		).Scan(&c.RoundID, &c.PlayerID, &c.Opponents, &success)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("query clutch for round %s: %w", rounds[i].ID, err)
		}
		c.Success = success != 0
		rounds[i].Clutch = &c
	}

	return rounds, nil
}

func (s *SQLite) GetEconomy(ctx context.Context, matchID string) ([]EconomyRound, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT er.round_id, r.match_id, r.number, er.team, er.spend, er.equipment_value, er.buy_type
		 FROM economy_rounds er
		 JOIN rounds r ON r.id = er.round_id
		 WHERE r.match_id = ?
		 ORDER BY r.number, er.team`, matchID,
	)
	if err != nil {
		return nil, fmt.Errorf("query economy for match %s: %w", matchID, err)
	}
	defer rows.Close()

	var econ []EconomyRound
	for rows.Next() {
		var e EconomyRound
		if err := rows.Scan(&e.RoundID, &e.MatchID, &e.RoundNumber, &e.Team,
			&e.Spend, &e.EquipmentValue, &e.BuyType); err != nil {
			return nil, fmt.Errorf("scan economy round: %w", err)
		}
		econ = append(econ, e)
	}
	return econ, rows.Err()
}

func (s *SQLite) GetKillPositions(ctx context.Context, matchID string) ([]KillEvent, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT ke.id, ke.round_id, r.match_id, r.number,
		        COALESCE(ke.attacker_id, ''), COALESCE(ke.victim_id, ''),
		        ke.weapon, ke.headshot,
		        ke.attacker_x, ke.attacker_y, ke.attacker_z,
		        ke.victim_x, ke.victim_y, ke.victim_z
		 FROM kill_events ke
		 JOIN rounds r ON r.id = ke.round_id
		 WHERE r.match_id = ?
		 ORDER BY r.number, ke.id`, matchID,
	)
	if err != nil {
		return nil, fmt.Errorf("query kill positions for match %s: %w", matchID, err)
	}
	defer rows.Close()

	var kills []KillEvent
	for rows.Next() {
		var ke KillEvent
		var hs int
		if err := rows.Scan(&ke.ID, &ke.RoundID, &ke.MatchID, &ke.RoundNum,
			&ke.Attacker, &ke.Victim, &ke.Weapon, &hs,
			&ke.AttackerX, &ke.AttackerY, &ke.AttackerZ,
			&ke.VictimX, &ke.VictimY, &ke.VictimZ); err != nil {
			return nil, fmt.Errorf("scan kill event: %w", err)
		}
		ke.Headshot = hs != 0
		kills = append(kills, ke)
	}
	return kills, rows.Err()
}

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = fmt.Errorf("not found")

// ErrDuplicateDemo is returned when a demo with the same hash already exists.
var ErrDuplicateDemo = fmt.Errorf("duplicate demo")

func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullFloat(f float64) sql.NullFloat64 {
	if f == 0 {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: f, Valid: true}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
