# My School Hub - Tishanyq Digital

## Project Overview

Multi-tenant SaaS school management platform serving six user roles: Student, Parent, Teacher, Admin, HR/Accountant, and Tishanyq Super-Admin. Covers academics (classes, subjects, results, timetables), finances (fees, payments, invoices), messaging, and WhatsApp integration.

## Tech Stack

| Layer     | Technology                                           |
|-----------|------------------------------------------------------|
| Frontend  | React 19, Vite 7, React Router 7, Tailwind CSS      |
| Backend   | Django 5.2, Django REST Framework 3.16               |
| Auth      | Custom JWT (HS256, 30-day access / 60-day refresh)   |
| Database  | SQLite (dev) — multi-tenant via School FK on models  |
| Messaging | WhatsApp Business API integration                    |

## Project Structure

```
src/                          # React frontend
  components/                 # Reusable UI (Layout, Header, RequireAuth, etc.)
  context/AuthContext.jsx     # Global auth state (React Context + localStorage)
  pages/{role}/               # Page components grouped by role
  services/apiService.jsx     # Centralized API client (all backend calls)
  App.jsx                     # Route definitions

School_system/                # Django backend
  School_system/              # Project config (settings.py, urls.py)
  users/                      # Auth, CustomUser, School models, JWT token
  academics/                  # Students, Teachers, Classes, Results, Timetables
  finances/                   # Fees, Payments, Invoices, Reports
  staff/                      # HR, Departments, Staff attendance
  whatsapp_intergration/      # WhatsApp session/message handling
```

## Key Files

- Entry point (frontend): `src/main.jsx:1-15`
- Route definitions: `src/App.jsx`
- API service (all fetch/create methods): `src/services/apiService.jsx`
- Auth context & useAuth hook: `src/context/AuthContext.jsx`
- Protected route wrapper: `src/components/RequireAuth.jsx`
- JWT token implementation: `School_system/users/token.py`
- Custom user model (roles, school FK): `School_system/users/models.py:54-73`
- Django settings (apps, auth, REST config): `School_system/School_system/settings.py`
- Main URL router: `School_system/School_system/urls.py`
- Academic models (Student, Teacher, Class, etc.): `School_system/academics/models.py`
- Finance models (Fee, Payment, Invoice): `School_system/finances/models.py`

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
python manage.py createsuperuser        # Create admin user
python manage.py populate_demo_data     # Seed demo data
python manage.py generate_parents       # Generate parent accounts
```

### Running Both Together
Start backend (`python manage.py runserver`) and frontend (`npm run dev`) in separate terminals. Vite proxies `/api` requests to Django at `localhost:8000` (configured in `vite.config.js`).

## API Structure

All endpoints prefixed with `/api/`:
- `/api/auth/` — Registration, login, logout, profile, school management (`users/urls.py`)
- `/api/academics/` — Subjects, classes, students, results, timetables (`academics/urls.py`)
- `/api/finances/` — Fees, payments, invoices, reports (`finances/urls.py`)
- `/api/students/` — Student portal endpoints (`academics/student_urls.py`)
- `/api/parents/` — Parent portal endpoints (`academics/parent_urls.py`)
- `/api/teachers/` — Teacher portal endpoints (`academics/teacher_urls.py`)
- `/api/messages/` — Parent-teacher messaging (`academics/messaging_urls.py`)

Full endpoint documentation: `BACKEND_API_DOCUMENTATION.md`

## User Roles

| Role       | Pages Directory      | Access Level                        |
|------------|----------------------|-------------------------------------|
| admin      | `src/pages/admin/`   | Full school management              |
| teacher    | `src/pages/teacher/` | Classes, marks, attendance          |
| student    | `src/pages/student/` | View grades, timetable, homework    |
| parent     | `src/pages/parent/`  | Track children, fees, messaging     |
| superadmin | `src/pages/tishanyq/`| Multi-school tenant management      |

## Multi-Tenancy

Every data model has a `school` ForeignKey. Views filter querysets by `request.user.school` to isolate tenant data. Schools can be suspended via `is_suspended` flag, blocking admin login.

## Additional Documentation

Check these files for detailed guidance on specific topics:

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — Backend/frontend design patterns, conventions, model relationships, view patterns, form handling, data fetching
- [Backend API Documentation](BACKEND_API_DOCUMENTATION.md) — Full endpoint reference with request/response formats
- [Hosting Guide](Host.md) — Deployment and hosting configuration
