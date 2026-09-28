import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  characterExportAccountId,
  registerTelemetryRoutes,
  type RegisterTelemetryRoutesDeps,
} from '../src/routes/telemetry.js';
import type { AnalyticsService } from '../src/analytics.js';
import type { VelaLoginStatus } from '../src/integrations/vela.js';

// `POST /api/analytics/character-export` backs the Personajes KPI «accounts
// exporting ≥1 animated character per week». The contract under test: the
// browser only picks `format`; `account_id` and `occurred_at` are stamped
// server-side, and the request dies with a 200 no-op when analytics consent
// headers are absent.

const ANALYTICS_HEADERS = {
  'x-od-analytics-device-id': 'device-under-test',
  'x-od-analytics-session-id': 'session-under-test',
  'x-od-analytics-client-type': 'web',
};

const LOGGED_IN: VelaLoginStatus = {
  loggedIn: true,
  loginInFlight: false,
  profile: 'default',
  user: { id: 'acct-42', email: 'user@example.com' },
  configPath: '/nonexistent/vela.json',
};

const LOGGED_OUT: VelaLoginStatus = {
  loggedIn: false,
  loginInFlight: false,
  profile: 'default',
  user: null,
  configPath: '/nonexistent/vela.json',
};

interface CaptureArgs {
  eventName: string;
  context: unknown;
  appVersion: string;
  properties: Record<string, unknown>;
  insertId: string;
}

function makeCapture() {
  return vi.fn(async (_args: CaptureArgs) => ({
    status: 'queued' as const,
    acknowledgement: 'local_buffer' as const,
    errorType: null,
  }));
}

function makeApp(opts: { loginStatus?: VelaLoginStatus } = {}) {
  const capture = makeCapture();
  const analyticsService = {
    capture,
    captureSafety: vi.fn(async () => undefined),
    mergeAnonymousPerson: vi.fn(async () => undefined),
    identifyGroup: vi.fn(async () => undefined),
    shutdown: vi.fn(async () => undefined),
  } as unknown as AnalyticsService;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-export-'));
  const deps = {
    dataDir,
    readAppConfig: vi.fn(async () => ({ telemetry: { metrics: true } })),
    writeAppConfig: vi.fn(async (_d: string, patch: Record<string, unknown>) => patch),
    readLoginStatus: () => opts.loginStatus ?? LOGGED_IN,
    analyticsService,
  } as unknown as RegisterTelemetryRoutesDeps;
  const app = express();
  registerTelemetryRoutes(app, deps);
  return { app, capture };
}

const servers: http.Server[] = [];

function listen(app: express.Express): Promise<string> {
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        servers.push(srv);
        resolve(`http://127.0.0.1:${addr.port}`);
      }
    });
  });
}

afterAll(async () => {
  await Promise.all(servers.map((srv) => new Promise<void>((r) => srv.close(() => r()))));
});

function postExport(base: string, body: unknown, headers: Record<string, string> = ANALYTICS_HEADERS) {
  return fetch(`${base}/api/analytics/character-export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analytics/character-export', () => {
  it('rejects a format outside the closed set with 400 and no capture', async () => {
    const { app, capture } = makeApp();
    const base = await listen(app);
    for (const format of ['svg', 'sheet', 'png', '../../etc', '']) {
      const res = await postExport(base, { format });
      expect(res.status).toBe(400);
    }
    expect(capture).not.toHaveBeenCalled();
  });

  it('captures with a server-resolved account id, ignoring body spoofing', async () => {
    const { app, capture } = makeApp();
    const base = await listen(app);
    const res = await postExport(base, {
      format: 'gif',
      account_id: 'attacker-controlled',
      occurred_at: '1999-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(capture).toHaveBeenCalledTimes(1);
    const args = capture.mock.calls[0]![0];
    expect(args.eventName).toBe('character_export_result');
    expect(args.properties.format).toBe('gif');
    expect(args.properties.account_id).toBe('acct-42');
  });

  it('stamps occurred_at from the server clock, not the request', async () => {
    const { app, capture } = makeApp();
    const base = await listen(app);
    const before = Date.now();
    const res = await postExport(base, { format: 'webp', occurred_at: '1999-01-01T00:00:00.000Z' });
    const after = Date.now();
    expect(res.status).toBe(200);
    const args = capture.mock.calls[0]![0];
    const occurredAt = Date.parse(String(args.properties.occurred_at));
    expect(Number.isFinite(occurredAt)).toBe(true);
    expect(occurredAt).toBeGreaterThanOrEqual(before);
    expect(occurredAt).toBeLessThanOrEqual(after);
  });

  it('emits an empty account_id when the daemon has no signed-in account', async () => {
    const { app, capture } = makeApp({ loginStatus: LOGGED_OUT });
    const base = await listen(app);
    const res = await postExport(base, { format: 'pack' });
    expect(res.status).toBe(200);
    const args = capture.mock.calls[0]![0];
    expect(args.properties.account_id).toBe('');
    expect(args.properties.format).toBe('pack');
  });

  it('no-ops with 200 when analytics consent headers are absent', async () => {
    const { app, capture } = makeApp();
    const base = await listen(app);
    const res = await postExport(base, { format: 'gif' }, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, captured: false });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('characterExportAccountId', () => {
  it('returns the signed-in AMR user id only for file-backed sessions', () => {
    expect(characterExportAccountId(LOGGED_IN)).toBe('acct-42');
    // Env-key auth (VELA_RUNTIME_KEY/VELA_LINK_URL) carries no profile.
    expect(characterExportAccountId({ ...LOGGED_IN, user: null })).toBe('');
    expect(characterExportAccountId(LOGGED_OUT)).toBe('');
    expect(characterExportAccountId(null)).toBe('');
  });
});
