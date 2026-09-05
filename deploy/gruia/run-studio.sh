#!/usr/bin/env bash
set -euo pipefail

: "${DESIGN_STUDIO_DATA:?Set the existing private studio volume}"
: "${DESIGN_STUDIO_ENV:?Set the private studio environment file}"
: "${DESIGN_STUDIO_IMAGE:?Set the validated studio image}"

exec docker run --rm --name gruia-design-studio --network host \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 512 --memory 1536m --memory-swap 1536m --cpus 2 \
  --shm-size 256m --tmpfs /tmp:rw,nosuid,nodev,size=512m \
  --mount "type=bind,src=$DESIGN_STUDIO_DATA,dst=/var/lib/open-design" \
  --env-file "$DESIGN_STUDIO_ENV" \
  --env OD_BIND_HOST=127.0.0.1 --env OD_PORT=9007 "$DESIGN_STUDIO_IMAGE"
