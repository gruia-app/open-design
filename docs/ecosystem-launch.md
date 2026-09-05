# Ecosystem browser launch

This fork runs OpenDesign as the local browser application for advanced experience-design work. It preserves the upstream product and its Apache-2.0 license. This guide covers local launch metadata and wrappers; production authentication is documented separately.

## Requirements

- Node 24.19 or another supported Node 24 release.
- pnpm 10.33.2, selected through Corepack.
- `server-manager` on `PATH` and configured by the parent ecosystem.
- Ports 3006 for the browser and 9007 for the daemon available to this application. The parent verifies port availability before launch.
- `OD_DATA_DIR` set to an existing, writable, absolute directory that the caller intends to retain. The wrappers do not choose or create this directory.

Claude is the design engine. Codex is used only to maintain this fork. Authenticate the local Claude CLI before launching. Credentials remain outside the repository.

## Usage

From this worktree:

```bash
scripts/ecosystem/prepare-browser.sh
# Set OD_DATA_DIR according to the root AGENTS.md data-directory contract.
scripts/ecosystem/start-browser.sh
scripts/ecosystem/status-browser.sh
scripts/ecosystem/stop-browser.sh
```

Open `http://127.0.0.1:3006`. The status wrapper reports server-manager's tracked listeners and health checks for the web listener and daemon endpoint. Server-manager owns every server lifecycle action. Do not start, kill, or detach the application outside these wrappers.

## Runtime shape

OpenDesign's supported browser development topology is:

```bash
pnpm tools-dev run web --daemon-port 9007 --web-port 3006 --no-env-file
```

`tools-dev` starts sidecars and keeps a separate foreground parent alive. Server-manager stops the listener PID associated with a port, not that non-listening parent, so using it as one custom server can leave the daemon running. This integration instead asks server-manager to supervise the actual foreground listeners separately:

```bash
node apps/daemon/dist/cli.js --no-open --port 9007 --host 127.0.0.1
pnpm --filter @open-design/web exec next dev --webpack --hostname 127.0.0.1 --port 3006
```

The web process receives `OD_PORT=9007`, which is the configuration the Next development rewrite uses for `/api`, `/artifacts`, and `/frames`. The daemon receives `OD_DATA_DIR` and `OD_WEB_PORT=3006`, then binds to `127.0.0.1`. The start wrapper starts the daemon before the web process. The stop wrapper stops web before daemon.

Preparation installs only the dependency closure for daemon and web, then builds the daemon and its workspace dependencies. It does not select the desktop application. Rerun preparation after upstream updates so the compiled daemon CLI matches source.

## Limits and data safety

These wrappers provide local browser development. Production hosting and Gruia authentication have their own deployment configuration. These local wrappers do not configure agents, credentials, cloud services, or central ecosystem records. A running app can still need a locally installed agent CLI or separately configured provider before it can generate work.

Stopping the app does not remove `OD_DATA_DIR`. Keep that directory when you want to retain projects, artifacts, and local daemon state. Remove it only through an intentional data-retention process outside this launcher.

## Upstream updates

Keep Gruia integration changes separate from upstream product changes. To update, merge or rebase from `nexu-io/open-design`, resolve any wrapper conflicts in this small integration layer, then rerun `scripts/ecosystem/prepare-browser.sh`. Retain upstream license files and notices.
