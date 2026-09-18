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
  email?: string;
  userId?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  detail?: string;
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
  close(): void;
}

export interface AuthorizationRepository {
  findLoginUser(email: string, allowedOrganizations: readonly string[]): Promise<GatewayLoginUser | null>;
  resolveUser(userId: string, allowedOrganizations: readonly string[]): Promise<readonly GatewayIdentity[]>;
  close(): Promise<void>;
}
