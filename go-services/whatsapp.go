package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// ──────────────────────────────────────────────────────────────
// WhatsApp Business API Service
// Replaces whatsapp_intergration/tasks.py send_whatsapp_message_task
// Uses goroutines instead of Celery for async sending with retries.
// ──────────────────────────────────────────────────────────────

// whatsappSendRequest is the JSON body for POST /api/v1/services/whatsapp/send
type whatsappSendRequest struct {
	ToPhone     string `json:"to_phone"`
	MessageText string `json:"message_text"`
}

// WhatsAppSendHandler handles POST /api/v1/services/whatsapp/send
// Internal endpoint — Django/Celery calls this to send WhatsApp messages.
// Returns 202 immediately, sends the message asynchronously with retries.
func WhatsAppSendHandler() http.HandlerFunc {
	cfg := LoadConfig()

	return func(w http.ResponseWriter, r *http.Request) {
		var req whatsappSendRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body."})
			return
		}

		if req.ToPhone == "" || req.MessageText == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to_phone and message_text are required."})
			return
		}

		// Fire and forget — send in goroutine with retries
		go sendWhatsAppWithRetry(cfg, req.ToPhone, req.MessageText, 3)

		writeJSON(w, http.StatusAccepted, map[string]string{
			"message": fmt.Sprintf("WhatsApp message queued for %s.", req.ToPhone),
		})
	}
}

// sendWhatsAppWithRetry sends a WhatsApp message via the Meta Business API.
// Retries up to maxRetries times with exponential backoff (matching Celery task behavior).
func sendWhatsAppWithRetry(cfg Config, toPhone, messageText string, maxRetries int) {
	if cfg.WhatsAppAPIURL == "" || cfg.WhatsAppAccessToken == "" {
		log.Println("WhatsApp API not configured — message skipped")
		return
	}

	url := cfg.WhatsAppAPIURL + "/messages"

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                toPhone,
		"type":              "text",
		"text":              map[string]string{"body": messageText},
	}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 15 * time.Second}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 10s, 20s, 40s (matching Celery: 2^retry * 10)
			backoff := time.Duration(1<<uint(attempt)) * 10 * time.Second
			log.Printf("WhatsApp retry %d/%d for %s — waiting %v", attempt, maxRetries, toPhone, backoff)
			time.Sleep(backoff)
		}

		req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+cfg.WhatsAppAccessToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("WhatsApp send error (attempt %d): %v", attempt, err)
			continue
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			log.Printf("WhatsApp message sent to %s", toPhone)
			return
		}

		log.Printf("WhatsApp API error %d (attempt %d): %s", resp.StatusCode, attempt, string(respBody[:min(300, len(respBody))]))
	}

	log.Printf("WhatsApp message to %s failed after %d retries", toPhone, maxRetries)
}
