import type { AppConfig } from '../types';

// Set only by the Gruia production build. Authentication and Claude credentials
// belong to the host; the upstream cloud/BYOK setup is not part of this product.
export const GRUIA_MANAGED = process.env.NEXT_PUBLIC_GRUIA_MANAGED === '1';

export function applyGruiaRuntime(config: AppConfig): AppConfig {
  if (!GRUIA_MANAGED) return config;
  return {
    ...config,
    mode: 'daemon',
    agentId: 'claude',
    onboardingCompleted: true,
    agentModels: {
      ...config.agentModels,
      claude: {
        ...config.agentModels?.claude,
        model: config.agentModels?.claude?.model || 'sonnet',
      },
    },
    telemetry: { metrics: false, content: false, artifactManifest: false },
    privacyDecisionAt: config.privacyDecisionAt || Date.now(),
  };
}
