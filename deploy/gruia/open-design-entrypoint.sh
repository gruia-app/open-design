#!/usr/bin/env sh
set -eu

# New files (including Claude credentials supplied at runtime) must not become
# group/world-readable when the host volume has a permissive default umask.
umask 077

: "${OD_DATA_DIR:?OD_DATA_DIR must name the persistent daemon data volume}"
: "${OD_API_TOKEN:?OD_API_TOKEN is required for this non-loopback daemon}"

mkdir -p "$OD_DATA_DIR" "$HOME" "$CLAUDE_CONFIG_DIR"
chmod 700 "$OD_DATA_DIR" "$HOME" "$CLAUDE_CONFIG_DIR"

# Gruia provides the design runtime. Users must enter the studio without the
# upstream cloud/BYOK wizard. Preserve unrelated preferences and project data.
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
config.agentId = 'claude';
config.onboardingCompleted = true;
config.agentModels = {
  ...config.agentModels,
  claude: { ...config.agentModels?.claude, model: config.agentModels?.claude?.model || 'sonnet' },
};
// Hosted deployments keep upstream telemetry disabled for every studio.
config.telemetry = { metrics: false, content: false, artifactManifest: false };
config.privacyDecisionAt = config.privacyDecisionAt || Date.now();
const temporary = `${path}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, path);
NODE

exec "$@"
