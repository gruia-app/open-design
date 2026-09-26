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
import {
  IMPLEMENTED_ENGINE_IDS,
  RESERVED_ENGINE_IDS,
  type CharacterEmotion,
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
import type { EmotionLoader } from './useEmotionCache';
import { AnimatedThumb } from './AnimatedThumb';
import styles from './characters.module.css';

/** Starters are the two shipped characters — pixel-demo stays in the header
 *  picker only. */
const STARTER_IDS = ['gruia-grulla', 'contenido-tinta'];

const BACKGROUNDS = ['transparent', 'white', 'magenta'] as const;

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

  const generate = useCallback(async () => {
    const base = bases.get(effectiveBaseId);
    if (!base || (!prompt.trim() && !image)) return;
    setBusy(true);
    try {
      const id = newResultId();
      const text = prompt.trim() || image?.name || id;
      const result: GenerationResult = {
        id,
        createdAt: Date.now(),
        prompt: text,
        image: image ?? undefined,
        imageName: image?.name,
        basePackId: effectiveBaseId,
        baseLabel: base.manifest.name,
        options,
        manifest: deriveResultManifest(base.manifest, options, text, id),
      };
      await saveResult(result);
      setResults((prev) => [result, ...prev]);
      setPrompt('');
      setImage(null);
    } finally {
      setBusy(false);
    }
  }, [bases, effectiveBaseId, prompt, image, options]);

  const updateResult = useCallback((next: GenerationResult) => {
    setResults((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    void saveResult(next).catch(() => {});
  }, []);

  const discardResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
    void removeResult(id).catch(() => {});
  }, []);

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

  const toggleEmotion = useCallback((key: string) => {
    setOptions((prev) => ({
      ...prev,
      emotions: prev.emotions.includes(key)
        ? prev.emotions.filter((k) => k !== key)
        : [...prev.emotions, key],
    }));
  }, []);

  return (
    <div className={styles.gallery} data-testid="characters-gallery">
      <div className={styles.generateRow}>
        <input
          className={styles.generateInput}
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canGenerate) void generate();
          }}
          placeholder={t('characters.gallery.promptPlaceholder')}
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
                onOpen={() => void openResult(result)}
                onChange={updateResult}
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

interface ResultProps {
  result: GenerationResult;
  base: LoadedPack | null;
  onOpen: () => void;
  onChange: (result: GenerationResult) => void;
  onRemove: () => void;
}

function ResultCard({ result, base, onOpen, onChange, onRemove }: ResultProps) {
  const { t } = useI18n();
  const [note, setNote] = useState(result.note ?? '');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useMemo(
    () => (base ? loaderFor((src) => base.resolve(src)) : null),
    [base],
  );
  const [key, emotion] = previewEmotion(result.manifest.emotions);

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
