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
  workos: Readonly<{ clientId: string; clientSecret: string; issuer: string; redirectUri: string }>;
  organizations: ReadonlyMap<string, OrganizationTarget>;
  sessionTtlSeconds: number;
  requestBodyLimitBytes: number;
  upstreamTimeoutMs: number;
  clientAccessOpen: boolean;
  testMode: boolean;
}>;

export type VerifiedProviderToken = Readonly<{
  subject: string;
  sessionId: string;
  expiresAt: number;
  accessToken: string;
  refreshToken?: string;
}>;

export type GatewayIdentity = Readonly<{
  userId: string;
  subject: string;
  organizationId: string;
  role: string;
}>;

export type StoredSession = Readonly<{
  id: string;
  userId: string;
  subject: string;
  organizationId: string;
  role: string;
  csrfToken: string;
  accessToken: string;
  refreshToken?: string;
  providerSessionId: string;
  providerExpiresAt: number;
  expiresAt: number;
}>;

export interface SessionStore {
  createPendingLogin(state: string, verifier: string, expiresAt: number): void;
  consumePendingLogin(state: string, now: number): string | null;
  createSession(session: StoredSession): void;
  readSession(id: string, now: number): StoredSession | null;
  verifyCsrf(id: string, csrf: string, now: number): boolean;
  updateProviderTokens(id: string, token: VerifiedProviderToken): void;
  deleteSession(id: string): void;
  close(): void;
}

export interface AuthorizationRepository {
  resolve(subject: string, allowedOrganizations: readonly string[]): Promise<readonly GatewayIdentity[]>;
  close(): Promise<void>;
}

export interface WorkOSClient {
  exchangeCode(code: string, verifier: string): Promise<VerifiedProviderToken | null>;
  refresh(refreshToken: string): Promise<VerifiedProviderToken | null>;
  revoke(providerSessionId: string): Promise<void>;
}
