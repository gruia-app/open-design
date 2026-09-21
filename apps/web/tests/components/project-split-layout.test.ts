// @vitest-environment jsdom

// OPEND-3207 · one resolver for the project split's first-paint chat width.
// ProjectView and the creation frame that precedes it both ask this module,
// so the column cannot move when one hands over to the other.

import { afterEach, describe, expect, it } from 'vitest';

import {
  CHAT_PANEL_WIDTH_STORAGE_KEY,
  DEFAULT_CHAT_PANEL_WIDTH,
  MAX_CHAT_PANEL_WIDTH,
  MIN_CHAT_PANEL_WIDTH,
  MIN_WORKSPACE_PANEL_WIDTH,
  SPLIT_RESIZE_HANDLE_WIDTH,
  readSavedChatPanelWidth,
  resolveProjectSplitLayout,
  writeProjectSplitLayout,
} from '../../src/components/project-split-layout';

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
});

describe('resolveProjectSplitLayout', () => {
  it('keeps the saved width when the container fits it', () => {
    const layout = resolveProjectSplitLayout(1280, 380);
    expect(layout.chatPanelWidth).toBe(380);
    expect(layout.workspacePanelMinWidth).toBe(MIN_WORKSPACE_PANEL_WIDTH);
    expect(layout.workspacePanelTrack).toBe('minmax(400px, 1fr)');
  });

  it('clamps a saved width the container cannot fit', () => {
    const layout = resolveProjectSplitLayout(900, 700);
    // 900 - 8 handle - 400 workspace floor = 492.
    expect(layout.chatPanelWidth).toBe(492);
    expect(layout.chatPanelMaxWidth).toBe(492);
  });

  it('releases the workspace floor below the normal split width', () => {
    // 700 < 345 + 8 + 400 = 753, so the workspace track collapses and the
    // chat column may take up to 700 - 8 = 692.
    const layout = resolveProjectSplitLayout(700, 500);
    expect(layout.workspacePanelMinWidth).toBe(0);
    expect(layout.workspacePanelTrack).toBe('minmax(0, 1fr)');
    expect(layout.chatPanelWidth).toBe(500);
  });

  it('falls back to the default and the max before the container is measured', () => {
    const layout = resolveProjectSplitLayout(0, DEFAULT_CHAT_PANEL_WIDTH);
    expect(layout.chatPanelWidth).toBe(DEFAULT_CHAT_PANEL_WIDTH);
    expect(layout.chatPanelMaxWidth).toBe(MAX_CHAT_PANEL_WIDTH);
    expect(layout.workspacePanelMinWidth).toBe(MIN_WORKSPACE_PANEL_WIDTH);
  });
});

describe('readSavedChatPanelWidth', () => {
  it('floors a saved width at the minimum', () => {
    window.localStorage.setItem(CHAT_PANEL_WIDTH_STORAGE_KEY, '200');
    expect(readSavedChatPanelWidth()).toBe(MIN_CHAT_PANEL_WIDTH);
  });

  it('caps a saved width at the maximum', () => {
    window.localStorage.setItem(CHAT_PANEL_WIDTH_STORAGE_KEY, '900');
    expect(readSavedChatPanelWidth()).toBe(MAX_CHAT_PANEL_WIDTH);
  });

  it('reports the default when nothing was saved', () => {
    expect(readSavedChatPanelWidth()).toBe(DEFAULT_CHAT_PANEL_WIDTH);
  });
});

describe('writeProjectSplitLayout', () => {
  it('writes the three grid properties and leaves no settling class behind', () => {
    const split = document.createElement('div');
    split.className = 'split';
    document.body.append(split);
    writeProjectSplitLayout(split, 512, 'minmax(400px, 1fr)', { animate: false });
    expect(split.style.getPropertyValue('--project-chat-panel-width')).toBe('512px');
    expect(split.style.getPropertyValue('--project-chat-handle-width')).toBe(
      `${SPLIT_RESIZE_HANDLE_WIDTH}px`,
    );
    expect(split.style.getPropertyValue('--project-workspace-panel-track')).toBe(
      'minmax(400px, 1fr)',
    );
    expect(split.classList.contains('split-settling')).toBe(false);
  });
});
