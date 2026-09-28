// @vitest-environment jsdom
//
// The rail overlay drawer is gated on the `(max-width: 1080px)` media query.
// jsdom ships no `window.matchMedia`, and the shared setup deliberately does
// not polyfill it — an absent API must degrade to the docked desktop rail
// (no Escape-to-dismiss), not a TypeError. This spec exercises both halves:
// the missing-API path the setup leaves behind, and the overlay path when a
// suite installs its own matchMedia stub.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntryShell } from '../../src/components/EntryShell';
import { RAIL_OPEN_STORAGE_KEY } from '../../src/components/entryRailBridge';
import {
  resetTeamProjectsCache,
  resetWorkspaceBillingCache,
  resetWorkspaceContextCache,
} from '../../src/collab/useWorkspaceContext';
import { I18nProvider } from '../../src/i18n';
import type { AgentInfo, AppConfig } from '../../src/types';

const originalFetch = globalThis.fetch;
const originalResizeObserver = globalThis.ResizeObserver;

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function testAgent(): AgentInfo {
  return {
    id: 'claude',
    name: 'Claude',
    bin: 'claude',
    available: true,
    models: [{ id: 'opus', label: 'Opus' }],
  };
}

function testConfig(): AppConfig {
  return {
    mode: 'daemon',
    agentId: 'claude',
    agentModels: { claude: { model: 'opus' } },
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

function renderShell() {
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
        config={testConfig()}
        agents={[testAgent()]}
        amrLoggedIn={false}
        amrSessionState="signed_out"
        daemonLive
        onModeChange={vi.fn()}
        onAgentChange={vi.fn()}
        onAgentModelChange={vi.fn()}
        onApiProtocolChange={vi.fn()}
        onApiModelChange={vi.fn()}
        onConfigPersist={vi.fn()}
        onRefreshAgents={vi.fn(() => [testAgent()])}
        onCreateProject={vi.fn(async () => true)}
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

function railIsOpen(): boolean {
  return Boolean(document.querySelector('.entry')?.classList.contains('entry--rail-open'));
}

function stubMediaMatching(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(max-width: 1080px)' && matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

describe('EntryShell rail overlay media query', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    resetWorkspaceContextCache();
    resetWorkspaceBillingCache();
    resetTeamProjectsCache();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/plugins')) return jsonResponse({ plugins: [] });
      if (url.endsWith('/api/mcp/servers')) return jsonResponse({ servers: [] });
      return jsonResponse({});
    }) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.ResizeObserver = originalResizeObserver;
    resetWorkspaceContextCache();
    resetWorkspaceBillingCache();
    resetTeamProjectsCache();
  });

  it('renders and keeps the restored rail open when matchMedia is absent', async () => {
    // No stub: the shared setup no longer polyfills matchMedia, so this test
    // observes exactly the API-absent path a non-guarded caller would hit.
    expect(typeof window.matchMedia).not.toBe('function');
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, 'true');

    renderShell();
    await act(async () => {
      await Promise.resolve();
    });

    expect(railIsOpen()).toBe(true);
    // Docked rail: the overlay-only Escape dismiss is not wired up.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(railIsOpen()).toBe(true);
  });

  it('dismisses the overlay rail with Escape when the query matches', async () => {
    stubMediaMatching(true);
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, 'true');

    renderShell();
    await act(async () => {
      await Promise.resolve();
    });

    expect(railIsOpen()).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(railIsOpen()).toBe(false));
  });
});
