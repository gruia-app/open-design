/**
 * Extract a human-readable message from a daemon error response body that may
 * be in either shape:
 *
 * - canonical envelope: `{ error: { code, message, ... } }`
 * - legacy flat string: `{ error: 'message' }`
 * - legacy flat fields: `{ error: 'CODE', message: 'message' }`
 *
 * Returns `fallback` when no usable message is present.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const { error, message } = body as { error?: unknown; message?: unknown };
  if (typeof error === 'string' && error.length > 0) {
    return typeof message === 'string' && message.length > 0 ? message : error;
  }
  if (error && typeof error === 'object') {
    const inner = (error as { message?: unknown }).message;
    if (typeof inner === 'string' && inner.length > 0) return inner;
  }
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}

/**
 * Extract the machine error code from a daemon error response body that may
 * be in either shape:
 *
 * - canonical envelope: `{ error: { code, message, ... } }`
 * - legacy flat token: `{ error: 'some_token' }`
 * - legacy flat fields: `{ error: 'CODE', message: 'message' }`
 *
 * Returns `undefined` when no usable code is present.
 */
export function apiErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { error } = body as { error?: unknown };
  if (typeof error === 'string' && error.trim().length > 0) return error.trim();
  if (error && typeof error === 'object') {
    const inner = (error as { code?: unknown }).code;
    if (typeof inner === 'string' && inner.trim().length > 0) return inner.trim();
  }
  return undefined;
}
