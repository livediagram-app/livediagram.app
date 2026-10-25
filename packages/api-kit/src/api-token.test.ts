import { describe, expect, it } from 'vitest';
import {
  API_TOKEN_PREFIX,
  hasApiTokenPrefix,
  isApiTokenFormat,
  LEGACY_API_TOKEN_PREFIX,
} from './api-token';

describe('isApiTokenFormat', () => {
  it('tells an lwt_ token from a JWT and from a short string', () => {
    expect(isApiTokenFormat(`${API_TOKEN_PREFIX}${'a'.repeat(43)}`)).toBe(true);
    expect(isApiTokenFormat('eyJhbGciOi.payload.sig')).toBe(false);
    expect(isApiTokenFormat('lwt_short')).toBe(false);
  });

  it('takes an lvd_ token carried over from the old livediagram.app', () => {
    expect(isApiTokenFormat(`${LEGACY_API_TOKEN_PREFIX}${'a'.repeat(43)}`)).toBe(true);
    expect(isApiTokenFormat('lvd_short')).toBe(false);
    expect(isApiTokenFormat(`lvw_${'a'.repeat(43)}`)).toBe(false);
  });
});

describe('hasApiTokenPrefix', () => {
  it('claims either prefix, however short, and nothing else', () => {
    expect(hasApiTokenPrefix('lwt_x')).toBe(true);
    expect(hasApiTokenPrefix('lvd_x')).toBe(true);
    expect(hasApiTokenPrefix('lvw_x')).toBe(false);
    expect(hasApiTokenPrefix('eyJhbGciOi.payload.sig')).toBe(false);
  });
});
