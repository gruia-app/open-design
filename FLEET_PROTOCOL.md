# FLEET_PROTOCOL — convencion obligatoria para workers de flota

## 1. Progreso machine-readable (obligatorio)

Ademas de WORKLOG.md, manten `FLEET_PROGRESS.json` en la raiz de tu worktree/checkout.
Actualizalo tras CADA commit o cambio de estado. Es lo que lee el coordinador — si no esta, tu trabajo no existe.

```json
{
  "app": "<app>",
  "updated_at": "<ISO>",
  "current": {"item": "<que estas haciendo>", "state": "in_progress|blocked|done"},
  "done": [{"item": "...", "commit": "<sha>", "deploy": "pending|n/a"}],
  "blocked": [{"item": "...", "reason": "...", "needs": "human|review|secret|decision"}],
  "deploys_pending": ["<sha o descripcion>"],
  "notes": "<1 linea>"
}
```

## 2. No esperes deploys

Jenkins/deploy es asincrono y NO es tu trabajo. Cuando un item este commiteado y testeado:
- marca `"deploy": "pending"` en FLEET_PROGRESS.json y añadelo a `deploys_pending`
- sigue con el siguiente item INMEDIATAMENTE
- el coordinador/ops recoge los pendientes; no bloquees tu bucle verificando pipelines

## 3. Reanudacion tras muerte (revision con otro angulo)

Si tu sesion anterior murio (lo sabras porque WORKLOG/FLEET_PROGRESS cortan a mitad de item):
- PRIMERO revisa con escepticismo los ultimos commits del predecesor: `git log` + diff del ultimo item
  marcado in_progress — verifica que el fix es real (corre los tests, lee el diff con ojo critico)
- si el trabajo anterior es malo/incompleto: corrigelo o reviertelo y documenta en FLEET_PROGRESS `notes`
- LUEGO continua el bucle normal

## 4. Limites

- Sin merges, sin deploys, sin push a main, sin PRs draft (PR ready-for-review solo si el repo lo pide).
- Commits pequenos y frecuentes — cada item cerrado es un commit; asi un relevo no pierde nada.
- Si te bloqueas >2 intentos en el mismo item: muevelo a `blocked` con razon y `needs`, y pasa al siguiente.

## 5. Flujo de publicacion (operativo, aprendido en flota)

- Trabaja siempre en rama `fleet/<tema>`; nunca commits directos a `main` (main no esta protegido — la convencion PR es la unica barrera).
- Al acumular >=5 commits (o un batch real aunque sea menor): push + `gh pr create` ready + merge squash; anota PR en `prs_open` y el commit de merge en `deploys_pending`; sigue sin esperar CI.
- `gh` necesita namespace explicito — hay 3 remotes (origin=fork privado, fork=publico, upstream=nexu-io) y resuelve mal: usa `--repo gruia-app/design --head gruia-app:<rama>` en `gh pr create`/`gh pr merge`.
- El repo tiene auto-merge DESHABILITADO: `gh pr merge --auto --squash` falla; el fallback establecido es `gh pr merge <n> --squash` directo (merge inmediato).
- Tras squash-merge, la rama remota se auto-borra pero la local queda "unmerged" para git — su contenido ya esta en main; el reflog conserva el tip.
- Commits de solo coordinacion (sync de FLEET_PROGRESS) tambien van por PR propio, igual que el resto.
- `deploys_pending` solo crece: verificable desde fuera con `curl -sI https://design.gruia.app` (p.ej. header `strict-transport-security` presente = Caddyfile actual desplegado).
- `git fetch upstream` completo cuelga en negociacion de pack — usa `git fetch upstream --filter=blob:none` (funciona; el repo sigue publico y activo).
- `deploy: "pending"` = toca prod via Jenkins; `"n/a"` = coordinacion/tests/docs sin despliegue.