package main

import (
	"archive/zip"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/ledongthuc/pdf"
)

// ──────────────────────────────────────────────────────────────
// Past Exam Papers — file storage + parsing + question extraction
//
// Endpoints (mounted in main.go):
//   POST   /api/v1/services/papers/upload    multipart upload (teacher/admin)
//   GET    /api/v1/services/papers/file      ?key=<file_key>     (school-scoped)
//   POST   /api/v1/services/papers/extract   {"file_key": "..."} (teacher/admin)
//   DELETE /api/v1/services/papers/file      ?key=<file_key>     (teacher/admin)
//
// Storage layout (local disk):
//   <PAPERS_STORAGE_DIR>/<school_id>/papers/<uuid>.<ext>
//
// file_key format: "<school_id>/<uuid>.<ext>"
// This makes tenancy enforceable on every request — the gateway-injected
// X-User-School-ID must match the prefix of the file_key.
// ──────────────────────────────────────────────────────────────

const (
	maxPaperSize = 25 * 1024 * 1024 // 25 MB cap per upload
	mimePDF      = "application/pdf"
	mimeDOCX     = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

// papersRoot returns the configured storage root, defaulting to ./storage/papers in dev.
func papersRoot() string {
	if v := os.Getenv("PAPERS_STORAGE_DIR"); v != "" {
		return v
	}
	return "./storage/papers"
}

// ─── Handlers ────────────────────────────────────────────────

// PaperUploadHandler accepts a multipart upload and stores the file on disk
// under the caller's school. Returns the file_key + basic metadata.
func PaperUploadHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "teacher" && role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Only teachers and admins can upload past papers."})
			return
		}

		schoolID, ok := schoolIDFromHeader(r)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing X-User-School-ID."})
			return
		}

		if err := r.ParseMultipartForm(maxPaperSize); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Failed to parse upload: " + err.Error()})
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing 'file' field in upload."})
			return
		}
		defer file.Close()

		if header.Size > maxPaperSize {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "File exceeds 25MB limit."})
			return
		}

		ext := strings.ToLower(filepath.Ext(header.Filename))
		mt := mime.TypeByExtension(ext)
		if !isAllowedPaperType(ext, mt) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Only .pdf and .docx files are accepted."})
			return
		}

		uuid, err := newUUID()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to generate file id."})
			return
		}

		dir := filepath.Join(papersRoot(), strconv.Itoa(schoolID), "papers")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create storage dir: " + err.Error()})
			return
		}

		filename := uuid + ext
		path := filepath.Join(dir, filename)
		dst, err := os.Create(path)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to write file: " + err.Error()})
			return
		}

		written, err := io.Copy(dst, file)
		dst.Close()
		if err != nil {
			os.Remove(path)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to save file: " + err.Error()})
			return
		}

		fileKey := fmt.Sprintf("%d/%s", schoolID, filename)

		pageCount, _ := countPages(path, ext)

		writeJSON(w, http.StatusCreated, map[string]any{
			"file_key":          fileKey,
			"original_filename": header.Filename,
			"size_bytes":        written,
			"mime_type":         resolveMime(ext),
			"page_count":        pageCount,
		})
	}
}

// PaperDownloadHandler streams a stored file back to the caller.
// Tenancy: the file_key must start with the caller's school id.
func PaperDownloadHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		schoolID, ok := schoolIDFromHeader(r)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing X-User-School-ID."})
			return
		}
		key := r.URL.Query().Get("key")
		path, err := resolvePaperPath(schoolID, key)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		f, err := os.Open(path)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "File not found."})
			return
		}
		defer f.Close()

		ext := strings.ToLower(filepath.Ext(path))
		w.Header().Set("Content-Type", resolveMime(ext))
		w.Header().Set("Content-Disposition", "inline; filename=\""+filepath.Base(path)+"\"")
		io.Copy(w, f)
	}
}

// PaperDeleteHandler removes a stored file. Tenancy enforced via file_key prefix.
func PaperDeleteHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "teacher" && role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Permission denied."})
			return
		}
		schoolID, ok := schoolIDFromHeader(r)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing X-User-School-ID."})
			return
		}
		key := r.URL.Query().Get("key")
		path, err := resolvePaperPath(schoolID, key)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete file."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

// extractRequest is the body for POST /api/v1/services/papers/extract.
type extractRequest struct {
	FileKey string `json:"file_key"`
}

// QuestionCandidate is one auto-extracted question from a past paper.
type QuestionCandidate struct {
	Order        int      `json:"order"`
	PromptText   string   `json:"prompt_text"`
	Marks        float64  `json:"marks"`
	QuestionType string   `json:"question_type"` // "short" | "long" | "mcq"
	Options      []string `json:"options,omitempty"`
	SourcePage   int      `json:"source_page,omitempty"`
}

// PaperExtractHandler runs heuristic question extraction on a stored paper.
// Stage A: regex-based — teacher MUST review the candidates before publishing.
func PaperExtractHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "teacher" && role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Permission denied."})
			return
		}
		schoolID, ok := schoolIDFromHeader(r)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing X-User-School-ID."})
			return
		}

		var req extractRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body."})
			return
		}

		path, err := resolvePaperPath(schoolID, req.FileKey)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		ext := strings.ToLower(filepath.Ext(path))
		text, pages, err := extractText(path, ext)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
				"error":  "Failed to extract text: " + err.Error(),
				"status": "failed",
			})
			return
		}

		candidates := extractQuestions(text)

		writeJSON(w, http.StatusOK, map[string]any{
			"file_key":   req.FileKey,
			"page_count": pages,
			"questions":  candidates,
			"status":     "parsed",
		})
	}
}

// ─── Helpers ────────────────────────────────────────────────

// schoolIDFromHeader reads X-User-School-ID and parses it as int.
func schoolIDFromHeader(r *http.Request) (int, bool) {
	raw := r.Header.Get("X-User-School-ID")
	if raw == "" {
		return 0, false
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

// resolvePaperPath validates the file_key belongs to schoolID and returns
// the absolute path on disk. Rejects keys that try to escape the school dir.
func resolvePaperPath(schoolID int, fileKey string) (string, error) {
	fileKey = strings.TrimSpace(fileKey)
	if fileKey == "" {
		return "", fmt.Errorf("file_key is required")
	}
	parts := strings.SplitN(fileKey, "/", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid file_key format")
	}
	keySchool, err := strconv.Atoi(parts[0])
	if err != nil || keySchool != schoolID {
		return "", fmt.Errorf("file does not belong to your school")
	}
	filename := parts[1]
	// Reject path traversal — filename must be a simple <uuid>.<ext>
	if strings.ContainsAny(filename, "/\\") || strings.Contains(filename, "..") {
		return "", fmt.Errorf("invalid file_key")
	}
	return filepath.Join(papersRoot(), strconv.Itoa(schoolID), "papers", filename), nil
}

// isAllowedPaperType returns true for .pdf and .docx only.
func isAllowedPaperType(ext, _ string) bool {
	return ext == ".pdf" || ext == ".docx"
}

// resolveMime returns the canonical mime type for the extension.
func resolveMime(ext string) string {
	switch ext {
	case ".pdf":
		return mimePDF
	case ".docx":
		return mimeDOCX
	}
	return "application/octet-stream"
}

// newUUID returns a hex-encoded 16-byte random id (32 chars).
func newUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// countPages returns the page count for a PDF; returns 0 for .docx (no concept of pages without rendering).
func countPages(path, ext string) (int, error) {
	if ext != ".pdf" {
		return 0, nil
	}
	f, reader, err := pdf.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	return reader.NumPage(), nil
}

// extractText returns the full plain text + page count for a PDF or DOCX.
func extractText(path, ext string) (string, int, error) {
	switch ext {
	case ".pdf":
		return extractPDFText(path)
	case ".docx":
		text, err := extractDocxText(path)
		return text, 0, err
	}
	return "", 0, fmt.Errorf("unsupported extension %s", ext)
}

// extractPDFText pulls plain text from every page of a PDF.
func extractPDFText(path string) (string, int, error) {
	f, reader, err := pdf.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()

	var sb strings.Builder
	pages := reader.NumPage()
	for i := 1; i <= pages; i++ {
		p := reader.Page(i)
		if p.V.IsNull() {
			continue
		}
		content, err := p.GetPlainText(nil)
		if err != nil {
			continue
		}
		sb.WriteString(content)
		sb.WriteString("\n")
	}
	return sb.String(), pages, nil
}

// extractDocxText reads word/document.xml from the .docx zip and concatenates
// all <w:t> text runs, separating paragraphs with newlines.
func extractDocxText(path string) (string, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return "", err
	}
	defer zr.Close()

	var docFile *zip.File
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			docFile = f
			break
		}
	}
	if docFile == nil {
		return "", fmt.Errorf("not a valid .docx (missing word/document.xml)")
	}

	rc, err := docFile.Open()
	if err != nil {
		return "", err
	}
	defer rc.Close()

	dec := xml.NewDecoder(rc)
	var sb strings.Builder
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "t" {
				var content string
				if err := dec.DecodeElement(&content, &t); err == nil {
					sb.WriteString(content)
				}
			} else if t.Name.Local == "p" {
				sb.WriteString("\n")
			}
		}
	}
	return sb.String(), nil
}

// ─── Question extractor (heuristic, Stage A) ────────────────

var (
	// Lines like "1." / "1)" / "Question 1" / "Q1." at the start of a line.
	rxQuestionStart = regexp.MustCompile(`(?m)^\s*(?:Question\s+|Q)?(\d+)[\.\)]\s+(.*)$`)
	// Marks markers like "[5]", "(10 marks)", "[5 marks]", "(2)".
	rxMarks = regexp.MustCompile(`[\[\(]\s*(\d+(?:\.\d+)?)\s*(?:marks?)?\s*[\]\)]`)
	// MCQ option lines starting with A. / A) / (A) etc.
	rxOption = regexp.MustCompile(`(?m)^\s*[\(]?([A-E])[\)\.]\s+(.+)$`)
)

// extractQuestions runs heuristics over the full paper text and returns
// candidate questions in order. Teachers must review/edit before publishing.
func extractQuestions(text string) []QuestionCandidate {
	text = strings.ReplaceAll(text, "\r\n", "\n")

	matches := rxQuestionStart.FindAllStringSubmatchIndex(text, -1)
	if len(matches) == 0 {
		return []QuestionCandidate{}
	}

	candidates := make([]QuestionCandidate, 0, len(matches))
	for i, m := range matches {
		start := m[0]
		var end int
		if i+1 < len(matches) {
			end = matches[i+1][0]
		} else {
			end = len(text)
		}

		segment := strings.TrimSpace(text[start:end])
		if segment == "" {
			continue
		}

		// Header line gives us the number; rest is the prompt body.
		headerMatch := rxQuestionStart.FindStringSubmatch(segment)
		if headerMatch == nil {
			continue
		}
		number, _ := strconv.Atoi(headerMatch[1])

		// Strip the leading number marker so prompt starts with the question text.
		body := rxQuestionStart.ReplaceAllString(segment, "$2")
		body = strings.TrimSpace(body)

		marks := 1.0
		if mm := rxMarks.FindStringSubmatch(body); mm != nil {
			if parsed, err := strconv.ParseFloat(mm[1], 64); err == nil && parsed > 0 {
				marks = parsed
			}
		}

		options, qType := detectMCQ(body)
		// Trim options out of the prompt text for cleanliness.
		prompt := body
		if qType == "mcq" {
			if idx := rxOption.FindStringIndex(prompt); idx != nil {
				prompt = strings.TrimSpace(prompt[:idx[0]])
			}
		}

		// Long vs short heuristic: longer prompts or 5+ marks → "long".
		if qType != "mcq" {
			if marks >= 5 || len(prompt) > 200 {
				qType = "long"
			} else {
				qType = "short"
			}
		}

		// Cap prompt length so a runaway segment doesn't blow up the response.
		if len(prompt) > 2000 {
			prompt = prompt[:2000]
		}

		candidates = append(candidates, QuestionCandidate{
			Order:        number,
			PromptText:   prompt,
			Marks:        marks,
			QuestionType: qType,
			Options:      options,
		})
	}
	return candidates
}

// detectMCQ scans a question body for at least 3 option lines (A./B./C.).
// Returns the option texts (without the letter prefix) and "mcq" if found,
// or nil + "" if no MCQ structure is detected.
func detectMCQ(body string) ([]string, string) {
	matches := rxOption.FindAllStringSubmatch(body, -1)
	if len(matches) < 3 {
		return nil, ""
	}
	letters := map[string]bool{}
	options := make([]string, 0, len(matches))
	for _, m := range matches {
		letter := strings.ToUpper(m[1])
		if letters[letter] {
			continue
		}
		letters[letter] = true
		options = append(options, strings.TrimSpace(m[2]))
	}
	if len(options) < 3 {
		return nil, ""
	}
	return options, "mcq"
}
