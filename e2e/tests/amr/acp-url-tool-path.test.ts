import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { expect, test } from 'vitest';
import type { PersistedAgentEvent } from '@open-design/contracts';
import { attachAcpSession } from '../../../apps/daemon/src/agent-protocol/acp/session.ts';
import { runSseEventToPersistedAgentEvent } from '../../../apps/daemon/src/runtimes/chat-run-messages.ts';

// This fork has no web-side `buildTurnBlocks` projection (its chat renderer
// diverged); the persisted `tool_use` event already carries the resolved
// `input.file_path`, which is what every consumer reads — so this test asserts
// directly on the persisted events the daemon emits.

class ReplayChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill() { return true; }
}

function rowsFor(update: Record<string, unknown>) {
  const child = new ReplayChild();
  const events: PersistedAgentEvent[] = [];
  const session = attachAcpSession({ child: child as never, prompt: 'inspect tools',
    cwd: '/tmp/od-project', model: null, mcpServers: [],
    send: (event, data) => {
      const persisted = runSseEventToPersistedAgentEvent(event, data);
      if (persisted) events.push(persisted);
    },
  });
  const write = (frame: unknown) => child.stdout.write(`${JSON.stringify(frame)}\n`);
  write({ id: 1, result: {} });
  write({ id: 2, result: { sessionId: 'url-tools' } });
  // Vela's recorded lifecycle: pending/running title is the tool name; the
  // terminal title is state.title (the command for bash). See the real corpus
  // and mapper in daemon/tests/fixtures/w123-export-acp-inflight-frames.ts.
  // Loopback URLs come from OPEND-2882; the HTTPS case is a control.
  // These are protocol fixtures, not incident bytes.
  for (const status of ['pending', 'in_progress', 'completed']) {
    write({ method: 'session/update', params: { sessionId: 'url-tools', update: {
      toolCallId: 'request-1', ...update, status,
      sessionUpdate: status === 'completed' ? 'tool_call_update' : 'tool_call',
      title: status === 'completed' ? update.title : update.kind,
    } } });
  }
  write({ id: 3, result: { stopReason: 'end_turn' } });
  session.abort();
  // The same persisted event representation is loaded by conversation history.
  const history = JSON.parse(JSON.stringify(events)) as PersistedAgentEvent[];
  return history
    .filter((event) => event.kind === 'tool_use')
    .map((event) => event as { name: string; input?: Record<string, unknown> });
}

test.each([
  'http://127.0.0.1:51680/api/media/models',
  'http://127.0.0.1:51680/api/media/models?provider=vela',
  'https://example.com/catalog/models.json?provider=vela',
])('ACP HTTP query retains its request instead of a fabricated local file: %s', url => {
  // Recorded w123 corpus command, with its daemon URL expanded to the issue URL.
  const command = `curl -s "${url}" 2>&1 | head -40`;
  const rows = rowsFor({ kind: 'bash', title: command, rawInput: { command } });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.input).toMatchObject({ command });
  expect(rows[0]?.input?.file_path, 'a URL must not be fabricated into a local file path').toBeUndefined();
});

test.each([
  { title: 'Read ./notes.md', rawInput: {}, path: './notes.md' },
  { title: 'Read //server/share/notes.md', rawInput: {}, path: '//server/share/notes.md' },
  { title: 'Read https://example.com/schema.json and ./notes.md', rawInput: {}, path: './notes.md' },
  { title: 'Read C:\\work\\notes.md', rawInput: { file_path: 'C:\\work\\notes.md' }, path: 'C:\\work\\notes.md' },
  { title: 'Read http://127.0.0.1:51680/api/media/models into local file', rawInput: { file_path: 'models.json' }, path: 'models.json' },
])('ACP keeps actual local file targets: $path', ({ title, rawInput, path }) => {
  const rows = rowsFor({ kind: 'read', title, rawInput });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.input?.file_path).toBe(path);
});

test('ACP locations keep their explicit local target even when the title contains a URL', () => {
  const rows = rowsFor({ kind: 'read', title: 'Read https://example.com/schema.json',
    locations: [{ path: './schema.json' }], rawInput: {} });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.input?.file_path).toBe('./schema.json');
});
