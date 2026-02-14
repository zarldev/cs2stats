package service

import "time"

// MatchDetail holds full match information returned by GetMatch.
type MatchDetail struct {
	ID              string
	MapName         string
	Date            time.Time
	DurationSeconds int
	TeamA           string
	TeamB           string
	ScoreA          int
	ScoreB          int
}

// MatchSummary is a lightweight listing entry.
type MatchSummary struct {
	ID              string
	MapName         string
	Date            time.Time
	DurationSeconds int
	TeamA           string
	TeamB           string
	ScoreA          int
	ScoreB          int
	CreatedAt       time.Time
}

// MatchFilter constrains match listing.
type MatchFilter struct {
	MapName     string
	DateFrom    time.Time
	DateTo      time.Time
	PlayerSteam string
	Limit       int
	CursorTime  time.Time
	CursorID    string
}

// PlayerStats holds per-player stats for a match.
type PlayerStats struct {
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

// RoundEvent describes a single round in the timeline.
type RoundEvent struct {
	Number             int
	WinnerTeam         string
	WinMethod          string
	FirstKillPlayerID  string
	FirstDeathPlayerID string
	Clutch             *ClutchEvent
}

// ClutchEvent describes a clutch attempt.
type ClutchEvent struct {
	PlayerID  string
	Opponents int
	Success   bool
}

// EconomyData holds economy info for one team in one round.
type EconomyData struct {
	RoundNumber    int
	Team           string
	Spend          int
	EquipmentValue int
	BuyType        string
}

// KillPosition holds a kill event with positional data.
type KillPosition struct {
	RoundNumber int
	AttackerID  string
	VictimID    string
	Weapon      string
	Headshot    bool
	AttackerX   float64
	AttackerY   float64
	AttackerZ   float64
	VictimX     float64
	VictimY     float64
	VictimZ     float64
}
