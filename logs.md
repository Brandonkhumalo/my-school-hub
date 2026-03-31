# Docker Compose Log Commands

## All Services

```bash
# Last 10 minutes
docker compose logs --since 10m

# Last 30 minutes
docker compose logs --since 30m

# Last 1 hour
docker compose logs --since 1h

# Last 6 hours
docker compose logs --since 6h

# Last 24 hours (1 day)
docker compose logs --since 24h

# Follow (live) — last 10 minutes then keep streaming
docker compose logs --since 10m -f
```

## Specific Service

Replace `<service>` with: `web`, `redis`, `celery`, `celery-beat`

```bash
# Last 10 minutes
docker compose logs --since 10m <service>

# Last 30 minutes
docker compose logs --since 30m <service>

# Last 1 hour
docker compose logs --since 1h <service>

# Last 24 hours
docker compose logs --since 24h <service>

# Follow (live)
docker compose logs --since 10m -f <service>
```

### Examples

```bash
# Web server logs for the last hour
docker compose logs --since 1h web

# Celery worker logs for the last 30 minutes (live)
docker compose logs --since 30m -f celery

# Redis logs for the last day
docker compose logs --since 24h redis

# Celery beat logs for the last 10 minutes
docker compose logs --since 10m celery-beat
```

## Useful Flags

| Flag | Description |
|------|-------------|
| `-f` | Follow / stream new logs live |
| `--since 10m` | Logs from the last 10 minutes |
| `--since 1h` | Logs from the last 1 hour |
| `--since 24h` | Logs from the last 24 hours |
| `--tail 100` | Show only the last 100 lines |
| `--no-color` | Plain text (useful for piping to a file) |
| `-t` | Show timestamps |

## Save Logs to a File

```bash
docker compose logs --since 1h web --no-color > web-logs.txt
docker compose logs --since 24h --no-color > all-logs.txt
```
