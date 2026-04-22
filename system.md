# My School Hub — System Overview

**Last Updated:** 22 April 2026  
**Stack:** Django 5.2 + React 19 + Vite 7 (pure Django/React — no Go layer)

---

## Architecture

| Layer        | Technology                                              |
|--------------|---------------------------------------------------------|
| Frontend     | React 19.2, Vite 7.3, React Router 7.13, Tailwind CSS  |
| Backend      | Django 5.2, Django REST Framework 3.16                  |
| Auth         | Custom JWT (HS256, 30-day access / 60-day refresh) + 2FA TOTP |
| Database     | SQLite (dev) / PostgreSQL (prod) — per-school FK isolation |
| Async Tasks  | Celery + django_celery_results                          |
| Storage      | django-storages (S3-compatible for media/logos)         |
| Payments     | PayNow Zimbabwe (per-school credentials, real-time polling) |
| API Schema   | drf-spectacular (OpenAPI 3)                             |

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

## Essential Commands

```bash
# Frontend
npm run dev          # Vite dev server on port 5000 (proxies /api → :8000)
npm run build

# Backend
cd School_system
python manage.py runserver
python manage.py makemigrations && python manage.py migrate
python manage.py populate_demo_data
python manage.py generate_parents
```

---

## Known Technical Debt

| Item | Risk |
|------|------|
| WhatsApp PIN flow: serializer exposes `pin`/`confirm_pin` but code reads `whatsapp_pin` | Runtime error on PIN set |
| Payment status enums: `'fully paid'` used in callback vs model choices `paid` | Silent status mismatch |
| Superadmin secret has hardcoded fallback default | Security risk in prod |
| School `admin_password` stored in plaintext | Must be hashed before enterprise rollout |
| No automated test suite for Django views | Regressions require manual verification |
| `Assignment` model uses `teacher` field; some views filter on `created_by` | QuerySet returns empty silently |

---

## Frontend Dependencies

```
react@19.2.4            react-dom@19.2.4
react-router-dom@7.13.0
chart.js@4.5.1          react-chartjs-2@5.3.1
lucide-react@1.8.0
react-hot-toast@2.6.0
vite@7.3.1              eslint@9.39.2
```
