# Gruia Design authentication

`@open-design/gruia-gateway` authenticates Gruia Design directly against the canonical `public.users` record. It does not use WorkOS, OAuth callbacks, provider tokens, or a Contenido API. It only reads the shared Postgres database; it never creates users, resets passwords, or writes identity data.

## Runtime configuration migration

Remove the complete `workos` object from the protected gateway JSON configuration, including the former client secret and callback URL. Sessions default to four hours; a `sessionTtlSeconds` override in the JSON is honored when set. Keep `publicOrigin`, `postgresUrl`, `sessionSecret`, `databasePath`, `organizations`, and the existing daemon targets. `publicOrigin` must be the exact public HTTPS origin.

The gateway issues a new `__Host-gruia_design_session` cookie in production. It is opaque, HttpOnly, Secure, host-only (no `Domain` attribute), `SameSite=Lax`, and has a fixed four-hour default lifetime. It is stored only as a hash in the local SQLite `password_sessions` table. Old WorkOS cookies and the old `sessions` table are not read.

## Required read-only database access

The readonly gateway role needs `SELECT` on the fields used for authentication and admission:

```sql
GRANT SELECT (id, email, hashed_password, is_active, account_status)
  ON public.users TO <gruia_gateway_readonly_role>;
GRANT SELECT (user_id, organization_id, role)
  ON public.organization_members TO <gruia_gateway_readonly_role>;
```

The login query uses `lower(email)`, requires `is_active = TRUE` and `lower(account_status::text) = 'active'` (the shared database contains both upper- and lowercase values), then admits exactly one configured organization membership. Protected requests repeat the active-status and membership lookup using the canonical `public.users.id`; a deactivated user or removed membership loses access immediately.

Canonical `hashed_password` records may be bcrypt (`$2b$`, with compatible bcrypt variants) or `pbkdf2_sha256$iterations$base64url(salt)$base64url(digest)`. PBKDF2-SHA256 verification is asynchronous and refuses iteration counts over 2,000,000. Bcrypt verification uses async `bcryptjs` 3.0.3 and therefore preserves bcrypt's 72 UTF-8-byte input behavior.

## Browser behavior

`GET /auth` and `GET /auth/login` render the same Spanish email/password form at the Gruia Design origin. There is no external navigation, registration, or reset flow. Login requires an exact `Origin` match and single-use durable CSRF state. Logout requires the same Origin and the session’s CSRF token; failed or disallowed login attempts return the same Spanish generic error. Login attempts have per-process global, normalized-email, and client-IP caps with bounded-memory pruning. These limits are intentionally a local defense layer, not a replacement for edge rate limiting.

## Admission and transport

Keep `clientAccessOpen: false`. Only an explicitly configured organization with
`audience: "internal"` can enter. Other organizations default to `"client"` and
are denied while client access is closed, including existing sessions. Each
organization has its own loopback daemon, private API token and storage volume.
Ambiguous membership across admitted studios is denied until organization
selection is implemented.

`studioOperatorUserIds` is a list of canonical `public.users` ids allowed to use
the studio proxy (HTTP and WebSocket). Membership still controls who can log
in, but only listed operator ids are proxied to the daemon; everyone else gets
`403` with `{"code":"studio_operator_only"}` and a `studio_operator_denied`
audit row. An empty or absent list is fail-closed — no proxied request passes.
Sessions, memberships and user data are never touched by the gate. Example
(ids truncated): `"studioOperatorUserIds": ["5821…", "9b3a…"]`.

Every protected HTTP, SSE and WebSocket request revalidates canonical membership.
Mutations and WebSockets require the exact public Origin. VIEWER members cannot
mutate or use WebSockets. The proxy strips caller cookies and identity headers,
re-asserts the gateway-resolved client IP as `x-forwarded-for`, injects only
the selected daemon token, and marks private responses no-store.

## PostgreSQL TLS

Production verifies both the database certificate and its hostname. Mount the
operator-provisioned public certificate at `/etc/gruia/postgres-ca.pem` and use
`sslmode=verify-full&sslrootcert=/etc/gruia/postgres-ca.pem` in the private DSN.
The DSN hostname is `acv2-pg-primary`, matching the certificate. The container
maps that name to `DESIGN_POSTGRES_HOST_IP`; `DESIGN_POSTGRES_CA` supplies the
read-only certificate mount. Never disable certificate verification to work
around the database's self-signed certificate.

The gateway and the TLS proxy must both send `Referrer-Policy: same-origin`.
With `no-referrer`, browsers can send `Origin: null` for a form POST, which the
login correctly rejects. Keep the exact-origin check and use the Caddy fragment
in `deploy/gruia/Caddyfile`.

## Operator auth-activity report

Auth events (logins, denials, session revocations, expirations) are written to
the `auth_audit` table in the gateway SQLite database, retained for 90 days or
100,000 rows, whichever bound hits first. For per-tenant usage or incident
triage, run the read-only report locally — over SSH on the gateway host or
against a mounted/copied database file:

```bash
gruia-gateway audit [--db <path>] [--days N] [--org <id>]
```

`--db` defaults to the configured `databasePath` when `GRUIA_GATEWAY_CONFIG` is
set; `--days` defaults to 30 (1–365); `--org` scopes every section to one
organization. The command prints JSON: event totals, per-organization breakdown
with distinct user counts and last activity, and the top 10 client IPs. It
opens the database read-only, never touches sessions or Postgres, and is
deliberately not an HTTP endpoint — audit metadata must not ride the
authenticated session surface.

## Metrics scrape endpoint

`GET /metrics` serves Prometheus text exposition when `metricsToken` is set in
the protected gateway JSON; without the key the route answers 404 and exposes
nothing. The scrape requires `Authorization: Bearer <metricsToken>` — the token
lives beside `sessionSecret` in the same operator-only file, never in the
repository, and unrelated `Authorization` headers still never reach upstream
daemons because the proxy strips them.

Series are deliberately low-cardinality and free of PII: no IPs, emails, user
ids, or organization ids appear. Every series is a gauge:

- `gruia_gateway_uptime_seconds` — process uptime.
- `gruia_gateway_sessions_active` — sessions whose expiry has not passed.
- `gruia_gateway_auth_events{event, detail}` — retained `auth_audit` rows
  grouped by event and failure detail (e.g. `login_failure` with
  `detail="rate_limited"` surfaces brute-force pressure). Counts cover the
  retained window only, so they can shrink when retention prunes.

Example scrape config:

```yaml
scrape_configs:
  - job_name: gruia-gateway
    bearer_token: <metricsToken>
    static_configs:
      - targets: ["design.gruia.app"]
```

This is aggregate operational telemetry, not the per-tenant audit report —
per-organization and per-IP detail stays in `gruia-gateway audit`, which
remains a local read-only command.
