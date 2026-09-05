#!/usr/bin/env bash
set -euo pipefail

: "${DESIGN_DEPLOY_ROOT:?Set the deployment directory}"
: "${DESIGN_STUDIO_DATA:?Set the existing private studio volume}"
: "${DESIGN_STUDIO_ENV:?Set the private studio environment file}"
studio_image="${DESIGN_STUDIO_IMAGE:-gruia-design:20260905}"

# Host networking keeps the actual daemon listener visible to server-manager.
# The daemon itself binds only to loopback; Caddy reaches the gateway.
export DESIGN_STUDIO_DATA DESIGN_STUDIO_ENV DESIGN_STUDIO_IMAGE="$studio_image"
server-manager start custom --name gruia-design-studio --port 9007 --wait \
  --workdir "$DESIGN_DEPLOY_ROOT" \
  --log-path "$DESIGN_DEPLOY_ROOT/studio.log" \
  --command 'bash deploy/gruia/run-studio.sh'
