import { describe, expect, it } from 'vitest';
import {
  hasControlOrSpace,
  isPostAuthPath,
  isSameSitePath,
  safeReturnPath,
  sameOriginPath,
} from './return-path';

// Everything that would leave the site, from every copy this check replaced (each product's api, auth-client's
// silent sign-in, liveworkspace's site, the workbench and the guest hand-off).
const OFF_SITE = [
  'evil.example',
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  '/a\\b',
  // A tab, newline, space or DEL would be dropped by the browser, leaving `//evil.example`.
  '/\t/evil.example',
  '/\n/evil.example',
  '/\r/evil.example',
  '/ /evil.example',
  '/\u0000/evil.example',
  '/\u007f/x',
];

describe('hasControlOrSpace', () => {
  it('finds C0 controls, space and DEL, and nothing else', () => {
    expect(hasControlOrSpace('/explorer?x=1#y')).toBe(false);
    expect(hasControlOrSpace('/café')).toBe(false);
    for (const c of ['\u0000', '\t', '\n', '\r', ' ', '\u001f', '\u007f']) {
      expect(hasControlOrSpace(`/a${c}b`)).toBe(true);
    }
  });
});

describe('isSameSitePath', () => {
  it('passes a path on this site', () => {
    expect(isSameSitePath('/document/abc?tab=1#t=2')).toBe(true);
    expect(isSameSitePath('/')).toBe(true);
  });

  it.each([null, undefined, '', 42, ...OFF_SITE])('refuses %j', (value) => {
    expect(isSameSitePath(value)).toBe(false);
  });
});

describe('safeReturnPath', () => {
  it('keeps a path on this site and replaces anything that would leave it', () => {
    expect(safeReturnPath('/project/abc?tab=1', '/home')).toBe('/project/abc?tab=1');
    for (const unsafe of [null, undefined, '', ...OFF_SITE]) {
      expect(safeReturnPath(unsafe, '/home')).toBe('/home');
    }
  });
});

describe('sameOriginPath', () => {
  it('keeps a same-origin path, query and hash', () => {
    expect(sameOriginPath('/explorer?x=1#y')).toBe('/explorer?x=1#y');
  });

  it('normalises as the browser would', () => {
    expect(sameOriginPath('/a/../b')).toBe('/b');
  });

  it.each([null, undefined, '', ...OFF_SITE])('refuses %j', (path) => {
    expect(sameOriginPath(path)).toBeNull();
  });
});

describe('isPostAuthPath', () => {
  it('passes an app page', () => {
    expect(isPostAuthPath('/document/abc?x=1')).toBe(true);
  });

  it('refuses the auth pages themselves, any case', () => {
    expect(isPostAuthPath('/sign-in')).toBe(false);
    expect(isPostAuthPath('/Sign-In/x')).toBe(false);
    expect(isPostAuthPath('/get-started')).toBe(false);
  });

  it('refuses a path the browser would rewrite, and anything off the site', () => {
    expect(isPostAuthPath('/a/../b')).toBe(false);
    for (const unsafe of [null, '', ...OFF_SITE]) expect(isPostAuthPath(unsafe)).toBe(false);
  });
});
