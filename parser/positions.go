package parser

import (
	"github.com/golang/geo/r3"
)

// vecToPosition converts an r3.Vector from the game engine to our Position type.
func vecToPosition(v r3.Vector) Position {
	return Position{
		X: v.X,
		Y: v.Y,
		Z: v.Z,
	}
}
