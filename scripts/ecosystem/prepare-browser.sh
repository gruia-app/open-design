#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

# These filters include each selected package's workspace dependencies. They do
# not select the Electron desktop application.
pnpm install --frozen-lockfile \
  --filter @open-design/daemon... \
  --filter @open-design/web...

# The daemon CLI is the foreground listener that server-manager tracks. The
# recursive filter builds its workspace dependencies without selecting desktop.
pnpm --filter @open-design/daemon... build
