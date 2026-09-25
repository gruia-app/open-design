// Regeneration-job plumbing. Two halves with the same outward shape:
//  - a local queue persisted in IndexedDB that always keeps the request
//    exportable (the static-host path ends here), and
//  - a daemon client that materializes `jobs/<id>.json` inside the pack dir
//    and polls status while a Codex/imagegen runner works it.

import { loadJobs, removeJob, saveJob } from '../edit/editsDb';
import {
  CHARACTER_JOB_SCHEMA,
  jobFileName,
  jobToJson,
  newJobId,
  type RegenJob,
} from './jobTypes';
import { downloadJson } from '../export/spritesheet';

export type { RegenJob };

let daemonProbe: Promise<boolean> | null = null;

/** True when a real daemon answers /api/health with JSON (a static host
 *  serves index.html instead — the same probe the shell uses at boot). */
export function daemonAvailable(): Promise<boolean> {
  if (!daemonProbe) {
    daemonProbe = fetch('/api/health', { cache: 'no-store' })
      .then((res) => {
        const type = res.headers.get('content-type') ?? '';
        return res.ok && type.includes('application/json');
      })
      .catch(() => false);
  }
  return daemonProbe;
}

export interface EnqueueInput {
  packId: string;
  packVersion: string;
  emotion: string;
  frameIndex: number | null;
  instruction: string;
  master: string | null;
  neighbors: string[];
}

/** Create a job. In daemon mode it is POSTed to the daemon (which writes
 *  jobs/<id>/job.json and launches the runner); without a daemon the job is
 *  stored locally flagged `needsLocalDaemon` so it can be exported. */
export async function enqueueJob(input: EnqueueInput): Promise<RegenJob> {
  const now = Date.now();
  const job: RegenJob = {
    schema: CHARACTER_JOB_SCHEMA,
    id: newJobId(now),
    packId: input.packId,
    packVersion: input.packVersion,
    emotion: input.emotion,
    frameIndex: input.frameIndex,
    instruction: input.instruction,
    master: input.master,
    neighbors: input.neighbors,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  };

  if (await daemonAvailable()) {
    try {
      const res = await fetch(
        `/api/character-packs/${encodeURIComponent(input.packId)}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(job),
        },
      );
      if (res.ok) {
        const accepted = (await res.json()) as { job?: RegenJob };
        const serverJob = accepted.job ?? job;
        await saveJob(serverJob);
        return serverJob;
      }
      job.error = `daemon rejected the job (${res.status})`;
      job.status = 'failed';
    } catch (error) {
      job.error = error instanceof Error ? error.message : 'daemon call failed';
      job.needsLocalDaemon = true;
    }
  } else {
    job.needsLocalDaemon = true;
  }
  await saveJob(job);
  return job;
}

/** Merge daemon-side status with the local queue. Daemon wins while it can
 *  be reached; otherwise whatever IndexedDB last saw is shown. */
export async function listJobs(packId: string): Promise<RegenJob[]> {
  const local = await loadJobs(packId).catch(() => [] as RegenJob[]);
  if (!(await daemonAvailable())) return local;
  try {
    const res = await fetch(`/api/character-packs/${encodeURIComponent(packId)}/jobs`, {
      cache: 'no-store',
    });
    if (!res.ok) return local;
    const body = (await res.json()) as { jobs?: RegenJob[] };
    const remote = body.jobs ?? [];
    const byId = new Map(local.map((job) => [job.id, job]));
    for (const job of remote) {
      byId.set(job.id, job);
      void saveJob(job);
    }
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return local;
  }
}

/** URL a job result file is served at (daemon mode). */
export function jobResultUrl(packId: string, jobId: string, file: string): string {
  return `/api/character-packs/${encodeURIComponent(packId)}/jobs/${encodeURIComponent(jobId)}/out/${encodeURIComponent(file)}`;
}

export function downloadJobRequest(job: RegenJob): void {
  downloadJson(jobFileName(job.id), jobToJson(job));
}

export async function forgetJob(jobId: string): Promise<void> {
  await removeJob(jobId).catch(() => {});
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  });
}

/** Daemon-mode persistence: write the edited manifest (v1.1) plus every
 *  accepted-variant file into the pack dir on disk. */
export async function savePackToDaemon(
  packId: string,
  manifest: unknown,
  extras: Array<[string, Blob]>,
): Promise<void> {
  if (!(await daemonAvailable())) {
    throw new Error('no daemon on this host — use the .zip export instead');
  }
  const base = `/api/character-packs/${encodeURIComponent(packId)}`;
  const manifestRes = await fetch(`${base}/manifest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(manifest),
  });
  if (!manifestRes.ok) throw new Error(`manifest save failed (${manifestRes.status})`);
  for (const [src, blob] of extras) {
    const res = await fetch(`${base}/frames`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: src, dataBase64: await blobToBase64(blob) }),
    });
    if (!res.ok) throw new Error(`frame save failed for ${src} (${res.status})`);
  }
}
