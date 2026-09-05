# Gruia authentication gateway

`@open-design/gruia-gateway` is the only public-facing gateway for `https://design.gruia.app`. It binds to loopback (`127.0.0.1:3006` by default); a parent-managed TLS reverse proxy owns the public hostname. It does not start, stop, configure, or discover OpenDesign daemons.

The gateway does not select a design engine. The deployment owner configures each mapped daemon for Claude. Codex remains a maintenance tool outside this process.

Client access is closed by default. With `clientAccessOpen: false`, only organizations explicitly marked `audience: "internal"` are admitted. Other configured organizations are treated as clients and rejected, including existing sessions. Each organization needs a separate daemon and volume.

## Required protected configuration

Set `GRUIA_GATEWAY_CONFIG` to an absolute JSON file readable only by the gateway account (for example mode `0600`). This is the complete configuration shape; do not put these credentials in an OpenDesign/daemon configuration file.

```json
{
  "publicOrigin": "https://design.gruia.app",
  "bindHost": "127.0.0.1",
  "port": 3006,
  "databasePath": "/protected/gruia/gateway.sqlite",
  "sessionSecret": "base64-encoded-32-random-bytes",
  "postgresUrl": "postgresql://gateway_role:password@db.example/gruia?sslmode=require",
  "clientAccessOpen": false,
  "sessionTtlSeconds": 14400,
  "requestBodyLimitBytes": 10485760,
  "upstreamTimeoutMs": 30000,
  "workos": {
    "clientId": "client_…",
    "clientSecret": "sk_…",
    "issuer": "https://api.workos.com/user_management/client_…",
    "redirectUri": "https://design.gruia.app/auth/callback"
  },
  "organizations": {
    "organization-uuid-or-canonical-id": {
      "audience": "internal",
      "upstream": "http://127.0.0.1:9007",
      "daemonApiToken": "per-org-private-daemon-token"
    }
  }
}
```

Every organization entry must use an explicit loopback HTTP upstream, and each needs a distinct daemon/API token. No arbitrary upstream URL, WorkOS key, Postgres URL, cookie, incoming bearer token, or caller identity header is forwarded to a daemon. The gateway injects only that organization’s configured daemon token.

Pin `workos.issuer` to the issuer returned by the Gruia client’s WorkOS OpenID discovery document (`https://api.workos.com/user_management/{clientId}/.well-known/openid-configuration`). Do not substitute the generic API origin. See the [WorkOS session-token contract](https://workos.com/docs/reference/authkit/session-tokens).

The WorkOS redirect URI must be registered by the deployment owner and exactly equal `publicOrigin + /auth/callback`. The gateway uses AuthKit authorization-code PKCE S256 at `https://api.workos.com/user_management/authorize`, exchanges code at `/user_management/authenticate`, verifies RS256 access JWTs against `https://api.workos.com/sso/jwks/{clientId}`, and requires issuer, `client_id`, `sid`, `exp`, and `sub`.

## Authorization and sessions

There is no email fallback, JIT user creation, caller-selected organization, or ecosystem-auth broker. On sign-in and every protected HTTP/SSE/WebSocket request, authorization comes only from this canonical Postgres join:

```sql
public.user_identities(provider = 'workos', provider_subject)
JOIN public.users(id, is_active)
JOIN public.organization_members(organization_id, user_id, role)
```

The resulting organization must be explicitly configured. A subject matched to zero or more than one permitted organization is denied; organization selection is intentionally not implemented yet. Members of an admitted organization knowingly share that organization’s isolated design studio.

Opaque login state is single-use, durable, and bound to an HttpOnly cookie in the browser that started login. Opaque session IDs, state verifiers, CSRF values, provider access/refresh tokens, and provider session IDs are protected in local SQLite; provider tokens use AES-256-GCM with `sessionSecret`. Browser cookies are host-only, `HttpOnly`, `SameSite=Lax`, `Secure` in production, and never expose provider credentials. Access tokens are refreshed near expiry; failed refresh removes the local session. Logout deletes the session first and then best-effort revokes its WorkOS session.

Public routes are only `GET /healthz` (also `/health` for server-manager), `GET /auth`, `GET /auth/login`, and `GET /auth/callback`. `/auth/session` returns only local user ID, organization ID, role, and a CSRF token. `POST /auth/logout` requires exact public `Origin` plus `X-Gruia-CSRF`. All mutation and WebSocket requests require the exact public Origin. Authentication mutations additionally require `X-Gruia-CSRF`; ordinary studio requests use the existing browser client. VIEWER memberships cannot mutate or open a terminal WebSocket. Private responses are `no-store`; upstream redirects and upstream `Set-Cookie` are rejected/stripped.

## Build and launch

Runtime: Node 24, installed package dependencies, a writable protected directory for SQLite, network reachability to WorkOS/JWKS and Postgres, and already-running per-org private daemons. Build and validate without root aliases:

```bash
pnpm --filter @open-design/gruia-gateway typecheck
pnpm --filter @open-design/gruia-gateway test
pnpm --filter @open-design/gruia-gateway build
# Use deploy/gruia/start-gateway.sh through server-manager.
```

`testMode: true` is allowed only with an HTTP localhost public origin and changes the cookie name/security solely for explicit local tests. It must never be used for `design.gruia.app`.
