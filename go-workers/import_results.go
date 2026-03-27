package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// BulkImportResultsHandler streams a CSV and batch-upserts student results.
// CSV columns: student_number, subject_code, exam_type, score, max_score, term, year
//
// Replaces Django's bulk_import_results() which did N+1 queries per row
// (Student.objects.get + Subject.objects.get + Result.objects.update_or_create).
func BulkImportResultsHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, _ := strconv.ParseInt(r.Header.Get("X-User-ID"), 10, 64)
		userRole := r.Header.Get("X-User-Role")
		schoolID, _ := strconv.ParseInt(r.Header.Get("X-User-School-ID"), 10, 64)

		if userRole != "admin" && userRole != "teacher" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Permission denied."})
			return
		}

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

		ctx := context.Background()

		// Pre-load lookup maps (single query each — replaces per-row lookups)
		studentMap, err := loadStudentMap(ctx, pool, schoolID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to load students."})
			return
		}
		subjectMap, err := loadSubjectMap(ctx, pool, schoolID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to load subjects."})
			return
		}
		teacherMap, err := loadSubjectTeacherMap(ctx, pool, schoolID)
		if err != nil {
			log.Printf("WARN: failed to load teacher map: %v", err)
		}

		// Get teacher ID if the user is a teacher
		var requestTeacherID int64
		if userRole == "teacher" {
			pool.QueryRow(ctx,
				"SELECT id FROM academics_teacher WHERE user_id = $1", userID,
			).Scan(&requestTeacherID)
		}

		reader := csv.NewReader(file)
		reader.TrimLeadingSpace = true

		header, err := reader.Read()
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Cannot read CSV header."})
			return
		}
		colIdx := mapColumns(header)

		created := 0
		var errors []map[string]interface{}
		rowNum := 1

		// Batch upsert
		type resultRow struct {
			studentID int64
			subjectID int64
			teacherID int64
			examType  string
			score     float64
			maxScore  float64
			term      string
			year      string
			rowNum    int
		}
		var batch []resultRow

		flushBatch := func() {
			if len(batch) == 0 {
				return
			}
			tx, err := pool.Begin(ctx)
			if err != nil {
				for _, rr := range batch {
					errors = append(errors, map[string]interface{}{"row": rr.rowNum, "error": "DB transaction error"})
				}
				batch = batch[:0]
				return
			}
			defer tx.Rollback(ctx)

			for _, rr := range batch {
				_, err := tx.Exec(ctx,
					`INSERT INTO academics_result
						(student_id, subject_id, teacher_id, exam_type, score, max_score,
						 academic_term, academic_year, percentage, date_recorded)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
					 ON CONFLICT (student_id, subject_id, exam_type, academic_term, academic_year)
					 DO UPDATE SET score = EXCLUDED.score, max_score = EXCLUDED.max_score,
					              teacher_id = EXCLUDED.teacher_id, percentage = EXCLUDED.percentage,
					              date_recorded = NOW()`,
					rr.studentID, rr.subjectID, rr.teacherID, rr.examType,
					rr.score, rr.maxScore, rr.term, rr.year,
					(rr.score/rr.maxScore)*100,
				)
				if err != nil {
					errors = append(errors, map[string]interface{}{"row": rr.rowNum, "error": fmt.Sprintf("Insert failed: %v", err)})
					continue
				}
				created++
			}

			if err := tx.Commit(ctx); err != nil {
				log.Printf("WARN: result batch commit failed: %v", err)
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

			studentNumber := getCol(record, colIdx, "student_number")
			subjectCode := getCol(record, colIdx, "subject_code")
			examType := getCol(record, colIdx, "exam_type")
			scoreStr := getCol(record, colIdx, "score")
			maxScoreStr := getCol(record, colIdx, "max_score")
			term := getCol(record, colIdx, "term")
			year := getCol(record, colIdx, "year")

			score, err := strconv.ParseFloat(scoreStr, 64)
			if err != nil {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": "Invalid score"})
				continue
			}
			maxScore := 100.0
			if maxScoreStr != "" {
				if ms, err := strconv.ParseFloat(maxScoreStr, 64); err == nil {
					maxScore = ms
				}
			}

			studentID, ok := studentMap[studentNumber]
			if !ok {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": fmt.Sprintf("Student '%s' not found.", studentNumber)})
				continue
			}
			subjectID, ok := subjectMap[strings.ToLower(subjectCode)]
			if !ok {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": fmt.Sprintf("Subject '%s' not found.", subjectCode)})
				continue
			}

			// Determine teacher
			teacherID := requestTeacherID
			if teacherID == 0 {
				teacherID = teacherMap[subjectID]
			}
			if teacherID == 0 {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": "No teacher found for subject."})
				continue
			}

			batch = append(batch, resultRow{
				studentID: studentID, subjectID: subjectID, teacherID: teacherID,
				examType: examType, score: score, maxScore: maxScore,
				term: term, year: year, rowNum: rowNum,
			})

			if len(batch) >= 100 {
				flushBatch()
			}
		}
		flushBatch()

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"created": created,
			"errors":  errors,
			"message": fmt.Sprintf("Imported %d results with %d errors.", created, len(errors)),
		})
	}
}

// loadStudentMap returns map[student_number] → student_id for a school
func loadStudentMap(ctx context.Context, pool *pgxpool.Pool, schoolID int64) (map[string]int64, error) {
	rows, err := pool.Query(ctx,
		`SELECT s.id, u.student_number
		 FROM academics_student s
		 JOIN users_customuser u ON u.id = s.user_id
		 WHERE u.school_id = $1 AND u.student_number IS NOT NULL`, schoolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectRows(rows)
}

// loadSubjectMap returns map[lowercase_subject_code] → subject_id for a school
func loadSubjectMap(ctx context.Context, pool *pgxpool.Pool, schoolID int64) (map[string]int64, error) {
	rows, err := pool.Query(ctx,
		"SELECT id, LOWER(code) FROM academics_subject WHERE school_id = $1", schoolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectRows(rows)
}

// loadSubjectTeacherMap returns map[subject_id] → first teacher_id for each subject
func loadSubjectTeacherMap(ctx context.Context, pool *pgxpool.Pool, schoolID int64) (map[int64]int64, error) {
	rows, err := pool.Query(ctx,
		`SELECT DISTINCT ON (st.subject_id) st.subject_id, t.id
		 FROM academics_subject_teachers st
		 JOIN academics_teacher t ON t.id = st.teacher_id
		 JOIN users_customuser u ON u.id = t.user_id
		 WHERE u.school_id = $1
		 ORDER BY st.subject_id, t.id`, schoolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[int64]int64)
	for rows.Next() {
		var subjectID, teacherID int64
		if err := rows.Scan(&subjectID, &teacherID); err == nil {
			m[subjectID] = teacherID
		}
	}
	return m, rows.Err()
}
