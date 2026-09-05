#!/usr/bin/env bash
set -euo pipefail

# Stop the dependent web listener before the daemon listener. Both are actual
# foreground listener processes tracked by server-manager.
result=0
server-manager stop 3006 --force || result=$?
server-manager stop 9007 --force || result=$?
exit "$result"
