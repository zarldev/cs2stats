ALTER TABLE kill_events ADD COLUMN attacker_steam_id TEXT;
ALTER TABLE kill_events ADD COLUMN victim_steam_id TEXT;
ALTER TABLE clutches ADD COLUMN player_steam_id TEXT;
ALTER TABLE matches ADD COLUMN team_a_started_as TEXT DEFAULT 'CT';
