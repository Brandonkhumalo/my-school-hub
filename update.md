Recommended Action Plan
Phase 1 — Critical (Week 1-2)

Migrate SQLite → PostgreSQL
Add database indexes on all FK and filtered fields
Lock down CORS/ALLOWED_HOSTS, move SECRET_KEY to .env
Add React.lazy() code splitting to App.jsx
Phase 2 — High Priority (Week 3-4)
5. Add Redis for caching + token blacklist
6. Add Celery for WhatsApp sends, report generation, timetable generation
7. Add select_related/prefetch_related to all views with joins
8. Add React Query for frontend data caching
9. Add DRF rate limiting

Phase 3 — Hardening (Week 5-6)
10. Dockerize the application
11. Add CI/CD pipeline
12. Add health check endpoint
13. Split monolithic components
14. Add Sentry for error monitoring

