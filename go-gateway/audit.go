package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ─── Audit entry matches Django's users_auditlog table ──────

type AuditEntry struct {
	UserID         int64
	SchoolID       int64
	Action         string
	ModelName      string
	ObjectID       string
	ObjectRepr     string
	Changes        map[string]interface{}
	IPAddress      string
	ResponseStatus int
	Timestamp      time.Time
}

// ─── Buffered Audit Logger ──────────────────────────────────
// Collects entries in a buffer and flushes to DB in batches.
// This avoids blocking HTTP responses with DB writes.

type AuditLogger struct {
	pool     *pgxpool.Pool
	mu       sync.Mutex
	buffer   []AuditEntry
	maxSize  int
	interval time.Duration
	stopCh   chan struct{}
}

// NewAuditLogger creates a buffered logger and starts periodic background flushing.
func NewAuditLogger(pool *pgxpool.Pool, maxSize int, interval time.Duration) *AuditLogger {
	al := &AuditLogger{
		pool:     pool,
		buffer:   make([]AuditEntry, 0, maxSize),
		maxSize:  maxSize,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
	go al.flushLoop()
	return al
}

// Log appends a new audit entry and triggers async flush when buffer is full.
func (al *AuditLogger) Log(entry AuditEntry) {
	al.mu.Lock()
	al.buffer = append(al.buffer, entry)
	shouldFlush := len(al.buffer) >= al.maxSize
	al.mu.Unlock()

	if shouldFlush {
		go al.Flush()
	}
}

// Flush swaps the current buffer and persists it to DB outside the lock.
func (al *AuditLogger) Flush() {
	al.mu.Lock()
	if len(al.buffer) == 0 {
		al.mu.Unlock()
		return
	}
	entries := al.buffer
	al.buffer = make([]AuditEntry, 0, al.maxSize)
	al.mu.Unlock()

	al.writeToDB(entries)
}

// flushLoop periodically flushes pending audit entries until stop is signaled.
func (al *AuditLogger) flushLoop() {
	ticker := time.NewTicker(al.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			al.Flush()
		case <-al.stopCh:
			return
		}
	}
}

// writeToDB inserts a batch of entries using one transaction for lower overhead.
func (al *AuditLogger) writeToDB(entries []AuditEntry) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Batch insert using a single transaction
	tx, err := al.pool.Begin(ctx)
	if err != nil {
		log.Printf("WARN: audit batch insert failed to begin tx: %v", err)
		return
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		changesJSON, _ := json.Marshal(e.Changes)
		_, err := tx.Exec(ctx,
			`INSERT INTO users_auditlog
				(user_id, school_id, action, model_name, object_id, object_repr, changes, ip_address, response_status, timestamp)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			nilIfZero(e.UserID), nilIfZero(e.SchoolID),
			e.Action, e.ModelName, e.ObjectID, e.ObjectRepr,
			string(changesJSON), e.IPAddress, e.ResponseStatus, e.Timestamp,
		)
		if err != nil {
			log.Printf("WARN: audit insert failed: %v", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("WARN: audit batch commit failed: %v", err)
	}
}

// nilIfZero converts zero foreign-key values to NULL for optional DB columns.
func nilIfZero(v int64) interface{} {
	if v == 0 {
		return nil
	}
	return v
}

// ─── Audit Middleware ────────────────────────────────────────

var auditMethods = map[string]string{
	"POST":   "CREATE",
	"PUT":    "UPDATE",
	"PATCH":  "UPDATE",
	"DELETE": "DELETE",
}

var skipPaths = []string{"/django-admin/", "/api/v1/schema/", "/api/v1/docs/", "/media/", "/static/"}

// AuditMiddleware records authenticated write operations after response completion.
func AuditMiddleware(next http.Handler, al *AuditLogger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		action, shouldAudit := auditMethods[r.Method]
		if !shouldAudit {
			next.ServeHTTP(w, r)
			return
		}

		path := r.URL.Path
		for _, skip := range skipPaths {
			if strings.HasPrefix(path, skip) {
				next.ServeHTTP(w, r)
				return
			}
		}

		// Read body for change tracking (only JSON, max 64KB)
		var changes map[string]interface{}
		if strings.Contains(r.Header.Get("Content-Type"), "application/json") && r.Body != nil {
			bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
			if err == nil && len(bodyBytes) > 0 {
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				var data map[string]interface{}
				if json.Unmarshal(bodyBytes, &data) == nil {
					// Remove sensitive fields
					for _, key := range []string{"password", "whatsapp_pin", "token", "secret"} {
						delete(data, key)
					}
					changes = data
				}
			}
		}

		// Capture response status
		rec := &statusRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)

		// Extract user info from gateway headers
		userIDStr := r.Header.Get("X-User-ID")
		schoolIDStr := r.Header.Get("X-User-School-ID")
		userID, _ := strconv.ParseInt(userIDStr, 10, 64)
		schoolID, _ := strconv.ParseInt(schoolIDStr, 10, 64)

		if userID == 0 {
			return // Don't log unauthenticated writes
		}

		// Extract model name from path
		parts := strings.Split(strings.Trim(path, "/"), "/")
		modelName := "unknown"
		if len(parts) >= 2 {
			modelName = parts[len(parts)-2]
		} else if len(parts) >= 1 {
			modelName = parts[len(parts)-1]
		}

		// Extract object_id (last numeric segment)
		objectID := ""
		for i := len(parts) - 1; i >= 0; i-- {
			if _, err := strconv.Atoi(parts[i]); err == nil {
				objectID = parts[i]
				break
			}
		}

		// Get client IP
		ip := r.RemoteAddr
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			ip = strings.Split(fwd, ",")[0]
		}

		al.Log(AuditEntry{
			UserID:         userID,
			SchoolID:       schoolID,
			Action:         action,
			ModelName:      modelName,
			ObjectID:       objectID,
			ObjectRepr:     path,
			Changes:        changes,
			IPAddress:      strings.TrimSpace(ip),
			ResponseStatus: rec.statusCode,
			Timestamp:      time.Now(),
		})
	})
}

// statusRecorder wraps http.ResponseWriter to capture status code
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

// WriteHeader captures status code for audit logging before forwarding the call.
func (sr *statusRecorder) WriteHeader(code int) {
	sr.statusCode = code
	sr.ResponseWriter.WriteHeader(code)
}
