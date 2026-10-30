#!/usr/bin/env bash
# Build and (re)start the production stack. Safe to run again for every update.
#   bash deploy/scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.prod ]; then
  echo "deploy/.env.prod is missing: cp deploy/.env.prod.example deploy/.env.prod and fill it in" >&2
  exit 1
fi

if [ -d ../.git ]; then
  echo "==> Pulling latest code"
  git -C .. pull --ff-only
fi

echo "==> Building and starting containers (first build takes 10-20 minutes)"
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

echo "==> Removing old images"
docker image prune -f > /dev/null

set -a; . ./.env.prod; set +a
echo "==> Waiting for the API to report healthy"
for i in $(seq 1 60); do
  if curl -fsS "https://${API_HOST}/actuator/health" 2>/dev/null | grep -q UP; then
    echo
    echo "Live:"
    echo "  Admin     https://${ADMIN_HOST}"
    echo "  Shop      https://${SHOP_HOST}"
    echo "  API       https://${API_HOST}  (health: /actuator/health)"
    exit 0
  fi
  printf '.'
  sleep 5
done
echo
echo "The API did not become healthy in 5 minutes. Check: docker compose -f deploy/docker-compose.prod.yml logs backend web" >&2
exit 1
