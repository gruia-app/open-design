// @vitest-environment jsdom

// OPEND-3207 · the optimistic project frame shown between Send and the
// daemon's create response must paint the chat column at the same width
// ProjectView resolves, or the column moves when the real view takes over.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ProjectCreationPendingView } from '../../src/components/ProjectCreationPendingView';
import { I18nProvider } from '../../src/i18n';
import type { Project } from '../../src/types';
import {
  CHAT_PANEL_WIDTH_STORAGE_KEY,
  DEFAULT_CHAT_PANEL_WIDTH,
  MIN_WORKSPACE_PANEL_WIDTH,
  SPLIT_RESIZE_HANDLE_WIDTH,
} from '../../src/components/project-split-layout';

const project = { id: 'pending-project', name: 'Coffee shop landing page' } as Project;

function renderPending() {
  return render(
    <I18nProvider initial="en">
      <ProjectCreationPendingView
        project={project}
        prompt="Make a landing page for a coffee shop"
        agentId="claude"
        onBack={() => {}}
      />
    </I18nProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  cleanup();
});

describe('ProjectCreationPendingView split', () => {
  it('paints the saved chat width inline, the same source ProjectView reads (OPEND-3207)', () => {
    window.localStorage.setItem(CHAT_PANEL_WIDTH_STORAGE_KEY, '380');
    renderPending();
    const split = screen.getByTestId('project-creation-pending-view') as HTMLElement;
    // jsdom lays nothing out, so the container measures 0 and the saved
    // width is the whole answer; the real-browser case is pinned by
    // e2e/ui/home-send-split-width.test.ts.
    expect(split.style.getPropertyValue('--project-chat-panel-width')).toBe('380px');
    expect(split.style.getPropertyValue('--project-chat-handle-width')).toBe(
      `${SPLIT_RESIZE_HANDLE_WIDTH}px`,
    );
    expect(split.style.getPropertyValue('--project-workspace-panel-track')).toBe(
      `minmax(${MIN_WORKSPACE_PANEL_WIDTH}px, 1fr)`,
    );
    expect(split.classList.contains('split-settling')).toBe(false);
  });

  it('paints the default chat width when nothing was saved', () => {
    renderPending();
    const split = screen.getByTestId('project-creation-pending-view') as HTMLElement;
    expect(split.style.getPropertyValue('--project-chat-panel-width')).toBe(
      `${DEFAULT_CHAT_PANEL_WIDTH}px`,
    );
  });

  it('shows the sent prompt and the project name from the creation record alone', () => {
    renderPending();
    expect(screen.getByTestId('pending-project-title').textContent).toBe(
      'Coffee shop landing page',
    );
    expect(screen.getByText('Make a landing page for a coffee shop')).toBeTruthy();
  });
});
