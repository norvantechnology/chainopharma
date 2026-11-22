#!/usr/bin/env bash
# Create ONE low-cost Lightsail instance (preferred) or fail with clear IAM guidance.
# Does not delete existing resources.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$ROOT/deploy/aws/.state"
mkdir -p "$STATE_DIR"

REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-ap-south-1}}"
INSTANCE_NAME="${INSTANCE_NAME:-chainopharma-app}"
BUNDLE_ID="${BUNDLE_ID:-small_3_0}"         # ~$5/mo 1GB — safest low-cost for Node+Nginx (nano often OOMs)
BLUEPRINT_ID="${BLUEPRINT_ID:-ubuntu_24_04}"
AZ="${AZ:-${REGION}a}"

export AWS_DEFAULT_REGION="$REGION"

if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  echo "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY first." >&2
  exit 1
fi

echo "Account: $(aws sts get-caller-identity --query Arn --output text)"
echo "Region:  $REGION"
echo "Instance:$INSTANCE_NAME ($BUNDLE_ID / $BLUEPRINT_ID)"

if aws lightsail get-instance --instance-name "$INSTANCE_NAME" >/dev/null 2>&1; then
  echo "Instance already exists — not recreating (safe)."
else
  echo "Creating Lightsail instance (low cost)…"
  if ! aws lightsail create-instances \
      --instance-names "$INSTANCE_NAME" \
      --availability-zone "$AZ" \
      --blueprint-id "$BLUEPRINT_ID" \
      --bundle-id "$BUNDLE_ID" \
      --tags key=Application,value=ChainoPharma; then
    cat >&2 <<'EOF'

Provision failed. This IAM user likely lacks Lightsail/EC2 create rights.
Ask an AWS admin to attach LightsailFullAccess (or EC2 create) to DEVELOPER,
then re-run ./deploy/aws/provision.sh

EOF
    exit 1
  fi
fi

echo "Waiting for instance running…"
for i in $(seq 1 60); do
  STATE=$(aws lightsail get-instance --instance-name "$INSTANCE_NAME" --query 'instance.state.name' --output text 2>/dev/null || echo pending)
  [[ "$STATE" == "running" ]] && break
  sleep 5
done

IP=$(aws lightsail get-instance --instance-name "$INSTANCE_NAME" --query 'instance.publicIpAddress' --output text)
echo "$IP" > "$STATE_DIR/public_ip"
echo "$INSTANCE_NAME" > "$STATE_DIR/instance_name"
echo "$REGION" > "$STATE_DIR/region"

# Open HTTP (idempotent)
aws lightsail open-instance-public-ports \
  --instance-name "$INSTANCE_NAME" \
  --port-info fromPort=80,toPort=80,protocol=TCP,cidrs=0.0.0.0/0 2>/dev/null || true
aws lightsail open-instance-public-ports \
  --instance-name "$INSTANCE_NAME" \
  --port-info fromPort=443,toPort=443,protocol=TCP,cidrs=0.0.0.0/0 2>/dev/null || true
aws lightsail open-instance-public-ports \
  --instance-name "$INSTANCE_NAME" \
  --port-info fromPort=22,toPort=22,protocol=TCP,cidrs=0.0.0.0/0 2>/dev/null || true

# Download default key pair if present
KEY_PATH="$STATE_DIR/lightsail-default.pem"
if [[ ! -f "$KEY_PATH" ]]; then
  aws lightsail download-default-key-pair \
    --query 'privateKeyBase64' --output text > "$KEY_PATH.tmp" 2>/dev/null || true
  if [[ -s "$KEY_PATH.tmp" ]]; then
    # Lightsail returns raw PEM or base64 depending on API; keep as-is if already PEM
    if grep -q 'BEGIN RSA PRIVATE KEY\|BEGIN PRIVATE KEY' "$KEY_PATH.tmp"; then
      mv "$KEY_PATH.tmp" "$KEY_PATH"
    else
      base64 -d < "$KEY_PATH.tmp" > "$KEY_PATH" 2>/dev/null || mv "$KEY_PATH.tmp" "$KEY_PATH"
    fi
    chmod 600 "$KEY_PATH"
    rm -f "$KEY_PATH.tmp"
  else
    rm -f "$KEY_PATH.tmp"
  fi
fi

echo "Public IP: $IP"
echo "Next: SSH_KEY=$KEY_PATH DEPLOY_HOST=ubuntu@$IP ./deploy/aws/deploy.sh"
