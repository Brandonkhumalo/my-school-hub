# My School Hub — System Overview

**Last Updated:** 22 April 2026  
**Stack:** Django 5.2 + Go services + React 19 + Vite 7

---

## Architecture

### Production (Docker / AWS)

```
Internet → Go Gateway (schoolhub-gateway)
               ↓
         Django API (schoolhub-web)   ←→   Go Services (schoolhub-services)
               ↓                                   ↓
          PostgreSQL (RDS)              Go Workers (schoolhub-workers)
          ElastiCache (Redis)           Celery async tasks
          S3 (media/logos)
```

| Layer           | Technology                                              | Docker Image           |
|-----------------|---------------------------------------------------------|------------------------|
| Frontend        | React 19.2, Vite 7.3, React Router 7.13, Tailwind CSS  | `schoolhub-web`        |
| API / Domain    | Django 5.2, Django REST Framework 3.16                  | `schoolhub-web`        |
| Gateway         | Go — request routing, auth caching, rate limiting       | `schoolhub-gateway`    |
| Services        | Go — high-throughput / low-latency processing paths     | `schoolhub-services`   |
| Workers         | Go — async background jobs, messaging, queue consumers  | `schoolhub-workers`    |
| Auth            | Custom JWT (HS256) + 2FA TOTP — issued by Django, validated by Go gateway | — |
| Database        | SQLite (dev) / PostgreSQL RDS (prod)                    | —                      |
| Cache / Sessions| Redis (ElastiCache in prod)                             | —                      |
| Async Tasks     | Celery + django_celery_results                          | —                      |
| Storage         | django-storages → S3 (media, logos, reports)            | —                      |
| Payments        | PayNow Zimbabwe (per-school credentials, real-time polling) | —                  |
| API Schema      | drf-spectacular (OpenAPI 3)                             | —                      |

### Why Django + Go Hybrid

Django is the system of record — it owns all domain models, business logic, migrations, and the REST API. Go handles the paths where Django would be a bottleneck:

| Concern | Handled by |
|---|---|
| Request routing and auth token validation at scale | Go gateway |
| High-throughput async jobs (messaging, notifications) | Go workers |
| Low-latency service calls between internal components | Go services |
| All data writes, business rules, report generation | Django |

---

## User Roles

| Role            | Pages | Directory                  |
|-----------------|-------|----------------------------|
| admin           | 34    | `src/pages/admin/`         |
| teacher         | 12    | `src/pages/teacher/`       |
| student         | 15    | `src/pages/student/`       |
| parent          | 10    | `src/pages/parent/`        |
| hr              | 10+   | `src/pages/hr/`            |
| accountant      | 8     | `src/pages/accountant/`    |
| security        | 5     | `src/pages/security/`      |
| cleaner         | 4     | `src/pages/cleaner/`       |
| librarian       | 4     | `src/pages/librarian/`     |
| sports_director | 3     | `src/pages/sports/`        |
| superadmin      | 6     | `src/pages/tishanyq/`      |

---

## Frontend Pages by Role

### Admin (34 pages)
AdminDashboard, AdminStudents, AdminTeachers, AdminParents, AdminUsers, AdminClasses, AdminTimetable, AdminSubjects, AdminAssessmentPlans, AdminResults, AdminInvoices, AdminPayments, AdminAnnouncements, AdminComplaints, AdminParentLinkRequests, AdminExtras, AdminStaff, AdminSettings, AdminPermissions, AdminReportConfig, AdminFees, AdminReports, AdminSuspensions, AdminPromotions, AdminActivities, AdminLibrary, AdminHealth, AdminBoarding, AdminDiscipline, AdminAnalytics, AdminAuditLog, AdminAtRiskStudents, AdminPastStudents, TwoFactorCompliance

### Student (15 pages)
StudentDashboard, StudentProfile, StudentSubmissions, StudentMarks, StudentHomework, StudentCalendar, StudentTimetable, StudentTeachers, StudentAnnouncements, StudentAttendance, StudentResults, StudentFeeSummary, StudentActivities, StudentLibrary, StudentBoarding

### Teacher (12 pages)
TeacherDashboard, TeacherMarks, TeacherSubjectFeedback, TeacherAttendance, TeacherMessages, TeacherHomework, TeacherResults, TeacherStudents, TeacherClasses, TeacherConferences, TeacherComplaints, TeacherPerformance

### Parent (10 pages)
ParentDashboard, ParentChildren, ParentPerformance, ParentFees, ParentMessages, ParentHomework, ParentResults, ParentFeeSummary, ParentConferences, ParentBoarding

### HR (10+ pages)
HRDashboard, HRStudents, HRTeachers, HRParents, HRStaff, HRClasses, HRSubjects, HRResults, HRFees, HRReports, HRLeaves, HRPayroll, HRAttendance, HRMeetings, HRVisitorLogs, HRIncidents, HRCleaningSchedules, HRBoarding, HRDiscipline, HRPromotions, HRSuspensions, HRComplaints, HRAnnouncements, HRTimetable, HRAnalytics, HRAuditLog

### Accountant (8 pages)
AccountantDashboard, AccountantFees, AccountantPayments, AccountantInvoices, AccountantReports, AccountantPayroll, AccountantAccounting, AccountantProfile

### Security (5 pages)
SecurityDashboard, SecurityVisitorLog, SecurityIncidents, SecurityAttendance, SecurityProfile

### Cleaner (4 pages)
CleanerDashboard, CleanerTasks, CleanerAttendance, CleanerProfile

### Librarian (4 pages)
LibrarianDashboard, LibrarianBooks, LibrarianLoans, LibrarianProfile

### Sports Director (3 pages)
SportsDashboard, ActivityManagement, SportsAnalysis

### Tishanyq SuperAdmin (6 pages)
TishanyqLogin, TishanyqRegister, TishanyqDashboard, TishanyqHome, CreateSchool, SchoolsList

---

## Backend Apps & Models

### `users` (15 models)
School, CustomUser (11 roles), BlacklistedToken, TwoFactorAuthConfig, TrustedDevice, TwoFactorBackupCode, SchoolSettings, ReportCardConfig, ReportCardTemplate, SubjectGroup, AuditLog, Notification, HRPermissionProfile, HRPagePermission, AccountantPermissionProfile, AccountantPagePermission

### `academics` (56+ models)
**Core:** Subject, Class, Student, DietaryFlag, Teacher, Parent, ParentChildLink, Result, AssessmentPlan, SubjectTermFeedback, Timetable  
**Activities/Sports:** SportsHouse, Activity, ActivityEnrollment, ActivityEvent, MatchSquadEntry, TrainingAttendance, HousePointEntry  
**Attendance:** ClassAttendance, SubjectAttendance  
**Communication:** Announcement, AnnouncementDismissal, ParentTeacherMessage, Complaint  
**Assignments:** Assignment, AssignmentSubmission, Homework  
**Discipline/Health:** DisciplinaryRecord, HealthRecord, ClinicVisit, AtRiskAlert  
**Promotions/Awards:** PromotionRecord, Accolade, StudentAccolade  
**Events:** Suspension, SchoolEvent  
**Report Cards:** ReportCardGeneration, ReportCardApprovalRequest, ReportCardRelease  
**Conferences:** ConferenceSlot, ConferenceBooking  
**Boarding (15 models):** Dormitory, DormAssignment, MealMenu, MealAttendance, DormRollCall, LightsOutRecord, ExeatRequest, ExeatMovementLog, MedicationSchedule, TuckWallet, TuckTransaction, LaundrySchedule, LostItemReport, PrepAttendance, DormInspectionScore, StudentWellnessCheckIn

### `finances` (12 models)
FeeType, StudentFee, Payment, Invoice, StudentPaymentRecord, PaymentTransaction, PaymentIntent, FinancialReport, SchoolExpense, SchoolFees, TransportFeePreference, AdditionalFee

### `staff` (11 models)
Department, Staff, VisitorLog, IncidentReport, CleaningSchedule, CleaningTask, Attendance, Leave, Payroll, PayrollPaymentRequest, Meeting

### `library` (3 models)
Book, BookLoan, BookLoanRequest

### `whatsapp_intergration` (5 models — disabled at URL router)
WhatsAppUser, WhatsAppSession, WhatsAppMessage, WhatsAppPayment, WhatsAppMenu

---

## API Endpoints

All endpoints prefixed `/api/v1/`. ~250+ distinct endpoints total.

| Mount path            | Purpose                                                    |
|-----------------------|------------------------------------------------------------|
| `/auth/`              | Auth, profile, school mgmt, 2FA, notifications, audit log  |
| `/academics/`         | Subjects, classes, students, results, timetable, announcements, suspensions, promotions, activities, health, discipline, assessment plans, report card workflow |
| `/students/`          | Student portal (13 endpoints)                              |
| `/teachers/`          | Teacher portal (26 endpoints)                              |
| `/parents/`           | Parent portal (14 endpoints)                               |
| `/messages/`          | Parent-teacher messaging (8 endpoints)                     |
| `/boarding/`          | Full boarding ops (21 endpoints)                           |
| `/finances/`          | Fees, payments, invoices, PayNow, expenses                 |
| `/staff/`             | HR: staff, leaves, payroll, incidents, cleaning, meetings  |
| `/library/`           | Books, loans, requests                                     |

---

## Reusable Components (`src/components/`)

Layout, Header, Sidebar, RequireAuth, RequireBoardingAccess, DashboardCard, DataTable, PaginationControls, LoadingSpinner, NotificationBell, TwoFactorLogin, TwoFactorSetup, TrustedDevices, SearchableSelect, AssessmentPlanCard, WhatsAppButton

---

## Key Features

### Two-Factor Authentication (2FA)
- TOTP-based (authenticator app) with backup codes
- Per-user trusted device management (IP + User-Agent)
- Admin 2FA compliance dashboard (`AdminTwoFactorCompliance`)
- School-level enforcement toggle in `SchoolSettings`
- Endpoints: `/api/v1/auth/2fa/*`

### Report Card System
- Workflow: Admin opens generation → teachers submit `SubjectTermFeedback` → `ReportCardApprovalRequest` → admin approves/rejects → `ReportCardRelease` publishes
- `ReportCardConfig`: 25+ layout/branding fields (logo, typography, content toggles for attendance, position, averages, effort grades, QR code, conduct, activities, fees status)
- `ReportCardTemplate`: Global shareable presets
- `SubjectGroup`: Core / Electives / Languages groupings for PDF layout
- Download endpoint generates PDF per student

### PayNow Zimbabwe Integration
- Initiate, poll, and callback handling with SHA-512 signature verification
- Per-school `paynow_integration_id` / `paynow_integration_key` in `SchoolSettings`
- Real-time payment status polling on frontend (`/payment/success`, `/payment/failed`)
- `PaymentIntent` model tracks poll URL and provider reference

### Sports & Activities
- `SportsHouse` — house competition system
- `Activity` — sports/clubs/societies with coach assignment
- `ActivityEnrollment` — request/approval workflow
- `ActivityEvent` — training/match/tournament events with squad selection
- `TrainingAttendance`, `HousePointEntry`
- `SportsAnalytics` page with charts (chart.js)
- Sports Director role with dedicated dashboard

### Boarding Module
Full ops for residential schools (gated by `school.accommodation_type`):
Dormitories, bed assignments, roll calls, lights-out, meal menus + attendance, dietary flags, medication schedules, exeat requests + movement logs, tuck wallet, laundry schedules, lost items, prep attendance, dorm inspection scores, wellness check-ins (1–5 mood).

### HR Permissions System
- `HRPermissionProfile.is_root_boss` bypasses all page checks
- `HRPagePermission`: 35 pages × read/write grants
- `AccountantPermissionProfile.is_root_head` + `AccountantPagePermission`: 7 page scopes
- Checked on frontend via `src/utils/hrPermissions.js`

### Audit Log
`AuditLog` records CREATE / UPDATE / DELETE / LOGIN / LOGOUT / SUSPEND / APPROVE with changed fields, IP, HTTP status. Viewable at `/admin/audit-logs`.

### Timetable Generation
Constraint Satisfaction + backtracking + MRV-style heuristic. Conflict detection endpoint returns room/teacher double-bookings.

### Analytics
`AdminAnalytics` page with grade predictions using linear regression + OLS fallback. At-risk student alerts (`AtRiskAlert`) triggered by grade drops or prediction failures.

---

## Multi-Tenancy

Every model has a `school` FK. Three custom managers:
- `TenantAwareManager` — `Model.objects.for_school(school)`
- `SoftDeleteManager` — excludes soft-deleted records
- `TenantSoftDeleteManager` — both combined

School `is_suspended` flag blocks admin login. `accommodation_type` (`day` / `boarding` / `both`) gates boarding features.

---

## Context Providers

### `AuthContext` (`useAuth`)
JWT state, user object (role, school, student_number), login/logout, token refresh.

### `SchoolSettingsContext` (`useSchoolSettings`)
Fetches `GET /api/v1/auth/academic-period/`. Exposes academic period, term dates, grading system, branding (colors, font, logo, motto), finance settings. Applies CSS variables (`--accent`, `--accent-secondary`, `--sidebar-active`, `--font-family`) on load.

### `ThemeContext` (`useTheme`)
Light/dark toggle backed by localStorage.

---

## Middleware Stack (Django)

1. `AuditMiddleware` — writes `AuditLog` on all write operations
2. `HRAccessControlMiddleware` — enforces `HRPagePermission` grants
3. `AccountantAccessControlMiddleware` — enforces `AccountantPagePermission` grants

---

## Security Design

My School Hub is built with a defence-in-depth approach — multiple independent security layers so that no single failure exposes school data. The sections below cover every layer, what is live today, and what is on the security roadmap.

---

### 1. Data Isolation — Every School is an Island

Every single record in the system — students, results, fees, staff, health data, boarding records — carries a `school` foreign key. Three custom database managers enforce this automatically on every query:

| Manager | Behaviour |
|---|---|
| `TenantAwareManager` | All queries pre-filtered to `Model.objects.for_school(school)` |
| `SoftDeleteManager` | Deleted records stay in database but are invisible to queries |
| `TenantSoftDeleteManager` | Both combined — school-scoped and soft-delete safe |

**What this means for schools:** It is architecturally impossible for School A to see School B's data. Tenant isolation is not a permission check — it is enforced at the database query level on every request.

Suspicious schools can also be suspended by the platform operator. A suspended school's admin cannot log in, and all API access is blocked at authentication time.

---

### 2. Authentication — Proving Who You Are

#### JWT Tokens
All sessions use signed JSON Web Tokens (HS256). Tokens carry an expiry timestamp and a type field that is validated on every request. There are no persistent sessions on the server — the signed token is the only credential.

| Token | Lifetime |
|---|---|
| Access token | Configurable (default 24 h) |
| Refresh token | Configurable (default 72 h) |

On logout, the token is written to a `BlacklistedToken` table. Every subsequent request checks this table — a logged-out token is permanently dead even if it has not expired yet.

#### Two-Factor Authentication (2FA)
2FA is built in, not bolted on.

- **TOTP** — works with Google Authenticator, Authy, and any RFC 6238-compatible app
- **Backup codes** — 10 single-use codes generated with `secrets.choice()` (cryptographically secure RNG), stored as Django PBKDF2 hashes — never readable after generation
- **Trusted devices** — once a device passes 2FA, its IP address is remembered; returning from the same IP skips the OTP prompt
- **Backup code audit trail** — every backup code use is logged with timestamp, IP address, and device fingerprint
- **School-level enforcement** — school admins can make 2FA mandatory for all staff from the Settings page
- **2FA compliance dashboard** — admins see a live table of which staff members have 2FA enabled vs. not

Rate limits on 2FA endpoints:
- OTP verification: **5 attempts per minute** per IP
- Backup code verification: **3 attempts per minute** per IP (stricter)

#### Password Security
- Minimum 8 characters enforced at serializer and validator level
- Four Django password validators active: similarity check, minimum length, common-password dictionary, numeric-only block
- Passwords hashed with **PBKDF2-SHA256** — never stored in plaintext
- Password confirmation required on registration and change
- Old password verified before any password change is accepted

#### Login Security
- Rate limited to **5 attempts per minute** per IP — brute-force attacks are blocked at the network level
- Returns `HTTP 429 Too Many Requests` with a clear wait message
- Every successful login is written to the Audit Log with the user's IP address
- Suspended schools see a specific error with contact details — no ambiguous failures

---

### 3. Role-Based Access Control — The Right People See the Right Things

The system has 11 distinct roles, each with its own set of pages and API endpoints. Access is enforced at three independent layers:

```
Request → JWT Authentication → Role Middleware → Endpoint Permission Class → Tenant Filter
```

No single bypass defeats all layers.

#### Standard Roles
Each role maps to a fixed set of API endpoints. A teacher cannot call a finance endpoint. A parent cannot call a staff endpoint. These are hard endpoint-level restrictions enforced on the server — not just hidden buttons in the UI.

#### HR & Accountant Granular Permissions
HR and Accountant roles have an additional permission layer below the role level:

- `HRPermissionProfile` — 35 pages, each with independent `can_read` and `can_write` flags
- `AccountantPermissionProfile` — 7 financial page scopes with the same read/write split
- Root-level HR/Accountant heads bypass page checks and get full access within their domain
- Enforced by `HRAccessControlMiddleware` and `AccountantAccessControlMiddleware` on every request — not just on the frontend

**What this means in practice:** An HR officer can be given read access to payroll but no write access. Another can be allowed to manage leaves but blocked from seeing salary figures. The school admin configures this from the Permissions page — no code changes required.

---

### 4. Full Audit Trail — Every Action Recorded

Every write operation (CREATE, UPDATE, DELETE) and every authentication event (LOGIN, LOGOUT, SUSPEND, APPROVE) is written to the `AuditLog` table automatically by `AuditMiddleware`.

Each log entry records:
- **Who** — user ID, name, role
- **What** — model name, object ID, human-readable description
- **What changed** — JSON diff of before/after field values
- **When** — timestamp, database-indexed
- **Where** — IP address
- **Outcome** — HTTP response status (did it succeed or fail?)

Sensitive fields — passwords, tokens, PINs, secrets — are stripped from the log before writing. The audit log stores *what changed*, not credentials.

School admins view the full audit log at `/admin/audit-logs`.

**What this means for schools:** If a fee record is edited, a student is suspended, or a staff record is deleted, the log shows exactly who did it, from which IP, and at what time. There is no way to take a write action without being recorded.

---

### 5. Payment Security — PayNow Integration

Payment callbacks from PayNow Zimbabwe are cryptographically verified before any payment is recorded:

- **Dual HMAC signature verification** — supports both SHA-256 and SHA-512
- **Constant-time comparison** — `hmac.compare_digest()` instead of `==`, which prevents timing-based attacks that could allow forged signatures
- **Canonical payload construction** — keys sorted deterministically before hashing, preventing payload reordering attacks
- **Per-school credentials** — each school's `paynow_integration_id` and `paynow_integration_key` stored in `SchoolSettings`, never shared between tenants
- **PaymentIntent tracking** — every initiated payment creates a `PaymentIntent` record with a poll URL and provider reference, enabling full reconciliation

A forged or tampered payment callback is rejected before any database write occurs.

---

### 6. Transport & Infrastructure Security

| Protection | Status | Detail |
|---|---|---|
| HTTPS enforcement | **Live** | `SECURE_PROXY_SSL_HEADER` set for reverse proxy; TLS termination at ALB/nginx |
| HSTS | **Live** | 1-year max-age, `includeSubDomains`, `preload` — browsers permanently enforce HTTPS after first visit |
| Secure cookies | **Live** | `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` enabled in production |
| Clickjacking protection | **Live** | `X_FRAME_OPTIONS = 'DENY'` — the app cannot be embedded in iframes on other sites |
| MIME sniffing protection | **Live** | `SECURE_CONTENT_TYPE_NOSNIFF = True` — browsers cannot reinterpret uploaded file types |
| XSS filter header | **Live** | `SECURE_BROWSER_XSS_FILTER = True` |
| CORS whitelist | **Live** | Only `myschoolhub.co.zw` and local dev origins allowed; `CORS_ALLOW_ALL_ORIGINS = False` |
| CSRF protection | **Live** | Django CSRF middleware active; trusted origins explicitly configured |
| No XSS in frontend | **Live** | Zero uses of `dangerouslySetInnerHTML` confirmed across the entire React codebase |
| File upload validation | **Live** | School logo capped at 10 MB with type validation on upload |
| SQL injection | **Live** | 100% Django ORM — no raw SQL strings, no user input interpolated into queries |
| Secret management | **Live** | All secrets loaded from environment via `python-decouple`; no production secrets in source code |
| Redis-backed sessions | **Live** | When Redis available; database-backed fallback — no insecure in-memory sessions |
