# SAAS_GAPS — cola de mejoras del producto design (gruia-app/design)

Inventario de gaps accionables. `[x]` hecho, `[ ]` pendiente, `(!)` requiere decisión.

## tools/gruia-gateway (auth SaaS)

- [x] G1 — `password_sessions` nunca se barre → sweep-on-write en `createSession`
  (commit `ad1a9f44d`, tests 5/5). Merged vía PR #4.
- [x] G2 — páginas HTML de auth sin anti-framing → `frame-ancestors 'none'` +
  `X-Frame-Options: DENY` (commit `0dfb46556`, tests 11/11). Merged vía PR #4.
- [x] G3 — sin barrido periódico de sesiones: aun con sweep-on-write, una org sin
  logins acumula. Resuelto con intervalo `unref()` de 15min en
  `SqliteSessionStore` (`sweepExpired`: password_sessions + login_csrf +
  retención auth_audit; desactivable con `sweepIntervalMs=0`, `close()` lo
  limpia). Commit `d12f06f71`, tests 30/30.
- [x] G4 — rate limit de login solo en memoria y por email+global; sin bucket por IP.
  Añadido bucket por IP (20/min, 10k keys, sweep-on-access) alimentado por
  `AuthAuditContext.ip` (commit `380311354`, tests 27/27). Single-instancia
  in-memory — si el gateway pasa a multi-instancia reabrir como limiter
  compartido. Merged vía PR #15 (`50a8470db`).
- [x] G5 — `GET /auth/session` `csrfToken`: verificado — `json()` aplica `noStore`
  globalmente a rutas /auth. Sin gap real.
- [ ] G6 — sin métricas/observabilidad propia (solo /healthz). (!) decisión de diseño.
- [x] G7 — sin auditoría de logins (quién, cuándo, desde dónde). Tabla
  `auth_audit` (event/at/email/user_id/org/ip/user_agent/detail) con retención
  90d + 100k rows; eventos login_success/login_failure(detail)/logout/
  session_revoked (commits `7db05a69b` + `a8f0e978f`, tests 27/27).
  Merged vía PR #15 (`50a8470db`).
- [x] G8 — `verifyCsrf`/`readSession` devuelven bool/null sin distinguir "expirada" de
  "inexistente" → `readSession` audita `session_expired` en el delete de la fila
  expirada: una fila por sesión, cero para ids desconocidos (commit `a0a0408bc`,
  tests 28/28). Merged vía PR #15 (`50a8470db`).
- [x] G9 — `sessionTtlSeconds` hardcodeado a 14400 en config.ts ignorando el valor
  del config → leído vía `integer()` como sus vecinos (commit en batch gateway,
  tests 22/22). Merged vía PR #4.
- [x] G17 — `readSession`: csrf_token indescifrable (tamper o rotación de clave)
  borraba la sesión en silencio → audita `session_revoked:csrf_undecryptable`
  con contexto (commit `c5c551aa7`, tests 34/34).
- [x] G18 — Caddy de design.gruia.app sin HSTS (Caddy no lo emite por defecto)
  → `Strict-Transport-Security max-age=31536000; includeSubDomains`
  (commit `0e7d675ee`, config — sin suite de tests de deploy).
- [x] G19 — publisher de campaña: `verify()` recibía el sha256 aprobado pero solo
  comprobaba status+marca → ahora hashea el body remoto y exige igualdad antes
  de marcar `published` (commit `8e44af759`, tests 10/10 + 32/32 runner).
- [x] G21 — auditoría de dependencias (`pnpm audit`): `esbuild 0.28.0` del
  gateway caía en GHSA-g7r4-m6w7-qqqr (dev-server Windows; solo bundling aquí)
  → bump a `0.28.1`. El resto del reporte (vite/vitest/electron/extract-zip)
  son cadenas dev propiedad de upstream — bump local divergiría el lockfile.

## Daemon / web (línea de producto privada)

- [x] D1 — paridad de fixes upstream: 5 batches cherry-picked y mergeados
  (PRs #5-#9): sidecar IPC/records/resilience, pack/serve/release quoting,
  web resilience + envelopes + timeouts, dep tree patch (next 16.3.5),
  context-chip i18n. i18n de localizations omitido a propósito (producto es-only).
- [x] D2 — `.gitignore` privado cubre artefactos de flota (verificado en batch 2).
- [x] G10 — `apps/daemon/src/brand-routes.ts` emitía TRES shapes de error distintos
  (raw `{error: msg}`, `{error: code, message}` scope, `{error: code,...}` delete-race)
  y el consumer pintaba el CODE como mensaje → todo por `sendApiError` con codes
  tipados + `BRAND_EXTRACTION_STILL_STOPPING` registrado en API_ERROR_CODES +
  consumers web con lectura dual (commit `6b878c4e2`, tests 34/34).
- [~] D3 — sweep envelope `{error: {code, message}}` por fichero daemon.
  Hechos: MCP (`2cc1658f5`), brand-routes (`6b878c4e2`), memory (`072b65d02`),
  media+xai (PR #10), collab-context, genui (`406a03aae`), comments
  (`07d14a7b2`), static-resource (`0fa8652de`), design-systems (PR #11
  `74fcd820e`), automation + routine + team-resources + team-resource-share
  (`0202c835b`), project routes + daemon-db + connectors + telemetry +
  collab-presence + plugins assets/marketplaces (PR #12 `d011a5f76`),
  collab-sync + server.ts plugin/origin + reasoning-egress + media residuals
  + daemon oauth-launch + plugins/index + strategy-rollout (PRs #13, batch-5).
  `import-export-routes.ts` verificado ya enveloped.
  Helper web compartido `utils/apiErrors.ts` (apiErrorMessage) para
  lectura dual legacy/envelope; consumers migrados en brands, registry,
  elevenlabs-voices, public-file-publish, launchAntigravityOauth, CLI
  (`structuredHttpFailure`/`structuredErrorData` ya eran duales).
  **Estado: migración diseñada de tokens aplicada.** `collab-context.ts`
  (~30 tokens) migrado tras auditoría consumer-by-consumer
  (`8697251e9`): tokens verbatim en `error.code`+`error.message`, sibling
  top-level `acceptedGeneration` preservado manual; web dual-read
  (`apiErrorCode`/`apiErrorMessage` en `utils/apiErrors.ts`). `vela.ts`
  migrado en dos zonas (`263606cbf`): rutas locales
  `/api/integrations/vela/*` + `/api/amr/models` enveloped (login preserva
  siblings `authAttemptId`/`authStages`/`authRoute`/`fallbackUsed`); el
  proxy `api-proxy/*` que sirve al binario vela hijo mantiene flat tokens
  — superficie externa no verificable, documentado in situ.
  Consumers migrados: message-center-client (apiErrorCode para
  `amr-runtime-unavailable`), providers/daemon `startVelaLogin`
  (apiErrorMessage). CLI `structuredHttpFailure` y MCP
  `formatDaemonError` ya eran duales.
  Envelopes manuales legítimos que permanecen: critique artifact/interrupt
  (`error.currentStatus` contractual), strategy-rollout 409 (`status`
  sibling), comments.ts fallback.
  **Resta solo:** `proxyAmrApiRequest` (6 sitios) — pendiente verificar el
  parsing de errores del binario vela antes de convertir.

## Coordinación

- [x] Crear FLEET_PROGRESS.json + WORKLOG.md + SAAS_GAPS.md (commit `4163d1c5b`).
- [x] Repo privado `gruia-app/design` creado; fork público renombrado a
  `gruia-app/open-design` (main = mirror limpio de upstream). PR upstream #8262 intacto.
- [x] Jenkins lane: Jenkinsfile + ci/app.yml en main (`1c44980f`), jobs.groovy
  mergeado (jenkins-platform#304), profile acv2 → jenkins (PR #4254).

## Mapeo del backlog de flota SaaS (WORK_BACKLOG) a design

Evaluado 2026-09-20 — la mayoría de corrientes no aplican al fork porque
el billing/email/identidad viven fuera de él (AMR wallet upstream, login
contra BD externa). Lo aplicable:

- [x] **Analytics por tenant (mínimo honesto)** — `gruia-gateway audit`
  agrega `auth_audit` por org (eventos, usuarios distintos, última
  actividad, top IPs). Read-only, operator-only, sin superficie nueva
  (commit pendiente en fleet/gaps-32, tests 3/3).
- [x] **Security pass** — G1-G23 completos (auth, rate limits, cifrado
  at-rest, forense, headers, CI).
- [x] **Data lifecycle (GDPR, parcial)** — borrado de usuario ya resuelto:
  `authorize` re-resuelve la identidad en cada request; un usuario
  eliminado de la BD externa muere en `identity_mismatch` con revocación
  + audit. La exportación de datos es daemon-side upstream.
- [~] **Onboarding/activation** — existe la galería GruiaExamples como
  primer valor; un checklist post-signup sería trabajo de producto en la
  web divergida (coste alto, bajo retorno para ~usuarios internos).
- [ ] **Pago/billing** — N/A: el fork no tiene checkout ni planes; el
  wallet AMR es servicio upstream hospedado.
- [ ] **Emails transaccionales** — N/A sin decisión: el gateway no tiene
  mailer; añadir SMTP requiere credenciales y decisión de producto.
- [ ] **Limits/metering** — N/A: sin planes ni cuotas en el fork.
- [ ] **Soporte mínimo** — N/A sin decisión: falta un destino real de
  help/docs/contacto para enlazar.
- [ ] **Growth loops** — N/A: acceso por org concedido externamente; no
  hay flujo de invitación en el fork.
