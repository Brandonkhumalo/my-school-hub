#!/bin/sh
# ──────────────────────────────────────────────────────────────
# MySchoolHub — Container entrypoint
# Runs on every container start (AWS EC2, ECS, Fargate, etc.)
# ──────────────────────────────────────────────────────────────
set -e

# Verify Django can load settings
echo "==> Checking Django configuration..."
python -c "import django; django.setup(); print('Django OK')" 2>&1

# Collect static files — done at runtime so SECRET_KEY is available
echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear 2>&1 || echo "WARNING: collectstatic failed, continuing..."

# Apply any pending database migrations
echo "==> Running database migrations..."
python manage.py migrate --noinput 2>&1

# Configurable port and workers via env vars
BIND_PORT="${PORT:-8000}"
WORKERS="${WEB_CONCURRENCY:-4}"

echo "==> Starting Gunicorn on 0.0.0.0:${BIND_PORT} with ${WORKERS} workers..."
exec gunicorn School_system.wsgi:application \
    --bind "0.0.0.0:${BIND_PORT}" \
    --workers "${WORKERS}" \
    --threads 2 \
    --timeout 120 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
