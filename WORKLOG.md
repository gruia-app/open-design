# WORKLOG — sesión autónoma nocturna (2026-09-18)

Rama: `t3code/7dd1c0ea` · Worktree: `/home/roberto/.t3/worktrees/design/t3code-7dd1c0ea`

Objetivo: mejora continua de bajo-medio riesgo. Cada ítem: qué se hizo, cómo se
verificó, qué quedó pendiente.

## Auditoría inicial

- `pnpm audit` baseline: **102 vulnerabilidades** (2 críticas, 53 altas, 40
  moderadas, 7 bajas). Las 2 críticas eran RCEs en `next@16.2.6` (<16.3.3).
- Auditoría delegada por áreas (6/6 nodos, run `wf_e68179cda4d54b4d`; el primer
  run `wf_5789c56d8d5743b8` falló por un error transitorio del wrapper de Pi y se
  recuperó con `--resume`). Hallazgos confirmados por inspección directa en
  `packages/sidecar`, `packages/sidecar-proto`, `apps/daemon`, `apps/web`,
  `tools/pack`, `tools/serve`.

## Ítem 1 — Parches de seguridad de dependencias

**Hecho:** bump directo de `next` 16.2.6→16.3.5, `dompurify` 3.4.2→3.4.15,
`postcss` 8.5.15→8.5.28 (web+daemon), `multer` 2.2.0→2.4.0, `electron-builder`
26.8.1→26.15.3, `sharp` 0.35.3→0.35.4; pnpm overrides para transitivas
vulnerables (`@hono/node-server`, `@xmldom/xmldom`, `body-parser`, `fflate`,
`fast-uri`, `form-data`, `hono`, `js-yaml`, `lodash-es`, `mermaid`, `nanoid`,
`protobufjs`, `qs`, `sharp`). `next-env.d.ts` regenerado por Next 16.3.5.

**Verificación:** `pnpm install` OK; `pnpm audit` 102→6 (0 críticas),
`pnpm audit --prod` 0; `pnpm typecheck` verde; `pnpm guard` verde; build de web
con Next 16.3.5 verde.

**Pendiente:** 6 hallazgos restantes sin fix upstream — `image-size` (vía
`pptxgenjs`, sin versión parcheada), `adm-zip` (sin versión parcheada),
`@opentelemetry/core` <2.8.0 y `baseline-browser-mapping` <2.11.0 (transitivas,
riesgo moderado). Revisar cuando haya releases parcheadas.

## Ítem 2 — Hardening de JSON IPC y contrato sidecar desktop

**Hecho:**

- `packages/sidecar/src/json-ipc.ts`: `JSON.parse` de la respuesta envuelto en
  try/catch — antes un frame malformado lanzaba uncaughtException dentro del
  listener `data` y mataba al proceso llamador. Nuevo cap de frame de 64 MiB en
  servidor y cliente (antes el buffer crecía sin límite si el peer nunca enviaba
  `\n`). Scan del delimitador incremental por chunk (el `indexOf` sobre el buffer
  completo era O(n²) en frames grandes).
- `packages/sidecar/src/client.ts`: `normalizeSupervisorHandoffRequest`
  valida `command`/`args`/`cwd`/`env` antes de que el supervisor respawnee el
  hijo verbatim — un `args` no iterable o `cwd` no-string habría lanzado dentro
  del listener `exit` matando al supervisor durable.
- `packages/sidecar/src/supervisor.ts`: usa el normalizador en
  `acceptChildMessage`; request malformado → ignorado.
- `packages/sidecar-proto/src/index.ts`: `render-slides` y `export-artifact`
  ahora limitan width/height a 8192px (mismo bound que `render-frames`);
  `screenshot.path` exige path absoluto (POSIX/Windows-drive/UNC) como ya hacía
  `outputDir`.
- `tools/dev`, `tools/pack` (linux/mac/win): `resolve(options.path)` en los
  call-sites de screenshot para que paths relativos de CLI sigan funcionando con
  el contrato estricto.

**Verificación:** `pnpm --filter @open-design/sidecar test` — 54/55 (los tests
nuevos: frame malformado, cap de 64 MiB, validación de handoff);
`pnpm --filter @open-design/sidecar-proto test` — 31/31; typecheck verde en
sidecar, sidecar-proto, tools-dev, tools-pack.

**Pendiente / observado:** `converges a tools-pack runtime launch on an
existing packaged-source owner` es flaky bajo carga (falló con `attempts` 2 vs
1 corriendo en paralelo con el test de 64 MiB; pasa aislado y en la re-ejecución
del suite solo quedó ese fallo de timing). No relacionado con el cambio;
candidato a investigación de flake.

## Ítem 3 — XSS reflejado en callback OAuth de MCP (`0844e37`)

**Hecho:** `/api/mcp/oauth/callback?error=…` reflejaba el valor dentro de
`var payload = ${JSON.stringify(payload)}` en un `<script>` inline — un
`</script>` en el valor cerraba el bloque e inyectaba markup. Se escapan
`<>&` y U+2028/29 como `\uXXXX` en `src/http/oauth-result-page.ts`. Bonus:
`mcp-routes.ts` tenía una copia local duplicada del renderer (la que realmente
servía la ruta); se reemplazó por el helper compartido y se eliminó el import
muerto en `server.ts`.

**Verificación:** nuevo `tests/http/oauth-result-page.test.ts` (payload hostil
`</script><script>…` no rompe el bloque, deserializa idéntico, body HTML
escapado; `serverId` con quotes/markup escapado) — 2/2 verdes;
`pnpm --filter @open-design/daemon typecheck` verde.

## Ítem 4 — Lista de proyectos web: fallo de transporte ≠ lista vacía

**Hecho:** `listCurrentWorkspaceProjects` sin `throwOnError` devolvía `[]` ante
un fallo de transporte/5xx. Cuatro call-sites en `apps/web/src/App.tsx`
reconciliaban ese `[]` como si fuese una lista autoritativa: bootstrap inicial
(sobreescribía el snapshot restaurado), `refreshProjects` manual (podía vaciar
la UI y hacer que un proyecto abierto se tratase como borrado con alert
"missing project"), refresh tras crear proyecto (perdía el stub optimista) y el
fallback al abrir proyecto. Ahora los cuatro piden `throwOnError: true` y
atrapan el fallo preservando el estado last-good. Una lista vacía *exitosa*
sigue siendo autoritativa (el test de borrado real lo cubre).

**Verificación:** nuevo test `keeps the open project mounted when a manual
refresh transport-fails` en
`apps/web/tests/components/App.workspace-switch-project-list.test.tsx` (fetch
500 tras bootstrap → `project-view` sigue montado, sin alert);
`pnpm --filter @open-design/web exec vitest run
tests/components/App.workspace-switch-project-list.test.tsx` — 11/11;
`pnpm --filter @open-design/web typecheck` verde.

**Nota:** primera versión del test asertaba `unmounts` nunca llamado — demasiado
estricto (un remount incidental lo rompía); reescrito con la implementación real
de `listProjects` + HTTP 500, asertando solo el comportamiento visible.

## Ítem 5 — Hardening del runtime de agentes (cwd, credenciales, probes ACP)

**Hecho** (hallazgos leaf-1 de la auditoría delegada):

- `apps/daemon/src/server.ts` (~10647): si `ensureProject` falla con un error
  no-sandbox, el run de proyecto se demovía silenciosamente a
  `cwd=null → PROJECT_ROOT` (el install dir del daemon, escribible en dev) y
  el baseline de artefactos se saltaba. Ahora `failRun('PROJECT_DIR_UNAVAILABLE')`.
  Los runs sin proyecto (`projectId` falsy) conservan el fallback intencional.
- `server.ts` (~12415): `.mcp.json` con bearer tokens OAuth y env secrets de
  MCP se escribía con mode por defecto (0644) en el cwd del proyecto. Ahora
  `mode: 0o600` + `chmod` para endurecer ficheros escritos por versiones
  anteriores. Mismo bound que `runtimes/prompt-file.ts`/`runs.ts`.
- `apps/daemon/src/agent-protocol/acp/models.ts`: `detectAcpModels` usaba
  `process.cwd()` del daemon como cwd default del probe — un CLI bun-based
  podía hacer `bun install` sobre el workspace (caso documentado en
  `runtimes/invocation.ts`) y `session/new` filtraba el path de instalación a
  CLIs de terceros. Default ahora `os.tmpdir()`, igual que `execAgentFile`.
- `models.ts`: teardown de probes era SIGTERM-only; un CLI que lo trapee
  quedaba huérfano de por vida del daemon. Nueva escalación SIGKILL a los 2s
  (unref'd), espejando `killSignal: 'SIGKILL'` de `execAgentFile`.

**Verificación:** nuevo `tests/acp-detect-probe.test.ts` — probe real registra
su cwd (== `os.tmpdir()`, ≠ `process.cwd()`) y probe que trapa SIGTERM muere
por SIGKILL tras timeout (2/2 verdes); regresión: `acp-timeout-env`,
`acp-handshake-failure`, `amr-acp-integration`, `runtimes/trae-cli` — 119/119;
`pnpm --filter @open-design/daemon typecheck` verde.

**Pendiente:** `.mcp.json` sigue persistiendo en el proyecto durante el run
(lo lee el CLI hijo); unlink post-run queda como follow-up si se quiere
residual cero. El path de `server.ts` (failRun/writeFile) no tiene test seam
barato — verificado por typecheck + revisión, sin suite nueva.

## Ítem 6 — Error boundary a nivel de app

**Hecho** (leaf-2 #1): el único `ErrorBoundary` del SPA estaba limitado a la
card de design-kit (`KitErrorBoundary`); cualquier throw de render fuera de ese
subárbol (FileViewer ~20k líneas parseando HTML de artefactos, mensajes del
deck bridge, edges de i18n) dejaba la app en pantalla blanca con solo
telemetría — el propio `white-screen.ts` documenta que un crash post-mount es
"solo una historia `$exception`". Cambios:

- Nueva `src/components/ErrorBoundary.tsx`: clase genérica compartida (la que
  vivía privada en `KitErrorBoundary`), con `context` para el label de
  analytics.
- `KitErrorBoundary` refactorizado sobre la clase compartida — API pública y
  fallback idénticos.
- Nueva `src/components/AppErrorBoundary.tsx` (+ `.module.css`): fallback a
  viewport completo con `role=alert` y botón que recarga la página (retry
  in-place re-montaría el mismo estado que crasheó). Reusa las claves ya
  traducidas `ds.kitErrorTitle`/`ds.kitErrorRetry` — texto genérico, evita
  tocar los 19 ficheros de locale.
- `app/[[...slug]]/client-app.tsx`: `<ClientApp>` envuelve `<App />` con el
  nuevo boundary.

**Verificación:** nuevo `tests/components/AppErrorBoundary.test.tsx` — fallback
traducido + `onRetry` invocado, children sanos renderizan, fallback de kit
contenido (siblings intactos), retry del boundary genérico re-monta tras
limpiar el fallo — 4/4 verdes; `pnpm --filter @open-design/web typecheck` y
`pnpm guard` verdes.

## Ítem 7 — Tests del boundary de shell-quoting + fix `PATH=''`

**Hecho** (leaf-1 #5/#6): `apps/daemon/src/services/login-shell.ts` es la
única superficie del daemon donde argv se re-encadena en un string de shell
(`sh -c "export PATH=…; gh 'auth' 'status'"`) — `quotePosixShellArg` era el
boundary de inyección sin cobertura, y `plugin-share-tasks.ts` enruta publish
de usuario por ahí. Además `buildLoginShellCommand` emitía `export PATH=''`
cuando el daemon arrancaba sin `PATH` (GUI launch), clobber del default del
shell hijo — justo el escenario que el helper existe para arreglar.

- `buildLoginShellCommand`: omite el `export PATH=…` cuando `process.env.PATH`
  es falsy; el shell hijo aplica su propio default.
- Nuevo `apps/daemon/tests/login-shell.test.ts`: 11 argv hostiles (comillas,
  `$(…)`, backticks, newline, `$HOME`, `*`, `;`, vacío) deben sobrevivir
  verbatim a través de un `sh -c` real; tests de PATH (default no clobbered +
  re-export cuando existe). Skip en win32 (path POSIX-only).

**Verificación:** `pnpm exec vitest run tests/login-shell.test.ts` — 14/14
verdes; `pnpm --filter @open-design/daemon typecheck` verde.

## Ítem 8 — Rutas daemon: auth de brands, envelope de import, .env gitignore

**Hecho** (leaf-0 #2/#5, leaf-5 #1):

- `apps/daemon/src/brand-routes.ts`: `DELETE /api/brands/:id`,
  `continue-extraction`, `cancel-extraction` y `extract-from-html` mutaban
  sin autorización cuando el brand no tenía `designSystemId` (el estado
  normal pre-finalize) — el gate de design-system solo corría post-finalize.
  Las cuatro rutas ahora llaman `authorizeProjectRequest(mode:'write')`
  (`capability: 'delete'`/`'writeFiles'`) antes de cualquier mutación cuando
  el brand tiene `projectId`; no-bound → pass-through (mismo contrato que el
  resto del data plane: `!persisted.workspaceId → true` en local).
- `apps/daemon/src/import-export-routes.ts`: `/api/import/claude-design`
  devolvía `{error: String(err)}` — envelope divergente con paths internos.
  Ahora `sendApiError(res, 400, 'BAD_REQUEST', …)` como el resto del fichero.
- `.gitignore`: `tools-dev` carga `.env`/`.env.development` desde la raíz pero
  solo `.env.local`/`.env.*.local` estaban ignorados — credenciales BYOK en
  `.env` quedaban trackeables. Añadidos `.env` + `.env.*` con `!.env.example`.

**Verificación:** `tests/brand-routes.test.ts` +4 tests (deny en delete /
cancel / extract-from-html con 403 y sin mutación; delete unbound no invoca el
gate) — 33/33; `git check-ignore` confirma `.env`, `.env.development`,
`apps/web/.env` ignorados y `deploy/.env.example`/`.env.example` trackeados;
typecheck daemon verde.

**Revisado sin fix:** leaf-0 #4 (`/api/mcp/install-info`) — el middleware `/api`
ya exige bearer token a peers no-loopback cuando `OD_API_TOKEN` está activo, y
bind no-loopback exige token (server.ts:2904); el hueco solo existe con
`OD_DISABLE_API_AUTH=1` explícito. leaf-0 #3 (rate limiting) queda como
follow-up — requiere decisión de diseño (token bucket vs cap de concurrencia).

## Ítem 9 — Escapado de `$` literal en strings NSIS

**Hecho:**

- `tools/pack/src/win/nsis.ts`: `escapeNsisString` intentaba escapar `$` con
  `value.replace(/\$/g, "$$")` — en JS, `$$` en el string de reemplazo inserta
  un solo `$` literal, así que era un **no-op silencioso**. Corregido a
  `"$$$$"` (emite la secuencia `$$` que NSIS lee como dólar escapado). Un path
  con un segmento como `$TEMP` hubiera sido expandido por NSIS, haciendo que
  `RMDir /r` del desinstalador apuntara al directorio equivocado.
- `escapeNsisPathValue` preserva el prefijo deliberado `$APPDATA` de los
  builds portable (debe seguir expandiéndose) y escapa el resto del valor.
- `tools/pack/src/win/custom-installer.ts`: mismo bug del no-op — corregido.
- `tests/win-nsis.test.ts`: +tests de `$TEMP`→`$$TEMP`, preservación de
  `$APPDATA` en portable, y comportamiento existente de quotes/newlines.

**Verificación:** `tests/win-nsis.test.ts` 4/4, `tests/win-custom-installer.test.ts`
2/2, typecheck tools-pack verde.

## Ítem 10 — Dead code: duplicado drifted de `normalizeIpcPath`

**Hecho:** `packages/sidecar/src/ipc-path.ts` contenía una segunda copia de
`normalizeIpcPath` (la autoritativa vive en `sidecar-proto`) sin ningún
consumidor — el único import real del fichero era `isWindowsNamedPipePath`
en `json-ipc.ts`. Eliminada la copia muerta junto a su import `isAbsolute`;
el comentario del módulo ahora apunta a `sidecar-proto` como fuente única
para evitar que vuelva a driftear una segunda respuesta para el mismo campo
de wire.

**Verificación:** typecheck `@open-design/sidecar` verde;
`tests/index.test.ts` 14/14; grep confirma cero referencias restantes a la
copia eliminada.

## Ítem 11 — tools-serve: URL del fixture respeta `--host` y `--port 0` es dinámico de verdad

**Hecho:**

- Los tres fixtures (`updater`, `release-storage`, `collab-cloud`) construían
  su origin impreso como `http://127.0.0.1:<port>` ignorando `--host` — al
  bindear `0.0.0.0` o una IP concreta la URL publicada no reflejaba el bind
  real. Nuevo helper compartido `src/server-origin.ts`: deriva el host de
  `server.address()`, normaliza wildcards (`0.0.0.0`→`127.0.0.1`,
  `::`→`::1`) para que la URL siga siendo conectable localmente, y pone
  brackets a literales IPv6.
- `index.ts`: el flag `--port` tenía default `"0"`, así que collab-cloud no
  podía distinguir "omitido" (→ 18096 well-known) de `--port 0` explícito
  (→ dinámico según el propio help). Quitado el default del flag: omitido →
  `DEFAULT_COLLAB_CLOUD_PORT` en collab-cloud y 0 en los demás (sin cambio);
  `--port 0` explícito → puerto dinámico en los tres servicios.

**Verificación:** +1 test (bind `0.0.0.0` → origin loopback conectable);
`updater-fixture` 12/12, `release-storage-fixture` 2/2,
`collab-cloud-fixture` 10/10; typecheck tools-serve verde.

## Ítem 12 — Estado vacío del filtro de conversaciones traducido

**Hecho:** `ChatPane.tsx` renderizaba el literal inglés "No conversations
match." cuando la búsqueda del historial no devolvía resultados — visible en
los 18 locales no-EN. Nueva clave `chat.noMatchingConversations` en `Dict`
(types.ts) + traducción en las 19 locales, insertada junto a la vecina
`chat.emptyConversations`.

**Verificación:** typecheck `@open-design/web` verde (Dict estricto confirma
las 19 locales); `pnpm guard` verde.

## Ítem 13 — Validación estricta de generation records standalone

**Hecho:** `readGeneration` en `packages/standalone` solo comprobaba
`schemaVersion`/`id`/`channel` antes de entregar el record a
materialización, activación y sweeping — un record tampered en disco
(p.ej. `resources[x].path` apuntando fuera del store root) pasaba sin
oposición, a diferencia de `readState` que usa el validador estricto
`validateGenerationState`. Nuevo `validateGenerationRecord` exportado en
`store.ts`: conjunto exacto de claves, shapes de digest/versión/commit,
paths absolutos obligatoriamente bajo el store root, entrypoints de
materialización relativos seguros, exactamente un `standalone.launcher` y
consistencia launcher↔resource. Aplicado en `readGeneration` y en el
lector duplicado de `garbage.ts` (que además ganó la misma cobertura).

**Verificación:** +1 test (`fails closed on a tampered on-disk generation
record`: path fuera del root → reject; drift launcher↔resource → reject;
record intacto → lectura OK). `standalone.test.ts` 15/15, suite completo
del paquete 34/34, typecheck verde.

## Ítem 14 — Escape de `'` en los escapers NSIS

**Hecho:** `escapeNsisString` (ambas copias en `nsis.ts` y
`custom-installer.ts`) no escapaba `'`. El comando
`nsExec::ExecToLog '...'` en `custom-installer.ts` es un literal
single-quoted que interpola paths derivados de `--dir`/toolPackRoot — un
apóstrofo en el build root (`C:\Tools\D'Arcy`) terminaba el literal a
media línea → makensis fallaba o el argv de PowerShell quedaba mangled.
Añadido `'`→`$\'` (escape NSIS nativo) tras el escape de `$`. Los callers
de `createNsisQuotedCommandLiteral` ya pasan por el escaper, así que el
fix cubre todo el call graph.

**Verificación:** +1 test en `win-custom-installer.test.ts` (build root
con `'` → el literal contiene `d$\'arcy`, no `d'arcy`). Tests win:
19 passed / 1 skipped (skip preexistente); typecheck tools-pack verde.

## Ítem 15 — Validación de shape de `RELEASE_VERSION` en tools-release

**Hecho:** cinco scripts de `tools/release/src/storage` interpolaban
`required("RELEASE_VERSION")` directamente en object keys de R2 y path
joins (`<channel>/versions/${releaseVersion}${suffix}/...`) sin chequear
la forma `x.y.z`/`x.y.z-<channel>.N` — un valor typo'd o hostil producía
claves absurdas o publicaba bajo prefijos arbitrarios. Añadida la guarda
`parseReleaseVersion(releaseVersion, releaseChannel)` (ya exportada por
`@open-design/release`, mismo contrato que `publish-metadata` aplicaba
parcialmente vía CAS) en `publish-platform`, `publish-metadata`,
`verify-metadata`, `download-platform-manifest` y `prepare-github-assets`.

**Verificación:** typecheck tools-release verde; suite tools-release
82/82.

## Ítem 16 — Dedup del shell-quoting drifted en `cli.ts`

**Hecho:** `cli.ts` mantenía copias untyped de `execFileBuffered`,
`quotePosixShellArg`, `buildGhShellCommand`, `buildLoginShellCommand` y
`execGhBuffered` — incluida la variante con el bug `export PATH=''`
corregido en `login-shell.ts` (ítem 7). Eliminadas las cinco copias; la
ruta gh del CLI ahora consume las funciones compartidas de
`services/login-shell.ts`, y `spawnGhPassthrough` se reescribió sobre
`buildCommandShellCommand('gh', …)` + `buildLoginShellCommand`
(exportados). El boundary de quoting queda single-sourced y testeado.

**Verificación:** typecheck daemon verde; `tests/login-shell.test.ts`
sigue cubriendo el boundary compartido (14/14 previo).

## Bloqueados

- Ninguno todavía.
