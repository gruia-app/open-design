// /api/character-packs/* — the daemon half of the Personajes editor. Jobs are
// materialized as `jobs/<id>/job.json` inside the bundled pack dir so a Codex
// imagegen runner (spawned here when `codex` resolves, or an external t3code
// watcher otherwise) can produce proposed frames. Edited manifests and
// accepted variant PNGs are written back to the pack on disk.

import type { Express } from 'express';

import type { RouteDeps } from '../server-context.js';
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
} from '../characters/pack-jobs.js';

export type RegisterCharacterPackRoutesDeps = RouteDeps<'http' | 'paths'>;

const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const VALID_STATUSES = new Set(['queued', 'running', 'done', 'failed']);

function normalizeJob(raw: unknown, packId: string): StoredJob | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const job = raw as Record<string, unknown>;
  if (
    job.schema !== CHARACTER_JOB_SCHEMA
    || typeof job.id !== 'string'
    || typeof job.emotion !== 'string'
    || typeof job.instruction !== 'string'
    || job.instruction.trim().length === 0
  ) {
    return null;
  }
  const status = typeof job.status === 'string' && VALID_STATUSES.has(job.status)
    ? (job.status as StoredJob['status'])
    : 'queued';
  return {
    schema: CHARACTER_JOB_SCHEMA,
    id: job.id,
    packId,
    packVersion: typeof job.packVersion === 'string' ? job.packVersion : undefined,
    emotion: job.emotion,
    frameIndex: typeof job.frameIndex === 'number' ? job.frameIndex : null,
    instruction: job.instruction,
    master: typeof job.master === 'string' ? job.master : null,
    neighbors: Array.isArray(job.neighbors)
      ? job.neighbors.filter((n): n is string => typeof n === 'string')
      : [],
    status,
    createdAt: typeof job.createdAt === 'number' ? job.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}

export function registerCharacterPackRoutes(
  app: Express,
  deps: RegisterCharacterPackRoutesDeps,
): void {
  const { requireLocalDaemonRequest, sendApiError } = deps.http;
  const { PROJECT_ROOT } = deps.paths;

  const packDirOr404 = (packId: string, res: Parameters<typeof sendApiError>[0]): string | null => {
    const dir = resolvePackDir(PROJECT_ROOT, packId);
    if (!dir) {
      sendApiError(res, 404, 'NOT_FOUND', `no bundled character pack "${packId}"`);
      return null;
    }
    return dir;
  };

  app.post(
    '/api/character-packs/:packId/jobs',
    requireLocalDaemonRequest,
    (req, res) => {
      const packId = String(req.params.packId);
      const packDir = packDirOr404(packId, res);
      if (!packDir) return;
      const job = normalizeJob(req.body, packId);
      if (!job) {
        sendApiError(res, 400, 'BAD_REQUEST', 'body must be a gruia.character-job/1 request');
        return;
      }
      const stored = enqueueJob(packDir, job);
      res.status(201).json({ job: stored });
    },
  );

  app.get(
    '/api/character-packs/:packId/jobs',
    requireLocalDaemonRequest,
    (req, res) => {
      const packDir = packDirOr404(String(req.params.packId), res);
      if (!packDir) return;
      res.json({ jobs: listJobs(packDir) });
    },
  );

  app.get(
    '/api/character-packs/:packId/jobs/:jobId',
    requireLocalDaemonRequest,
    (req, res) => {
      const packDir = packDirOr404(String(req.params.packId), res);
      if (!packDir) return;
      const job = getJob(packDir, String(req.params.jobId));
      if (!job) {
        sendApiError(res, 404, 'NOT_FOUND', 'unknown job id');
        return;
      }
      res.json({ job });
    },
  );

  app.get(
    '/api/character-packs/:packId/jobs/:jobId/out/:file',
    requireLocalDaemonRequest,
    (req, res) => {
      const packDir = packDirOr404(String(req.params.packId), res);
      if (!packDir) return;
      const file = resolveJobOutFile(packDir, String(req.params.jobId), String(req.params.file));
      if (!file) {
        sendApiError(res, 404, 'NOT_FOUND', 'no such job output file');
        return;
      }
      res.type('image/png').sendFile(file);
    },
  );

  // Edited manifest write-back (pack v1.1). The body is the whole manifest —
  // the daemon validates the schema marker and persists it verbatim.
  app.post(
    '/api/character-packs/:packId/manifest',
    requireLocalDaemonRequest,
    (req, res) => {
      const packId = String(req.params.packId);
      const packDir = packDirOr404(packId, res);
      if (!packDir) return;
      const manifest = req.body as Record<string, unknown> | null;
      if (
        !manifest
        || typeof manifest !== 'object'
        || typeof manifest.schema !== 'string'
        || !manifest.schema.startsWith('gruia.character-pack/')
        || manifest.id !== packId
      ) {
        sendApiError(res, 400, 'BAD_REQUEST', 'manifest must be a character-pack matching the pack id');
        return;
      }
      writeManifest(PROJECT_ROOT, packDir, manifest);
      res.json({ ok: true });
    },
  );

  // Accepted variant frames — { path: 'joy/variants/x.png', dataBase64: ... }.
  app.post(
    '/api/character-packs/:packId/frames',
    requireLocalDaemonRequest,
    (req, res) => {
      const packId = String(req.params.packId);
      const packDir = packDirOr404(packId, res);
      if (!packDir) return;
      const body = req.body as { path?: unknown; dataBase64?: unknown } | null;
      if (!body || typeof body.path !== 'string' || typeof body.dataBase64 !== 'string') {
        sendApiError(res, 400, 'BAD_REQUEST', 'expected { path, dataBase64 }');
        return;
      }
      const data = Buffer.from(body.dataBase64, 'base64');
      if (data.length === 0 || data.length > MAX_FRAME_BYTES) {
        sendApiError(res, 400, 'BAD_REQUEST', 'frame payload missing or too large');
        return;
      }
      const written = writePackFile(PROJECT_ROOT, packDir, body.path, data);
      if (!written) {
        sendApiError(res, 400, 'BAD_REQUEST', 'path must stay inside the pack');
        return;
      }
      res.json({ ok: true, path: written });
    },
  );
}
