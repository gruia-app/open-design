import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function configModule(managed: boolean, saved?: Record<string, unknown>) {
  vi.stubEnv('NEXT_PUBLIC_GRUIA_MANAGED', managed ? '1' : '');
  vi.stubGlobal('localStorage', {
    getItem: () => saved ? JSON.stringify(saved) : null,
    setItem: vi.fn(),
  });
  return import('../../src/state/config');
}

describe('Gruia managed startup', () => {
  it('opens a fresh browser with Claude ready and upstream telemetry disabled', async () => {
    const { loadConfig } = await configModule(true);
    expect(loadConfig()).toMatchObject({
      mode: 'daemon', agentId: 'claude', onboardingCompleted: true,
      agentModels: { claude: { model: 'sonnet' } },
      telemetry: { metrics: false, content: false, artifactManifest: false },
    });
  });

  it.each(['api', 'daemon'])('repairs stale %s/cloud preferences without losing user preferences', async (mode) => {
    const { loadConfig, mergeDaemonConfig } = await configModule(true, {
      mode, agentId: 'amr', onboardingCompleted: false,
      skillId: 'my-design-skill', agentModels: { claude: { model: 'opus' } },
    });
    for (const server of [null, { agentId: null, onboardingCompleted: false }]) {
      expect(mergeDaemonConfig(loadConfig(), server)).toMatchObject({
        mode: 'daemon', agentId: 'claude', onboardingCompleted: true,
        skillId: 'my-design-skill', agentModels: { claude: { model: 'opus' } },
      });
    }
  });

  it('preserves the upstream setup flow outside the Gruia build', async () => {
    const { loadConfig } = await configModule(false);
    expect(loadConfig()).toMatchObject({ agentId: null, onboardingCompleted: false });
  });
});
