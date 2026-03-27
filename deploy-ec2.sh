#!/bin/bash
# ──────────────────────────────────────────────────────────────
# My School Hub — EC2 Deploy Script
# Builds backend Docker image, pushes to ECR, builds frontend,
# restarts services, and ensures Nginx + SSL are configured.
#
# Usage:
#   ./deploy-ec2.sh              # Full deploy (backend + frontend + SSL)
#   ./deploy-ec2.sh rollback     # Rollback backend to previous image
#   ./deploy-ec2.sh backend      # Backend only (skip frontend build)
#   ./deploy-ec2.sh frontend     # Frontend only (skip backend build)
#   ./deploy-ec2.sh ssl          # Fix SSL only
# ──────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$HOME/my-school-hub"
COMPOSE_FILE="docker-compose.prod.yml"
REGION="${AWS_REGION:-af-south-1}"

# ── Load env vars ─────────────────────────────────────────────
if [ -f "$REPO_DIR/School_system/.env" ]; then
    export $(grep -v '^#' "$REPO_DIR/School_system/.env" | grep -E '^(ECR_REGISTRY|DATABASE_URL|REDIS_URL|CELERY_BROKER_URL)' | xargs)
fi

if [ -z "${ECR_REGISTRY:-}" ]; then
    echo "ERROR: ECR_REGISTRY not set. Add it to School_system/.env or export it."
    exit 1
fi

ECR_REGISTRY="${ECR_REGISTRY%/schoolhub-web}"

IMAGE="${ECR_REGISTRY}/schoolhub-web"
cd "$REPO_DIR"

# ── Helper: Deploy frontend ──────────────────────────────────
deploy_frontend() {
    echo ""
    echo "==> Building frontend..."
    npm ci --production=false
    npm run build

    echo "==> Deploying frontend to /var/www/schoolhub/dist..."
    sudo mkdir -p /var/www/schoolhub
    sudo rm -rf /var/www/schoolhub/dist
    sudo cp -r dist /var/www/schoolhub/

    echo "==> Frontend deployed."
}

# ── Helper: Deploy backend ────────────────────────────────────
deploy_backend() {
    echo ""
    echo "==> Logging in to ECR..."
    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

    # Tag current as previous (for rollback)
    echo "==> Tagging current image as 'previous'..."
    docker tag "${IMAGE}:latest" "${IMAGE}:previous" 2>/dev/null || true

    echo "==> Building Docker image..."
    docker build -t "${IMAGE}:latest" ./School_system/

    echo "==> Pushing to ECR..."
    docker push "${IMAGE}:latest"

    echo "==> Pulling latest image..."
    docker compose -f "$COMPOSE_FILE" config | grep image
    docker compose -f "$COMPOSE_FILE" pull

    echo "==> Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

    echo "==> Backend deployed."
}

# ── Helper: Fix SSL / Nginx ───────────────────────────────────
deploy_ssl() {
    echo ""
    echo "==> Running SSL setup..."
    bash "$REPO_DIR/infrastructure/fix-ssl.sh"
}

# ── Helper: Wait for health ──────────────────────────────────
check_health() {
    echo ""
    echo "==> Waiting for health check..."
    sleep 10

    if curl -sf http://localhost:8000/health/ > /dev/null 2>&1; then
        echo "==> Health check passed!"
    else
        echo "==> WARNING: Health check failed. Check logs:"
        echo "    docker compose -f $COMPOSE_FILE logs web"
    fi

    echo ""
    echo "==> Current status:"
    docker compose -f "$COMPOSE_FILE" ps
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-full}" in
    rollback)
        echo "==> Rolling back to previous image..."
        docker compose -f "$COMPOSE_FILE" down
        docker tag "${IMAGE}:previous" "${IMAGE}:latest" 2>/dev/null || {
            echo "ERROR: No previous image found."
            exit 1
        }
        docker compose -f "$COMPOSE_FILE" up -d
        check_health
        ;;
    backend)
        deploy_backend
        check_health
        ;;
    frontend)
        deploy_frontend
        sudo nginx -t && sudo systemctl reload nginx
        echo "==> Nginx reloaded with new frontend."
        ;;
    ssl)
        deploy_ssl
        ;;
    full|"")
        deploy_backend
        deploy_frontend
        deploy_ssl
        check_health
        echo ""
        echo "============================================"
        echo "  Full deploy complete!"
        echo "  https://myschoolhub.co.zw"
        echo "============================================"
        ;;
    *)
        echo "Usage: $0 [full|backend|frontend|ssl|rollback]"
        exit 1
        ;;
esac
