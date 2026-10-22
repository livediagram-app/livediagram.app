import { describe, expect, it } from 'vitest';
import { accountInitial } from './account-avatar';

describe('accountInitial', () => {
  it("derives the initial from first name, username, then '?'", () => {
    expect(accountInitial({ firstName: 'webber', username: 'wt' })).toBe('W');
    expect(accountInitial({ firstName: null, username: 'tom' })).toBe('T');
    expect(accountInitial({ firstName: null, username: null })).toBe('?');
    expect(accountInitial(null)).toBe('?');
  });
});
