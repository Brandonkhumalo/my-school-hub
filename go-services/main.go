package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

// main boots go-services and registers payment, reporting, and messaging endpoints.
func main() {
	_ = godotenv.Load()

	cfg := LoadConfig()

	pool, err := NewPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("FATAL: cannot connect to database: %v", err)
	}
	defer pool.Close()

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// ── PDF Report Card ──
	mux.HandleFunc("GET /api/v1/academics/students/{studentID}/report-card/", ReportCardHandler(pool))

	// ── PayNow ──
	mux.HandleFunc("POST /api/v1/finances/payments/paynow/initiate/", PayNowInitiateHandler(pool))
	mux.HandleFunc("POST /api/v1/finances/payments/paynow/result/", PayNowCallbackHandler(pool))
	mux.HandleFunc("GET /api/v1/finances/payments/paynow/status/", PayNowStatusHandler(pool))

	// ── Email (internal — called by Django/Celery) ──
	mux.HandleFunc("POST /api/v1/services/email/send", EmailSendHandler())

	// ── WhatsApp (internal — called by Django/Celery) ──
	mux.HandleFunc("POST /api/v1/services/whatsapp/send", WhatsAppSendHandler())

	// ── Past Exam Papers (file storage + question extraction) ──
	mux.HandleFunc("POST /api/v1/services/papers/upload", PaperUploadHandler())
	mux.HandleFunc("GET /api/v1/services/papers/file", PaperDownloadHandler())
	mux.HandleFunc("DELETE /api/v1/services/papers/file", PaperDeleteHandler())
	mux.HandleFunc("POST /api/v1/services/papers/extract", PaperExtractHandler())

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      AuthCheckMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down go-services...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("Go Services listening on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("FATAL: %v", err)
	}
}

// AuthCheckMiddleware verifies the request came through the Go gateway.
// PayNow callback and health check bypass auth.
func AuthCheckMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// No auth required for health check and PayNow server callback
		if path == "/health" || path == "/api/v1/finances/payments/paynow/result/" {
			next.ServeHTTP(w, r)
			return
		}

		// Internal service calls use X-Gateway-Auth
		if r.Header.Get("X-Gateway-Auth") != "true" || r.Header.Get("X-User-ID") == "" {
			http.Error(w, `{"detail":"Unauthorized — requests must come through the gateway."}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
