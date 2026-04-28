# EC2 Disk Space Management (Safe for This Repo)

This project uses:
- RDS + ElastiCache in production (no Docker DB volume by default in prod compose).
- Bind-mounted media at `/var/www/schoolhub/media` (must never be deleted).

Safety rules before any cleanup:
- Do not run blanket destructive commands that remove all volumes or temp paths.
- Never delete or truncate anything under `/var/www/schoolhub/media`.
- Prefer diagnostics first, then targeted cleanup.

## 1. Diagnose — See What's Eating Space

```bash
# Overall disk usage
df -h

# Docker breakdown (images, containers, volumes, cache)
docker system df -v

# Top 20 biggest directories on the whole system
du -h / --max-depth=4 2>/dev/null | sort -rh | head -20

# Top 20 biggest files anywhere on the system
find / -type f -printf '%s %p\n' 2>/dev/null | sort -rn | head -20 | awk '{printf "%.1fMB %s\n", $1/1048576, $2}'

# How much space Docker volumes are using individually
docker volume ls -q | xargs -I{} docker volume inspect {} --format '{{ .Name }}: {{ .Mountpoint }}' 2>/dev/null

# Size of each Docker volume on disk
du -sh /var/lib/docker/volumes/*/  2>/dev/null | sort -rh | head -20

# Size of all Docker images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -rh
```

---

## 2. Docker — Remove a Specific Volume

```bash
# List all volumes first
docker volume ls

# Find which container uses the volume
docker ps -a --filter volume=VOLUME_NAME

# Remove a specific volume (replace VOLUME_NAME)
docker volume rm VOLUME_NAME

# Remove multiple specific volumes
docker volume rm VOLUME_NAME_1 VOLUME_NAME_2 VOLUME_NAME_3
```

---

## 3. Docker — Remove Only Unused / Dangling Artifacts (Safer)

```bash
# Removes only volumes NOT attached to any container
docker volume prune -f

# Remove unused images, stopped containers, networks, dangling volumes
docker system prune -f

# Remove ALL unused images (not just dangling) + everything above
docker system prune -a -f

# Optional: include unused volumes only if you have confirmed they are not needed
# docker system prune -a --volumes -f
```

---

## 4. Logs — Reduce System Logs (Do Not Nuke Everything)

```bash
# Rotate and keep only recent journal logs
sudo journalctl --rotate
sudo journalctl --vacuum-time=7d

# Delete rotated/compressed logs older than 7 days
sudo find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.old" \) -mtime +7 -delete

# Clear apt cache
sudo apt-get clean
sudo apt-get autoremove -y

# Verify
du -sh /var/log/
```

---

## 5. Logs — Keep by Retention Window

```bash
# Keep logs from the last N days (change the number as needed)
sudo journalctl --vacuum-time=30d   # recommended baseline
sudo journalctl --vacuum-time=7d    # more aggressive
sudo journalctl --vacuum-time=30d   # keep last 30 days
sudo journalctl --vacuum-time=3d    # keep last 3 days
sudo journalctl --vacuum-time=1d    # keep last 24 hours

# Delete log files older than N days
sudo find /var/log -type f -mtime +30 -delete   # older than 30 days
sudo find /var/log -type f -mtime +7 -delete    # older than 7 days

# Delete rotated/compressed logs older than 7 days
sudo find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.old" \) -mtime +7 -delete

# Cap journal size going forward (keeps total journal under 200MB)
sudo journalctl --vacuum-size=200M
```

---

## 6. Docker Container Logs — Clear Oversized JSON Logs

```bash
# See which container logs are biggest
du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -rh | head -10

# Clear log for a specific container (replace CONTAINER_ID)
sudo truncate -s 0 /var/lib/docker/containers/CONTAINER_ID/*-json.log

# Clear ALL container logs at once
sudo find /var/lib/docker/containers/ -name "*-json.log" -exec truncate -s 0 {} \;
```

To limit container log size going forward, add this to each service in `docker-compose.yml`:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 7. One-Shot Safer Cleanup Script

Runs safer cleanup in one go. Before/after disk usage printed automatically.

```bash
#!/bin/bash
set -e

echo "=== BEFORE ===" && df -h /

# Guardrail: never touch media mount
echo "Media dir size (must be preserved):"
du -sh /var/www/schoolhub/media 2>/dev/null || true

# Docker — remove unused images/containers/networks
docker system prune -a -f

# Journal logs — keep last 7 days only
sudo journalctl --vacuum-time=7d

# Rotated and compressed log files
sudo find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.2" -o -name "*.old" \) -mtime +7 -delete

# APT cache
sudo apt-get clean
sudo apt-get autoremove -y

echo "=== AFTER ===" && df -h /
```

Save and run:

```bash
chmod +x cleanup.sh
sudo ./cleanup.sh
```
