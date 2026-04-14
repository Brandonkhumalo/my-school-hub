# Go Codebase Overview (My School Hub)

This project has 3 separate Go services (each with its own `go.mod`):
- `go-gateway` (API gateway + auth + audit + routing)
- `go-workers` (bulk CSV imports)
- `go-services` (report cards, payments, email, WhatsApp)

## go-gateway

### `go-gateway/db.go`
- Creates a PostgreSQL connection pool using `pgxpool`.
- Uses `context.WithTimeout` for startup safety.
- Verifies DB connectivity with `pool.Ping()`.
- Sets conservative pool settings for low-memory environments.

### `go-gateway/main.go`
- Entry point for gateway service.
- Loads env config (`SECRET_KEY`, `DATABASE_URL`, upstream URLs, CORS origins).
- Creates reverse proxies:
  - Django upstream
  - Go Workers upstream
  - Go Services upstream
- Routes by path:
  - `/api/v1/bulk/*` -> Go Workers
  - `/api/v1/finances/payments/paynow/*` -> Go Services
  - `/api/v1/services/*` -> Go Services
  - `/api/v1/academics/students/{id}/report-card/` -> Go Services
  - everything else -> Django
- Builds middleware chain:
  - `AuthMiddleware`
  - `AuditMiddleware`
  - `CORSMiddleware`
  - `RateLimitMiddleware`
- Starts HTTP server with timeouts and graceful shutdown on `SIGINT/SIGTERM`.

### `go-gateway/auth.go`
- Handles authentication and user context propagation.
- `isPublicPath()` skips auth for login/register/docs/static paths.
- `AuthMiddleware()`:
  - Parses Bearer token
  - Validates JWT signature/type
  - Checks in-memory blacklist
  - Resolves user from cache/DB
  - Injects `X-User-ID`, `X-User-Role`, `X-User-School-ID`, `X-Gateway-Auth`
- Includes two in-memory components protected by mutexes:
  - `Blacklist` (synced from DB on interval)
  - `UserCache` (TTL cache with periodic eviction)

### `go-gateway/audit.go`
- Captures write requests (POST/PUT/PATCH/DELETE) and logs audits.
- `AuditMiddleware()`:
  - Skips docs/static/admin paths
  - Reads JSON body (up to 64KB) for change tracking
  - Removes sensitive keys (`password`, `token`, etc.)
  - Captures response status via custom `statusRecorder`
  - Creates `AuditEntry`
- `AuditLogger`:
  - Buffers entries in memory
  - Flushes by batch size or timer
  - Writes in DB transaction asynchronously

## go-workers

### `go-workers/main.go`
- Entry point for bulk import service.
- Connects to DB and registers endpoints:
  - `POST /api/v1/bulk/students`
  - `POST /api/v1/bulk/results`
  - `POST /api/v1/bulk/fees`
- Wraps handlers in `AuthCheckMiddleware` requiring gateway headers.
- Supports `/health`.
- Graceful shutdown with signals.

### `go-workers/import_students.go`
- Streams CSV uploads for bulk student creation.
- Role check: only `admin`.
- Preloads class lookup map (`class_name -> class_id`) once.
- Reads CSV row-by-row (not loading full file into memory).
- Processes in batches of 100 with transactions:
  - Inserts user into `users_customuser`
  - Inserts student into `academics_student`
- Collects per-row errors and returns summary JSON.
- Utility helpers:
  - `mapColumns()`, `getCol()`
  - `generateStudentNumber()`
  - `writeJSON()`, `collectRows()`

### `go-workers/import_fees.go`
- Streams CSV for student fee assignment.
- Role check: `admin` or `accountant`.
- Preloads:
  - student map (`student_number -> student_id`)
  - fee type map (`fee_name -> fee_type_id`)
- Creates missing fee types when needed.
- Batch inserts into `finances_studentfee` with `ON CONFLICT DO NOTHING`.
- Returns created count + row-level errors.

### `go-workers/import_results.go`
- Streams CSV for exam results.
- Role check: `admin` or `teacher`.
- Preloads:
  - student map
  - subject map
  - subject -> teacher map
- For teacher requests, resolves current teacher id from `X-User-ID`.
- Batch upserts into `academics_result` with conflict key:
  - `(student_id, subject_id, exam_type, academic_term, academic_year)`
- Updates score/max/teacher/percentage on conflict.
- Returns created count + row-level errors.

## go-services

### `go-services/config.go`
- Loads environment configuration for service integrations:
  - DB URL
  - PayNow URLs
  - Resend email settings
  - WhatsApp API settings

### `go-services/db.go`
- Creates PostgreSQL pool with `pgxpool`.
- Uses timeout + ping checks.

### `go-services/main.go`
- Entry point for general services.
- Registers routes:
  - `GET /api/v1/academics/students/{studentID}/report-card/`
  - `POST /api/v1/finances/payments/paynow/initiate/`
  - `POST /api/v1/finances/payments/paynow/result/` (callback)
  - `GET /api/v1/finances/payments/paynow/status/`
  - `POST /api/v1/services/email/send`
  - `POST /api/v1/services/whatsapp/send`
- `AuthCheckMiddleware` enforces gateway auth except:
  - `/health`
  - PayNow callback route

### `go-services/report_card.go`
- Generates PDF report cards (`fpdf`) for a student.
- Validates role (`admin`, `teacher`, `parent`) and school context.
- Fetches:
  - school name
  - student info
  - results by year/term
  - attendance stats
- Builds styled PDF:
  - header and student info table
  - result rows with percentage and grade (`calcGrade`)
  - footer with generation date
- Returns `application/pdf` as downloadable attachment.
- Includes `BulkReportCardHandler` scaffold (currently advisory response).

### `go-services/paynow.go`
- Implements PayNow API integration.
- Core helpers:
  - `paynowHash()` (SHA512 uppercase hash for request signing)
  - `parsePayNowResponse()` (URL-encoded response parsing)
  - `initiateWebPayment()` and `initiateMobilePayment()`
  - `checkPaymentStatus()`
- `PayNowInitiateHandler`:
  - Validates role
  - Loads per-school PayNow credentials from DB
  - Builds payment reference/email
  - Initiates web/mobile payment and returns URLs/instructions
- `PayNowCallbackHandler`:
  - Receives server callback from PayNow
  - Marks payment as fully paid when status is paid
  - Triggers async receipt emails
- `PayNowStatusHandler` polls PayNow poll URL for current status.

### `go-services/email.go`
- Internal transactional email service using Resend API.
- `EmailSendHandler`:
  - Validates payload (`to`, `subject`, `html` or template)
  - Deduplicates recipients
  - Renders templates if requested
  - Queues sending in goroutine (returns 202 immediately)
- `sendViaResend()` sends actual HTTP request to Resend.
- Contains reusable HTML email shell + several templates:
  - payment received
  - fee assigned
  - parent link approved
  - result entered
  - homework uploaded
  - announcement
  - teacher message

### `go-services/whatsapp.go`
- Internal WhatsApp sender using Meta WhatsApp Business API.
- `WhatsAppSendHandler` validates request and queues sending in goroutine.
- `sendWhatsAppWithRetry()`:
  - Sends text message to `/messages`
  - Retries with exponential backoff
  - Logs success/failure

## Key Go Concepts This Codebase Teaches

- `package main` and multi-file package organization.
- `net/http` handlers and middleware composition.
- Route patterns (`"METHOD /path"` and `r.PathValue()` in Go 1.22 style).
- `context.WithTimeout` for DB and request safety.
- PostgreSQL access using `pgxpool` (`Query`, `QueryRow`, `Exec`, transactions).
- Concurrency with goroutines (`go func()`, fire-and-forget background work).
- Shared in-memory state with `sync.Mutex` / `sync.RWMutex`.
- Batch processing for performance (CSV imports + buffered audit writes).
- Error handling and explicit JSON responses.
- Graceful shutdown with OS signals and `http.Server.Shutdown`.
