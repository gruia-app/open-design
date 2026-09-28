// Emotion player — big canvas, transport controls, the editable frame strip
// (EmotionEditor) and exports. All timing comes from `usePlayback`; edit
// intents go through EditsController so they are undoable + persisted; this
// component only owns the draw surface and the control intents.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Select } from '@open-design/components';

import { useI18n } from '../../../i18n';
import { Icon } from '../../../components/Icon';
import {
  emotionFps,
  emotionPlayback,
  type CharacterEmotion,
  type CharacterPack,
  type PlaybackMode,
} from '../pack/types';
import { engineStatus, getEngine } from '../engines/registry';
import type { LoadedEmotion } from '../engines/types';
import type { LoadedPack } from '../import/importPack';
import type { EditsController } from '../edit/editsStore';
import { setEmotionFps, setEmotionPlayback } from '../edit/emotionEdit';
import { useDaemonAvailable } from '../edit/useEdits';
import { emotionLabel } from '../pack/labels';
import { savePackToDaemon } from '../jobs/api';
import { usePlayback } from '../playback/usePlayback';
import { frameDurationMs, MAX_FPS, MIN_FPS } from '../playback/timeline';
import { buildSpriteSheet, downloadBlob, downloadJson } from '../export/spritesheet';
import { buildAnimationExport, collectPlaybackFrames, type AnimFormat } from '../export/animated';
import { downloadEditedPackZip } from '../export/packZip';
import { recordExport } from '../gallery/metrics';
import type { EmotionLoader } from './useEmotionCache';
import { FrameStrip } from './FrameStrip';
import { EmotionEditor } from './EmotionEditor';
import styles from './characters.module.css';

interface Props {
  /** Effective (edited) manifest — playback defaults read from it. */
  pack: CharacterPack;
  /** The pack as loaded (bytes + resolver) — pack-zip export needs it. */
  loadedPack: LoadedPack;
  emotionKey: string;
  /** Edited emotion (edits.emotionFor). */
  emotion: CharacterEmotion;
  /** Pristine emotion for the before/after compare. */
  baseline: CharacterEmotion;
  edits: EditsController;
  load: EmotionLoader;
  onBack: () => void;
}

const FPS_OPTIONS = Array.from(
  { length: MAX_FPS - MIN_FPS + 1 },
  (_, i) => MIN_FPS + i,
);

const MODES: PlaybackMode[] = ['loop', 'pingpong', 'once'];
const ANIM_FORMATS: AnimFormat[] = ['gif', 'apng', 'webp'];

export function EmotionPlayer({
  pack,
  loadedPack,
  emotionKey,
  emotion,
  baseline,
  edits,
  load,
  onBack,
}: Props) {
  const { t } = useI18n();
  const status = engineStatus(emotion.engine);
  const engine = getEngine(emotion.engine);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<LoadedEmotion | null>(null);
  const [baselineLoaded, setBaselineLoaded] = useState<LoadedEmotion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onionSkin, setOnionSkin] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const daemon = useDaemonAvailable();

  // FPS + playback mode are manifest fields — they edit through the
  // controller so they persist and export with the pack.
  const fps = Math.round(emotionFps(pack, emotion));
  const mode = emotionPlayback(pack, emotion);
  const displayLabel = emotionLabel(t, emotionKey, emotion.label);

  const { playing, frameIndex, timeline, pause, toggle, step, seekToFrame } = usePlayback(
    emotion.frames,
    fps,
    mode,
  );

  useEffect(() => {
    if (status !== 'ready') return;
    let alive = true;
    setLoadError(null);
    const pending = load(emotionKey, emotion);
    if (!pending) {
      setLoadError(t('characters.engine.unavailable', { id: emotion.engine }));
      return;
    }
    pending
      .then((result) => {
        if (alive) setLoaded(result);
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, [status, load, emotionKey, emotion, t]);

  // Baseline decode for the before/after compare — lazily, on first toggle.
  useEffect(() => {
    if (!comparing || baselineLoaded || status !== 'ready') return;
    let alive = true;
    void load(`${emotionKey}@baseline`, baseline)?.then((result) => {
      if (alive) setBaselineLoaded(result);
    });
    return () => {
      alive = false;
    };
  }, [comparing, baselineLoaded, baseline, emotionKey, load, status]);

  // Draw the current frame (plus the onion-skin ghost) — or the baseline
  // frame when the compare toggle is on.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !engine) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (comparing) {
      if (baselineLoaded) {
        const index = Math.min(frameIndex, baselineLoaded.frameCount - 1);
        engine.renderFrame(ctx, baselineLoaded, index);
      }
      return;
    }
    if (!loaded) return;
    engine.renderFrame(ctx, loaded, frameIndex, {
      ghostIndex: onionSkin ? frameIndex - 1 : undefined,
      ghostAlpha: 0.3,
    });
  }, [engine, loaded, baselineLoaded, frameIndex, onionSkin, comparing]);

  // Keyboard transport: ←/→ step, Space toggles play. Skipped while typing in
  // a form control so the FPS select keeps its own arrow keys.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, toggle]);

  const selectFrame = useCallback(
    (index: number) => {
      pause();
      seekToFrame(index);
      setSelectedIndex(index);
    },
    [pause, seekToFrame],
  );

  const exportSheet = useCallback(async () => {
    if (!engine || !loaded || exporting) return;
    setExporting('sheet');
    try {
      const frames = emotion.frames.map((frame, index) => ({
        image: engine.frameImage?.(loaded, index),
        durationMs: frameDurationMs(frame, fps),
      }));
      if (frames.some((frame) => !frame.image)) {
        throw new Error(t('characters.player.exportNoBitmap'));
      }
      const sheet = await buildSpriteSheet({
        pack,
        emotionKey,
        playback: mode,
        frames: frames as Array<{ image: CanvasImageSource; durationMs: number }>,
      });
      downloadBlob(sheet.pngFileName, sheet.pngBlob);
      downloadJson(sheet.jsonFileName, sheet.json);
      recordExport(pack.id);
    } finally {
      setExporting(null);
    }
  }, [engine, loaded, exporting, emotion.frames, fps, pack, emotionKey, mode, t]);

  const exportAnim = useCallback(
    async (format: AnimFormat) => {
      if (!engine || !loaded || exporting) return;
      setExporting(format);
      try {
        const durations = emotion.frames.map((frame) => frameDurationMs(frame, fps));
        const frames = collectPlaybackFrames(
          engine,
          loaded,
          durations,
          pack.canvas.w,
          pack.canvas.h,
          mode,
        );
        const result = await buildAnimationExport(format, pack, emotionKey, frames);
        downloadBlob(result.fileName, result.blob);
        recordExport(pack.id, format);
      } finally {
        setExporting(null);
      }
    },
    [engine, loaded, exporting, emotion.frames, fps, pack, emotionKey, mode],
  );

  const exportPackZip = useCallback(async () => {
    if (exporting) return;
    setExporting('zip');
    try {
      await downloadEditedPackZip(loadedPack, edits);
      recordExport(pack.id, 'pack');
    } finally {
      setExporting(null);
    }
  }, [exporting, loadedPack, edits, pack.id]);

  const saveToDisk = useCallback(async () => {
    setSaveMsg(null);
    try {
      await savePackToDaemon(pack.id, edits.manifestWithEdits(), edits.extraFiles());
      setSaveMsg(t('characters.player.savedToDisk'));
    } catch (error) {
      setSaveMsg(error instanceof Error ? error.message : String(error));
    }
  }, [pack.id, edits, t]);

  if (status !== 'ready' || !engine) {
    return (
      <div className={styles.player} data-testid="characters-player">
        <div className={styles.playerTop}>
          <div className={styles.playerTitle}>
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('characters.player.back')}>
              <Icon name="arrow-left" size={16} />
            </Button>
            <h2>{displayLabel}</h2>
            <span>{emotionKey}</span>
          </div>
        </div>
        <div className={styles.comingSoonBox} data-testid="characters-engine-coming-soon">
          <strong>{t('characters.engine.comingSoon')}</strong>
          <span>
            {t('characters.engine.comingSoonBody', { id: emotion.engine })}
          </span>
        </div>
      </div>
    );
  }

  const frameCount = emotion.frames.length;

  return (
    <div className={styles.player} data-testid="characters-player">
      <div className={styles.playerTop}>
        <div className={styles.playerTitle}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={t('characters.player.back')}
            data-testid="characters-back"
          >
            <Icon name="arrow-left" size={16} />
          </Button>
          <h2>{displayLabel}</h2>
          <span>{emotionKey}</span>
        </div>
        <div className={styles.controlsGroup}>
          <Button
            variant="subtle"
            onClick={() => void exportSheet()}
            disabled={!loaded || exporting != null}
            data-testid="characters-export-sheet"
          >
            <Icon name="image" size={14} /> {t('characters.player.exportSheet')}
          </Button>
          {ANIM_FORMATS.map((format) => (
            <Button
              key={format}
              variant="subtle"
              onClick={() => void exportAnim(format)}
              disabled={!loaded || exporting != null}
              data-testid={`characters-export-${format}`}
            >
              <Icon name="image" size={14} /> {t(`characters.player.exportAnim.${format}`)}
            </Button>
          ))}
          <Button
            variant="subtle"
            onClick={() => void exportPackZip()}
            disabled={exporting != null}
            data-testid="characters-export-zip"
          >
            <Icon name="download" size={14} /> {t('characters.player.exportZip')}
          </Button>
          {daemon ? (
            <Button
              variant="subtle"
              onClick={() => void saveToDisk()}
              disabled={!edits.anyDirty()}
              data-testid="characters-save-disk"
            >
              <Icon name="inbox-archive" size={14} /> {t('characters.player.saveToDisk')}
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? <div className={styles.errorBox}><h3>{t('characters.error.title')}</h3><ul><li>{loadError}</li></ul></div> : null}
      {saveMsg ? <div className={styles.notice} data-testid="characters-save-msg">{saveMsg}</div> : null}

      <div className={styles.stage}>
        <div className={`${styles.stageCanvas} ${styles.checker}`}>
          <canvas
            ref={canvasRef}
            width={pack.canvas.w}
            height={pack.canvas.h}
            data-testid="characters-canvas"
            aria-label={displayLabel}
          />
          {comparing ? (
            <span className={styles.compareBadge} data-testid="compare-badge">
              {t('characters.editor.compareBadge')}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlsGroup}>
          <Button
            variant="subtle"
            size="icon"
            onClick={toggle}
            aria-label={playing ? t('characters.player.pause') : t('characters.player.play')}
            data-testid="characters-play-pause"
          >
            <Icon name={playing ? 'stop' : 'play'} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step(-1)}
            aria-label={t('characters.player.stepBack')}
            data-testid="characters-step-prev"
          >
            <Icon name="chevron-left" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step(1)}
            aria-label={t('characters.player.stepForward')}
            data-testid="characters-step-next"
          >
            <Icon name="chevron-right" size={14} />
          </Button>
          <span className={styles.frameIndicator} data-testid="characters-frame-indicator">
            {frameIndex + 1}/{frameCount}
          </span>
        </div>

        <span className={styles.controlsDivider} />

        <label className={styles.fpsControl}>
          {t('characters.player.fps')}
          <Select
            value={String(fps)}
            onChange={(event) =>
              edits.mutate(emotionKey, (e) => setEmotionFps(e, Number(event.target.value)))
            }
            data-testid="characters-fps"
            aria-label={t('characters.player.fps')}
          >
            {FPS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </label>

        <div className={styles.segmented} role="group" aria-label={t('characters.player.playbackMode')}>
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => edits.mutate(emotionKey, (e) => setEmotionPlayback(e, option))}
              data-testid={`characters-mode-${option}`}
            >
              {t(`characters.player.${option}`)}
            </button>
          ))}
        </div>

        <label className={styles.onionToggle}>
          <input
            type="checkbox"
            checked={onionSkin}
            onChange={(event) => setOnionSkin(event.target.checked)}
            data-testid="characters-onion-skin"
          />
          {t('characters.player.onionSkin')}
        </label>
      </div>

      <EmotionEditor
        pack={pack}
        emotionKey={emotionKey}
        emotion={emotion}
        edits={edits}
        engine={engine}
        loaded={loaded}
        selectedIndex={selectedIndex}
        onSelectFrame={selectFrame}
        daemon={daemon}
        comparing={comparing}
        onToggleCompare={() => setComparing((v) => !v)}
      />

      <FrameStrip
        engine={engine}
        loaded={loaded}
        frameCount={frameCount}
        activeIndex={frameIndex}
        canvas={pack.canvas}
        onSeek={seekToFrame}
      />

      <div className={styles.packMeta}>
        <span>
          <span className={styles.kbd}>←</span> <span className={styles.kbd}>→</span>{' '}
          {t('characters.player.stepHint')}
        </span>
        <span>
          <span className={styles.kbd}>{t('characters.player.spaceKey')}</span>{' '}
          {t('characters.player.playHint')}
        </span>
      </div>
    </div>
  );
}
