package main

import (
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const (
	statusSubmitted   = "submitted"
	statusUnderReview = "under_review"
	statusAccepted    = "accepted"
	statusRejected    = "rejected"
	statusWaitlisted  = "waitlisted"
)

var validStatuses = map[string]bool{
	statusSubmitted:   true,
	statusUnderReview: true,
	statusAccepted:    true,
	statusRejected:    true,
	statusWaitlisted:  true,
}

type SchoolConfig struct {
	SchoolID                 string    `json:"school_id"`
	OnlineSubmissionsEnabled bool      `json:"online_submissions_enabled"`
	ApplicationsOpenAt       time.Time `json:"applications_open_at"`
	ApplicationsCloseAt      time.Time `json:"applications_close_at"`
	RequiredDocuments        []string  `json:"required_documents"`
	UpdatedAt                time.Time `json:"updated_at"`
}

type Application struct {
	ID               string       `json:"id"`
	Reference        string       `json:"reference"`
	SchoolID         string       `json:"school_id"`
	FirstName        string       `json:"first_name"`
	LastName         string       `json:"last_name"`
	Email            string       `json:"email"`
	ProgramChoice    string       `json:"program_choice"`
	Payload          interface{}  `json:"payload"`
	Documents        []string     `json:"documents"`
	Status           string       `json:"status"`
	ReviewerEmail    string       `json:"reviewer_email,omitempty"`
	InternalNote     string       `json:"internal_note,omitempty"`
	SubmittedAt      time.Time    `json:"submitted_at"`
	LastUpdatedAt    time.Time    `json:"last_updated_at"`
	DecisionAt       *time.Time   `json:"decision_at,omitempty"`
	StatusHistory    []StatusItem `json:"status_history"`
	ApplicationScore int          `json:"application_score"`
}

type StatusItem struct {
	Status    string    `json:"status"`
	ChangedAt time.Time `json:"changed_at"`
	ChangedBy string    `json:"changed_by"`
	Note      string    `json:"note,omitempty"`
}

type Store struct {
	mu           sync.RWMutex
	schoolConfig map[string]SchoolConfig
	applications map[string]Application
	sequence     map[string]int
}

func NewStore() *Store {
	return &Store{
		schoolConfig: make(map[string]SchoolConfig),
		applications: make(map[string]Application),
		sequence:     make(map[string]int),
	}
}

func (s *Store) upsertConfig(cfg SchoolConfig) SchoolConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg.UpdatedAt = time.Now().UTC()
	s.schoolConfig[cfg.SchoolID] = cfg
	return cfg
}

func (s *Store) getConfig(schoolID string) (SchoolConfig, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cfg, ok := s.schoolConfig[schoolID]
	return cfg, ok
}

func (s *Store) createApplication(app Application) Application {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.sequence[app.SchoolID]++
	year := time.Now().UTC().Year()
	app.Reference = fmt.Sprintf("%s-%d-%06d", strings.ToUpper(app.SchoolID), year, s.sequence[app.SchoolID])
	app.ID = uuid.NewString()
	app.SubmittedAt = time.Now().UTC()
	app.LastUpdatedAt = app.SubmittedAt
	app.Status = statusSubmitted
	app.StatusHistory = []StatusItem{{
		Status:    statusSubmitted,
		ChangedAt: app.SubmittedAt,
		ChangedBy: "applicant",
	}}
	s.applications[app.ID] = app
	return app
}

func (s *Store) updateStatus(appID, newStatus, actor, note string) (Application, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	app, ok := s.applications[appID]
	if !ok {
		return Application{}, false
	}

	now := time.Now().UTC()
	app.Status = newStatus
	app.LastUpdatedAt = now
	app.StatusHistory = append(app.StatusHistory, StatusItem{
		Status:    newStatus,
		ChangedAt: now,
		ChangedBy: actor,
		Note:      note,
	})
	if newStatus == statusAccepted || newStatus == statusRejected || newStatus == statusWaitlisted {
		app.DecisionAt = &now
	}

	s.applications[appID] = app
	return app, true
}

func (s *Store) assignReviewer(appID, reviewer string) (Application, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	app, ok := s.applications[appID]
	if !ok {
		return Application{}, false
	}
	app.ReviewerEmail = reviewer
	app.LastUpdatedAt = time.Now().UTC()
	s.applications[appID] = app
	return app, true
}

func (s *Store) listBySchool(schoolID, status string) []Application {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Application, 0)
	for _, app := range s.applications {
		if app.SchoolID != schoolID {
			continue
		}
		if status != "" && app.Status != status {
			continue
		}
		out = append(out, app)
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].SubmittedAt.After(out[j].SubmittedAt)
	})
	return out
}

type UpsertConfigRequest struct {
	OnlineSubmissionsEnabled bool     `json:"online_submissions_enabled"`
	ApplicationsOpenAt       string   `json:"applications_open_at"`
	ApplicationsCloseAt      string   `json:"applications_close_at"`
	RequiredDocuments        []string `json:"required_documents"`
}

type CreateApplicationRequest struct {
	FirstName     string      `json:"first_name"`
	LastName      string      `json:"last_name"`
	Email         string      `json:"email"`
	ProgramChoice string      `json:"program_choice"`
	Documents     []string    `json:"documents"`
	Payload       interface{} `json:"payload"`
}

type StatusUpdateRequest struct {
	Status string `json:"status"`
	Note   string `json:"note"`
	Actor  string `json:"actor"`
}

type AssignReviewerRequest struct {
	ReviewerEmail string `json:"reviewer_email"`
}

func main() {
	store := NewStore()
	bootstrapDemoConfig(store)

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.RequestID())
	e.Use(middleware.Recover())
	e.Use(middleware.Gzip())
	e.Use(middleware.Logger())

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok", "service": "go-admissions-api"})
	})

	e.GET("/api/v1/admissions/schools/:schoolID/config", func(c echo.Context) error {
		schoolID := normalizeSchoolID(c.Param("schoolID"))
		cfg, ok := store.getConfig(schoolID)
		if !ok {
			return c.JSON(http.StatusNotFound, map[string]string{"detail": "school config not found"})
		}
		return c.JSON(http.StatusOK, cfg)
	})

	e.PUT("/api/v1/admissions/schools/:schoolID/config", func(c echo.Context) error {
		schoolID := normalizeSchoolID(c.Param("schoolID"))
		var req UpsertConfigRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "invalid JSON payload"})
		}

		openAt, err := parseTime(req.ApplicationsOpenAt)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "applications_open_at must be RFC3339"})
		}
		closeAt, err := parseTime(req.ApplicationsCloseAt)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "applications_close_at must be RFC3339"})
		}
		if closeAt.Before(openAt) {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "applications_close_at must be after applications_open_at"})
		}

		cfg := store.upsertConfig(SchoolConfig{
			SchoolID:                 schoolID,
			OnlineSubmissionsEnabled: req.OnlineSubmissionsEnabled,
			ApplicationsOpenAt:       openAt,
			ApplicationsCloseAt:      closeAt,
			RequiredDocuments:        uniqueLower(req.RequiredDocuments),
		})

		return c.JSON(http.StatusOK, cfg)
	})

	e.POST("/api/v1/admissions/schools/:schoolID/applications", func(c echo.Context) error {
		schoolID := normalizeSchoolID(c.Param("schoolID"))
		cfg, ok := store.getConfig(schoolID)
		if !ok {
			return c.JSON(http.StatusNotFound, map[string]string{"detail": "school config not found"})
		}
		if !cfg.OnlineSubmissionsEnabled {
			return c.JSON(http.StatusForbidden, map[string]string{"detail": "online submissions are disabled for this school"})
		}

		now := time.Now().UTC()
		if now.Before(cfg.ApplicationsOpenAt) || now.After(cfg.ApplicationsCloseAt) {
			return c.JSON(http.StatusForbidden, map[string]string{"detail": "application window is closed"})
		}

		var req CreateApplicationRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "invalid JSON payload"})
		}
		if strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" || strings.TrimSpace(req.Email) == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "first_name, last_name, and email are required"})
		}

		docSet := make(map[string]bool)
		for _, d := range req.Documents {
			docSet[strings.ToLower(strings.TrimSpace(d))] = true
		}
		missingDocs := make([]string, 0)
		for _, d := range cfg.RequiredDocuments {
			if !docSet[d] {
				missingDocs = append(missingDocs, d)
			}
		}
		if len(missingDocs) > 0 {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"detail":            "required documents are missing",
				"missing_documents": missingDocs,
			})
		}

		app := store.createApplication(Application{
			SchoolID:         schoolID,
			FirstName:        strings.TrimSpace(req.FirstName),
			LastName:         strings.TrimSpace(req.LastName),
			Email:            strings.ToLower(strings.TrimSpace(req.Email)),
			ProgramChoice:    strings.TrimSpace(req.ProgramChoice),
			Documents:        uniqueLower(req.Documents),
			Payload:          req.Payload,
			ApplicationScore: scoreApplication(req),
		})

		return c.JSON(http.StatusCreated, app)
	})

	e.GET("/api/v1/admissions/schools/:schoolID/applications", func(c echo.Context) error {
		schoolID := normalizeSchoolID(c.Param("schoolID"))
		status := strings.TrimSpace(c.QueryParam("status"))
		if status != "" && !validStatuses[status] {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "invalid status filter"})
		}
		apps := store.listBySchool(schoolID, status)
		return c.JSON(http.StatusOK, map[string]interface{}{"count": len(apps), "results": apps})
	})

	e.POST("/api/v1/admissions/applications/:applicationID/assign", func(c echo.Context) error {
		appID := c.Param("applicationID")
		var req AssignReviewerRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "invalid JSON payload"})
		}
		if strings.TrimSpace(req.ReviewerEmail) == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "reviewer_email is required"})
		}
		app, ok := store.assignReviewer(appID, strings.ToLower(strings.TrimSpace(req.ReviewerEmail)))
		if !ok {
			return c.JSON(http.StatusNotFound, map[string]string{"detail": "application not found"})
		}
		return c.JSON(http.StatusOK, app)
	})

	e.POST("/api/v1/admissions/applications/:applicationID/status", func(c echo.Context) error {
		appID := c.Param("applicationID")
		var req StatusUpdateRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "invalid JSON payload"})
		}
		if !validStatuses[req.Status] {
			return c.JSON(http.StatusBadRequest, map[string]string{"detail": "unsupported status"})
		}
		actor := strings.TrimSpace(req.Actor)
		if actor == "" {
			actor = "reviewer"
		}

		app, ok := store.updateStatus(appID, req.Status, actor, strings.TrimSpace(req.Note))
		if !ok {
			return c.JSON(http.StatusNotFound, map[string]string{"detail": "application not found"})
		}
		return c.JSON(http.StatusOK, app)
	})

	port := getEnv("ADMISSIONS_PORT", "8091")
	e.Logger.Fatal(e.Start(":" + port))
}

func parseTime(v string) (time.Time, error) {
	return time.Parse(time.RFC3339, strings.TrimSpace(v))
}

func uniqueLower(values []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(values))
	for _, value := range values {
		v := strings.ToLower(strings.TrimSpace(value))
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

func normalizeSchoolID(v string) string {
	clean := strings.TrimSpace(strings.ToLower(v))
	clean = strings.ReplaceAll(clean, " ", "-")
	if clean == "" {
		return "unknown"
	}
	return clean
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func bootstrapDemoConfig(store *Store) {
	now := time.Now().UTC()
	_ = store.upsertConfig(SchoolConfig{
		SchoolID:                 "demo-school",
		OnlineSubmissionsEnabled: true,
		ApplicationsOpenAt:       now.Add(-24 * time.Hour),
		ApplicationsCloseAt:      now.Add(45 * 24 * time.Hour),
		RequiredDocuments:        []string{"id_document", "transcript"},
	})
}

func scoreApplication(req CreateApplicationRequest) int {
	score := 40
	score += len(req.Documents) * 10
	if strings.TrimSpace(req.ProgramChoice) != "" {
		score += 15
	}
	if payloadMap, ok := req.Payload.(map[string]interface{}); ok {
		score += len(payloadMap) * 2
	}
	if score > 100 {
		return 100
	}
	if score < 0 {
		return 0
	}
	return score
}
