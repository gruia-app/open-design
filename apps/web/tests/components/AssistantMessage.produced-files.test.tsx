// @vitest-environment jsdom

/**
 * ProducedFiles key contract: a folded strategy turn unions producedFiles
 * from several physical runs, so the same path can arrive twice. The panel
 * dedupes by (path, name) — one row per real file, no duplicate React keys.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantMessage } from '../../src/components/AssistantMessage';
import type { ChatMessage, ProjectFile } from '../../src/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const RESULT: ProjectFile = {
  name: 'result.html',
  path: 'result.html',
  kind: 'html',
  mime: 'text/html',
  size: 132,
  mtime: 2000,
};

function baseMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Done.',
    runStatus: 'succeeded',
    startedAt: 1700000000,
    endedAt: 1700000005,
    events: [{ kind: 'text', text: 'Done.' } as NonNullable<ChatMessage['events']>[number]],
    producedFiles: [],
    ...overrides,
  } as ChatMessage;
}

describe('ProducedFiles', () => {
  it('renders one row per file even when a folded turn repeats the same path', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <AssistantMessage
        message={baseMessage({
          producedFiles: [RESULT, { ...RESULT, size: 200, mtime: 3000 }],
        })}
        projectId="proj-1" streaming={false}
      />,
    );
    const rows = container.querySelectorAll('.produced-file');
    expect(rows.length).toBe(1);
    // The latest record wins (the successor run's fresher entry).
    expect(rows[0]?.textContent).toContain('200');
    expect(
      errorSpy.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('same key')),
      ),
    ).toBe(false);
  });

  it('keeps same-named files from different paths as separate rows', () => {
    const { container } = render(
      <AssistantMessage
        message={baseMessage({
          producedFiles: [RESULT, { ...RESULT, path: 'dist/result.html' }],
        })}
        projectId="proj-1" streaming={false}
      />,
    );
    expect(container.querySelectorAll('.produced-file').length).toBe(2);
  });
});
