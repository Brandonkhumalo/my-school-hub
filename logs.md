# Docker Compose Log Commands

Service names from `DEPLOYMENT.md`:
- `gateway`
- `web`
- `workers`
- `services`
- `celery`
- `celery-beat`

Dev-only service:
- `redis` (exists in `docker-compose.yml`, not in `docker-compose.prod.yml`)

## Production (`docker-compose.prod.yml`)

### All containers

```bash
# Last 1 hour
docker compose -f docker-compose.prod.yml logs --since 1h

# Last 1 hour + timestamps
docker compose -f docker-compose.prod.yml logs --since 1h -t

# Last 1 hour + follow live
docker compose -f docker-compose.prod.yml logs --since 1h -f

# Last 200 lines per container
docker compose -f docker-compose.prod.yml logs --tail 200
```

### Specific container/service

```bash
# gateway
docker compose -f docker-compose.prod.yml logs --since 1h gateway

# web (Django)
docker compose -f docker-compose.prod.yml logs --since 1h web

# workers
docker compose -f docker-compose.prod.yml logs --since 1h workers

# services
docker compose -f docker-compose.prod.yml logs --since 1h services

# celery
docker compose -f docker-compose.prod.yml logs --since 1h celery

# celery-beat
docker compose -f docker-compose.prod.yml logs --since 1h celery-beat
```

### Multiple specific services

```bash
docker compose -f docker-compose.prod.yml logs --since 1h web celery
docker compose -f docker-compose.prod.yml logs --since 1h gateway services
```

## Development (`docker-compose.yml`)

### All containers

```bash
# Last 1 hour
docker compose logs --since 1h

# Last 1 hour + follow live
docker compose logs --since 1h -f
```

### Specific container/service

```bash
docker compose logs --since 1h gateway
docker compose logs --since 1h web
docker compose logs --since 1h workers
docker compose logs --since 1h services
docker compose logs --since 1h celery
docker compose logs --since 1h celery-beat
docker compose logs --since 1h redis
```

## Helpful options

```bash
# Show only service names
docker compose -f docker-compose.prod.yml ps --services

# Remove ANSI colors when saving to file
docker compose -f docker-compose.prod.yml logs --since 1h --no-color > prod-logs-1h.txt

# Save one service logs
docker compose -f docker-compose.prod.yml logs --since 1h --no-color web > web-logs-1h.txt
```
