//go:build !dev

package frontend

import "embed"

// DistFS embeds the built frontend assets.
// This requires running the frontend build before `go build`.
//
//go:embed all:dist
var DistFS embed.FS
