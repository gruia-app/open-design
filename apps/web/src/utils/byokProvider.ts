import type { KnownProvider } from '../state/config';
import type { ApiProtocol } from '../types';

export function isLocalOllamaBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function byokProviderRequiresApiKey(
  protocol: ApiProtocol,
  provider: KnownProvider | undefined,
  baseUrl: string,
): boolean {
  if (provider?.requiresApiKey === false) return false;
  if (protocol === 'ollama' && isLocalOllamaBaseUrl(baseUrl)) return false;
  return true;
}

/**
 * The agent id stamped onto a run's assistant messages for each API protocol
 * (`ProjectView` writes it via `apiProtocolAgentId(config.apiProtocol)`).
 *
 * Lives here rather than `utils/apiProtocol.ts`: this table is the BYOK
 * tier's identity, and `runtime/amr-guidance.ts` reads it for the error card
 * without dragging in the provider stack (amr-guidance deliberately keeps
 * runtime-free imports). This module only has `import type`s.
 */
export const API_PROTOCOL_AGENT_IDS: Record<ApiProtocol, string> = {
  anthropic: 'anthropic-api',
  openai: 'openai-api',
  azure: 'azure-openai-api',
  google: 'google-gemini-api',
  ollama: 'ollama-cloud-api',
  senseaudio: 'senseaudio-api',
  aihubmix: 'aihubmix-api',
  bedrock: 'bedrock-api',
};

/** The daemon-mode OpenCode that runs BYOK jobs. */
export const BYOK_OPENCODE_AGENT_ID = 'byok-opencode';

const BYOK_MANAGED_AGENT_IDS: ReadonlySet<string> = new Set<string>([
  BYOK_OPENCODE_AGENT_ID,
  ...Object.values(API_PROTOCOL_AGENT_IDS),
]);

/**
 * Whether this run's API key is one WE hold — editable on the Settings screen.
 *
 * Not a new axis, but the same line the send-time BYOK gate draws, read the
 * other way: `ProjectView.requiresByokPreflight` is
 * `(mode === 'api' && protocol !== 'bedrock') || (mode === 'daemon' && agentId === 'byok-opencode')`,
 * and a `mode === 'api'` run lands on its messages as one of the
 * `API_PROTOCOL_AGENT_IDS`. The card side only holds `agentId`, so the check
 * keys on that — same tier, read consistently.
 *
 * `bedrock-api` counts here though not in the send-time gate: the gate asks
 * "can this start" (Bedrock uses AWS credentials — no single key to check),
 * while the card asks "which screen holds the credential" — Bedrock's also
 * lives on the API-provider screen.
 *
 * Local CLIs (`claude` / `codex` / `opencode` / `grok` / `deepseek`) are NOT
 * in this tier: their sign-in lives in the user's own terminal (`claude`
 * itself says `/login` on a bad key), the `*_API_KEY` fields in Settings are
 * advanced overrides for self-hosted proxies (`AGENT_CLI_ENV_FIELDS`), and
 * `opencode` / `kimi` / `qwen` have no key field on that screen at all.
 */
export function byokApiKeyIsEditableInSettings(
  agentId: string | null | undefined,
): boolean {
  return typeof agentId === 'string' && BYOK_MANAGED_AGENT_IDS.has(agentId);
}
