import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { resolve } from "node:path";
import type { GatewayConfig, OrganizationTarget } from "./types.js";

const MAX_ORGANIZATIONS = 1000;

function text(value: unknown, field: string, max = 4096): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || value !== value.trim()) throw new Error(`Invalid ${field}`);
  return value;
}

function integer(value: unknown, field: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`Invalid ${field}`);
  return value as number;
}

function publicOrigin(value: unknown, testMode: boolean): string {
  const raw = text(value, "publicOrigin");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid publicOrigin"); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.origin !== raw || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(testMode && local && url.protocol === "http:"))) {
    throw new Error("Invalid publicOrigin");
  }
  return url.origin;
}

function loopbackUpstream(value: unknown, organizationId: string): string {
  const raw = text(value, `organizations.${organizationId}.upstream`);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`Invalid organizations.${organizationId}.upstream`); }
  if (url.protocol !== "http:" || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !(url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]")) {
    throw new Error(`Upstream must be an explicit loopback HTTP origin for ${organizationId}`);
  }
  return url.origin;
}

function parseOrganizations(value: unknown): ReadonlyMap<string, OrganizationTarget> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("organizations must be an object");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.length > MAX_ORGANIZATIONS) throw new Error("Invalid organization count");
  const organizations = new Map<string, OrganizationTarget>();
  for (const [organizationId, target] of entries) {
    const id = text(organizationId, "organization ID", 255);
    if (!target || typeof target !== "object" || Array.isArray(target)) throw new Error(`Invalid organization ${id}`);
    const object = target as Record<string, unknown>;
    if (object.audience !== undefined && object.audience !== "internal" && object.audience !== "client") throw new Error(`Invalid organizations.${id}.audience`);
    organizations.set(id, Object.freeze({ audience: object.audience === "internal" ? "internal" : "client", upstream: loopbackUpstream(object.upstream, id), daemonApiToken: text(object.daemonApiToken, `organizations.${id}.daemonApiToken`) }));
  }
  return organizations;
}

export function loadConfig(path: string): GatewayConfig {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(resolve(path), "utf8")); } catch { throw new Error("Unable to read Gruia gateway configuration"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Gateway configuration must be an object");
  const value = raw as Record<string, unknown>;
  if (value.workos !== undefined) throw new Error("Remove deprecated workos configuration");
  const testMode = value.testMode === true;
  const bindHost = value.bindHost === undefined ? "127.0.0.1" : text(value.bindHost, "bindHost", 255);
  if (!(bindHost === "127.0.0.1" || bindHost === "::1" || bindHost === "localhost" || isIP(bindHost) === 4 && bindHost === "127.0.0.1")) throw new Error("Gateway only binds to loopback");
  const origin = publicOrigin(value.publicOrigin, testMode);
  const sessionSecret = text(value.sessionSecret, "sessionSecret", 512);
  const decodedSecret = Buffer.from(sessionSecret, "base64");
  if (decodedSecret.length !== 32) throw new Error("sessionSecret must be 32 random bytes encoded as base64");
  const localOrigin = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1") || origin.startsWith("http://[::1]");
  if (testMode && !localOrigin) throw new Error("testMode is only allowed for a localhost publicOrigin");
  return Object.freeze({
    bindHost,
    port: integer(value.port, "port", 3006, 1, 65535),
    publicOrigin: origin,
    cookieName: testMode ? "gruia_design_session" : "__Host-gruia_design_session",
    databasePath: resolve(text(value.databasePath, "databasePath")),
    sessionSecret,
    postgresUrl: text(value.postgresUrl, "postgresUrl"),
    organizations: parseOrganizations(value.organizations),
    sessionTtlSeconds: integer(value.sessionTtlSeconds, "sessionTtlSeconds", 14_400, 300, 7 * 24 * 3600),
    requestBodyLimitBytes: integer(value.requestBodyLimitBytes, "requestBodyLimitBytes", 10 * 1024 * 1024, 1, 50 * 1024 * 1024),
    upstreamTimeoutMs: integer(value.upstreamTimeoutMs, "upstreamTimeoutMs", 30_000, 1000, 120_000),
    clientAccessOpen: value.clientAccessOpen === true,
    testMode,
  });
}
