package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"connectrpc.com/connect"

	"github.com/zarldev/cs2stats/parser"
	"github.com/zarldev/cs2stats/repository"
	"github.com/zarldev/cs2stats/service"
	transportgrpc "github.com/zarldev/cs2stats/transport/grpc"
	"github.com/zarldev/cs2stats/transport/grpc/gen/demo/v1/demov1connect"
	"github.com/zarldev/cs2stats/transport/grpc/gen/stats/v1/statsv1connect"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "cs2stats.db", "SQLite database path")
	flag.Parse()

	if err := run(*addr, *dbPath); err != nil {
		log.Fatal(err)
	}
}

func run(addr, dbPath string) error {
	// repository
	repo, err := repository.New(dbPath)
	if err != nil {
		return fmt.Errorf("open database %s: %w", dbPath, err)
	}
	defer repo.Close()

	// service
	svc := service.New(repo, service.ParserFunc(parser.Parse))

	// transport handlers
	demoHandler := transportgrpc.NewDemoHandler(svc)
	statsHandler := transportgrpc.NewStatsHandler(svc)

	// max request size for large demo files (256 MB)
	handlerOpts := []connect.HandlerOption{
		connect.WithReadMaxBytes(256 << 20),
	}

	mux := http.NewServeMux()

	// mount ConnectRPC handlers
	demoPath, demoHTTP := demov1connect.NewDemoServiceHandler(demoHandler, handlerOpts...)
	statsPath, statsHTTP := statsv1connect.NewStatsServiceHandler(statsHandler, handlerOpts...)
	mux.Handle(demoPath, demoHTTP)
	mux.Handle(statsPath, statsHTTP)

	// mount frontend (embedded or dev stub)
	mux.Handle("/", frontendHandler())

	// CORS middleware for dev mode (frontend at :5173)
	handler := corsMiddleware(mux)

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		log.Printf("listening on %s (db: %s)", addr, dbPath)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != http.ErrServerClosed {
			return fmt.Errorf("serve: %w", err)
		}
	case <-ctx.Done():
		log.Println("shutting down")
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutCtx); err != nil {
			return fmt.Errorf("shutdown: %w", err)
		}
	}

	return nil
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// allow dev server and same-origin
		if origin != "" && (strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms, Grpc-Timeout, X-Grpc-Web, X-User-Agent")
			w.Header().Set("Access-Control-Expose-Headers", "Grpc-Status, Grpc-Message, Grpc-Status-Details-Bin")
			w.Header().Set("Access-Control-Max-Age", "7200")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
