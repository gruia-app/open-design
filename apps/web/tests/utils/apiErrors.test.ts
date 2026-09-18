import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '../../src/utils/apiErrors';

describe('apiErrorMessage', () => {
  it('reads the canonical envelope shape', () => {
    expect(
      apiErrorMessage(
        { error: { code: 'NOT_FOUND', message: 'routine not found' } },
        'fallback',
      ),
    ).toBe('routine not found');
  });

  it('reads the legacy flat string shape', () => {
    expect(apiErrorMessage({ error: 'routine not found' }, 'fallback')).toBe(
      'routine not found',
    );
  });

  it('prefers the flat message over a string code', () => {
    expect(
      apiErrorMessage(
        { error: 'WORKSPACE_RESOURCE_SHARE_DENIED', message: 'share denied' },
        'fallback',
      ),
    ).toBe('share denied');
  });

  it('falls back when the body is unusable', () => {
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback');
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ error: {} }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ error: { code: 'X' } }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage('nope', 'fallback')).toBe('fallback');
  });
});
