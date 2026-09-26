export type OrganizationTarget = Readonly<{
  audience?: "internal" | "client";
  upstream: string;
  daemonApiToken: string;
}>;

export type GatewayConfig = Readonly<{
  bindHost: string;
  port: number;
  publicOrigin: string;
  cookieName: string;
  databasePath: string;
  sessionSecret: string;
  postgresUrl: string;
  organizations: ReadonlyMap<string, OrganizationTarget>;
  sessionTtlSeconds: number;
  requestBodyLimitBytes: number;
  upstreamTimeoutMs: number;
  clientAccessOpen: boolean;
  testMode: boolean;
  // Bearer token guarding GET /metrics. Absent disables the endpoint entirely —
  // the gateway sits behind a public proxy, so an unguarded scrape surface
  // would publish auth-failure volumes and session counts to anyone.
  metricsToken?: string;
}>;

export type GatewayIdentity = Readonly<{
  userId: string;
  organizationId: string;
  role: string;
}>;

export type GatewayLoginUser = Readonly<{
  userId: string;
  hashedPassword: string;
  identities: readonly GatewayIdentity[];
}>;

export type StoredSession = Readonly<{
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  csrfToken: string;
  expiresAt: number;
}>;

export type AuthAuditEvent = "login_success" | "login_failure" | "logout" | "logout_failure" | "session_revoked" | "session_expired";

export type AuthAuditContext = Readonly<{ ip?: string; userAgent?: string }>;

export type AuthAuditRecord = Readonly<{
  event: AuthAuditEvent;
  at: number;
  // Callers pass email/userId; the store pseudonymizes them into
  // emailHash/userHash at rest and on read — audit rows never expose the
  // cleartext values again.
  email?: string;
  userId?: string;
  emailHash?: string;
  userHash?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  detail?: string;
}>;

export type AuthEventCount = Readonly<{ event: string; detail: string; count: number }>;

export type GatewayStoreMetrics = Readonly<{
  authEvents: readonly AuthEventCount[];
  activeSessions: number;
}>;

export interface SessionStore {
  createLoginCsrf(token: string, expiresAt: number): void;
  consumeLoginCsrf(cookieToken: string, formToken: string, now: number): boolean;
  createSession(session: StoredSession): void;
  readSession(id: string, now: number, context?: AuthAuditContext): StoredSession | null;
  verifyCsrf(id: string, csrf: string, now: number, context?: AuthAuditContext): boolean;
  deleteSession(id: string): void;
  recordAuthEvent(record: AuthAuditRecord): void;
  readAuthAudit(limit: number): AuthAuditRecord[];
  readMetrics(now: number): GatewayStoreMetrics;
  close(): void;
}

export interface AuthorizationRepository {
  findLoginUser(email: string, allowedOrganizations: readonly string[]): Promise<GatewayLoginUser | null>;
  resolveUser(userId: string, allowedOrganizations: readonly string[]): Promise<readonly GatewayIdentity[]>;
  close(): Promise<void>;
}
