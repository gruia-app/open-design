// Personajes pack-jobs store: path guards, enqueue/list lifecycle, manifest
// and frame write-back. Pure filesystem — no server needed.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  CHARACTER_JOB_SCHEMA,
  enqueueJob,
  getJob,
  listJobs,
  resolveJobOutFile,
  resolvePackDir,
  writeManifest,
  writePackFile,
  type StoredJob,
} from '../src/characters/pack-jobs.js';

const roots: string[] = [];

function makePack(): { projectRoot: string; packDir: string } {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'pj-jobs-'));
  roots.push(projectRoot);
  const packDir = path.join(
    projectRoot, 'apps', 'web', 'public', 'character-packs', 'gruia-grulla',
  );
  mkdirSync(packDir, { recursive: true });
  writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify({ id: 'gruia-grulla' }));
  return { projectRoot, packDir };
}

function makeJob(overrides: Partial<StoredJob> = {}): StoredJob {
  return {
    schema: CHARACTER_JOB_SCHEMA,
    id: 'job-1',
    packId: 'gruia-grulla',
    packVersion: 'abc123',
    emotion: 'joy',
    frameIndex: 2,
    instruction: 'la mano izquierda va por detrás del cuerpo',
    master: 'joy/002.png',
    neighbors: ['joy/001.png', 'joy/003.png'],
    status: 'queued',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe('resolvePackDir', () => {
  it('accepts a bundled pack and rejects unsafe or unknown ids', () => {
    const { projectRoot, packDir } = makePack();
    expect(resolvePackDir(projectRoot, 'gruia-grulla')).toBe(packDir);
    expect(resolvePackDir(projectRoot, '../etc')).toBeNull();
    expect(resolvePackDir(projectRoot, 'no/slash')).toBeNull();
    expect(resolvePackDir(projectRoot, 'missing-pack')).toBeNull();
    expect(resolvePackDir(projectRoot, 'UPPER CASE!')).toBeNull();
  });
});

describe('job lifecycle', () => {
  it('enqueues a job file, lists it, and marks it done when result.json lands', () => {
    const { projectRoot, packDir } = makePack();
    const job = enqueueJob(packDir, makeJob());
    expect(job.id).toBe('job-1');
    // The embedded runner may or may not spawn depending on whether `codex`
    // resolves — either way the file is on disk and listable.
    expect(existsSync(path.join(packDir, 'jobs', 'job-1', 'job.json'))).toBe(true);
    const listed = listJobs(packDir);
    expect(listed.map((j) => j.id)).toContain('job-1');

    const jobDir = path.join(packDir, 'jobs', 'job-1');
    mkdirSync(path.join(jobDir, 'out'), { recursive: true });
    writeFileSync(path.join(jobDir, 'out', 'joy-002.png'), 'png-bytes');
    writeFileSync(
      path.join(jobDir, 'result.json'),
      JSON.stringify({ frames: ['joy-002.png'], qc: { deltaE: 1.2 }, note: 'ok' }),
    );
    const done = getJob(packDir, 'job-1');
    expect(done?.result?.frames).toEqual(['joy-002.png']);
    expect(done?.status === 'done' || done?.status === 'running').toBe(true);
    expect(resolveJobOutFile(packDir, 'job-1', 'joy-002.png')).toBe(
      path.join(jobDir, 'out', 'joy-002.png'),
    );
    // Traversal and unknown ids are refused.
    expect(resolveJobOutFile(packDir, 'job-1', '../job.json')).toBeNull();
    expect(resolveJobOutFile(packDir, '..', 'x.png')).toBeNull();
    expect(getJob(packDir, '../other')).toBeNull();
    void projectRoot;
  });

  it('drives a simulated codex runner: prompt → out/*.png + result.json → done', async () => {
    const { packDir } = makePack();
    // Fake `codex` on PATH: parses the job id out of the spawn args, runs the
    // pack pipeline for real (regen_frame.py on the bundled pack layout) — here
    // emulated by writing the proposal files a successful runner produces.
    const binDir = mkdtempSync(path.join(tmpdir(), 'pj-fake-bin-'));
    roots.push(binDir);
    const fakeCodex = path.join(binDir, 'codex');
    writeFileSync(
      fakeCodex,
      [
        '#!/bin/sh',
        'JOB=$(echo "$@" | sed -n "s/.*jobs\\/\\([^/]*\\)\\/prompt.txt.*/\\1/p")',
        'DIR="jobs/$JOB/out"',
        'mkdir -p "$DIR"',
        'printf "PNG" > "$DIR/joy-002.png"',
        'printf \'{"frames":["joy-002.png"],"qc":{"joy-002.png":{"paletteDeltaE":2.1,"silhouetteIoUPrevious":0.9,"flags":[]}},"note":"fake"}\' > "jobs/$JOB/result.json"',
        'echo "fake codex ran job $JOB"',
      ].join('\n'),
    );
    chmodSync(fakeCodex, 0o755);
    vi.stubEnv('PATH', `${binDir}${path.delimiter}/usr/bin${path.delimiter}/bin`);

    try {
      enqueueJob(packDir, makeJob({ id: 'job-fake' }));
      const jobDir = path.join(packDir, 'jobs', 'job-fake');
      // Prompt materialized for the runner.
      expect(readFileSync(path.join(jobDir, 'prompt.txt'), 'utf8')).toContain('regen_frame.py');

      let job: StoredJob | null = null;
      for (let i = 0; i < 100; i += 1) {
        job = getJob(packDir, 'job-fake');
        if (job?.status === 'done' || job?.status === 'failed') break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(job?.status).toBe('done');
      expect(job?.result?.frames).toEqual(['joy-002.png']);
      expect(job?.result?.qc?.['joy-002.png']).toMatchObject({ paletteDeltaE: 2.1 });
      expect(resolveJobOutFile(packDir, 'job-fake', 'joy-002.png')).toBe(
        path.join(jobDir, 'out', 'joy-002.png'),
      );
      expect(readFileSync(path.join(jobDir, 'runner.log'), 'utf8')).toContain('fake codex ran');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('writePackFile / writeManifest', () => {
  it('writes pack-relative files, mirrors into out/ when present, and blocks escapes', () => {
    const { projectRoot, packDir } = makePack();
    const served = path.join(
      projectRoot, 'apps', 'web', 'out', 'character-packs', 'gruia-grulla',
    );
    mkdirSync(served, { recursive: true });

    expect(writePackFile(projectRoot, packDir, 'joy/variants/v1.png', Buffer.from('x')))
      .toBe('joy/variants/v1.png');
    expect(readFileSync(path.join(packDir, 'joy/variants/v1.png'), 'utf8')).toBe('x');
    expect(readFileSync(path.join(served, 'joy/variants/v1.png'), 'utf8')).toBe('x');

    expect(writePackFile(projectRoot, packDir, '../evil.png', Buffer.from('x'))).toBeNull();
    // Leading slashes normalize to a pack-relative path, still confined.
    expect(writePackFile(projectRoot, packDir, '/abs.png', Buffer.from('x'))).toBe('abs.png');
    expect(writePackFile(projectRoot, packDir, 'bad name!.png', Buffer.from('x'))).toBeNull();

    writeManifest(projectRoot, packDir, { schema: 'gruia.character-pack/1.1', id: 'gruia-grulla' });
    const manifest = JSON.parse(readFileSync(path.join(packDir, 'pack.json'), 'utf8'));
    expect(manifest.schema).toBe('gruia.character-pack/1.1');
    expect(JSON.parse(readFileSync(path.join(served, 'pack.json'), 'utf8')).schema)
      .toBe('gruia.character-pack/1.1');
  });
});
