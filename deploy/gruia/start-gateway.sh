#!/usr/bin/env bash
set -euo pipefail
: "${DESIGN_DEPLOY_ROOT:?Set the deployment directory}"
: "${DESIGN_GATEWAY_CONFIG:?Set the protected gateway JSON file}"
: "${DESIGN_GATEWAY_DATA:?Set the existing private session volume}"
: "${DESIGN_POSTGRES_CA:?Set the PostgreSQL certificate file}"
: "${DESIGN_POSTGRES_HOST_IP:?Set the PostgreSQL server address}"
export DESIGN_GATEWAY_CONFIG DESIGN_GATEWAY_DATA DESIGN_POSTGRES_CA DESIGN_POSTGRES_HOST_IP
export DESIGN_GATEWAY_IMAGE="${DESIGN_GATEWAY_IMAGE:-gruia-design-gateway:20260905-password}"
server-manager start custom --name gruia-design-gateway --port 3006 --wait \
  --workdir "$DESIGN_DEPLOY_ROOT" \
  --log-path "$DESIGN_DEPLOY_ROOT/gateway.log" \
  --command 'bash deploy/gruia/run-gateway.sh'
