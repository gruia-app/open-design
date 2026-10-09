#!/usr/bin/env bash
# Run by simplia-ci (security.prune_script) right before Trivy.
# The pipeline restores the pnpm content-addressable store into
# .pnpm/store inside the workspace. It is vendored third-party content
# (already covered by the pnpm-lock.yaml scan) and has already been saved
# to the install cache by this point. Some Trivy versions walk it despite
# --skip-dirs .pnpm and report false-positive secrets from package files.
set -euo pipefail
rm -rf .pnpm
