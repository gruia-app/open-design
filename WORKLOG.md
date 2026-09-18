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

## Bloqueados

- Ninguno todavía.
