// Character-pack job store + runner. Jobs are `gruia.character-job/1` JSON
// files materialized inside the bundled pack dir (`jobs/<id>/job.json`) so an
// external Codex/imagegen runner — or the embedded `codex exec` spawn below —
// can pick them up, write `jobs/<id>/out/*.png` plus `result.json`, and the
// review UI can offer the output as an accept/discard proposal.
//
// Writes also land in the served `apps/web/out/character-packs` copy when it
// exists so a running static export reflects accepted variants immediately.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { resolveOnPath } from '../runtimes/executables.js';

export const CHARACTER_JOB_SCHEMA = 'gruia.character-job/1';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface StoredJob {
  schema: string;
  id: string;
  packId: string;
  packVersion?: string | undefined;
  emotion: string;
  frameIndex: number | null;
  instruction: string;
  master?: string | null | undefined;
  neighbors?: string[] | undefined;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  needsLocalDaemon?: boolean | undefined;
  runner?: string | undefined;
  result?: { frames: string[]; qc?: Record<string, unknown>; note?: string } | undefined;
  error?: string | undefined;
}

const PACK_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const JOB_ID_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const SAFE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function packsRoot(projectRoot: string): string {
  return path.join(projectRoot, 'apps', 'web', 'public', 'character-packs');
}

function packsServedRoot(projectRoot: string): string {
  return path.join(projectRoot, 'apps', 'web', 'out', 'character-packs');
}

/** Resolves the on-disk dir for a bundled pack id, or null when the id is
 *  unsafe or not bundled. */
export function resolvePackDir(projectRoot: string, packId: string): string | null {
  if (!PACK_ID_RE.test(packId) || packId.includes('..')) return null;
  const dir = path.join(packsRoot(projectRoot), packId);
  if (!dir.startsWith(packsRoot(projectRoot) + path.sep)) return null;
  return fs.existsSync(path.join(dir, 'pack.json')) ? dir : null;
}

function writeJsonAtomic(file: string, value: unknown): void {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function readJob(jobDir: string): StoredJob | null {
  try {
    const job = JSON.parse(fs.readFileSync(path.join(jobDir, 'job.json'), 'utf8')) as StoredJob;
    const resultPath = path.join(jobDir, 'result.json');
    if (fs.existsSync(resultPath)) {
      job.result = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as StoredJob['result'];
      if (job.status === 'queued' || job.status === 'running') job.status = 'done';
    }
    return job;
  } catch {
    return null;
  }
}

export function listJobs(packDir: string): StoredJob[] {
  const jobsDir = path.join(packDir, 'jobs');
  if (!fs.existsSync(jobsDir)) return [];
  const jobs: StoredJob[] = [];
  for (const entry of fs.readdirSync(jobsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const job = readJob(path.join(jobsDir, entry.name));
    if (job) jobs.push(job);
  }
  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

export function getJob(packDir: string, jobId: string): StoredJob | null {
  if (!JOB_ID_RE.test(jobId) || jobId.includes('..')) return null;
  return readJob(path.join(packDir, 'jobs', jobId));
}

/** Serve a file under `jobs/<id>/out/` — PNG frames the runner produced. */
export function resolveJobOutFile(packDir: string, jobId: string, file: string): string | null {
  if (!JOB_ID_RE.test(jobId) || !SAFE_NAME_RE.test(file)) return null;
  const outDir = path.join(packDir, 'jobs', jobId, 'out');
  const target = path.join(outDir, file);
  if (!target.startsWith(outDir + path.sep)) return null;
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}

/** Persist a job request and kick the embedded runner when Codex is on PATH.
 *  The job file stays on disk either way, so an external runner can still
 *  pick it up when `codex` is not resolvable here. */
export function enqueueJob(packDir: string, job: StoredJob): StoredJob {
  const jobDir = path.join(packDir, 'jobs', job.id);
  fs.mkdirSync(path.join(jobDir, 'out'), { recursive: true });
  writeJsonAtomic(path.join(jobDir, 'job.json'), job);
  spawnRunner(packDir, jobDir, job);
  return readJob(jobDir) ?? job;
}

function buildRunnerPrompt(job: StoredJob): string {
  const neighbors = (job.neighbors ?? []).join(', ');
  const index = job.frameIndex == null ? '' : ` --index ${job.frameIndex}`;
  return [
    'You are regenerating frames for a character animation pack.',
    `Emotion: ${job.emotion}. ${job.frameIndex == null ? 'Regenerate the WHOLE emotion' : `Regenerate frame ${job.frameIndex}`}.`,
    `Instruction: ${job.instruction}`,
    `Master reference: ${job.master ?? 'ref/master.png'}. Neighbors for continuity: ${neighbors || 'none'}.`,
    'Steps:',
    `1. Generate the raw render with your image tool: full-body character on a solid flat #FF00FF magenta background`,
    `   (no shadows, grid, text or borders). Copy the design, palette and proportions of the master reference.`,
    `   Save it as jobs/${job.id}/candidate.png.`,
    `2. Run the pack consistency pipeline: python3 tools/regen_frame.py --emotion ${job.emotion}${index} --candidate jobs/${job.id}/candidate.png --job-dir jobs/${job.id}`,
    '   It removes the chroma, aligns to the foot anchor and writes jobs/<id>/out/*.png + result.json with ΔE/IoU QC.',
    '3. If result.json reports fixable flags (clipping, salto_silueta), iterate once on steps 1-2.',
    'Only modify files under jobs/. Never touch pack frames or pack.json directly.',
  ].join('\n');
}

function spawnRunner(packDir: string, jobDir: string, job: StoredJob): void {
  const codex = resolveOnPath('codex');
  if (!codex) {
    // No runner on this host — the job file stays queued for the external
    // t3code runner that watches jobs/ dirs.
    return;
  }
  const promptPath = path.join(jobDir, 'prompt.txt');
  fs.writeFileSync(promptPath, buildRunnerPrompt(job));
  const logPath = path.join(jobDir, 'runner.log');
  const logFd = fs.openSync(logPath, 'a');
  try {
    const child = spawn(codex, ['exec', '--skip-git-repo-check', '-C', packDir, `Run the task described in jobs/${job.id}/prompt.txt`], {
      cwd: packDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.unref();
    fs.closeSync(logFd);
    const running = { ...job, status: 'running' as JobStatus, runner: `codex exec (pid ${child.pid})`, updatedAt: Date.now() };
    writeJsonAtomic(path.join(jobDir, 'job.json'), running);
    child.on('exit', (code) => {
      const current = readJob(jobDir);
      if (!current) return;
      const hasResult = fs.existsSync(path.join(jobDir, 'result.json'));
      const next: StoredJob = {
        ...current,
        status: hasResult ? 'done' : 'failed',
        updatedAt: Date.now(),
        error: hasResult ? undefined : `runner exited ${code ?? 'unknown'} — see jobs/${job.id}/runner.log`,
      };
      writeJsonAtomic(path.join(jobDir, 'job.json'), next);
    });
  } catch (error) {
    fs.closeSync(logFd);
    const failed = {
      ...job,
      updatedAt: Date.now(),
      error: `could not spawn codex runner: ${error instanceof Error ? error.message : String(error)}`,
    };
    writeJsonAtomic(path.join(jobDir, 'job.json'), failed);
  }
}

/** Write the edited manifest (pack.json v1.1) back to the pack dir — and to
 *  the served static copy when present. */
export function writeManifest(projectRoot: string, packDir: string, manifest: unknown): void {
  writeJsonAtomic(path.join(packDir, 'pack.json'), manifest);
  const served = path.join(packsServedRoot(projectRoot), path.basename(packDir));
  if (fs.existsSync(served)) writeJsonAtomic(path.join(served, 'pack.json'), manifest);
}

/** Write a pack-relative binary file (accepted variant PNG). Paths must stay
 *  inside the pack dir. Returns the normalized path actually written. */
export function writePackFile(
  projectRoot: string,
  packDir: string,
  relPath: string,
  data: Buffer,
): string | null {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(normalized)) return null;
  const target = path.join(packDir, normalized);
  if (!target.startsWith(packDir + path.sep)) return null;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  const served = path.join(packsServedRoot(projectRoot), path.basename(packDir));
  if (fs.existsSync(served)) {
    const servedTarget = path.join(served, normalized);
    fs.mkdirSync(path.dirname(servedTarget), { recursive: true });
    fs.writeFileSync(servedTarget, data);
  }
  return normalized;
}
