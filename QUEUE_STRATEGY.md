# My School Hub - Queue Strategy Guide

## Purpose

This guide explains how to use server-side queues to:

1. Reduce peak-time slowdowns.
2. Lower monthly infrastructure cost.
3. Keep the platform stable during exams and result-release days.

This strategy keeps your current architecture (Django, Go services, Celery, Redis, ECS) and does not require a full platform rewrite.

## Expected business impact

If implemented well, expected outcomes are:

1. Cost savings in larger phases (Phase 3-5): about 10% to 30%.
2. Faster peak-time response: p95 latency often improves by 20% to 50%.
3. Fewer peak errors/timeouts: often 30% to 70% reduction.
4. Better concurrency handling: typically 1.3x to 2x better spike tolerance.

## Core principle

Not all work should happen while the user is waiting.

- Keep urgent actions immediate.
- Move heavy or non-urgent work to queues.

## What stays immediate (synchronous)

These must remain real-time for user experience and data correctness:

1. Login and authentication checks.
2. Attendance save confirmation.
3. Marks entry save confirmation.
4. Payment initiation and payment confirmation responses.
5. Small page reads and normal CRUD actions.

## What moves to queues (asynchronous)

These should run in the background:

1. PDF report card generation.
2. Bulk imports (students, results, fees).
3. Large exports and analytics rebuilds.
4. Non-critical notification fan-out.
5. Other long-running jobs that do not need instant screen response.

## Queue model

Create 3 queues with clear priority:

1. `high`
2. `default`
3. `bulk`

### Meaning of each queue

1. `high`: urgent background jobs that affect near-term user flow.
2. `default`: normal background tasks.
3. `bulk`: heavy jobs that can wait and should never block critical operations.

## Worker model

Run dedicated workers per queue so heavy jobs cannot starve urgent jobs:

1. `worker-high` -> processes `high`
2. `worker-default` -> processes `default`
3. `worker-bulk` -> processes `bulk`

Keep `worker-bulk` lower priority and controlled concurrency.

## Idempotency and data safety (zero data loss posture)

Before full rollout, every queued task must be safe to retry.

Requirements:

1. Use idempotency keys where duplicates are possible.
2. Track task state: `queued`, `running`, `done`, `failed`.
3. Use database transactions for multi-step writes.
4. Ensure external calls cannot double-apply side effects.
5. Configure retries with exponential backoff and retry limits.

## Backpressure controls

Prevent overload during spikes:

1. Rate-limit heavy endpoints.
2. Delay or reject new bulk jobs when bulk queue depth is above threshold.
3. Reserve worker capacity for `high` queue at all times.
4. Add a temporary "degraded mode" for non-essential heavy features during extreme peaks.

## Autoscaling policy

Scale API and workers separately:

1. Scale web/API by latency and CPU.
2. Scale workers by queue depth and oldest-message age.

Suggested behavior:

1. If `high` queue oldest task > 30 seconds, scale `worker-high`.
2. If `default` queue depth grows steadily, scale `worker-default`.
3. Scale `bulk` workers slowly to avoid database pressure spikes.

## Rollout plan (minimum downtime)

Use a staged rollout with safe rollback.

### Stage 1: Foundation

1. Define queues and worker services.
2. Add task status tracking and retry standards.
3. Keep existing sync path as fallback.

### Stage 2: Low-risk migration

1. Move PDF report generation to `bulk`.
2. Move email/notification fan-out to `default`.
3. Monitor latency and failure rates.

### Stage 3: Heavy migration

1. Move CSV bulk imports to `bulk`.
2. Move large exports to `bulk`.
3. Tune worker concurrency and queue thresholds.

### Stage 4: Scale optimization

1. Enable queue-depth autoscaling.
2. Add peak-window pre-warm runbook.
3. Turn off old heavy sync paths after stability window.

## Monitoring and alerts

Track these continuously:

1. Queue depth by queue name.
2. Oldest task age by queue.
3. Task retry and failure rates.
4. API p95 and p99 latency.
5. Database CPU, connections, lock waits.
6. Redis memory and evictions.

Critical alerts:

1. `high` queue lag breaches threshold.
2. Retry storms.
3. Database connection saturation.
4. Replica lag (if replicas are used).

## Capacity planning for your user ranges

### 12,000 to 50,000 accounts

Queue strategy should be mandatory for:

1. Report windows.
2. Bulk data operations.
3. Exam period spikes.

This helps keep costs closer to the lower half of your Phase 4 cost range.

### 51,000 to 100,000 accounts

Queue strategy is essential, not optional.

Use queue isolation, read scaling, and worker autoscaling together to keep stability during peak loads.

### 15,000+ concurrent users

To handle this smoothly:

1. Pre-warm worker and web capacity before known peaks.
2. Protect `high` queue with dedicated capacity.
3. Strictly throttle or defer non-critical bulk submissions.

## Governance and operating rhythm

1. Weekly review: queue depth, slow tasks, failures.
2. Monthly review: performance vs cost by phase.
3. Quarterly drill: restore testing and peak-load simulation.
4. Before each school term: update peak assumptions and pre-warm settings.

## Quick implementation checklist

1. Define `high/default/bulk` queues.
2. Split worker services by queue ownership.
3. Add idempotency and safe retries.
4. Add queue-depth and lag metrics.
5. Add autoscaling rules per queue.
6. Add peak-day pre-warm runbook.
7. Migrate heavy features in stages.
8. Remove old sync-heavy paths only after stable validation.

## Required code changes

To implement this strategy, these application changes are required:

1. Add explicit queue definitions in Celery configuration: `high`, `default`, `bulk`.
2. Update task routing so each heavy task is sent to the correct queue.
3. Split worker commands by queue (for example: one command per queue).
4. Add idempotency protection for retryable tasks to prevent duplicate side effects.
5. Add consistent retry policies (exponential backoff + max retries per task type).
6. Add task status tracking (`queued`, `running`, `done`, `failed`) for visibility and support.
7. Add endpoint-level backpressure checks for heavy features (imports, bulk reports, exports).
8. Keep core user-critical writes synchronous (attendance save, marks save confirmation, payment confirmation response).

## Required AWS infrastructure setup

To run this properly in production, these infrastructure additions are required:

1. Add dedicated ECS services for:
   - `worker-high`
   - `worker-default`
   - `worker-bulk`
2. Add ECS autoscaling policies for each worker service based on queue depth and queue age.
3. Add CloudWatch alarms for:
   - Queue lag
   - Worker failure/restart spikes
   - Retry storm behavior
4. Validate ElastiCache Redis capacity for queue traffic and scale up if memory/evictions rise.
5. Validate RDS connection capacity; at higher phases, add RDS Proxy or PgBouncer.
6. Use rolling or blue/green ECS deployments for low-risk releases and fast rollback.

## Downtime and data-loss impact

If implemented with staged rollout and rollback controls:

1. Downtime can remain near zero.
2. Data loss can be avoided by combining idempotency, transactional writes, retries, and backup/PITR discipline.
3. Migration should be done feature-by-feature, not all at once.

## Final note

Queues reduce overload and cost waste, but they do not remove core write load from critical actions like attendance, marks, and payments. The best results come from combining queue strategy with good database scaling and peak planning.
