// Living stage (G-UX change 1) — the gallery hero: a big animated canvas
// that greets on entry (wave ×2, then idle ping-pong at the pack's own
// fps), a speech bubble in the base character's voice, and the «Hazle
// sentir algo» emotion chips. Touching the character makes it react. All
// timing derives from pack.json values via the shared timeline helpers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../../i18n';
import { emotionFps, emotionPlayback } from '../pack/types';
import { getEngine } from '../engines/registry';
import type { LoadedEmotion } from '../engines/types';
import type { LoadedPack } from '../import/importPack';
import { buildTimeline, frameIndexAt } from '../playback/timeline';
import type { Cue } from '../gallery/reactive';
import {
  emotionPasses,
  POKE_EMOTIONS,
  pokeEmotionAt,
  STAGE_CHIP_ORDER,
  voiceForPack,
} from '../gallery/stage';
import type { EmotionLoader } from './useEmotionCache';
import styles from './characters.module.css';

function loaderFor(resolve: (src: string) => Promise<string>): EmotionLoader {
  const cache = new Map<string, Promise<LoadedEmotion>>();
  return (key, emotion) => {
    const engine = getEngine(emotion.engine);
    if (!engine) return null;
    let pending = cache.get(key);
    if (!pending) {
      pending = engine.loadEmotion(emotion, resolve);
      cache.set(key, pending);
    }
    return pending;
  };
}

interface Playing {
  key: string;
  startedAt: number;
  /** Forward passes before falling back to idle — Infinity for idle. */
  passes: number;
  /** True when the user asked for this emotion (chip tap or poke) — the
   *  entry greeting does not count as a user-touched emotion. */
  user: boolean;
}

interface Props {
  pack: LoadedPack;
  /** Fires when a user-touched emotion finishes its passes naturally —
   *  the «primer valor» hook the meta question (G-UX 2) attaches to. The
   *  entry wave and the idle fallback never fire it. */
  onEmotionEnd?: (key: string) => void;
  /** Chip order override — the goal answer (G-UX 2) moves its suggested
   *  emotions first. Defaults to the G-UX order. */
  chipOrder?: readonly string[];
  /** Chips rendered with the suggested highlight once a goal is chosen. */
  highlighted?: ReadonlySet<string>;
  /** External cue (meta question, goal reactions, G-UX 3 personality):
   *  `seq` must grow per event; each new cue may set a bubble line and/or
   *  play an emotion (never counted as a user-touched emotion). */
  cue?: Cue;
  /** Fires on every user interaction with the stage (chip tap, poke) so
   *  the owner can reset idle timers. */
  onInteract?: () => void;
}

export function StageHero({ pack, onEmotionEnd, chipOrder, highlighted, cue, onInteract }: Props) {
  const { t } = useI18n();
  const voice = voiceForPack(pack.manifest.id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef<Playing>({ key: 'wave', startedAt: 0, passes: 2, user: false });
  const loadedRef = useRef(new Map<string, LoadedEmotion>());
  const pendingRef = useRef(new Set<string>());
  const endedRef = useRef(false);
  const pokesRef = useRef(0);
  const onEmotionEndRef = useRef(onEmotionEnd);
  onEmotionEndRef.current = onEmotionEnd;
  const [current, setCurrent] = useState('wave');
  const [line, setLine] = useState('');

  const load = useMemo(() => loaderFor((src) => pack.resolve(src)), [pack]);
  const emotions = pack.manifest.emotions;

  const say = useCallback(
    (key: string, vars?: Record<string, string>) => {
      setLine(t(key as Parameters<typeof t>[0], vars));
    },
    [t],
  );

  const play = useCallback(
    (key: string, user = false) => {
      const emotion = emotions[key];
      if (!emotion) return;
      const passes =
        key === 'idle' ? Number.POSITIVE_INFINITY : emotionPasses(emotion, pack.manifest.defaults.playback);
      endedRef.current = false;
      playingRef.current = { key, startedAt: performance.now(), passes, user };
      setCurrent(key);
    },
    [emotions, pack.manifest.defaults.playback],
  );

  // Draw + advance loop: one rAF for the stage. Non-idle emotions count
  // forward passes on the shared timeline; when they run out the stage
  // falls back to idle ping-pong and reports the natural end.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const playing = playingRef.current;
      const emotion = emotions[playing.key];
      const engine = emotion ? getEngine(emotion.engine) : null;
      if (emotion && engine) {
        const cached = loadedRef.current.get(playing.key);
        if (!cached) {
          if (!pendingRef.current.has(playing.key)) {
            pendingRef.current.add(playing.key);
            void load(playing.key, emotion)
              ?.then((result) => {
                if (result) loadedRef.current.set(playing.key, result);
              })
              .catch(() => {})
              .finally(() => pendingRef.current.delete(playing.key));
          }
        } else {
          const elapsed = performance.now() - playing.startedAt;
          const fps = emotionFps(pack.manifest, emotion);
          const timeline = buildTimeline(emotion.frames, fps);
          if (elapsed >= timeline.total * playing.passes && playing.passes !== Number.POSITIVE_INFINITY) {
            if (!endedRef.current) {
              endedRef.current = true;
              if (playing.user) onEmotionEndRef.current?.(playing.key);
            }
            playingRef.current = { key: 'idle', startedAt: performance.now(), passes: Number.POSITIVE_INFINITY, user: false };
            setCurrent('idle');
          } else {
            const mode: 'loop' | 'pingpong' =
              playing.key === 'idle' ? (emotionPlayback(pack.manifest, emotion) === 'pingpong' ? 'pingpong' : 'loop') : 'loop';
            const index = frameIndexAt(timeline, mode, elapsed);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            engine.renderFrame(ctx, cached, index);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [emotions, load, pack.manifest]);

  // Entry + character switch: greet with the character's own hello while
  // waving twice, then idle.
  useEffect(() => {
    pokesRef.current = 0;
    loadedRef.current.clear();
    pendingRef.current.clear();
    play('wave');
    say(`characters.stage.hello.${voice}`);
  }, [pack.manifest.id, voice, play, say]);

  // External cue (meta question, goal reactions, reactive personality…):
  // each new `cue.seq` plays its emotion (non-user, so it never triggers
  // the meta hook) and/or replaces the bubble line. The next chip/poke
  // line takes over afterwards.
  const cueSeqRef = useRef(0);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;
  useEffect(() => {
    if (!cue || cue.seq === cueSeqRef.current) return;
    cueSeqRef.current = cue.seq;
    if (cue.emotion) play(cue.emotion, false);
    if (cue.line !== undefined) setLine(cue.line);
  }, [cue, play]);

  const chip = useCallback(
    (key: string) => {
      if (!emotions[key]) return;
      onInteractRef.current?.();
      play(key, true);
      say(`characters.stage.line.${voice}.${key}`);
    },
    [emotions, play, say, voice],
  );

  const poke = useCallback(() => {
    const index = pokesRef.current;
    pokesRef.current += 1;
    onInteractRef.current?.();
    play(pokeEmotionAt(index), true);
    say(`characters.stage.poke.${voice}.${index % POKE_EMOTIONS.length}`);
  }, [play, say, voice]);

  return (
    <div className={styles.stageHero} data-testid="characters-stage">
      <div className={styles.stageInner}>
        <div className={styles.bubble} aria-live="polite" data-testid="characters-bubble">
          <span className={styles.bubbleWho}>{pack.manifest.name}</span>
          <span data-testid="characters-bubble-text">{line}</span>
        </div>
        <div className={styles.stageShadow} />
        <canvas
          ref={canvasRef}
          className={styles.stageHeroCanvas}
          width={pack.manifest.canvas.w}
          height={pack.manifest.canvas.h}
          role="img"
          aria-label={t('characters.stage.canvasLabel', { name: pack.manifest.name })}
          onClick={poke}
          data-testid="characters-stage-canvas"
        />
      </div>
      <div className={styles.stageEmos}>
        <div className={styles.stageEmosLabel}>
          <span>{t('characters.stage.chipsLabel')}</span>
          <span data-testid="characters-emo-now">
            {t(`characters.stage.chip.${current}` as Parameters<typeof t>[0])}
          </span>
        </div>
        <div className={styles.stageChips} data-testid="characters-emo-chips">
          {(chipOrder ?? STAGE_CHIP_ORDER).filter((key) => emotions[key]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.stageChip} ${highlighted?.has(key) ? styles.stageChipSuggested : ''}`}
              aria-pressed={current === key}
              onClick={() => chip(key)}
              data-testid={`characters-emo-${key}`}
            >
              {t(`characters.stage.chip.${key}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
