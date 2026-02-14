//go:build dev

package main

import "net/http"

func frontendHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "frontend not embedded in dev mode — use the Vite dev server at :5173", http.StatusNotFound)
	})
}
