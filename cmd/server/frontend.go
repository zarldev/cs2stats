//go:build !dev

package main

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/zarldev/cs2stats/frontend"
)

func frontendHandler() http.Handler {
	dist, err := fs.Sub(frontend.DistFS, "dist")
	if err != nil {
		panic("frontend dist not embedded: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// try to serve the file directly
		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}

		// check if file exists in the embedded FS
		f, err := dist.Open(strings.TrimPrefix(path, "/"))
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve index.html for non-file paths
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
