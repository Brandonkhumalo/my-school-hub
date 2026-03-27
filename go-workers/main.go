package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("FATAL: DATABASE_URL is required")
	}
	port := getEnv("WORKERS_PORT", "8081")

	pool, err := NewPool(dbURL)
	if err != nil {
		log.Fatalf("FATAL: cannot connect to database: %v", err)
	}
	defer pool.Close()

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Bulk import endpoints — these replace the Django views
	mux.HandleFunc("POST /api/v1/bulk/students", BulkImportStudentsHandler(pool))
	mux.HandleFunc("POST /api/v1/bulk/results", BulkImportResultsHandler(pool))
	mux.HandleFunc("POST /api/v1/bulk/fees", BulkImportFeesHandler(pool))

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      AuthCheckMiddleware(mux),
		ReadTimeout:  60 * time.Second,  // CSV uploads can be large
		WriteTimeout: 120 * time.Second, // Bulk inserts take time
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down workers...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("Go Bulk Workers listening on :%s", port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("FATAL: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// NewPool creates a pgx connection pool
func NewPool(databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// AuthCheckMiddleware verifies the request came through the Go gateway
// by checking the X-Gateway-Auth and X-User-ID headers.
func AuthCheckMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		if r.Header.Get("X-Gateway-Auth") != "true" || r.Header.Get("X-User-ID") == "" {
			http.Error(w, `{"detail":"Unauthorized — requests must come through the gateway."}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
