// Where the service will send someone back to (subscription.md "The subscription Worker"): the site or a known app,
// and nowhere else.
import { describe, expect, it } from 'vitest';
import { accountsUrl, audiences, environmentOf, siteOrigin } from './env';
import { safeReturnTo } from './origins';
import { testDb } from './test-sqlite-d1';

const production = {
  ...testDb().env,
  ENVIRONMENT: 'production',
  SITE_ORIGIN: 'https://www.liveworkspace.app/',
};
const development = testDb().env;

describe('returnTo', () => {
  it('takes a page of the site or an app', () => {
    for (const url of [
      'https://www.liveworkspace.app/settings/subscription',
      'https://liveworkspace.app/pricing?from=nav#teams',
      'https://www.liveplanner.app/plan/abc',
      'https://livehuddle.app/',
    ]) {
      expect(safeReturnTo(production, url), url).toBe(new URL(url).toString());
    }
  });

  it('refuses anywhere else, and anything that is not a plain web address', () => {
    for (const url of [
      'https://evil.example/',
      'https://www.liveworkspace.app.evil.example/',
      'https://www.liveworkspace.app@evil.example/',
      'https://user:pass@www.liveworkspace.app/',
      'http://www.liveworkspace.app/',
      'https://staging.liveworkspace.app/',
      'http://localhost:3000/',
      'javascript:alert(1)',
      'data:text/html,hi',
      '//www.liveworkspace.app/',
      '/settings',
      '',
      `https://www.liveworkspace.app/${'a'.repeat(2000)}`,
      null,
      42,
    ]) {
      expect(safeReturnTo(production, url), String(url)).toBeNull();
    }
  });

  it('takes any page on this machine in development only', () => {
    expect(safeReturnTo(development, 'http://localhost:3202/plan/abc')).toBe(
      'http://localhost:3202/plan/abc',
    );
    expect(safeReturnTo(development, 'http://127.0.0.1:3000/pricing')).toBe(
      'http://127.0.0.1:3000/pricing',
    );
    expect(safeReturnTo(development, 'https://evil.example/')).toBeNull();
  });

  it("takes staging's own addresses on staging", () => {
    const staging = {
      ...development,
      ENVIRONMENT: 'staging',
      SITE_ORIGIN: 'https://staging.liveworkspace.app',
    };
    expect(safeReturnTo(staging, 'https://staging.livedesign.app/x')).toBe(
      'https://staging.livedesign.app/x',
    );
    expect(safeReturnTo(staging, 'https://www.livedesign.app/x')).toBeNull();
  });
});

describe('the env', () => {
  it('reads the environment strictly: anything unknown is production', () => {
    expect(environmentOf({ ENVIRONMENT: 'development' })).toBe('development');
    expect(environmentOf({ ENVIRONMENT: 'staging' })).toBe('staging');
    expect(environmentOf({ ENVIRONMENT: 'preview' })).toBe('production');
  });

  it('defaults to production and drops trailing slashes', () => {
    expect(siteOrigin({})).toBe('https://www.liveworkspace.app');
    expect(siteOrigin({ SITE_ORIGIN: 'http://localhost:3000//' })).toBe('http://localhost:3000');
    expect(accountsUrl({})).toBe('https://www.liveworkspace.app');
    expect(accountsUrl({ ACCOUNTS_URL: ' https://staging.liveworkspace.app/ ' })).toBe(
      'https://staging.liveworkspace.app',
    );
    expect(audiences({})).toEqual([]);
    expect(audiences({ INDEX_AUDIENCES: ' a , ,b' })).toEqual(['a', 'b']);
  });
});
