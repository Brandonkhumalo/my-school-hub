package main

import (
	"context"
	"crypto/sha512"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ──────────────────────────────────────────────────────────────
// PayNow Zimbabwe API Client (replaces Python paynow SDK)
// Docs: https://developers.paynow.co.zw/docs/
// ──────────────────────────────────────────────────────────────

const (
	paynowInitURL   = "https://www.paynow.co.zw/interface/initiatetransaction"
	paynowMobileURL = "https://www.paynow.co.zw/interface/remotetransaction"
)

// paynowHash generates the HMAC-SHA512 hash required by PayNow.
// PayNow hashing: concatenate all form values in order + integration key, then SHA512.
func paynowHash(values url.Values, keys []string, integrationKey string) string {
	var concat string
	for _, k := range keys {
		concat += values.Get(k)
	}
	concat += integrationKey
	h := sha512.Sum512([]byte(concat))
	return fmt.Sprintf("%X", h[:]) // uppercase hex
}

// parsePayNowResponse parses the URL-encoded response from PayNow.
func parsePayNowResponse(body string) map[string]string {
	result := make(map[string]string)
	pairs := strings.Split(body, "&")
	for _, pair := range pairs {
		kv := strings.SplitN(pair, "=", 2)
		if len(kv) == 2 {
			key, _ := url.QueryUnescape(kv[0])
			val, _ := url.QueryUnescape(kv[1])
			result[strings.ToLower(key)] = val
		}
	}
	return result
}

type payNowResult struct {
	Success     bool   `json:"success"`
	RedirectURL string `json:"redirect_url,omitempty"`
	PollURL     string `json:"poll_url,omitempty"`
	Error       string `json:"error,omitempty"`
	// Mobile-specific
	Instructions string `json:"instructions,omitempty"`
}

// initiateWebPayment calls the PayNow web payment API.
func initiateWebPayment(reference, email, description string, amount float64,
	integrationID, integrationKey, resultURL, returnURL string) payNowResult {

	// Build form values in PayNow's required order
	values := url.Values{}
	values.Set("id", integrationID)
	values.Set("reference", reference)
	values.Set("amount", fmt.Sprintf("%.2f", amount))
	values.Set("additionalinfo", description)
	values.Set("returnurl", returnURL)
	values.Set("resulturl", resultURL)
	values.Set("authemail", email)
	values.Set("status", "Message")

	// Generate hash over the ordered fields
	hashKeys := []string{"resulturl", "returnurl", "reference", "amount", "id", "additionalinfo", "authemail", "status"}
	hash := paynowHash(values, hashKeys, integrationKey)
	values.Set("hash", hash)

	resp, err := http.PostForm(paynowInitURL, values)
	if err != nil {
		log.Printf("PayNow web payment HTTP error: %v", err)
		return payNowResult{Success: false, Error: fmt.Sprintf("HTTP error: %v", err)}
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	parsed := parsePayNowResponse(string(bodyBytes))

	if strings.EqualFold(parsed["status"], "ok") || strings.EqualFold(parsed["status"], "created") {
		return payNowResult{
			Success:     true,
			RedirectURL: parsed["browserurl"],
			PollURL:     parsed["pollurl"],
		}
	}

	errMsg := parsed["error"]
	if errMsg == "" {
		errMsg = fmt.Sprintf("PayNow returned status: %s", parsed["status"])
	}
	log.Printf("PayNow web payment failed: %s", errMsg)
	return payNowResult{Success: false, Error: errMsg}
}

// initiateMobilePayment calls the PayNow mobile money API (EcoCash/OneMoney/InnBucks).
func initiateMobilePayment(reference, email, description string, amount float64,
	phone, method, integrationID, integrationKey, resultURL, returnURL string) payNowResult {

	values := url.Values{}
	values.Set("id", integrationID)
	values.Set("reference", reference)
	values.Set("amount", fmt.Sprintf("%.2f", amount))
	values.Set("additionalinfo", description)
	values.Set("returnurl", returnURL)
	values.Set("resulturl", resultURL)
	values.Set("authemail", email)
	values.Set("phone", phone)
	values.Set("method", method)
	values.Set("status", "Message")

	hashKeys := []string{"resulturl", "returnurl", "reference", "amount", "id", "additionalinfo", "authemail", "phone", "method", "status"}
	hash := paynowHash(values, hashKeys, integrationKey)
	values.Set("hash", hash)

	resp, err := http.PostForm(paynowMobileURL, values)
	if err != nil {
		log.Printf("PayNow mobile payment HTTP error: %v", err)
		return payNowResult{Success: false, Error: fmt.Sprintf("HTTP error: %v", err)}
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	parsed := parsePayNowResponse(string(bodyBytes))

	if strings.EqualFold(parsed["status"], "ok") || strings.EqualFold(parsed["status"], "created") ||
		strings.EqualFold(parsed["status"], "sent") {
		return payNowResult{
			Success:      true,
			PollURL:      parsed["pollurl"],
			RedirectURL:  parsed["browserurl"],
			Instructions: parsed["instructions"],
		}
	}

	errMsg := parsed["error"]
	if errMsg == "" {
		errMsg = fmt.Sprintf("PayNow mobile returned status: %s", parsed["status"])
	}
	log.Printf("PayNow mobile payment failed: %s", errMsg)
	return payNowResult{Success: false, Error: errMsg}
}

// checkPaymentStatus polls a PayNow poll URL for payment status.
func checkPaymentStatus(pollURL, integrationID, integrationKey string) map[string]interface{} {
	resp, err := http.Get(pollURL)
	if err != nil {
		log.Printf("PayNow status check HTTP error: %v", err)
		return map[string]interface{}{"paid": false, "status": "error", "amount": nil}
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	parsed := parsePayNowResponse(string(bodyBytes))

	status := strings.ToLower(parsed["status"])
	paid := status == "paid" || status == "awaiting delivery"

	var amount interface{}
	if a, err := strconv.ParseFloat(parsed["amount"], 64); err == nil {
		amount = a
	}

	return map[string]interface{}{
		"paid":   paid,
		"status": parsed["status"],
		"amount": amount,
	}
}

// ──────────────────────────────────────────────────────────────
// HTTP Handlers
// ──────────────────────────────────────────────────────────────

type paynowInitRequest struct {
	Amount       float64 `json:"amount"`
	Description  string  `json:"description"`
	MobileNumber string  `json:"mobile_number"`
	Method       string  `json:"method"`
	Reference    string  `json:"reference"`
}

// PayNowInitiateHandler handles POST /api/v1/finances/payments/paynow/initiate/
func PayNowInitiateHandler(pool *pgxpool.Pool) http.HandlerFunc {
	cfg := LoadConfig()

	return func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "parent" && role != "student" && role != "admin" && role != "accountant" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Permission denied."})
			return
		}

		schoolIDStr := r.Header.Get("X-User-School-ID")
		schoolID, _ := strconv.Atoi(schoolIDStr)
		userID := r.Header.Get("X-User-ID")

		var req paynowInitRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body."})
			return
		}

		if req.Amount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Amount must be greater than 0."})
			return
		}
		if req.Method == "" {
			req.Method = "web"
		}
		req.Method = strings.ToLower(req.Method)
		if req.Description == "" {
			req.Description = "School Fees"
		}

		// Fetch per-school PayNow credentials from SchoolSettings
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var integrationID, integrationKey string
		err := pool.QueryRow(ctx, `
			SELECT paynow_integration_id, paynow_integration_key
			FROM users_schoolsettings
			WHERE school_id = $1
		`, schoolID).Scan(&integrationID, &integrationKey)

		if err != nil || integrationID == "" || integrationKey == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "PayNow credentials are not configured for your school. Please contact your administrator.",
			})
			return
		}

		// Build reference if not provided
		if req.Reference == "" {
			// Fetch student_number or user ID
			var studentNumber string
			_ = pool.QueryRow(ctx,
				`SELECT COALESCE(student_number, $1::text) FROM users_customuser WHERE id = $2`,
				userID, userID,
			).Scan(&studentNumber)
			req.Reference = fmt.Sprintf("SchoolFees-%s", studentNumber)
		}

		// Fetch user email
		var email string
		_ = pool.QueryRow(ctx, `SELECT email FROM users_customuser WHERE id = $1`, userID).Scan(&email)

		// Initiate payment
		var result payNowResult
		if req.Method == "ecocash" || req.Method == "onemoney" || req.Method == "innbucks" {
			if req.MobileNumber == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Mobile number is required for mobile payments."})
				return
			}
			result = initiateMobilePayment(req.Reference, email, req.Description, req.Amount,
				req.MobileNumber, req.Method, integrationID, integrationKey,
				cfg.PayNowResultURL, cfg.PayNowReturnURL)
		} else {
			result = initiateWebPayment(req.Reference, email, req.Description, req.Amount,
				integrationID, integrationKey, cfg.PayNowResultURL, cfg.PayNowReturnURL)
		}

		if result.Success {
			msg := "Payment initiated. Follow the link to complete payment."
			if req.Method != "web" {
				msg = fmt.Sprintf("Check your %s prompt to approve payment.", strings.ToUpper(req.Method))
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"success":      true,
				"redirect_url": result.RedirectURL,
				"poll_url":     result.PollURL,
				"instructions": result.Instructions,
				"message":      msg,
			})
		} else {
			errMsg := result.Error
			if errMsg == "" {
				errMsg = "Payment initiation failed."
			}
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": errMsg})
		}
	}
}

// PayNowCallbackHandler handles POST /api/v1/finances/payments/paynow/result/
// Server-to-server callback from PayNow — no auth required.
func PayNowCallbackHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			// Also try JSON body
			_ = r.ParseMultipartForm(1024 * 1024)
		}

		reference := r.FormValue("reference")
		paynowRef := r.FormValue("paynowreference")
		amount := r.FormValue("amount")
		statusVal := strings.ToLower(r.FormValue("status"))

		log.Printf("PayNow callback: ref=%s paynow_ref=%s status=%s amount=%s",
			reference, paynowRef, statusVal, amount)

		if statusVal == "paid" || statusVal == "awaiting delivery" {
			ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
			defer cancel()

			// Update payment record status
			_, err := pool.Exec(ctx, `
				UPDATE finances_studentpaymentrecord
				SET payment_status = 'fully paid'
				WHERE notes ILIKE '%' || $1 || '%'
			`, paynowRef)
			if err != nil {
				log.Printf("PayNow callback DB update failed: %v", err)
			}

			// Fire email notification asynchronously via goroutine
			go sendPayNowReceiptEmails(pool, paynowRef, amount)
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "received"})
	}
}

// sendPayNowReceiptEmails sends payment confirmation emails to parents.
// Runs in a goroutine so the callback returns immediately.
func sendPayNowReceiptEmails(pool *pgxpool.Pool, paynowRef, amount string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cfg := LoadConfig()

	// Find the payment record and get student/school/parent info
	rows, err := pool.Query(ctx, `
		SELECT
			pu.email AS parent_email,
			COALESCE(pu.first_name || ' ' || pu.last_name, '') AS parent_name,
			COALESCE(sch.name, 'Your School') AS school_name,
			COALESCE(su.first_name || ' ' || su.last_name, '') AS student_name,
			COALESCE(c.name, 'N/A') AS class_name
		FROM finances_studentpaymentrecord spr
		JOIN academics_student s ON s.id = spr.student_id
		JOIN users_customuser su ON su.id = s.user_id
		LEFT JOIN academics_class c ON c.id = s.student_class_id
		LEFT JOIN users_school sch ON sch.id = su.school_id
		JOIN academics_parentchildlink pcl ON pcl.student_id = s.id AND pcl.is_confirmed = true
		JOIN academics_parent p ON p.id = pcl.parent_id
		JOIN users_customuser pu ON pu.id = p.user_id
		WHERE spr.notes ILIKE '%' || $1 || '%' AND pu.email != ''
	`, paynowRef)
	if err != nil {
		log.Printf("PayNow receipt email query failed: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var parentEmail, parentName, schoolName, studentName, className string
		if err := rows.Scan(&parentEmail, &parentName, &schoolName, &studentName, &className); err != nil {
			continue
		}
		// Send email via Resend API (non-blocking — already in a goroutine)
		sendPaymentReceivedEmail(cfg, parentEmail, parentName, schoolName, studentName, className, amount, paynowRef)
	}
}

// PayNowStatusHandler handles GET /api/v1/finances/payments/paynow/status/
func PayNowStatusHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pollURL := r.URL.Query().Get("poll_url")
		if pollURL == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "poll_url is required."})
			return
		}

		schoolIDStr := r.Header.Get("X-User-School-ID")
		schoolID, _ := strconv.Atoi(schoolIDStr)

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var integrationID, integrationKey string
		err := pool.QueryRow(ctx, `
			SELECT paynow_integration_id, paynow_integration_key
			FROM users_schoolsettings
			WHERE school_id = $1
		`, schoolID).Scan(&integrationID, &integrationKey)

		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "PayNow not configured for your school."})
			return
		}

		result := checkPaymentStatus(pollURL, integrationID, integrationKey)
		writeJSON(w, http.StatusOK, result)
	}
}

// writeJSON is a helper to write JSON responses.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
