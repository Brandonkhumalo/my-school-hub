# ──────────────────────────────────────────────────────────────
# Stage 1 — dependency builder
# ──────────────────────────────────────────────────────────────
FROM python:3.10-slim AS builder

WORKDIR /app

# Install build deps for psycopg2 etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ──────────────────────────────────────────────────────────────
# Stage 2 — runtime image
# ──────────────────────────────────────────────────────────────
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=School_system.settings

WORKDIR /app

# Runtime system libs only
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy Django project source
COPY . .

# Collect static files at build time (whitenoise serves them).
# SECRET_KEY is required by Django but not used for collectstatic,
# so we pass a throwaway value. The real key is set at runtime via .env.
RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/')" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
