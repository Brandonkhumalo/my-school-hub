# My School Hub Backend Onboarding Guide

This document is for new backend developers joining **My School Hub**.  
Its goal is to help you understand the backend microservices architecture quickly and become productive on day 1.

## 1. What You Are Working On

My School Hub backend is a **Go + Django microservices system**:

- **Django** is the core domain layer (business rules, ORM, DRF APIs, admin).
- **Go Gateway** is the API edge (JWT validation, routing, rate limiting, audit logging).
- **Go Workers** handles high-throughput bulk CSV imports.
- **Go Services** handles report PDFs, PayNow, email, WhatsApp.
- **Celery + Redis** handles async/background tasks on the Django side.

## 2. High-Level Architecture

```text
Client
  -> Go Gateway (:8080)
      -> Django API (:8000)                # default route
      -> Go Workers (:8081)                # /api/v1/bulk/*
      -> Go Services (:8082)               # report card, PayNow, /api/v1/services/*

Django + Go services share:
  - PostgreSQL (production) / SQLite (local dev option)
  - Redis (cache + Celery broker)
```

In production, Nginx terminates SSL and forwards API traffic to the Gateway.

## 3. Repo Map (Backend)

```text
my-school-hub/
  go-gateway/
    main.go        # upstream routing rules
    auth.go        # JWT validation + injected identity headers
    audit.go       # buffered write audit logs
    db.go

  go-workers/
    main.go        # health + bulk endpoints
    import_students.go
    import_results.go
    import_fees.go

  go-services/
    main.go        # health + report/payments/comms endpoints
    report_card.go
    paynow.go
    email.go
    whatsapp.go
    config.go

  School_system/
    School_system/urls.py   # main Django URL map + docs + health
    users/                  # auth, school, superadmin, audit domain
    academics/              # academics + student/parent/teacher portals
    finances/               # fee/payment/invoice/paynow domain
    staff/                  # HR domain
```

## 4. Request Routing Rules (Critical)

Gateway routing rules are defined in `go-gateway/main.go`.

- `/api/v1/bulk/*` -> **Go Workers**
- `/api/v1/finances/payments/paynow/*` -> **Go Services**
- `/api/v1/services/*` -> **Go Services**
- `/api/v1/academics/students/{id}/report-card/` -> **Go Services**
- everything else -> **Django**

### Why this matters
If you add a new endpoint and it should run in Go, you must:

1. implement handler in the right Go service,
2. add route in that service's `main.go`,
3. update Gateway routing logic if the path family is new.

## 5. Auth and Identity Propagation

### External auth model
- Clients send `Authorization: Bearer <token>`.
- Gateway validates JWT and checks token blacklist.

### Identity headers injected by Gateway
After successful auth, gateway sets:

- `X-Gateway-Auth: true`
- `X-User-ID`
- `X-User-Role`
- `X-User-School-ID` (when available)

### Internal service trust model
Go Workers and Go Services reject non-gateway traffic for protected endpoints.  
They require `X-Gateway-Auth=true` and a user id header.

Exceptions:
- `/health` is public in Go services.
- PayNow callback endpoint in Go Services allows provider callbacks.

## 6. Service Responsibilities

### Django (`School_system`)
- Primary REST API and most business logic.
- Multi-tenant data model (school-scoped).
- DRF docs and schema.
- Admin panel (`/django-admin/`).
- Portal APIs: students, parents, teachers.
- Celery task producer/consumer patterns.

### Go Gateway (`go-gateway`)
- JWT validation before requests hit Django.
- Token blacklist synchronization from DB.
- Role/school identity header propagation.
- In-memory per-IP rate limiting.
- Buffered audit writes to `users_auditlog`.
- Reverse proxy dispatch to upstream services.

### Go Workers (`go-workers`)
- CSV imports for:
  - students
  - results
  - fees
- Streams file rows and performs batch DB writes.
- Admin-only workflows enforced via propagated role header.

### Go Services (`go-services`)
- PDF report card generation.
- PayNow initiate/callback/status flows.
- Email send endpoint.
- WhatsApp send endpoint.

### Celery + Redis
- Async and periodic jobs for Django-side workflows.
- Redis used as broker/cache depending on environment config.

## 7. API Entry Points You Should Know

### Health checks
- Gateway: `GET /health/` (through gateway)
- Django: `GET /health/` (internal service health endpoint)
- Workers: `GET /health`
- Services: `GET /health`

### Public docs / schema (Django)
- `GET /api/v1/docs/`
- `GET /api/v1/schema/`
- `GET /api/v1/redoc/`

### API roots (Django)
- `GET /api/v1/`

### Auth namespace (Django)
- `/api/v1/auth/*`

### Domain namespaces (Django)
- `/api/v1/academics/*`
- `/api/v1/finances/*`
- `/api/v1/staff/*`
- `/api/v1/library/*`
- `/api/v1/students/*`
- `/api/v1/parents/*`
- `/api/v1/teachers/*`

### Go-owned endpoint families
- `/api/v1/bulk/*` (Workers)
- `/api/v1/services/*` (Services)
- `/api/v1/finances/payments/paynow/*` (Services)
- `/api/v1/academics/students/{id}/report-card/` (Services)

## 8. Local Development Quickstart

### Prerequisites
- Docker + Docker Compose
- Node 20+ (frontend builds)
- Go 1.22+ (if running Go services directly)
- Python 3.11+ (if running Django directly)

### Recommended path (full stack in containers)

1. Create env file:

```bash
cp School_system/.env.example School_system/.env
```

2. Start services:

```bash
docker compose up --build
```

3. Verify:

```bash
curl http://localhost:8080/health/
curl http://localhost:8080/api/v1/
```

4. Open docs:

- `http://localhost:8080/api/v1/docs/`

### Useful commands

```bash
# All logs
docker compose logs -f

# Specific services
docker compose logs -f gateway
docker compose logs -f web
docker compose logs -f workers
docker compose logs -f services
docker compose logs -f celery

# Service status
docker compose ps

# Django shell/migrations
docker compose exec web python manage.py migrate
docker compose exec web python manage.py shell
```

## 9. End-to-End Request Flow Examples

### Example A: Standard API (Django-owned)
`GET /api/v1/students/dashboard/stats/`

1. Request hits Gateway.
2. Gateway validates JWT and injects identity headers.
3. Gateway proxies to Django.
4. Django authorizes by role/school and returns response.

### Example B: Bulk import (Workers-owned)
`POST /api/v1/bulk/students`

1. Request hits Gateway with JWT.
2. Gateway authenticates and forwards to Workers.
3. Workers verifies `X-Gateway-Auth` + role (`admin`).
4. Workers streams CSV and batch-inserts rows.
5. Response returns counts and row-level errors.

### Example C: Report card PDF (Services-owned)
`GET /api/v1/academics/students/{id}/report-card/`

1. Gateway routes directly to Go Services.
2. Services validates gateway headers.
3. Services queries DB, generates PDF, returns file response.

## 10. How To Add Features Safely

### If feature is CRUD/business rules heavy
Implement in Django first unless there is proven performance need.

### If feature is high-latency external I/O or heavy compute
Prefer Go Services or Go Workers.

### If adding a new Go endpoint family
- Add route in target Go service.
- Add routing rule in Gateway.
- Add docs note in this file and verify via curl.

### If changing auth behavior
- Update `go-gateway/auth.go` and validate all downstream services still receive required headers.

## 11. Debugging Playbook

### 401 from Workers/Services
- Check request passed through Gateway.
- Confirm `X-Gateway-Auth` and `X-User-ID` are present.
- Confirm token is valid and not blacklisted.

### Endpoint returns 404 unexpectedly
- Check if route belongs to Django vs Go.
- Verify Gateway route conditions in `go-gateway/main.go`.

### Slow requests
- Identify service owner first (Gateway logs + path).
- For CSV and PDF/payment flows, inspect Workers/Services logs.
- For CRUD flows, inspect Django query behavior.

### Migration/startup issues
- Review `School_system/entrypoint.sh` behavior: collectstatic + migrate + gunicorn startup.

## 12. Environment Variables (Most Relevant)

Defined in `School_system/.env` (template: `School_system/.env.example`).

Critical:
- `SECRET_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `ECR_REGISTRY` (deployment)

Gateway:
- `GATEWAY_PORT`
- `DJANGO_UPSTREAM`
- `GO_WORKERS_UPSTREAM`
- `GO_SERVICES_UPSTREAM`

Go Services:
- `SERVICES_PORT`
- `PAYNOW_RESULT_URL`
- `PAYNOW_RETURN_URL`
- `ResendEmailApiKey`
- `ResendFromEmail`
- `WHATSAPP_API_URL`
- `WHATSAPP_ACCESS_TOKEN`

Go Workers:
- `WORKERS_PORT`

Django runtime:
- `WEB_CONCURRENCY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

## 13. New Developer First Week Checklist

1. Run backend locally with Docker and verify health/docs.
2. Trace one request per service type:
   - Django-owned endpoint
   - Workers bulk endpoint
   - Services endpoint
3. Read these files in order:
   - `go-gateway/main.go`
   - `go-gateway/auth.go`
   - `School_system/School_system/urls.py`
   - `go-workers/main.go`
   - `go-services/main.go`
4. Make one small change in each layer (Django view, Gateway route, Go handler).
5. Validate with curl and compose logs.

## 14. Source of Truth for Endpoint Details

For exact request/response contracts, use:

- Swagger/OpenAPI docs at `/api/v1/docs/`
- Django URL configs under `School_system/*/urls.py`
- Go service route registrations in each `main.go`

This onboarding guide focuses on architecture and ownership so new backend engineers can quickly understand where changes belong.
