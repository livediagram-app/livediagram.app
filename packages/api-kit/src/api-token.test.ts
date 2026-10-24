import { describe, expect, it } from 'vitest';
import { API_TOKEN_PREFIX, isApiTokenFormat } from './api-token';

describe('isApiTokenFormat', () => {
  it('tells an lwt_ token from a JWT and from a short string', () => {
    expect(isApiTokenFormat(`${API_TOKEN_PREFIX}${'a'.repeat(43)}`)).toBe(true);
    expect(isApiTokenFormat('eyJhbGciOi.payload.sig')).toBe(false);
    expect(isApiTokenFormat('lwt_short')).toBe(false);
  });
});
