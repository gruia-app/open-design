// @vitest-environment jsdom
//
// OPEND-3300 / 3309 — a Home AMR send whose wallet the shell already knows is
// empty is answered on the click tick: the rail's own reading opens the
// balance dialog immediately, one background confirmation re-reads the
// wallet, and only a fundable answer moves the send on to the ordinary gate.
// Upstream pins the same fix behind the optimistic project frame; the fork
// gates before creation, so this pins the dialog-before-gate ordering here.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  buildWorkspacePermissions,
  buildWorkspaceSeatSummary,
  type AmrWalletSnapshot,
  type WorkspaceCollabContext,
} from '@open-design/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntryShell } from '../../src/components/EntryShell';
import {
  resetTeamProjectsCache,
  resetWorkspaceBillingCache,
  resetWorkspaceContextCache,
} from '../../src/collab/useWorkspaceContext';
import { I18nProvider } from '../../src/i18n';
import { checkAmrBalanceGate } from '../../src/runtime/amr-balance-gate';
import type { AmrBalanceGateResult } from '../../src/runtime/amr-balance-gate';
import type { AgentInfo, AppConfig } from '../../src/types';
import { setHomeHeroPrompt } from '../helpers/home-hero-lexical';
import { workspaceDirectoryFixture } from '../helpers/workspace-context';

vi.mock('../../src/runtime/amr-balance-gate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/runtime/amr-balance-gate')>();
  return {
    ...actual,
    checkAmrBalanceGate: vi.fn(),
  };
});

vi.mock('../../src/components/AmrBalanceDialog', () => ({
  AmrBalanceDialog: ({
    reason,
    onClose,
  }: {
    reason: 'insufficient' | 'signed_out';
    onClose: () => void;
  }) => (
    <div data-testid="amr-balance-dialog" data-reason={reason}>
      <button type="button" onClick={onClose}>Close gate</button>
    </div>
  ),
}));

const mockedCheckAmrBalanceGate = vi.mocked(checkAmrBalanceGate);
const originalFetch = globalThis.fetch;
const originalResizeObserver = globalThis.ResizeObserver;

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function teamContext(workspaceId: string, workspaceMemberId: string): WorkspaceCollabContext {
  const role = 'member' as const;
  const lifecycleState = 'active' as const;
  return {
    workspaceId,
    workspaceType: 'team',
    workspaceMemberId,
    role,
    memberStatus: 'active',
    lifecycleState,
    billingState: 'active',
    planId: 'team_plus',
    providerMode: 'platform_credits',
    seatSummary: buildWorkspaceSeatSummary({ seatLimit: 5, usedSeats: 1 }),
    permissions: buildWorkspacePermissions({ role, lifecycleState }),
  };
}

function emptyWalletSnapshot(): AmrWalletSnapshot {
  return {
    status: 'available',
    profile: 'default',
    user: null,
    balanceUsd: '0.00',
    updatedAt: null,
    fetchedAt: new Date(0).toISOString(),
    stale: false,
    source: 'vela_api',
  };
}

function amrAgent(): AgentInfo {
  return {
    id: 'amr',
    name: 'OpenDesign AMR',
    bin: 'amr',
    available: true,
    models: [{ id: 'glm-5', label: 'GLM 5' }],
  };
}

function amrConfig(): AppConfig {
  return {
    mode: 'daemon',
    agentId: 'amr',
    agentModels: { amr: { model: 'glm-5' } },
    apiProtocol: 'anthropic',
    apiProtocolConfigs: {},
    apiKey: '',
    baseUrl: '',
    model: '',
    skillId: null,
    designSystemId: null,
    theme: 'system',
  };
}

function renderShell(
  onCreateProject: ComponentProps<typeof EntryShell>['onCreateProject'],
) {
  return render(
    <I18nProvider initial="en">
      <EntryShell
        skills={[]}
        designTemplates={[]}
        designSystems={[]}
        projects={[]}
        templates={[]}
        promptTemplates={[]}
        defaultDesignSystemId={null}
        connectors={[]}
        connectorsLoading={false}
        config={amrConfig()}
        agents={[amrAgent()]}
        amrLoggedIn
        amrSessionState="authenticated"
        daemonLive
        onModeChange={vi.fn()}
        onAgentChange={vi.fn()}
        onAgentModelChange={vi.fn()}
        onApiProtocolChange={vi.fn()}
        onApiModelChange={vi.fn()}
        onConfigPersist={vi.fn()}
        onRefreshAgents={vi.fn(() => [amrAgent()])}
        onCreateProject={onCreateProject}
        onCreatePluginShareProject={vi.fn()}
        onImportClaudeDesign={vi.fn()}
        onOpenProject={vi.fn()}
        onOpenLiveArtifact={vi.fn()}
        onDeleteProject={vi.fn()}
        onRenameProject={vi.fn()}
        onChangeDefaultDesignSystem={vi.fn()}
        onPersistComposioKey={vi.fn()}
        onOpenSettings={vi.fn()}
        onCompleteOnboarding={vi.fn()}
      />
    </I18nProvider>,
  );
}

/** Workspace reads the shell needs before the send: directory, the identity
 *  context, and the billing projection whose $0 the rail already shows. */
function seedWorkspaceReads(workspace: WorkspaceCollabContext) {
  let contextReads = 0;
  let billingReads = 0;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/workspace/directory')) {
      return jsonResponse(workspaceDirectoryFixture([workspace]));
    }
    if (url.endsWith('/api/workspace/context')) {
      contextReads += 1;
      return jsonResponse({ context: workspace });
    }
    if (url.includes('/api/workspace/billing?')) {
      billingReads += 1;
      return jsonResponse({
        summary: null,
        workspaceBalance: {
          billingScopeVersion: 2,
          workspaceId: workspace.workspaceId,
          workspaceMemberId: workspace.workspaceMemberId,
          balanceUsd: '0.00',
          expiresAt: null,
          updatedAt: null,
        },
      });
    }
    if (url.endsWith('/api/workspace/projects/team')) {
      return jsonResponse({ projects: [] });
    }
    if (url.endsWith('/api/plugins')) return jsonResponse({ plugins: [] });
    if (url.endsWith('/api/mcp/servers')) return jsonResponse({ servers: [] });
    if (url.endsWith('/api/community/discord')) return jsonResponse({ stale: true });
    if (url.endsWith('/api/github/open-design')) return jsonResponse({ stale: true });
    return jsonResponse({});
  }) as typeof fetch;
  return {
    async settled() {
      await waitFor(() => {
        expect(contextReads).toBeGreaterThan(0);
        expect(billingReads).toBeGreaterThan(0);
      });
      await act(async () => {
        await Promise.resolve();
      });
    },
  };
}

describe('EntryShell AMR home memory balance gate (OPEND-3300)', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
    window.sessionStorage.clear();
    resetWorkspaceContextCache();
    resetWorkspaceBillingCache();
    resetTeamProjectsCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.ResizeObserver = originalResizeObserver;
    mockedCheckAmrBalanceGate.mockReset();
    resetWorkspaceContextCache();
    resetWorkspaceBillingCache();
    resetTeamProjectsCache();
  });

  it('answers a definitive $0 on the click tick; dismiss creates nothing', async () => {
    window.history.replaceState(null, '', '/');
    const workspace = teamContext('workspace-mem', 'member-mem');
    const reads = seedWorkspaceReads(workspace);
    const gate = deferred<AmrBalanceGateResult>();
    mockedCheckAmrBalanceGate.mockImplementation(() => gate.promise);
    const onCreateProject = vi.fn(async () => true);

    renderShell(onCreateProject);
    await reads.settled();
    const submitButton = await screen.findByTestId('home-hero-submit');
    setHomeHeroPrompt('Create a launch poster.');
    fireEvent.click(submitButton);

    // The dialog opens on the cached reading while the authoritative gate
    // has not answered yet — before the fix it only appeared after the
    // gate's full retry/read budget had elapsed.
    expect(await screen.findByTestId('amr-balance-dialog')).toBeTruthy();
    gate.resolve({ kind: 'hard', reason: 'insufficient', snapshot: emptyWalletSnapshot() });
    fireEvent.click(await screen.findByText('Close gate'));
    await waitFor(() => expect(screen.queryByTestId('amr-balance-dialog')).toBeNull());
    expect(onCreateProject).not.toHaveBeenCalled();
  });

  it('closes the dialog itself when the confirmation finds a fundable wallet', async () => {
    window.history.replaceState(null, '', '/');
    const workspace = teamContext('workspace-mem2', 'member-mem2');
    const reads = seedWorkspaceReads(workspace);
    const gate = deferred<AmrBalanceGateResult>();
    mockedCheckAmrBalanceGate
      .mockImplementationOnce(() => gate.promise)
      .mockResolvedValue({ kind: 'allow' });
    const onCreateProject = vi.fn(async () => true);

    renderShell(onCreateProject);
    await reads.settled();
    const submitButton = await screen.findByTestId('home-hero-submit');
    setHomeHeroPrompt('Create a quiet reading room scene.');
    fireEvent.click(submitButton);

    expect(await screen.findByTestId('amr-balance-dialog')).toBeTruthy();
    // The projection was stale: the re-read sees funds, so the dialog closes
    // itself and the same send falls through to the ordinary gate.
    gate.resolve({ kind: 'allow' });
    await waitFor(() => expect(screen.queryByTestId('amr-balance-dialog')).toBeNull());
    await waitFor(() => expect(onCreateProject).toHaveBeenCalledTimes(1));
  });
});
