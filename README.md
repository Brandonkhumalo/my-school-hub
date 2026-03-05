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
- OpenAPI docs at `/api/v1/docs/` (drf-spectacular / Swagger UI)
- Progressive Web App (PWA) — installable, offline-capable
- Celery + Redis for async tasks (WhatsApp sends, report generation, bulk imports)
- Redis caching on heavy list endpoints
- Docker-ready backend

---

## Tech Stack

| Layer      | Technology                                           |
|------------|------------------------------------------------------|
| Frontend   | React 19, Vite 7, React Router 7, Tailwind CSS      |
| Backend    | Django 5.2, Django REST Framework 3.16               |
| Auth       | Custom JWT (HS256, 30-day access / 60-day refresh)   |
| Database   | SQLite (dev) / PostgreSQL (production)               |
| Cache      | Redis (django-redis)                                 |
| Task Queue | Celery + Redis                                       |
| Payments   | PayNow Zimbabwe SDK                                  |
| Messaging  | WhatsApp Business API (Meta Graph API)               |
| AI         | scikit-learn (grade predictions)                     |
| PDF        | ReportLab                                            |

---

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
└── School_system/                # Django backend
    ├── School_system/            # Project config (settings, urls, middleware)
    ├── users/                    # Auth, CustomUser, School, SchoolSettings, AuditLog
    ├── academics/                # Students, Teachers, Classes, Results, Timetables, ML
    ├── finances/                 # Fees, Payments, Invoices, PayNow service
    ├── staff/                    # HR, Departments, Staff, Leave, Payroll
    └── whatsapp_intergration/    # WhatsApp session/message handling
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

Interactive API documentation: `http://localhost:8000/api/v1/docs/`

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
