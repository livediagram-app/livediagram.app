import { describe, expect, it } from 'vitest';
import { decodePkceCookie, encodePkceCookie, type PkceCookie } from './pkce-cookie';

// The encoder every app's api used before this one: btoa straight on the JSON, so Latin-1 bytes, and a throw past it.
const oldEncode = (value: PkceCookie) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const base = { state: 's1', verifier: 'v1' };

describe('encodePkceCookie and decodePkceCookie', () => {
  it('round-trips a plain return path, cookie-safe', () => {
    const value = { ...base, returnTo: '/project/abc?tab=2#x' };
    const raw = encodePkceCookie(value);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePkceCookie(raw)).toEqual(value);
  });

  it.each([
    ['/plan/Équipe%20Café', '/plan/%C3%89quipe%20Caf%C3%A9'],
    [
      '/plan/☕東京?q=☕東京#☕東京',
      '/plan/%E2%98%95%E6%9D%B1%E4%BA%AC?q=%E2%98%95%E6%9D%B1%E4%BA%AC#%E2%98%95%E6%9D%B1%E4%BA%AC',
    ],
  ])('carries %j past Latin-1, back as percent-encoded ASCII', (returnTo, encoded) => {
    expect(() => oldEncode({ ...base, returnTo: '/☕' })).toThrow();
    const raw = encodePkceCookie({ ...base, returnTo });
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePkceCookie(raw)).toEqual({ ...base, returnTo: encoded });
  });

  it('reads a cookie the old Latin-1 encoder wrote, mid-sign-in across a deploy', () => {
    expect(decodePkceCookie(oldEncode({ ...base, returnTo: '/plan/Équipe%20Café' }))).toEqual({
      ...base,
      returnTo: '/plan/%C3%89quipe%20Caf%C3%A9',
    });
    expect(decodePkceCookie(oldEncode({ ...base, returnTo: '/explorer/home' }))).toEqual({
      ...base,
      returnTo: '/explorer/home',
    });
  });

  it.each([
    null,
    undefined,
    '',
    'not base64!',
    btoa('not json'),
    btoa('null'),
    btoa('"text"'),
    btoa(JSON.stringify({ state: 's', verifier: 'v' })),
    btoa(JSON.stringify({ state: 1, verifier: 'v', returnTo: '/' })),
    btoa(JSON.stringify({ state: 's', verifier: 2, returnTo: '/' })),
  ])('reads %j as no cookie', (raw) => {
    expect(decodePkceCookie(raw)).toBeNull();
  });

  it.each(['//evil.example', 'https://evil.example', '/\\evil.example', '/\t/evil.example'])(
    'refuses a return path off the site (%j)',
    (returnTo) => {
      expect(decodePkceCookie(encodePkceCookie({ ...base, returnTo }))).toBeNull();
    },
  );
});
