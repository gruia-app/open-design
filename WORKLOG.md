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
