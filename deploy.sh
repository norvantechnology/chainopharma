#!/usr/bin/env bash
# Redeploy Chaino Pharma (local single-port + public ngrok URL). Does not delete data.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/user/frontend"
npm run build
# restart backend if running under npm/node local-server
BPID=$(ss -ltnp 2>/dev/null | rg ':4000' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [[ -n "${BPID:-}" ]]; then kill -9 "$BPID" || true; sleep 1; fi
cd "$ROOT/user/backend"
nohup npm run dev > /tmp/chainopharma-backend.log 2>&1 &
sleep 2
URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next((t["public_url"] for t in d.get("tunnels",[]) if t["public_url"].startswith("https")),""))' 2>/dev/null || true)
echo "Backend restarted. Public URL (if ngrok running): ${URL:-unknown}"
echo "Frontend is served from the same URL after build."
