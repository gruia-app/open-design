import fs from 'node:fs';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCollabPublishWatcher } from '../../src/collab/collab-publish-watcher.js';
import type { CollabPublishWatcher, CollabPublishWatcherDeps } from '../../src/collab/collab-publish-watcher.js';
import type { ResourceHubPrincipal } from '../../src/collab/resource-principal.js';

const principal: ResourceHubPrincipal = {
  memberId: 'owner', teamId: 'team', role: 'owner', lifecycleState: 'active',
};
const watchers: CollabPublishWatcher[] = [];

function fixture(overrides: Partial<CollabPublishWatcherDeps> = {}) {
  const db = { open: true };
  const assertOpen = () => {
    if (!db.open) throw new TypeError('The database connection is not open');
  };
  const callbacks = new Map<string, () => void>();
  const unsubscribe = vi.fn();
  const deps = {
    listProjectIds: vi.fn(overrides.listProjectIds ?? (() => { assertOpen(); return ['owned']; })),
    shouldPublish: vi.fn(overrides.shouldPublish ?? (async () => principal)),
    subscribeFiles: vi.fn(overrides.subscribeFiles ?? ((id: string, onChange: () => void) => {
      assertOpen();
      callbacks.set(id, onChange);
      return { unsubscribe };
    })),
    notifyChanged: vi.fn<CollabPublishWatcherDeps['notifyChanged']>(overrides.notifyChanged),
    onError: vi.fn(overrides.onError),
    reconcileMs: overrides.reconcileMs ?? 100,
  };
  const watcher = createCollabPublishWatcher(deps);
  watchers.push(watcher);
  return { db, callbacks, unsubscribe, deps, watcher };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const watcher of watchers.splice(0)) watcher.dispose();
  vi.useRealTimers();
});

describe('collab publish watcher lifecycle', () => {
  it('stops repeating reconciliation when server cleanup precedes SQLite close', async () => {
    const { db, deps, watcher } = fixture();
    watcher.start();
    await vi.advanceTimersByTimeAsync(0);
    // Execute the actual server cleanup body with inert sibling services. This
    // reproduces the HTTP-close -> cleanup -> DB-close ordering without SQLite.
    const source = fs.readFileSync(new URL('../../src/server.ts', import.meta.url), 'utf8');
    const cleanup = source.match(/const cleanupDaemonBackgroundWork = \(\) => \{([\s\S]*?)\n    \};/)?.[1];
    expect(cleanup).toBeDefined();
    const service = { stop: vi.fn(), dispose: vi.fn(), disposeFatalHandlers: vi.fn(), stopCatalogRefreshLoop: vi.fn() };
    vm.runInNewContext(`(() => {${cleanup}})()`, {
      collabPublishWatcher: watcher,
      messageEventPayloadHeal: null,
      clearTerminalTelemetryFallbackTimers: vi.fn(),
      amrTerminalReportDelivery: service,
      telemetry: service,
      composioConnectorProvider: service,
      orbitService: service,
      routineService: service,
      clearInterval: vi.fn(),
      teamResourcesPollTimer: null,
      workspaceHubSubscriptions: service,
      hubEventRefreshes: service,
      workspaceDirectoryRefreshes: service,
      workspaceBillingRuntime: service,
      proactiveContentPull: service,
      collabCloud: service,
    });
    db.open = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(deps.onError).not.toHaveBeenCalled();
    expect(deps.listProjectIds).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels its interval and makes late start/reconcile calls inert after DB teardown', async () => {
    const { db, deps, watcher, unsubscribe } = fixture();
    watcher.start();
    watcher.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(deps.listProjectIds).toHaveBeenCalledTimes(2);
    watcher.dispose();
    watcher.dispose();
    db.open = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(vi.getTimerCount()).toBe(0);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(deps.listProjectIds).toHaveBeenCalledTimes(2);
    watcher.start();
    await watcher.reconcile();
    await vi.advanceTimersByTimeAsync(300);
    expect(deps.onError).not.toHaveBeenCalled();
    expect(deps.listProjectIds).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not subscribe or first-publish when ownership resolves after disposal', async () => {
    let resolveOwnership!: (value: ResourceHubPrincipal) => void;
    const ownership = new Promise<ResourceHubPrincipal>((resolve) => { resolveOwnership = resolve; });
    const { db, deps, watcher } = fixture({ shouldPublish: vi.fn(() => ownership) });
    const pending = watcher.reconcile();
    expect(deps.shouldPublish).toHaveBeenCalledTimes(1);
    watcher.dispose();
    db.open = false;
    resolveOwnership(principal);
    await pending;
    expect(deps.subscribeFiles).not.toHaveBeenCalled();
    expect(deps.notifyChanged).not.toHaveBeenCalled();
  });

  it('does not check more projects when an in-flight ownership check rejects during teardown', async () => {
    let rejectOwnership!: (error: Error) => void;
    const ownership = new Promise<boolean>((_resolve, reject) => { rejectOwnership = reject; });
    const { db, deps, watcher } = fixture({
      listProjectIds: vi.fn(() => ['owned', 'next']),
      shouldPublish: vi.fn(() => ownership),
    });
    const pending = watcher.reconcile();
    watcher.dispose();
    db.open = false;
    rejectOwnership(new Error('ownership unavailable'));
    await pending;
    expect(deps.shouldPublish).toHaveBeenCalledTimes(1);
    expect(deps.subscribeFiles).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledTimes(1);
  });

  it('ignores queued file events after disposal', async () => {
    const { callbacks, deps, watcher } = fixture();
    await watcher.reconcile();
    expect(deps.notifyChanged).toHaveBeenCalledTimes(1);
    watcher.dispose();
    callbacks.get('owned')!();
    expect(deps.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('first-publishes only owned projects, preserves principal, and coalesces overlapping reconciliation', async () => {
    const { callbacks, deps, watcher } = fixture({
      listProjectIds: vi.fn(() => ['owned', 'read-only', 'unshared']),
      shouldPublish: vi.fn(async (id: string) => id === 'owned' ? principal : false),
    });
    await Promise.all([watcher.reconcile(), watcher.reconcile()]);
    await watcher.reconcile();
    expect(deps.subscribeFiles).toHaveBeenCalledTimes(1);
    expect(deps.notifyChanged.mock.calls).toEqual([['owned', principal]]);
    expect(callbacks.has('read-only')).toBe(false);
    expect(callbacks.has('unshared')).toBe(false);
    callbacks.get('owned')!();
    expect(deps.notifyChanged.mock.calls).toEqual([['owned', principal], ['owned', principal]]);
  });

  it('drops removed projects and first-publishes again when they return with the boolean gate', async () => {
    let ids = ['owned'];
    const { deps, watcher, unsubscribe } = fixture({
      listProjectIds: vi.fn(() => ids), shouldPublish: vi.fn(async () => true),
    });
    await watcher.reconcile();
    await watcher.reconcile();
    expect(deps.notifyChanged.mock.calls).toEqual([['owned']]);
    ids = [];
    await watcher.reconcile();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    ids = ['owned'];
    await watcher.reconcile();
    expect(deps.subscribeFiles).toHaveBeenCalledTimes(2);
    expect(deps.notifyChanged.mock.calls).toEqual([['owned'], ['owned']]);
  });

  it('keeps live ownership errors visible and retries on the next reconciliation', async () => {
    const shouldPublish = vi.fn<CollabPublishWatcherDeps['shouldPublish']>()
      .mockRejectedValueOnce(new Error('ownership unavailable')).mockResolvedValue(principal);
    const { deps, watcher } = fixture({ shouldPublish });
    await watcher.reconcile();
    expect(deps.onError).toHaveBeenCalledTimes(1);
    expect(deps.subscribeFiles).not.toHaveBeenCalled();
    await watcher.reconcile();
    expect(deps.notifyChanged).toHaveBeenCalledWith('owned', principal);
  });

  it('wires disposal into server cleanup and shutdown before asynchronous run teardown', () => {
    // Wiring guard complements the public watcher lifecycle tests without
    // importing startServer (which opens real SQLite and starts other services).
    const source = fs.readFileSync(new URL('../../src/server.ts', import.meta.url), 'utf8');
    const cleanup = source.match(/const cleanupDaemonBackgroundWork = \(\) => \{([\s\S]*?)\n    \};/)?.[1];
    const shutdown = source.match(/const shutdownDaemonRuns = async \(\) => \{([\s\S]*?)\n    \};/)?.[1];
    expect(cleanup).toContain('collabPublishWatcher.dispose();');
    expect(shutdown?.split('await ')[0]).toContain('collabPublishWatcher.dispose();');
  });
});
