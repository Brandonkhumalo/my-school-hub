# ── Build stage ──
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod ./
COPY go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /workers .

# ── Run stage (~10MB image) ──
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /workers /workers
EXPOSE 8081
CMD ["/workers"]
