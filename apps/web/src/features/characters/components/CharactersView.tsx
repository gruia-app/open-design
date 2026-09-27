// Personajes — the character-pack review surface. The header owns pack
// import (folder / zip / bundled sample); the body is either the 3×3
// emotion grid or, when the route carries an emotion id, the player.

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import { I18nProvider, manualLocaleOverride, useI18n } from '../../../i18n';
import { Icon } from '../../../components/Icon';
import { navigate } from '../../../router';
import {
  importPackFromFiles,
  importPackFromZip,
  PackImportError,
  type LoadedPack,
} from '../import/importPack';
import {
  loadBundledPack,
  loadDefaultPack,
  probeBundledPacks,
  type BundledPackOption,
} from '../samplePacks';
import { getCurrentEdits, getCurrentPack, setCurrentPack } from '../store';
import { useEditsVersion } from '../edit/useEdits';
import '../engines/rasterFrames';
import { useEmotionCache } from './useEmotionCache';
import { EmotionCard } from './EmotionCard';
import { EmotionPlayer } from './EmotionPlayer';
import { CharacterGallery } from './CharacterGallery';
import styles from './characters.module.css';

interface Props {
  /** Emotion id from `/characters/<emotion>`; undefined renders the grid. */
  emotionId?: string;
  /** Public trial mode (`/characters/try`): the stage stays interactive and
   *  «Generar»/save/unbranded export lead to the sign-up wall (G-UX 8A). */
  trial?: boolean;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; pack: LoadedPack }
  | { kind: 'error'; message: string; details: string[] };

function describeError(error: unknown): { message: string; details: string[] } {
  if (error instanceof PackImportError) {
    return { message: error.message, details: error.details };
  }
  return { message: error instanceof Error ? error.message : String(error), details: [] };
}

// Personajes ships Spanish-first: the review surface defaults to es-ES in
// every mount mode (standalone static host and full App inside the daemon).
// A deliberate manual locale pick still wins — it is the one override a user
// could reasonably have meant.
export function CharactersView(props: Props) {
  return (
    <I18nProvider initial={manualLocaleOverride() ?? 'es-ES'}>
      <CharactersViewInner {...props} />
    </I18nProvider>
  );
}

function CharactersViewInner({ emotionId, trial }: Props) {
  const { t } = useI18n();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<LoadState>(() => {
    const pack = getCurrentPack();
    return pack ? { kind: 'ready', pack } : { kind: 'idle' };
  });
  const [catalogue, setCatalogue] = useState<BundledPackOption[]>([]);

  const adoptPack = useCallback((pack: LoadedPack) => {
    setCurrentPack(pack);
    setState({ kind: 'ready', pack });
  }, []);

  const loadBundled = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      adoptPack(await loadDefaultPack());
    } catch (error) {
      setState({ kind: 'error', ...describeError(error) });
    }
  }, [adoptPack]);


  // F4: the gallery is the landing surface — the review grid only mounts
  // after the user generates a result or explicitly picks a pack/import, so
  // the frame editor never appears before the first result. The exception is
  // a deep link (/characters/<emotion>), which still pulls the default pack
  // so shared URLs keep working.
  useEffect(() => {
    if (emotionId && !getCurrentPack()) void loadBundled();
  }, [emotionId, loadBundled]);

  // Probe the bundled catalogue once so the picker knows which characters
  // are actually on disk (missing ones stay visible but disabled).
  useEffect(() => {
    let alive = true;
    void probeBundledPacks().then((options) => {
      if (alive) setCatalogue(options);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onFolderPicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      event.target.value = '';
      if (!files || files.length === 0) return;
      setState({ kind: 'loading' });
      try {
        adoptPack(await importPackFromFiles(files));
      } catch (error) {
        setState({ kind: 'error', ...describeError(error) });
      }
    },
    [adoptPack],
  );

  const onZipPicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setState({ kind: 'loading' });
      try {
        adoptPack(await importPackFromZip(file, file.name));
      } catch (error) {
        setState({ kind: 'error', ...describeError(error) });
      }
    },
    [adoptPack],
  );

  const pack = state.kind === 'ready' ? state.pack : null;
  const edits = pack ? getCurrentEdits() : null;
  // Re-render on every edit mutation/hydration so grid + player always show
  // the effective (edited) emotions.
  useEditsVersion(edits);
  const loadEmotion = useEmotionCache(pack, edits?.resolve);

  const openEmotion = useCallback((key: string) => {
    navigate({ kind: 'home', view: 'characters', emotionId: key });
  }, []);
  const closeEmotion = useCallback(() => {
    navigate({ kind: 'home', view: 'characters' });
  }, []);

  const emotion =
    emotionId && pack
      ? (edits?.emotionFor(emotionId) ?? pack.manifest.emotions[emotionId])
      : undefined;
  const baseline = emotionId && edits ? edits.baselineFor(emotionId) : null;
  const missingEmotion = Boolean(emotionId && pack && !emotion);
  const emotionEntries = pack ? Object.entries(pack.manifest.emotions) : [];

  return (
    <section className={styles.root} data-testid="characters-view">
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t('characters.title')}</h1>
          <p className={styles.tagline}>{t('characters.tagline')}</p>
        </div>
        <div className={styles.actions}>
          {/* G-UX 5: one secondary import entry — «Traer mis archivos» —
              replaces the two always-visible import buttons. The bundled
              pack selector is gone: the cast row (G-UX 6) picks the active
              character. */}
          <details className={styles.importMenu}>
            <summary className={styles.importMenuButton} data-testid="characters-import-menu">
              <Icon name="import" size={14} /> {t('characters.header.importMenu')}
            </summary>
            <div className={styles.importMenuList}>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  folderInputRef.current?.click();
                }}
                data-testid="characters-import-folder"
              >
                <Icon name="folder" size={14} /> {t('characters.actions.folder')}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  zipInputRef.current?.click();
                }}
                data-testid="characters-import-zip"
              >
                <Icon name="import" size={14} /> {t('characters.actions.zip')}
              </button>
            </div>
          </details>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void onFolderPicked(event)}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => void onZipPicked(event)}
          />
        </div>
      </div>

      {state.kind === 'loading' ? (
        <div className={styles.notice} data-testid="characters-loading">
          {t('characters.loading')}
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div className={styles.errorBox} data-testid="characters-error">
          <h3>{t('characters.error.title')}</h3>
          <ul>
            <li>{state.message}</li>
            {state.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pack ? (
        <div className={styles.packMeta}>
          <span>
            <strong>{pack.manifest.name}</strong> · {pack.manifest.id}
          </span>
          <span>{t(`characters.source.${pack.origin}`)}: {pack.sourceLabel}</span>
          <span>
            {t('characters.grid.emotionCount', { count: emotionEntries.length })} ·{' '}
            {pack.manifest.canvas.w}×{pack.manifest.canvas.h}
          </span>
        </div>
      ) : null}

      {pack && pack.warnings.length > 0 ? (
        <div className={styles.warningBox} data-testid="characters-warnings">
          {pack.warnings.join(' · ')}
        </div>
      ) : null}

      {pack && missingEmotion ? (
        <div className={styles.notice} data-testid="characters-emotion-missing">
          {t('characters.player.notFound', { id: emotionId ?? '' })}
        </div>
      ) : null}

      {!emotionId ? (
        <CharacterGallery catalogue={catalogue} onOpenPack={adoptPack} trial={trial === true} />
      ) : null}

      {pack && emotion && edits && baseline ? (
        <EmotionPlayer
          pack={edits.manifestWithEdits()}
          loadedPack={pack}
          emotionKey={emotionId!}
          emotion={emotion}
          baseline={baseline}
          edits={edits}
          load={loadEmotion}
          onBack={closeEmotion}
        />
      ) : pack ? (
        <div className={styles.grid} data-testid="characters-grid">
          {emotionEntries.map(([key, entry]) => (
            <EmotionCard
              key={key}
              pack={edits?.manifestWithEdits() ?? pack.manifest}
              emotionKey={key}
              emotion={edits?.emotionFor(key) ?? entry}
              load={loadEmotion}
              onOpen={openEmotion}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
