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

## Bloqueados

- Ninguno todavía.
