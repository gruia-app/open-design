import type { CSSProperties } from 'react';

// The chat-column geometry shared by ProjectView and the creation hand-off
// frame that precedes it (OPEND-3207). Both surfaces resolve the first-paint
// width through `resolveProjectSplitLayout` with the same saved input, so the
// column does not move when one surface hands over to the other.
export const CHAT_PANEL_WIDTH_STORAGE_KEY = 'open-design.project.chatPanelWidth';
export const DEFAULT_CHAT_PANEL_WIDTH = 460;
export const MIN_CHAT_PANEL_WIDTH = 345;
export const MAX_CHAT_PANEL_WIDTH = 720;
export const MIN_WORKSPACE_PANEL_WIDTH = 400;
export const SPLIT_RESIZE_HANDLE_WIDTH = 8;

const MIN_NORMAL_SPLIT_WIDTH =
  MIN_CHAT_PANEL_WIDTH + SPLIT_RESIZE_HANDLE_WIDTH + MIN_WORKSPACE_PANEL_WIDTH;

export function workspacePanelMinWidthForSplit(splitWidth: number): number {
  if (!Number.isFinite(splitWidth) || splitWidth <= 0) return MIN_WORKSPACE_PANEL_WIDTH;
  return splitWidth < MIN_NORMAL_SPLIT_WIDTH ? 0 : MIN_WORKSPACE_PANEL_WIDTH;
}

export function maxChatPanelWidthForSplit(splitWidth: number): number {
  if (!Number.isFinite(splitWidth) || splitWidth <= 0) return MAX_CHAT_PANEL_WIDTH;
  const workspaceMinWidth = workspacePanelMinWidthForSplit(splitWidth);
  const viewportAwareMax = splitWidth - SPLIT_RESIZE_HANDLE_WIDTH - workspaceMinWidth;
  return Math.max(0, Math.min(MAX_CHAT_PANEL_WIDTH, Math.floor(viewportAwareMax)));
}

export function clampPreferredChatPanelWidth(width: number): number {
  return Math.min(MAX_CHAT_PANEL_WIDTH, Math.max(MIN_CHAT_PANEL_WIDTH, Math.round(width)));
}

export function clampChatPanelWidth(width: number, maxWidth = MAX_CHAT_PANEL_WIDTH): number {
  const effectiveMax = Math.max(0, Math.min(MAX_CHAT_PANEL_WIDTH, Math.floor(maxWidth)));
  const effectiveMin = Math.min(MIN_CHAT_PANEL_WIDTH, effectiveMax);
  return Math.min(effectiveMax, Math.max(effectiveMin, Math.round(width)));
}

export function workspacePanelTrackForMinWidth(workspacePanelMinWidth: number): string {
  return workspacePanelMinWidth === 0
    ? 'minmax(0, 1fr)'
    : `minmax(${workspacePanelMinWidth}px, 1fr)`;
}

export function readSavedChatPanelWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_CHAT_PANEL_WIDTH;
  try {
    const raw = window.localStorage.getItem(CHAT_PANEL_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed)
      ? clampPreferredChatPanelWidth(parsed)
      : DEFAULT_CHAT_PANEL_WIDTH;
  } catch {
    return DEFAULT_CHAT_PANEL_WIDTH;
  }
}

export function saveChatPanelWidth(width: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CHAT_PANEL_WIDTH_STORAGE_KEY,
      String(clampPreferredChatPanelWidth(width)),
    );
  } catch {
    // localStorage can be unavailable in hardened browser contexts.
  }
}

export interface ProjectSplitLayout {
  chatPanelWidth: number;
  chatPanelMaxWidth: number;
  workspacePanelMinWidth: number;
  workspacePanelTrack: string;
}

/**
 * The chat-column width a project split shows for a container of
 * `splitWidth` pixels, given the saved width `readSavedChatPanelWidth`
 * reports. Invariant: every surface that paints a project's `.split` —
 * ProjectView and the creation frame that precedes it — resolves its width
 * through this function with the same inputs, so the column does not move
 * when one surface hands over to the other (OPEND-3207).
 */
export function resolveProjectSplitLayout(
  splitWidth: number,
  savedWidth: number,
): ProjectSplitLayout {
  const workspacePanelMinWidth = workspacePanelMinWidthForSplit(splitWidth);
  const chatPanelMaxWidth = maxChatPanelWidthForSplit(splitWidth);
  return {
    chatPanelWidth: clampChatPanelWidth(savedWidth, chatPanelMaxWidth),
    chatPanelMaxWidth,
    workspacePanelMinWidth,
    workspacePanelTrack: workspacePanelTrackForMinWidth(workspacePanelMinWidth),
  };
}

export type ProjectSplitStyle = CSSProperties & {
  '--project-chat-panel-width': string;
  '--project-chat-handle-width': string;
  '--project-workspace-panel-track': string;
};

export function projectSplitClassName(workspaceFocused: boolean): string {
  return workspaceFocused ? 'split split-focus' : 'split';
}

export function projectSplitStyle(
  workspaceFocused: boolean,
  chatPanelWidth: number,
  workspacePanelTrack: string,
): ProjectSplitStyle | undefined {
  if (workspaceFocused) return undefined;
  return {
    '--project-chat-panel-width': `${chatPanelWidth}px`,
    '--project-chat-handle-width': `${SPLIT_RESIZE_HANDLE_WIDTH}px`,
    '--project-workspace-panel-track': workspacePanelTrack,
  };
}

/**
 * Write the split's three grid custom properties directly on the element.
 * The grid is always driven by
 * `var(--project-chat-panel-width) var(--project-chat-handle-width) var(--project-workspace-panel-track)`
 * declared once on `.split` (shell.css), and the two width properties are
 * registered as animatable, so a plain property write is all a live resize
 * or a collapse/expand needs to animate.
 *
 * `animate: false` is for a surface's FIRST measured write. The measurement
 * that feeds it (`clientWidth`) has already forced a style pass with the
 * element's provisional width, so a bare write afterwards would start the
 * 200ms `.split` transition from that provisional value — the column would be
 * seen sliding into place on mount. The write is committed under
 * `.split-settling` (transition: none), flushed, and the class removed, so the
 * next style pass sees the final width with nothing to animate from.
 */
export function writeProjectSplitLayout(
  split: HTMLElement,
  chatPanelWidth: number,
  workspacePanelTrack: string,
  options: { animate?: boolean } = {},
): void {
  const settle = options.animate === false;
  if (settle) split.classList.add('split-settling');
  split.style.setProperty('--project-chat-panel-width', `${chatPanelWidth}px`);
  split.style.setProperty('--project-chat-handle-width', `${SPLIT_RESIZE_HANDLE_WIDTH}px`);
  split.style.setProperty('--project-workspace-panel-track', workspacePanelTrack);
  if (settle) {
    // Flush the settled style pass before the class comes off; without the
    // read the add + remove collapse into one pass and the transition runs.
    void split.offsetWidth;
    split.classList.remove('split-settling');
  }
}
