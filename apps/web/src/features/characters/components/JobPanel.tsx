// Regeneration job panel — text instruction → queued/running/done/failed job.
// In daemon mode the request is POSTed to /api/character-packs and the runner
// materializes jobs/<id>/out/*.png; in static mode the request is stored
// locally and stays exportable as JSON. Finished jobs surface as proposals
// with accept/discard — nothing reaches the pack until accepted.

import { useCallback, useState } from 'react';

import { Button, Select } from '@open-design/components';

import { useI18n } from '../../../i18n';
import { Icon } from '../../../components/Icon';
import type { EditsController } from '../edit/editsStore';
import { applyVariantFrame } from '../edit/emotionEdit';
import {
  downloadJobRequest,
  enqueueJob,
  forgetJob,
  jobResultUrl,
} from '../jobs/api';
import type { RegenJob } from '../jobs/jobTypes';
import { useJobs } from '../edit/useEdits';
import styles from './characters.module.css';

interface Props {
  packId: string;
  packVersion: string;
  emotionKey: string;
  /** Current (edited) emotion — supplies master/neighbor references. */
  frameSrcs: string[];
  frameCount: number;
  selectedIndex: number;
  edits: EditsController;
  daemon: boolean;
}

/** Fetch the runner-produced file(s) and register each blob under the
 *  CANONICAL pack src it replaces (`emotion/NNN.png`), not the job workspace
 *  path — so "save to disk" writes a real pack file and the .zip export
 *  carries the canonical name. The resolver serves the registered blob until
 *  then, so the frame updates on screen immediately. */
async function acceptProposal(
  edits: EditsController,
  emotionKey: string,
  job: RegenJob,
  frameIndex: number | null,
): Promise<void> {
  const files = job.result?.frames ?? [];
  const blobs: Blob[] = [];
  for (const file of files) {
    const res = await fetch(jobResultUrl(job.packId, job.id, file));
    if (res.ok) blobs.push(await res.blob());
  }
  if (blobs.length === 0) return;
  const canonical = (index: number) =>
    `${emotionKey}/${String(index).padStart(3, '0')}.png`;
  edits.mutate(emotionKey, (emotion) => {
    if (frameIndex != null) {
      const src = canonical(frameIndex);
      edits.putExtraFile(src, blobs[0]!);
      return applyVariantFrame(emotion, frameIndex, {
        src,
        ms: emotion.frames[frameIndex]?.ms ?? null,
        origin: `regen:${job.id}`,
      });
    }
    const frames = emotion.frames.map((frame, index) => {
      const blob = blobs[index];
      if (!blob) return frame;
      const src = canonical(index);
      edits.putExtraFile(src, blob);
      return { ...frame, src, origin: `regen:${job.id}` };
    });
    return { ...emotion, frames };
  });
}

export function JobPanel({
  packId,
  packVersion,
  emotionKey,
  frameSrcs,
  frameCount,
  selectedIndex,
  edits,
  daemon,
}: Props) {
  const { t } = useI18n();
  const [instruction, setInstruction] = useState('');
  const [scope, setScope] = useState<'frame' | 'emotion'>('frame');
  const [busy, setBusy] = useState(false);
  const { jobs, refresh } = useJobs(packId, daemon);
  const [accepting, setAccepting] = useState<string | null>(null);

  const enqueue = useCallback(async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const frameIndex = scope === 'frame' ? selectedIndex : null;
      const master = frameIndex != null ? frameSrcs[frameIndex] ?? null : null;
      const neighbors = frameIndex != null
        ? [frameSrcs[frameIndex - 1], frameSrcs[frameIndex + 1]].filter(
            (s): s is string => Boolean(s),
          )
        : frameSrcs.slice(0, 3);
      await enqueueJob({
        packId,
        packVersion,
        emotion: emotionKey,
        frameIndex,
        instruction: text,
        master,
        neighbors,
      });
      setInstruction('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [instruction, busy, scope, selectedIndex, frameSrcs, packId, packVersion, emotionKey, refresh]);

  const accept = useCallback(
    async (job: RegenJob) => {
      setAccepting(job.id);
      try {
        await acceptProposal(edits, emotionKey, job, job.frameIndex);
      } finally {
        setAccepting(null);
      }
    },
    [edits, emotionKey],
  );

  const discard = useCallback(
    async (job: RegenJob) => {
      await forgetJob(job.id);
      await refresh();
    },
    [refresh],
  );

  return (
    <div className={styles.jobPanel} data-testid="jobs-panel">
      <div className={styles.editorSectionTitle}>
        <Icon name="sparkles" size={13} /> {t('characters.jobs.title')}
      </div>

      {!daemon ? (
        <p className={styles.staticNotice} data-testid="jobs-static-notice">
          {t('characters.jobs.staticNotice')}
        </p>
      ) : null}

      <div className={styles.jobForm}>
        <textarea
          className={styles.jobInstruction}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t('characters.jobs.instructionPlaceholder')}
          rows={2}
          data-testid="jobs-instruction"
        />
        <div className={styles.jobFormRow}>
          <Select
            value={scope}
            onChange={(event) => setScope(event.target.value as 'frame' | 'emotion')}
            aria-label={t('characters.jobs.scope')}
            data-testid="jobs-scope"
          >
            <option value="frame">
              {t('characters.jobs.scopeFrame', { index: selectedIndex + 1 })}
            </option>
            <option value="emotion">{t('characters.jobs.scopeEmotion')}</option>
          </Select>
          <Button
            variant="subtle"
            onClick={() => void enqueue()}
            disabled={busy || instruction.trim().length === 0}
            data-testid="jobs-enqueue"
          >
            <Icon name="send" size={13} /> {t('characters.jobs.enqueue')}
          </Button>
        </div>
      </div>

      <ul className={styles.jobList} data-testid="jobs-list">
        {jobs.length === 0 ? (
          <li className={styles.jobEmpty}>{t('characters.jobs.empty')}</li>
        ) : (
          jobs.map((job) => (
            <li key={job.id} className={styles.jobItem} data-testid={`job-${job.id}`}>
              <div className={styles.jobItemHead}>
                <span
                  className={`${styles.jobStatus} ${styles[`jobStatus_${job.status}`]}`}
                  data-testid={`job-${job.id}-status`}
                >
                  {t(`characters.jobs.status.${job.status}`)}
                  {job.needsLocalDaemon ? ` · ${t('characters.jobs.needsLocal')}` : ''}
                </span>
                <span className={styles.jobMeta}>
                  {job.emotion}
                  {job.frameIndex != null ? ` · #${job.frameIndex + 1}` : ''}
                </span>
                <span className={styles.jobItemActions}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadJobRequest(job)}
                    aria-label={t('characters.jobs.exportRequest')}
                    data-testid={`job-${job.id}-export`}
                  >
                    <Icon name="download" size={13} />
                  </Button>
                  {(job.status === 'done' || job.status === 'failed') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void discard(job)}
                      aria-label={t('characters.jobs.discard')}
                      data-testid={`job-${job.id}-discard`}
                    >
                      <Icon name="trash" size={13} />
                    </Button>
                  )}
                </span>
              </div>
              <p className={styles.jobText}>{job.instruction}</p>
              {job.error ? <p className={styles.jobError}>{job.error}</p> : null}
              {job.status === 'done' && (job.result?.frames?.length ?? 0) > 0 ? (
                <div className={styles.jobProposal} data-testid={`job-${job.id}-proposal`}>
                  <div className={styles.jobProposalFrames}>
                    {job.result!.frames.map((file) => (
                      <img
                        key={file}
                        src={jobResultUrl(job.packId, job.id, file)}
                        alt={file}
                        className={styles.jobProposalImg}
                      />
                    ))}
                  </div>
                  {job.result?.qc ? (
                    <p className={styles.jobQc}>{JSON.stringify(job.result.qc)}</p>
                  ) : null}
                  <div className={styles.jobProposalActions}>
                    <Button
                      variant="subtle"
                      onClick={() => void accept(job)}
                      disabled={accepting === job.id}
                      data-testid={`job-${job.id}-accept`}
                    >
                      <Icon name="check" size={13} /> {t('characters.jobs.accept')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void discard(job)}
                      data-testid={`job-${job.id}-reject`}
                    >
                      <Icon name="close" size={13} /> {t('characters.jobs.discardProposal')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
