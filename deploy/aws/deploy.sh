#!/usr/bin/env bash
# Redeploy Chaino Pharma user + admin (frontend/backend) to the existing low-cost EC2.
# Safe: never deletes the instance, volumes, DB, or remote uploads. Only updates app files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$ROOT/deploy/aws/.state"
USER_BACKEND="$ROOT/user/backend"
USER_FRONTEND="$ROOT/user/frontend"
ADMIN_BACKEND="$ROOT/admin/backend"
ADMIN_FRONTEND="$ROOT/admin/frontend"

DEPLOY_HOST="${DEPLOY_HOST:-}"
SSH_KEY="${SSH_KEY:-}"
if [[ -z "$SSH_KEY" ]]; then
  if [[ -f "$STATE_DIR/chainopharma-ec2.pem" ]]; then
    SSH_KEY="$STATE_DIR/chainopharma-ec2.pem"
  else
    SSH_KEY="$STATE_DIR/lightsail-default.pem"
  fi
fi
APP_DIR="${APP_DIR:-/opt/chainopharma}"
WEB_DIR="${WEB_DIR:-/var/www/chainopharma/frontend}"
ADMIN_WEB_DIR="${ADMIN_WEB_DIR:-/var/www/chainopharma/admin}"
REMOTE_USER_HINT="${REMOTE_USER_HINT:-ubuntu}"

if [[ -z "$DEPLOY_HOST" && -f "$STATE_DIR/public_ip" ]]; then
  IP="$(tr -d '[:space:]' < "$STATE_DIR/public_ip")"
  DEPLOY_HOST="${REMOTE_USER_HINT}@${IP}"
fi

if [[ -z "$DEPLOY_HOST" ]]; then
  cat >&2 <<'EOF'
Missing DEPLOY_HOST.

Examples:
  DEPLOY_HOST=ubuntu@1.2.3.4 SSH_KEY=~/.ssh/key.pem ./deploy/aws/deploy.sh

Or run ./deploy/aws/provision.sh first.
EOF
  exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
if [[ -f "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

ssh_cmd() { ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" "$@"; }
scp_cmd() { scp "${SSH_OPTS[@]}" "$@"; }
rsync_cmd() { rsync -az --delete --exclude node_modules --exclude .git --exclude dist -e "ssh ${SSH_OPTS[*]}" "$@"; }

HOST_ONLY="${DEPLOY_HOST##*@}"
# Prefer stable HTTPS hostname (sslip.io) — never default to bare http://IP
PUBLIC_HOST="${PUBLIC_HOST:-15-252-130-60.sslip.io}"
ADMIN_PUBLIC_HOST="${ADMIN_PUBLIC_HOST:-admin.15-252-130-60.sslip.io}"
PUBLIC_URL="${PUBLIC_URL:-https://${PUBLIC_HOST}}"
ADMIN_PUBLIC_URL="${ADMIN_PUBLIC_URL:-https://${ADMIN_PUBLIC_HOST}}"
API_BASE="${API_BASE:-$PUBLIC_URL}"
ADMIN_API_BASE="${ADMIN_API_BASE:-$ADMIN_PUBLIC_URL}"

echo "==> Target: $DEPLOY_HOST"
echo "==> User URL:  $PUBLIC_URL"
echo "==> Admin URL: $ADMIN_PUBLIC_URL"

# Ensure remote packages/nginx once (idempotent). Nginx template includes SSL paths.
echo "==> Ensuring remote runtime (nginx/node/pm2)…"
scp_cmd "$ROOT/deploy/aws/nginx.chainopharma.conf" "$ROOT/deploy/aws/remote-setup.sh" "$DEPLOY_HOST:/tmp/"
ssh_cmd "sudo bash /tmp/remote-setup.sh"

# ---------- User backend ----------
echo "==> Syncing user backend…"
ssh_cmd "mkdir -p '$APP_DIR/backend'"
rsync_cmd --exclude '.env' "$USER_BACKEND/" "$DEPLOY_HOST:$APP_DIR/backend/"

if [[ "${FORCE_ENV:-0}" == "1" ]] || ! ssh_cmd "test -f '$APP_DIR/backend/.env'"; then
  echo "==> Uploading user backend .env"
  scp_cmd "$USER_BACKEND/.env" "$DEPLOY_HOST:$APP_DIR/backend/.env"
else
  echo "==> Keeping existing remote user .env (set FORCE_ENV=1 to overwrite)"
fi

ssh_cmd "grep -q '^PUBLIC_API_URL=' '$APP_DIR/backend/.env' \
  && sed -i 's|^PUBLIC_API_URL=.*|PUBLIC_API_URL=$API_BASE|' '$APP_DIR/backend/.env' \
  || echo 'PUBLIC_API_URL=$API_BASE' >> '$APP_DIR/backend/.env'"

echo "==> Installing user backend deps + PM2…"
ssh_cmd "cd '$APP_DIR/backend' && npm ci --omit=dev || npm install --omit=dev"
ssh_cmd "cd '$APP_DIR/backend' && (pm2 describe chainopharma-api >/dev/null 2>&1 \
  && pm2 restart chainopharma-api --update-env \
  || STAGE=local PORT=4000 pm2 start local-server.js --name chainopharma-api) \
  && pm2 save"

# ---------- Admin backend ----------
echo "==> Syncing admin backend…"
ssh_cmd "mkdir -p '$APP_DIR/admin-backend'"
rsync_cmd --exclude '.env' "$ADMIN_BACKEND/" "$DEPLOY_HOST:$APP_DIR/admin-backend/"
ssh_cmd "cd '$APP_DIR/admin-backend' && npm ci --omit=dev || npm install --omit=dev"
ssh_cmd "cd '$APP_DIR/admin-backend' && (pm2 describe chainopharma-admin >/dev/null 2>&1 \
  && pm2 restart chainopharma-admin --update-env \
  || STAGE=local PORT=4005 pm2 start local-server.js --name chainopharma-admin) \
  && pm2 save"

# ---------- Build user frontend ----------
echo "==> Building user frontend…"
TMP_ENV="$(mktemp)"
cp "$USER_FRONTEND/.env" "$TMP_ENV"
if grep -q '^VITE_API_BASE_URL=' "$TMP_ENV"; then
  sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$API_BASE|" "$TMP_ENV"
else
  echo "VITE_API_BASE_URL=$API_BASE" >> "$TMP_ENV"
fi
(
  cd "$USER_FRONTEND"
  cp .env .env.deploy.bak
  cp "$TMP_ENV" .env
  npm ci || npm install
  npm run build
  mv .env.deploy.bak .env
)
rm -f "$TMP_ENV"

echo "==> Publishing user frontend…"
ssh_cmd "sudo mkdir -p '$WEB_DIR' '$WEB_DIR.next' && sudo chown -R \$(whoami):\$(whoami) '$(dirname "$WEB_DIR")'"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$USER_FRONTEND/dist/" "$DEPLOY_HOST:$WEB_DIR.next/"
ssh_cmd "find '$WEB_DIR' -mindepth 1 -maxdepth 1 -exec rm -rf {} +; mv '$WEB_DIR.next'/* '$WEB_DIR'/; rmdir '$WEB_DIR.next' 2>/dev/null || true"

# ---------- Build admin frontend ----------
echo "==> Building admin frontend…"
TMP_ADMIN_ENV="$(mktemp)"
cp "$ADMIN_FRONTEND/.env" "$TMP_ADMIN_ENV" 2>/dev/null || true
if grep -q '^VITE_API_BASE_URL=' "$TMP_ADMIN_ENV" 2>/dev/null; then
  sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$ADMIN_API_BASE|" "$TMP_ADMIN_ENV"
else
  echo "VITE_API_BASE_URL=$ADMIN_API_BASE" >> "$TMP_ADMIN_ENV"
fi
grep -q '^VITE_APP_DISPLAY_NAME=' "$TMP_ADMIN_ENV" 2>/dev/null || echo 'VITE_APP_DISPLAY_NAME=Chaino Pharma' >> "$TMP_ADMIN_ENV"
grep -q '^VITE_APP_DOCUMENT_TITLE=' "$TMP_ADMIN_ENV" 2>/dev/null || echo 'VITE_APP_DOCUMENT_TITLE=Chaino Pharma Admin' >> "$TMP_ADMIN_ENV"
(
  cd "$ADMIN_FRONTEND"
  if [[ -f .env ]]; then cp .env .env.deploy.bak; fi
  cp "$TMP_ADMIN_ENV" .env
  npm ci || npm install
  npm run build
  if [[ -f .env.deploy.bak ]]; then mv .env.deploy.bak .env; else rm -f .env; fi
)
rm -f "$TMP_ADMIN_ENV"

echo "==> Publishing admin frontend…"
ssh_cmd "sudo mkdir -p '$ADMIN_WEB_DIR' '$ADMIN_WEB_DIR.next' && sudo chown -R \$(whoami):\$(whoami) '$(dirname "$ADMIN_WEB_DIR")'"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$ADMIN_FRONTEND/dist/" "$DEPLOY_HOST:$ADMIN_WEB_DIR.next/"
ssh_cmd "find '$ADMIN_WEB_DIR' -mindepth 1 -maxdepth 1 -exec rm -rf {} +; mv '$ADMIN_WEB_DIR.next'/* '$ADMIN_WEB_DIR'/; rmdir '$ADMIN_WEB_DIR.next' 2>/dev/null || true"

# Ensure SSL certs exist for both hostnames (idempotent)
echo "==> Ensuring Let's Encrypt certificates…"
ssh_cmd "sudo certbot certonly --nginx -d '$PUBLIC_HOST' -d '$ADMIN_PUBLIC_HOST' --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring 2>/dev/null \
  || sudo certbot --nginx -d '$PUBLIC_HOST' -d '$ADMIN_PUBLIC_HOST' --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>/dev/null \
  || true"
# Re-apply our nginx (certbot may rewrite sites); keep SSL-aware template authoritative
scp_cmd "$ROOT/deploy/aws/nginx.chainopharma.conf" "$DEPLOY_HOST:/tmp/nginx.chainopharma.conf"
ssh_cmd '
  # Fallback: if admin cert missing, reuse user cert so nginx still starts
  if [ ! -f /etc/letsencrypt/live/admin.15-252-130-60.sslip.io/fullchain.pem ]; then
    sudo mkdir -p /etc/letsencrypt/live/admin.15-252-130-60.sslip.io
    sudo ln -sfn /etc/letsencrypt/live/15-252-130-60.sslip.io/fullchain.pem /etc/letsencrypt/live/admin.15-252-130-60.sslip.io/fullchain.pem
    sudo ln -sfn /etc/letsencrypt/live/15-252-130-60.sslip.io/privkey.pem /etc/letsencrypt/live/admin.15-252-130-60.sslip.io/privkey.pem
  fi
  if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
    echo "ssl_protocols TLSv1.2 TLSv1.3; ssl_prefer_server_ciphers off;" | sudo tee /etc/letsencrypt/options-ssl-nginx.conf >/dev/null
  fi
  if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
    sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
  fi
  sudo cp /tmp/nginx.chainopharma.conf /etc/nginx/sites-available/chainopharma
  sudo ln -sfn /etc/nginx/sites-available/chainopharma /etc/nginx/sites-enabled/chainopharma
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
'

# Health checks
echo "==> Health checks…"
sleep 2
ssh_cmd "curl -fsS http://127.0.0.1:4000/hello | head -c 200; echo"
ssh_cmd "curl -fsS http://127.0.0.1:4005/hello | head -c 200; echo"
curl -fsS "$PUBLIC_URL/hello" | head -c 200 || true
echo
curl -fsS "$ADMIN_PUBLIC_URL/hello" | head -c 200 || true
echo
echo "Deployed user:  $PUBLIC_URL"
echo "Deployed admin: $ADMIN_PUBLIC_URL/login"
echo "Redeploy: DEPLOY_HOST=$DEPLOY_HOST SSH_KEY=$SSH_KEY ./deploy/aws/deploy.sh"
