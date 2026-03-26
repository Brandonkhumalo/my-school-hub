#!/bin/bash
# ============================================================================
# My School Hub — SSL Recovery Script
#
# Run this on the EC2 server when myschoolhub.co.zw becomes unreachable after
# a deploy or reboot. It restores the nginx config and reinstalls Let's Encrypt
# certificates if needed.
#
# Usage:  ssh into the server, then:
#   cd ~/my-school-hub && bash infrastructure/fix-ssl.sh
# ============================================================================

set -e

DOMAIN="myschoolhub.co.zw"
NGINX_SITE="/etc/nginx/sites-available/schoolhub"
NGINX_ENABLED="/etc/nginx/sites-enabled/schoolhub"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
REPO_DIR="$HOME/my-school-hub"
REPO_SSL_CONF="$REPO_DIR/infrastructure/nginx/schoolhub-ssl.conf"
REPO_HTTP_CONF="$REPO_DIR/infrastructure/nginx/schoolhub.conf"

echo "============================================"
echo "  My School Hub — SSL Recovery"
echo "============================================"
echo ""

# Step 1: Ensure nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "[1/7] Installing nginx..."
    sudo apt-get update -qq && sudo apt-get install -y nginx
else
    echo "[1/7] nginx is installed"
fi

# Step 2: Ensure certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "[2/7] Installing certbot..."
    sudo apt-get update -qq && sudo apt-get install -y certbot python3-certbot-nginx
else
    echo "[2/7] certbot is installed"
fi

# Step 3: Create certbot webroot directory
sudo mkdir -p /var/www/certbot
echo "[3/7] Certbot webroot ready"

# Step 4: Ensure frontend build exists
if [ -d "$REPO_DIR/dist" ]; then
    echo "[4/7] Frontend build exists — syncing to /var/www/schoolhub/dist"
    sudo mkdir -p /var/www/schoolhub
    sudo cp -r "$REPO_DIR/dist" /var/www/schoolhub/
else
    echo "[4/7] WARNING: No frontend build found at $REPO_DIR/dist"
    echo "       Run 'cd $REPO_DIR && npm ci && npm run build' first"
    sudo mkdir -p /var/www/schoolhub/dist
    echo "<h1>My School Hub — Frontend not built yet</h1>" | sudo tee /var/www/schoolhub/dist/index.html > /dev/null
fi

# Step 5: Check if SSL certs exist
if [ -d "$CERT_DIR" ] && [ -f "$CERT_DIR/fullchain.pem" ]; then
    echo "[5/7] SSL certificates exist — using SSL config"
    sudo cp "$REPO_SSL_CONF" "$NGINX_SITE"
else
    echo "[5/7] No SSL certificates found — installing fresh certs..."

    # First deploy HTTP-only config so certbot can verify the domain
    sudo cp "$REPO_HTTP_CONF" "$NGINX_SITE"

    # Ensure the site is enabled
    if [ ! -L "$NGINX_ENABLED" ]; then
        sudo ln -sf "$NGINX_SITE" "$NGINX_ENABLED"
    fi

    # Remove default site if it conflicts
    sudo rm -f /etc/nginx/sites-enabled/default

    # Test and reload nginx with HTTP config
    sudo nginx -t && sudo systemctl reload nginx

    # Request SSL certificate from Let's Encrypt
    echo ""
    echo "  Requesting SSL certificate for $DOMAIN..."
    echo ""
    sudo certbot certonly \
        --webroot \
        -w /var/www/certbot \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email brandon@tishanyq.co.zw \
        --no-eff-email

    # Now switch to SSL config
    sudo cp "$REPO_SSL_CONF" "$NGINX_SITE"
    echo "[5/7] SSL certificates installed"
fi

# Step 6: Ensure site is enabled and default is removed
if [ ! -L "$NGINX_ENABLED" ]; then
    sudo ln -sf "$NGINX_SITE" "$NGINX_ENABLED"
fi
sudo rm -f /etc/nginx/sites-enabled/default
echo "[6/7] Site enabled"

# Step 7: Set up auto-renewal timer (idempotent)
if ! sudo systemctl is-enabled certbot.timer &> /dev/null 2>&1; then
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer
    echo "[7/7] Certbot auto-renewal timer enabled"
else
    echo "[7/7] Certbot auto-renewal timer already active"
fi

# Certbot post-renewal hook — reload nginx after cert renewal
RENEW_HOOK="/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh"
if [ ! -f "$RENEW_HOOK" ]; then
    sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    echo '#!/bin/bash' | sudo tee "$RENEW_HOOK" > /dev/null
    echo 'nginx -t && systemctl reload nginx' | sudo tee -a "$RENEW_HOOK" > /dev/null
    sudo chmod +x "$RENEW_HOOK"
    echo "       Post-renewal nginx reload hook installed"
fi

# Test and reload nginx
echo ""
echo "Testing and reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "============================================"
echo "  Done! https://$DOMAIN should be live"
echo "============================================"
echo ""
echo "  Verify:  curl -I https://$DOMAIN"
echo ""
echo "  If certs expire, renew with:"
echo "    sudo certbot renew"
echo ""
echo "  Cert auto-renewal status:"
echo "    sudo systemctl status certbot.timer"
echo ""
