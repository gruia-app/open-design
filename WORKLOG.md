# WORKLOG — sesión fleet design

## Revisión post-muerte del predecesor (ángulo escéptico)

- PR #8262 (upstream): verificado limpio — 44 commits, 121 archivos, cero contenido Gruia.
  `0e6d21363` es merge de upstream/main (`a4775ecea`) sobre la línea limpia `63a6d58df`;
  `9ecee06eb` (main Gruia) NO es ancestro. Sin contaminación.
- Trabajo no commiteado heredado: conversión de `apps/daemon/src/mcp-routes.ts` a
  `{ error: { code, message } }` vía `sendApiError` (17 sitios) + consumer
  `apps/web/src/state/mcp.ts` aceptando ambas formas + test nuevo
  `tests/mcp-routes-error-envelope.test.ts` (nunca ejecutado por el predecesor).
- Verificación: diff correcto (status/mensajes preservados, HTML OAuth intacto),
  cero sends crudos restantes, test nuevo 5/5 verde, tests MCP relacionados
  123/123 verdes, typecheck web + daemon verdes.
- Resultado: trabajo BUENO → commiteado `2cc1658f5`, pusheado a `fork`
  (entra en PR #8262 upstream, que es su casa correcta).

## Bucle fleet — repo privado gruia-app/design

- Base: `/home/roberto/src/design` (main @ `1c44980f` con Jenkins binding).
- Rama de trabajo: `fleet/gateway-hardening`.
- Gaps tomados de `SAAS_GAPS.md`.

## Paridad upstream D1 — batches mergeados

- Batch gateway (PR #4): G1 sweep sesiones expiradas, G2 anti-framing auth,
  G9 sessionTtlSeconds leído de config. 22/22 tests gateway.
- Batch 2 (PR #6, `73b37548f`): sidecar IPC validation, standalone records,
  web retry, env ignores. 232/232 tests.
- Batch 3 (PR #7, `8089972db`): pack/serve/release quoting+validation.
- Batch 4 (PR #8, `6384ae519`): web resilience, API envelopes, timeouts,
  review findings. 128/128 tests.
- Batch 5 (PR #9, `adefce32f`): dep tree patch (next 16.3.5, posthog-js),
  context-chip i18n, docs. 26/26 tests web + install/build verde.
- Cherry-picks resueltos conservando WORKLOG privado ante conflictos add/add.

## G10 — envelope de errores en brand-routes (rama fleet/brand-envelope)

- brand-routes.ts emitía 3 shapes distintos; consumer `useBrandExtract`/
  `brands.ts` pintaba `body.error` (el CODE) como mensaje → bug real de UX.
- Fix: 18 sitios por `sendApiError` + helper `apiErrorCodeForStatus`;
  `sendWorkspaceScopeError` reemplazado por `sendCreatedProjectWorkspaceError`
  + instanceof; `BRAND_EXTRACTION_STILL_STOPPING` registrado en API_ERROR_CODES;
  consumers web con lectura dual (legacy + envelope).
- Verificación: brand-routes.test.ts 34/34 (3 aserciones migradas al envelope),
  typecheck daemon + web verdes. Commit `6b878c4e2`.

## D3 batch 2 — envelope sweep (rama fleet/envelope-batch-2)

- `routes/genui.ts` (`406a03aae`): 14 sitios raw → `sendApiError` (import
  directo; registrar no tiene ctx.http). Consumers verificados (prop de
  componente). Typecheck verde.
- `routes/project/comments.ts` (`07d14a7b2`): 24 sitios raw → `ctx.sendApiError`
  con fallback que emite envelope en fixtures sin la dep. Tests
  comment-workspace-gate 23/23 + permissions 16/16. Typecheck verde.
- `routes/static-resource.ts` (`0fa8652de`): 28 sitios raw +
  `sendWorkspaceScopeError` local (`{error: code, message, retryable}`) →
  envelope vía `ctx.http.sendApiError`. Scope errors pasan su code con cast
  justificado (ApiErrorCode union va por detrás del set emitido;
  `sendCreatedProjectWorkspaceError` hace lo mismo). Atom 404 conserva
  `atom-not-found` en `details.atomCode`; skill-install conserva su código en
  `details.installErrorCode`. `text/plain` en endpoints de assets intacto
  (sirven contenido, no JSON API). Fixtures de tests ahora usan el sender real.
- Hallazgo colateral: `server-bootstrap-regression.test.ts` tenía aserciones
  viejas (`{error: 'run not found'}`) de los commits genui/runs — migradas al
  envelope en el mismo commit.
- Verificación: static-resource-routes 12/12, explicit-workspace-scope 12/12,
  workspace-resource-read-authority 2/2, skill-navigation 4/4,
  skills-workspace-scope 21/21, skill-url-install 30/30, team-resource 6/6,
  workspaceless-delete 1/1, bootstrap-regression 7/7. Typecheck daemon verde.
- `design-systems.ts` tiene SU PROPIO `sendWorkspaceScopeError` con shape viejo
  → siguiente candidato D3 (las aserciones 604-607 del test explicit-scope lo
  ejercen vía `registerDesignSystemRoutes`).

## D3 batch 3 — automation/routine/team-resource (rama fleet/envelope-batch-3)

- `routes/automation.ts`: 21 sitios raw → sendApiError (status dinámico
  404/400 mapeado a NOT_FOUND/BAD_REQUEST).
- `routes/routine.ts`: sitios raw + `sendRoutineError` (cuarta forma
  `{error: msg, code?, retryable?}`) → envelope; códigos workspace de
  AutomationWorkspaceScopeError preservados con cast documentado.
- `routes/team-resources.ts`: 5 sitios → sendApiError (403 copy-check ya usaba
  createApiErrorResponse).
- `routes/team-resource-share.ts`: resolveScope + share/unshare → envelope;
  WORKSPACE_RESOURCE_SHARE/UNSHARE_DENIED y WORKSPACE_AUTHORITY_UNAVAILABLE
  preservados verbatim, retryable intacto.
- Web: nuevo `utils/apiErrors.ts` (`apiErrorMessage`) — lectura dual de
  `{error: string}`, `{error: 'CODE', message}` y `{error: {code,message}}`.
  10 sitios en TasksView/RoutinesSection/NewAutomationModal que hacían
  `j.error || fallback` (habrían stringificado el envelope) migrados.
- Verificación: routine-routes 26/26, team-resource-share 22/22 (+cache,
  resync, routes, automation suites — 118/118 total), apiErrors.test 4/4,
  typecheck daemon + web verdes. Commit `0202c835b`.
- Nota: `plugins/index.ts` (38 sitios) evaluado y aplazado — mezcla tokens de
  protocolo (`missing_inputs`+fields), códigos kebab (`plugin-not-found`) y
  metadata (`warning`); requiere migración diseñada como collab-context.
- Batch 4 (rama fleet/envelope-batch-4, PR gruia-app/design#13, merge `e10add9b4`):
  collab-sync tokens UPPER_SNAKE -> envelope code verbatim + consumer
  public-file-publish dual-read; stragglers (interrupt-handler, runs,
  diagnostics-export, server.ts origin+plugin block); multiline sweep
  (reasoning-egress error.data -> details con journaling, xai 401,
  telemetry/genui, API_TOKEN_REQUIRED, powered-preview); media.ts residuals
  (WORKSPACE_CONTEXT_INCOMPLETE, catches dinámicos, open-external, scaffold,
  cross-origin, ResearchError). 305 tests verdes en el batch, typechecks OK.
- Batch 5 (rama fleet/envelope-batch-5): plugins/index.ts (~40 sitios:
  missing_inputs->code+details.fields con dual-read en `od plugin apply`,
  kebab-codes verbatim, MANAGE_DENIED verbatim, warning->details);
  daemon.ts oauth-launch + companion; comments.ts fallback+retryable;
  plugins/assets workspace third-shape; strategy-rollout (data->details,
  status sibling preservado); web launchAntigravityOauth dual-read.
  Inventario final D3: sweep completo — solo quedan collab-context.ts y
  vela.ts (tokens de protocolo, migración diseñada documentada en
  SAAS_GAPS). ~150 tests verdes en el batch; typechecks OK. Flakes de
  carga en od-next e2e clasificados por rerun aislado.

## Gateway auth — G7 auditoría + G4 rate-limit IP (rama fleet/next-gaps-2)

- Revisión post-muerte del tramo anterior: diffs G7/G4 auditados, 27/27
  tests re-ejecutados — trabajo del predecesor correcto, sin correcciones.
- `7db05a69b` G7: tabla `auth_audit` (event/at/email/user_id/org/ip/
  user_agent/detail) con retención sweep-on-write (90d + 100k cap, mismo
  patrón que login_csrf/password_sessions). `SessionStore` gana
  recordAuthEvent/readAuthAudit; `GatewayCore` registra login_success,
  login_failure (invalid_credentials / not_admitted / rate_limited /
  csrf_rejected) y logout con contexto del request (x-forwarded-for
  primer hop o socket, user-agent acotado). Detalle de fallo queda
  interno — respuesta HTTP inalterada (sin enumeración de usuarios).
- `380311354` G4: tercer bucket en `LoginRateLimiter` — 20 intentos/min
  por IP (cap 10k IPs trackeadas, evicción FIFO como el bucket email),
  alimentado por `AuthAuditContext.ip`. Callers sin contexto mantienen
  comportamiento previo (email+global). Intentos rechazados no consumen
  slot y auditan `rate_limited` con la IP.
- `a8f0e978f` refinamiento G7: `authorize()` audita `session_revoked`
  (detail `identity_mismatch`) cuando mata una sesión por identidad
  revocada — delete antes de auditar → una fila por revocación, no una
  por request con cookie stale.
- Verificación: typecheck + 27/27 tests gateway verdes en cada paso.

## D3 cierre — migración diseñada de tokens de protocolo (rama fleet/protocol-tokens-1)

- `dbe65a54b` fase 1 consumer: `apiErrorCode` en `utils/apiErrors.ts` +
  dual-read en `useWorkspaceContext` (billing) — tests 8/8 helper + 54/54
  billing scope.
- `8697251e9` collab-context wire: ~30 tokens → `error.code`+`error.message`
  verbatim; `acceptedGeneration` preservado como sibling top-level (manual
  json, patrón strategy-rollout); 6 aserciones stale migradas; 725/725
  tests collab verdes.
- `263606cbf` vela.ts wire local: `/api/integrations/vela/*` +
  `/api/amr/models` enveloped; login preserva siblings
  (authAttemptId/authStages/authRoute/fallbackUsed) con envelope manual;
  `proxyVelaMessageCenterRequest` convertido (consumers web+CLI nuestros).
  Diferido `proxyAmrApiRequest` (6 sitios): sirve al binario vela hijo vía
  `proxyApiUrl` — parsing de errores externo no verificable.
  Consumers: message-center-client `apiErrorCode` (status 503),
  providers/daemon `startVelaLogin` `apiErrorMessage`. CLI
  `structuredHttpFailure` y MCP `formatDaemonError` ya duales.
- Verificación: daemon typecheck + web typecheck + 93/93 daemon
  (vela.routes + bootstrap-regression) + 62/62 web (MessageCenter,
  AmrLoginPill, EntryNavRail) + 24/24 MessageCenter re-run.
- Corrección menor: dos aserciones `body.error.code` en
  workspace-switch-warms-caches necesitaban cast (`Record<string,unknown>`).

## Gateway G3 — barrido periódico de sesiones (rama fleet/next-gap-3)

- `d12f06f71`: `SqliteSessionStore` gana `sweepExpired()` + intervalo
  `unref()` de 15min (desactivable con `sweepIntervalMs=0`); cubre orgs
  sin actividad que sweep-on-write no alcanzaba. Reapa
  `password_sessions` + `login_csrf` expirados y aplica la ventana de
  retención de `auth_audit`. `close()` limpia el timer (tests lo llaman
  en afterEach). Tests 30/30 + typecheck verdes.
- Cherry-pick descartado: `441ab84b0` (od-card JSON parse) — los ficheros
  no existen en el fork (refactor ChatPanel eliminó `runtime/chat/`).

## Paridad upstream — lote 4 (rama fleet/parity-4)

- Cherry-picks limpios: `49bcdfecc` (prefer direct Copilot CLI, #7974 —
  65/65 env-and-detection), `b8b23ea1f` (defer invalid-payload until
  launcher eligible, #7520 — 2/2), `3f3425835` (BYOK image input sin
  capability metadata, #8035 — 103/103 chat-route+byok), `e7e4b52b2`
  (MCP workflow id en confirm briefs, #7779 — 15/15).
- Descartados: `441ab84b0` (od-card) y `b9c05695f` (cover renderer) — sus
  ficheros no existen en el fork (runtime/chat + chat-artifacts
  eliminados por refactor ChatPanel). `ad4a8fc40` conflictúa en
  ProjectView divergente.
- `3552c6a53`→`9f9e26f31` (en PR #17): ACP URL title fix con test e2e
  portado a unitario daemon (build-turn-blocks no existe en el fork).

## Paridad upstream — lote 5 (rama fleet/parity-5)

- Cherry-picks limpios: `32cae7f17` + `6fc501fb6` (mantener credenciales
  Basic del proxy fuera de los lanes tool-token de media-wait y export,
  #8006/#7999 — seguridad), `ac06579fa` (cancelación de sesión ACP como
  notificación, #7959), `d54f5cf07`→HEAD (kinds canónicos de monitoring
  cliente, #7945 — 43/43 web observability).
- Descartados por divergencia/borrado en fork: `a62d5e08c`
  (QuestionForm), `ab009b1a3` (file-ops), `ad9078b87` (chat footer).
- Verificación: tasks-routes 9/9 + export-tool-token 16/16 + acp 94/94 +
  web observability 43/43.

## Paridad upstream — lote 6 (rama fleet/parity-6)

- `8fdb5bc52` (upstream #7980): `adoptHostInputStage` — el daemon corrige un
  Runtime State válido que nombre el stage equivocado (`request` en un turno
  de clarificación) antes de validar; el prompt de continuación de
  clarificación ahora nombra `inputStage clarification`.
- `9638d8843` (upstream #7793): colapsa brazos ternarios idénticos en
  `normalizeComparableValue`.
- `66058730e` (upstream #7725, prerequisito de #7980): `blockedAttribution` —
  las tres rutas que asientan `blocked` persisten `blockedContext`
  (reasonCodes + visibleText); `prepareStrategyRequest` y el blocked
  declarado por el agente ya no lo pierden.
- Revision post-muerte: los 2 tests rojos del predecessor NO eran un mal
  pick — `OD_NEXT_AGENT_DECLARED_BLOCK_REASON` se añadio a
  `packages/contracts/src/` pero el daemon resuelve contracts via `dist/`
  (gitignored, stale). Rebuild de contracts → 42/42 coordinator + 25/25
  prompt-recipe + typecheck verdes. Leccion: rebuild contracts tras cualquier
  pick que toque `packages/contracts/src`.

## Paridad upstream — lote 7 (rama fleet/parity-7)

- `c6e0fca3c` (#6327): catálogo Novita AI ampliado.
- `4537ab17e` (#8273): Vela CLI bundled 0.0.35→0.0.38 — resuelto a mano
  (nuestro base estaba en 0.0.35, no en 0.0.37) con `pnpm install
  --lockfile-only`; lockfile solo toca entradas vela-cli con los mismos
  integrity hashes que upstream.
- `dab5cfc14` (#7963): el cleanup del updater no borra el payload launcher
  que está corriendo (desktop, 7/7 tests).
- `73bf94d37` (#8046): los tool results ACP fallidos se preservan (11/11).
- `0520f3f08` (#7575): clarificaciones OD Next resumibles tras restart sin
  source Run snapshot (71/71).
- Descartados por divergencia de fork: `11943a400` (amr-guidance web),
  `b9c05695f` (cover.ts borrado en fork — conflicto DU).

## Paridad upstream — lote 8 (rama fleet/parity-8)

- `a51751d27` (#7958): AMR compaction continuation sin replay — conflicto en
  `run-failure-classification.ts` resuelto manteniendo solo el check
  `AMR_CONTINUATION_ERROR_CODE` (upstream asumía `hasDaemonTimeoutVerdict` de
  #7884, no portado).
- `04192a480` (#4620): request_id + token usage por request en runs
  claude_code (25/25).
- `6fd3453d5` (#7942): runs bloqueados por OD Next fallan antes de
  finalization — conflictos de test resueltos manteniendo
  `OD_NEXT_STRATEGY_ROLLOUT=off` y descartando `OD_CODEX_TRANSPORT` (no existe
  en el fork); `beforeEach` import añadido.
- `e69489ab1` (#7907): docs Rescan rename.
- `c3513c9d9` (#7977): patch cut gate sobre el patch previo (18/18 + 80/80
  topology).
- Descartados por dependencias ausentes: `810cbe058`, `6801f25c0`,
  `d465086b2`, `07170f8d2`, `712b0db97`, `11943a400`, `875d0b95a`.
- run-retry-runtime: 2 fallos iniciales clasificados como flakes de carga —
  ambos pasan aislados en HEAD y en el padre.

## Paridad upstream — lote 9 (rama fleet/parity-9)

- `bc064afaa` (#8027): packaged MCP runtime integrity + sidecar delivery —
  nuevo `packaged-entry.ts` + `runtime-manifest.ts` (35/35 tools-pack).
- `850e75056` (#7957): runtime-verification de prerelease + contratos Vela
  (8/8 + e2e vela-contract nuevo).
- `1dc3876cc`/`f38c77c65`/`2848fe3f6` (#7792/#7698/#6590): docs.
- `3f04072f9` (#7825): DeepSeek Harness 0.1.2-rc.1 (7/7 daemon + 7/7 e2e).
- `b830d0452` (#7753): copy francés setup/recovery.
- Descartado: `81044a03c` (whats-new doc conflicto), resto de cola depende de
  ChatPanel rebuild o pipelines no portados.

## Lote 10 — paridad (fleet/parity-10)

- Revisión post-muerte: picks a745c2ca2/c9edcea4b auditados — correctos, tests ya verdes (78/78 chat-route, 12/12 entry-handoff).
- `a745c2ca2` — packaged: espera al predecessor updater antes del instance discovery (evita focus-exit).
- `c9edcea4b` — daemon: guard de modelo chat-capable en runs AMR (`isVelaChatCapableModelId`).
- `d3f232306` — desktop: comparación portable de capturas PPTX (62/62 verdes).
- `4cc7d9be1` — e2e: hardening del mock de onboarding status ante reload race (Playwright, fuera de vitest).
- Descartado: `53a47bf91` (10 ficheros de tests chat-observability conflictúan — divergencia ChatPanel).

## Lote 11 — paridad (fleet/parity-11)

- Revisión post-muerte: diffs de lote 10 auditados y correctos antes de mergear (PR #24 `e856fdbba`).
- `28382121c` — ci: DSH upstream drift card legible (16/16 script test).
- `7ce1b7484` — release: stable ya no se bloquea por release notes ausentes (80/80 smoke-topology, 90/90 tools-release).
- `a2229cec2` — e2e: timeout de readiness de packaged Home determinista (7/7).
- `7fa06a408`→pick — diagnostics: evidencia de entorno acotada para fallos workspace (91/91 suites tocadas; conflicto en diagnostics-export resuelto descartando el bloque scroll-forensics — maquinaria `diagnostics-client-evidence.ts` ausente en el fork).
- Descartados: `6b60b567a` (ya aplicado — pick vacío), `954f304dd`/`1424be972` (ChatPanel diverge), `5b50e9e4b`/`46be6eacc` (deps ausentes), `f95b9a6ee` (contracts media-task diverge), `875d0b95a`/`35fa33b3c`/`d232620c1`/`21bba485b` (conflictos), `07170f8d2`/`1bdc05228`/`a07dc736f`/`faba30243` (maquinaria prerelease-card ausente), CMS (app ausente).

## Lote 12 — gateway forense (fleet/parity-12)

- Cola upstream agotada: todo lo restante depende de ChatPanel rebuild, CMS,
  codex-app-server o maquinaria prerelease-card ausentes en el fork.
- `a9a7099f0` — G11: `authorize()` acepta AuthAuditContext; los 3 call-sites
  (GET /auth, requests protegidos, upgrade WS) pasan ip/user-agent →
  `session_revoked` registra quién presentó la sesión revocada (31/31).
- `4898b0bd9` — G12: mismo contexto para `session_expired` (readSession/
  verifyCsrf aceptan AuthAuditContext; cubre authorize + logout + csrf).
- `G13` — `login_failure:malformed_form` para POSTs sin email/password y
  `logout_failure:csrf_rejected` para logout con CSRF inválido (antes ambos
  salían 401/403 en silencio) (31/31).

## Lote 13 — gateway forense + convergencia (fleet/gaps-13)

- `f490b4785` — G14: `authorize()` revoca + audita `session_revoked:org_not_admitted`
  cuando la org de una sesión válida deja de estar admitida (antes null silencioso,
  fila viva hasta expirar) — 32/32.
- Convergencia: la cola upstream restante depende íntegramente de maquinaria
  ausente en el fork (rebuild ChatPanel, CMS, codex-app-server,
  prerelease-progress-card, deliverable-syntax pipeline, scroll-freeze
  observability) o son features grandes (bb9682a5f OD Next default route).
  Verificado por existencia de ficheros + cherry-pick seco.
- Pendientes reales: G6 (decisión /metrics vs logs estructurados — requiere
  operador), proxyAmrApiRequest flat tokens (parsing del binario vela no
  verificable — ELF Go compilado; conservador mantenerlos).

## Lote 14 — gateway proxy + hygiene (fleet/gaps-14)

- Revisión post-muerte: main con PR #24-27 verificado (32/32 gateway verdes).
- `87da4c53c` — G15: `daemonUpstreamHeaders` propaga `x-forwarded-for` con la IP
  resuelta por authContext (antes el daemon veía la IP del gateway — auditoría
  daemon-side sin atribución real). HTTP proxy + upgrade WS (33/33).
- `2149b0e97` — G16: `shutdownGateway` — cierre forzado de sockets keep-alive/SSE
  tras gracia para que SIGTERM no cuelgue en streams proxy abiertos (33/33).
- `afb24f5e2` — hygiene: `.playwright-cli/` estaba commiteado sin ignore →
  untracked + ignorado (contrato: scratch de agente fuera de git).

## Lote 15 — gateway session-store + deploy + campaign publisher (fleet/gaps-15)

- Revisión post-merge: main con PR #28 verificado (34/34 gateway verdes tras G17).
- Auditoría del session-store: AES-256-GCM correcto; gap forense en el path de
  ciphertext indescifrable.
- `c5c551aa7` — G17: `session_revoked:csrf_undecryptable` auditado con contexto
  (34/34).
- `0e7d675ee` — G18: HSTS en `deploy/gruia/Caddyfile`.
- `8e44af759` — G19: `verify()` del publisher pinea el body remoto al sha256
  aprobado por QA; antes un deployment con la misma marca y bytes distintos
  quedaba `published` (10/10 publisher + 32/32 runner).

## Lote 16 — CI privada + drift doc↔código (fleet/gaps-16)

- `621f9e4f9` — G20: `ci/app.yml` (Jenkins) ahora corre las suites privadas
  `@open-design/gruia-gateway` (34) y `deploy/gruia/campaign/tests` (42) —
  antes no corrían en ningún CI.
- `886b75c85` — docs: `gruia-auth.md` sincronizado con G4 (bucket por IP),
  G9 (`sessionTtlSeconds` efectivo), G15 (`x-forwarded-for` re-asertado).
- `7d7369001` — docs: `gruia-b2b-campaign.md` sincronizado (concurrencia 16,
  publisher.test.ts en verificación, pin sha256 en `published`).
- Auditoría completa de `deploy/gruia/` (Dockerfiles, scripts, systemd,
  Caddyfile, campaign tooling): endurecido salvo los dos gaps corregidos
  (HSTS G18 en lote 15, pin sha256 G19).

## Cierre de sesión — convergencia

- Superficies privadas auditadas completas: gateway (G1-G20), deploy/gruia
  (Dockerfiles, Caddy, scripts, systemd, campaign publisher/runner/verifier),
  componentes web Gruia/AMR, mocks, docs, ci/app.yml.
- Upstream: 142 commits triageados; todo lo restante depende de maquinaria
  ausente (ChatPanel rebuild, CMS, codex-app-server, prerelease-progress-card,
  deliverable-syntax, scroll-freeze, media-task contract).
- Bloqueados por decisión humana: G6 (observabilidad), proxyAmrApiRequest
  (tokens planos — binario vela no verificable).

## Lote 18 — post-review G19 + cobertura verifier (fleet/gaps-18)

- Revisión del propio G19 con otro ángulo: dos edges reales — el probe
  truncaba el body a 2MB (prototipo mayor → failed permanente) y hasheaba
  utf-8 con reemplazo en vez de bytes crudos.
- `98613bcdb` — el probe Python hashea el stream crudo (guard 16MB) y devuelve
  `sha256`; `verify()` lo prefiere. `localEligibility` hashea el Buffer —
  `qa.json` siempre fue un digest de bytes. Probe validado en vivo.
- `ea832989f` — tests del guard SSRF del public-verifier (https,
  `*.vercel.app`, sin credenciales; rechazo antes de execFile). 45/45.
- EXPOSE 3006 en Dockerfile.gateway (paridad metadata con prebuilt).

## Lote 19 — probe acotado fail-closed (fleet/gaps-20)

- Post-review #2 del stream-pin: el loop de hash del probe leia el body sin
  cota — un endpoint drip-feeding podia mantenerlo (timeout por chunk).
  Stream acotado a 16MB con byte de overflow → `truncated`; `verify()`
  falla cerrado (body parcial nunca pinable). Test de regresion. 46/46.
- PR #35 `056699a32`.

## Lote 20-21 — auditoria de superficie completa (fleet/gaps-21/22)

- `vercel-sync.ts`: rehusa sobrescribir si la conexion no existe o cambio
  de teamId; errores sanitizados; status 0600.
- Dockerfiles (studio/gateway), units vercel-sync (UMask 0077,
  NoNewPrivileges), scripts con 0755, cero secretos commiteados.
- G21 `pnpm audit`: `esbuild 0.28.0` del gateway caia en GHSA-g7r4-m6w7-qqqr
  → bump `0.28.1`. Resto del reporte (vite/vitest/electron/extract-zip):
  cadenas dev de upstream — bump local divergiria el lockfile.
- Doc drift: `gruia-b2b-campaign.md` decia "50 encargos"; el manifest crecio
  a 73 (25 Fable + 48 Opus) via extensiones → sincronizado.
- PR #37 `4c8c2e447`.

## Lote 22 — deps + cobertura browser-qa (fleet/gaps-24)

- G22 deps del gateway: `pg` 8.16.3→8.23.0 (runtime), `@types/pg` 8.23.1,
  `@types/node` 24.13.6 (linea Node 24), `esbuild` 0.28.2. Majors
  typescript/vitest omitidos — siguen el pin del repo. 34/34.
- G23 tests del scope guard de `browser-qa.ts` (`^\d{2}$` id, `^[\w-]+$`
  projectId) — rechazo antes de lanzar chromium. 48/48.
- PR #39 `c73a2ee2e`.

## Lotes 23-26 — integridad de coordinacion (fleet/gaps-25/26)

- Auditoria del ledger: commits/PRs citados en WORKLOG/SAAS_GAPS todos
  existen y mergeados.
- `deploys_pending` se detuvo en PR #28 — backfill de PRs #29-#40 (PR #41
  `70abe0844`).
- Verificacion de prod: `design.gruia.app` corre Caddy pre-G18 (sin HSTS,
  nosniff duplicado) → deploys son backlog real, no artefacto del ledger.
- `pnpm install --frozen-lockfile` consistente tras los bumps.

## Lote 27 — protocolo operativo (fleet/gaps-27)

- FLEET_PROTOCOL.md era anterior al flujo real: documentado §5 — rama
  fleet/*, PR >=5 (o batch real), `gh --repo` por los 3 remotes,
  auto-merge deshabilitado → merge directo, ramas locales "unmerged" tras
  squash, sync-PRs de coordinacion, probe HSTS de verificacion de deploys.

## Lote 28 — fleet WORK_BACKLOG mapeado sobre design

- Backlog de flota triageado contra la superficie real del fork:
  pago/checkout/billing/planes/dunning/emails transaccionales = ausentes por
  diseño (identidad y admisión de orgs viven en el ecosistema externo; sin
  mailer ni comercio). Documentado en SAAS_GAPS.md para que futuros ticks no
  re-deriven; mailer y URL de soporte añadidos a blocked como decisiones.
- G24 analytics por tenant (versión honesta mínima): la única señal
  por-tenant del fork es auth_audit → `gruia-gateway audit --db <path>
  [--days N] [--org <id>]`, reporte read-only de operador (totales por evento,
  usuarios distintos, por-org, última actividad, top IPs). Subcomando local a
  propósito: exponer auditoría por HTTP filtraría metadatos de auth a
  cualquier sesión; el operador lo corre vía SSH o contra copia montada.
- Data lifecycle verificado: borrar un usuario en la BD de identidad externa
  ya está cubierto — authorize() re-resuelve identidad en cada request →
  identity_mismatch → sesión revocada + auditada. Sin código nuevo.
- Fix de revisión: `audit` sin --db y sin GRUIA_GATEWAY_CONFIG lanzaba
  TypeError crudo desde resolve(undefined); ahora error de uso en una línea.

Verificación: gateway 37/37 (3 tests nuevos de audit-report), typecheck limpio.

## Lote 38 — picks upstream lote 30 + fixes de contrato (fleet/gaps-38)

- Revision post-muerte del predecesor: picks de PR #51 verbatim upstream,
  indice `auth_audit_at` verificado con EXPLAIN QUERY PLAN, tests verdes
  (gateway 38/38, collab 74/74, srcdoc 44/44). Trabajo sano.
- `7438807de` — Vela CLI 0.1.3 (upstream #8299). Lockfile regenerado con
  pnpm; solo entradas vela-cli, integrity hashes identicos a upstream.
- `7413c6daa` (Home Prototype/type picker) SKIP: feature de producto,
  y Home divergio en el fork (GRUIA_MANAGED/GruiaDesignWorkflow, f0a1f8b12).
- `66c226c7a` — manifest-backed artifacts (upstream #7586): sidecars
  `<file>.artifact.json` validados via parsePersistedManifest cuentan como
  artifacts aunque la extension no este en la allowlist (Markdown exports).
  Incluye la maquinaria de coverage de #8172 local al fichero
  (snapshotCoverage/complete/filesWrittenUnknown). `.cjs`/`.mjs` excluido:
  pertenece a #7801 (deliverable syntax, ausente). 23/23 tests.
- `fb5fd4a35` — fix de contrato preexistente: el test OPEND-2953 llevaba
  rojo desde parity batch 8 (asercion `retryable: false` sin el campo).
  Port parcial de #7518: `run.retryable` en ChatRun + ChatRunStatusResponse,
  asignacion del clasificador, emission en statusBody y frame SSE `end`,
  reset en resume, stamping en el evento status:error persistido (con
  `failureAction`, tambien ausente), y variante `done_key` del contrato.
- `eeceb1b56` — strategy continuations (upstream #8195 + guard #8250):
  posiciones de run solo desde runMappings daemon-issued; sin herencia del
  strategyTaskRunIndex del predecesor; posicion descartada con mappings
  ausentes/wrong-run/duplicados; runs succeeded aparcados en el usuario se
  sellan tras el probe sin replay. Adaptaciones: sin executionIntent
  (cadena #8172 ausente), testid `assistant-role` en AssistantMessage,
  caso `done_key` en el switch de visibilidad de ChatPane.

Verificacion: web fold tests 10/10, runtime+sse 104/104, contracts 512/512,
daemon typecheck + web typecheck verdes, test OPEND-2953 verde.

## Lote 39 — re-triage de skips upstream (fleet/gaps-39)

- `441ab84b0`+#8258 via `b529b235d` (ya registrado arriba): splitShellCards.
- `5b50e9e4b` via `d8a217878`: verdicts blocked en recovery/reload (ya registrado).
- `4891d62b3` — subset de #8240 (6fd2f6080): headers de autoridad workspace
  (type/role/lifecycle/member-status) en reads locales de /api/workspace/context.
  El resto no porta: EntryShell del fork gatea antes de crear proyecto, sin la
  arquitectura optimistic-frame (onBeginProjectCreation). El mismo commit
  repara el spec blocked-history-hydration que d8a217878 dejo roto en
  typecheck (helpers upstream ChatPanel -> runStatus pre-fold + card
  data-user-action-card="run-recovery").
- `5bf4ba2a6` — spec de los headers (test seam explicitWorkspaceHeaders).
- `8fe36928f` — subset OPEND-3283 de #8223 (b419463f9): scrollMovesAnchor +
  gating en RailRecentRow. El row menu del dock no existe en el fork;
  RailRecentRow tenia el mismo bug de dismiss-por-scroll.
- SKIP `792480fe2` (#8170): subsistema completo (spawn file-backed stdin,
  reaping via packages/platform, payload heal) con 11 conflictos incl.
  run-steering borrado en el fork. Sin subset coherente seguro.
- SKIP `7413c6daa`: feature Home Prototype; Home divergio (Gruia).
- SKIPs `f5707c8ca`, `3d76f3c94`, `e35e6542f`: subsistema campaign/touchpoint
  ausente del fork.
- SKIPs `3c7b16b44` (project-split-layout ausente), `053abdc1b`/`425a33237`
  (test-only, ficheros ausentes).

Verificacion: web typecheck verde; 17/17 hydration, 4/4 scroll-moves-anchor,
2/2 explicit-workspace-headers.

## Lote 40 — re-triage upstream, ronda 2 (fleet/gaps-40)

- `810a5f103` — gap propio: el fold de ChatPane concatena producedFiles de
  runs fisicos con rutas repetidas (warning React duplicate key). Dedupe por
  (path,name) conservando la ultima entrada en ProducedFiles.
- `6b9b99bdf` — subset de `92f27d1fc` (#7801): `.cjs`/`.mjs` en
  RENDER_DEPENDENCY_EXTENSIONS. run-artifact-fs.ts converge a upstream.
- `d8f819db6` — port `6734dbba2`: proyeccion strategyTaskBlocked/BlockedText
  scoped por (projectId, conversationId) en historial de conversacion.
- `54f3af052` — port `a10e4671b` (#7917): pickerSelectionAnchor; el model
  picker abre anclado al modelo en efecto, una vez por apertura.
- `509edded8` — port `a3da5e06c` (#7954): load-conversation-transcript con
  retries acotados (500/1s/2s, budget 15s); listMessages acepta AbortSignal y
  trata 408/429/5xx como retryable sin hint.
- SKIP `fd8599458` (#7898): stick-to-bottom.ts y chat-scroll-following borrados
  en el fork (scroll divergente, rebuild ChatPanel #7518).
- SKIP `5f7baf9c9` (#7900): premisa sendFailed ausente en el fork.
- SKIP `c764b21e5` (#7793): ya aplicado en el fork.

Verificacion: web typecheck verde; transcript 104/104, ProjectView 145/145,
artifact-fs 24/24, strategy-history 11/11, model-picker 6/6.

## fleet/gaps-41 — media-failure + ACP + fork-artifacts (publicado como PR pendiente)

- `0992a712e` — port `f95b9a6ee` (#7933): routes/media.ts reporta fallos
  host-observados al run origen (options.grant.runId); runs.ts guarda
  mediaTaskFailures acotadas/idempotentes; completitud terminal las trata
  como evidencia unfinished; contrato RunMediaTaskFailure + emissions en
  ChatRunStatusResponse/ChatSseEndPayload; reset en resume. Test adaptado a
  fork-native (sin maquinaria <od-done>): fallo host manda sobre prosa del
  modelo; exito intacto; todo-pendiente sigue unfinished.
- `5ede573e1` — chore fleet: registro del port + skip diagnostics-evidence.
- `805f218ed` — e2e ACP: inferencia de archivo por titulo excluyendo URLs
  (fixture 9/9; el fix daemon ya estaba — delta real = test adaptado).
- `8bfbbbc84` — port `810cbe058` (#8015): flushForVisibleOutputCheck preserva
  texto ACP bufferizado antes del chequeo empty-output; supresion de prefijos
  tool-call incompletos vs pseudo-tags literales; cadena DSML suppressor;
  re-entry preservado.
- `0b98c16af` — REPARACION: la normalizacion TodoWrite de #8015 quedo en el
  working tree al commitear 8bfbbbc84 — el branch commiteado estaba rojo en
  acp-visible-output-flush. Lands el fix faltante.
- `87364984b` — port `1bd134dc5` (#8029): PUT plegado que trae done_key de
  fila hermana preserva campos run-owned de la fila almacenada; fork copies
  conservan verdict terminal (settledForkVerdict) pero no punteros; web merge
  producedFiles ownership; variante artifact_focus en contrato + clasificada
  no-visible en ChatPane.

Verificacion: conversation-fork-artifacts 5/5, projects 49/49,
acp-visible-output-flush 10/10, daemon+web typecheck verde.

## fleet/gaps-42 — chat compositor clip + unanswered question collapse

- `782c1654f` — port `f5a03f77a` (#8228): border-radius:0 en el pane del
  chat slot (el radio convertia el clip en rounded clip -> compositor no
  podia hit-testear -> wheel_stall). + OD_MOCKS_TEXT_DELTAS en mock claude.
- `db0c3bb87` — port `d14b10e1f` (#8158): form sin responder colapsa en
  details/summary "Unanswered" cuando llega un user posterior; split
  answered/locked; questionFormAnswerable = nextUserContent===undefined;
  keys qf.unanswered x19 locales. Adaptado al fork (sin AnsweredSummary /
  StepProgress / useMemoryWrittenCard / ChevronIcon -> Icon chevron-down).
- Skips/no-ops: 900d01c61, d992e09fb, 287357b12, 1aa228115, 127ec0f02 (ya
  aplicados), b9c05695f (cover.ts ausente), ad4a8fc40 (maquinaria #7518).

Verificacion: unanswered-history 7/7, opend-2644 spec 5/5, QuestionForm+
resubmit+jump-button 39/39, web typecheck verde.
- `f9ab4a745` — port `a62d5e08c` (#8033): sin tooltips nativos duplicados
  en opciones (labels inline del fork; SelectChoice upstream ausente).
- `e4fedda22` — port `e10b5b487` (#8010): chrome del form via uiT (fork ya
  tenia tForLanguageTag); specs de locale-split adaptadas (SelectChoice
  ausente -> caso grouped-menu descartado).

## fleet/gaps-43 — attachment sizes, send-admission, strategy retry, durable snapshot

- `2ceb03144` — port `b4783cfc8` (#8030): size de adjuntos en seeded user
  turns (seededAttachmentSize con guard anti-traversal; ChatAttachment.size
  ya existia). headless-runs 20/20 (1 flake de carga).
- `a72d72810` — port `0c500ef3e` (#8069): boton "preparing" durante admision
  de envio (estado espejo del ref + gating de stop/send). Spec nueva 2/2.
- `3989db8b3` — port `246ec7d06` (#7981): retry de tarea foldada resuelve al
  run fallido real (resolveRetryTarget cruza sucesores de la misma task).
  Spec adaptada (clase chat-error-retry, sin testid). 7/7.
- `3d5cfc765` — port `01726d9fc` (#7575): durableRunState serializa
  appliedPluginSnapshotId estricto; la parte de recovery ya estaba
  converged (parity batch 7). run-durable-snapshot-id + workspace-gate 71/71.
- Skips/no-ops: 10 picks ya aplicados (8031b5e21, 1af682238, 668c09436,
  6d1d91a30, 9f76c3a9c, 75840861f, e2944daba, 6b0692f86, eb7fbd817,
  c333324da); 393ecfe9e/50e9c0fcc (cadenas #7863/#8007 ausentes);
  875d0b95a/6801f25c0/bf60362db/6086bbfd9/0af03070e (ficheros borrados).

## fleet/gaps-44 — i18n fr, read ranges, Cloud retry authority, pending-form todo gate, footer wrap

- `0994968a3` — port `7dc55872b` (#8034): ~70 claves library.* en fr.
- `34e4587d2` — port `ab009b1a3` (#8019): readRanges por file op
  (extractReadRange + merge por path). Spec adaptada. 15/15.
- `239f1c6a1` — port `9c5ee3c91` (#7953): retry Cloud preservado entre
  proyeccion directory->scope (workspacePrincipal + matchesRouteContext +
  amrAuthRetryReady/Pending). Contracts: WorkspacePrincipal/Key/isSame
  verbatim. Sin recovery-gating (OPEND-2821 ausente). 5/5 + 71/71 + 25/25.
- `7acbe32c4` — port `5f814a5cd` (#7989) adaptado: el continue del fork
  vive en PinnedTodoSlot (no boton por-mensaje); gate de form completo
  pendiente sobre el ultimo assistant. Spec reescrita a .op-todo-continue.
  4/4 + ChatPane.streaming 34/34.
- `2b3b4e8ce` — subset de `ad9078b87` (#8001): flex-wrap+min-width en
  .assistant-footer-controls (unicas reglas con markup en el fork).
- Skips: `d06eb1efe` no-op tras resolucion.

## gaps-45 (2026-09-21)

- `81f2f6259` — port `e21f6bf29` (#8031): titulos largos de question-form
  recuperables via title attr + estilos .qf-picked. 2/2 + 41/41.
- `4e86dc863` — port `4de36a0f7` (#7955): historial legible retenido durante
  refresh de authority del mismo principal; queue/send bloqueados hasta
  lectura autoritativa. 13/13 + 51/51.
- `3a54b132c` — port `d465086b2` (#8126) adaptado: links AMR a rutas Cloud
  dashboard (daemon por perfil + mapa web). El fork mantiene la decision
  deliberada de enviar CTAs genericos a /pricing/ publico. 138/138 + 88/88.
- `841f60e19` — port `53a47bf91` (#7944): clientType+osName en telemetria
  de excepciones direct-fetch. Tests DU de maquinaria ausente descartados.
  50/50.
- `921caeecd` — port `ea58bd752` (#8250): la mitad faltante del fix —
  liveAssistantMessageIds en el merge transcript autoritativo evita que el
  buffer flush duplique frames tras GET mid-run. Bug real del fork
  corregido (form duplicada tras authority refresh). 208/208.
- Skips: `712b0db97` (chat-turn-host-protocol/next_steps ausente),
  `1ff25e5b2`/`d5eddcb59`/`287357b12`/`ac6115406`/`b6b0022fb`/`55b3762af`/
  `0ffafb3d7`/`441ab84b0` no-ops ya converged, `e3400d2d0`/`1424be972`/
  `39d9eb593`/`dcfd44eed`/`13d3676f8`/`954f304dd`/`98f2fd1a4` maquinaria
  ausente.
- `c6f703806` — port `863b62b39` (#8225) adaptado: replay SSE durable
  (eventsLogFinalFlush + journal events.jsonl + cola pending) en
  createChatRunService; guia default/defaultValue en discovery-question-form
  conservando direction-cards del fork. Skips: turnEndedByAskingUser
  (cadena #7518 ausente), group/trailingLabel de select (no renderizado).
  9/9 + 5/5 + 14/14 daemon, 55/55 + 3/3 web.

## gaps-46 (2026-09-21)

- `744749878` — waitFor determinista en clarification reattach test (race
  resuelta). Publicado en PR #60.
- `f2738983a` — completa #8008: probe projectDeliverableForBlockedStrategyTask
  en GET status (veredicto retained en recovery/reload); el resto del commit
  ya convergia en d8a217878. 11/11 cold-projection + 32/32 web.
- `cd17a44a1` — port 6fd2f6080 (#8240) adaptado: wallet $0 definitivo
  respondido en el tick del click via amrBalanceGateFromMemory; sin frame
  optimista (OPEND-2614 ausente). 43/43 + 61/61.
- `c6f703806` — port 863b62b39 (#8225) adaptado: replay SSE durable. (Registrado
  bajo gaps-45 por el predecesor.)
- Skips: CMS x4 (ficheros ausentes), `30d184ac4` (#8007 receipt chain),
  `a4775ecea` (vela-cli ya en 0.1.3), `894d55466` (version bump),
  `1aa228115` (ya en `672cfec8d`), `425a33237`/`e285cca2b` (tests ausentes).

## gaps-47 (2026-09-21)

- `bda2aad77` — port 7413c6daa (#8278) adaptado: Home default Prototype +
  dropdown de tipos en composer (helper retry-safe; reachable-set del fork).
  39/39 + 66/66 + 41/41 web.
- `220f3baf9` — port 792480fe2 (#8170) adaptado: run events bounded
  (64 KiB/evento, truncado head/tail con AgentEventPayloadTruncation), raw
  lines bounded en parsers (claude/json/qoder/copilot), proyecciones
  completeness/sibling-done-key en SQLite sin cargar event logs en JS, heal
  de filas oversized legacy (una por tx, skip runs activos), prompt como
  stdin file-backed via spawnAgentProcess, reap de agentes huerfanos por
  identidad de proceso, mapeo done_key en persistencia. Excluido:
  artifactRefs, scrub DSML, intent resolution, app-server transport,
  withCodexTransport, conclusion autenticada od-done (cadena #7518 ausente).
  41/41 + 19/19 daemon nuevos, 4/4 platform, e2e leftover-agent-reap verde
  end-to-end (prompt completo file-backed + reap real), typechecks + guard.
- `22a9d2864` — port parcial b419463f9 (#8223/OPEND-3284): ring de card
  seleccionada eliminado (check badge es el estado). 3/3 CSS spec. Resto:
  OPEND-3283 (menu dock ausente), OPEND-3203 (QueuedSendStack borrada),
  Test modal (CMS).
- `e322f550c` — pick limpio 9180cfdb3 (#7428): banner read-only espera
  isSharedNonOwner probado; preview containment routes para proyectos
  unbound. 3/3 claim + 98/98 FileWorkspace + 16/16 daemon.
- `754314d9a` — fix del spec #8170: refs withCodexTransport (app-server
  ausente) eliminadas; el spec aserta el def plano. 5/5 + typecheck.
- `c4bee8c50` — pick limpio c5ae6292c (#7720): boundary read-only de
  skills declarado en system prompts. 13/13 + 3/3 matrix.
- `3c94a9077` — pick limpio 46700f6e8 (#7701): catalog del reference
  picker scoped al workspace del caller. 22/22.
- Skips: `2acb7f6f6` (vela 0.1.3 ya), `8fb94d28e`/`46be6eacc`/`8e372744d`
  (cadenas ausentes), `c764b21e5`/`6b60b567a`/`00fb31145`/`6788a8667`
  no-ops, `78f389a05` (i18n 19-locales, fork es-only), `819c10d49` (43
  conflictos, estructura divergente), `92f27d1fc` (57 ficheros sin triage).

## gaps-48 (2026-09-21)

- `fe1d48a7a` — port parcial f197844e2 (#7921): stampRunSpan estampa
  runStartedAt/runEndedAt en done_key (reloj por run físico en folds).
  Write-side solo; renderer build-turn-blocks ausente. 8/8 fold + typecheck.
- `5048b77a0` — port parcial 11943a400 (#7880): spec daemon que fija los
  orígenes públicos de consola vela por perfil (valores ya converged).
  Plans-deeplink intencionalmente ausente (CTAs a /pricing público). 6/6.
- `5182163a3` — port 956077251 (#7884) adaptado: stage-timeout del watchdog
  clasificado y propagado daemon→card como timeout retryable nombrado;
  forced-signal guard en signalInterruptClassification; isRetryable;
  compaction-continuation EOF resumable. Excluido: credential-fault check
  (cadena #7518). 62/62 daemon + 4/4 web card + typechecks.
- `6ec99f88c` — port 21bba485b (#7943) adaptado: ctaLabel localizable en
  WhatsNewContent/WhatsNewLocaleContent. Toolchain de publicación whats-new
  (borrada en el fork) no restaurada. 26/26 web + 16/16 daemon + contracts.
- `aefdbfa1c` — port 3c7b16b44 (#8229/OPEND-3207) adaptado: geometría del
  split extraída a project-split-layout.ts conservando handle 8px del fork,
  saved-width numérica y clamps existentes (sin modelo customized/equal-
  split upstream); PendingView y ProjectView resuelven el mismo primer
  ancho; primer write medido asienta bajo .split-settling sin transición.
  Specs: project-split-layout 8/8 + PendingView 3/3 + e2e ui_p0 enrollado.
- No-ops/skip verificados: `8921ccac2` (#8063 conv. 04e16e50e),
  `7fa06a408` (#7951 conv. 640974bf8), `d54f5cf07` (#7945 conv.),
  `a0d00198e` (#7905 ausente), `a3da5e06c` (#7954 conv. 43f2eadf2),
  `f95b9a6ee` (#7933 conv.), `fd8599458` (#7898 ausente),
  `677457dfb` (conv. b7f649f15), `5f7baf9c9` (#7900 sendFailed ausente),
  `d2e7c3b5f` (#7896 scroll-freeze ausente), `3ddff7120` (#7892 release
  machinery upstream), `c3ec5fda7` (#8258 ThinkingMarkdown ausente).
- Regresiones preexistentes detectadas (HEAD, no de este batch):
  EntryShell.amr-home-balance-memory 2/2 (de cd17a44a1/#8240 — revisar
  el port del memory verdict) y transcript-authority-refresh refused-read.

## gaps-49 (2026-09-21)

- Regresiones preexistentes de HEAD corregidas:
  - `1c33c2fee` — restaura `data-testid="chat-log"` en el contenedor de scroll
    del transcript (upstream lo marca; la divergencia del fork lo perdió).
    Arregla el refused-read de transcript-authority-refresh y desbloquea el
    selector `[data-testid="chat-log"] .msg.user` del e2e home-send-split-width.
    13/13.
  - `9b4d7d1c9` — el spec AMR memory-gate clicaba Send con la primera lectura
    del catálogo de plugins del scope team aún diferida a la activación del
    snapshot (fallback 250ms de useWorkspaceSnapshotActivation):
    defaultTypePending mantiene el botón deshabilitado y el click era no-op —
    2/2 rojo desde gaps-46. El test ahora espera a que el botón se habilite
    (la misma ventana breve que ve un usuario). 2/2.
- `fb85d134b` — OPEND-3203 de `b419463f9` (#8223): la barra de inserción del
  drag-reorder de la cola se dibujaba como pseudo-elemento a ±2px dentro de la
  fila, cuyo `overflow: hidden` la recortaba a su halo. Adaptación al fork (sin
  QueuedSendStack): barra real absolutamente posicionada sobre un slot sin clip
  alrededor de cada fila — misma geometría ±2px en el gap de 3px. OPEND-3283
  (menú ⋮ por fila) y CMS campaign-modal ausentes en el fork; OPEND-3284 ya
  converged en gaps-47. 35/35.
- `f64906c60` — `fc959c7a5` (#7893): card dedicada para `invalid_api_key` en
  runs BYOK/proveedor-API — título/cuerpo pulidos en 19 locales, acción
  primaria〔去设置〕→ Settings `execution` (mismo destino que el preflight
  BYOK), sin Retry (la misma key falla igual). Adaptación al fork: upstream usa
  la capa `failureCard`/`directFix` ausente aquí — se devuelve un `RunFailureUi`
  plano con la nueva acción `open-settings` en la cadena de acciones de
  ChatPane. La tabla protocol→agent-id se movió a `byokProvider.ts`
  (`byokApiKeyIsEditableInSettings`) para acotar la card a keys que guardamos
  sin importar el stack de providers; los CLI locales conservan S02. 18/18.
- Publicado: PR #63 squash-mergeado (`4fdc24033`, 09:01Z, 7 commits).

## gaps-50 (2026-09-21)

- `9f51467d2` — subset de `24f09b753` (#7897): la card AMR "switch to a
  different assistant" se renderizaba aunque ningún host hubiera cableado un
  receptor — CTA visible que no puede actuar. Gate de presencia de receptor
  antes de mostrarla (SideChatTab y DesignSystemFlow no cablean los handlers;
  ProjectView sí). El CTA `contactSupport` upstream no existe en el fork.
  4/4 red-capable.
- `fc06ec82f` — mitad opencode de `dc61db8e0` (#8117): plugin de fichero sin
  dependencias inyectado vía OPENCODE_CONFIG_CONTENT (preservando plugins del
  usuario y del overlay) emite frames `od_opencode_tool`; OpenCodeToolEvents
  en el parser JSON convierte cada tool en preview `tool_in_flight` al
  arrancar en vez de esperar a los argumentos — los `tool_use`/`tool_result`
  nativos siguen siendo autoridad y el flush cierra previews huérfanos.
  Gateado a OpenCode >=1.17.18; versión ausente expira del caché de detección
  (TTL 5s) en vez de deshabilitar la feature de por vida. Mitad codex
  omitida (codex-app-server ausente). 18/18 + vecinos verdes.
- `ca1d3cd82` — `39de577a5` (#7906): copy del design system flow traducido al
  francés; las 192 claves dsCreate/dsFlow existen en el fork — aplica limpio.
- `cce990941` — fix de defecto preexistente en main: `index.ts` de
  packages/platform exportaba `signalProcesses`/`stopProcesses` (reland
  #7636) sin que las implementaciones llegaran a `process.ts` — build roto
  en HEAD (TS2305) y con él toda cadena `pretest` dependiente. Port verbatim
  de ambas funciones (tipos ya convergían).
- `6e4b42806` — `c8f6db60c` (#7804): core prompt v2.1.2 retira el literal
  `open-design-runtime-state` de la regla "not a tool name" (salience -> el
  modelo lo llamaba como tool); la continuación production cierra con
  Closing Runtime State (sin el tail host-protocol, ausente); `od skill
  list/show --workspace/--workspace-member` + env OD_WORKSPACE_ID/
  OD_WORKSPACE_MEMBER_ID pinneadas al scope congelado del run (member vía
  PinnedRunWorkspaceScope); nueva skill od-next-media-inputs. 25/25
  contracts + 5/5 plugin-runtime + 222/222 daemon enfocados.
- DECISION registrada: `bb9682a5f` (#7876) invierte el default OD Next a
  opt-out — política de producto, no fix; escalada en FLEET_PROGRESS.json.
- Flakes verificados (preexistentes, no del batch): od-next-automatic-
  simple-server "exactly-once...daemon restart" timeout 60s idéntico en
  HEAD (verificado via stash); cascadas del mismo fichero pasan aisladas;
  detection-resilience timeout también es flake de carga (2/2 aislado).
- Skips: `5a3f0c892` (codex-app-server ausente), `8be9b0fca` (artifacts/
  deliverable-syntax ausente), `9f73dcebf`/`eca7c7ab9` (RunErrorCard
  ausente), `00c12c645` (chat-health ausente), `8fb94d28e` (CMS ausente).

## fleet/gaps-51 — triage: 7 candidatos upstream convergen (no-ops)

Revisión escéptica del trabajo previo: `fb85d134b` (queue drop bar) correcto —
JSX/CSS/typecheck verificados, no hay que revertir. Cherry-pick de
`ea58bd752` resuelto a convergencia total: HEAD ya contiene
`strategyTaskParkedOnSucceededRun` + guard de reattach vía `eeceb1b56`
(port combinado #8195+#8250 de un batch anterior). Markers resueltos,
25/25 tests continuation + 55/55 workspace-identity + typecheck verdes;
el único delta era cosmético (seam de spy en test) — revertido.

Convergencias verificadas en gaps-51:
- `d5eddcb59` — manifest-backed artifacts ya en run-artifact-fs del fork.
- `441ab84b0` — malformed <od-card> hiding ya en split-shell-cards + tests.
- `1bd134dc5` — fork-artifact ownership ya en fork (gaps-41); el test
  upstream `forkedInto` es feature ausente.
- `287357b12` — AMR workspace subscription reset ya presente.
- `1aa228115` — preview snapshot bridge ya presente.
- `0ffafb3d7` — runMappings ya en fork; `executionIntent` pertenece a
  #8172 (feature ausente, no importable).
- `ea58bd752` — parked-on-succeeded-run guard ya en fork (eeceb1b56).

### gaps-51 — puertos y fixes

- `da163fe5f` — fix(platform): `selectOwnedProcessTree` faltaba en el
  re-export de index.ts desde el squash gaps-47 (mismo defecto que
  cce990941); daemon typecheck roto en HEAD (TS2305).
- `6c7830976` — `4e460eae4` (#7982): coordinate shutdown + observe update
  handoff. Contrato update-lifecycle en contracts, scan de installer-apply
  en telemetría del daemon (10s), coordinación shutdown/desktop-ready,
  espera de handoff en packaged, simplificación UpdaterPopup. Tests:
  daemon 4/4, desktop 84/84, packaged 82/82, web 19/19; typechecks verdes.
- `21523f989` — `4c5873c7c` (#7863, parcial): turno fallido ya no se
  anuncia "Done" — `hideRunStatus` gana la excepción de turno fallido
  (adaptada; parte A upstream). Resto del batch requiere
  host-authored-message/ChatPanel-redesign (ausente). Red-capable: falla
  sin el fix, 4/4 con él.
- `cae98d77a` — `057aa62ce` (#7754): refresh docs core en francés; aplica
  limpio.
- Convergencias adicionales (14 no-ops): `6734dbba2`, `933dc9603`,
  `a10e4671b`, `7abe49c85`, `066f9cd93`, `d18ada9e3`, `be0887b39`,
  `e02d0adbd`, `93b09911d`, `cce680d29`, `c4da48a74` — el fork ya contiene
  cada cambio (batches anteriores o adelantado a upstream: vela 0.1.3,
  cobertura fr).
- Skips: `46be6eacc` (#8172 executionIntent), `7245f543a`+`b5c9723ac`
  (Home refresh + su propio revert), `ad09d3883` (ChatPanel rebuild),
  `81044a03c` (whats-new.json ausente), `92bf0b7ad` + 14 commits de
  release-pipeline/e2e-lane upstream.
