# My School Hub - Tishanyq Digital

## Project Overview

Multi-tenant SaaS school management platform serving ten user roles. Covers academics, boarding, finances, library, HR/payroll, messaging, report cards, and WhatsApp integration. Each school is a fully isolated tenant.

## Tech Stack

| Layer      | Technology                                                  |
|------------|-------------------------------------------------------------|
| Frontend   | React 19, Vite 7, React Router 7, Tailwind CSS              |
| Backend    | Django 5.2, Django REST Framework 3.16                      |
| Auth       | Custom JWT (HS256, 30-day access / 60-day refresh)          |
| Database   | SQLite (dev) — multi-tenant via School FK on all models     |
| Task Queue | Celery (email service, async WhatsApp tasks)                |
| Messaging  | WhatsApp Business API integration (built, currently disabled)|
| Payments   | PayNow Zimbabwe integration (per-school credentials)        |

## User Roles

| Role            | Pages Directory          | Access Level                                      |
|-----------------|--------------------------|---------------------------------------------------|
| admin           | `src/pages/admin/`       | Full school management (32 pages)                 |
| teacher         | `src/pages/teacher/`     | Classes, marks, attendance, homework (12 pages)   |
| student         | `src/pages/student/`     | Grades, timetable, homework, boarding (14 pages)  |
| parent          | `src/pages/parent/`      | Children, fees, messaging, conferences (11 pages) |
| hr              | `src/pages/hr/`          | Staff, payroll, leaves, incidents (10 pages)      |
| accountant      | `src/pages/accountant/`  | Fees, invoices, payments, reports (5 pages)       |
| security        | `src/pages/security/`    | Visitor logs, incidents (4 pages)                 |
| cleaner         | `src/pages/cleaner/`     | Cleaning tasks, attendance (3 pages)              |
| librarian       | `src/pages/librarian/`   | Books, loans (3 pages)                            |
| superadmin      | `src/pages/tishanyq/`    | Multi-school tenant management (6 pages)          |

## Project Structure

```
src/
  components/         # Reusable UI components
  context/            # React context providers (Auth, SchoolSettings, Theme)
  pages/{role}/       # Page components grouped by role
  services/
    apiService.jsx    # Centralized API client (all backend calls)
  utils/
    boardingAccess.js # Boarding eligibility helpers
    hrPermissions.js  # HR page-level permission helpers
    dateFormat.js     # Date parsing/formatting (Africa/Harare timezone)
  App.jsx             # Route definitions

School_system/
  School_system/      # Project config (settings.py, urls.py, celery)
  users/              # Auth, School, CustomUser, SchoolSettings, permissions, audit
  academics/          # Core academic models + boarding + all student/teacher/parent logic
  finances/           # Fees, payments, invoices, PayNow
  staff/              # HR: departments, staff, leaves, payroll, incidents, cleaning, meetings
  library/            # Books, loans, fines
  whatsapp_intergration/ # WhatsApp session/message/payment handling
```

## Key Files

### Frontend
- Entry point: `src/main.jsx`
- Route definitions: `src/App.jsx`
- API client: `src/services/apiService.jsx`
- Auth context & `useAuth` hook: `src/context/AuthContext.jsx`
- School settings context & `useSchoolSettings` hook: `src/context/SchoolSettingsContext.jsx`
- Theme (dark/light) context: `src/context/ThemeContext.jsx`
- Protected route wrapper: `src/components/RequireAuth.jsx`
- Boarding route guard: `src/components/RequireBoardingAccess.jsx`
- Dashboard customization page: `src/pages/shared/Customization.jsx`

### Backend
- JWT token implementation: `School_system/users/token.py`
- School & CustomUser models: `School_system/users/models.py:49-159`
- SchoolSettings model: `School_system/users/models.py:169-210`
- ReportCardConfig model: `School_system/users/models.py:205+`
- Permission models (HR, Accountant): `School_system/users/models.py`
- Django settings: `School_system/School_system/settings.py`
- Main URL router: `School_system/School_system/urls.py`
- Academic models (45+ models): `School_system/academics/models.py`
- Finance models: `School_system/finances/models.py`
- Staff/HR models: `School_system/staff/models.py`
- Library models: `School_system/library/models.py`

## Essential Commands

### Frontend
```bash
npm run dev        # Vite dev server on port 5000 (proxies /api to :8000)
npm run build      # Production build
npm run lint       # ESLint
```

### Backend
```bash
cd School_system
python manage.py runserver              # Django dev server on port 8000
python manage.py makemigrations         # Create migrations
python manage.py migrate                # Apply migrations
python manage.py createsuperuser        # Create superadmin user
python manage.py populate_demo_data     # Seed demo data
python manage.py generate_parents       # Generate parent accounts
```

### Running Both Together
Start backend (`python manage.py runserver`) and frontend (`npm run dev`) in separate terminals. Vite proxies `/api` requests to Django at `localhost:8000` (configured in `vite.config.js`).

## API Structure

All endpoints prefixed with `/api/v1/`:

| Mount path          | App file                        | Purpose                                              |
|---------------------|---------------------------------|------------------------------------------------------|
| `/api/v1/auth/`     | `users/urls.py`                 | Registration, login, logout, profile, school mgmt, customization, audit log, notifications |
| `/api/v1/academics/`| `academics/urls.py`             | Subjects, classes, students, results, timetables, announcements, suspensions, promotions, activities, health, discipline, assessment plans, report card workflow |
| `/api/v1/students/` | `academics/student_urls.py`     | Student portal (13 endpoints)                        |
| `/api/v1/teachers/` | `academics/teacher_urls.py`     | Teacher portal (26 endpoints)                        |
| `/api/v1/parents/`  | `academics/parent_urls.py`      | Parent portal (14 endpoints)                         |
| `/api/v1/messages/` | `academics/messaging_urls.py`   | Parent-teacher messaging (8 endpoints)               |
| `/api/v1/boarding/` | `academics/boarding_urls.py`    | Full boarding ops (21 endpoints)                     |
| `/api/v1/finances/` | `finances/urls.py`              | Fees, payments, invoices, PayNow                     |
| `/api/v1/staff/`    | `staff/urls.py`                 | HR: staff, leaves, payroll, incidents, cleaning, meetings |
| `/api/v1/library/`  | `library/urls.py`               | Books, loans                                         |
| `/api/v1/whatsapp/` | `whatsapp_intergration/urls.py` | WhatsApp integration (disabled)                      |

Full endpoint documentation: `BACKEND_API_DOCUMENTATION.md`

## Django Apps & Models

### `users`
School, CustomUser (10 roles), BlacklistedToken, SchoolSettings, ReportCardConfig, ReportCardTemplate, SubjectGroup, AuditLog, Notification, HRPermissionProfile, HRPagePermission, AccountantPermissionProfile, AccountantPagePermission

### `academics` (45+ models)
Subject, Class, Student, Teacher, Parent, ParentChildLink, Result, AssessmentPlan, SubjectTermFeedback, Timetable, Announcement, Complaint, Suspension, SchoolEvent, Assignment, AssignmentSubmission, Homework, WeeklyMessage, ClassAttendance, SubjectAttendance, ParentTeacherMessage, PromotionRecord, ReportCardRelease, ReportCardApprovalRequest, Activity, ActivityEnrollment, ActivityEvent, Accolade, StudentAccolade, ConferenceSlot, ConferenceBooking, DisciplinaryRecord, HealthRecord, ClinicVisit, AtRiskAlert, DietaryFlag, Dormitory, DormAssignment, MealMenu, MealAttendance, DormRollCall, LightsOutRecord, ExeatRequest, ExeatMovementLog, MedicationSchedule, TuckWallet, TuckTransaction, LaundrySchedule, LostItemReport, PrepAttendance, DormInspectionScore, StudentWellnessCheckIn

### `finances`
FeeType, StudentFee, Payment, Invoice, StudentPaymentRecord, PaymentTransaction, PaymentIntent

### `staff`
Department, Staff, VisitorLog, IncidentReport, CleaningSchedule, CleaningTask, Attendance, Leave, Payroll, PayrollPaymentRequest, Meeting

### `library`
Book (with categories), BookLoan (due dates, fines, lost tracking)

### `whatsapp_intergration`
WhatsAppUser, WhatsAppSession, WhatsAppMessage, WhatsAppPayment, WhatsAppMenu

## Multi-Tenancy

Every data model has a `school` ForeignKey. Views filter querysets by `request.user.school` to isolate tenant data. Three custom managers:
- `TenantAwareManager` — `Model.objects.for_school(school)`
- `SoftDeleteManager` — excludes soft-deleted records by default
- `TenantSoftDeleteManager` — combines both

Schools can be suspended via `is_suspended` flag (blocks admin login). School `accommodation_type` controls boarding feature access (`day` / `boarding` / `both`).

## Context Providers

### `AuthContext` (`useAuth`)
JWT auth state, user object (role, school, student_number), login/logout, token refresh.

### `SchoolSettingsContext` (`useSchoolSettings`)
Fetches from `GET /api/v1/auth/academic-period/` on login. Exposes:
- Academic: `currentAcademicYear`, `currentTerm`, `gradingSystem`, `maxStudentsPerClass`
- Calendar: `term1Start/End`, `term2Start/End`, `term3Start/End`
- Identity: `schoolMotto`, `primaryColor`, `secondaryColor`, `fontFamily`, `welcomeMessage`, `logoUrl`
- Finance: `currency`, `lateFeePercentage`, `timezone`

Also applies CSS variables to `document.documentElement` on load: `--accent`, `--accent-secondary`, `--sidebar-active`, `--font-family`.

### `ThemeContext` (`useTheme`)
Light/dark theme toggle backed by localStorage.

## Reusable Components (`src/components/`)

`Layout`, `Header`, `Sidebar` (role-based nav), `RequireAuth`, `RequireBoardingAccess`, `DataTable`, `DashboardCard`, `AssessmentPlanCard`, `PaginationControls`, `SearchableSelect`, `LoadingSpinner`, `NotificationBell`, `WhatsAppButton`

## Utility Helpers (`src/utils/`)

### `boardingAccess.js`
- `isSchoolBoardingEnabled(user)` — checks `accommodation_type`
- `canStudentUseBoarding(user)` — checks role + school + student residence
- `studentResidenceLabel()`, `schoolAccommodationLabel()`

### `hrPermissions.js`
- `getHrPageGrant(user, key)` → `{ read, write }` — reads HRPagePermission or AccountantPagePermission
- `canReadPage(user, key)`, `canWritePage(user, key)`
- Root HR/accountant bypasses all page checks

### `dateFormat.js`
- Handles `DD-MM-YYYY` (API format), ISO `YYYY-MM-DD`, and datetime variants
- `parseDate()`, `toInputDate()`, `formatDate()`, `formatDateTime()`, `formatTime()`, `formatRelative()`
- All timezone-aware for `Africa/Harare`

## Feature Modules

### Dashboard Customization (`/customization`)
Accessible to `admin`, `hr`, `superadmin`. Settings stored in `SchoolSettings`.

| Field            | Effect                                          |
|------------------|-------------------------------------------------|
| `primary_color`  | `--accent` + `--sidebar-active` CSS vars        |
| `secondary_color`| `--accent-secondary` CSS var                    |
| `font_family`    | `--font-family` CSS var applied to `body`       |
| `school_motto`   | Sidebar + report cards                          |
| `welcome_message`| Dashboard greeting text                         |
| `logo`           | ImageField, max 10MB, shown in sidebar/header   |

Frontend also has 8 built-in color presets (sets primary + secondary together).

API: `GET/PUT /api/v1/auth/school/customization/`, logo: `POST /api/v1/auth/school/customization/logo/`

### Report Card System
- **ReportCardConfig** — 25+ fields per school controlling PDF layout, branding, typography, content toggles (attendance, position, class average, effort grade, QR code, conduct, activities, fees status, etc.)
- **ReportCardTemplate** — global shareable presets
- **SubjectGroup** — groups subjects as core/elective/language for grouped display
- **AssessmentPlan** — per-term, per-subject exam structure (papers, tests, assignments with weights and `component_index`)
- **SubjectTermFeedback** — per-student teacher comment + effort grade per subject
- Workflow: teachers submit feedback → admin approves via `ReportCardApprovalRequest` → released via `ReportCardRelease` → parents view

### Boarding Module
Full school boarding operations via `GET /api/v1/boarding/` (21 endpoints):
- Dormitories & bed assignments, roll call, lights-out records
- Meal menus & attendance, dietary flags, medication schedules
- Exeat requests with sign-in/out movement logs
- Tuck wallet (student shop account) with transactions
- Laundry schedules, lost item reporting
- Prep session attendance, dorm inspection scores
- Wellness check-ins (1–5 mood scoring)

Gated by `RequireBoardingAccess` — only available if `school.accommodation_type` is `boarding` or `both`. Student access also checks `student.residence`.

### HR / Staff Module
Staff positions: teacher, admin, hr, accountant, principal, secretary, maintenance, security, cleaner, librarian.
- Leave types: annual, sick, maternity, emergency, unpaid
- Payroll with allowances/deductions + `PayrollPaymentRequest` approval workflow
- Visitor logs, incident reports
- Cleaning schedules & task assignment
- Staff attendance, meetings with participants

### Permissions System
- **HRPermissionProfile**: `is_root_boss` bypasses all checks; otherwise uses `HRPagePermission` (35 pages, read/write grants)
- **AccountantPermissionProfile**: `is_root_head` bypasses; otherwise `AccountantPagePermission` (dashboard, fees, invoices, payments, reports, payroll, expenses)
- Checked via `hrPermissions.js` utilities on the frontend

### Payments
Accepted methods: cash, bank transfer, card, mobile money, EcoCash, InnBucks, WhatsApp, PayNow.
PayNow credentials (`paynow_integration_id`, `paynow_integration_key`) are stored per school in `SchoolSettings`.

### Library
Books with categories (textbook, fiction, reference, science, history, math, literature, etc.), loans with due dates, fine tracking, lost book recording.

### WhatsApp Integration (Disabled)
Fully modelled: phone-based registration with PIN, session/conversation state, incoming/outgoing messages (text, image, document, location), fee payment via WhatsApp, interactive role-based menus. Disabled at the URL router level.

### Audit Log
`AuditLog` records CREATE/UPDATE/DELETE/LOGIN/LOGOUT/SUSPEND/APPROVE actions with changed fields, IP address, and HTTP response status. Viewable on `AdminAuditLog` page.

### Notifications
In-app `Notification` model with 7 types: announcement, message, fee_reminder, homework, attendance, result, general. Displayed via `NotificationBell` component.

### Academics
- **Attendance**: `ClassAttendance` (daily, class-level) and `SubjectAttendance` (per-lesson, per-subject)
- **Promotions**: `PromotionRecord` (promote/repeat/graduate decisions by admin), with preview and history
- **Activities & Sports**: `Activity`, `ActivityEnrollment` (request/approval), `ActivityEvent`, `Accolade`, `StudentAccolade`
- **Conferences**: `ConferenceSlot` (teacher availability), `ConferenceBooking` (parent scheduling)
- **Discipline & Welfare**: `DisciplinaryRecord`, `HealthRecord`, `ClinicVisit`, `AtRiskAlert`
- **Bulk imports**: CSV import for students and results
- **Parent linking**: `ParentChildLink` with admin-approval workflow

## Additional Documentation

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — Backend/frontend design patterns, conventions, model relationships, view patterns, form handling, data fetching
- [Backend API Documentation](BACKEND_API_DOCUMENTATION.md) — Full endpoint reference with request/response formats
- [Hosting Guide](Host.md) — Deployment and hosting configuration
