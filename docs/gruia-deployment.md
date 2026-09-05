# Gruia production deployment

`https://design.gruia.app` routes through Caddy to the Gruia gateway on
`127.0.0.1:3006`. The gateway authenticates existing Gruia users with email and
password and proxies the admitted organization to its private daemon. The
initial internal studio listens on `127.0.0.1:9007` and serves the static web
export. Claude generates designs. Codex maintains this fork.

## Build

The source recipes use Node 24 Bookworm, pnpm 10.33.2, the frozen lockfile, and
Claude Code 2.1.261. Build from the repository root:

```bash
docker build --platform linux/amd64 -t gruia-design:20260905 -f deploy/gruia/Dockerfile .
docker build --platform linux/amd64 -t gruia-design-gateway:20260905-password -f deploy/gruia/Dockerfile.gateway .
```

The studio image includes daemon production dependencies, static web, skills,
design templates, design systems, craft, prompts, assets, baked data, and
plugins. Its source build rebuilds native node-pty. The first deployment used
the prebuilt recipes with validated local outputs. For that path, build the
daemon and web first, deploy the daemon package with `pnpm deploy --legacy
--prod` into a temporary directory named `daemon`, and provide its parent as
Docker's named `prebuilt` build context. The regular context must contain
`apps/web/out` and the same resource directories. The gateway prebuilt recipe
consumes its own production deployment closure. Never commit temporary build
closures or credentials.

## Private runtime configuration

On the production host, `/opt/design` contains lifecycle scripts, build
contexts, private configuration and persistent volumes. Provision each studio
volume for UID/GID 1001 with mode 0700 and mount it at `/var/lib/open-design`,
the explicit `OD_DATA_DIR`. Provider home and Claude configuration live below
that root. Gateway sessions have a separate volume.

The studio environment file must be mode 0600 and contain `OD_API_TOKEN`,
`CLAUDE_CODE_OAUTH_TOKEN`, `OD_PUBLIC_BASE_URL=https://design.gruia.app` and
`OD_ALLOWED_ORIGINS=https://design.gruia.app`. The launcher forces the daemon to
bind to loopback. The entrypoint uses umask 077 and selects Claude on first
boot. Supply provider credentials through the runtime environment only.

The gateway JSON is owned by UID 1001, mode 0400, and mounted read-only. Follow
[the authentication contract](gruia-auth.md). Use a dedicated PostgreSQL role
with access only to the identity and membership columns required by the gateway.
The production role is `design_auth_reader`; it reads the password hash only for
server-side verification and uses read-only transactions. Keep
`clientAccessOpen: false` and mark only the internal studio mapping with
`audience: "internal"`.

## Start, stop and reboot

All service lifecycle operations use `server-manager`. Containers use host
networking so the manager tracks the real Node listener. Both listeners bind to
loopback; Caddy is the public entry. Containers run as UID 1001 with a read-only
root, dropped capabilities, resource limits and private volumes.

Create a protected `/opt/design/lifecycle.env` with these non-secret paths:

```bash
DESIGN_DEPLOY_ROOT=/opt/design
DESIGN_STUDIO_DATA=/opt/design/studios/internal
DESIGN_STUDIO_ENV=/opt/design/studio.env
DESIGN_STUDIO_IMAGE=gruia-design:20260905
DESIGN_GATEWAY_CONFIG=/opt/design/gateway.json
DESIGN_GATEWAY_DATA=/opt/design/gateway-data
DESIGN_GATEWAY_IMAGE=gruia-design-gateway:20260905-password
DESIGN_POSTGRES_CA=/opt/design/postgres-ca.pem
DESIGN_POSTGRES_HOST_IP=178.104.126.13
```

Load that file with export enabled before manual starts:

```bash
set -a
source /opt/design/lifecycle.env
set +a
bash /opt/design/deploy/gruia/start-all.sh
server-manager health 9007
server-manager health 3006
```

To stop, run `bash /opt/design/deploy/gruia/stop-all.sh`. Install `gruia-design.service` in `/etc/systemd/system`, then run `systemctl daemon-reload` and
`systemctl enable gruia-design.service` to restore both services at boot through
the same manager scripts. The unit does not provide automatic crash recovery.
Stop and start through these scripts when replacing an image; containers are
removed on exit and volumes persist.

## Public routing and admission

The DNS A record points to `188.245.85.65`. Caddy proxies the Design hostname to
`localhost:3006` with streaming enabled and strips proxy-authentication headers.
Never route the public hostname directly to the daemon. The login form and its
POST endpoint stay on `design.gruia.app`. No external identity-provider callback
is required.

Adding an organization requires a separate studio, data root and daemon token,
then an explicit gateway mapping. Customer mappings default to `audience:
"client"` and remain denied while customer access is closed. Existing Gruia
membership determines access; credentials are checked against the existing
`public.users` account and there is no automatic user creation. Update the
central `apps_registry` record when changing availability.

## Launch evidence

Launch verification covers gateway security tests and HTTP session/CSRF
boundaries, both running containers, HTTPS, and the same-origin password sign-in
page. A real Claude request completed successfully and created `index.html` in a
dedicated launch-check project. Successful sign-in with a person's existing
Gruia credentials still requires that person to complete the login.

For upstream updates, fetch `upstream`, review its changes on an integration
branch, and run `pnpm guard`, `pnpm typecheck`, gateway tests and affected
package builds before replacing either production image.
