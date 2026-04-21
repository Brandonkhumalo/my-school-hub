# Online Admission Microservices

This folder contains a dedicated admission stack designed for world-class online submissions across schools.

## Services

1. `go-admissions-api` (Go + Echo)
- Low-RAM public and reviewer API
- Per-school online submission toggle
- Application window enforcement
- Required-document validation
- Reviewer assignment
- Status workflow (`submitted`, `under_review`, `accepted`, `rejected`, `waitlisted`)
- Immutable status history trail

2. `django-admissions-ops` (Python + Django)
- School admin-friendly admissions configuration
- Form template and field metadata management
- Compliance profile controls (retention, deletion, export, consent)
- Django Admin support for operations teams

## Local Run

```bash
cd microservices/online-admission
docker compose -f docker-compose.online-admission.yml up --build
```

## Gateway Routes

When started via the root `docker-compose.yml`, gateway routes are:

- `/api/v1/admissions/*` -> Go admissions API
- `/api/v1/admissions/admin/*` -> Django admissions ops

## Example Requests

Create/update school admission config:

```bash
curl -X PUT http://localhost:8080/api/v1/admissions/schools/demo-school/config \
  -H "Content-Type: application/json" \
  -d '{
    "online_submissions_enabled": true,
    "applications_open_at": "2026-04-01T00:00:00Z",
    "applications_close_at": "2026-07-31T23:59:59Z",
    "required_documents": ["id_document", "transcript"]
  }'
```

Submit an application:

```bash
curl -X POST http://localhost:8080/api/v1/admissions/schools/demo-school/applications \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Amina",
    "last_name": "Dube",
    "email": "amina@example.com",
    "program_choice": "Grade 8",
    "documents": ["id_document", "transcript"],
    "payload": {
      "date_of_birth": "2013-03-10",
      "guardian_name": "R. Dube"
    }
  }'
```
