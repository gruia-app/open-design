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
