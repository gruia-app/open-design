#!/usr/bin/env bash
set -euo pipefail
: "${DESIGN_DEPLOY_ROOT:?Set the deployment directory}"
bash "$DESIGN_DEPLOY_ROOT/deploy/gruia/start-studio.sh"
bash "$DESIGN_DEPLOY_ROOT/deploy/gruia/start-gateway.sh"
