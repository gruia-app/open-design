// @vitest-environment jsdom
//
// Adapted from nexu-io/open-design@9bb516218 (#7897): the AMR switch card's
// CTA only hands the turn to a host handler — `onSwitchToAmrAndRetry`,
// falling back to `onOpenAmrSettings`. Hosts that wire neither render a
// primary-looking button whose click is inert:
//   · `ProjectView`           — wires both
//   · `workspace/SideChatTab` — wires only `onRetry`
//   · `DesignSystemFlow`      — wires none of the AMR handlers
// The card must not render when no receiver exists; a host that can take
// the handoff must see exactly the same card as before.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatPane } from '../../src/components/ChatPane';
import type { AppConfig, ChatMessage } from '../../src/types';

const translate = (key: string, vars?: Record<string, string | number>) => {
  if (vars && Object.keys(vars).length > 0) {
    return `${key} ${Object.values(vars).join(' ')}`;
  }
  return key;
};

vi.mock('../../src/i18n', () => ({
  useI18n: () => ({ locale: 'en', setLocale: () => undefined, t: translate }),
  useT: () => translate,
}));

vi.mock('../../src/components/AssistantMessage', () => ({
  AssistantMessage: ({ message }: { message: ChatMessage }) => (
    <div data-testid={`assistant-${message.id}`}>{message.content}</div>
  ),
}));

vi.mock('../../src/components/ChatComposer', () => ({
  ChatComposer: forwardRef((_props, _ref) => <div data-testid="composer" />),
}));

vi.mock('../../src/analytics/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/analytics/events')>();
  return {
    ...actual,
    trackChatPanelClick: vi.fn(),
    trackRunFailedToastSurfaceView: vi.fn(),
    trackRunFailedToastGoAmrClick: vi.fn(),
    trackRunRecoveryActionClick: vi.fn(),
    trackRunRecoveryActionSurfaceView: vi.fn(),
  };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

// A non-AMR agent hitting AGENT_AUTH_REQUIRED resolves to the S02 card —
// `showSwitchCard: true`, so the AMR promo renders whenever the payload
// exists. That is exactly the case where an unwired host drew a dead button.
function failedMessage(): ChatMessage {
  return {
    id: 'msg-failed',
    role: 'assistant',
    content: '',
    createdAt: 1,
    runId: 'run-1',
    runStatus: 'failed',
    agentId: 'claude',
    events: [
      {
        kind: 'status',
        label: 'error',
        detail: 'Invalid API key · Please run /login',
        code: 'AGENT_AUTH_REQUIRED',
        failureDetail: 'invalid_api_key',
        failureAction: 'login',
        retryable: false,
      },
    ],
  } as unknown as ChatMessage;
}

interface HostWiring {
  onSwitchToAmrAndRetry?: (message: ChatMessage) => void;
  onOpenAmrSettings?: () => void;
}

function renderFailure(host: HostWiring) {
  const onRetry = vi.fn();
  const rendered = render(
    <ChatPane
      messages={[failedMessage()]}
      streaming={false}
      error="Invalid API key · Please run /login"
      errorSourceAssistantId="msg-failed"
      projectId="project-1"
      projectFiles={[]}
      onEnsureProject={async () => 'project-1'}
      onSend={vi.fn()}
      onStop={vi.fn()}
      onRetry={onRetry}
      conversations={[
        { projectId: 'project-1', id: 'conv-1', title: 'Current', createdAt: 1, updatedAt: 1 },
      ]}
      activeConversationId="conv-1"
      onSelectConversation={vi.fn()}
      onDeleteConversation={vi.fn()}
      config={{ agentId: 'claude', agentCliEnv: {} } as unknown as AppConfig}
      {...host}
    />,
  );
  return { ...rendered, onRetry };
}

const amrCardOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="amr-guidance"]');

describe('the AMR switch card only renders while a receiver exists', () => {
  it('SideChatTab wiring (onRetry only): no inert〔去 AMR〕card', () => {
    const { container } = renderFailure({});
    expect(amrCardOf(container)).toBeNull();
  });

  it('SideChatTab wiring: the working〔重试〕button stays and fires', () => {
    const { container, onRetry } = renderFailure({});
    const retry = container.querySelector('.chat-error-retry');
    expect(retry).toBeTruthy();
    fireEvent.click(retry!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('only onOpenAmrSettings wired: the card still renders (fallback receiver)', () => {
    const onOpenAmrSettings = vi.fn();
    const { container } = renderFailure({ onOpenAmrSettings });
    const card = amrCardOf(container);
    expect(card).toBeTruthy();
    fireEvent.click(card!.querySelector('.amr-card__cta')!);
    expect(onOpenAmrSettings).toHaveBeenCalledTimes(1);
  });

  it('ProjectView wiring (both handlers): the card renders and switches', () => {
    const onSwitchToAmrAndRetry = vi.fn();
    const onOpenAmrSettings = vi.fn();
    const { container } = renderFailure({ onSwitchToAmrAndRetry, onOpenAmrSettings });
    const card = amrCardOf(container);
    expect(card).toBeTruthy();
    fireEvent.click(card!.querySelector('.amr-card__cta')!);
    expect(onSwitchToAmrAndRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-failed' }),
    );
    expect(onOpenAmrSettings).not.toHaveBeenCalled();
  });
});
