import { describe, expect, it } from 'vitest';
import { namesOf } from './account-names';

describe('namesOf', () => {
  const base = { email: 'grace.hopper@example.com' };

  it('uses the first and last name the accounts site asked for', () => {
    expect(
      namesOf({ ...base, givenName: ' Grace ', familyName: 'Brewster Hopper', name: 'ignored' }),
    ).toEqual({
      firstName: 'Grace',
      lastName: 'Brewster Hopper',
      fullName: 'Grace Brewster Hopper',
    });
    expect(namesOf({ ...base, givenName: null, familyName: 'Hopper' })).toEqual({
      firstName: 'Hopper',
      lastName: null,
      fullName: 'Hopper',
    });
  });

  it("splits the account's name at its first space without a given or family name", () => {
    expect(namesOf({ ...base, name: 'Grace Brewster Hopper' })).toEqual({
      firstName: 'Grace',
      lastName: 'Brewster Hopper',
      fullName: 'Grace Brewster Hopper',
    });
    expect(namesOf({ ...base, givenName: ' ', name: ' Grace ' })).toEqual({
      firstName: 'Grace',
      lastName: null,
      fullName: 'Grace',
    });
  });

  it("falls back to the email's local part, else nothing", () => {
    expect(namesOf({ ...base, name: null })).toEqual({
      firstName: 'grace.hopper',
      lastName: null,
      fullName: 'grace.hopper',
    });
    expect(namesOf({ email: null, name: '' })).toEqual({
      firstName: null,
      lastName: null,
      fullName: null,
    });
  });
});
