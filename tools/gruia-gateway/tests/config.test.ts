import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const SECRET = Buffer.alloc(32, 9).toString("base64");

let dir = "";

function write(value: Record<string, unknown>): string {
  dir = mkdtempSync(join(tmpdir(), "gruia-config-"));
  const path = join(dir, "gateway.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    publicOrigin: "https://design.gruia.app",
    sessionSecret: SECRET,
    postgresUrl: "postgres://localhost/gruia",
    databasePath: "/tmp/gruia-sessions.db",
    organizations: { "org-a": { upstream: "http://127.0.0.1:3010", daemonApiToken: "tok" } },
    ...overrides,
  };
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("defaults sessionTtlSeconds to four hours", () => {
    expect(loadConfig(write(valid())).sessionTtlSeconds).toBe(14_400);
  });

  it("honors a configured sessionTtlSeconds", () => {
    expect(loadConfig(write(valid({ sessionTtlSeconds: 3600 }))).sessionTtlSeconds).toBe(3600);
  });

  it("rejects out-of-range and malformed sessionTtlSeconds", () => {
    for (const sessionTtlSeconds of [0, 299, 7 * 24 * 3600 + 1, "3600", 1.5]) {
      expect(() => loadConfig(write(valid({ sessionTtlSeconds })))).toThrow(/sessionTtlSeconds/);
    }
  });

  it("rejects a non-loopback bind host and non-https public origin", () => {
    expect(() => loadConfig(write(valid({ bindHost: "0.0.0.0" })))).toThrow(/loopback/i);
    expect(() => loadConfig(write(valid({ publicOrigin: "http://design.gruia.app" })))).toThrow(/publicOrigin/i);
  });

  it("rejects a remote or credentialed upstream", () => {
    expect(() => loadConfig(write(valid({ organizations: { "org-a": { upstream: "http://10.0.0.5:3010", daemonApiToken: "t" } } })))).toThrow(/loopback/i);
    expect(() => loadConfig(write(valid({ organizations: { "org-a": { upstream: "http://user:pw@127.0.0.1:3010", daemonApiToken: "t" } } })))).toThrow(/org-a/);
  });

  it("rejects secrets that are not 32 base64 bytes", () => {
    expect(() => loadConfig(write(valid({ sessionSecret: "short" })))).toThrow(/sessionSecret/);
  });

  it("leaves metricsToken unset by default and honors a configured token", () => {
    expect(loadConfig(write(valid())).metricsToken).toBeUndefined();
    expect(loadConfig(write(valid({ metricsToken: "scrape-token" }))).metricsToken).toBe("scrape-token");
  });

  it("rejects malformed metricsToken values", () => {
    for (const metricsToken of ["", 42, " padded ", null]) {
      expect(() => loadConfig(write(valid({ metricsToken })))).toThrow(/metricsToken/);
    }
  });
});
