package main

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ─── Helper functions ────────────────────────────────────────────────────────

func TestMapColumns(t *testing.T) {
	header := []string{"Full_Name", " EMAIL ", "phone", "Class_Name"}
	idx := mapColumns(header)

	tests := []struct {
		key  string
		want int
	}{
		{"full_name", 0},
		{"email", 1},
		{"phone", 2},
		{"class_name", 3},
	}
	for _, tt := range tests {
		got, ok := idx[tt.key]
		if !ok {
			t.Errorf("mapColumns: key %q not found", tt.key)
		} else if got != tt.want {
			t.Errorf("mapColumns[%q] = %d, want %d", tt.key, got, tt.want)
		}
	}
}

func TestGetCol(t *testing.T) {
	record := []string{"  Alice Smith  ", "alice@school.com", "", "Form 1"}
	colIdx := map[string]int{"full_name": 0, "email": 1, "phone": 2, "class_name": 3}

	if got := getCol(record, colIdx, "full_name"); got != "Alice Smith" {
		t.Errorf("getCol full_name = %q, want %q", got, "Alice Smith")
	}
	if got := getCol(record, colIdx, "email"); got != "alice@school.com" {
		t.Errorf("getCol email = %q", got)
	}
	if got := getCol(record, colIdx, "phone"); got != "" {
		t.Errorf("getCol phone should be empty, got %q", got)
	}
	// Missing column returns empty string
	if got := getCol(record, colIdx, "nonexistent"); got != "" {
		t.Errorf("getCol nonexistent should be empty, got %q", got)
	}
	// Index out of range returns empty string
	shortRecord := []string{"only one col"}
	if got := getCol(shortRecord, map[string]int{"email": 5}, "email"); got != "" {
		t.Errorf("getCol out-of-range should be empty, got %q", got)
	}
}

func TestGenerateStudentNumber(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 20; i++ {
		num := generateStudentNumber()
		if !strings.HasPrefix(num, "STU") {
			t.Errorf("student number %q should start with STU", num)
		}
		if len(num) != 9 { // "STU" + 6 digits
			t.Errorf("student number %q should be 9 chars, got %d", num, len(num))
		}
		seen[num] = true
	}
}

// ─── AuthCheckMiddleware ─────────────────────────────────────────────────────

func TestAuthCheckMiddleware_BlocksWithoutHeaders(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := AuthCheckMiddleware(inner)

	req := httptest.NewRequest("GET", "/api/v1/bulk/students", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestAuthCheckMiddleware_BlocksMissingUserID(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := AuthCheckMiddleware(inner)

	req := httptest.NewRequest("GET", "/api/v1/bulk/students", nil)
	req.Header.Set("X-Gateway-Auth", "true")
	// X-User-ID deliberately omitted
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without X-User-ID, got %d", rr.Code)
	}
}

func TestAuthCheckMiddleware_AllowsHealthCheck(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := AuthCheckMiddleware(inner)

	req := httptest.NewRequest("GET", "/health", nil)
	// No gateway headers — health check should bypass auth
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("health check should pass without auth headers, got %d", rr.Code)
	}
}

func TestAuthCheckMiddleware_AllowsValidHeaders(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot) // sentinel to confirm inner was reached
	})
	handler := AuthCheckMiddleware(inner)

	req := httptest.NewRequest("POST", "/api/v1/bulk/students", nil)
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "42")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTeapot {
		t.Errorf("expected inner handler to run (418), got %d", rr.Code)
	}
}

// ─── BulkImportStudentsHandler — pre-DB validation ───────────────────────────

func TestBulkStudents_ForbiddenForNonAdmin(t *testing.T) {
	handler := BulkImportStudentsHandler(nil)

	req := httptest.NewRequest("POST", "/api/v1/bulk/students", nil)
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "teacher")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 for teacher role, got %d", rr.Code)
	}
}

func TestBulkStudents_MissingFile(t *testing.T) {
	handler := BulkImportStudentsHandler(nil)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.Close()

	req := httptest.NewRequest("POST", "/api/v1/bulk/students", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "admin")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing file, got %d", rr.Code)
	}
}

// ─── BulkImportFeesHandler — pre-DB validation ───────────────────────────────

func TestBulkFees_ForbiddenForStudent(t *testing.T) {
	handler := BulkImportFeesHandler(nil)

	req := httptest.NewRequest("POST", "/api/v1/bulk/fees", nil)
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "student")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 for student role, got %d", rr.Code)
	}
}

func TestBulkFees_AllowsAccountant(t *testing.T) {
	handler := BulkImportFeesHandler(nil)

	// Accountant passes the role check but will fail on missing file
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.Close()

	req := httptest.NewRequest("POST", "/api/v1/bulk/fees", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "accountant")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Should fail with 400 (no file), not 403
	if rr.Code == http.StatusForbidden {
		t.Errorf("accountant should not get 403")
	}
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing file, got %d", rr.Code)
	}
}

func TestBulkFees_MissingFile(t *testing.T) {
	handler := BulkImportFeesHandler(nil)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.Close()

	req := httptest.NewRequest("POST", "/api/v1/bulk/fees", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "admin")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing file, got %d", rr.Code)
	}
}

// ─── BulkImportResultsHandler — pre-DB validation ────────────────────────────

func TestBulkResults_ForbiddenForParent(t *testing.T) {
	handler := BulkImportResultsHandler(nil)

	req := httptest.NewRequest("POST", "/api/v1/bulk/results", nil)
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "parent")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 for parent role, got %d", rr.Code)
	}
}

func TestBulkResults_MissingFile(t *testing.T) {
	handler := BulkImportResultsHandler(nil)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.Close()

	req := httptest.NewRequest("POST", "/api/v1/bulk/results", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "teacher")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing file, got %d", rr.Code)
	}
}

func TestBulkResults_AllowsTeacher(t *testing.T) {
	handler := BulkImportResultsHandler(nil)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.Close()

	req := httptest.NewRequest("POST", "/api/v1/bulk/results", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-Gateway-Auth", "true")
	req.Header.Set("X-User-ID", "1")
	req.Header.Set("X-User-Role", "teacher")
	req.Header.Set("X-User-School-ID", "1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code == http.StatusForbidden {
		t.Errorf("teacher should not get 403")
	}
}

// ─── CSV parsing edge cases ───────────────────────────────────────────────────

func TestMapColumns_EmptyHeader(t *testing.T) {
	idx := mapColumns([]string{})
	if len(idx) != 0 {
		t.Errorf("empty header should return empty map, got %v", idx)
	}
}

func TestMapColumns_DuplicateColumns(t *testing.T) {
	// Last occurrence wins when columns repeat
	header := []string{"name", "name"}
	idx := mapColumns(header)
	if idx["name"] != 1 {
		t.Errorf("duplicate column: want last index 1, got %d", idx["name"])
	}
}

func TestGetCol_ExtraWhitespace(t *testing.T) {
	record := []string{"  \t John Doe \t  "}
	colIdx := map[string]int{"name": 0}
	if got := getCol(record, colIdx, "name"); got != "John Doe" {
		t.Errorf("getCol should trim whitespace, got %q", got)
	}
}
