# ──────────────────────────────────────────────────────────────
# MySchoolHub — Backend Dockerfile (Railway deployment)
# Build context: repo root
# Only the Django backend is built here.
# The React frontend is hosted separately on cPanel.
# ──────────────────────────────────────────────────────────────

# Stage 1 — install Python dependencies
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Build-time system deps (compile psycopg2, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages into an isolated prefix
COPY School_system/requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# Stage 2 — lean runtime image
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Default port — Railway overrides this with $PORT at runtime
    PORT=8000

WORKDIR /app

# Runtime system libs only
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy the Django project (School_system/ subdirectory → /app/)
COPY School_system/ .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Railway exposes the PORT env var — the entrypoint binds Gunicorn to it
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
