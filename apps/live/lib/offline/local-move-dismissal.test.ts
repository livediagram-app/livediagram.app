// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { dismissLocalMove, shouldOfferLocalMove } from './local-move-dismissal';

// docs/specs/014-identity/auth-and-guest-access.md "Moving Local only documents after signing in".
describe('local move dismissal', () => {
  afterEach(() => localStorage.clear());

  it('offers when there is something to move and nothing was dismissed', () => {
    expect(shouldOfferLocalMove('user_1', 2)).toBe(true);
    expect(shouldOfferLocalMove('user_1', 0)).toBe(false);
  });

  it('stays quiet after Not Now until the count grows', () => {
    dismissLocalMove('user_1', 2);
    expect(shouldOfferLocalMove('user_1', 2)).toBe(false);
    expect(shouldOfferLocalMove('user_1', 1)).toBe(false);
    expect(shouldOfferLocalMove('user_1', 3)).toBe(true);
  });

  it('remembers per account', () => {
    dismissLocalMove('user_1', 2);
    expect(shouldOfferLocalMove('user_2', 2)).toBe(true);
  });

  it('reads a damaged entry as never dismissed', () => {
    localStorage.setItem('livediagram:v2:local-move-dismissed:user_1', 'banana');
    expect(shouldOfferLocalMove('user_1', 1)).toBe(true);
  });
});
