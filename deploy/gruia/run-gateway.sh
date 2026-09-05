#!/usr/bin/env bash
set -euo pipefail
: "${DESIGN_GATEWAY_CONFIG:?Set the protected gateway JSON file}"
: "${DESIGN_GATEWAY_DATA:?Set the existing private session volume}"
: "${DESIGN_GATEWAY_IMAGE:?Set the validated gateway image}"
: "${DESIGN_POSTGRES_CA:?Set the PostgreSQL certificate file}"
: "${DESIGN_POSTGRES_HOST_IP:?Set the PostgreSQL server address}"
exec docker run --rm --name gruia-design-gateway --network host \
  --add-host "acv2-pg-primary:$DESIGN_POSTGRES_HOST_IP" \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --memory 256m --memory-swap 256m --cpus 1 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=32m \
  --mount "type=bind,src=$DESIGN_GATEWAY_CONFIG,dst=/etc/gruia/gateway.json,readonly" \
  --mount "type=bind,src=$DESIGN_GATEWAY_DATA,dst=/var/lib/gruia-gateway" \
  --mount "type=bind,src=$DESIGN_POSTGRES_CA,dst=/etc/gruia/postgres-ca.pem,readonly" \
  --env GRUIA_GATEWAY_CONFIG=/etc/gruia/gateway.json "$DESIGN_GATEWAY_IMAGE"
