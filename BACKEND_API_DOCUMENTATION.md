# My School Hub Backend Onboarding Guide

This document is for backend engineers joining **My School Hub**.  
Its goal is to give you enough system-level understanding to debug confidently, ship safely, and make architecture decisions with context.

## Read This First (Mental Model)

Treat the backend as a **single API product** with **4 execution layers**:

1. **Edge Layer (Go Gateway)**: accepts internet traffic, validates JWT, rate-limits, logs audit events, and chooses which upstream handles the request.
2. **Core Domain Layer (Django/DRF)**: owns most business logic and almost all CRUD APIs.
3. **Compute/Integration Layer (Go Workers + Go Services)**:
   - Workers: bulk import pipelines
   - Services: external integrations / specialized processing (payments, comms, generated artifacts)
4. **Async Layer (Celery + Redis)**: delayed/background jobs for Django workflows.

If you remember one rule: **Gateway decides “who handles the request”; each service decides “is this user allowed?”**

## Engineering Onboarding Outcome

After reading this guide, you should be able to:

1. Explain the full request lifecycle from client to DB and back.
2. Determine endpoint ownership (Gateway vs Django vs Workers vs Services).
3. Diagnose common auth/routing/tenant bugs quickly.
4. Add new endpoints without breaking trust boundaries or observability.

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

## 2.5 Runtime Topology and Data Plane

### Control plane vs data plane
- **Control plane**: configuration and routing decisions (`main.go`, env vars, middleware stacks).
- **Data plane**: request handling path and DB/cache I/O under load.

### Shared state and coupling points
- **PostgreSQL**:
  - system of record for Django domain entities
  - gateway blacklist source (`users_blacklistedtoken`)
  - gateway audit sink (`users_auditlog`)
  - Go Workers/Services domain reads/writes where needed
- **Redis**:
  - Celery broker/result backend/cache when enabled
  - optional; Django has local-memory fallback for some environments

### Key implication
Because all layers share the same database, schema changes are cross-service contracts.  
Migration design must consider Django ORM and direct SQL usage from Go.

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
- everything else -> **Django**

### Why this matters
If you add a new endpoint and it should run in Go, you must:

1. implement handler in the right Go service,
2. add route in that service's `main.go`,
3. update Gateway routing logic if the path family is new.

### Routing invariants
- Routing is prefix-based and deterministic.
- Default route is Django; Go routes are opt-in by prefix.
- When adding a Go endpoint outside existing prefixes, no gateway update means traffic silently goes to Django and returns 404/405.

## 5. Auth and Identity Propagation

### External auth model
- Clients send `Authorization: Bearer <token>`.
- Gateway validates JWT and checks token blacklist before protected traffic proceeds.

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

### Django authentication mode switch

Django has two auth modes, controlled by `USE_GO_GATEWAY` in settings:

- `USE_GO_GATEWAY=true`:
  - DRF uses `users.gateway_auth.GatewayAuthentication`.
  - It first checks `X-Gateway-Auth=true`, then resolves `X-User-ID` to `CustomUser`.
  - If gateway header is absent, it can still fall back to JWT auth (standalone/dev compatibility).
- `USE_GO_GATEWAY=false`:
  - DRF uses direct JWT auth via `users.token.JWTAuthentication`.

### Trust boundary (very important)

The gateway header approach is secure only if Django/Workers/Services are not directly exposed to public traffic.
In production, keep those services internal/private and expose only Gateway (or Nginx -> Gateway).

### JWT and identity invariants
- Gateway and Django must share the same `SECRET_KEY` (token verification contract).
- Gateway only injects identity headers after successful JWT + user lookup.
- Downstream services must never trust user identity from unverified public traffic.
- Logout correctness depends on blacklist sync interval (eventual consistency window).

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

## 6.5 Middleware and Execution Order (Critical for Debugging)

### Gateway middleware chain (outer -> inner)
1. Rate limiting
2. CORS
3. Audit middleware
4. Auth middleware
5. Router (Django/Workers/Services proxy)

Effect:
- Audit sees `X-User-*` headers because auth runs inside the chain before request returns.
- Write operations are logged after response status is known.

### Django middleware behavior
- Django appends its own `AuditMiddleware` only when `USE_GO_GATEWAY=false`.
- With gateway enabled, audit responsibility shifts to Go gateway.
- HR and Accountant access-control middleware enforce page-level permissions after user authentication is resolved.

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

## 8.5 Request Lifecycle Deep Dive (What Happens Internally)

### Step 1: Edge receives request
- Client calls `https://.../api/v1/...` with bearer token.
- Request reaches Gateway.

### Step 2: Gateway pre-processing
- CORS handling
- Rate limiting (in-memory token bucket per IP)
- Auth middleware:
  - skips explicit public paths (`/api/v1/auth/login`, `/api/v1/docs`, etc.)
  - validates JWT signature and claims (`type=access_token`)
  - checks in-memory blacklist (synced from `users_blacklistedtoken`)
  - resolves user metadata from DB/cache (`users_customuser`)
  - injects identity headers (`X-Gateway-Auth`, `X-User-ID`, `X-User-Role`, `X-User-School-ID`)

### Step 3: Gateway routing decision
- Path-based dispatch:
  - bulk path -> Workers
  - paynow/services path -> Services
  - default -> Django

### Step 4: Upstream authorization and business logic
- Django:
  - DRF auth builds `request.user`
  - view permissions and role checks run
  - tenant/school scoping rules apply
- Workers/Services:
  - validate trusted gateway headers for protected endpoints
  - perform specialized job (imports/payments/comms/artifacts)

### Step 5: Response and observability
- Response returns through Gateway to client.
- Audit records and service logs are available for tracing/debugging.

## 8.6 Failure Modes and How They Manifest

### Misrouted endpoint
- Symptom: unexpected Django 404/405 for a route you implemented in Go.
- Root cause: missing gateway prefix rule.

### Header trust break
- Symptom: Workers/Services always return 401 despite valid JWT.
- Root cause: request bypassed gateway or `X-Gateway-Auth` not propagated.

### Token accepted after logout (short window)
- Symptom: recently logged-out token still works briefly.
- Root cause: blacklist sync interval window in gateway.

### Role/school mismatch
- Symptom: 403 in Django with authenticated user.
- Root cause: tenant/role permission checks in Django middleware/view permissions.

### Shared DB schema drift
- Symptom: Go SQL errors after Django migration.
- Root cause: direct SQL assumptions in Go not updated with schema changes.

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

### Example C: Services endpoint (Go Services-owned)
`POST /api/v1/services/email/send` (example family)

1. Gateway validates JWT and injects identity headers.
2. Gateway routes `/api/v1/services/*` to Go Services.
3. Services checks gateway headers/authorization rules.
4. Services performs external integration and returns status payload.

### Example D: PayNow callback (public provider callback)
`POST /api/v1/finances/payments/paynow/callback/...`

1. Payment provider calls callback URL.
2. Gateway routes to Go Services by path family.
3. Callback endpoint validates provider payload/signature rules (not user JWT).
4. Services updates payment state in DB.

## 9.5 Authentication Journey (Login -> Every Request)

### Login/token issue
1. Client posts credentials to `/api/v1/auth/login/` (public path at gateway).
2. Request is proxied to Django auth view.
3. Django verifies credentials and returns access token (and 2FA challenge when required).

### Subsequent protected call
1. Client sends bearer token.
2. Gateway validates token and injects identity context.
3. Upstream service uses that context for authorization and tenant checks.

### Logout/blacklist
1. Logout action blacklists token in `users_blacklistedtoken`.
2. Gateway blacklist sync refreshes periodically.
3. Blacklisted token is rejected at gateway before reaching business endpoints.

## 9.6 Multi-Tenancy Model (How Schools Are Isolated)

- `School` is the tenant boundary.
- `CustomUser.school_id` ties user identity to a tenant.
- Gateway propagates `X-User-School-ID`.
- Django domain logic filters by school/role to prevent cross-tenant reads/writes.
- Superadmin workflows are explicit exceptions and should be isolated by dedicated permissions.

## 9.7 Report Card Flow (Cross-Service)

`GET /api/v1/academics/students/{id}/report-card/`

1. Gateway routes this path to Go Services (explicit handler exists there).
2. Services validates gateway headers and authorization context.
3. Services fetches required data, generates PDF, returns file response.
4. Failures usually come from data integrity gaps (missing marks/config/templates), not routing.

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

### Engineering change checklist (recommended)
1. Confirm endpoint owner (Django/Workers/Services).
2. Confirm gateway routing impact.
3. Confirm auth mode and header requirements.
4. Confirm tenant-scoping expectations.
5. Add/update logs and docs.
6. Validate with `curl` through gateway, not direct internal port.
7. Verify 401/403/404 behavior explicitly.

## 11. Debugging Playbook

### 401 from Workers/Services
- Check request passed through Gateway.
- Confirm `X-Gateway-Auth` and `X-User-ID` are present.
- Confirm token is valid and not blacklisted.

### 401/403 from Django but token seems valid
- Confirm `USE_GO_GATEWAY` matches deployment mode.
- Verify gateway and Django share the same JWT `SECRET_KEY`.
- Check user is active and role/school constraints permit the action.

### Endpoint returns 404 unexpectedly
- Check if route belongs to Django vs Go.
- Verify Gateway route conditions in `go-gateway/main.go`.

### Slow requests
- Identify service owner first (Gateway logs + path).
- For CSV and PDF/payment flows, inspect Workers/Services logs.
- For CRUD flows, inspect Django query behavior.

### Migration/startup issues
- Review `School_system/entrypoint.sh` behavior: collectstatic + migrate + gunicorn startup.

### Fast triage sequence
1. Identify endpoint owner by path and gateway routing rules.
2. Reproduce via gateway URL with bearer token.
3. Check gateway logs for auth/routing/audit behavior.
4. Check target service logs for handler-level errors.
5. If data-related, inspect DB state and recent migrations.

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

## 14. Deep-Dive Reading Path (Recommended Order)

1. `go-gateway/main.go`
2. `go-gateway/auth.go`
3. `go-gateway/audit.go`
4. `School_system/School_system/settings.py`
5. `School_system/users/gateway_auth.py`
6. `School_system/School_system/middleware.py`
7. `School_system/School_system/urls.py`
8. `go-workers/main.go`
9. `go-services/main.go`

## 15. Source of Truth for Endpoint Details

For exact request/response contracts, use:

- Swagger/OpenAPI docs at `/api/v1/docs/`
- Django URL configs under `School_system/*/urls.py`
- Go service route registrations in each `main.go`

This onboarding guide focuses on architecture and ownership so new backend engineers can quickly understand where changes belong.
