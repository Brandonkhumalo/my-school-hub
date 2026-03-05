#!/bin/sh
# ──────────────────────────────────────────────────────────────
# MySchoolHub — Container entrypoint
# Runs on every container start (Railway, Docker, etc.)
# ──────────────────────────────────────────────────────────────
set -e

# Collect static files — done at runtime so SECRET_KEY is available
echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear 2>&1

# Apply any pending database migrations
echo "==> Running database migrations..."
python manage.py migrate --noinput 2>&1

# Railway injects PORT; fall back to 8000 for local Docker
BIND_PORT="${PORT:-8000}"

echo "==> Starting Gunicorn on 0.0.0.0:${BIND_PORT}..."
exec gunicorn School_system.wsgi:application \
    --bind "0.0.0.0:${BIND_PORT}" \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
