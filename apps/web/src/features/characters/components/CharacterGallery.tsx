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
import { EXPORTS_EVENT, exportCount } from '../gallery/metrics';
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
}

export function CharacterGallery({ catalogue, onOpenPack }: Props) {
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
    let alive = true;
    void loadResults().then((stored) => {
      if (alive) setResults(stored);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const effectiveBaseId = baseId || starters[0]?.id || '';
  const basePack = bases.get(effectiveBaseId) ?? null;
  const baseEmotionKeys = basePack ? Object.keys(basePack.manifest.emotions) : [];
  const canGenerate = Boolean(basePack && (prompt.trim() || image)) && !busy;
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
  }, [bases, effectiveBaseId, prompt, image, options, storedGoal, t, voice, react, touch]);

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
      progressTimers.current.forEach(clearTimeout);
    },
    [],
  );

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
            />
          ) : null}
        </div>
      ) : null}
      <div className={styles.generateRow}>
        <input
          className={styles.generateInput}
          type="text"
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
            if (event.key === 'Enter' && canGenerate) void generate();
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
            <Icon name="image" size={14} />
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
            <Icon name="sparkles" size={14} /> {t('characters.gallery.generate')}
          </Button>
        </div>
      </div>

      <h2 className={styles.gallerySection}>{t('characters.gallery.starters')}</h2>
      <div className={styles.galleryCards}>
        {starters.map((starter) => {
          const pack = bases.get(starter.id);
          if (!pack) return null;
          const [key, emotion] = previewEmotion(pack.manifest.emotions);
          return (
            <StarterCard
              key={starter.id}
              pack={pack}
              emotionKey={key}
              emotion={emotion}
              selected={effectiveBaseId === starter.id}
              onSelect={() => setBaseId(starter.id)}
            />
          );
        })}
      </div>

      <details className={styles.advanced} data-testid="characters-advanced">
        <summary>{t('characters.gallery.advanced')}</summary>
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

      {results.length > 0 ? (
        <>
          <h2 className={styles.gallerySection}>{t('characters.gallery.results')}</h2>
          <div className={styles.galleryCards} data-testid="characters-results">
            {results.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
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
    </div>
  );
}

interface StarterProps {
  pack: LoadedPack;
  emotionKey: string;
  emotion: CharacterEmotion;
  selected: boolean;
  onSelect: () => void;
}

function StarterCard({ pack, emotionKey, emotion, selected, onSelect }: StarterProps) {
  const { t } = useI18n();
  const load = useMemo(() => loaderFor((src) => pack.resolve(src)), [pack]);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      data-testid={`characters-starter-${pack.manifest.id}`}
    >
      <AnimatedThumb
        pack={pack.manifest}
        emotionKey={emotionKey}
        emotion={emotion}
        load={load}
        className={`${styles.cardThumb} ${styles.checker}`}
        label={pack.manifest.name}
      />
      <div className={styles.cardBody}>
        <span className={styles.cardLabel}>{pack.manifest.name}</span>
        <span className={styles.cardKey}>{pack.manifest.id}</span>
      </div>
      <div className={styles.cardMeta}>
        <span>{t('characters.grid.emotionCount', { count: Object.keys(pack.manifest.emotions).length })}</span>
        <span className={`${styles.badge} ${selected ? styles.badgeSelected : ''}`}>
          {selected ? t('characters.gallery.baseSelected') : t('characters.gallery.useAsBase')}
        </span>
      </div>
    </div>
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
}

function GoalCard({ phase, stored, selected, voice, other, onSelect, onOther, onConfirm, onSkip, onChange }: GoalCardProps) {
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

interface ResultProps {
  result: GenerationResult;
  base: LoadedPack | null;
  onOpen: () => void;
  onOpenExports: () => void;
  onChange: (result: GenerationResult) => void;
  onRemove: () => void;
}

function ResultCard({ result, base, onOpen, onOpenExports, onChange, onRemove }: ResultProps) {
  const { t } = useI18n();
  const [note, setNote] = useState(result.note ?? '');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exports, setExports] = useState(() => exportCount(result.manifest.id));
  const load = useMemo(
    () => (base ? loaderFor((src) => base.resolve(src)) : null),
    [base],
  );
  const [key, emotion] = previewEmotion(result.manifest.emotions);

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
        <span className={styles.cardLabel}>{result.manifest.name}</span>
        <span className={styles.resultMeta}>
          {t('characters.gallery.basedOn', { name: result.baseLabel })}
          {result.imageName ? ` · ${result.imageName}` : ''}
          {exports > 0 ? ` · ${t('characters.gallery.exportedBadge')}` : ''}
        </span>
        <span className={styles.resultMeta}>{result.prompt}</span>
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
            size="icon"
            onClick={() => onChange({ ...result, liked: !result.liked })}
            aria-label={t('characters.editor.like')}
            aria-pressed={Boolean(result.liked)}
            data-testid={`characters-result-like-${result.id}`}
            className={result.liked ? styles.likeOn : ''}
          >
            <Icon name="thumbs-up" size={14} />
          </Button>
          <Button
            variant="subtle"
            size="icon"
            onClick={onRemove}
            aria-label={t('characters.gallery.remove')}
            data-testid={`characters-result-remove-${result.id}`}
          >
            <Icon name="trash" size={14} />
          </Button>
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
