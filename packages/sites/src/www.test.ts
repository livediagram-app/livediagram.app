import { describe, expect, it } from 'vitest';
import {
  ACCOUNTS_ISSUER,
  BARE_WWW_TRANSITION,
  bareAndWwwOrigins,
  sameSiteOrigin,
  withWwwTwin,
  wwwTwin,
} from './www';

describe('wwwTwin', () => {
  it('pairs each domain in the transition with its www. host, path and query kept', () => {
    expect(wwwTwin('https://liveworkspace.app/api/auth')).toBe(ACCOUNTS_ISSUER);
    expect(wwwTwin(ACCOUNTS_ISSUER)).toBe('https://liveworkspace.app/api/auth');
    expect(wwwTwin('https://liveplanner.app/api')).toBe('https://www.liveplanner.app/api');
    expect(wwwTwin('https://www.livedesign.app/a?b=1#c')).toBe('https://livedesign.app/a?b=1#c');
    expect(wwwTwin('https://livedocuments.app')).toBe('https://www.livedocuments.app');
    for (const domain of BARE_WWW_TRANSITION.domains) {
      const [bare, www] = bareAndWwwOrigins(domain);
      expect(wwwTwin(bare)).toBe(www);
      expect(wwwTwin(www)).toBe(bare);
    }
  });

  it('gives no twin to staging, local, workers.dev, other schemes, ports or lookalikes', () => {
    for (const url of [
      'https://staging.liveworkspace.app/api/auth',
      'http://localhost:3000/api/auth',
      'http://liveworkspace.app/api/auth',
      'https://liveworkspace.app:8443/api/auth',
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api',
      'https://evilliveworkspace.app/api/auth',
      'https://liveworkspace.app.evil.example/api/auth',
      'https://user@liveworkspace.app/api/auth',
      'https://www.www.liveworkspace.app/',
      'not a url',
    ]) {
      expect(wwwTwin(url), url).toBeNull();
    }
  });

  it('withWwwTwin lists the URL first, then its twin', () => {
    expect(withWwwTwin('https://liveworkspace.app/api/auth')).toEqual([
      'https://liveworkspace.app/api/auth',
      ACCOUNTS_ISSUER,
    ]);
    expect(withWwwTwin('https://staging.liveplanner.app/api')).toEqual([
      'https://staging.liveplanner.app/api',
    ]);
  });
});

describe('sameSiteOrigin', () => {
  it('takes equal origins and twins, and nothing else', () => {
    expect(sameSiteOrigin('https://liveworkspace.app', 'https://www.liveworkspace.app')).toBe(true);
    expect(sameSiteOrigin('https://www.liveworkspace.app/x', 'https://liveworkspace.app')).toBe(
      true,
    );
    expect(sameSiteOrigin('http://localhost:3000', 'http://localhost:3000/')).toBe(true);
    expect(sameSiteOrigin('https://liveworkspace.app', 'https://staging.liveworkspace.app')).toBe(
      false,
    );
    expect(sameSiteOrigin('https://liveworkspace.app', 'https://www.liveplanner.app')).toBe(false);
    expect(sameSiteOrigin('', 'https://liveworkspace.app')).toBe(false);
  });
});

describe('BARE_WWW_TRANSITION', () => {
  it('outlives a year-long guest token minted on the day of the move', () => {
    const move = Date.parse('2026-10-26T00:00:00Z');
    const keep = Date.parse(`${BARE_WWW_TRANSITION.keepUntil}T00:00:00Z`);
    expect(keep - move).toBeGreaterThan(365 * 24 * 60 * 60 * 1000);
  });
});
