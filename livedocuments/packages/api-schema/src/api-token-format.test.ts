import { describe, expect, it } from 'vitest';
import { API_TOKEN_PREFIX, isApiTokenFormat } from './api-token-format';

describe('isApiTokenFormat', () => {
  it('tells an lvd_ token from a JWT and from a short string', () => {
    expect(isApiTokenFormat(`${API_TOKEN_PREFIX}${'a'.repeat(43)}`)).toBe(true);
    expect(isApiTokenFormat('eyJhbGciOi.payload.sig')).toBe(false);
    expect(isApiTokenFormat('lvd_short')).toBe(false);
  });
});
