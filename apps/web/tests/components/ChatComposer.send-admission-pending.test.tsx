// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer } from '../../src/components/ChatComposer';
import { flushMounts, typeAndSettle } from '../helpers/lexical-composer';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// OPEND-3265 (upstream #8069): while a send's admission is in flight the
// action button must show a disabled "preparing" affordance — not flap
// between send and stop when the transcript starts streaming first.
describe('ChatComposer send admission pending action', () => {
  it('shows a disabled pending button until the deferred send settles', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const onSend = vi.fn(() => gate.then(() => undefined));
    render(
      <ChatComposer
        projectId="project-1"
        projectFiles={[]}
        streaming={false}
        onEnsureProject={async () => 'project-1'}
        onSend={onSend}
        onStop={vi.fn()}
      />,
    );
    await flushMounts();
    await typeAndSettle('hold this send');

    fireEvent.click(screen.getByTestId('chat-send'));
    await act(async () => { await Promise.resolve(); });

    const pending = screen.getByTestId('chat-send-pending') as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    expect(pending).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('chat-send')).toBeNull();
    // A second click during admission cannot enqueue the same payload again.
    fireEvent.click(pending);
    expect(onSend).toHaveBeenCalledTimes(1);

    await act(async () => { release?.(); await gate; });
    expect(screen.queryByTestId('chat-send-pending')).toBeNull();
    expect(screen.getByTestId('chat-send')).toBeInTheDocument();
  });

  it('keeps the pending button visible over a stop button once streaming begins', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const onSend = vi.fn(() => gate.then(() => undefined));
    const onStop = vi.fn();
    const view = render(
      <ChatComposer
        projectId="project-1"
        projectFiles={[]}
        streaming={false}
        onEnsureProject={async () => 'project-1'}
        onSend={onSend}
        onStop={onStop}
      />,
    );
    await flushMounts();
    await typeAndSettle('in-flight during stream start');

    fireEvent.click(screen.getByTestId('chat-send'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('chat-send-pending')).toBeInTheDocument();

    // The transcript may enter streaming before admission completes; the
    // pending action must still win over the stop affordance.
    view.rerender(
      <ChatComposer
        projectId="project-1"
        projectFiles={[]}
        streaming
        onEnsureProject={async () => 'project-1'}
        onSend={onSend}
        onStop={onStop}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('chat-send-pending')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop')).toBeNull();

    await act(async () => { release?.(); await gate; });
    expect(screen.queryByTestId('chat-send-pending')).toBeNull();
  });
});
