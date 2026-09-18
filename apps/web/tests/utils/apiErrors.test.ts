import { describe, expect, it } from 'vitest';
import { apiErrorCode, apiErrorMessage } from '../../src/utils/apiErrors';

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

describe('apiErrorCode', () => {
  it('reads the canonical envelope code', () => {
    expect(
      apiErrorCode({ error: { code: 'workspace_not_authorized', message: 'denied' } }),
    ).toBe('workspace_not_authorized');
  });

  it('reads the legacy flat token', () => {
    expect(apiErrorCode({ error: 'workspace_not_visible' })).toBe('workspace_not_visible');
  });

  it('reads the legacy flat-fields code', () => {
    expect(
      apiErrorCode({ error: 'WORKSPACE_ACCESS_DENIED', message: 'not available' }),
    ).toBe('WORKSPACE_ACCESS_DENIED');
  });

  it('returns undefined when no usable code is present', () => {
    expect(apiErrorCode({})).toBeUndefined();
    expect(apiErrorCode(null)).toBeUndefined();
    expect(apiErrorCode({ error: {} })).toBeUndefined();
    expect(apiErrorCode({ error: '   ' })).toBeUndefined();
    expect(apiErrorCode('nope')).toBeUndefined();
  });
});
