import { describe, expect, it } from 'vitest';
import { accountInitials } from './account-avatar';

describe('accountInitials', () => {
  it('takes two letters, from the first and last names', () => {
    expect(accountInitials({ firstName: 'Ada', lastName: 'Quinn', username: null })).toBe('AQ');
    expect(accountInitials({ firstName: 'webber', lastName: null, username: 'wt' })).toBe('WE');
  });

  it('falls back to the full name, the username, the email, then a question mark', () => {
    expect(
      accountInitials({ firstName: null, lastName: null, fullName: 'Tom Ray', username: null }),
    ).toBe('TR');
    expect(accountInitials({ firstName: null, username: 'tom' })).toBe('TO');
    expect(
      accountInitials({ firstName: '\u{1F680}', username: null, email: 'ada.quinn@example.com' }),
    ).toBe('AQ');
    expect(accountInitials({ firstName: null, username: null })).toBe('?');
    expect(accountInitials(null)).toBe('?');
  });
});
