//go:build dev

package frontend

import "embed"

// DistFS is empty in dev mode -- the frontend dev server handles assets.
var DistFS embed.FS
