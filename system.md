# My School Hub - Senior Engineering Interview Review

**Scope:** Full codebase review with focus on `origin/Go+Django` (new main system direction)  
**Date:** 12 April 2026

## Executive Summary
My School Hub is a strong, real-world school operations platform with meaningful scope: academics, attendance, finance, communication, staffing, and reporting. The hybrid architecture (Django + Go services + React) demonstrates system design maturity beyond a standard CRUD app.

As a senior interviewer, I would rate this project highly for breadth, practical integrations, and operational thinking. I would also expect clear ownership of reliability and security hardening gaps.

## Architecture Snapshot
- **Frontend:** React
- **Core backend:** Django REST
- **Performance/infra services:** Go gateway, Go workers, Go services
- **Data:** PostgreSQL + Redis
- **Integrations:** PayNow, WhatsApp, email services
- **Domain modules:** users, academics, finances, staff, library

## Senior Interview Feedback
### Strengths
- Strong product coverage mapped to real school workflows.
- Good domain decomposition and role-based flows.
- Practical use of Go for high-throughput paths.
- Real operational features: imports, reports, notifications, audit patterns.
- Evidence of algorithmic implementation (timetable CSP + heuristics, analytics).

### Risks to Address Before Enterprise Rollout
- Schema/field drift across modules can cause runtime failures.
- Secret and credential handling needs hardening for production security standards.
- Test coverage in Go layer is currently weak (no `_test.go` files found).
- Configuration management should be fully environment-driven.

## High-Priority Findings (Validated)
1. Parent-link logic calls `link.parent.schools.add(...)` while `Parent.schools` is absent in `origin/Go+Django` model.
2. Teacher submission endpoints use `Assignment.created_by` filters, but `Assignment` model uses `teacher` (not `created_by`).
3. Student attendance filters on `academic_term` and `academic_year` for `Attendance`, but `Attendance` model lacks these fields.
4. WhatsApp PIN set flow expects `validated_data['whatsapp_pin']` while serializer exposes `pin`/`confirm_pin`.
5. Payment callback logic sets `'fully paid'`, but model choices are `unpaid`, `partial`, `paid`.
6. Superadmin secret has a fallback hardcoded default.
7. School `admin_password` is stored in plaintext field.
8. Frontend API URL is hardcoded to production domain.
9. Go layer has no test files checked into repo.

## Interview Questions and Expected Strong Answers
| Interview Question | Expected Strong Answer |
|---|---|
| Why Go + Django hybrid? | Django is the domain system-of-record and delivery accelerator; Go handles latency- and throughput-sensitive paths like gateway/workers/services. |
| How do services stay consistent? | Contract-driven APIs, serializer/schema discipline, transactional writes, and idempotent processing for retries/failure cases. |
| How does auth/access control work? | Role-aware endpoints, tenant/school scoping, token validation and blacklist strategy, and route-level permission checks. |
| What algorithm are you most proud of? | Timetable generation using CSP + backtracking + heuristic ordering (MRV-style) with hard conflict constraints. |
| How do you harden external integrations? | Signature/hash verification, retry with exponential backoff, async processing, and reconciliation logic. |
| What technical debt exists? | Field drift, secret management, and test depth; mitigation via contract tests, CI gates, env-based secrets, and targeted regression suites. |
| How will this scale to district level? | Horizontal scale on gateway/workers/services, queue-driven async workloads, caching hot reads, and tenant-safe partitioning strategy. |

## Algorithm and Engineering Pattern Inventory
| Algorithm / Pattern | Where Used | Purpose |
|---|---|---|
| Constraint Satisfaction + Backtracking | Timetable generation | Produces conflict-free schedules under constraints |
| MRV-style variable ordering heuristic | Timetable solver | Reduces search branching and improves convergence |
| Conflict overlap detection | Scheduling validation | Prevents teacher/room double booking |
| Period segmentation with hard boundaries | Timetable period generation | Enforces breaks/lunch and session windows |
| Linear Regression | Analytics/prediction | Forecasts trends from historical performance |
| OLS fallback / trend heuristics | Analytics fallback path | Maintains output when full model pipeline is unavailable |
| Threshold mapping | Grading | Converts marks to grade bands |
| Token-bucket style limiting | Go gateway | Controls burst traffic / abuse |
| TTL cache + periodic eviction | Gateway auth/user cache | Reduces database pressure |
| Batched buffering + timed flush | Worker/audit logging | Improves write throughput |
| Exponential backoff retry | Messaging flows | Handles transient integration failures |
| SHA-512 signatures/hashing | PayNow flow | Verifies payment payload integrity |
| Transactional batch import | CSV ingestion | Safe and scalable bulk data processing |
| Aggregate ranking | Performance ranking | Leaderboard and class ranking outputs |
| Hybrid search strategy | Query endpoints | Full-text/fallback compatibility |

## How to Sell This to the Department of Education
### Value Proposition
- A single operating platform for school administration, learning performance, and parent communication.
- Real-time reporting improves oversight and decision quality at district/provincial level.
- Automation reduces admin load and reporting delays.
- Better financial accountability through auditable fee and payment records.

### Decision-Maker Pitch
"My School Hub gives the Department one accountable digital operating layer across schools. It improves learner-outcome visibility, reduces manual administration, and strengthens governance through auditable, real-time data."

### Procurement Framing
- **Scalability:** Hybrid architecture supports phased growth from pilot to district rollout.
- **Governance:** Role-based access, audit trails, and payment traceability.
- **Adoption:** Familiar workflows plus structured onboarding for admin/teachers.
- **Measurability:** KPIs on attendance, reporting turnaround, fee reconciliation, and parent engagement.

### Suggested 90-Day Pilot Plan
1. **Days 1-15:** Baseline assessment, data readiness, governance and security alignment.
2. **Days 16-45:** Pilot launch in representative schools, training, and controlled parallel run.
3. **Days 46-70:** KPI evaluation, defect fixes, and reporting optimization.
4. **Days 71-90:** Expansion recommendation, support model, and staged rollout plan.

## Closing Recommendation
Lead with impact and architecture in interviews and executive meetings. Then proactively show reliability roadmap ownership:
- fix schema mismatches,
- harden secrets/password handling,
- add automated Go test coverage,
- standardize status enums and API contracts,
- move all environment-specific values to config.

This combination communicates both technical strength and senior-level product accountability.
