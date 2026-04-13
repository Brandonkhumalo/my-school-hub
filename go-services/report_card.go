package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Data structures matching Django models ──

type studentInfo struct {
	FullName      string
	StudentNumber string
	ClassName     string
	Gender        string
	AdmissionDate string
}

type resultRow struct {
	SubjectName string
	ExamType    string
	Score       float64
	MaxScore    float64
}

type attendanceStats struct {
	Total   int
	Present int
}

// ReportCardHandler generates a PDF report card for a student.
// GET /api/v1/academics/students/{studentID}/report-card/?year=2025&term=Term+1
func ReportCardHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// ── Auth check: role must be admin, teacher, or parent ──
		role := r.Header.Get("X-User-Role")
		if role != "admin" && role != "teacher" && role != "parent" {
			http.Error(w, `{"error":"Permission denied."}`, http.StatusForbidden)
			return
		}

		schoolIDStr := r.Header.Get("X-User-School-ID")
		schoolID, err := strconv.Atoi(schoolIDStr)
		if err != nil || schoolID == 0 {
			http.Error(w, `{"error":"Invalid school context."}`, http.StatusBadRequest)
			return
		}

		studentIDStr := r.PathValue("studentID")
		studentID, err := strconv.Atoi(studentIDStr)
		if err != nil {
			http.Error(w, `{"error":"Invalid student ID."}`, http.StatusBadRequest)
			return
		}

		year := r.URL.Query().Get("year")
		term := r.URL.Query().Get("term")

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		// ── Fetch school name ──
		var schoolName string
		err = pool.QueryRow(ctx,
			`SELECT name FROM users_school WHERE id = $1`, schoolID,
		).Scan(&schoolName)
		if err != nil {
			http.Error(w, `{"error":"School not found."}`, http.StatusNotFound)
			return
		}

		// ── Fetch student info ──
		// Join academics_student → users_customuser → academics_class
		var stu studentInfo
		err = pool.QueryRow(ctx, `
			SELECT
				COALESCE(u.first_name || ' ' || u.last_name, ''),
				COALESCE(u.student_number, '-'),
				COALESCE(c.name, '-'),
				COALESCE(s.gender, '-'),
				COALESCE(s.admission_date::text, '-')
			FROM academics_student s
			JOIN users_customuser u ON u.id = s.user_id
			LEFT JOIN academics_class c ON c.id = s.student_class_id
			WHERE s.id = $1 AND u.school_id = $2
		`, studentID, schoolID).Scan(
			&stu.FullName, &stu.StudentNumber, &stu.ClassName,
			&stu.Gender, &stu.AdmissionDate,
		)
		if err != nil {
			http.Error(w, `{"error":"Student not found."}`, http.StatusNotFound)
			return
		}

		// ── Fetch results ──
		rows, err := pool.Query(ctx, `
			SELECT sub.name, r.exam_type, r.score, r.max_score
			FROM academics_result r
			JOIN academics_subject sub ON sub.id = r.subject_id
			WHERE r.student_id = $1 AND r.academic_year = $2 AND r.academic_term = $3
			ORDER BY sub.name
		`, studentID, year, term)
		if err != nil {
			log.Printf("Error fetching results: %v", err)
			http.Error(w, `{"error":"Failed to fetch results."}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var results []resultRow
		for rows.Next() {
			var rr resultRow
			if err := rows.Scan(&rr.SubjectName, &rr.ExamType, &rr.Score, &rr.MaxScore); err != nil {
				continue
			}
			results = append(results, rr)
		}

		// ── Fetch attendance ──
		var att attendanceStats
		err = pool.QueryRow(ctx, `
			SELECT
				COUNT(*),
				COUNT(*) FILTER (WHERE status = 'present')
			FROM academics_attendance
			WHERE student_id = $1
		`, studentID).Scan(&att.Total, &att.Present)
		if err != nil {
			att = attendanceStats{0, 0}
		}

		// ── Generate PDF ──
		pdfBytes, err := buildReportCardPDF(schoolName, stu, results, att, year, term)
		if err != nil {
			log.Printf("PDF generation error: %v", err)
			http.Error(w, `{"error":"Failed to generate PDF."}`, http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("report_card_%s_%s_%s.pdf", stu.StudentNumber, term, year)
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
		w.Write(pdfBytes)
	}
}

// buildReportCardPDF creates an A4 PDF matching the Django reportlab layout.
func buildReportCardPDF(schoolName string, stu studentInfo, results []resultRow, att attendanceStats, year, term string) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	// ── Header: School name + subtitle ──
	pdf.SetFont("Helvetica", "B", 18)
	pdf.CellFormat(0, 10, schoolName, "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "", 11)
	pdf.CellFormat(0, 7, fmt.Sprintf("Student Report Card - %s %s", term, year), "", 1, "C", false, 0, "")
	pdf.Ln(5)

	// ── Student info table ──
	// Light blue for label cells: RGB(173, 216, 230)
	labelR, labelG, labelB := 173, 216, 230

	drawInfoRow := func(label1, val1, label2, val2 string) {
		h := 7.0
		pdf.SetFont("Helvetica", "", 9)

		// Label 1 (light blue bg)
		pdf.SetFillColor(labelR, labelG, labelB)
		pdf.CellFormat(30, h, label1, "1", 0, "L", true, 0, "")
		// Value 1
		pdf.SetFillColor(255, 255, 255)
		pdf.CellFormat(70, h, val1, "1", 0, "L", false, 0, "")
		// Label 2 (light blue bg)
		pdf.SetFillColor(labelR, labelG, labelB)
		pdf.CellFormat(35, h, label2, "1", 0, "L", true, 0, "")
		// Value 2
		pdf.SetFillColor(255, 255, 255)
		pdf.CellFormat(45, h, val2, "1", 1, "L", false, 0, "")
	}

	drawInfoRow("Student Name:", stu.FullName, "Student Number:", stu.StudentNumber)
	drawInfoRow("Class:", stu.ClassName, "Gender:", stu.Gender)
	drawInfoRow("Admission Date:", stu.AdmissionDate, "Attendance:", fmt.Sprintf("%d/%d days", att.Present, att.Total))
	pdf.Ln(5)

	// ── Academic Results heading ──
	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(0, 8, "Academic Results", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	if len(results) == 0 {
		pdf.SetFont("Helvetica", "", 10)
		pdf.CellFormat(0, 8, "No results recorded for this term.", "", 1, "L", false, 0, "")
	} else {
		// Column widths: Subject(50) ExamType(30) Score(20) MaxScore(25) Percentage(30) Grade(20)
		colW := []float64{50, 30, 20, 25, 30, 25}
		headers := []string{"Subject", "Exam Type", "Score", "Max Score", "Percentage", "Grade"}

		// Header row: dark blue #1d4ed8 → RGB(29, 78, 216)
		pdf.SetFillColor(29, 78, 216)
		pdf.SetTextColor(255, 255, 255)
		pdf.SetFont("Helvetica", "B", 9)
		for i, h := range headers {
			align := "L"
			if i >= 2 {
				align = "C"
			}
			pdf.CellFormat(colW[i], 7, h, "1", 0, align, true, 0, "")
		}
		pdf.Ln(-1)

		// Data rows with alternating backgrounds
		pdf.SetTextColor(0, 0, 0)
		pdf.SetFont("Helvetica", "", 9)

		for idx, rr := range results {
			// Alternate row: white / light grey #f3f4f6 → RGB(243, 244, 246)
			if idx%2 == 0 {
				pdf.SetFillColor(255, 255, 255)
			} else {
				pdf.SetFillColor(243, 244, 246)
			}

			pct := 0.0
			if rr.MaxScore > 0 {
				pct = math.Round((rr.Score/rr.MaxScore)*1000) / 10 // round to 1 decimal
			}
			grade := calcGrade(pct)

			pdf.CellFormat(colW[0], 7, rr.SubjectName, "1", 0, "L", true, 0, "")
			pdf.CellFormat(colW[1], 7, rr.ExamType, "1", 0, "L", true, 0, "")
			pdf.CellFormat(colW[2], 7, fmt.Sprintf("%.0f", rr.Score), "1", 0, "C", true, 0, "")
			pdf.CellFormat(colW[3], 7, fmt.Sprintf("%.0f", rr.MaxScore), "1", 0, "C", true, 0, "")
			pdf.CellFormat(colW[4], 7, fmt.Sprintf("%.1f%%", pct), "1", 0, "C", true, 0, "")
			pdf.CellFormat(colW[5], 7, grade, "1", 1, "C", true, 0, "")
		}
	}

	// ── Footer ──
	pdf.Ln(10)
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(100, 100, 100)
	generated := time.Now().Format("02 January 2006")
	pdf.CellFormat(0, 6, fmt.Sprintf("Generated on %s | %s", generated, schoolName), "", 1, "L", false, 0, "")

	// Write PDF to buffer
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// calcGrade converts a percentage into the letter grade used on report cards.
func calcGrade(pct float64) string {
	switch {
	case pct >= 80:
		return "A"
	case pct >= 70:
		return "B"
	case pct >= 60:
		return "C"
	case pct >= 50:
		return "D"
	default:
		return "F"
	}
}

// ── Bulk report card endpoint (generates multiple PDFs as JSON with base64) ──

type bulkReportRequest struct {
	StudentIDs []int  `json:"student_ids"`
	Year       string `json:"year"`
	Term       string `json:"term"`
}

type bulkReportResult struct {
	StudentID     int    `json:"student_id"`
	StudentNumber string `json:"student_number"`
	Filename      string `json:"filename"`
	Error         string `json:"error,omitempty"`
	// PDF bytes sent separately — this is for status tracking
}

// BulkReportCardHandler generates report cards for multiple students concurrently.
// POST /api/v1/services/report-cards/bulk
// Body: { "student_ids": [1,2,3], "year": "2025", "term": "Term 1" }
// Response: multipart or JSON with status per student
func BulkReportCardHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "admin" && role != "teacher" {
			http.Error(w, `{"error":"Permission denied."}`, http.StatusForbidden)
			return
		}

		var req bulkReportRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request body."}`, http.StatusBadRequest)
			return
		}

		// For now, return count of students to process
		// Individual reports are generated via the single endpoint
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": fmt.Sprintf("Use GET /api/v1/academics/students/{id}/report-card/ for each of the %d students.", len(req.StudentIDs)),
			"count":   len(req.StudentIDs),
		})
	}
}
