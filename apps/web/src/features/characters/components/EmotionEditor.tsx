// Emotion editor — the editable frame strip + controls under the player.
// Every change goes through EditsController.mutate so it is undoable, persisted
// to IndexedDB, and exportable as a pack v1.1. The strip supports HTML5 drag
// reorder plus ‹ › move buttons (the accessible/testing path).

import { useEffect, useRef, useState, type DragEvent } from 'react';

import { Button } from '@open-design/components';

import { useI18n } from '../../../i18n';
import { Icon } from '../../../components/Icon';
import type { CharacterEmotion, CharacterPack } from '../pack/types';
import type { CharacterEngine, LoadedEmotion } from '../engines/types';
import type { EditsController } from '../edit/editsStore';
import {
  applyVariantFrame,
  duplicateFrame,
  moveFrame,
  nextUploadOrigin,
  removeFrame,
  setEmotionLiked,
  setEmotionNote,
  setFrameLiked,
  setFrameMs,
  setFrameNote,
} from '../edit/emotionEdit';
import { REPLACE_IMAGE_ACCEPT, replaceFileToPng } from '../edit/replaceImage';
import { JobPanel } from './JobPanel';
import styles from './characters.module.css';

interface Props {
  pack: CharacterPack;
  emotionKey: string;
  /** Edited (present) emotion. */
  emotion: CharacterEmotion;
  edits: EditsController;
  engine: CharacterEngine;
  loaded: LoadedEmotion | null;
  selectedIndex: number;
  onSelectFrame: (index: number) => void;
  daemon: boolean;
  comparing: boolean;
  onToggleCompare: () => void;
}

const THUMB_SIZE = 56;

export function EmotionEditor({
  pack,
  emotionKey,
  emotion,
  edits,
  engine,
  loaded,
  selectedIndex,
  onSelectFrame,
  daemon,
  comparing,
  onToggleCompare,
}: Props) {
  const { t } = useI18n();
  const stripRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [replaceFailed, setReplaceFailed] = useState(false);
  const [, forceRender] = useState(0);

  // Local subscription — the parent re-renders too (it passes `emotion`), but
  // the editor also needs to refresh controls like undo availability.
  useEffect(() => edits.subscribe(() => forceRender((v) => v + 1)), [edits]);

  // Repaint thumbnails whenever the decoded frames change.
  useEffect(() => {
    const list = stripRef.current;
    if (!list || !loaded) return;
    list.querySelectorAll('canvas').forEach((node, index) => {
      const ctx = node.getContext('2d');
      const image = engine.frameImage?.(loaded, index);
      if (!ctx) return;
      ctx.clearRect(0, 0, node.width, node.height);
      if (image) ctx.drawImage(image, 0, 0, node.width, node.height);
    });
  }, [engine, loaded]);

  const frameCount = emotion.frames.length;
  const selected = Math.min(selectedIndex, frameCount - 1);
  const selectedFrame = emotion.frames[selected];

  const onDragStart = (index: number) => (event: DragEvent) => {
    dragIndexRef.current = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };
  const onDragOverItem = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropTarget !== index) setDropTarget(index);
  };
  const onDropItem = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    setDropTarget(null);
    const from = dragIndexRef.current ?? Number(event.dataTransfer.getData('text/plain'));
    dragIndexRef.current = null;
    if (Number.isInteger(from) && from !== index) {
      edits.mutate(emotionKey, (e) => moveFrame(e, from, index));
      onSelectFrame(index);
    }
  };
  const onDragEnd = () => {
    dragIndexRef.current = null;
    setDropTarget(null);
  };

  // Manual frame edit ("editarlo"): the picked image replaces the selected
  // frame under its canonical pack src, so save-to-disk and the .zip export
  // carry the real file — same path an accepted regen proposal takes. The
  // file is rasterized to PNG first so the stored bytes match the `.png`
  // src; unsupported types and undecodable files surface the inline error.
  const replaceWithFile = async (file: File) => {
    const png = await replaceFileToPng(file);
    if (!png) {
      setReplaceFailed(true);
      return;
    }
    setReplaceFailed(false);
    const src = `${emotionKey}/${String(selected).padStart(3, '0')}.png`;
    edits.putExtraFile(src, png);
    edits.mutate(emotionKey, (e) =>
      applyVariantFrame(e, selected, {
        src,
        ms: e.frames[selected]?.ms ?? null,
        origin: nextUploadOrigin(e.frames[selected]?.origin),
      }),
    );
  };

  return (
    <div className={styles.editor} data-testid="emotion-editor">
      <div className={styles.editorToolbar}>
        <span className={styles.editorSectionTitle}>
          <Icon name="edit" size={13} /> {t('characters.editor.title')}
        </span>
        <span className={styles.editorToolbarActions}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => edits.undoEmotion(emotionKey)}
            disabled={!edits.canUndo(emotionKey)}
            aria-label={t('characters.editor.undo')}
            data-testid="editor-undo"
          >
            <Icon name="undo" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => edits.redoEmotion(emotionKey)}
            disabled={!edits.canRedo(emotionKey)}
            aria-label={t('characters.editor.redo')}
            data-testid="editor-redo"
          >
            <Icon name="redo" size={14} />
          </Button>
          <Button
            variant="ghost"
            onClick={onToggleCompare}
            aria-pressed={comparing}
            data-testid="editor-compare"
          >
            <Icon name="history" size={13} />
            {comparing ? t('characters.editor.after') : t('characters.editor.before')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => edits.resetEmotion(emotionKey)}
            disabled={!edits.isDirty(emotionKey)}
            data-testid="editor-reset"
          >
            <Icon name="refresh" size={13} /> {t('characters.editor.reset')}
          </Button>
        </span>
      </div>

      <div className={styles.editorStrip} ref={stripRef} data-testid="editor-strip">
        {emotion.frames.map((frame, index) => (
          <div
            key={index}
            className={styles.editorFrame}
            data-selected={index === selected ? 'true' : 'false'}
            data-drop-target={dropTarget === index ? 'true' : 'false'}
            data-testid={`editor-frame-${index}`}
            draggable
            onDragStart={onDragStart(index)}
            onDragOver={onDragOverItem(index)}
            onDrop={onDropItem(index)}
            onDragEnd={onDragEnd}
            onClick={() => onSelectFrame(index)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectFrame(index);
              }
            }}
            aria-label={t('characters.editor.frameLabel', { index: index + 1 })}
          >
            <canvas
              width={pack.canvas.w}
              height={pack.canvas.h}
              style={{ aspectRatio: `${pack.canvas.w}/${pack.canvas.h}`, maxHeight: THUMB_SIZE }}
            />
            <span className={styles.stripIndex}>{index + 1}</span>
            {frame.liked ? <span className={styles.likeBadge}>♥</span> : null}
            <span className={styles.frameMsBadge}>
              {frame.ms != null ? `${frame.ms}ms` : ''}
            </span>
          </div>
        ))}
      </div>

      {selectedFrame ? (
        <div className={styles.frameControls} data-testid="editor-frame-controls">
          <span className={styles.frameControlsTitle}>
            {t('characters.editor.frameLabel', { index: selected + 1 })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              edits.mutate(emotionKey, (e) => moveFrame(e, selected, selected - 1));
              onSelectFrame(selected - 1);
            }}
            disabled={selected === 0}
            aria-label={t('characters.editor.moveLeft')}
            data-testid="editor-move-left"
          >
            <Icon name="chevron-left" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              edits.mutate(emotionKey, (e) => moveFrame(e, selected, selected + 1));
              onSelectFrame(selected + 1);
            }}
            disabled={selected >= frameCount - 1}
            aria-label={t('characters.editor.moveRight')}
            data-testid="editor-move-right"
          >
            <Icon name="chevron-right" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => edits.mutate(emotionKey, (e) => duplicateFrame(e, selected))}
            aria-label={t('characters.editor.duplicate')}
            data-testid="editor-duplicate"
          >
            <Icon name="copy" size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => edits.mutate(emotionKey, (e) => removeFrame(e, selected))}
            disabled={frameCount <= 1}
            aria-label={t('characters.editor.remove')}
            data-testid="editor-remove"
          >
            <Icon name="trash" size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('characters.editor.replace')}
            data-testid="editor-replace"
          >
            <Icon name="upload" size={13} />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={REPLACE_IMAGE_ACCEPT}
            hidden
            data-testid="editor-replace-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void replaceWithFile(file);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              edits.mutate(emotionKey, (e) => setFrameLiked(e, selected, !selectedFrame.liked))
            }
            aria-pressed={Boolean(selectedFrame.liked)}
            aria-label={t('characters.editor.like')}
            data-testid="editor-like"
          >
            <Icon name="thumbs-up" size={13} />
          </Button>
          <label className={styles.msField}>
            {t('characters.editor.ms')}
            <input
              type="number"
              min={0}
              step={10}
              value={selectedFrame.ms ?? ''}
              placeholder={t('characters.editor.msAuto')}
              onChange={(event) =>
                edits.mutate(emotionKey, (e) =>
                  setFrameMs(e, selected, event.target.value === '' ? null : Number(event.target.value)),
                )
              }
              data-testid="editor-ms"
            />
          </label>
          <input
            type="text"
            className={styles.noteField}
            value={selectedFrame.note ?? ''}
            placeholder={t('characters.editor.notePlaceholder')}
            onChange={(event) =>
              edits.mutate(emotionKey, (e) => setFrameNote(e, selected, event.target.value))
            }
            data-testid="editor-note"
          />
        </div>
      ) : null}

      {replaceFailed ? (
        <p className={styles.jobError} data-testid="editor-replace-error" role="alert">
          {t('characters.editor.replaceError')}
        </p>
      ) : null}

      <div className={styles.emotionControls}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => edits.mutate(emotionKey, (e) => setEmotionLiked(e, !e.liked))}
          aria-pressed={Boolean(emotion.liked)}
          aria-label={t('characters.editor.emotionLike')}
          data-testid="editor-emotion-like"
        >
          <Icon name="thumbs-up" size={13} />
        </Button>
        <input
          type="text"
          className={styles.noteField}
          value={emotion.note ?? ''}
          placeholder={t('characters.editor.emotionNotePlaceholder')}
          onChange={(event) =>
            edits.mutate(emotionKey, (e) => setEmotionNote(e, event.target.value))
          }
          data-testid="editor-emotion-note"
        />
      </div>

      <JobPanel
        packId={pack.id}
        packVersion={edits.version}
        emotionKey={emotionKey}
        frameSrcs={emotion.frames.map((f) => f.src)}
        frameCount={frameCount}
        selectedIndex={selected}
        edits={edits}
        daemon={daemon}
      />
    </div>
  );
}
