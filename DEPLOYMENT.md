# My School Hub — Deployment Guide

Three-phase deployment: start cheap on a single EC2, scale to ECS with auto-scaling — **zero application code changes** between phases.

**AWS Region:** `af-south-1` (Cape Town) — lowest latency to Zimbabwe.

**Domain:** `myschoolhub.co.zw` — DNS points directly to Elastic IP (no Cloudflare).

## Architecture

```
Internet → Nginx (SSL) → Go Gateway (:8080)
                          ├─→ Django API (:8000)        — core business logic, ORM, auth
                          ├─→ Go Workers (:8081)        — bulk CSV imports (students, results, fees)
                          └─→ Go Services (:8082)       — PDF reports, PayNow, email, WhatsApp
                               │
                          Redis (:6379) ← Celery worker + beat
                               │
                          PostgreSQL (RDS)
```

### Go Microservices

| Service | Port | RAM | Purpose |
|---------|------|-----|---------|
| **Go Gateway** | 8080 | ~15MB | JWT auth, token blacklist, audit logging, rate limiting, request routing |
| **Go Workers** | 8081 | ~10MB | Streaming CSV bulk imports with batch PostgreSQL inserts |
| **Go Services** | 8082 | ~12MB | PDF report cards (go-fpdf), PayNow API, Resend email, WhatsApp (goroutines) |
| **Django** | 8000 | ~150MB | Core business logic, ORM, admin, DRF APIs |
| **Celery** | — | ~100MB | Background task processing (WhatsApp webhooks, report generation fallback) |

### Docker Images (ECR)

| Image | Build Context | Dockerfile |
|-------|---------------|------------|
| `schoolhub-gateway` | `go-gateway/` | `go-gateway/Dockerfile` |
| `schoolhub-workers` | `go-workers/` | `go-workers/Dockerfile` |
| `schoolhub-services` | `go-services/` | `go-services/Dockerfile` |
| `schoolhub-web` | `School_system/` | `School_system/Dockerfile` |

---

## Table of Contents

1. [Phase 1 — Launch (single EC2)](#phase-1--launch-0-to-2000-users)
2. [Phase 2 — Growth (ECS + ALB)](#phase-2--growth-2000-to-5000-users)
3. [Phase 3 — Scale (auto-scaling)](#phase-3--scale-5000-users)
4. [Phase 4 — Enterprise Growth (12,000 to 50,000 users)](#phase-4--enterprise-growth-12000-to-50000-users)
5. [Phase 5 — National Scale (51,000 to 100,000 users)](#phase-5--national-scale-51000-to-100000-users)
6. [Monthly Cost by Phase (USD)](#monthly-cost-by-phase-usd)
7. [Change Summary](#change-summary-across-phases)

---

## Prerequisites (All Phases)

- AWS account with `af-south-1` region enabled (opt-in required)
- GitHub repo access
- Domain: `myschoolhub.co.zw` — you'll point the A record to your Elastic IP
- PayNow Zimbabwe merchant account (for school payments)
- Resend account for transactional email

---

## Phase 1 — Launch (0 to ~2,000 users)

Single EC2 instance hosting the React frontend and Go + Django microservices, with Nginx + Let's Encrypt SSL. Managed RDS + ElastiCache. ~$108-115/month.

```
        Internet
           │
     ┌─────▼─────┐
     │  Elastic   │
     │    IP      │
     └─────┬─────┘
           │
  ┌────────▼────────────────────────────────────┐
  │  EC2 t3.medium  (2 vCPU, 4GB RAM)          │
  │                                              │
  │  Nginx (host)                                │
  │    ├── :443 → SSL (Let's Encrypt)           │
  │    ├── /          → React SPA (static)      │
  │    └── /api/      → Go Gateway :8080        │
  │                                              │
  │  Docker (docker-compose.prod.yml)            │
  │    ├── gateway     (Go API Gateway ~15MB)   │
  │    │     ├── /api/v1/bulk/*    → workers    │
  │    │     ├── /api/v1/services/* → services  │
  │    │     ├── report-card, paynow → services │
  │    │     └── everything else   → web        │
  │    ├── web         (Django + Gunicorn)       │
  │    ├── workers     (Go Bulk Workers ~10MB)  │
  │    ├── services    (Go Services ~12MB)      │
  │    ├── celery      (background tasks)        │
  │    └── celery-beat (periodic tasks)          │
  └──────┬──────────────┬────────────────────────┘
         │              │
  ┌──────▼──────┐ ┌─────▼──────┐
  │RDS Postgres │ │ElastiCache │
  │db.t3.small  │ │t3.medium   │
  │             │ │ Redis 7    │
  └─────────────┘ └────────────┘
```

### Step 1: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `schoolhub-backend` |
| AMI | Ubuntu 22.04 LTS (or 24.04 LTS) |
| Instance type | t3.medium (2 vCPU, 4GB RAM) |
| Key pair | **Create new key pair** → name it `schoolhub-key` → download the `.pem` file. You need this for SSH and CI/CD. |
| Storage | 20 GB gp3 |

3. **Network Settings** → click **Edit**:
   - **VPC**: Select **Default VPC** (it's pre-selected)
   - **Auto-assign public IP**: Enable
   - **Create security group** → name it `schoolhub-ec2-sg`
   - Add these inbound rules:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | 0.0.0.0/0 | EC2 Instance Connect / SSH |
| HTTP | 80 | 0.0.0.0/0 | Nginx (redirects to HTTPS) |
| HTTPS | 443 | 0.0.0.0/0 | Nginx (SSL termination) |

4. Click **Launch Instance**

5. Go to **Elastic IPs** → **Allocate Elastic IP address** → **Allocate** → select the new IP → **Actions → Associate Elastic IP address** → select your `schoolhub-backend` instance → **Associate**

6. **Get your EC2 Security Group ID** (you need this for Steps 3 and 4):
   - Go to **EC2 → Instances → schoolhub-backend**
   - Click the **Security** tab
   - Copy the **Security group ID** (e.g., `sg-0abc123def456`) — write this down

> **Save for `.env`:**
> - **Elastic IP** (e.g., `13.245.56.109`) → goes into `ALLOWED_HOSTS`
> - **`.pem` file** → save securely, needed for SSH + GitHub Actions secret `EC2_SSH_KEY`

### Step 2: Point DNS to Elastic IP

Go to your domain registrar for `myschoolhub.co.zw` and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<YOUR_ELASTIC_IP>` | 300 |
| A | www | `<YOUR_ELASTIC_IP>` | 300 |

> **Important:** Do NOT use Cloudflare proxy (orange cloud). DNS-only (grey cloud) or use your registrar's DNS directly. Cloudflare's SSL conflicts with Let's Encrypt and causes the domain to become unreachable after reboots.

### Step 3: Create RDS Security Group + Database

You must create the security group **before** creating the database.

**Step 3a — Create a security group for RDS:**

1. Go to **EC2 → Security Groups → Create security group**
2. Fill in:

| Field | Value |
|-------|-------|
| Security group name | `schoolhub-db-sg` |
| Description | `Allow PostgreSQL from EC2` |
| VPC | **Default VPC** (same dropdown, same VPC as your EC2) |

3. **Inbound rules → Add rule:**

| Type | Port range | Source type | Source |
|------|-----------|-------------|--------|
| PostgreSQL | 5432 | **Custom** | Paste your EC2 security group ID from Step 1 (e.g., `sg-0abc123def456`) |

> **Why Custom and not CIDR?** Selecting "Custom" and pasting the security group ID means "allow any instance in that security group". This is more secure than an IP address and won't break if the EC2's private IP changes.

4. Click **Create security group** — note the new SG ID (e.g., `sg-0db789...`)

**Step 3b — Create the RDS database:**

1. Go to **RDS → Create database**
2. Select **Standard create**
3. Configure **every** field below:

| Setting | Value | Where to find it |
|---------|-------|-------------------|
| Engine type | **PostgreSQL** | |
| Engine version | **15** (any 15.x) | |
| Templates | **Dev/Test** | Select this to allow db.t3.small |
| DB instance identifier | `schoolhub-db` | This is just a label |
| Master username | `postgres` | |
| Master password | Choose a password (e.g., `My-school-hub`) | **Write this down — you need it for `.env`** |
| Confirm password | Same as above | |
| DB instance class | db.t3.small | |
| Storage type | gp3 | |
| Allocated storage | 20 GB | |

4. **Connectivity** section (scroll down):

| Setting | Value |
|---------|-------|
| VPC | **Default VPC** (must match your EC2) |
| DB subnet group | **default** |
| Public access | **No** |
| VPC security group | Select **Choose existing** → select `schoolhub-db-sg` (the one you just created). **Remove** any other security group (like `default`) |
| Availability Zone | No preference |

5. **Additional configuration** section (click to expand):

| Setting | Value |
|---------|-------|
| **Initial database name** | `schoolhub` |
| Backup retention | 7 days |
| Enable automated backups | Yes |

> **CRITICAL:** You must type `schoolhub` in the "Initial database name" field. If you leave it blank, no database is created and your app will crash with "database does not exist".

6. Click **Create database** — wait 5-10 minutes until status shows **Available**
7. Click **schoolhub-db** → copy the **Endpoint** (e.g., `schoolhub-db.xxxxx.af-south-1.rds.amazonaws.com`)

> **Save for `.env`:** Combine the endpoint + password into `DATABASE_URL`:
> ```
> DATABASE_URL=postgresql://postgres:My-school-hub@schoolhub-db.xxxxx.af-south-1.rds.amazonaws.com:5432/schoolhub
> ```
> The format is: `postgresql://USERNAME:PASSWORD@ENDPOINT:5432/DBNAME`

### Step 4: Create ElastiCache Security Group + Redis

**Step 4a — Create a security group for ElastiCache:**

1. Go to **EC2 → Security Groups → Create security group**
2. Fill in:

| Field | Value |
|-------|-------|
| Security group name | `schoolhub-redis-sg` |
| Description | `Allow Redis from EC2` |
| VPC | **Default VPC** (same as EC2) |

3. **Inbound rules → Add rule:**

| Type | Port range | Source type | Source |
|------|-----------|-------------|--------|
| Custom TCP | 6379 | **Custom** | Paste your EC2 security group ID from Step 1 (e.g., `sg-0abc123def456`) |

4. Click **Create security group**

**Step 4b — Create the ElastiCache Redis cluster:**

1. Go to **ElastiCache → Redis OSS caches → Create Redis OSS cache**
2. Configure:

| Setting | Value |
|---------|-------|
| Cluster mode | Disabled |
| Name | `schoolhub-redis` |
| Node type | cache.t3.medium |
| Number of replicas | 0 |

3. **Connectivity** section:

| Setting | Value |
|---------|-------|
| Subnet group | **Create new** or **default** (uses Default VPC) |
| VPC security group | Select `schoolhub-redis-sg` (the one you just created) |

4. Click **Create** — wait a few minutes
5. Click **schoolhub-redis** → copy the **Primary Endpoint** (e.g., `schoolhub-redis.xxxxx.af-south-1.cache.amazonaws.com`)

> **Save for `.env`:** Use this endpoint for both Redis vars:
> ```
> REDIS_URL=redis://schoolhub-redis.xxxxx.af-south-1.cache.amazonaws.com:6379/0
> CELERY_BROKER_URL=redis://schoolhub-redis.xxxxx.af-south-1.cache.amazonaws.com:6379/0
> ```

**Step 4c — Create S3 bucket for media uploads (recommended in Phase 1):**

1. Go to **S3 → Create bucket**
2. Configure:

| Setting | Value |
|---------|-------|
| Bucket name | `schoolhub-media-af-south-1` (or another globally unique name) |
| Region | `af-south-1` |
| Block all public access | Enabled |
| Versioning | Disabled (cheapest in Phase 1) |
| Default encryption | SSE-S3 |

3. Create an IAM policy with least privilege and attach it to the **EC2 instance role**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::schoolhub-media-af-south-1"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::schoolhub-media-af-south-1/*"
    }
  ]
}
```

> **Save for `.env`:**
> ```
> AWS_STORAGE_BUCKET_NAME=schoolhub-media-af-south-1
> AWS_S3_REGION_NAME=af-south-1
> ```

### Step 5: Create ECR Repositories

Go to **AWS Console → CloudShell** (top right, terminal icon) and run:

```bash
aws ecr create-repository --repository-name schoolhub-web --region af-south-1
aws ecr create-repository --repository-name schoolhub-gateway --region af-south-1
aws ecr create-repository --repository-name schoolhub-workers --region af-south-1
aws ecr create-repository --repository-name schoolhub-services --region af-south-1
```

The output will show a `repositoryUri` like:
```
"repositoryUri": "215627216353.dkr.ecr.af-south-1.amazonaws.com/schoolhub-web"
```

Your `ECR_REGISTRY` is **everything before** the repo name:

> **Save for `.env`:** Just the registry host — **not** the full image path:
> ```
> ECR_REGISTRY=215627216353.dkr.ecr.af-south-1.amazonaws.com
> ```
> Do NOT include `/schoolhub-web` — the deploy scripts add that automatically.

### Step 6: Connect to EC2

**Option A — Browser SSH (no key pair needed):**

1. Go to **EC2 → Instances** → select `schoolhub-backend`
2. Click **Connect** → **EC2 Instance Connect** → **Connect**

**Option B — Terminal SSH (requires key pair):**

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
```

> All commands from here run on the EC2 instance.

### Step 7: Install Docker + Node.js + Nginx

```bash
# Docker
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER && newgrp docker

# Node.js 20 (via nvm — needed for frontend build)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 20

# Nginx + Certbot
sudo apt-get update && sudo apt-get install -y nginx certbot python3-certbot-nginx

# AWS CLI v2 (the apt package doesn't exist on Ubuntu 24+)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt-get install -y unzip && unzip awscliv2.zip && sudo ./aws/install
rm -rf awscliv2.zip aws/
```

Then configure AWS CLI:

```bash
aws configure
```

Enter: Access Key ID, Secret Key, region `af-south-1`, output `json`.

> **Note:** The AWS Access Key ID and Secret Access Key used here are also needed as GitHub Actions secrets for CI/CD (Step 14). Save them somewhere secure — you'll need them again.

### Step 8: Clone and Configure

```bash
git clone https://github.com/Brandonkhumalo/my-school-hub.git
cd my-school-hub

# Create .env from template
cp School_system/.env.example School_system/.env
nano School_system/.env
```

Fill in the `.env` using the credentials you saved from the previous steps:

```env
# ── Core (generate these now) ──────────────────────────────────
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(50))">
SUPERADMIN_SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(50))">
DEBUG=False
ALLOWED_HOSTS=myschoolhub.co.zw,www.myschoolhub.co.zw,<ELASTIC_IP from Step 1>,localhost

# ── Database (from Step 3 — RDS Endpoint + Master Password) ───
# Format: postgresql://USERNAME:PASSWORD@ENDPOINT:5432/DBNAME
DATABASE_URL=postgresql://postgres:<RDS_PASSWORD from Step 3>@<RDS_ENDPOINT from Step 3>:5432/schoolhub

# ── Redis (from Step 4 — ElastiCache Primary Endpoint) ────────
REDIS_URL=redis://<ELASTICACHE_ENDPOINT from Step 4>:6379/0
CELERY_BROKER_URL=redis://<ELASTICACHE_ENDPOINT from Step 4>:6379/0

# ── S3 Media Uploads (from Step 4c) ────────────────────────────
AWS_STORAGE_BUCKET_NAME=<S3_BUCKET_NAME from Step 4c>
AWS_S3_REGION_NAME=af-south-1

# ── ECR (from Step 5 — ECR Registry URI) ──────────────────────
ECR_REGISTRY=<ECR_REGISTRY from Step 5>

# ── CORS + CSRF ────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=https://myschoolhub.co.zw,https://www.myschoolhub.co.zw
CSRF_TRUSTED_ORIGINS=https://myschoolhub.co.zw,https://www.myschoolhub.co.zw

# ── PayNow Zimbabwe ───────────────────────────────────────────
PAYNOW_RETURN_URL=https://myschoolhub.co.zw/payment/success
PAYNOW_RESULT_URL=https://myschoolhub.co.zw/api/v1/finances/payments/paynow/result/

# ── Email (from your Resend dashboard → API Keys) ─────────────
ResendEmailApiKey=re_your_key
ResendFromEmail=noreply@myschoolhub.co.zw
Destination=info@myschoolhub.co.zw

# ── Workers ────────────────────────────────────────────────────
WEB_CONCURRENCY=4
```

> **Checklist — every `.env` value should be filled in before continuing:**
>
> | Variable | Where you got it |
> |----------|-----------------|
> | `SECRET_KEY` | Generated just now |
> | `SUPERADMIN_SECRET_KEY` | Generated just now |
> | `ALLOWED_HOSTS` | Elastic IP from Step 1 + `localhost` (needed for Docker health checks) |
> | `DATABASE_URL` | `postgresql://postgres:PASSWORD@ENDPOINT:5432/schoolhub` — from Step 3 |
> | `REDIS_URL` | `redis://ENDPOINT:6379/0` — from Step 4 |
> | `CELERY_BROKER_URL` | Same value as `REDIS_URL` |
> | `AWS_STORAGE_BUCKET_NAME` | Your media S3 bucket from Step 4c |
> | `AWS_S3_REGION_NAME` | `af-south-1` |
> | `ECR_REGISTRY` | Registry host only from Step 5 — do NOT include `/schoolhub-web` |
> | `ResendEmailApiKey` | Your Resend dashboard |
> | `CORS_ALLOWED_ORIGINS` | Your domain (pre-filled) |
> | `CSRF_TRUSTED_ORIGINS` | Your domain (pre-filled) |

### Step 9: Build and Deploy Backend

```bash
cd ~/my-school-hub

# Login to ECR
source School_system/.env
aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push all Docker images
docker build -t $ECR_REGISTRY/schoolhub-web:latest ./School_system/
docker build -t $ECR_REGISTRY/schoolhub-gateway:latest ./go-gateway/
docker build -t $ECR_REGISTRY/schoolhub-workers:latest ./go-workers/
docker build -t $ECR_REGISTRY/schoolhub-services:latest ./go-services/

docker push $ECR_REGISTRY/schoolhub-web:latest
docker push $ECR_REGISTRY/schoolhub-gateway:latest
docker push $ECR_REGISTRY/schoolhub-workers:latest
docker push $ECR_REGISTRY/schoolhub-services:latest

# Start all services
docker compose -f docker-compose.prod.yml up -d
```

### Step 10: Build and Deploy Frontend

```bash
cd ~/my-school-hub

# Install dependencies and build React app
npm ci
npm run build

# Copy built files to Nginx's serving directory
sudo mkdir -p /var/www/schoolhub
sudo cp -r dist /var/www/schoolhub/
```

### Step 11: Set Up SSL + Nginx

This script installs Nginx configs, requests Let's Encrypt certificates, and sets up auto-renewal:

```bash
chmod +x infrastructure/fix-ssl.sh
bash infrastructure/fix-ssl.sh
```

**What it does:**
1. Deploys HTTP-only Nginx config
2. Requests SSL certificates from Let's Encrypt for `myschoolhub.co.zw` and `www.myschoolhub.co.zw`
3. Switches to HTTPS Nginx config
4. Enables `certbot.timer` for automatic certificate renewal
5. Installs a post-renewal hook that reloads Nginx after cert renewal

**After reboots:** Nginx starts automatically (it's a systemd service). SSL certs persist in `/etc/letsencrypt/`. The `certbot.timer` auto-renews them. No manual intervention needed.

### Step 12: Verify

```bash
# Health check (via Nginx/SSL → Go Gateway → Django)
curl -I https://myschoolhub.co.zw/health/

# Health check (direct to Go Gateway)
curl http://localhost:8080/health/

# Health check (direct to individual services)
curl http://localhost:8000/health/    # Django
# Go Workers and Go Services only expose ports internally via Docker

# Docker service status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs gateway    # Go Gateway
docker compose -f docker-compose.prod.yml logs web        # Django
docker compose -f docker-compose.prod.yml logs services   # Go Services
docker compose -f docker-compose.prod.yml logs workers    # Go Workers

# SSL certificate status
sudo certbot certificates

# Nginx status
sudo systemctl status nginx

# S3 media upload test (prints the uploaded S3 URL)
docker compose -f docker-compose.prod.yml exec web python manage.py shell -c "from django.core.files.base import ContentFile; from django.core.files.storage import default_storage; p=default_storage.save('healthchecks/s3-test.txt', ContentFile(b's3 ok')); print(default_storage.url(p))"
```

Expected output from `docker compose ps`:

```
NAME          STATUS
gateway       Up
web           Up (healthy)
workers       Up
services      Up
celery        Up
celery-beat   Up
```

### Step 13: Create Admin User

```bash
# Create superadmin
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser

# Optional: run migrations manually (entrypoint already runs this on startup)
docker compose -f docker-compose.prod.yml exec web python manage.py migrate
```

### Step 14: Set Up CI/CD (GitHub Actions: Build → Test → Deploy)

The workflow file already exists at `.github/workflows/deploy.yml`. You just need to add secrets:

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add these secrets using credentials you already have from previous steps:

| Secret | Value | Where you got it |
|--------|-------|------------------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key | Same key you used in `aws configure` (Step 7) |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key | Same key you used in `aws configure` (Step 7) |
| `EC2_HOST` | Your Elastic IP | From Step 1 (also in your `.env` → `ALLOWED_HOSTS`) |
| `EC2_USER` (optional) | SSH username on EC2 | Usually `ubuntu` on Ubuntu AMIs (defaults to `ubuntu` if not set) |
| `EC2_SSH_KEY` | Full contents of your `.pem` file | The key pair you downloaded in Step 1 — open the `.pem` file, copy everything including `-----BEGIN` and `-----END` lines |

> **Don't have these anymore?**
> - **AWS keys:** Go to **IAM → Users → your user → Security credentials → Create access key**. Save both the Access Key ID and Secret Access Key — you can only see the secret once. Also re-run `aws configure` on the EC2 with the new key.
> - **`.pem` file:** If you lost it, you can't recover it. Create a new key pair in **EC2 → Key Pairs**, then update the EC2 instance to use it.
> - **Elastic IP:** Go to **EC2 → Elastic IPs** — it's listed there. Also in your `.env` under `ALLOWED_HOSTS`.

Now every push to `main` automatically:
1. **Build stage:** builds the frontend bundle, compiles all 3 Go services, and smoke-builds all 4 Docker images
2. **Test stage:** runs Django tests against a fresh PostgreSQL service and runs `go test` for all Go services
3. **Deploy stage:** builds + pushes tagged Docker images to ECR, then SSHs into EC2 to pull/restart services and rebuild frontend assets

### Step 15: Confirm Uploads Work End-to-End (required)

1. Upload a small file in the app (assignment, attachment, or profile image).
2. Open **S3 → `schoolhub-media-af-south-1`** and verify the file appears.
3. Open the uploaded file from the app UI and confirm it loads.
4. Restart services and confirm the same file still loads:

```bash
docker compose -f docker-compose.prod.yml restart
```

### Phase 1 Common Commands

```bash
cd ~/my-school-hub

# ── Logs ──
docker compose -f docker-compose.prod.yml logs -f             # All services
docker compose -f docker-compose.prod.yml logs web             # Django only
docker compose -f docker-compose.prod.yml logs celery          # Celery worker
sudo tail -f /var/log/nginx/access.log                         # Nginx access
sudo tail -f /var/log/nginx/error.log                          # Nginx errors

# ── Service management ──
docker compose -f docker-compose.prod.yml ps                   # Status
docker compose -f docker-compose.prod.yml restart web          # Restart Django
docker compose -f docker-compose.prod.yml down                 # Stop all
docker compose -f docker-compose.prod.yml exec web python manage.py migrate
docker compose -f docker-compose.prod.yml exec web python manage.py shell
docker stats --no-stream                                       # CPU/memory

# ── Deploy ──
./deploy-ec2.sh                    # Full deploy (backend + frontend + SSL)
./deploy-ec2.sh backend            # Backend only
./deploy-ec2.sh frontend           # Frontend only (rebuild React)
./deploy-ec2.sh rollback           # Rollback backend to previous image

# ── SSL ──
sudo certbot certificates           # Check cert status & expiry
sudo certbot renew --dry-run        # Test renewal
bash infrastructure/fix-ssl.sh      # Full SSL recovery
```

### Phase 1 Monthly Cost

| Service | Cost |
|---------|------|
| EC2 t3.medium | ~$30 |
| RDS db.t3.small | ~$26 |
| ElastiCache cache.t3.medium | ~$50 |
| Elastic IP | $0 (while attached) |
| ECR + Route 53 | ~$2 |
| **Total** | **~$108-115/mo** |

### Phase 1 Troubleshooting

**Domain unreachable after reboot/deploy:**
```bash
cd ~/my-school-hub && bash infrastructure/fix-ssl.sh
```
This is the one-command fix. It checks Nginx, SSL certs, and rebuilds everything if needed.

**Services keep restarting:**
```bash
docker compose -f docker-compose.prod.yml logs web
```

**Can't connect to RDS:**
- Check EC2 and RDS are in the same VPC
- Check RDS security group allows port 5432 from EC2's security group

**Can't connect to ElastiCache:**
- ElastiCache must be in the same VPC as EC2
- Check security group allows port 6379

**Out of memory:**
```bash
docker stats --no-stream
free -h
```
Reduce `WEB_CONCURRENCY` to 2 in `.env` and restart.

**SSL certificate won't renew:**
```bash
sudo certbot renew --force-renewal
sudo nginx -t && sudo systemctl reload nginx
```

**Frontend shows blank page:**
```bash
ls /var/www/schoolhub/dist/
# Should contain: index.html, assets/
# If empty, rebuild:
cd ~/my-school-hub && npm ci && npm run build
sudo cp -r dist /var/www/schoolhub/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Phase 2 — Growth (~2,000 to ~5,000 users)

**When to move:** Registered users exceed 2,000, or EC2 CPU consistently above 70%, or response times increasing.

Move from docker-compose on EC2 → **ECS with EC2 launch type** behind an **ALB**.

> **Frontend in Phase 2:** Move the React `dist/` to an S3 bucket + CloudFront CDN. The ALB only handles API traffic. This gives you global edge caching for the frontend at ~$1/month extra.

```
         Internet
            │
      ┌─────┼─────────────────────┐
      │     │                     │
┌─────▼──────┐             ┌──────▼──────┐
│ CloudFront  │             │    ALB      │
│ (frontend)  │             │ (API only)  │
│ dist/ → S3  │             │ SSL via ACM │
└─────────────┘             └──────┬──────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │   ECS Cluster (EC2 launch type)      │
                │   2x t3.medium instances             │
                │                                       │
                │   Web (Django):    2 tasks            │
                │   Celery Worker:   1 task             │
                │   Celery Beat:     1 task             │
                └──────┬──────────────┬────────────────┘
                       │              │
                ┌──────▼──────┐ ┌─────▼──────┐
                │RDS Postgres │ │ElastiCache │
                │db.t3.medium │ │t3.medium   │
                │(Multi-AZ)   │ │            │
                └─────────────┘ └────────────┘
```

### Step 1: Create an ALB

1. Go to **EC2 → Load Balancers → Create → Application Load Balancer**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `schoolhub-alb` |
| Scheme | Internet-facing |
| Listeners | HTTP:80, HTTPS:443 |
| Availability Zones | Select at least 2 |

3. Add SSL certificate from **AWS Certificate Manager** (free) for `myschoolhub.co.zw`
4. Create **target group** for gateway service (port 8080, health check: `/health/`)

### Step 2: Move Frontend to S3 + CloudFront

1. **S3 → Create bucket**: `schoolhub-frontend`
2. Enable static website hosting
3. Upload `dist/` contents to the bucket
4. **CloudFront → Create distribution** → origin: the S3 bucket
5. Update DNS: `myschoolhub.co.zw` → CloudFront, `api.myschoolhub.co.zw` → ALB

### Step 2b: Keep the same media bucket in Phase 2

For media uploads, keep the same S3 bucket from Phase 1 (`schoolhub-media-af-south-1`) so you avoid migration risk and downtime.

1. Add/confirm S3 permissions on the **ECS task role** (same policy as Phase 1 Step 4c).
2. In ECS task definitions, set:

```env
AWS_STORAGE_BUCKET_NAME=schoolhub-media-af-south-1
AWS_S3_REGION_NAME=af-south-1
```

3. Force new deployment for `web` and worker services.

### Step 3: Create ECS Cluster + Task Definitions

| Service | Image | Memory | CPU | Port | Load balanced |
|---------|-------|--------|-----|------|---------------|
| gateway | `schoolhub-gateway:latest` | 64 MB | 128 | 8080 | Yes (ALB) |
| web | `schoolhub-web:latest` | 512 MB | 512 | 8000 | No (internal) |
| workers | `schoolhub-workers:latest` | 64 MB | 128 | 8081 | No (internal) |
| services | `schoolhub-services:latest` | 64 MB | 128 | 8082 | No (internal) |
| celery | `schoolhub-web:latest` | 512 MB | 256 | — | No |
| celery-beat | `schoolhub-web:latest` | 256 MB | 128 | — | No |

> **Note:** The Go microservices (gateway, workers, services) use ~10-15MB RAM each. The 64MB allocation gives generous headroom. The ALB now points to the gateway, not Django directly.

### Step 4: Upgrade RDS and ElastiCache

```bash
aws rds modify-db-instance --db-instance-identifier schoolhub-db --db-instance-class db.t3.medium --multi-az --apply-immediately
aws elasticache modify-cache-cluster --cache-cluster-id schoolhub-redis --cache-node-type cache.t3.medium --apply-immediately
```

### Step 5: Update CI/CD

In `.github/workflows/deploy.yml`, replace the SSH deploy step with:

```yaml
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster schoolhub --service schoolhub-gateway --force-new-deployment --region af-south-1
          aws ecs update-service --cluster schoolhub --service schoolhub-web --force-new-deployment --region af-south-1
          aws ecs update-service --cluster schoolhub --service schoolhub-workers --force-new-deployment --region af-south-1
          aws ecs update-service --cluster schoolhub --service schoolhub-services --force-new-deployment --region af-south-1
          aws ecs update-service --cluster schoolhub --service schoolhub-celery --force-new-deployment --region af-south-1
          aws ecs update-service --cluster schoolhub --service schoolhub-beat --force-new-deployment --region af-south-1

      - name: Deploy frontend to S3
        run: |
          npm ci && npm run build
          aws s3 sync dist/ s3://schoolhub-frontend --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} --paths "/*"
```

### Step 6: Decommission Phase 1 EC2

1. Verify all endpoints work via ALB + CloudFront
2. Terminate EC2, release Elastic IP
3. Remove Let's Encrypt / Nginx — ALB + ACM handle SSL now

### Phase 2 What Changed

| Component | Phase 1 | Phase 2 | Code change? |
|-----------|---------|---------|-------------|
| Frontend | Nginx serves `dist/` from EC2 | S3 + CloudFront | **No** |
| Backend | Docker on EC2 | ECS cluster + ALB | **No** — same Docker image |
| SSL | Let's Encrypt + Nginx | AWS Certificate Manager + ALB | **No** |
| DB | RDS micro | RDS small, Multi-AZ | **No** |
| Media uploads | S3 via EC2 role | Same S3 via ECS task role | **No** |
| CI/CD | SSH to EC2 | `ecs update-service` + `s3 sync` | **1 step replaced** |

### Phase 2 Monthly Cost

| Service | Cost |
|---------|------|
| EC2 2x t3.medium (ECS) | ~$60 |
| ALB | ~$18 |
| RDS db.t3.medium (Multi-AZ) | ~$52 |
| ElastiCache t3.medium | ~$50 |
| CloudFront + S3 | ~$2 |
| ECR + data transfer | ~$5 |
| **Total** | **~$187/mo** |

---

## Phase 3 — Scale (~5,000+ users)

**When to move:** Traffic spikes, ECS tasks hitting CPU limits.

### Step 1: Enable ECS Service Auto Scaling

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/schoolhub/schoolhub-web \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 --max-capacity 10

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/schoolhub/schoolhub-web \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name web-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    '{"TargetValue":70.0,"PredefinedMetricSpecification":{"PredefinedMetricType":"ECSServiceAverageCPUUtilization"},"ScaleInCooldown":300,"ScaleOutCooldown":60}'
```

| Service | Min | Max | Why |
|---------|-----|-----|-----|
| Web (Django) | 2 | 10 | Handles all HTTP traffic |
| Celery Worker | 1 | 4 | Reports, bulk fees, WhatsApp |
| Celery Beat | 1 | 1 | Scheduler — only 1 instance ever |

### Step 2: EC2 Auto Scaling Group

1. Create Launch Template (ECS-optimized AMI, t3.medium)
2. Create ASG: min 2, max 6, target CPU 70%
3. Link ASG as ECS capacity provider

### Step 3: Add Read Replica (optional)

When report generation slows down writes:

```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier schoolhub-db-read \
  --source-db-instance-identifier schoolhub-db \
  --db-instance-class db.t3.medium
```

### Step 4: S3 cost optimization for Phase 3 volume

Keep one shared media bucket, then add lifecycle rules:
1. Keep objects in **S3 Standard** for 30 days (best for frequent access).
2. Transition to **S3 Standard-IA** after 30 days.
3. Optionally transition to **S3 Glacier Instant Retrieval** after 180 days for old archives.
4. Abort incomplete multipart uploads after 7 days.

This keeps uploads fast while reducing long-tail storage cost.

### Phase 3 Architecture

```
              Internet
                 │
         ┌───────┼──────────┐
         │       │          │
  ┌──────▼───┐   │   ┌──────▼──────┐
  │CloudFront│   │   │    ALB      │
  │(frontend)│   │   │ (API only)  │
  └──────────┘   │   └──────┬──────┘
                 │          │
  ┌──────────────┼──────────┼─────────────────┐
  │  ECS + EC2 Auto Scaling Group             │
  │  (2-6 instances)                          │
  │                                            │
  │  Web:     2-10 tasks (auto-scaled)        │
  │  Celery:  1-4 tasks  (auto-scaled)        │
  │  Beat:    1 task      (fixed)             │
  └───────┬──────────────────┬────────────────┘
          │                  │
   ┌──────▼───────┐   ┌─────▼──────┐
   │RDS Postgres  │   │ElastiCache │
   │db.t3.large   │   │t3.medium   │
   │+ read replica│   └────────────┘
   └──────────────┘
```

---

## Phase 4 — Enterprise Growth (12,000 to 50,000 users)

**When to move:** You exceed ~12,000 registered users, or regular term traffic pushes web tasks above 70% CPU for sustained periods, or report/result release windows degrade API latency.

Goal: Scale capacity with **minimum downtime**, **minimum architecture change**, and **zero data loss**.

### Core strategy (keep what already works)

1. Keep the same app code, Docker images, API routes, and DB schema.
2. Keep ECS + ALB + CloudFront + S3 model from Phase 3.
3. Scale vertically and horizontally in-place (no platform rewrite).

### Target architecture

| Component | Phase 4 target |
|-----------|----------------|
| ECS node group | 4-12 instances (`m6i.large` / `m7i.large` class) |
| Web (Django) tasks | Min 8, Max 30 |
| Gateway tasks | Min 4, Max 12 |
| Celery workers | Min 4, Max 16 |
| Celery beat | 1 fixed |
| RDS primary | Multi-AZ `db.r6g.xlarge` |
| Read replicas | 1-2 replicas (`db.r6g.large` or `xlarge`) |
| Redis | `cache.r6g.large` (or larger if evictions appear) |

### Step 1: Scale ECS capacity with rolling updates

1. Add a second ECS capacity provider ASG using `m6i.large` (or ARM equivalent).
2. Keep existing `t3.medium` ASG during migration.
3. Increase service desired counts first, then gradually shift capacity weights to new ASG.
4. Use ECS rolling deployment (`minimumHealthyPercent=100`, `maximumPercent=200`) for no downtime.

### Step 2: Upgrade database with zero data loss controls

1. Upgrade RDS class during a low-traffic window to `db.r6g.xlarge` (Multi-AZ stays enabled).
2. Create 1-2 read replicas for heavy read paths (dashboards, reports, result views).
3. Keep writes strictly on primary.
4. Enable automated backups + PITR and take manual snapshot before each major change.

### Step 3: Queue isolation for predictable peak behavior

Split Celery queues:
1. `high`: critical user-facing tasks
2. `default`: normal async tasks
3. `bulk`: imports/report generation

Run dedicated worker pools so bulk jobs never starve login, billing, or core school operations.

### Step 4: Safer deploy and rollback posture

1. Use blue/green for API services in ECS (CodeDeploy or parallel ECS services + weighted target groups).
2. Keep schema changes backward compatible before traffic cutover.
3. Rollback plan: switch ALB weights back; no DB restore required for app rollback.

### Phase 4 expected smooth range

- Registered users: **12,000 to 50,000**
- Typical active users (school hours): **8-15%**
- Short release spikes: **up to ~6,000 concurrent** when autoscaling headroom is pre-warmed

---

## Phase 5 — National Scale (51,000 to 100,000 users)

**When to move:** You exceed ~50,000 registered users or approach regular 10k+ concurrent sessions and need reliable performance at national/regional scale.

Goal: Keep architecture familiar while adding stronger scaling primitives and resilience.

### Target architecture

| Component | Phase 5 target |
|-----------|----------------|
| ECS node group | 8-24 instances (`m6i.xlarge` / `m7i.xlarge` class) |
| Web (Django) tasks | Min 20, Max 80 |
| Gateway tasks | Min 8, Max 30 |
| Celery workers | Min 12, Max 40 |
| Celery beat | 1 fixed |
| RDS primary | Multi-AZ `db.r6g.2xlarge` |
| Read replicas | 2-4 replicas |
| Connection management | RDS Proxy or PgBouncer required |
| Redis | `cache.r6g.xlarge` (scale up based on memory + ops/sec) |

### Step 1: Traffic and failure-domain hardening

1. Spread ECS instances across at least 3 AZs.
2. Keep ALB cross-zone load balancing enabled.
3. Keep CloudFront + S3 for frontend/static offload.

### Step 2: Database pressure control

1. Route all heavy read endpoints to replicas.
2. Keep transaction-heavy writes on primary.
3. Add RDS Proxy/PgBouncer to smooth connection spikes from autoscaling tasks.
4. Add query performance alarms (p95 query time, lock waits, replica lag).

### Step 3: 15,000+ concurrent readiness

Before going live for this traffic level:
1. Run full load tests with exam-day traffic shape.
2. Pre-warm ECS desired counts before known peaks (results release windows).
3. Enable strict rate limits for non-critical endpoints.
4. Keep an emergency read-only mode toggle for non-essential write features.

### Step 4: Zero data loss operating policy

1. Multi-AZ primary remains mandatory.
2. PITR backups mandatory; validate restore quarterly.
3. Snapshot before every major infra/database change.
4. Use migration gating: schema migration success + replica lag health + API health checks before cutover.

### Phase 5 expected smooth range

- Registered users: **51,000 to 100,000**
- Typical active users (school hours): **8-15%**
- Concurrent users: supports **15,000+** with pre-warming, queue isolation, and DB read scaling enabled

---

## Monthly Cost by Phase (USD)

Estimates for `af-south-1`, excluding VAT/tax and unusual data-egress spikes.

| Phase | User range | Monthly USD |
|------|------------|-------------|
| Phase 1 | 0 to ~2,000 | **$108-$115** |
| Phase 2 | ~2,000 to ~5,000 | **~$187** |
| Phase 3 | ~5,000+ | **~$320-$620** |
| Phase 4 | 12,000 to 50,000 | **~$1,150-$2,850** |
| Phase 5 | 51,000 to 100,000 | **~$3,200-$7,900** |

**Important pricing drivers in Phases 4-5:** ECS instance count and class, RDS class + replicas, ALB LCUs, CloudFront/egress, and background processing volume.

---

## Change Summary Across Phases

| | Phase 1 → 2 | Phase 2 → 3 | Phase 3 → 4 | Phase 4 → 5 |
|---|---|---|---|---|
| **Docker images** | No change | No change | No change | No change |
| **Application code** | No change | No change | No change | No change |
| **Database schema** | No change | No change | No change | No change |
| **Connection strings** | No change | Add `DATABASE_READ_URL` (optional) | Same (+ replicas) | Same (+ proxy endpoint) |
| **CI/CD** | Replace SSH with `ecs update-service` + `s3 sync` | No change | Add blue/green controls | No change |
| **Infrastructure** | ECS + ALB + CloudFront | Auto-scaling policies | Larger ECS/RDS/Redis + replicas | Higher-capacity ECS/RDS/Redis + proxy |

**Zero application code changes across all five phases.**

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `School_system/Dockerfile` | Django multi-stage Docker build (builder → runtime) |
| `School_system/entrypoint.sh` | Container startup: collectstatic → migrate → gunicorn |
| `School_system/.env.example` | Template for all environment variables |
| `go-gateway/Dockerfile` | Go Gateway multi-stage build (~10MB image) |
| `go-gateway/main.go` | Gateway: JWT auth, routing, rate limiting, CORS |
| `go-workers/Dockerfile` | Go Workers multi-stage build (~10MB image) |
| `go-workers/main.go` | Bulk CSV imports: students, results, fees |
| `go-services/Dockerfile` | Go Services multi-stage build (~12MB image) |
| `go-services/main.go` | PDF reports, PayNow, email, WhatsApp handlers |
| `docker-compose.yml` | Dev compose: builds all services locally with Redis |
| `docker-compose.prod.yml` | Production compose: ECR images, external RDS/Redis |
| `deploy-ec2.sh` | Deploy script: all 4 images + frontend + SSL, with rollback |
| `.github/workflows/deploy.yml` | CI/CD: build → test → push to ECR → SSH deploy |
| `infrastructure/nginx/schoolhub.conf` | Nginx HTTP-only config (pre-SSL) |
| `infrastructure/nginx/schoolhub-ssl.conf` | Nginx HTTPS config (post-SSL) |
| `infrastructure/fix-ssl.sh` | SSL recovery: Nginx + Let's Encrypt + auto-renewal |

## Appendix: GitHub Actions Secrets

| Secret | Value | Phase |
|--------|-------|-------|
| `AWS_ACCESS_KEY_ID` | IAM access key | All |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | All |
| `AWS_STORAGE_BUCKET_NAME` | Media bucket name | All |
| `AWS_S3_REGION_NAME` | `af-south-1` | All |
| `EC2_HOST` | Elastic IP | Phase 1 only |
| `EC2_USER` | SSH user (optional, defaults to `ubuntu`) | Phase 1 only |
| `EC2_SSH_KEY` | Contents of `.pem` file | Phase 1 only |
| `CF_DISTRIBUTION_ID` | CloudFront distribution ID | Phase 2+ |

## Appendix: SSL Persistence

**Why the domain stays reachable after reboots:**

1. **Nginx** is a systemd service — starts automatically on boot
2. **SSL certs** live in `/etc/letsencrypt/` — persist across reboots
3. **certbot.timer** runs twice daily — auto-renews certs before expiry
4. **Post-renewal hook** at `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads Nginx after renewal
5. **Docker** services have `restart: unless-stopped` — restart on boot
6. **No Cloudflare** — DNS points directly to Elastic IP, eliminating SSL conflicts

If something goes wrong, one command fixes everything:
```bash
cd ~/my-school-hub && bash infrastructure/fix-ssl.sh
```
