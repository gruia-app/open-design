import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import type { WorkOSClient, VerifiedProviderToken } from "./types.js";

const API = "https://api.workos.com";
const AUTHENTICATE = `${API}/user_management/authenticate`;
const MAX_TOKEN_LENGTH = 16_384;

function same(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function claim(value: unknown, max = 1024): string | null { return typeof value === "string" && value.length > 0 && value.length <= max && value === value.trim() ? value : null; }
function numeric(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

export class AuthKitWorkOSClient implements WorkOSClient {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>;
  constructor(private readonly config: Readonly<{ clientId: string; clientSecret: string; issuer: string }>, private readonly fetcher: typeof fetch = fetch) {
    this.keys = createRemoteJWKSet(new URL(`${API}/sso/jwks/${encodeURIComponent(config.clientId)}`), { timeoutDuration: 10_000, cooldownDuration: 30_000 });
  }
  async exchangeCode(code: string, verifier: string): Promise<VerifiedProviderToken | null> {
    return this.authenticate({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: this.config.clientId, client_secret: this.config.clientSecret });
  }
  async refresh(refreshToken: string): Promise<VerifiedProviderToken | null> {
    return this.authenticate({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: this.config.clientId, client_secret: this.config.clientSecret });
  }
  async revoke(providerSessionId: string): Promise<void> {
    try { await this.fetcher(`${API}/user_management/sessions/revoke`, { method: "POST", headers: { authorization: `Bearer ${this.config.clientSecret}`, "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify({ session_id: providerSessionId }), signal: AbortSignal.timeout(5_000) }); } catch { /* local logout is authoritative even when WorkOS is unavailable */ }
  }
  private async authenticate(payload: Record<string, string>): Promise<VerifiedProviderToken | null> {
    try {
      const response = await this.fetcher(AUTHENTICATE, { method: "POST", headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!body || typeof body !== "object") return null;
      const value = body as Record<string, unknown>; const accessToken = claim(value.access_token, MAX_TOKEN_LENGTH); const refreshToken = claim(value.refresh_token, MAX_TOKEN_LENGTH) ?? undefined;
      return accessToken ? await this.verify(accessToken, refreshToken) : null;
    } catch { return null; }
  }
  private async verify(accessToken: string, refreshToken?: string): Promise<VerifiedProviderToken | null> {
    try {
      const result = await jwtVerify(accessToken, this.keys, { algorithms: ["RS256"], issuer: this.config.issuer, requiredClaims: ["sub", "sid", "client_id", "exp"] });
      const subject = claim(result.payload.sub); const sessionId = claim(result.payload.sid); const clientId = claim(result.payload.client_id); const exp = numeric(result.payload.exp);
      if (!subject || !sessionId || !clientId || exp === null || exp <= Math.floor(Date.now() / 1000) || !same(clientId, this.config.clientId)) return null;
      return Object.freeze({ subject, sessionId, expiresAt: exp * 1000, accessToken, refreshToken });
    } catch { return null; }
  }
}

export function authorizationUrl(config: Readonly<{ clientId: string; redirectUri: string }>, state: string, verifier: string): string {
  const challenge = Buffer.from(awaitableSha256(verifier)).toString("base64url");
  const url = new URL(`${API}/user_management/authorize`);
  url.search = new URLSearchParams({ provider: "authkit", response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, state, code_challenge: challenge, code_challenge_method: "S256", screen_hint: "sign-in" }).toString();
  return url.toString();
}

// Synchronous because Node's crypto hash has no I/O; separated to keep URL construction auditable.
function awaitableSha256(value: string): Buffer { return createHash("sha256").update(value).digest(); }
