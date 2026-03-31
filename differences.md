# Go+Django Branch vs Main Branch

**2 commits, +3915 / -377 lines across 39 files**

---

## Three New Go Microservices

### 1. `go-gateway/` — API Gateway
- `go-gateway/main.go` — HTTP reverse proxy routing requests to Django or Go services
- `go-gateway/auth.go` — JWT validation and authentication middleware
- `go-gateway/audit.go` — Request/response audit logging
- `go-gateway/db.go` — Database connection for gateway-level queries

### 2. `go-services/` — Offloaded Services
Performance-critical operations moved from Django/Celery to Go:
- `go-services/paynow.go` — PayNow Zimbabwe payment processing
- `go-services/email.go` — Email sending service
- `go-services/report_card.go` — PDF report card generation
- `go-services/whatsapp.go` — WhatsApp message handling

### 3. `go-workers/` — Bulk Import Workers
CSV bulk import operations (previously Celery tasks) moved to Go:
- `go-workers/import_students.go` — Bulk student CSV import
- `go-workers/import_results.go` — Bulk results CSV import
- `go-workers/import_fees.go` — Bulk fees CSV import

---

## Django Changes
- `School_system/users/gateway_auth.py` — New auth module for gateway-forwarded requests
- `School_system/users/views.py` — Adjusted to work behind the Go gateway
- `School_system/email_service.py` — Modified to delegate to Go email service
- `School_system/whatsapp_intergration/tasks.py` — Updated to route through Go services
- `School_system/School_system/settings.py` — Config changes for gateway integration
- `School_system/academics/views.py` — Minor adjustments
- Removed migrations `0012` and `0013` (parent schools, is_priority on subject)
- Removed `is_priority` field from `School_system/academics/models.py`
- Timetable generator refactored in `School_system/academics/timetable_generator.py`

## Frontend Changes
- `src/services/apiService.jsx` — API calls routed through Go gateway
- Removed `src/pages/admin/AdminSubjects.jsx`

## Infrastructure
- `docker-compose.yml` & `docker-compose.prod.yml` — Added Go gateway, services, and workers containers
- `Dockerfile` — Updated for new architecture
- Each Go service has its own Dockerfile
- `DEPLOYMENT.md` & `README.md` — Updated documentation

---

**Summary**: This branch introduces a Go-based microservices layer — a gateway for routing/auth/audit, dedicated Go services for PayNow/email/PDF/WhatsApp, and Go workers for bulk CSV imports — while Django remains the core CRUD/API backend.
