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

// BulkImportFeesHandler streams a CSV and batch-inserts student fee records.
// CSV columns: student_number, fee_type_name, amount, academic_year, academic_term
//
// Replaces Django's bulk_import_fees() which loaded entire CSV into memory
// and did per-row Student.objects.get + FeeType.objects.get_or_create.
func BulkImportFeesHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userRole := r.Header.Get("X-User-Role")
		schoolID, _ := strconv.ParseInt(r.Header.Get("X-User-School-ID"), 10, 64)

		if userRole != "admin" && userRole != "accountant" {
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

		// Pre-load student number→id map (single query)
		studentMap, err := loadStudentMap(ctx, pool, schoolID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to load students."})
			return
		}

		// Pre-load fee types for this school
		feeTypeMap, err := loadFeeTypeMap(ctx, pool, schoolID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to load fee types."})
			return
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

		type feeRow struct {
			studentID    int64
			feeTypeID    int64
			amount       float64
			academicYear string
			academicTerm string
			rowNum       int
		}
		var batch []feeRow

		flushBatch := func() {
			if len(batch) == 0 {
				return
			}
			tx, err := pool.Begin(ctx)
			if err != nil {
				for _, fr := range batch {
					errors = append(errors, map[string]interface{}{"row": fr.rowNum, "error": "DB transaction error"})
				}
				batch = batch[:0]
				return
			}
			defer tx.Rollback(ctx)

			for _, fr := range batch {
				// Use ON CONFLICT to skip duplicates
				tag, err := tx.Exec(ctx,
					`INSERT INTO finances_studentfee
						(student_id, fee_type_id, amount_due, amount_paid, due_date,
						 academic_term, academic_year, is_paid)
					 VALUES ($1, $2, $3, 0, CURRENT_DATE, $4, $5, false)
					 ON CONFLICT DO NOTHING`,
					fr.studentID, fr.feeTypeID, fr.amount, fr.academicTerm, fr.academicYear,
				)
				if err != nil {
					errors = append(errors, map[string]interface{}{"row": fr.rowNum, "error": fmt.Sprintf("Insert failed: %v", err)})
					continue
				}
				if tag.RowsAffected() > 0 {
					created++
				}
			}

			if err := tx.Commit(ctx); err != nil {
				log.Printf("WARN: fee batch commit failed: %v", err)
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
			feeTypeName := getCol(record, colIdx, "fee_type_name")
			amountStr := getCol(record, colIdx, "amount")
			academicYear := getCol(record, colIdx, "academic_year")
			academicTerm := getCol(record, colIdx, "academic_term")

			amount, err := strconv.ParseFloat(amountStr, 64)
			if err != nil {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": "Invalid amount"})
				continue
			}

			studentID, ok := studentMap[studentNumber]
			if !ok {
				errors = append(errors, map[string]interface{}{"row": rowNum, "error": fmt.Sprintf("Student '%s' not found.", studentNumber)})
				continue
			}

			// Get or create fee type
			feeTypeKey := strings.ToLower(feeTypeName)
			feeTypeID, ok := feeTypeMap[feeTypeKey]
			if !ok {
				// Create new fee type
				err := pool.QueryRow(ctx,
					`INSERT INTO finances_feetype (name, description, amount, academic_year, school_id)
					 VALUES ($1, '', $2, $3, $4)
					 ON CONFLICT DO NOTHING
					 RETURNING id`,
					feeTypeName, amount, academicYear, schoolID,
				).Scan(&feeTypeID)
				if err != nil {
					// Might already exist from concurrent insert, try to fetch
					pool.QueryRow(ctx,
						"SELECT id FROM finances_feetype WHERE LOWER(name) = $1 AND school_id = $2",
						feeTypeKey, schoolID,
					).Scan(&feeTypeID)
				}
				if feeTypeID > 0 {
					feeTypeMap[feeTypeKey] = feeTypeID
				} else {
					errors = append(errors, map[string]interface{}{"row": rowNum, "error": "Failed to create fee type"})
					continue
				}
			}

			batch = append(batch, feeRow{
				studentID: studentID, feeTypeID: feeTypeID,
				amount: amount, academicYear: academicYear,
				academicTerm: academicTerm, rowNum: rowNum,
			})

			if len(batch) >= 100 {
				flushBatch()
			}
		}
		flushBatch()

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"created": created,
			"errors":  errors,
			"message": fmt.Sprintf("Imported %d fee records with %d errors.", created, len(errors)),
		})
	}
}

// loadFeeTypeMap returns map[lowercase_name] → fee_type_id for a school
func loadFeeTypeMap(ctx context.Context, pool *pgxpool.Pool, schoolID int64) (map[string]int64, error) {
	rows, err := pool.Query(ctx,
		"SELECT id, LOWER(name) FROM finances_feetype WHERE school_id = $1", schoolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectRows(rows)
}
