CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    map_name TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    team_a TEXT NOT NULL,
    team_b TEXT NOT NULL,
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL,
    demo_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    steam_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_players (
    match_id TEXT NOT NULL REFERENCES matches(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    team TEXT NOT NULL,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    adr REAL NOT NULL DEFAULT 0,
    kast REAL NOT NULL DEFAULT 0,
    hs_pct REAL NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    flash_assists INTEGER NOT NULL DEFAULT 0,
    utility_damage INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL REFERENCES matches(id),
    number INTEGER NOT NULL,
    winner_team TEXT NOT NULL,
    win_method TEXT NOT NULL,
    first_kill_player_id TEXT,
    first_death_player_id TEXT
);

CREATE TABLE IF NOT EXISTS clutches (
    round_id TEXT NOT NULL REFERENCES rounds(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    opponents INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS economy_rounds (
    round_id TEXT NOT NULL REFERENCES rounds(id),
    team TEXT NOT NULL,
    spend INTEGER NOT NULL DEFAULT 0,
    equipment_value INTEGER NOT NULL DEFAULT 0,
    buy_type TEXT NOT NULL,
    PRIMARY KEY (round_id, team)
);

CREATE TABLE IF NOT EXISTS kill_events (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id),
    attacker_id TEXT REFERENCES players(id),
    victim_id TEXT REFERENCES players(id),
    weapon TEXT NOT NULL,
    headshot INTEGER NOT NULL DEFAULT 0,
    attacker_x REAL NOT NULL DEFAULT 0,
    attacker_y REAL NOT NULL DEFAULT 0,
    attacker_z REAL NOT NULL DEFAULT 0,
    victim_x REAL NOT NULL DEFAULT 0,
    victim_y REAL NOT NULL DEFAULT 0,
    victim_z REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at, id);
CREATE INDEX IF NOT EXISTS idx_matches_map ON matches(map_name);
CREATE INDEX IF NOT EXISTS idx_matches_demo_hash ON matches(demo_hash);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_rounds_match ON rounds(match_id);
CREATE INDEX IF NOT EXISTS idx_kill_events_round ON kill_events(round_id);
CREATE INDEX IF NOT EXISTS idx_economy_rounds_round ON economy_rounds(round_id);
