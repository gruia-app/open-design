// Frame strip — one thumbnail per frame, the active one outlined, click to
// seek. Thumbnails are drawn once per loaded emotion; only the highlight
// moves during playback.

import { useEffect, useRef } from 'react';

import type { CharacterEngine, LoadedEmotion } from '../engines/types';
import styles from './characters.module.css';

interface Props {
  engine: CharacterEngine;
  loaded: LoadedEmotion | null;
  frameCount: number;
  activeIndex: number;
  /** Aspect box for thumbnails. */
  canvas: { w: number; h: number };
  onSeek: (index: number) => void;
}

const THUMB_SIZE = 56;

export function FrameStrip({ engine, loaded, frameCount, activeIndex, canvas, onSeek }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !loaded) return;
    const nodes = list.querySelectorAll('canvas');
    nodes.forEach((node, index) => {
      const ctx = node.getContext('2d');
      const image = engine.frameImage?.(loaded, index);
      if (!ctx) return;
      ctx.clearRect(0, 0, node.width, node.height);
      if (image) ctx.drawImage(image, 0, 0, node.width, node.height);
    });
  }, [engine, loaded]);

  return (
    <div className={styles.strip} ref={listRef} data-testid="characters-frame-strip">
      {Array.from({ length: frameCount }, (_, index) => (
        <button
          key={index}
          type="button"
          className={styles.stripItem}
          data-active={index === activeIndex ? 'true' : 'false'}
          data-testid={`characters-frame-${index}`}
          onClick={() => onSeek(index)}
          aria-label={`Frame ${index + 1}`}
        >
          <canvas width={canvas.w} height={canvas.h} style={{ aspectRatio: `${canvas.w}/${canvas.h}`, maxHeight: THUMB_SIZE }} />
          <span className={styles.stripIndex}>{index + 1}</span>
        </button>
      ))}
    </div>
  );
}
