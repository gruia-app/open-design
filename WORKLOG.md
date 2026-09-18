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
