# SAAS_GAPS — cola de mejoras del producto design (gruia-app/design)

Inventario de gaps accionables. `[x]` hecho, `[ ]` pendiente, `(!)` requiere decisión.

## tools/gruia-gateway (auth SaaS)

- [ ] G1 — `password_sessions` nunca se barre: las filas expiradas solo se borran si se
  lee el mismo id (imposible, ids aleatorios) → crecimiento ilimitado de SQLite.
  `login_csrf` sí barre en cada create. Aplicar el mismo patrón en `createSession`.
- [ ] G2 — páginas HTML de auth (`/auth`, `/auth/login`, logout, signed-in) sin
  `frame-ancestors`/`X-Frame-Options`. SameSite=Lax mitiga CSRF real, pero falta
  defensa en profundidad anti-clickjacking en el formulario de login.
- [ ] G3 — sin barrido periódico de sesiones: aun con sweep-on-write, una org sin
  logins acumula. Evaluar `setInterval` de limpieza (bajo, mismo fix que G1 lo hace
  opcional) — (!) decisión: ¿merece timer dedicado?
- [ ] G4 — rate limit de login solo en memoria y por email+global; sin bucket por IP.
  El límite global (60/min) acota el abuso distribuido. (!) decisión si multi-instancia.
- [ ] G5 — `GET /auth/session` expone `csrfToken` sin `Cache-Control` explícito en la
  ruta (noStore sí se aplica vía `json()`). Verificar cobertura real — probablemente OK.
- [ ] G6 — sin métricas/observabilidad propia (solo /healthz). (!) decisión de diseño.
- [ ] G7 — sin auditoría de logins (quién, cuándo, desde dónde). (!) decisión: tabla
  `auth_audit` + retención.
- [ ] G8 — `verifyCsrf`/`readSession` devuelven bool/null sin distinguir "expirada" de
  "inexistente" — logging forense limitado. Bajo.

## Daemon / web (línea de producto privada)

- [ ] D1 — revisar si los fixes upstream de la sesión (i18n, envelope MCP, hardening)
  están cherry-picked a `main` privado; mantener paridad selectiva.
- [ ] D2 — `gitignore` privado: confirmar que cubre artefactos de flota
  (`.playwright-cli/`, screenshots) — ya cubierto parcialmente.

## Coordinación

- [x] Crear FLEET_PROGRESS.json + WORKLOG.md + SAAS_GAPS.md.
