# My School Hub

**My School Hub** is a multi-tenant SaaS school management platform built by [Tishanyq Digital](https://tishanyq.co.zw). It serves six user roles — Student, Parent, Teacher, Admin, HR/Accountant, and Tishanyq Super-Admin — covering academics, finance, messaging, and HR all in one system.

---

## Features

### Academics
- Class and subject management
- Student enrolment and profiles
- Teacher assignment with subject weighting (CA / Exam)
- Results entry, grade calculation, and report card PDF generation
- Timetable management with conflict detection
- Assignment creation and student submission tracking
- Attendance marking and student attendance portal
- AI-powered grade predictions (scikit-learn linear regression)
- Parent-child link requests with admin approval

### Finance
- Fee type and student fee management
- Multi-payment support with running balance tracking
- Invoice generation and PDF receipt printing
- PayNow Zimbabwe integration (EcoCash / OneMoney / web) — credentials stored per school
- Bulk fee import via CSV
- Financial summary reports

### HR & Staff
- Department and staff profile management
- Staff attendance tracking
- Leave request workflow (apply → HR/admin review → approve/reject)
- Payroll management with net salary calculation
- Staff meetings scheduling

### Communication
- Parent-teacher messaging
- WhatsApp Business API integration (session-based messaging, PIN login for parents/students)
- School-wide announcements

### Administration
- Multi-tenant isolation — all data scoped by school FK
- School suspension (blocks non-superadmin login)
- Per-school settings (academic year, term, grading system, currency, timezone, PayNow credentials)
- Full audit log (every create/update/delete/login action)
- Soft delete on key models (Student, Teacher, Subject, Staff, etc.)
- Global search across students, teachers, subjects, classes

### Developer / Platform
- **Go + Django microservices** — Go Gateway, Workers, and Services for performance-critical paths
- **Online Admission stack** — Go Echo admissions intake + Django admissions ops for templates/compliance
- OpenAPI docs at `/api/v1/docs/` (drf-spectacular / Swagger UI)
- Progressive Web App (PWA) — installable, offline-capable
- Celery + Redis for async tasks, with Go goroutine fallback for email/WhatsApp
- Redis caching on heavy list endpoints
- Docker Compose for dev and prod (6 containers, ~200MB total RAM)

---

## Tech Stack

| Layer        | Technology                                           |
|--------------|------------------------------------------------------|
| Frontend     | React 19, Vite 7, React Router 7, Tailwind CSS      |
| Backend      | Django 5.2, Django REST Framework 3.16               |
| Go Services  | Go 1.22 — API Gateway, Bulk Workers, PDF/PayNow/Email/WhatsApp |
| Auth         | Custom JWT (HS256, 30-day access / 60-day refresh)   |
| Database     | SQLite (dev) / PostgreSQL (production)               |
| Cache        | Redis (django-redis)                                 |
| Task Queue   | Celery + Redis (with Go goroutine fallback)          |
| Payments     | PayNow Zimbabwe (Go native implementation)           |
| Email        | Resend API (Go goroutine-based sending)              |
| Messaging    | WhatsApp Business API (Go goroutine-based sending)   |
| AI           | scikit-learn (grade predictions)                     |
| PDF          | go-fpdf (5-10x faster than ReportLab)                |

---

## Architecture

```
Internet → Nginx (SSL) → Go Gateway (:8080)
                          ├─→ Django API (:8000)        — core business logic
                          ├─→ Go Workers (:8081)        — bulk CSV imports
                          └─→ Go Services (:8082)       — PDF, PayNow, email, WhatsApp
                          ├─→ Go Admissions (:8091)     — online application intake/workflow
                          └─→ Django Admissions Ops (:8092) — form templates/compliance
```

**Why Go + Django?** Django handles the ORM, admin, and business logic. Go handles the performance-critical parts:
- **PDF generation** — go-fpdf generates report cards 5-10x faster than ReportLab, using goroutines instead of blocking Gunicorn workers
- **External API calls** — PayNow (5-15s), email (3-10s), and WhatsApp (15s) are handled by goroutines (~4KB stack each vs ~8MB per Python thread)
- **Bulk imports** — CSV streaming with batch PostgreSQL inserts via pgx
- **API Gateway** — JWT validation, rate limiting, and audit logging at ~15MB RAM

Django delegates to Go automatically when `GO_SERVICES_URL` is set. If Go services are down, Django falls back to handling email/WhatsApp directly.

## Quick Start (Local Dev)

1. Create backend env file:
```bash
cp School_system/.env.example School_system/.env
```
2. Configure frontend API base URL for your environment:
```bash
# Development
cat .env.development
# VITE_API_BASE_URL=http://localhost:8000/api/v1
```
3. Start services:
```bash
docker compose up --build
```
4. Verify health:
```bash
curl http://localhost:8080/health/
curl http://localhost:8080/api/v1/
```
5. Open Swagger docs:
- `http://localhost:8080/api/v1/docs/`

Useful commands:
```bash
docker compose ps
docker compose logs -f gateway
docker compose logs -f web
docker compose logs -f workers
docker compose logs -f services
```

## Project Structure

```
my-school-hub/
├── src/                          # React frontend
│   ├── components/               # Reusable UI (Layout, Header, RequireAuth)
│   ├── context/AuthContext.jsx   # Global auth state
│   ├── pages/
│   │   ├── admin/                # Admin role pages
│   │   ├── teacher/              # Teacher role pages
│   │   ├── student/              # Student role pages
│   │   ├── parent/               # Parent role pages
│   │   ├── hr/                   # HR role pages
│   │   ├── tishanyq/             # Super-admin pages
│   │   └── payment/              # PayNow return pages
│   ├── services/apiService.jsx   # Centralised API client
│   └── App.jsx                   # Route definitions
│
├── go-gateway/                   # Go API Gateway (~15MB RAM)
│   ├── main.go                   # Routing, rate limiting, CORS
│   ├── auth.go                   # JWT validation, token blacklist, user cache
│   ├── audit.go                  # Buffered audit logging
│   └── Dockerfile                # Multi-stage build → Alpine (~10MB image)
│
├── go-workers/                   # Go Bulk Workers (~10MB RAM)
│   ├── main.go                   # HTTP server + auth middleware
│   ├── import_students.go        # Student CSV streaming + batch insert
│   ├── import_results.go         # Results CSV handler
│   ├── import_fees.go            # Fees CSV handler
│   └── Dockerfile
│
├── go-services/                  # Go Services (~12MB RAM)
│   ├── main.go                   # HTTP server, routing, config
│   ├── report_card.go            # PDF report card generation (go-fpdf)
│   ├── paynow.go                 # PayNow Zimbabwe API client + handlers
│   ├── email.go                  # Resend email service (goroutine-based)
│   ├── whatsapp.go               # WhatsApp message sending (goroutine-based)
│   └── Dockerfile
│
├── School_system/                # Django backend
│   ├── School_system/            # Project config (settings, urls, middleware)
│   ├── users/                    # Auth, CustomUser, School, SchoolSettings, AuditLog
│   ├── academics/                # Students, Teachers, Classes, Results, Timetables, ML
│   ├── finances/                 # Fees, Payments, Invoices, PayNow views
│   ├── staff/                    # HR, Departments, Staff, Leave, Payroll
│   └── whatsapp_intergration/    # WhatsApp session/message handling
│
├── docker-compose.yml            # Dev: builds all services with local Redis
└── docker-compose.prod.yml       # Prod: ECR images, external RDS/Redis
└── microservices/online-admission/ # New admission microservice stack
```

---

## API

All endpoints are prefixed with `/api/v1/`:

| Prefix | Description |
|---|---|
| `/api/v1/auth/` | Registration, login, logout, profile, school management |
| `/api/v1/academics/` | Subjects, classes, students, results, timetables |
| `/api/v1/students/` | Student portal endpoints |
| `/api/v1/parents/` | Parent portal endpoints |
| `/api/v1/teachers/` | Teacher portal endpoints |
| `/api/v1/finances/` | Fees, payments, invoices, PayNow |
| `/api/v1/staff/` | HR, departments, leave, payroll |
| `/api/v1/messages/` | Parent-teacher messaging |
| `/api/v1/services/` | Internal: email sending, WhatsApp sending (Go) |
| `/api/v1/bulk/` | Bulk CSV imports: students, results, fees (Go) |

Interactive API documentation: `http://localhost:8080/api/v1/docs/`

## Developer Docs

- Backend architecture onboarding: `BACKEND_API_DOCUMENTATION.md`
- Deployment guide: `DEPLOYMENT.md`

## Frontend API Base URL

- `src/services/apiService.jsx` uses:
  - `import.meta.env.VITE_API_BASE_URL`, fallback `/api/v1`
- Environment files:
  - `.env.development` -> `http://localhost:8000/api/v1`
  - `.env.production` -> `https://myschoolhub.co.zw/api/v1`
- With Vite dev proxy, using relative `/api/v1` also works.

---

## User Roles

| Role | Access |
|---|---|
| `superadmin` | All schools — tenant management |
| `admin` | Full school management |
| `teacher` | Classes, marks, attendance, assignments |
| `hr` | Staff management, leave, payroll |
| `accountant` | Fees, payments, invoices |
| `student` | View grades, timetable, homework, attendance |
| `parent` | Track children, fees, messaging |

---

## Contact

**Brandon Khumalo**
- Phone/whatsapp: +263 78 853 9918
- Email: brandonkhumz40@gmail.com
- Website: https://brandonportfoliodev.netlify.app/
