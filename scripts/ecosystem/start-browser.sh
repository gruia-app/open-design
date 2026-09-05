#!/usr/bin/env bash
set -euo pipefail

readonly daemon_port=9007
readonly web_port=3006
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -z "${OD_DATA_DIR:-}" ]]; then
  printf '%s\n' 'OD_DATA_DIR is required. See docs/ecosystem-launch.md.' >&2
  exit 64
fi
if [[ "$OD_DATA_DIR" != /* || ! -d "$OD_DATA_DIR" || ! -w "$OD_DATA_DIR" ]]; then
  printf '%s\n' 'OD_DATA_DIR must be an existing, writable, absolute path.' >&2
  exit 64
fi

# Pass the configuration owned by this local launch.
daemon_env="$(node -e '
const env = { OD_BIND_HOST: "127.0.0.1", OD_DATA_DIR: process.env.OD_DATA_DIR, OD_WEB_PORT: "3006" };
process.stdout.write(JSON.stringify(env));
')"
web_env='{"OD_HOST":"127.0.0.1","OD_PORT":"9007"}'

cd "$repo_root"
server-manager start custom \
  --port "$daemon_port" \
  --name gruia-design-daemon \
  --command 'bash scripts/ecosystem/launch-daemon.sh' \
  --workdir "$repo_root" \
  --env "$daemon_env" \
  --wait

if ! server-manager start custom \
  --port "$web_port" \
  --name gruia-design-web \
  --command 'bash scripts/ecosystem/launch-web.sh' \
  --workdir "$repo_root" \
  --env "$web_env" \
  --wait; then
  server-manager stop "$daemon_port" --force || true
  exit 1
fi
