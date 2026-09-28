// F4 gallery — the revid-style entry surface for Personajes. One input
// (phrase or image) plus «Generar»; below, animated starter cards for the
// characters that already work («Parte de uno que ya funciona»). Generating
// derives a pack v1.1 from the selected base (emotions subset + frame count
// + style/engine/background options) and stores it in IndexedDB; each result
// card carries its own like + note and can be opened for review — which is
// where the frame editor lives, so the editor only appears after the first
// result.

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, Select } from '@open-design/components';

import { useI18n } from '../../../i18n';
import { Icon } from '../../../components/Icon';
import { navigate } from '../../../router';
import {
  IMPLEMENTED_ENGINE_IDS,
  RESERVED_ENGINE_IDS,
  type CharacterEmotion,
  type PackMeta,
} from '../pack/types';
import { emotionLabel } from '../pack/labels';
import { getEngine } from '../engines/registry';
import type { LoadedEmotion } from '../engines/types';
import type { LoadedPack } from '../import/importPack';
import { loadBundledPack } from '../samplePacks';
import type { BundledPackOption } from '../samplePacks';
import { loadResults, removeResult, saveResult } from '../edit/editsDb';
import {
  DEFAULT_GENERATION_OPTIONS,
  deriveResultManifest,
  newResultId,
  type GenerationOptions,
  type GenerationResult,
} from '../gallery/types';
import { EXPORTS_EVENT, exportCount, recordExport } from '../gallery/metrics';
import { buildAnimationExport, collectPlaybackFrames } from '../export/animated';
import { buildBrandedGif } from '../export/branded';
import { buildSpriteSheet, downloadBlob, downloadJson } from '../export/spritesheet';
import { buildTimeline, frameDurationMs } from '../playback/timeline';
import { emotionFps, emotionPlayback } from '../pack/types';
import { chipOrderFor, GOAL_IDS, GOAL_PLAN, suggestedFor, type GoalId } from '../gallery/goalPlan';
import { nudgeAllowed, nudgeDelayAt, TYPING_CUE_DELAY_MS, type Cue } from '../gallery/reactive';
import { voiceForPack } from '../gallery/stage';
import type { EmotionLoader } from './useEmotionCache';
import { AnimatedThumb } from './AnimatedThumb';
import { StageHero } from './StageHero';
import styles from './characters.module.css';

/** Starters are the two shipped characters — pixel-demo stays in the header
 *  picker only. */
const STARTER_IDS = ['gruia-grulla', 'contenido-tinta'];

const BACKGROUNDS = ['transparent', 'white', 'magenta'] as const;

/** r150/G-UX-2 meta question — asked once per project, always skippable,
 *  and now asked by the character on the stage right after the first
 *  user-touched emotion ends. The flag lives in localStorage ('1' settled,
 *  'deferred' after «Ahora no» so the inactivity nudge can re-ask once);
 *  the goal itself persists beside it so pre-generation personalization
 *  (chips, placeholder, plan) survives reloads and lands on every result. */
const META_DONE_KEY = 'od-personajes.meta-asked.v1';
const META_GOAL_KEY = 'od-personajes.meta-goal.v1';
const META_GOALS = GOAL_IDS;
type MetaGoal = GoalId;

function metaStateBefore(): 'settled' | 'deferred' | 'fresh' {
  try {
    const v = localStorage.getItem(META_DONE_KEY);
    return v === '1' ? 'settled' : v === 'deferred' ? 'deferred' : 'fresh';
  } catch {
    return 'settled';
  }
}

function markMetaAsked(value: '1' | 'deferred'): void {
  try {
    localStorage.setItem(META_DONE_KEY, value);
  } catch {
    // best-effort
  }
}

interface StoredGoal {
  goal: MetaGoal;
  detail?: string;
}

function storedGoalBefore(): StoredGoal | null {
  try {
    const raw = localStorage.getItem(META_GOAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGoal;
    return META_GOALS.includes(parsed.goal) ? parsed : null;
  } catch {
    return null;
  }
}

function storeGoal(stored: StoredGoal): void {
  try {
    localStorage.setItem(META_GOAL_KEY, JSON.stringify(stored));
  } catch {
    // best-effort
  }
}

/** EmotionLoader over an arbitrary resolve function — gallery cards load
 *  base and derived manifests alike. */
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

function previewEmotion(emotions: Record<string, CharacterEmotion>): [string, CharacterEmotion] {
  const entry = emotions.idle ? ['idle', emotions.idle] : Object.entries(emotions)[0];
  return entry as [string, CharacterEmotion];
}

interface Props {
  catalogue: BundledPackOption[];
  onOpenPack: (pack: LoadedPack) => void;
  /** Public trial mode (G-UX 8A): the stage, meta question and reactive
   *  personality all run; «Dale vida» opens the sign-up wall instead of
   *  generating, and only the watermarked GIF download stays free. */
  trial?: boolean;
}

export function CharacterGallery({ catalogue, onOpenPack, trial = false }: Props) {
  const { t } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [bases, setBases] = useState<Map<string, LoadedPack>>(new Map());
  const [baseId, setBaseId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_GENERATION_OPTIONS);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [busy, setBusy] = useState(false);
  // Meta question phases: 'idle' no card, 'ask' the five-goal card, 'plan'
  // the «Te preparo estas emociones» card. 'deferred' («Ahora no») keeps
  // the card hidden and holds the one re-ask for the inactivity nudge.
  const [metaStatus, setMetaStatus] = useState(metaStateBefore);
  const [metaPhase, setMetaPhase] = useState<'idle' | 'ask' | 'plan'>(() =>
    metaStateBefore() === 'settled' && storedGoalBefore() ? 'plan' : 'idle',
  );
  const [storedGoal, setStoredGoal] = useState<StoredGoal | null>(storedGoalBefore);
  const [metaGoal, setMetaGoal] = useState<MetaGoal | null>(null);
  const [metaOther, setMetaOther] = useState('');
  const [wallOpen, setWallOpen] = useState(false);
  const [gifBusy, setGifBusy] = useState(false);

  // G-UX 3 reactive personality — every external stage line/emotion goes
  // through `cue`: a monotonically increasing seq makes each event land
  // once (typing cue, generation progress, reactions, inactivity nudges).
  const [cue, setCue] = useState<Cue | undefined>(undefined);
  const cueSeq = useRef(0);
  const react = useCallback((line?: string, emotion?: string) => {
    cueSeq.current += 1;
    setCue({
      seq: cueSeq.current,
      ...(emotion ? { emotion } : {}),
      ...(line !== undefined ? { line } : {}),
    });
  }, []);

  // Idle bookkeeping for the three inactivity nudges: any user activity
  // bumps `activity`, which restarts the current countdown.
  const [activity, setActivity] = useState(0);
  const touch = useCallback(() => setActivity((n) => n + 1), []);
  const nudgesRef = useRef(0);
  const focusedRef = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const resultsRef = useRef(results.length);
  resultsRef.current = results.length;
  const metaPhaseRef = useRef(metaPhase);
  metaPhaseRef.current = metaPhase;
  const metaStatusRef = useRef(metaStatus);
  metaStatusRef.current = metaStatus;
  const voiceRef = useRef<'gui' | 'tinta'>('gui');
  const tRef = useRef(t);
  tRef.current = t;
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const starters = catalogue.filter(
    (option) => option.available && STARTER_IDS.includes(option.id),
  );

  // Load the starter packs once so their cards animate and the manifest is
  // ready for derivation.
  useEffect(() => {
    let alive = true;
    void Promise.all(
      starters.map(async (starter) => {
        try {
          const pack = await loadBundledPack(starter.id);
          if (alive) setBases((prev) => new Map(prev).set(starter.id, pack));
        } catch {
          // Starter stays out of the picker when its pack cannot load.
        }
      }),
    );
    return () => {
      alive = false;
    };
  }, [catalogue]); // eslint-disable-line react-hooks/exhaustive-deps -- starters derive from it

  useEffect(() => {
    // The public trial surface never shows a visitor's saved results —
    // it has no session and «guardar» is exactly what the wall asks for.
    if (trial) return;
    let alive = true;
    void loadResults().then((stored) => {
      if (alive) setResults(stored);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [trial]);

  const effectiveBaseId = baseId || starters[0]?.id || '';
  const basePack = bases.get(effectiveBaseId) ?? null;
  const baseEmotionKeys = basePack ? Object.keys(basePack.manifest.emotions) : [];
  // G-UX 4: «Dale vida» wakes up with three characters — or an attached
  // reference drawing.
  const canGenerate = Boolean(basePack && (prompt.trim().length >= 3 || image)) && !busy;
  const voice = basePack ? voiceForPack(basePack.manifest.id) : 'gui';
  voiceRef.current = voice;

  // G-UX 3 «Dale vida» reaction: the character goes thinking, calls out
  // «¡Manos a la obra!» and narrates three origami steps while the result
  // is derived. The reveal waits for the short personality window (~2.4s)
  // so the steps actually land.
  const GENERATE_MIN_MS = 2400;
  const PROGRESS_STEP_MS = 750;
  const generate = useCallback(async () => {
    const base = bases.get(effectiveBaseId);
    if (!base || (!prompt.trim() && !image)) return;
    // G-UX 8A: on the public trial route «Generar» costs an account — the
    // wall offers sign-up plus the watermarked GIF as the free takeaway.
    if (trial) {
      touch();
      setWallOpen(true);
      return;
    }
    setBusy(true);
    touch();
    react(t(`characters.react.generate.${voice}`), 'thinking');
    const startedAt = Date.now();
    progressTimers.current = [1, 2, 3].map((step) =>
      setTimeout(
        () => react(t(`characters.react.progress.${step}` as Parameters<typeof t>[0])),
        step * PROGRESS_STEP_MS,
      ),
    );
    try {
      const id = newResultId();
      const text = prompt.trim() || image?.name || id;
      const meta: PackMeta | undefined = storedGoal
        ? { goal: storedGoal.goal, ...(storedGoal.detail ? { detail: storedGoal.detail } : {}) }
        : undefined;
      const result: GenerationResult = {
        id,
        createdAt: Date.now(),
        prompt: text,
        image: image ?? undefined,
        imageName: image?.name,
        basePackId: effectiveBaseId,
        baseLabel: base.manifest.name,
        options,
        ...(meta ? { meta } : {}),
        manifest: { ...deriveResultManifest(base.manifest, options, text, id), ...(meta ? { meta } : {}) },
      };
      await saveResult(result);
      const wait = GENERATE_MIN_MS - (Date.now() - startedAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      progressTimers.current.forEach(clearTimeout);
      progressTimers.current = [];
      setResults((prev) => [result, ...prev]);
      setPrompt('');
      setImage(null);
      react(t(`characters.react.result.${voice}`), 'triumph');
    } finally {
      progressTimers.current.forEach(clearTimeout);
      progressTimers.current = [];
      setBusy(false);
    }
  }, [bases, effectiveBaseId, prompt, image, options, storedGoal, t, voice, react, touch, trial]);

  // G-UX 8A: the wall's free path — the current character rendered as a
  // GIF with the discreet «hecho con gruia» mark, from the goal's
  // recommended emotion (or «wave»/first available). Fully local.
  const downloadBrandedGif = useCallback(async () => {
    if (!basePack || gifBusy) return;
    setGifBusy(true);
    try {
      const manifest = basePack.manifest;
      const planned = storedGoal ? GOAL_PLAN[storedGoal.goal] : [];
      const emotionKey =
        planned.find((k) => manifest.emotions[k] !== undefined)
        ?? (manifest.emotions.wave ? 'wave' : Object.keys(manifest.emotions)[0])
        ?? '';
      const emotion = manifest.emotions[emotionKey];
      const engine = emotion ? getEngine(emotion.engine) : undefined;
      if (!engine || !emotion) return;
      const loaded = await loaderFor((src) => basePack.resolve(src))(emotionKey, emotion);
      if (!loaded) return;
      const out = buildBrandedGif(
        engine, manifest, emotionKey, emotion, loaded, emotionPlayback(manifest, emotion),
      );
      downloadBlob(out.fileName, out.blob);
      recordExport(manifest.id, 'gif');
    } finally {
      setGifBusy(false);
    }
  }, [basePack, storedGoal, gifBusy]);

  const updateResult = useCallback((next: GenerationResult) => {
    setResults((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    void saveResult(next).catch(() => {});
  }, []);

  const discardResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
    void removeResult(id).catch(() => {});
  }, []);

  // G-UX 2 meta: the character asks when the first user-touched emotion
  // ends. The answer personalizes the stage chips, the composer
  // placeholder and the plan card, persists as the stored goal and lands
  // on the newest result (and its manifest) so every export carries it.
  const askMeta = useCallback(() => {
    if (metaStatus !== 'fresh' || metaPhase !== 'idle') return;
    setMetaPhase('ask');
    react(t(`characters.goalask.question.${voice}`));
  }, [metaStatus, metaPhase, t, voice, react]);

  const answerMeta = useCallback(
    (goal: MetaGoal, detail: string) => {
      const stored: StoredGoal = { goal, ...(detail.trim() ? { detail: detail.trim() } : {}) };
      setStoredGoal(stored);
      storeGoal(stored);
      const target = results[0];
      if (target) {
        const meta: PackMeta = { ...stored };
        updateResult({
          ...target,
          meta,
          manifest: { ...target.manifest, meta },
        });
      }
      setMetaStatus('settled');
      markMetaAsked('1');
      setMetaPhase('plan');
      react(t(`characters.goalask.line.${voice}.${goal}` as Parameters<typeof t>[0]), 'joy');
      touch();
    },
    [results, updateResult, t, voice, react, touch],
  );

  const deferMeta = useCallback(() => {
    // First «Ahora no» holds one re-ask for the inactivity nudge; a second
    // one (after the re-ask already ran) settles the question for good.
    if (metaStatus === 'fresh') {
      setMetaStatus('deferred');
      markMetaAsked('deferred');
    } else {
      setMetaStatus('settled');
      markMetaAsked('1');
    }
    setMetaPhase('idle');
    react(t(`characters.goalask.skipped.${voice}`), 'sad');
    touch();
  }, [metaStatus, t, voice, react, touch]);

  const changeGoal = useCallback(() => {
    setMetaPhase('ask');
    react(t(`characters.goalask.changing.${voice}`), 'thinking');
    touch();
  }, [t, voice, react, touch]);

  const openResult = useCallback(
    async (result: GenerationResult) => {
      // Frame bytes live in the base pack — resolve through it so the derived
      // manifest needs no blob copies.
      let base = bases.get(result.basePackId) ?? null;
      if (!base) {
        try {
          base = await loadBundledPack(result.basePackId);
        } catch {
          return;
        }
      }
      onOpenPack({
        manifest: result.manifest,
        origin: 'generated',
        sourceLabel: result.baseLabel,
        version: `gen-${result.id}`,
        warnings: [],
        resolve: (src) => base!.resolve(src),
        readFile: base.readFile ? (src) => base!.readFile!(src) : undefined,
        dispose: () => {},
      });
    },
    [bases, onOpenPack],
  );

  // «Exportar para tu app» — open the result straight into the player, where
  // every export button (sheet/JSON, GIF, APNG, WebP, pack zip) lives.
  const openResultExports = useCallback(
    async (result: GenerationResult) => {
      await openResult(result);
      const [key] = previewEmotion(result.manifest.emotions);
      navigate({ kind: 'home', view: 'characters', emotionId: key });
    },
    [openResult],
  );

  const toggleEmotion = useCallback((key: string) => {
    setOptions((prev) => ({
      ...prev,
      emotions: prev.emotions.includes(key)
        ? prev.emotions.filter((k) => k !== key)
        : [...prev.emotions, key],
    }));
  }, []);

  // G-UX 3 typing cue: three or more characters and a 0.7s pause make the
  // character think along — «Mmm… "{texto}". Me gusta por dónde vas.»
  const onPromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      touch();
      if (typingTimer.current) clearTimeout(typingTimer.current);
      const text = value.trim();
      if (text.length >= 3) {
        typingTimer.current = setTimeout(() => {
          if (!busyRef.current) {
            react(t(`characters.react.typing.${voice}`, { text: text.slice(0, 60) }), 'thinking');
          }
        }, TYPING_CUE_DELAY_MS);
      }
    },
    [t, voice, react, touch],
  );

  // G-UX 3 inactivity nudges: up to three. Any activity restarts the
  // current countdown; they never fire while the field is focused, while
  // a generation runs, while the meta question is up or once a result
  // exists. The first nudge doubles as the deferred meta re-ask.
  useEffect(() => {
    const delay = nudgeDelayAt(nudgesRef.current);
    if (delay == null || resultsRef.current > 0) return undefined;
    const timer = setTimeout(() => {
      const gate = {
        hasResults: resultsRef.current > 0,
        inputFocused: focusedRef.current,
        generating: busyRef.current,
      };
      if (!nudgeAllowed(nudgesRef.current, gate) || metaPhaseRef.current === 'ask') {
        touch(); // defer — the full countdown restarts on the next idle window
        return;
      }
      nudgesRef.current += 1;
      const index = nudgesRef.current;
      const v = voiceRef.current;
      const tt = tRef.current;
      if (metaStatusRef.current === 'deferred' && index === 1) {
        setMetaStatus('settled');
        markMetaAsked('1');
        setMetaPhase('ask');
        react(tt(`characters.goalask.reask.${v}`), 'nudge');
      } else {
        react(tt(`characters.react.nudge.${v}.${index}` as Parameters<typeof tt>[0]), 'nudge');
      }
      touch();
    }, delay);
    return () => clearTimeout(timer);
  }, [activity, touch, react]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      progressTimers.current.forEach(clearTimeout);
    },
    [],
  );

  // G-UX 4: the field grows with the draft (up to ~4 lines).
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [prompt]);

  // The fixed «Crear el mío» CTA only shows while the composer is off-viewport:
  // scrolling to something already visible gains nothing (U7-delta1).
  const [composerVisible, setComposerVisible] = useState(true);
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof IntersectionObserver !== 'function') {
      setComposerVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setComposerVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Mobile CTA / «+ Crear el tuyo»: jump to the composer and focus it.
  const scrollToComposer = useCallback(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    composerRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => promptRef.current?.focus({ preventScroll: true }), reduced ? 0 : 350);
  }, []);

  // Goal plan CTA: same jump plus a brief composer highlight. The highlight is
  // a static ring under prefers-reduced-motion and a pulse otherwise (CSS).
  const [composerFlashing, setComposerFlashing] = useState(false);
  const flashComposer = useCallback(() => {
    scrollToComposer();
    setComposerFlashing(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setComposerFlashing(false);
      flashTimer.current = null;
    }, 1600);
  }, [scrollToComposer]);

  const fillExample = useCallback(
    (value: string) => {
      onPromptChange(value);
      promptRef.current?.focus();
    },
    [onPromptChange],
  );

  const examplePrefix = storedGoal ? `characters.composer.ex.${storedGoal.goal}` : 'characters.composer.ex.default';

  return (
    <div className={styles.gallery} data-testid="characters-gallery">
      {basePack ? (
        <div className={styles.stageRow}>
          <StageHero
            pack={basePack}
            onEmotionEnd={askMeta}
            chipOrder={chipOrderFor(storedGoal?.goal ?? null)}
            highlighted={suggestedFor(storedGoal?.goal ?? null)}
            cue={cue}
            onInteract={touch}
          />
          {metaPhase !== 'idle' ? (
            <GoalCard
              phase={metaPhase}
              stored={storedGoal}
              selected={metaGoal}
              voice={voice}
              other={metaOther}
              onSelect={(goal) => {
                setMetaGoal(goal);
                if (goal !== 'other') answerMeta(goal, '');
              }}
              onOther={setMetaOther}
              onConfirm={() => answerMeta('other', metaOther)}
              onSkip={deferMeta}
              onChange={changeGoal}
              onCreate={flashComposer}
            />
          ) : null}
        </div>
      ) : null}
      {/* G-UX 6: compact cast — round avatars under the stage. Picking one
          switches the stage character and opens its detail view; «+ Crear
          el tuyo» jumps to the composer. */}
      {basePack ? (
        <div className={styles.castRow} data-testid="characters-cast">
          <span className={styles.castLabel}>{t('characters.cast.label')}</span>
          {starters.map((starter) => {
            const pack = bases.get(starter.id);
            if (!pack) return null;
            return (
              <CastButton
                key={starter.id}
                pack={pack}
                selected={effectiveBaseId === starter.id}
                onSelect={() => {
                  setBaseId(starter.id);
                  onOpenPack(pack);
                  touch();
                }}
              />
            );
          })}
          <button
            type="button"
            className={styles.castNew}
            onClick={scrollToComposer}
            data-testid="characters-cast-new"
          >
            {t('characters.cast.new')}
          </button>
        </div>
      ) : null}

      {/* G-UX 4: the composer — label, two-line field that grows, «Imagen»
          attach with text, «Dale vida» CTA, examples and the help line. */}
      <div
        className={`${styles.composer} ${composerFlashing ? styles.composerFlash : ''}`}
        ref={composerRef}
        data-testid="characters-composer"
      >
        <label className={styles.composerLabel} htmlFor="characters-generate-input">
          {t('characters.composer.label')}
        </label>
        <div className={styles.generateRow}>
          <textarea
            ref={promptRef}
            id="characters-generate-input"
            className={styles.generateInput}
            rows={2}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={() => {
              focusedRef.current = false;
              touch();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (canGenerate) void generate();
              }
            }}
            placeholder={
              storedGoal
                ? t(`characters.goalask.placeholder.${storedGoal.goal}` as Parameters<typeof t>[0])
                : t('characters.gallery.promptPlaceholder')
            }
            data-testid="characters-generate-input"
          />
          <div className={styles.generateActions}>
            <Button
              variant="subtle"
              onClick={() => imageInputRef.current?.click()}
              aria-label={t('characters.gallery.attachImage')}
              data-testid="characters-generate-attach"
            >
              <Icon name="image" size={14} /> {t('characters.composer.attach')}
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setImage(event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
            {image ? (
              <span className={styles.imageChip} data-testid="characters-generate-image">
                {image.name}
                <button type="button" onClick={() => setImage(null)} aria-label={t('characters.gallery.removeImage')}>
                  ×
                </button>
              </span>
            ) : null}
            <Button
              variant="primary"
              onClick={() => void generate()}
              disabled={!canGenerate}
              data-testid="characters-generate"
            >
              <Icon name="sparkles" size={14} /> {t('characters.composer.cta')}
            </Button>
          </div>
        </div>
        <div className={styles.composerTry} data-testid="characters-try">
          <span>{t('characters.composer.try')}</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={styles.composerExample}
              onClick={() =>
                fillExample(t(`${examplePrefix}.${n}` as Parameters<typeof t>[0]))
              }
              data-testid={`characters-try-${n}`}
            >
              {t(`${examplePrefix}.${n}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
        <p className={styles.composerHint} data-testid="characters-composer-hint">
          {storedGoal ? t('characters.composer.hint.goal') : t('characters.composer.hint.default')}
        </p>
      </div>
      {!composerVisible ? (
        <button
          type="button"
          className={styles.mobileCta}
          onClick={scrollToComposer}
          data-testid="characters-mobile-cta"
        >
          {t('characters.composer.mobileCta')}
        </button>
      ) : null}

      <details className={styles.advanced} data-testid="characters-advanced">
        <summary>{t('characters.gallery.advanced')}</summary>
        <p className={styles.advancedHint}>{t('characters.gallery.advancedHint')}</p>
        <div className={styles.advancedGrid}>
          <label className={styles.advancedField}>
            <span>{t('characters.gallery.style')}</span>
            <Select
              value={options.style}
              onChange={(event) => setOptions((prev) => ({ ...prev, style: event.target.value }))}
              data-testid="characters-adv-style"
            >
              <option value="">{t('characters.gallery.style.base')}</option>
              <option value="bold">{t('characters.gallery.style.bold')}</option>
              <option value="soft">{t('characters.gallery.style.soft')}</option>
            </Select>
          </label>
          <label className={styles.advancedField}>
            <span>{t('characters.gallery.frameCount')}</span>
            <input
              type="number"
              min={1}
              max={16}
              value={options.frameCount}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  frameCount: Math.max(1, Math.min(16, Number(event.target.value) || 8)),
                }))
              }
              data-testid="characters-adv-frames"
            />
          </label>
          <label className={styles.advancedField}>
            <span>{t('characters.gallery.engine')}</span>
            <Select
              value={options.engine}
              onChange={(event) => setOptions((prev) => ({ ...prev, engine: event.target.value }))}
              data-testid="characters-adv-engine"
            >
              {IMPLEMENTED_ENGINE_IDS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
              {RESERVED_ENGINE_IDS.map((id) => (
                <option key={id} value={id} disabled>
                  {id} · {t('characters.engine.comingSoon')}
                </option>
              ))}
            </Select>
          </label>
          <label className={styles.advancedField}>
            <span>{t('characters.gallery.background')}</span>
            <Select
              value={options.background}
              onChange={(event) => setOptions((prev) => ({ ...prev, background: event.target.value }))}
              data-testid="characters-adv-background"
            >
              {BACKGROUNDS.map((bg) => (
                <option key={bg} value={bg}>{t(`characters.gallery.background.${bg}`)}</option>
              ))}
            </Select>
          </label>
          <fieldset className={styles.advancedField}>
            <span>{t('characters.gallery.emotions')}</span>
            <div className={styles.emotionChecks} data-testid="characters-adv-emotions">
              {baseEmotionKeys.map((key) => (
                <label key={key} className={styles.emotionCheck}>
                  <input
                    type="checkbox"
                    checked={options.emotions.length === 0 || options.emotions.includes(key)}
                    onChange={() => toggleEmotion(key)}
                  />
                  {emotionLabel(t, key, basePack?.manifest.emotions[key]?.label ?? key)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      {/* G-UX 9: after the first «Dale vida», the next step towards the
          saved goal — its own card, driven by meta-goal.v1. */}
      {results.length > 0 && storedGoal && NEXT_STEP_GOALS.includes(storedGoal.goal) ? (
        <NextStepCard
          goal={storedGoal.goal}
          result={results[0]!}
          base={bases.get(results[0]!.basePackId) ?? null}
        />
      ) : null}

      {results.length > 0 ? (
        <>
          <h2 className={styles.gallerySection}>{t('characters.gallery.results')}</h2>
          <div className={styles.galleryCards} data-testid="characters-results">
            {results.map((result, index) => (
              <ResultCard
                key={result.id}
                result={result}
                index={index}
                base={bases.get(result.basePackId) ?? null}
                onOpen={() => {
                  react(t(`characters.react.editor.${voice}`), 'triumph');
                  void openResult(result);
                }}
                onOpenExports={() => void openResultExports(result)}
                onChange={(next) => {
                  if (next.liked && !result.liked) {
                    react(t(`characters.react.like.${voice}`), 'joy');
                  }
                  updateResult(next);
                }}
                onRemove={() => discardResult(result.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className={styles.resultsEmpty} data-testid="characters-results-empty">
          {t('characters.gallery.resultsEmpty')}
        </p>
      )}

      {/* G-UX 8A: the sign-up wall appears only after value — the visitor
          has played with the character and pressed «Dale vida». It offers
          the account or the watermarked GIF; nothing else is gated here. */}
      {wallOpen ? (
        <div
          className={styles.trialWallBackdrop}
          data-testid="characters-trial-wall"
          role="dialog"
          aria-modal="true"
          aria-label={t('characters.trial.wall.title')}
        >
          <div className={styles.trialWall}>
            <h2 className={styles.trialWallTitle}>{t('characters.trial.wall.title')}</h2>
            <p className={styles.trialWallText}>{t('characters.trial.wall.text')}</p>
            <div className={styles.nextStepActions}>
              <Button
                variant="primary"
                onClick={() => {
                  window.location.href = '/';
                }}
                data-testid="characters-trial-save"
              >
                {t('characters.trial.wall.save')}
              </Button>
              <Button
                variant="subtle"
                onClick={() => void downloadBrandedGif()}
                disabled={gifBusy}
                data-testid="characters-trial-gif"
              >
                {t('characters.trial.wall.gif')}
              </Button>
            </div>
            <button
              type="button"
              className={styles.trialWallLater}
              onClick={() => setWallOpen(false)}
              data-testid="characters-trial-later"
            >
              {t('characters.trial.wall.later')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface CastProps {
  pack: LoadedPack;
  selected: boolean;
  onSelect: () => void;
}

function CastButton({ pack, selected, onSelect }: CastProps) {
  const load = useMemo(() => loaderFor((src) => pack.resolve(src)), [pack]);
  const [key, emotion] = previewEmotion(pack.manifest.emotions);
  return (
    <button
      type="button"
      className={`${styles.castAvatar} ${selected ? styles.castAvatarOn : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={`characters-cast-${pack.manifest.id}`}
    >
      <AnimatedThumb
        pack={pack.manifest}
        emotionKey={key}
        emotion={emotion}
        load={load}
        className={`${styles.castThumb} ${styles.checker}`}
        label={pack.manifest.name}
      />
      <span>{pack.manifest.name}</span>
    </button>
  );
}

/** The G-UX-2 goal card — sits beside the stage (below it on mobile). In
 *  `ask` it offers the five goals plus «Ahora no»; in `plan` it becomes
 *  «Te preparo estas emociones» with the per-goal uses, the recommended
 *  format and a «Cambiar» link that reopens the question. */
interface GoalCardProps {
  phase: 'ask' | 'plan';
  stored: StoredGoal | null;
  selected: MetaGoal | null;
  voice: 'gui' | 'tinta';
  other: string;
  onSelect: (goal: MetaGoal) => void;
  onOther: (text: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
  onChange: () => void;
  onCreate: () => void;
}

function GoalCard({ phase, stored, selected, voice, other, onSelect, onOther, onConfirm, onSkip, onChange, onCreate }: GoalCardProps) {
  const { t } = useI18n();
  if (phase === 'plan' && stored) {
    return (
      <div className={styles.goalCard} data-testid="characters-goal-card">
        <div className={styles.goalCardTop}>
          <span className={styles.goalPill} data-testid="characters-goal-pill">
            {t('characters.goalask.for', { goal: t(`characters.meta.option.${stored.goal}` as Parameters<typeof t>[0]) })}
          </span>
          <button
            type="button"
            className={styles.goalChange}
            onClick={onChange}
            data-testid="characters-goal-change"
          >
            {t('characters.goalask.change')}
          </button>
        </div>
        <span className={styles.goalPlanTitle}>{t('characters.goalask.planTitle')}</span>
        <ul className={styles.goalPlanList} data-testid="characters-goal-plan">
          {GOAL_PLAN[stored.goal].map((emotion) => (
            <li key={emotion}>
              <strong>{t(`characters.stage.chip.${emotion}` as Parameters<typeof t>[0])}</strong>
              {' · '}
              {t(`characters.goalask.use.${stored.goal}.${emotion}` as Parameters<typeof t>[0])}
            </li>
          ))}
        </ul>
        <span className={styles.goalFormat} data-testid="characters-goal-format">
          {t(`characters.goalask.format.${stored.goal}` as Parameters<typeof t>[0])}
        </span>
        <Button variant="primary" onClick={onCreate} data-testid="characters-goal-create">
          {t('characters.goalask.create')}
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.goalCard} data-testid="characters-goal-card">
      <div className={styles.goalCardTop}>
        <span className={styles.goalAskTitle} data-testid="characters-goal-title">
          {t('characters.goalask.title')}
        </span>
        <button
          type="button"
          className={styles.goalChange}
          onClick={onSkip}
          data-testid="characters-goal-skip"
        >
          {t('characters.goalask.skipNow')}
        </button>
      </div>
      <p className={styles.goalAskText}>{t(`characters.goalask.text.${voice}`)}</p>
      <div className={styles.metaOptions}>
        {META_GOALS.map((option) => (
          <button
            key={option}
            type="button"
            className={`${styles.metaChip} ${selected === option ? styles.metaChipOn : ''}`}
            onClick={() => onSelect(option)}
            data-testid={`characters-goal-${option}`}
          >
            {t(`characters.meta.option.${option}`)}
          </button>
        ))}
      </div>
      {selected === 'other' ? (
        <div className={styles.metaOtherRow}>
          <input
            type="text"
            value={other}
            onChange={(event) => onOther(event.target.value)}
            placeholder={t('characters.meta.otherPlaceholder')}
            data-testid="characters-goal-other-input"
          />
          <Button variant="primary" onClick={onConfirm} data-testid="characters-goal-confirm">
            {t('characters.meta.confirm')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Goals that have a defined next step (G-UX 9). «other» gets none. */
const NEXT_STEP_GOALS: readonly GoalId[] = ['app', 'video', 'brand', 'story'];

interface NextStepProps {
  goal: GoalId;
  result: GenerationResult;
  base: LoadedPack | null;
}

function NextStepCard({ goal, result, base }: NextStepProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const manifest = result.manifest;
  const loopKey = GOAL_PLAN[goal].find((k) => manifest.emotions[k] !== undefined);
  const emotionKey = loopKey ?? Object.keys(manifest.emotions)[0] ?? '';
  const emotion = manifest.emotions[emotionKey];

  const run = useCallback(
    async (kind: 'webp' | 'sheet' | 'png') => {
      if (!base || !emotion || busy) return;
      setBusy(kind);
      try {
        const engine = getEngine(emotion.engine);
        if (!engine) return;
        const loaded = await loaderFor((src) => base.resolve(src))(emotionKey, emotion);
        if (!loaded) return;
        const fps = emotionFps(manifest, emotion);
        if (kind === 'png') {
          const image = engine.frameImage?.(loaded, 0);
          if (!image) return;
          const canvas = document.createElement('canvas');
          canvas.width = manifest.canvas.w;
          canvas.height = manifest.canvas.h;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/png'),
          );
          if (blob) downloadBlob(`${manifest.id}-${emotionKey}.png`, blob);
        } else if (kind === 'webp') {
          const durations = emotion.frames.map((frame) => frameDurationMs(frame, fps));
          const frames = collectPlaybackFrames(
            engine, loaded, durations, manifest.canvas.w, manifest.canvas.h, 'loop',
          );
          const out = await buildAnimationExport('webp', manifest, emotionKey, frames);
          downloadBlob(out.fileName, out.blob);
          downloadJson(`${manifest.id}.json`, JSON.stringify(manifest, null, 2));
        } else {
          const frames = emotion.frames.map((frame, index) => ({
            image: engine.frameImage?.(loaded, index),
            durationMs: frameDurationMs(frame, fps),
          }));
          if (frames.some((frame) => !frame.image)) return;
          const sheet = await buildSpriteSheet({
            pack: manifest,
            emotionKey,
            playback: 'loop',
            frames: frames as Array<{ image: CanvasImageSource; durationMs: number }>,
          });
          downloadBlob(sheet.pngFileName, sheet.pngBlob);
          downloadJson(sheet.jsonFileName, sheet.json);
        }
        // KPI counts animated/pack exports only — sheet and single-frame PNG
        // downloads stay on the local counter.
        recordExport(manifest.id, kind === 'webp' ? 'webp' : undefined);
      } finally {
        setBusy(null);
      }
    },
    [base, busy, emotion, emotionKey, manifest],
  );

  const copyEmbed = useCallback(() => {
    const snippet = `<img src="${manifest.id}-${emotionKey}.webp" alt="${manifest.name.replace(/"/g, '')}" width="${manifest.canvas.w}" height="${manifest.canvas.h}" />`;
    void navigator.clipboard?.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [emotionKey, manifest]);

  if (!emotion) return null;
  return (
    <div className={styles.nextStep} data-testid="characters-nextstep">
      <span className={styles.nextStepTitle}>{t('characters.nextstep.title')}</span>
      <p className={styles.nextStepText} data-testid="characters-nextstep-text">
        {t(`characters.nextstep.text.${goal}` as Parameters<typeof t>[0])}
      </p>
      <div className={styles.nextStepActions}>
        {goal === 'app' ? (
          <>
            <Button variant="subtle" onClick={copyEmbed} data-testid="characters-nextstep-copy">
              {copied ? t('characters.nextstep.copied') : t('characters.nextstep.action.copy')}
            </Button>
            <Button variant="subtle" onClick={() => void run('webp')} disabled={busy !== null} data-testid="characters-nextstep-pack">
              {t('characters.nextstep.action.pack')}
            </Button>
          </>
        ) : null}
        {goal === 'video' ? (
          <>
            <Button variant="subtle" onClick={() => void run('sheet')} disabled={busy !== null} data-testid="characters-nextstep-sheet">
              {t('characters.nextstep.action.sheet')}
            </Button>
            <span className={styles.metaChip} title={t('characters.meta.ctaTodo')}>
              {t('characters.meta.cta.video')}
            </span>
          </>
        ) : null}
        {goal === 'brand' ? (
          <Button variant="subtle" onClick={() => void run('png')} disabled={busy !== null} data-testid="characters-nextstep-png">
            {t('characters.nextstep.action.png')}
          </Button>
        ) : null}
        {goal === 'story' ? (
          <Button variant="subtle" onClick={() => void run('sheet')} disabled={busy !== null} data-testid="characters-nextstep-frames">
            {t('characters.nextstep.action.frames')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface ResultProps {
  result: GenerationResult;
  index: number;
  base: LoadedPack | null;
  onOpen: () => void;
  onOpenExports: () => void;
  onChange: (result: GenerationResult) => void;
  onRemove: () => void;
}

function ResultCard({ result, index, base, onOpen, onOpenExports, onChange, onRemove }: ResultProps) {
  const { t } = useI18n();
  const [note, setNote] = useState(result.note ?? '');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exports, setExports] = useState(() => exportCount(result.manifest.id));
  const load = useMemo(
    () => (base ? loaderFor((src) => base.resolve(src)) : null),
    [base],
  );
  // G-UX 7: the card loops the emotion most useful for the chosen goal —
  // not just any frame. The goal stamped on the result decides the pick.
  const goal = (result.meta?.goal ?? null) as GoalId | null;
  const loopKey = goal
    ? GOAL_PLAN[goal].find((k) => result.manifest.emotions[k] !== undefined)
    : undefined;
  const [key, emotion] =
    loopKey !== undefined
      ? ([loopKey, result.manifest.emotions[loopKey]!] as const)
      : previewEmotion(result.manifest.emotions);
  const emotionText = emotionLabel(t, key, emotion.label ?? key);
  const emotionCount = Object.keys(result.manifest.emotions).length;

  // The export counter lives in localStorage; refresh when any export lands.
  useEffect(() => {
    const refresh = () => setExports(exportCount(result.manifest.id));
    window.addEventListener(EXPORTS_EVENT, refresh);
    return () => window.removeEventListener(EXPORTS_EVENT, refresh);
  }, [result.manifest.id]);

  const saveNote = (value: string) => {
    setNote(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      onChange({ ...result, note: value });
    }, 400);
  };

  return (
    <div className={styles.resultCard} data-testid={`characters-result-${result.id}`}>
      <div
        role="button"
        tabIndex={0}
        className={styles.resultThumbWrap}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        {load ? (
          <AnimatedThumb
            pack={result.manifest}
            emotionKey={key}
            emotion={emotion}
            load={load}
            className={`${styles.cardThumb} ${styles.checker}`}
            label={result.manifest.name}
          />
        ) : null}
      </div>
      <div className={styles.resultBody}>
        <span className={styles.cardLabel}>
          {t('characters.gallery.proposal', { n: index + 1, prompt: result.prompt })}
        </span>
        <span className={styles.resultMeta}>
          {goal
            ? t('characters.gallery.cardMeta', {
                goal: t(`characters.meta.option.${goal}` as Parameters<typeof t>[0]),
                emotion: emotionText,
                count: emotionCount,
              })
            : t('characters.gallery.cardMetaNoGoal', { emotion: emotionText, count: emotionCount })}
          {result.imageName ? ` · ${result.imageName}` : ''}
          {exports > 0 ? ` · ${t('characters.gallery.exportedBadge')}` : ''}
        </span>
        <div className={styles.resultActions}>
          <Button
            variant="subtle"
            onClick={onOpen}
            data-testid={`characters-result-open-${result.id}`}
          >
            {t('characters.gallery.open')}
          </Button>
          <Button
            variant="subtle"
            onClick={() => onChange({ ...result, liked: !result.liked })}
            aria-pressed={Boolean(result.liked)}
            data-testid={`characters-result-like-${result.id}`}
            className={result.liked ? styles.likeOn : ''}
          >
            <Icon name="thumbs-up" size={14} /> {t('characters.gallery.like')}
          </Button>
          <details className={styles.resultMenu}>
            <summary
              className={styles.resultMenuButton}
              aria-label={t('characters.gallery.more')}
              data-testid={`characters-result-more-${result.id}`}
            >
              <Icon name="more-horizontal" size={14} />
            </summary>
            <div className={styles.resultMenuList}>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  onRemove();
                }}
                data-testid={`characters-result-remove-${result.id}`}
              >
                <Icon name="trash" size={14} /> {t('characters.gallery.remove')}
              </button>
            </div>
          </details>
        </div>
        {result.meta?.goal ? (
          <div className={styles.metaCtas} data-testid={`characters-meta-ctas-${result.id}`}>
            {result.meta.goal === 'app' ? (
              <Button
                variant="subtle"
                onClick={onOpenExports}
                data-testid={`characters-meta-cta-app-${result.id}`}
              >
                {t('characters.meta.cta.app')}
              </Button>
            ) : result.meta.goal === 'other' ? (
              result.meta.detail ? (
                <span className={styles.metaChip} title={t('characters.meta.ctaTodo')}>
                  {result.meta.detail}
                </span>
              ) : null
            ) : (
              <span
                className={styles.metaChip}
                title={t('characters.meta.ctaTodo')}
                data-testid={`characters-meta-cta-${result.meta.goal}-${result.id}`}
              >
                {t(`characters.meta.cta.${result.meta.goal}` as Parameters<typeof t>[0])}
              </span>
            )}
            <span className={styles.metaChip} title={t('characters.meta.ctaTodo')}>
              {t('characters.meta.cta.roberto')}
            </span>
          </div>
        ) : null}
        <input
          className={styles.resultNote}
          type="text"
          value={note}
          onChange={(event) => saveNote(event.target.value)}
          placeholder={t('characters.gallery.notePlaceholder')}
          data-testid={`characters-result-note-${result.id}`}
        />
      </div>
    </div>
  );
}
