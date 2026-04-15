package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestIsPublicPath(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{path: "/api/v1/auth/login", want: true},
		{path: "/api/v1/auth/login/extra", want: true},
		{path: "/api/v1/academics/students/", want: false},
	}

	for _, tt := range tests {
		if got := isPublicPath(tt.path); got != tt.want {
			t.Fatalf("isPublicPath(%q)=%v want %v", tt.path, got, tt.want)
		}
	}
}

func TestAuthMiddleware_AllowsPublicPath(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	bl := &Blacklist{tokens: map[string]struct{}{}}
	h := AuthMiddleware(next, "test-secret", bl, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/login", nil)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if !nextCalled {
		t.Fatal("expected next handler to be called for public path")
	}
	if res.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", res.Code)
	}
}

func TestAuthMiddleware_PassesThroughWhenNoToken(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	bl := &Blacklist{tokens: map[string]struct{}{}}
	h := AuthMiddleware(next, "test-secret", bl, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/academics/students/", nil)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if !nextCalled {
		t.Fatal("expected next handler to be called when no bearer token is provided")
	}
	if res.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", res.Code)
	}
}

func TestAuthMiddleware_RejectsBlacklistedToken(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next should not be called for blacklisted token")
	})

	token := "abc.def.ghi"
	bl := &Blacklist{tokens: map[string]struct{}{token: {}}}
	h := AuthMiddleware(next, "test-secret", bl, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/academics/students/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestAuthMiddleware_RejectsMalformedToken(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next should not be called for malformed token")
	})

	bl := &Blacklist{tokens: map[string]struct{}{}}
	h := AuthMiddleware(next, "test-secret", bl, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/academics/students/", nil)
	req.Header.Set("Authorization", "Bearer not-a-jwt")
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestAuthMiddleware_RejectsWrongTokenType(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next should not be called for wrong token type")
	})

	bl := &Blacklist{tokens: map[string]struct{}{}}
	uc := &UserCache{users: map[int64]*CachedUser{}, ttl: 5 * time.Minute}
	h := AuthMiddleware(next, "test-secret", bl, uc)

	token := signedToken(t, "test-secret", jwt.MapClaims{
		"type":    "refresh_token",
		"user_id": float64(1),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/academics/students/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestAuthMiddleware_InjectsIdentityHeadersOnValidToken(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		if r.Header.Get("X-Gateway-Auth") != "true" {
			t.Fatal("expected X-Gateway-Auth header")
		}
		if r.Header.Get("X-User-ID") != "7" {
			t.Fatalf("expected X-User-ID=7 got %q", r.Header.Get("X-User-ID"))
		}
		if r.Header.Get("X-User-Role") != "teacher" {
			t.Fatalf("expected X-User-Role=teacher got %q", r.Header.Get("X-User-Role"))
		}
		if r.Header.Get("X-User-School-ID") != "12" {
			t.Fatalf("expected X-User-School-ID=12 got %q", r.Header.Get("X-User-School-ID"))
		}
		w.WriteHeader(http.StatusOK)
	})

	bl := &Blacklist{tokens: map[string]struct{}{}}
	uc := &UserCache{
		users: map[int64]*CachedUser{
			7: {
				ID:       7,
				Role:     "teacher",
				SchoolID: 12,
				CachedAt: time.Now(),
			},
		},
		ttl: 5 * time.Minute,
	}
	h := AuthMiddleware(next, "test-secret", bl, uc)

	token := signedToken(t, "test-secret", jwt.MapClaims{
		"type":    "access_token",
		"user_id": float64(7),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/academics/students/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if !nextCalled {
		t.Fatal("expected next handler to be called")
	}
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func signedToken(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}
