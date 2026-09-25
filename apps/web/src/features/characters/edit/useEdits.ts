// React glue for EditsController — a version counter that bumps on every
// mutation so subscribers re-render, and a jobs poller shared by the panel.

import { useCallback, useEffect, useReducer, useState } from 'react';

import type { EditsController } from './editsStore';
import { daemonAvailable, listJobs } from '../jobs/api';
import type { RegenJob } from '../jobs/jobTypes';

const JOBS_POLL_MS = 2500;

/** Re-render whenever the edits controller notifies (mutations + hydrate). */
export function useEditsVersion(edits: EditsController | null): number {
  const [version, bump] = useReducer((v: number) => v + 1, 0);
  useEffect(() => edits?.subscribe(bump) ?? undefined, [edits]);
  return version;
}

/** Whether a real daemon answered /api/health (static hosts return HTML). */
export function useDaemonAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    void daemonAvailable().then((ok) => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

/** Job list for the panel: IndexedDB copy + daemon refresh + polling while
 *  anything is queued/running. */
export function useJobs(packId: string | null, daemon: boolean) {
  const [jobs, setJobs] = useState<RegenJob[]>([]);
  const refresh = useCallback(async () => {
    if (!packId) return;
    setJobs(await listJobs(packId).catch(() => [] as RegenJob[]));
  }, [packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!daemon) return;
    const timer = setInterval(() => {
      void refresh();
    }, JOBS_POLL_MS);
    return () => clearInterval(timer);
  }, [daemon, refresh]);

  return { jobs, refresh };
}
