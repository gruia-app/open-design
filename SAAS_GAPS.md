# SAAS_GAPS — cola de mejoras del producto design (gruia-app/design)

Inventario de gaps accionables. `[x]` hecho, `[ ]` pendiente, `(!)` requiere decisión.

## tools/gruia-gateway (auth SaaS)

- [x] G1 — `password_sessions` nunca se barre → sweep-on-write en `createSession`
  (commit `ad1a9f44d`, tests 5/5). Merged vía PR #4.
- [x] G2 — páginas HTML de auth sin anti-framing → `frame-ancestors 'none'` +
  `X-Frame-Options: DENY` (commit `0dfb46556`, tests 11/11). Merged vía PR #4.
- [ ] G3 — sin barrido periódico de sesiones: aun con sweep-on-write, una org sin
  logins acumula. (!) decisión: ¿merece timer dedicado? Bajo — G1 lo hace opcional.
- [ ] G4 — rate limit de login solo en memoria y por email+global; sin bucket por IP.
  (!) decisión si multi-instancia.
- [x] G5 — `GET /auth/session` `csrfToken`: verificado — `json()` aplica `noStore`
  globalmente a rutas /auth. Sin gap real.
- [ ] G6 — sin métricas/observabilidad propia (solo /healthz). (!) decisión de diseño.
- [ ] G7 — sin auditoría de logins (quién, cuándo, desde dónde). (!) decisión: tabla
  `auth_audit` + retención.
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
- [ ] D3 — ~265 sitios `{error}` crudos restantes en daemon privado (tras MCP y
  brands). Mismo patrón por fichero; candidatos acotados siguientes:
  `import-export-routes.ts`, `project-file-versions.ts`, rutas de collab.
  Ritmo: un fichero por iteración, consumers auditados antes de convertir.

## Coordinación

- [x] Crear FLEET_PROGRESS.json + WORKLOG.md + SAAS_GAPS.md (commit `4163d1c5b`).
- [x] Repo privado `gruia-app/design` creado; fork público renombrado a
  `gruia-app/open-design` (main = mirror limpio de upstream). PR upstream #8262 intacto.
- [x] Jenkins lane: Jenkinsfile + ci/app.yml en main (`1c44980f`), jobs.groovy
  mergeado (jenkins-platform#304), profile acv2 → jenkins (PR #4254).
