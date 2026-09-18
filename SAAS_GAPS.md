# SAAS_GAPS — cola de mejoras del producto design (gruia-app/design)

Inventario de gaps accionables. `[x]` hecho, `[ ]` pendiente, `(!)` requiere decisión.

## tools/gruia-gateway (auth SaaS)

- [x] G1 — `password_sessions` nunca se barre → sweep-on-write en `createSession`
  (commit `ad1a9f44d`, tests 5/5). Merged vía PR #4.
- [x] G2 — páginas HTML de auth sin anti-framing → `frame-ancestors 'none'` +
  `X-Frame-Options: DENY` (commit `0dfb46556`, tests 11/11). Merged vía PR #4.
- [ ] G3 — sin barrido periódico de sesiones: aun con sweep-on-write, una org sin
  logins acumula. (!) decisión: ¿merece timer dedicado? Bajo — G1 lo hace opcional.
- [x] G4 — rate limit de login solo en memoria y por email+global; sin bucket por IP.
  Añadido bucket por IP (20/min, 10k keys, sweep-on-access) alimentado por
  `AuthAuditContext.ip` (commit `380311354`, tests 27/27). Single-instancia
  in-memory — si el gateway pasa a multi-instancia reabrir como limiter
  compartido.
- [x] G5 — `GET /auth/session` `csrfToken`: verificado — `json()` aplica `noStore`
  globalmente a rutas /auth. Sin gap real.
- [ ] G6 — sin métricas/observabilidad propia (solo /healthz). (!) decisión de diseño.
- [x] G7 — sin auditoría de logins (quién, cuándo, desde dónde). Tabla
  `auth_audit` (event/at/email/user_id/org/ip/user_agent/detail) con retención
  90d + 100k rows; eventos login_success/login_failure(detail)/logout/
  session_revoked (commits `7db05a69b` + `a8f0e978f`, tests 27/27).
- [ ] G8 — `verifyCsrf`/`readSession` devuelven bool/null sin distinguir "expirada" de
  "inexistente" — logging forense limitado. Bajo.
- [x] G9 — `sessionTtlSeconds` hardcodeado a 14400 en config.ts ignorando el valor
  del config → leído vía `integer()` como sus vecinos (commit en batch gateway,
  tests 22/22). Merged vía PR #4.

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
  **Estado: sweep completo salvo tokens de protocolo.** Inventario restante
  verificado (grep `.json({...error:`): solo `collab-context.ts` (~30
  tokens snake_case: `missing_nonce`, `workspace_not_visible`, `forbidden`…)
  y `vela.ts` (~24 tokens AMR: `unknown_amr_api_proxy_path`,
  `vela_control_key_required`, `invalid_auth_request_id`…). Ambos emiten
  tokens que clients (web `parsed.error === 'x'` y posibles clients AMR
  externos) matchean como string — requieren migración diseñada de
  consumers con lectura dual, no sweep. Envelopes manuales legítimos que
  permanecen: critique artifact/interrupt (`error.currentStatus` es campo
  contractual asertado), strategy-rollout 409 (`status` sibling top-level),
  comments.ts fallback (emite envelope cuando ctx no inyecta sender).
  Siguiente paso si se retoma: plan de migración collab-context/vela —
  consumer-by-consumer a `error?.code ?? error` antes de tocar el wire.
  Ritmo aplicado: un fichero por iteración, consumers auditados antes de
  convertir.

## Coordinación

- [x] Crear FLEET_PROGRESS.json + WORKLOG.md + SAAS_GAPS.md (commit `4163d1c5b`).
- [x] Repo privado `gruia-app/design` creado; fork público renombrado a
  `gruia-app/open-design` (main = mirror limpio de upstream). PR upstream #8262 intacto.
- [x] Jenkins lane: Jenkinsfile + ci/app.yml en main (`1c44980f`), jobs.groovy
  mergeado (jenkins-platform#304), profile acv2 → jenkins (PR #4254).
