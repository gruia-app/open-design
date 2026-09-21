// @vitest-environment jsdom

/**
 * od-card rendering contract for the fork's AssistantMessage.
 *
 * Adapted from upstream #8258/#8264 (OPEND-2745), which targeted components
 * the fork does not have (`ThinkingMarkdown`, `SayBlock`). The fork's
 * surfaces are the prose splitter in `AssistantMessage` and the local
 * `ThinkingBlock`; both now route through `splitShellCards` so:
 *
 * - a closed <od-card> whose JSON does not parse is dropped, never painted;
 * - an unclosed opener mid-stream is withheld, not treated as malformed;
 * - a valid card renders through OdCardView in prose and in thinking;
 * - a card quoted inside a Markdown fence stays visible as prose.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AssistantMessage } from '../../src/components/AssistantMessage';
import type { ChatMessage } from '../../src/types';

afterEach(() => {
  cleanup();
});

const VALID_CARD =
  '<od-card type="memory-applied">' +
  JSON.stringify({ summary: 'Applied palette', used: [{ type: 'rule', name: 'Palette' }] }) +
  '</od-card>';

const MALFORMED_CARD =
  '<od-card type="memory-applied">{"summary":"Applied palette","used":[],}</od-card>';

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

function renderAssistant(content: string, streaming = false): HTMLElement {
  const { container } = render(
    <AssistantMessage
      message={baseMessage({
        content,
        events: [{ kind: 'text', text: content } as NonNullable<ChatMessage['events']>[number]],
      })}
      streaming={streaming}
      isLast={streaming}
      projectId="proj-1"
    />,
  );
  return container;
}

function renderThinking(text: string, streaming = false): HTMLElement {
  const { container } = render(
    <AssistantMessage
      message={baseMessage({
        content: '',
        events: [
          { kind: 'thinking', text } as NonNullable<ChatMessage['events']>[number],
          // When streaming, the thinking block must stay the trailing block —
          // ThinkingBlock only receives `streaming` for the last block.
          ...(streaming
            ? []
            : [{ kind: 'text', text: 'Answer.' } as NonNullable<ChatMessage['events']>[number]]),
        ],
      })}
      streaming={streaming}
      projectId="proj-1"
    />,
  );
  return container;
}

describe('AssistantMessage od-card prose', () => {
  it('renders a valid card through OdCardView', () => {
    const container = renderAssistant(`Before.\n\n${VALID_CARD}\n\nAfter.`);
    expect(container.querySelector('[data-od-card="memory-applied"]')).not.toBeNull();
    expect(container.textContent ?? '').toContain('Before.');
    expect(container.textContent ?? '').toContain('After.');
    expect(container.textContent ?? '').not.toContain('<od-card');
  });

  it('drops a malformed closed card instead of painting raw protocol markup', () => {
    const container = renderAssistant(`Before.\n\n${MALFORMED_CARD}\n\nAfter.`);
    const text = container.textContent ?? '';
    expect(text).toContain('Before.');
    expect(text).toContain('After.');
    expect(text).not.toContain('<od-card');
    expect(text).not.toContain('"used"');
    expect(container.querySelector('[data-od-card]')).toBeNull();
  });

  it('keeps a fenced od-card example visible as prose', () => {
    const fenced = '```html\n<od-card type="task-brief">{"summary":"Doc"}</od-card>\n```';
    const container = renderAssistant(fenced);
    const text = container.textContent ?? '';
    expect(text).toContain('<od-card');
    expect(container.querySelector('[data-od-card]')).toBeNull();
  });

  it('withholds an unclosed opener while streaming instead of flashing raw markup', () => {
    const container = renderAssistant(
      'Reading your preferences.\n\n<od-card type="memory-applied">{"sum',
      true,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Reading your preferences.');
    expect(text).not.toContain('<od-card');
  });
});

describe('AssistantMessage thinking stream od-card', () => {
  it('decodes a valid card inside the thinking body', () => {
    const container = renderThinking(`Considering options.\n\n${VALID_CARD}`);
    const body = container.querySelector('.thinking-body');
    expect(body).not.toBeNull();
    expect(body!.querySelector('[data-od-card="memory-applied"]')).not.toBeNull();
    expect(body!.textContent ?? '').toContain('Considering options.');
    expect(body!.textContent ?? '').not.toContain('<od-card');
  });

  it('drops a malformed closed card inside the thinking body', () => {
    const container = renderThinking(`Considering options.\n\n${MALFORMED_CARD}`);
    const body = container.querySelector('.thinking-body');
    expect(body).not.toBeNull();
    const text = body!.textContent ?? '';
    expect(text).toContain('Considering options.');
    expect(text).not.toContain('<od-card');
    expect(body!.querySelector('[data-od-card]')).toBeNull();
  });

  it('withholds an unclosed card in the thinking stream while live', () => {
    const container = renderThinking(
      'Considering options.\n\n<od-card type="memory-applied">{"sum',
      true,
    );
    const body = container.querySelector('.thinking-body');
    expect(body).not.toBeNull();
    const text = body!.textContent ?? '';
    expect(text).toContain('Considering options.');
    expect(text).not.toContain('<od-card');
  });
});
