import { describe, expect, it } from 'vitest';
import { codeDayMessage } from './SignInFlow';

// An address's day of codes (liveworkspace/docs/specs/003-accounts/sign-in.md "A day's codes per address"): the
// accounts Worker's two refusals each get their own words, naming Google when the page offers it.
describe('codeDayMessage', () => {
  it('says signing in with a code is locked for the day, and points at Google when there is one', () => {
    expect(codeDayMessage('CODE_SIGN_IN_LOCKED', true)).toBe(
      'Too many wrong codes for this address today. Continue with Google, or try again tomorrow.',
    );
    expect(codeDayMessage('CODE_SIGN_IN_LOCKED', false)).toBe(
      'Too many wrong codes for this address today. Try again tomorrow.',
    );
  });

  it("says the day's codes are all sent", () => {
    expect(codeDayMessage('TOO_MANY_CODES', true)).toBe(
      'Too many codes sent to this address today. Continue with Google, or try again tomorrow.',
    );
    expect(codeDayMessage('TOO_MANY_CODES', false)).toBe(
      'Too many codes sent to this address today. Try again tomorrow.',
    );
  });

  it('leaves every other answer to the page', () => {
    expect(codeDayMessage('RATE_LIMITED', true)).toBeNull();
    expect(codeDayMessage(undefined, true)).toBeNull();
  });
});
