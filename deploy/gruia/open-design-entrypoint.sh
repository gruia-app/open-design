#!/usr/bin/env sh
set -eu

# New files (including Claude credentials supplied at runtime) must not become
# group/world-readable when the host volume has a permissive default umask.
umask 077

: "${OD_DATA_DIR:?OD_DATA_DIR must name the persistent daemon data volume}"
: "${OD_API_TOKEN:?OD_API_TOKEN is required for this non-loopback daemon}"

mkdir -p "$OD_DATA_DIR" "$HOME" "$CLAUDE_CONFIG_DIR"
chmod 700 "$OD_DATA_DIR" "$HOME" "$CLAUDE_CONFIG_DIR"

# Set the production default exactly once. Existing, valid preferences always
# win; malformed config is deliberately left untouched for operator recovery.
node - "$OD_DATA_DIR/app-config.json" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
let config = {};
try {
  config = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!config || Array.isArray(config) || typeof config !== 'object') process.exit(0);
} catch (error) {
  if (error && error.code !== 'ENOENT') process.exit(0);
}
if (Object.prototype.hasOwnProperty.call(config, 'agentId') && config.agentId != null) process.exit(0);
config.agentId = 'claude';
const temporary = `${path}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, path);
NODE

exec "$@"
