package parser

import "time"

// Match holds the complete analysis of a parsed demo file.
type Match struct {
	Map      string
	Date     time.Time
	Duration time.Duration
	Teams    [2]Team
	Rounds   []Round
	Players  []Player
}

// Team represents one side in the match.
type Team struct {
	Name       string
	Score      int
	StartedAs  Side
	Players    []uint64 // steam IDs
	RoundsWon  int
	RoundsLost int
}

// Side indicates CT or T.
type Side int

const (
	SideCT Side = iota
	SideT
)

func (s Side) String() string {
	switch s {
	case SideCT:
		return "CT"
	case SideT:
		return "T"
	default:
		return "Unknown"
	}
}

// Player holds per-player stats for the entire match.
type Player struct {
	SteamID uint64
	Name    string
	Team    string
	Stats   PlayerStats
}

// PlayerStats holds aggregated performance metrics.
type PlayerStats struct {
	Kills          int
	Deaths         int
	Assists        int
	ADR            float64 // average damage per round
	KAST           float64 // % of rounds with kill/assist/survived/traded
	HeadshotPct    float64
	FlashAssists   int
	UtilityDamage  int
	TradeKills     int
	Rating         float64
	TotalDamage    int
	Headshots      int
	RoundsPlayed   int
	Survived       int // rounds survived
	FirstKills     int
	FirstDeaths    int
	MultiKills     map[int]int // round kill count -> occurrences (e.g. 3 -> 2 means two 3Ks)
}

// Round captures events and outcome for a single round.
type Round struct {
	Number     int
	Winner     Side
	WinMethod  WinMethod
	Kills      []KillEvent
	FirstKill  *KillEvent
	Clutch     *ClutchInfo
	CTEconomy  EconomySnapshot
	TEconomy   EconomySnapshot
	Duration   time.Duration
	BombPlant  *BombEvent
	BombDefuse *BombEvent
}

// WinMethod describes how a round was won.
type WinMethod int

const (
	WinMethodElimination WinMethod = iota
	WinMethodBombExploded
	WinMethodBombDefused
	WinMethodTimeExpired
	WinMethodUnknown
)

func (w WinMethod) String() string {
	switch w {
	case WinMethodElimination:
		return "Elimination"
	case WinMethodBombExploded:
		return "BombExploded"
	case WinMethodBombDefused:
		return "BombDefused"
	case WinMethodTimeExpired:
		return "TimeExpired"
	default:
		return "Unknown"
	}
}

// KillEvent records a single kill during the match.
type KillEvent struct {
	Tick             int
	RoundNumber      int
	AttackerSteamID  uint64
	AttackerName     string
	AttackerPosition Position
	VictimSteamID    uint64
	VictimName       string
	VictimPosition   Position
	Weapon           string
	IsHeadshot       bool
	IsWallbang       bool
	AssisterSteamID  uint64
	AssisterName     string
	IsFlashAssist    bool
	IsTrade          bool
	Time             time.Duration
}

// Position holds 3D game coordinates.
type Position struct {
	X float64
	Y float64
	Z float64
}

// ClutchInfo describes a clutch situation and its outcome.
type ClutchInfo struct {
	PlayerSteamID uint64
	PlayerName    string
	Opponents     int
	Success       bool
	Kills         int
}

// EconomySnapshot captures team economy state at freeze time end.
type EconomySnapshot struct {
	TeamSpend      int
	EquipmentValue int
	BuyType        BuyType
}

// BuyType classifies the team's buy for a round.
type BuyType int

const (
	BuyTypeEco    BuyType = iota // < $5000 team spend
	BuyTypeForce                 // $5000 - $15000 team spend
	BuyTypeFull                  // > $15000 team spend
	BuyTypePistol                // pistol round (round 1 or first round of second half)
)

func (b BuyType) String() string {
	switch b {
	case BuyTypeEco:
		return "Eco"
	case BuyTypeForce:
		return "Force"
	case BuyTypeFull:
		return "Full"
	case BuyTypePistol:
		return "Pistol"
	default:
		return "Unknown"
	}
}

// ClassifyBuyType returns the buy type based on total team equipment value.
func ClassifyBuyType(teamEquipmentValue int) BuyType {
	switch {
	case teamEquipmentValue < 5000:
		return BuyTypeEco
	case teamEquipmentValue <= 15000:
		return BuyTypeForce
	default:
		return BuyTypeFull
	}
}

// isPistolRound returns true for the first round of each half.
// In standard CS2 matches: round 1 (first half) and round 13 (second half).
// In overtime: rounds 25, 28, 31, ... (every 3 rounds after regulation).
func isPistolRound(roundNum int) bool {
	if roundNum == 1 || roundNum == 13 {
		return true
	}
	// overtime pistol rounds: first round of each OT half
	// OT starts at round 25, each OT is 6 rounds (3 per side)
	if roundNum >= 25 && (roundNum-25)%6 == 0 {
		return true
	}
	return false
}

// BombEvent records a bomb plant or defuse.
type BombEvent struct {
	PlayerSteamID uint64
	PlayerName    string
	Site          string
	Tick          int
}

// CalculateADR computes average damage per round.
func CalculateADR(totalDamage, roundsPlayed int) float64 {
	if roundsPlayed == 0 {
		return 0
	}
	return float64(totalDamage) / float64(roundsPlayed)
}

// CalculateKAST computes the KAST percentage.
// kastRounds is the number of rounds where the player got a kill, assist,
// survived, or was traded. roundsPlayed is total rounds.
func CalculateKAST(kastRounds, roundsPlayed int) float64 {
	if roundsPlayed == 0 {
		return 0
	}
	return float64(kastRounds) / float64(roundsPlayed) * 100
}

// CalculateHeadshotPct computes headshot percentage.
func CalculateHeadshotPct(headshots, kills int) float64 {
	if kills == 0 {
		return 0
	}
	return float64(headshots) / float64(kills) * 100
}

// CalculateRating computes a simplified HLTV 2.0-style rating.
// Formula components:
//   - kills per round (KPR): kills / rounds
//   - survival rate (SPR): survived / rounds
//   - impact: (kills + 0.5*assists) / rounds weighted
//
// Simplified rating = 0.0073*KAST + 0.3591*KPR - 0.5329*(deaths/rounds) + 0.2372*(impact) + 0.0032*ADR + 0.1587
func CalculateRating(kills, deaths, assists, roundsPlayed, survived int, kastPct, adr float64) float64 {
	if roundsPlayed == 0 {
		return 0
	}
	rp := float64(roundsPlayed)
	kpr := float64(kills) / rp
	dpr := float64(deaths) / rp
	impact := (float64(kills) + 0.5*float64(assists)) / rp

	return 0.0073*kastPct + 0.3591*kpr - 0.5329*dpr + 0.2372*impact + 0.0032*adr + 0.1587
}
