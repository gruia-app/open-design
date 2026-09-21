import {
  DEFAULT_VELA_CONSOLE_ORIGIN,
  resolveEffectiveVelaConsoleOrigin,
} from './vela-console-origin.js';

type EnvMap = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type AmrAccountErrorCode =
  | 'AMR_AUTH_REQUIRED'
  | 'AMR_INSUFFICIENT_BALANCE'
  | 'AMR_TIER_UPGRADE_REQUIRED';

export interface AmrAccountFailure {
  code: AmrAccountErrorCode;
  message: string;
  action: 'relogin' | 'recharge' | 'upgrade';
  actionUrl?: string;
}

export interface AmrAccountFailureSignal {
  details?: unknown;
  message?: unknown;
  errorMessage?: unknown;
  errorCode?: unknown;
  stdoutTail?: unknown;
  stderrTail?: unknown;
}

// `source=open_design` tags the console landing page_view so vela analytics can
// attribute the recharge visit to OpenDesign.
//
// The console dashboard, not a wallet page: balance and manual top-up were
// rehomed onto it (vela #1055) and the wallet route left the product's
// information architecture, so this link must not send a user there.
export const DEFAULT_AMR_RECHARGE_URL =
  `${DEFAULT_VELA_CONSOLE_ORIGIN}/dashboard?source=open_design`;

export function amrRechargeUrl(configuredEnv: EnvMap = {}): string {
  const origin = resolveEffectiveVelaConsoleOrigin(process.env, configuredEnv)
    ?? DEFAULT_VELA_CONSOLE_ORIGIN;
  return `${origin}/dashboard?source=open_design`;
}

const AMR_AUTH_REQUIRED_MESSAGE =
  'AMR sign-in is required. Sign in to AMR Cloud again, then retry this run.';

const AMR_TIER_UPGRADE_REQUIRED_MESSAGE =
  'Your current AMR plan does not include this model or request type. Upgrade your AMR plan, or switch to an available model and retry.';

const AMR_TIER_REQUEST_KIND_NOT_ENTITLED_MESSAGE =
  'Your current AMR plan does not include this request type yet. Upgrade your AMR plan, or switch to a supported model and retry.';

function normalizeFailureText(text: string): string {
  return String(text || '').toLowerCase();
}

function containsInsufficientBalanceSignal(value: string): boolean {
  if (
    value.includes('insufficient_balance') ||
    value.includes('insufficient balance') ||
    value.includes('insufficient wallet balance') ||
    value.includes('insufficient credits') ||
    value.includes('insufficient credit') ||
    value.includes('insufficient funds') ||
    value.includes('not enough balance') ||
    value.includes('not enough credits') ||
    value.includes('balance is empty') ||
    value.includes('balance too low') ||
    value.includes('billing balance') ||
    // vela returns the pre-charge (额度预扣) failure in Chinese when the wallet
    // cannot cover a model call; this currently leaks into execution_failed.
    value.includes('预扣费额度失败') ||
    value.includes('余额不足') ||
    value.includes('额度不足')
  ) {
    return true;
  }
  return value.includes('quota') && /\b(wallet|balance|credit|billing|funds?)\b/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function insufficientBalanceFailure(configuredEnv: EnvMap): AmrAccountFailure {
  const actionUrl = amrRechargeUrl(configuredEnv);
  return {
    code: 'AMR_INSUFFICIENT_BALANCE',
    message:
      `AMR Cloud reported insufficient balance for this model. Top up your AMR balance at ${actionUrl}, then retry this run.`,
    action: 'recharge',
    actionUrl,
  };
}

export function classifyAmrAccountFailureDetails(
  details: unknown,
  configuredEnv: EnvMap = {},
): AmrAccountFailure | null {
  if (!isRecord(details)) return null;
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const accountAction =
    typeof details.accountAction === 'string' ? details.accountAction.toLowerCase() : '';

  if (code === 'insufficient_balance' || accountAction === 'recharge') {
    return insufficientBalanceFailure(configuredEnv);
  }

  if (code === 'tier_model_not_entitled') {
    return {
      code: 'AMR_TIER_UPGRADE_REQUIRED',
      message: AMR_TIER_UPGRADE_REQUIRED_MESSAGE,
      action: 'upgrade',
    };
  }

  if (code === 'tier_request_kind_not_entitled') {
    return {
      code: 'AMR_TIER_UPGRADE_REQUIRED',
      message: AMR_TIER_REQUEST_KIND_NOT_ENTITLED_MESSAGE,
      action: 'upgrade',
    };
  }

  if (code === 'auth_required' || accountAction === 'relogin') {
    return {
      code: 'AMR_AUTH_REQUIRED',
      message: AMR_AUTH_REQUIRED_MESSAGE,
      action: 'relogin',
    };
  }

  return null;
}

function stringPart(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function classifyAmrAccountFailureSignal(
  signal: AmrAccountFailureSignal,
  configuredEnv: EnvMap = {},
): AmrAccountFailure | null {
  const structured = classifyAmrAccountFailureDetails(signal.details, configuredEnv);
  if (structured) return structured;

  const primaryText = [
    stringPart(signal.message),
    stringPart(signal.errorMessage),
    stringPart(signal.errorCode),
    stringPart(signal.stdoutTail),
  ].join('\n');
  const primary = classifyAmrAccountFailure(primaryText, configuredEnv);
  if (primary) return primary;

  // Stderr is intentionally last. Prefer ACP structured details and protocol
  // messages so AMR account errors are managed through one stable channel.
  return classifyAmrAccountFailure(stringPart(signal.stderrTail), configuredEnv);
}

export function classifyAmrAccountFailure(
  text: string,
  configuredEnv: EnvMap = {},
): AmrAccountFailure | null {
  const value = normalizeFailureText(text);
  if (!value.trim()) return null;

  if (containsInsufficientBalanceSignal(value)) {
    return insufficientBalanceFailure(configuredEnv);
  }

  if (value.includes('tier_model_not_entitled')) {
    return {
      code: 'AMR_TIER_UPGRADE_REQUIRED',
      message: AMR_TIER_UPGRADE_REQUIRED_MESSAGE,
      action: 'upgrade',
    };
  }

  if (value.includes('tier_request_kind_not_entitled')) {
    return {
      code: 'AMR_TIER_UPGRADE_REQUIRED',
      message: AMR_TIER_REQUEST_KIND_NOT_ENTITLED_MESSAGE,
      action: 'upgrade',
    };
  }

  if (
    value.includes('auth_required') ||
    value.includes('authentication required') ||
    value.includes('not authenticated') ||
    value.includes('unauthenticated') ||
    value.includes('not logged in') ||
    value.includes('login missing') ||
    value.includes('sign in again') ||
    value.includes('sign-in-again') ||
    value.includes('sign-in required') ||
    value.includes('signin required') ||
    value.includes('token has expired') ||
    value.includes('expired token') ||
    value.includes('invalid session') ||
    value.includes('expired session') ||
    value.includes('session expired')
  ) {
    return {
      code: 'AMR_AUTH_REQUIRED',
      message: AMR_AUTH_REQUIRED_MESSAGE,
      action: 'relogin',
    };
  }

  return null;
}

export function amrAccountFailureDetails(failure: AmrAccountFailure) {
  return {
    kind: 'amr_account',
    action: failure.action,
    ...(failure.actionUrl ? { actionUrl: failure.actionUrl } : {}),
  };
}
