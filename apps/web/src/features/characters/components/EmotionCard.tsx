// One cell of the emotion grid — an always-animating thumbnail plus the
// emotion label, engine badge and frame count.

import { useState } from 'react';

import { useI18n } from '../../../i18n';
import { emotionFps, type CharacterEmotion, type CharacterPack } from '../pack/types';
import { emotionLabel } from '../pack/labels';
import { engineStatus } from '../engines/registry';
import type { EmotionLoader } from './useEmotionCache';
import { AnimatedThumb } from './AnimatedThumb';
import styles from './characters.module.css';

interface Props {
  pack: CharacterPack;
  emotionKey: string;
  emotion: CharacterEmotion;
  load: EmotionLoader;
  onOpen: (key: string) => void;
}

export function EmotionCard({ pack, emotionKey, emotion, load, onOpen }: Props) {
  const { t } = useI18n();
  const status = engineStatus(emotion.engine);
  const [failed, setFailed] = useState(false);
  const fps = emotionFps(pack, emotion);

  // A <div role="button">, not <button>: Chromium collapses the heights of
  // flex/grid children inside real buttons, which zeroed every thumbnail.
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.card}
      onClick={() => onOpen(emotionKey)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(emotionKey);
        }
      }}
      data-testid={`characters-emotion-${emotionKey}`}
    >
      {status === 'ready' ? (
        <AnimatedThumb
          pack={pack}
          emotionKey={emotionKey}
          emotion={emotion}
          load={load}
          className={`${styles.cardThumb} ${styles.checker}`}
          label={emotion.label}
          onFrames={(loaded) => setFailed(loaded === null)}
        />
      ) : (
        <div className={styles.comingSoonBox}>
          <span>{t('characters.engine.comingSoon')}</span>
          <span className={styles.cardKey}>{emotion.engine}</span>
        </div>
      )}
      <div className={styles.cardBody}>
        <span className={styles.cardLabel}>{emotionLabel(t, emotionKey, emotion.label)}</span>
        <span className={styles.cardKey}>{emotionKey}</span>
      </div>
      <div className={styles.cardMeta}>
        <span>{t('characters.grid.frames', { count: emotion.frames.length })}</span>
        <span>{fps} fps</span>
        {status !== 'ready' ? (
          <span className={`${styles.badge} ${styles.badgeComingSoon}`}>
            {t('characters.engine.comingSoon')}
          </span>
        ) : null}
        {failed ? <span className={styles.badge}>{t('characters.grid.loadFailed')}</span> : null}
      </div>
    </div>
  );
}
