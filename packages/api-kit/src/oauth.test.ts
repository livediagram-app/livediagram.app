import { describe, expect, it } from 'vitest';
import {
  CLI_REDIRECT_URIS,
  formatUserCode,
  isUserCode,
  newUserCode,
  normaliseUserCode,
  pkceChallenge,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
} from './oauth';

// Each product's docs/specs/015-api/blueprints/cli.md "OAuth server", CLI35, CLI36.

describe('the CLI client', () => {
  it('calls back on loopback', () => {
    expect(CLI_REDIRECT_URIS).toEqual(['http://127.0.0.1/callback', 'http://[::1]/callback']);
  });
});

describe('user codes', () => {
  it('are eight letters of the RFC 8628 alphabet, printed in two halves', () => {
    const code = newUserCode((n) => new Uint8Array(n).map((_, i) => i * 37));
    expect(code).toMatch(new RegExp(`^[${USER_CODE_ALPHABET}]{${USER_CODE_LENGTH}}$`));
    expect(formatUserCode('BCDFGHJK')).toBe('BCDF-GHJK');
  });

  it('match whatever case and separators a person types', () => {
    expect(normaliseUserCode(' bcdf-ghjk ')).toBe('BCDFGHJK');
    expect(normaliseUserCode('bcdf ghjk')).toBe('BCDFGHJK');
    expect(isUserCode('BCDFGHJK')).toBe(true);
    expect(isUserCode('BCDFGHJA')).toBe(false);
    expect(isUserCode('BCDF')).toBe(false);
  });
});

describe('pkceChallenge', () => {
  it('matches the RFC 7636 appendix B example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});
