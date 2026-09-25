// Route-level coverage for /api/character-packs/* — real Express app, real
// sendApiError, passthrough local-daemon guard, PATH stubbed empty so the
// embedded Codex runner never spawns during tests.

import express from 'express';
import type { Server } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerCharacterPackRoutes } from '../src/routes/character-packs.js';
import { sendApiError } from '../src/http/api-errors.js';
import { CHARACTER_JOB_SCHEMA } from '../src/characters/pack-jobs.js';

let server: Server;
let baseUrl: string;
let projectRoot: string;
let packDir: string;

const VALID_JOB = {
  schema: CHARACTER_JOB_SCHEMA,
  id: 'route-job-1',
  packId: 'gruia-grulla',
  packVersion: 'abc123',
  emotion: 'joy',
  frameIndex: 1,
  instruction: 'ala izquierda más alta',
  master: 'joy/001.png',
  neighbors: ['joy/000.png'],
  status: 'queued',
  createdAt: 1,
  updatedAt: 1,
};

beforeAll(async () => {
  // No codex on PATH → enqueue stays queued, no child process.
  vi.stubEnv('PATH', '');
  projectRoot = mkdtempSync(path.join(tmpdir(), 'pj-routes-'));
  packDir = path.join(
    projectRoot, 'apps', 'web', 'public', 'character-packs', 'gruia-grulla',
  );
  mkdirSync(packDir, { recursive: true });
  writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify({ id: 'gruia-grulla' }));

  const app = express();
  app.use(express.json({ limit: '16mb' }));
  registerCharacterPackRoutes(app, {
    http: {
      requireLocalDaemonRequest: (_req: unknown, _res: unknown, next: () => void) => next(),
      sendApiError,
    },
    paths: { PROJECT_ROOT: projectRoot },
  } as never);
  server = await new Promise((resolvePromise) => {
    const s = app.listen(0, '127.0.0.1', () => resolvePromise(s));
  });
  const address = server.address();
  if (address == null || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('jobs', () => {
  it('enqueues, lists and reads a job', async () => {
    const res = await fetch(`${baseUrl}/api/character-packs/gruia-grulla/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_JOB),
    });
    expect(res.status).toBe(201);
    expect(existsSync(path.join(packDir, 'jobs', 'route-job-1', 'job.json'))).toBe(true);

    const list = (await (
      await fetch(`${baseUrl}/api/character-packs/gruia-grulla/jobs`)
    ).json()) as { jobs: { id: string }[] };
    expect(list.jobs.map((j) => j.id)).toContain('route-job-1');

    const one = (await (
      await fetch(`${baseUrl}/api/character-packs/gruia-grulla/jobs/route-job-1`)
    ).json()) as { job: { instruction: string } };
    expect(one.job.instruction).toBe('ala izquierda más alta');
  });

  it('rejects malformed jobs and unknown packs', async () => {
    const bad = await fetch(`${baseUrl}/api/character-packs/gruia-grulla/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schema: 'wrong' }),
    });
    expect(bad.status).toBe(400);
    const missing = await fetch(`${baseUrl}/api/character-packs/nope/jobs`);
    expect(missing.status).toBe(404);
  });
});

describe('manifest + frames write-back', () => {
  it('persists a v1.1 manifest and variant frames, refusing escapes', async () => {
    const manifest = { schema: 'gruia.character-pack/1.1', id: 'gruia-grulla', emotions: {} };
    const res = await fetch(`${baseUrl}/api/character-packs/gruia-grulla/manifest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(manifest),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(readFileSync(path.join(packDir, 'pack.json'), 'utf8')).schema)
      .toBe('gruia.character-pack/1.1');

    const wrongId = await fetch(`${baseUrl}/api/character-packs/gruia-grulla/manifest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schema: 'gruia.character-pack/1.1', id: 'other-pack' }),
    });
    expect(wrongId.status).toBe(400);

    const frame = await fetch(`${baseUrl}/api/character-packs/gruia-grulla/frames`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: 'joy/variants/v1.png',
        dataBase64: Buffer.from('png').toString('base64'),
      }),
    });
    expect(frame.status).toBe(200);
    expect(readFileSync(path.join(packDir, 'joy/variants/v1.png'), 'utf8')).toBe('png');

    const escape = await fetch(`${baseUrl}/api/character-packs/gruia-grulla/frames`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: '../escape.png',
        dataBase64: Buffer.from('x').toString('base64'),
      }),
    });
    expect(escape.status).toBe(400);
  });
});
