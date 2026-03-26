# My School Hub — Deployment Guide

Three-phase deployment: start cheap on a single EC2, scale to ECS with auto-scaling — **zero application code changes** between phases.

**AWS Region:** `af-south-1` (Cape Town) — lowest latency to Zimbabwe.

**Domain:** `myschoolhub.co.zw` — DNS points directly to Elastic IP (no Cloudflare).

---

## Table of Contents

1. [Phase 1 — Launch (single EC2)](#phase-1--launch-0-to-500-users)
2. [Phase 2 — Growth (ECS + ALB)](#phase-2--growth-500-to-5000-users)
3. [Phase 3 — Scale (auto-scaling)](#phase-3--scale-5000-users)
4. [Change Summary](#change-summary-across-phases)

---

## Prerequisites (All Phases)

- AWS account with `af-south-1` region enabled (opt-in required)
- GitHub repo access
- Domain: `myschoolhub.co.zw` — you'll point the A record to your Elastic IP
- PayNow Zimbabwe merchant account (for school payments)
- Resend account for transactional email

---

## Phase 1 — Launch (0 to ~500 users)

Single EC2 instance hosting **both** the React frontend and Django backend, with Nginx + Let's Encrypt SSL. Managed RDS + ElastiCache. ~$30-43/month.

```
        Internet
           │
     ┌─────▼─────┐
     │  Elastic   │
     │    IP      │
     └─────┬─────┘
           │
  ┌────────▼────────────────────────────────────┐
  │  EC2 t3.small  (2 vCPU, 2GB RAM)           │
  │                                              │
  │  Nginx (host)                                │
  │    ├── :443 → SSL (Let's Encrypt)           │
  │    ├── /          → React SPA (static)      │
  │    ├── /api/      → Django :8000 (Docker)   │
  │    ├── /admin/    → Django :8000 (Docker)   │
  │    └── /health/   → Django :8000 (Docker)   │
  │                                              │
  │  Docker (docker-compose.prod.yml)            │
  │    ├── web         (Django + Gunicorn)       │
  │    ├── celery      (background tasks)        │
  │    └── celery-beat (periodic tasks)          │
  └──────┬──────────────┬────────────────────────┘
         │              │
  ┌──────▼──────┐ ┌─────▼──────┐
  │RDS Postgres │ │ElastiCache │
  │db.t3.micro  │ │t3.micro    │
  │             │ │ Redis 7    │
  └─────────────┘ └────────────┘
```

### Step 1: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `schoolhub-backend` |
| AMI | Ubuntu 22.04 LTS |
| Instance type | t3.small (2 vCPU, 2GB RAM) |
| Key pair | Create one (for SSH + CI/CD) or **Proceed without** (browser SSH only) |
| Storage | 20 GB gp3 |

3. **Network Settings** → use **Default VPC**, then add security group rules:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | 0.0.0.0/0 | EC2 Instance Connect / SSH |
| HTTP | 80 | 0.0.0.0/0 | Nginx (redirects to HTTPS) |
| HTTPS | 443 | 0.0.0.0/0 | Nginx (SSL termination) |

4. Click **Launch Instance**
5. If you created a **key pair**, download the `.pem` file and save it securely — you'll need it for SSH and CI/CD.
6. Go to **Elastic IPs** → **Allocate** → **Associate** to this instance

> **Save for `.env`:** Note your **Elastic IP** (e.g., `3.105.xx.xx`) — you'll add it to `ALLOWED_HOSTS` in `.env`.

7. Note the **Security Group ID** (e.g., `sg-0abc123`) — you'll need it for RDS and ElastiCache

### Step 2: Point DNS to Elastic IP

Go to your domain registrar for `myschoolhub.co.zw` and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<YOUR_ELASTIC_IP>` | 300 |
| A | www | `<YOUR_ELASTIC_IP>` | 300 |

> **Important:** Do NOT use Cloudflare proxy (orange cloud). DNS-only (grey cloud) or use your registrar's DNS directly. Cloudflare's SSL conflicts with Let's Encrypt and causes the domain to become unreachable after reboots.

### Step 3: Create RDS PostgreSQL

1. Go to **AWS Console → RDS → Create database**
2. Configure:

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 15 |
| Template | Free tier |
| DB instance class | db.t3.micro |
| Storage | 20 GB gp3 |
| DB instance identifier | `schoolhub-db` |
| Master username | `postgres` |
| Master password | (generate a strong password, save it) |
| Initial database name | `schoolhub` |
| Public access | No |
| VPC | Default VPC (**same as EC2**) |
| VPC security group | Create new → allow port **5432** from your EC2 security group |
| Backup retention | 7 days |
| Enable automated backups | Yes |

3. Click **Create database**, wait 5-10 minutes
4. Copy the **Endpoint** from the database details page (e.g., `schoolhub-db.xxxxx.af-south-1.rds.amazonaws.com`)

> **Save for `.env`:** You now have two pieces — the **RDS Endpoint** and the **Master password** you set above. You'll combine them into the `DATABASE_URL` in `.env`:
> ```
> DATABASE_URL=postgresql://postgres:<RDS_PASSWORD>@<RDS_ENDPOINT>:5432/schoolhub
> ```

### Step 4: Create ElastiCache Redis

1. Go to **AWS Console → ElastiCache → Create cache**
2. Configure:

| Setting | Value |
|---------|-------|
| Cluster engine | Redis |
| Node type | cache.t3.micro |
| Number of replicas | 0 |
| Name | `schoolhub-redis` |
| Subnet group | Default |
| Security group | Create new → allow port **6379** from your EC2 security group |

3. Copy the **Primary Endpoint** (e.g., `schoolhub-redis.xxxxx.af-south-1.cache.amazonaws.com`)

> **Save for `.env`:** You'll use this endpoint for both `REDIS_URL` and `CELERY_BROKER_URL` in `.env`:
> ```
> REDIS_URL=redis://<ELASTICACHE_ENDPOINT>:6379/0
> CELERY_BROKER_URL=redis://<ELASTICACHE_ENDPOINT>:6379/0
> ```

### Step 5: Create ECR Repository

Go to **AWS Console → CloudShell** (top right, terminal icon) and run:

```bash
aws ecr create-repository --repository-name schoolhub-web --region af-south-1
```

Copy the registry URI (e.g., `123456789.dkr.ecr.af-south-1.amazonaws.com`)

> **Save for `.env`:** This is your `ECR_REGISTRY` value in `.env`:
> ```
> ECR_REGISTRY=123456789.dkr.ecr.af-south-1.amazonaws.com
> ```

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
sudo apt-get update && sudo apt-get install -y nginx certbot python3-certbot-nginx awscli
```

Then configure AWS CLI:

```bash
aws configure
```

Enter: Access Key ID, Secret Key, region `af-south-1`, output `json`.

> **Note:** The AWS Access Key ID and Secret Access Key used here are also needed as GitHub Actions secrets for CI/CD (Step 14). Save them somewhere secure — you'll need them again.

### Step 8: Clone and Configure

```bash
git clone https://github.com/YOUR_USERNAME/my-school-hub.git
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
ALLOWED_HOSTS=myschoolhub.co.zw,www.myschoolhub.co.zw,<ELASTIC_IP from Step 1>

# ── Database (from Step 3 — RDS Endpoint + Master Password) ───
DATABASE_URL=postgresql://postgres:<RDS_PASSWORD from Step 3>@<RDS_ENDPOINT from Step 3>:5432/schoolhub

# ── Redis (from Step 4 — ElastiCache Primary Endpoint) ────────
REDIS_URL=redis://<ELASTICACHE_ENDPOINT from Step 4>:6379/0
CELERY_BROKER_URL=redis://<ELASTICACHE_ENDPOINT from Step 4>:6379/0

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
> | `ALLOWED_HOSTS` | Elastic IP from Step 1 |
> | `DATABASE_URL` | RDS Endpoint + Password from Step 3 |
> | `REDIS_URL` | ElastiCache Endpoint from Step 4 |
> | `CELERY_BROKER_URL` | Same as `REDIS_URL` |
> | `ECR_REGISTRY` | ECR Registry URI from Step 5 |
> | `ResendEmailApiKey` | Your Resend dashboard |
> | `CORS_ALLOWED_ORIGINS` | Your domain (pre-filled) |
> | `CSRF_TRUSTED_ORIGINS` | Your domain (pre-filled) |

### Step 9: Build and Deploy Backend

```bash
cd ~/my-school-hub

# Login to ECR
source School_system/.env
aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push Docker image
docker build -t $ECR_REGISTRY/schoolhub-web:latest ./School_system/
docker push $ECR_REGISTRY/schoolhub-web:latest

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
# Health check (via Nginx/SSL)
curl -I https://myschoolhub.co.zw/health/

# Health check (direct to Django)
curl http://localhost:8000/health/

# Docker service status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs web

# SSL certificate status
sudo certbot certificates

# Nginx status
sudo systemctl status nginx
```

Expected output from `docker compose ps`:

```
NAME          STATUS
web           Up (healthy)
celery        Up
celery-beat   Up
```

### Step 13: Create Admin User + Seed Data

```bash
# Create superadmin
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser

# Seed demo data (optional)
docker compose -f docker-compose.prod.yml exec web python manage.py populate_demo_data
docker compose -f docker-compose.prod.yml exec web python manage.py generate_parents
```

### Step 14: Set Up CI/CD (GitHub Actions)

The workflow file already exists at `.github/workflows/deploy.yml`. You just need to add secrets:

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add these secrets using credentials you already have from previous steps:

| Secret | Value | Where you got it |
|--------|-------|------------------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key | Same key you used in `aws configure` (Step 7) |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key | Same key you used in `aws configure` (Step 7) |
| `EC2_HOST` | Your Elastic IP | From Step 1 (also in your `.env` → `ALLOWED_HOSTS`) |
| `EC2_SSH_KEY` | Full contents of your `.pem` file | The key pair you downloaded in Step 1 — open the `.pem` file, copy everything including `-----BEGIN` and `-----END` lines |

> **Don't have these anymore?**
> - **AWS keys:** Go to **IAM → Users → your user → Security credentials → Create access key**. Save both the Access Key ID and Secret Access Key — you can only see the secret once. Also re-run `aws configure` on the EC2 with the new key.
> - **`.pem` file:** If you lost it, you can't recover it. Create a new key pair in **EC2 → Key Pairs**, then update the EC2 instance to use it.
> - **Elastic IP:** Go to **EC2 → Elastic IPs** — it's listed there. Also in your `.env` under `ALLOWED_HOSTS`.

Now every push to `main` automatically:
1. Runs all tests against a fresh PostgreSQL database
2. Builds the Docker image and pushes to ECR
3. SSHs into EC2, pulls the new image, rebuilds the frontend, and reloads Nginx

### Step 15: Set Up S3 for Media Files (optional)

Uploaded files (homework, etc.) are lost if the EC2 disk fails. To persist them in S3:

1. **S3 → Create bucket**: `schoolhub-media-af-south-1`
2. Block all public access
3. Create IAM role for EC2 with S3 access, attach to EC2 instance
4. **Add the bucket name to your `.env`** (`nano ~/my-school-hub/School_system/.env`):

```env
AWS_STORAGE_BUCKET_NAME=schoolhub-media-af-south-1
AWS_S3_REGION_NAME=af-south-1
```

5. Restart to pick up the new `.env` values: `docker compose -f docker-compose.prod.yml up -d`

No code changes — the app auto-detects the bucket name.

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
| EC2 t3.small | ~$15 |
| RDS db.t3.micro (free tier yr 1) | $0 → $13 |
| ElastiCache cache.t3.micro | ~$13 |
| Elastic IP | $0 (while attached) |
| ECR + Route 53 | ~$2 |
| **Total** | **~$30-43/mo** |

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

## Phase 2 — Growth (~500 to ~5,000 users)

**When to move:** EC2 CPU consistently above 70%, or response times increasing.

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
                │   2x t3.small instances              │
                │                                       │
                │   Web (Django):    2 tasks            │
                │   Celery Worker:   1 task             │
                │   Celery Beat:     1 task             │
                └──────┬──────────────┬────────────────┘
                       │              │
                ┌──────▼──────┐ ┌─────▼──────┐
                │RDS Postgres │ │ElastiCache │
                │db.t3.small  │ │t3.small    │
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
4. Create **target group** for web service (port 8000, health check: `/health/`)

### Step 2: Move Frontend to S3 + CloudFront

1. **S3 → Create bucket**: `schoolhub-frontend`
2. Enable static website hosting
3. Upload `dist/` contents to the bucket
4. **CloudFront → Create distribution** → origin: the S3 bucket
5. Update DNS: `myschoolhub.co.zw` → CloudFront, `api.myschoolhub.co.zw` → ALB

### Step 3: Create ECS Cluster + Task Definitions

Same Docker image, different task definitions:

| Service | Image | Memory | CPU | Port | Load balanced |
|---------|-------|--------|-----|------|---------------|
| web | `schoolhub-web:latest` | 512 MB | 512 | 8000 | Yes (ALB) |
| celery | `schoolhub-web:latest` | 512 MB | 256 | — | No |
| celery-beat | `schoolhub-web:latest` | 256 MB | 128 | — | No |

### Step 4: Upgrade RDS and ElastiCache

```bash
aws rds modify-db-instance --db-instance-identifier schoolhub-db --db-instance-class db.t3.small --multi-az --apply-immediately
aws elasticache modify-cache-cluster --cache-cluster-id schoolhub-redis --cache-node-type cache.t3.small --apply-immediately
```

### Step 5: Update CI/CD

In `.github/workflows/deploy.yml`, replace the SSH deploy step with:

```yaml
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster schoolhub --service schoolhub-web --force-new-deployment --region af-south-1
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
| CI/CD | SSH to EC2 | `ecs update-service` + `s3 sync` | **1 step replaced** |

### Phase 2 Monthly Cost

| Service | Cost |
|---------|------|
| EC2 2x t3.small (ECS) | ~$30 |
| ALB | ~$18 |
| RDS db.t3.small (Multi-AZ) | ~$26 |
| ElastiCache t3.small | ~$25 |
| CloudFront + S3 | ~$2 |
| ECR + data transfer | ~$5 |
| **Total** | **~$106/mo** |

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

1. Create Launch Template (ECS-optimized AMI, t3.small)
2. Create ASG: min 2, max 6, target CPU 70%
3. Link ASG as ECS capacity provider

### Step 3: Add Read Replica (optional)

When report generation slows down writes:

```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier schoolhub-db-read \
  --source-db-instance-identifier schoolhub-db \
  --db-instance-class db.t3.small
```

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
   │db.t3.medium  │   │t3.small    │
   │+ read replica│   └────────────┘
   └──────────────┘
```

---

## Change Summary Across Phases

| | Phase 1 → Phase 2 | Phase 2 → Phase 3 |
|---|---|---|
| **Docker images** | No change | No change |
| **Application code** | No change | No change |
| **Database schema** | No change | No change |
| **Connection strings** | No change | Add `DATABASE_READ_URL` (optional) |
| **CI/CD** | Replace SSH step with `ecs update-service` + `s3 sync` | No change |
| **Infrastructure** | Create ECS + ALB + CloudFront | Add auto-scaling policies |

**Zero application code changes across all three phases.**

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `School_system/Dockerfile` | Multi-stage Docker build (builder → runtime) |
| `School_system/entrypoint.sh` | Container startup: collectstatic → migrate → gunicorn |
| `School_system/.env.example` | Template for all environment variables |
| `docker-compose.prod.yml` | Production compose (ECR images, external RDS/Redis) |
| `deploy-ec2.sh` | Deploy script: backend + frontend + SSL, with rollback |
| `.github/workflows/deploy.yml` | CI/CD: test → build → push → SSH deploy |
| `infrastructure/nginx/schoolhub.conf` | Nginx HTTP-only config (pre-SSL) |
| `infrastructure/nginx/schoolhub-ssl.conf` | Nginx HTTPS config (post-SSL) |
| `infrastructure/fix-ssl.sh` | SSL recovery: Nginx + Let's Encrypt + auto-renewal |

## Appendix: GitHub Actions Secrets

| Secret | Value | Phase |
|--------|-------|-------|
| `AWS_ACCESS_KEY_ID` | IAM access key | All |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | All |
| `EC2_HOST` | Elastic IP | Phase 1 only |
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
