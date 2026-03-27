package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ─── Paths that skip auth ───────────────────────────────────

var publicPrefixes = []string{
	"/api/v1/auth/login",
	"/api/v1/auth/register",
	"/api/v1/auth/superadmin/register",
	"/api/v1/auth/token/refresh",
	"/api/v1/docs",
	"/api/v1/schema",
	"/django-admin",
	"/static/",
	"/media/",
}

func isPublicPath(path string) bool {
	for _, prefix := range publicPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// ─── Auth Middleware ─────────────────────────────────────────

// AuthMiddleware validates JWT, checks blacklist, resolves user,
// then injects X-User-ID, X-User-Role, X-User-School-ID headers
// so Django can skip re-authentication.
func AuthMiddleware(next http.Handler, secretKey string, bl *Blacklist, uc *UserCache) http.Handler {
	keyBytes := []byte(secretKey)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Public paths pass through
		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Extract Bearer token
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			// No token — let Django handle (might be session auth or unauthenticated endpoint)
			next.ServeHTTP(w, r)
			return
		}
		tokenStr := authHeader[7:]

		// Check blacklist (in-memory, O(1))
		if bl.IsBlacklisted(tokenStr) {
			http.Error(w, `{"detail":"Token has been blacklisted."}`, http.StatusUnauthorized)
			return
		}

		// Decode & validate JWT
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return keyBytes, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, `{"detail":"Invalid Token: `+escapeJSON(err.Error())+`"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"detail":"Invalid token claims."}`, http.StatusUnauthorized)
			return
		}

		// Verify token type
		if claims["type"] != "access_token" {
			http.Error(w, `{"detail":"Expected access_token."}`, http.StatusUnauthorized)
			return
		}

		// Extract user_id
		var userID int64
		switch v := claims["user_id"].(type) {
		case float64:
			userID = int64(v)
		case string:
			parsed, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				http.Error(w, `{"detail":"Invalid user_id in token."}`, http.StatusUnauthorized)
				return
			}
			userID = parsed
		default:
			http.Error(w, `{"detail":"Token missing user ID."}`, http.StatusUnauthorized)
			return
		}

		// Resolve user from cache (hits DB only on cache miss, ~5min TTL)
		user, err := uc.Get(userID)
		if err != nil {
			http.Error(w, `{"detail":"User not found."}`, http.StatusUnauthorized)
			return
		}

		// Inject headers for Django
		r.Header.Set("X-Gateway-Auth", "true")
		r.Header.Set("X-User-ID", strconv.FormatInt(user.ID, 10))
		r.Header.Set("X-User-Role", user.Role)
		if user.SchoolID > 0 {
			r.Header.Set("X-User-School-ID", strconv.FormatInt(user.SchoolID, 10))
		}

		next.ServeHTTP(w, r)
	})
}

func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return s
}

// ─── Token Blacklist (in-memory set, synced from DB) ────────

type Blacklist struct {
	mu      sync.RWMutex
	tokens  map[string]struct{}
	pool    *pgxpool.Pool
}

func NewBlacklist(pool *pgxpool.Pool) *Blacklist {
	return &Blacklist{
		tokens: make(map[string]struct{}),
		pool:   pool,
	}
}

func (bl *Blacklist) IsBlacklisted(token string) bool {
	bl.mu.RLock()
	defer bl.mu.RUnlock()
	_, exists := bl.tokens[token]
	return exists
}

func (bl *Blacklist) SyncFromDB() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := bl.pool.Query(ctx, "SELECT token FROM users_blacklistedtoken")
	if err != nil {
		log.Printf("WARN: blacklist sync failed: %v", err)
		return
	}
	defer rows.Close()

	newTokens := make(map[string]struct{})
	count := 0
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			newTokens[t] = struct{}{}
			count++
		}
	}

	bl.mu.Lock()
	bl.tokens = newTokens
	bl.mu.Unlock()

	log.Printf("Blacklist synced: %d tokens loaded", count)
}

func (bl *Blacklist) StartSync(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		bl.SyncFromDB()
	}
}

// ─── User Cache (in-memory with TTL) ────────────────────────

type CachedUser struct {
	ID       int64
	Role     string
	SchoolID int64
	CachedAt time.Time
}

type UserCache struct {
	mu    sync.RWMutex
	users map[int64]*CachedUser
	pool  *pgxpool.Pool
	ttl   time.Duration
}

func NewUserCache(pool *pgxpool.Pool, ttl time.Duration) *UserCache {
	uc := &UserCache{
		users: make(map[int64]*CachedUser),
		pool:  pool,
		ttl:   ttl,
	}
	// Evict stale entries every minute
	go func() {
		for {
			time.Sleep(time.Minute)
			uc.mu.Lock()
			now := time.Now()
			for id, u := range uc.users {
				if now.Sub(u.CachedAt) > uc.ttl {
					delete(uc.users, id)
				}
			}
			uc.mu.Unlock()
		}
	}()
	return uc
}

func (uc *UserCache) Get(userID int64) (*CachedUser, error) {
	// Check cache
	uc.mu.RLock()
	if u, ok := uc.users[userID]; ok && time.Since(u.CachedAt) < uc.ttl {
		uc.mu.RUnlock()
		return u, nil
	}
	uc.mu.RUnlock()

	// Cache miss — fetch from DB
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var role string
	var schoolID *int64
	err := uc.pool.QueryRow(ctx,
		"SELECT role, school_id FROM users_customuser WHERE id = $1 AND is_active = true",
		userID,
	).Scan(&role, &schoolID)
	if err != nil {
		return nil, err
	}

	sid := int64(0)
	if schoolID != nil {
		sid = *schoolID
	}

	user := &CachedUser{
		ID:       userID,
		Role:     role,
		SchoolID: sid,
		CachedAt: time.Now(),
	}

	uc.mu.Lock()
	uc.users[userID] = user
	uc.mu.Unlock()

	return user, nil
}
