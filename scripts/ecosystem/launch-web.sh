#!/usr/bin/env bash
set -euo pipefail

readonly daemon_port=9007
readonly web_port=3006
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$repo_root"
export OD_HOST=127.0.0.1
export OD_PORT="$daemon_port"

exec pnpm --filter @open-design/web exec next dev \
  --webpack \
  --hostname 127.0.0.1 \
  --port "$web_port"
