#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
REMOTE_DIR="/opt/health-tracker"
DATA_DIR="/var/lib/health-tracker"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
  -o ConnectionAttempts=1
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=3
)

remote() {
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${PUBLIC_IP}" "$@"
}

cd "${INFRA_DIR}"
if [[ ! -d .terraform ]]; then
  echo "Run 'tofu init' and 'tofu apply' in infra/ first." >&2
  exit 1
fi

PUBLIC_IP="$(tofu output -raw public_ip)"
if [[ -z "${PUBLIC_IP}" || "${PUBLIC_IP}" == "null" ]]; then
  echo "Could not read public_ip from Terraform outputs." >&2
  exit 1
fi

echo "==> Building images locally"
cd "${ROOT_DIR}"
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "docker compose is required" >&2
  exit 1
fi
"${COMPOSE[@]}" build

echo "==> Waiting for SSH on ${PUBLIC_IP}"
ready=0
for attempt in $(seq 1 30); do
  if remote "true" >/dev/null 2>&1; then
    echo "    SSH is up (attempt ${attempt})"
    ready=1
    break
  fi
  echo "    attempt ${attempt}/30 — no SSH yet"
  sleep 5
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Could not SSH to ${PUBLIC_IP}. Check the Lightsail firewall and your key." >&2
  exit 1
fi

if ! remote "test -f ${DATA_DIR}/.provisioned"; then
  echo "==> Docker not provisioned yet — installing on the instance"
  # Lightsail may run first-boot user-data with /bin/sh; bootstrap here so an
  # already-created instance does not need to be recreated.
  remote "sudo bash -s" <<'EOF'
set -eu
export DEBIAN_FRONTEND=noninteractive
if command -v docker >/dev/null 2>&1 && test -f /var/lib/health-tracker/.provisioned; then
  exit 0
fi
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin
systemctl enable --now docker
usermod -aG docker ubuntu
mkdir -p /opt/health-tracker /var/lib/health-tracker
chown -R ubuntu:ubuntu /opt/health-tracker /var/lib/health-tracker
cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
JSON
systemctl restart docker
touch /var/lib/health-tracker/.provisioned
EOF
  echo "    Docker installed. Reconnecting so the docker group applies."
fi

echo "==> Shipping compose file and images"
remote "mkdir -p ${REMOTE_DIR}"
scp "${SSH_OPTS[@]}" "${ROOT_DIR}/docker-compose.yml" "${SSH_USER}@${PUBLIC_IP}:${REMOTE_DIR}/docker-compose.yml"

docker save health-tracker-api:latest health-tracker-web:latest \
  | remote "sudo docker load"

echo "==> Starting stack"
remote "sudo bash -s" <<EOF
set -eu
cd ${REMOTE_DIR}
export HEALTH_TRACKER_DATA=${DATA_DIR}
export HTTP_PORT=80
docker compose up -d --remove-orphans
docker compose ps
EOF

echo "==> Deployed: http://${PUBLIC_IP}"
