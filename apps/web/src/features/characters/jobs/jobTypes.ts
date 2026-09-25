// Regeneration job contract — `gruia.character-job/1`. A job asks the runner
// (Codex imagegen thread in daemon mode, or a manual handoff in static mode)
// to redraw one frame or a whole emotion from a text instruction plus visual
// references, and returns candidate frames as proposals.

export const CHARACTER_JOB_SCHEMA = 'gruia.character-job/1' as const;

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface RegenJobResult {
  /** Pack-relative paths of the proposed frames (written under jobs/<id>/out
   *  on the daemon host, or delivered manually in static mode). */
  frames: string[];
  /** Consistency-pipeline verdicts (ΔE, IoU, flags) when the runner ran QC. */
  qc?: Record<string, unknown>;
  note?: string;
}

export interface RegenJob {
  schema: typeof CHARACTER_JOB_SCHEMA;
  id: string;
  packId: string;
  /** Manifest token the job was authored against. */
  packVersion: string;
  emotion: string;
  /** Frame index being regenerated; `null` means the whole emotion. */
  frameIndex: number | null;
  instruction: string;
  /** Reference frame src (usually master or the replaced frame). */
  master: string | null;
  /** Neighboring frame srcs handed to the runner for continuity. */
  neighbors: string[];
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  /** True when no daemon accepted the job — the JSON export is the handoff. */
  needsLocalDaemon?: boolean;
  result?: RegenJobResult;
  error?: string;
}

export function jobFileName(jobId: string): string {
  return `personajes-job-${jobId}.json`;
}

export function jobToJson(job: RegenJob): string {
  return JSON.stringify(job, null, 2);
}

let counter = 0;

export function newJobId(now = Date.now()): string {
  counter = (counter + 1) % 1296;
  return `${now.toString(36)}-${counter.toString(36).padStart(2, '0')}`;
}
