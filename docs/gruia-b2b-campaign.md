# Colección de 50 prototipos B2B

La colección se genera dentro de Design mediante su API de proyectos, mensajes y
runs. Los briefs iniciales se repartieron entre Fable 5.1 (25 impares) y Opus 5 (25 pares). El manifiesto operativo conserva el modelo previsto cuando un límite obliga a continuar con el otro modelo autorizado. Los briefs
originales y sus referencias están en
[`manifest.json`](../deploy/gruia/campaign/manifest.json). Cada proyecto entrega
`index.html`, `DESIGN.md` y `README.md`, y aparece con el nombre
`B2B NN · Marca · Sector` en los proyectos de Design.

El controlador mantiene hasta ocho trabajos simultáneos. Tras alcanzar el límite específico de Fable, sus pendientes continúan con Opus 5 mediante el fallback explícito `GRUIA_B2B50_FABLE_FALLBACK=claude-opus-5`; los ejemplos aprobados no cambian.
Conserva los identificadores antes de crear proyectos y ejecuciones, recupera
respuestas perdidas, renueva la sesión Gruia y comprueba el estado autoritativo
al finalizar el stream. Si la cuota se agota, pausa los nuevos encargos durante
30 minutos sin consumir intentos de corrección. Un fallo de transporte conserva
la ejecución para revisarla después. Un resultado incompleto o con defectos de
QA recibe hasta tres intentos; los fallos persistentes requieren revisión.

## Ejecución actual

El directorio privado de operación es
`/home/roberto/.local/state/gruia-design-b2b50`, modo 0700. Contiene:

- `manifest.json`: los 50 encargos.
- `state.json` e `index.json`: progreso e identificadores recuperables.
- `credentials.json` y `browser-session.json`: credenciales y sesión, modo 0600.
- `gate.json`: habilitación explícita de la cola.
- `outputs/NN/`: copias de los archivos, capturas y resultados de QA.
- `reviews.jsonl`: revisiones durables, sin turnos LLM para estados sin cambios.

Las credenciales no se incluyen en el repositorio. No sustituir ni vaciar
`state.json` para reanudar: provocaría pérdida de los identificadores existentes.
Los proyectos piloto y los encargos manuales se adoptaron antes de activar la
cola; no se vuelven a crear.

El servicio de usuario `gruia-design-b2b50.service` ejecuta Node 24 y el runner.
El temporizador `gruia-design-b2b50-review.timer` revisa el estado a las horas y
medias horas y vuelve a iniciar el controlador si quedan encargos y está
inactivo. La persistencia del temporizador permite recuperar revisiones tras
reiniciar el equipo. Estos procesos son trabajos CLI, no servidores.

Variables de ejecución:

```text
GRUIA_B2B50_STATE=/home/roberto/.local/state/gruia-design-b2b50
GRUIA_B2B50_CONCURRENCY=10
GRUIA_B2B50_FABLE_CONCURRENCY=5
GRUIA_B2B50_OPUS_CONCURRENCY=10
GRUIA_B2B50_FABLE_FALLBACK=claude-opus-5
GRUIA_B2B50_BROWSER_QA=1
```

Para una instalación nueva, copiar `runner.ts`, `browser-qa.ts` y `manifest.json`
desde `deploy/gruia/campaign` al directorio privado, proporcionar la sesión y
credenciales fuera de Git y configurar `GRUIA_DESIGN_REPO` con el checkout que
contiene Playwright en `e2e/node_modules`. `GRUIA_CHROMIUM_EXECUTABLE` permite
seleccionar un Chromium instalado. Crear el gate solo después de comprobar el
acceso y la generación con ambos modelos.

## Verificación y límites

```bash
node --experimental-strip-types --test deploy/gruia/campaign/tests/runner.test.ts
node --experimental-strip-types deploy/gruia/campaign/runner.ts --review
systemctl --user list-timers gruia-design-b2b50-review.timer
```

La QA abre el HTML servido por Design en escritorio y móvil; comprueba errores
JavaScript, contenido, controles, enlaces internos y desbordamiento horizontal,
y guarda capturas. Los defectos se incluyen en el siguiente encargo de
corrección. Un error HTTP o del navegador no provoca que el modelo rehaga un
prototipo terminado. Esta comprobación automática no equivale a una revisión
visual y funcional exhaustiva de las 50 webs. Los dos primeros prototipos
reciben además pruebas específicas de calculadora, diagnóstico y formularios.

Las entregas son demostraciones con marcas ficticias. La identidad aprobada y
el HTML de referencia se exportan desde Design para su implementación real en
B2BWeb; esta campaña no publica webs de clientes ni activa estilos en B2BWeb.

## Compartir con Vercel

La integración nativa está conectada al equipo
`simplificando-robertos-projects`. Abrir `index.html`, pulsar **Compartir** y
**Desplegar en Vercel** utiliza la configuración privada del daemon. El primer
ejemplo publicado es Senda Legal, en el proyecto Vercel
`od-d5a31a95-4336-4038-a14d-cb59f07370ac`. Su protección SSO está desactivada
expresamente para permitir compartir este prototipo ficticio.

Los proyectos Vercel nuevos pueden heredar protección de despliegues del
equipo. Comprobar siempre el enlace sin sesión antes de compartirlo; el estado
READY del proveedor por sí solo no basta. La integración actual publica
previews, no despliegues production.

El acceso usa la sesión existente de Vercel CLI. Como su token caduca,
`gruia-design-vercel-sync.timer` ejecuta `vercel-sync.ts` cada media hora: la CLI
renueva su sesión y el proceso actualiza únicamente el token del equipo ya
conectado. El refresh token permanece local. Si se cambia o desconecta el
equipo en Design, el sincronizador se detiene sin sobrescribir esa decisión.
El temporizador funciona aunque la campaña de generación haya terminado.

## Publicación de los aprobados

`gruia-design-b2b50-publisher.path` observa cambios del estado y ejecuta una
pasada de `publisher.ts`. El temporizador del mismo nombre reintenta la
verificación cada media hora. Publica únicamente trabajos aprobados cuya
huella SHA-256 coincide con la copia revisada y el HTML actual de Design.

`publications.json` conserva los IDs nativos y de Vercel antes de comprobar el
enlace. Una respuesta perdida se recupera desde el historial; un resultado
desconocido no genera otro despliegue automáticamente. Los despliegues conocidos
se reutilizan. Las publicaciones no cambian `state.json` ni los prototipos.

El publicador comprueba que cada proyecto Vercel se llama exactamente
`od-{UUID del proyecto Design}` antes de retirar su protección SSO. La
verificación pública usa una petición HTTP sin credenciales desde el servidor
configurado por `GRUIA_PUBLIC_VERIFY_HOST`, para distinguir la página real de
una comprobación antibot del navegador automatizado local. El estado
`published` exige contenido del ejemplo y acceso HTTP 200.
