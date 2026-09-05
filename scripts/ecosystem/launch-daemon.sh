#!/usr/bin/env bash
set -euo pipefail

readonly daemon_port=9007
readonly web_port=3006
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -z "${OD_DATA_DIR:-}" ]]; then
  printf '%s\n' 'OD_DATA_DIR is required. Set it to an existing, writable, persistent directory.' >&2
  exit 64
fi
if [[ "$OD_DATA_DIR" != /* ]]; then
  printf '%s\n' 'OD_DATA_DIR must be an absolute path.' >&2
  exit 64
fi
if [[ ! -d "$OD_DATA_DIR" || ! -w "$OD_DATA_DIR" ]]; then
  printf '%s\n' 'OD_DATA_DIR must name an existing, writable directory.' >&2
  exit 73
fi

cd "$repo_root"
export OD_BIND_HOST=127.0.0.1
export OD_DATA_DIR
export OD_WEB_PORT="$web_port"

exec node apps/daemon/dist/cli.js \
  --no-open \
  --port "$daemon_port" \
  --host 127.0.0.1
