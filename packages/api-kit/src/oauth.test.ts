import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  APP_REDIRECT_MAX_CHARS,
  appSchemeRedirectUrl,
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

describe('appSchemeRedirectUrl (liveworkspace/docs/specs/021-mcp/mcp.md "Redirect addresses")', () => {
  it.each([
    'cursor://anysphere.cursor-retrieval/oauth/user-mcp/callback',
    'com.example.app:/oauth2redirect',
    'vscode://vscode.github-authentication/did-authenticate',
    'my-app+x.y://cb',
  ])('accepts an app scheme: %s', (uri) => {
    expect(appSchemeRedirectUrl(uri)?.href).toBe(uri);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript://x/%0Aalert(1)',
    'data:text/html,x',
    'file:///etc/passwd',
    'vbscript:x',
    'about:blank',
    'blob:https://x.test/1',
    'intent://scan/',
    'http://evil.test/cb',
    'https://claude.ai/cb',
    'ws://x.test',
    'chrome-extension://abc/cb',
    'c:/windows',
    'cursor:',
    'cursor://cb#frag',
    'cursor://c b',
    'cursor://cb\n',
    'cursor://cb\u007f',
    '1app://cb',
    'ap_p://cb',
    'no scheme',
    `cursor://${'a'.repeat(APP_REDIRECT_MAX_CHARS)}`,
  ])('refuses %s', (uri) => {
    expect(appSchemeRedirectUrl(uri)).toBeNull();
  });

  it('reads a worst-case address in one pass', () => {
    const long = `${'a'.repeat(APP_REDIRECT_MAX_CHARS - 4)}://x`;
    const spaces = `cursor://${' '.repeat(100_000)}`;
    expect(cpuMsOf(() => appSchemeRedirectUrl(long))).toBeLessThan(cpuBudgetMs(20));
    expect(cpuMsOf(() => appSchemeRedirectUrl(spaces))).toBeLessThan(cpuBudgetMs(20));
  });
});
