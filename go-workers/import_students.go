package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BulkImportStudentsHandler streams a CSV and batch-inserts students.
// CSV columns: full_name, email, phone, class_name, date_of_birth, gender
//
// This replaces Django's bulk_import_students() which loaded the entire CSV
// into memory and did N+1 queries per row.
func BulkImportStudentsHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Auth info from gateway
		userID, _ := strconv.ParseInt(r.Header.Get("X-User-ID"), 10, 64)
		userRole := r.Header.Get("X-User-Role")
		schoolID, _ := strconv.ParseInt(r.Header.Get("X-User-School-ID"), 10, 64)

		if userRole != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Permission denied."})
			return
		}

		// Parse multipart form (max 10MB)
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid form data."})
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No CSV file uploaded."})
			return
		}
		defer file.Close()

		// Pre-load class name→id map for this school (single query)
		ctx := context.Background()
		classMap, err := loadClassMap(ctx, pool, schoolID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to load classes."})
			return
		}

		// Stream CSV row by row
		reader := csv.NewReader(file)
		reader.TrimLeadingSpace = true

		// Read header
		header, err := reader.Read()
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Cannot read CSV header."})
			return
		}
		colIdx := mapColumns(header)

		created := 0
		var errors []map[string]interface{}
		rowNum := 1 // header is row 1

		// Process in batches of 100
		type studentRow struct {
			firstName string
			lastName  string
			email     string
			phone     *string
			classID   int64
			dob       *string
			gender    string
			rowNum    int
		}
		var batch []studentRow

		flushBatch := func() {
			if len(batch) == 0 {
				return
			}
			tx, err := pool.Begin(ctx)
			if err != nil {
				for _, s := range batch {
					errors = append(errors, map[string]interface{}{"row": s.rowNum, "error": "DB transaction error"})
				}
				batch = batch[:0]
				return
			}
			defer tx.Rollback(ctx)

			for _, s := range batch {
				// Generate unique student number
				studentNum := generateStudentNumber()

				// Create user
				var newUserID int64
				err := tx.QueryRow(ctx,
					`INSERT INTO users_customuser
						(password, last_login, is_superuser, username, first_name, last_name,
						 email, is_staff, is_active, date_joined,
						 role, school_id, student_number, phone_number, created_by_id)
					 VALUES ('!unusable_password', NULL, false, $1, $2, $3, $4, false, true, NOW(),
					         'student', $5, $6, $7, $8)
					 RETURNING id`,
					s.email, s.firstName, s.lastName, s.email,
					schoolID, studentNum, s.phone, userID,
				).Scan(&newUserID)
				if err != nil {
					errors = append(errors, map[string]interface{}{"row": s.rowNum, "error": fmt.Sprintf("User creation failed: %v", err)})
					continue
				}

				// Create student record
				_, err = tx.Exec(ctx,
					`INSERT INTO academics_student
						(user_id, student_class_id, admission_date, date_of_birth, gender)
					 VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
					newUserID, s.classID, s.dob, s.gender,
				)
				if err != nil {
					errors = append(errors, map[string]interface{}{"row": s.rowNum, "error": fmt.Sprintf("Student creation failed: %v", err)})
					continue
				}
				created++
			}

			if err := tx.Commit(ctx); err != nil {
				log.Printf("WARN: batch commit failed: %v", err)
			}
			batch = batch[:0]
		}

		for {
			record, err := reader.Read()
			if err == io.EOF {
				break
			}
			rowNum++
			if err != nil {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": "Malformed CSV row"})
				continue
			}

			fullName := getCol(record, colIdx, "full_name")
			email := getCol(record, colIdx, "email")
			phone := getCol(record, colIdx, "phone")
			className := getCol(record, colIdx, "class_name")
			dob := getCol(record, colIdx, "date_of_birth")
			gender := getCol(record, colIdx, "gender")

			// Validate
			if fullName == "" || email == "" {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": "full_name and email are required"})
				continue
			}

			classID, ok := classMap[strings.ToLower(className)]
			if !ok {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": fmt.Sprintf("Class '%s' not found.", className)})
				continue
			}

			nameParts := strings.SplitN(fullName, " ", 2)
			firstName := nameParts[0]
			lastName := ""
			if len(nameParts) > 1 {
				lastName = nameParts[1]
			}

			var phonePtr *string
			if phone != "" {
				phonePtr = &phone
			}
			var dobPtr *string
			if dob != "" {
				dobPtr = &dob
			}

			batch = append(batch, studentRow{
				firstName: firstName, lastName: lastName, email: email,
				phone: phonePtr, classID: classID, dob: dobPtr,
				gender: gender, rowNum: rowNum,
			})

			if len(batch) >= 100 {
				flushBatch()
			}
		}
		flushBatch()

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"created": created,
			"errors":  errors,
			"message": fmt.Sprintf("Imported %d students with %d errors.", created, len(errors)),
		})
	}
}

// loadClassMap returns map[lowercase_class_name] → class_id for a school
func loadClassMap(ctx context.Context, pool *pgxpool.Pool, schoolID int64) (map[string]int64, error) {
	rows, err := pool.Query(ctx, "SELECT id, LOWER(name) FROM academics_class WHERE school_id = $1", schoolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err == nil {
			m[name] = id
		}
	}
	return m, nil
}

// mapColumns maps CSV header names to column indices
func mapColumns(header []string) map[string]int {
	m := make(map[string]int, len(header))
	for i, col := range header {
		m[strings.TrimSpace(strings.ToLower(col))] = i
	}
	return m
}

// getCol safely extracts a trimmed column value by normalized header name.
func getCol(record []string, colIdx map[string]int, name string) string {
	if idx, ok := colIdx[name]; ok && idx < len(record) {
		return strings.TrimSpace(record[idx])
	}
	return ""
}

// generateStudentNumber creates a pseudo-random student number like STU123456.
func generateStudentNumber() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("STU%06d", r.Intn(999999))
}

// ─── Helpers ────────────────────────────────────────────────

// writeJSON writes a JSON response with status code and proper content type.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// collectRows is a small helper to scan rows into a map
func collectRows(rows pgx.Rows) (map[string]int64, error) {
	m := make(map[string]int64)
	for rows.Next() {
		var id int64
		var key string
		if err := rows.Scan(&id, &key); err != nil {
			return nil, err
		}
		m[key] = id
	}
	return m, rows.Err()
}
