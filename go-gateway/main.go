package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env (ignore error — env vars may come from Docker/EC2)
	_ = godotenv.Load()

	cfg := LoadConfig()

	// ── Database pool (for blacklist + audit + user cache) ──
	dbPool, err := NewDBPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("FATAL: cannot connect to database: %v", err)
	}
	defer dbPool.Close()

	// ── Token blacklist (in-memory, synced from DB periodically) ──
	blacklist := NewBlacklist(dbPool)
	blacklist.SyncFromDB() // initial load
	go blacklist.StartSync(30 * time.Second)

	// ── User cache (in-memory, TTL-based) ──
	userCache := NewUserCache(dbPool, 5*time.Minute)

	// ── Audit logger (buffered, async writes) ──
	auditLogger := NewAuditLogger(dbPool, 100, 2*time.Second)
	defer auditLogger.Flush()

	// ── Reverse proxies ──
	djangoURL, err := url.Parse(cfg.DjangoUpstream)
	if err != nil {
		log.Fatalf("FATAL: invalid DJANGO_UPSTREAM: %v", err)
	}
	djangoProxy := httputil.NewSingleHostReverseProxy(djangoURL)

	workersURL, err := url.Parse(cfg.WorkersUpstream)
	if err != nil {
		log.Fatalf("FATAL: invalid GO_WORKERS_UPSTREAM: %v", err)
	}
	workersProxy := httputil.NewSingleHostReverseProxy(workersURL)

	// Route bulk imports to Go workers, everything else to Django
	router := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasPrefix(path, "/api/v1/bulk/") {
			workersProxy.ServeHTTP(w, r)
		} else {
			djangoProxy.ServeHTTP(w, r)
		}
	})

	// ── Build handler chain ──
	var handler http.Handler = router

	// Wrap with auth middleware (injects X-User-* headers for Django)
	handler = AuthMiddleware(handler, cfg.SecretKey, blacklist, userCache)

	// Wrap with audit middleware
	handler = AuditMiddleware(handler, auditLogger)

	// Wrap with CORS (pass-through, Django handles CORS details)
	handler = CORSMiddleware(handler, cfg.CORSOrigins)

	// Wrap with rate limiter
	handler = RateLimitMiddleware(handler)

	// ── Start server ──
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down gateway...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		auditLogger.Flush()
		srv.Shutdown(ctx)
	}()

	log.Printf("Go Gateway listening on :%s → proxying to %s", cfg.Port, cfg.DjangoUpstream)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("FATAL: %v", err)
	}
}

// ─── Config ─────────────────────────────────────────────────

type Config struct {
	Port             string
	SecretKey        string
	DatabaseURL      string
	DjangoUpstream   string
	WorkersUpstream  string
	CORSOrigins      []string
}

func LoadConfig() Config {
	port := getEnv("GATEWAY_PORT", "8080")
	secret := getEnv("SECRET_KEY", "")
	if secret == "" {
		log.Fatal("FATAL: SECRET_KEY is required")
	}
	dbURL := getEnv("DATABASE_URL", "")
	if dbURL == "" {
		log.Fatal("FATAL: DATABASE_URL is required")
	}
	upstream := getEnv("DJANGO_UPSTREAM", "http://localhost:8000")
	workers := getEnv("GO_WORKERS_UPSTREAM", "http://localhost:8081")
	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5000")
	origins := strings.Split(corsRaw, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return Config{
		Port:            port,
		SecretKey:       secret,
		DatabaseURL:     dbURL,
		DjangoUpstream:  upstream,
		WorkersUpstream: workers,
		CORSOrigins:     origins,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── Rate Limiter (simple token bucket per IP) ──────────────

type visitor struct {
	tokens    int
	lastSeen  time.Time
}

var (
	visitors   = make(map[string]*visitor)
	visitorsMu sync.Mutex
)

func RateLimitMiddleware(next http.Handler) http.Handler {
	// Clean up stale visitors every minute
	go func() {
		for {
			time.Sleep(time.Minute)
			visitorsMu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > 3*time.Minute {
					delete(visitors, ip)
				}
			}
			visitorsMu.Unlock()
		}
	}()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			ip = strings.Split(fwd, ",")[0]
		}

		visitorsMu.Lock()
		v, exists := visitors[ip]
		if !exists {
			v = &visitor{tokens: 100}
			visitors[ip] = v
		}

		// Refill tokens (100 requests per minute)
		elapsed := time.Since(v.lastSeen)
		v.tokens += int(elapsed.Seconds() * 1.67) // ~100/min
		if v.tokens > 100 {
			v.tokens = 100
		}
		v.lastSeen = time.Now()

		if v.tokens <= 0 {
			visitorsMu.Unlock()
			http.Error(w, `{"detail":"Rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		v.tokens--
		visitorsMu.Unlock()

		next.ServeHTTP(w, r)
	})
}

// ─── CORS Middleware ─────────────────────────────────────────

func CORSMiddleware(next http.Handler, allowedOrigins []string) http.Handler {
	originSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[o] = true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if originSet[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
