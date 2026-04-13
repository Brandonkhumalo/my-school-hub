package main

import (
	"log"
	"os"
)

// Config holds all environment-based configuration for go-services.
type Config struct {
	Port        string
	DatabaseURL string

	// PayNow global URLs (per-school credentials come from DB)
	PayNowResultURL string
	PayNowReturnURL string

	// Resend email
	ResendAPIKey   string
	ResendFromEmail string

	// WhatsApp Business API
	WhatsAppAPIURL      string
	WhatsAppAccessToken string
}

// LoadConfig reads environment variables and applies defaults for optional fields.
func LoadConfig() Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("FATAL: DATABASE_URL is required")
	}

	return Config{
		Port:                getEnv("SERVICES_PORT", "8082"),
		DatabaseURL:         dbURL,
		PayNowResultURL:     getEnv("PAYNOW_RESULT_URL", ""),
		PayNowReturnURL:     getEnv("PAYNOW_RETURN_URL", "http://localhost:5000/payment/return"),
		ResendAPIKey:        getEnv("ResendEmailApiKey", ""),
		ResendFromEmail:     getEnv("ResendFromEmail", "noreply@myschoolhub.co.zw"),
		WhatsAppAPIURL:      getEnv("WHATSAPP_API_URL", ""),
		WhatsAppAccessToken: getEnv("WHATSAPP_ACCESS_TOKEN", ""),
	}
}

// getEnv reads an env var with fallback when not set.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
