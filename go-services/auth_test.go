package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthCheckMiddleware(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		headers    map[string]string
		wantStatus int
	}{
		{
			name:       "health bypass",
			path:       "/health",
			wantStatus: http.StatusOK,
		},
		{
			name:       "paynow callback bypass",
			path:       "/api/v1/finances/payments/paynow/result/",
			wantStatus: http.StatusOK,
		},
		{
			name:       "protected endpoint rejects missing headers",
			path:       "/api/v1/services/email/send",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name: "protected endpoint accepts gateway headers",
			path: "/api/v1/services/email/send",
			headers: map[string]string{
				"X-Gateway-Auth": "true",
				"X-User-ID":      "42",
			},
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			h := AuthCheckMiddleware(next)
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			res := httptest.NewRecorder()
			h.ServeHTTP(res, req)

			if res.Code != tt.wantStatus {
				t.Fatalf("status=%d want %d", res.Code, tt.wantStatus)
			}
		})
	}
}
