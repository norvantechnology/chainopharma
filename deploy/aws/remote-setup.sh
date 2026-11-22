#!/usr/bin/env bash
# Runs ONCE on a fresh Ubuntu 22.04/24.04 host. Idempotent; does not wipe data.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/chainopharma}"
WEB_DIR="${WEB_DIR:-/var/www/chainopharma/frontend}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx curl ca-certificates gnupg rsync

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

mkdir -p "$APP_DIR" "$WEB_DIR"
chown -R ubuntu:ubuntu "$APP_DIR" "$WEB_DIR" 2>/dev/null || chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$APP_DIR" "$WEB_DIR" || true

# Ensure SSL helper files + certs exist before enabling HTTPS nginx config
if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
  mkdir -p /etc/letsencrypt
  printf '%s\n' 'ssl_protocols TLSv1.2 TLSv1.3;' 'ssl_prefer_server_ciphers off;' > /etc/letsencrypt/options-ssl-nginx.conf
fi
if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
fi
# Admin hostname may share the user cert until a dedicated cert is issued
if [[ -f /etc/letsencrypt/live/15-252-130-60.sslip.io/fullchain.pem ]] \
  && [[ ! -f /etc/letsencrypt/live/admin.15-252-130-60.sslip.io/fullchain.pem ]]; then
  mkdir -p /etc/letsencrypt/live/admin.15-252-130-60.sslip.io
  ln -sfn /etc/letsencrypt/live/15-252-130-60.sslip.io/fullchain.pem \
    /etc/letsencrypt/live/admin.15-252-130-60.sslip.io/fullchain.pem
  ln -sfn /etc/letsencrypt/live/15-252-130-60.sslip.io/privkey.pem \
    /etc/letsencrypt/live/admin.15-252-130-60.sslip.io/privkey.pem
fi

if [[ -f /tmp/nginx.chainopharma.conf ]]; then
  if [[ -f /etc/letsencrypt/live/15-252-130-60.sslip.io/fullchain.pem ]]; then
    cp /tmp/nginx.chainopharma.conf /etc/nginx/sites-available/chainopharma
    ln -sfn /etc/nginx/sites-available/chainopharma /etc/nginx/sites-enabled/chainopharma
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl enable nginx
    systemctl reload nginx
  else
    echo "WARN: SSL certs missing; skipping nginx HTTPS site install for now"
  fi
fi

echo "remote-setup complete"
