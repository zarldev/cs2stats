package repository

import "time"

// Match represents a stored match record.
type Match struct {
	ID              string
	MapName         string
	Date            time.Time
	DurationSeconds int
	TeamA           string
	TeamB           string
	ScoreA          int
	ScoreB          int
	DemoHash        string
	TeamAStartedAs  string
	CreatedAt       time.Time
	Players         []PlayerStats
	Rounds          []Round
	Economy         []EconomyRound
	KillEvents      []KillEvent
}

// MatchSummary is a lightweight match listing entry.
type MatchSummary struct {
	ID              string
	MapName         string
	Date            time.Time
	DurationSeconds int
	TeamA           string
	TeamB           string
	ScoreA          int
	ScoreB          int
	TeamAStartedAs  string
	CreatedAt       time.Time
}

// MatchFilter constrains match listing queries.
type MatchFilter struct {
	MapName      string
	DateFrom     time.Time
	DateTo       time.Time
	PlayerSteam  string
	Limit        int
	CursorTime   time.Time
	CursorID     string
}

// Player represents a known player identity.
type Player struct {
	ID      string
	SteamID string
	Name    string
}

// PlayerStats holds per-player stats for a specific match.
type PlayerStats struct {
	MatchID       string
	PlayerID      string
	SteamID       string
	Name          string
	Team          string
	Kills         int
	Deaths        int
	Assists       int
	ADR           float64
	KAST          float64
	HeadshotPct   float64
	Rating        float64
	FlashAssists  int
	UtilityDamage int
}

// Round represents a single round in a match.
type Round struct {
	ID                 string
	MatchID            string
	Number             int
	WinnerTeam         string
	WinMethod          string
	FirstKillPlayerID  string
	FirstDeathPlayerID string
	FirstKillSteamID   string
	FirstDeathSteamID  string
	FirstKillWeapon    string
	FirstKillRoundTime float64
	BombPlantSteamID   string
	BombPlantSite      string
	BombPlantRoundTime float64
	BombDefuseSteamID  string
	BombDefuseRoundTime float64
	Clutch             *Clutch
}

// Clutch records a clutch attempt in a round.
type Clutch struct {
	RoundID       string
	PlayerID      string
	PlayerSteamID string
	Opponents     int
	Success       bool
}

// EconomyRound holds economy data for one team in one round.
type EconomyRound struct {
	RoundID        string
	MatchID        string
	RoundNumber    int
	Team           string
	Spend          int
	EquipmentValue int
	BuyType        string
}

// KillEvent records a single kill with positional data.
type KillEvent struct {
	ID              string
	RoundID         string
	MatchID         string
	RoundNum        int
	Attacker        string // player ID
	Victim          string // player ID
	AttackerSteamID string
	VictimSteamID   string
	Weapon          string
	Headshot        bool
	AttackerX       float64
	AttackerY       float64
	AttackerZ       float64
	VictimX         float64
	VictimY         float64
	VictimZ         float64
}
