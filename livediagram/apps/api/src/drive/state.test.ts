import { describe, expect, it } from 'vitest';
import { bytesToBase64, DRIVE_STATE_TTL_MS } from '@livediagram/api-schema';
import { isAllowedRedirectUri, signDriveState, verifyDriveState } from './state';

// The consent `state` binds the user, the redirect URI and ten minutes
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").

const KEY = bytesToBase64(new Uint8Array(32).map((_, i) => i + 7));
const URI = 'https://livediagram.app/drive/connected';
const T0 = 1_700_000_000_000;

describe('signDriveState / verifyDriveState', () => {
  it('verifies for the same user within the TTL and returns the redirect URI', async () => {
    const state = await signDriveState(KEY, 'user_a', URI, T0);
    expect(await verifyDriveState(KEY, state, 'user_a', T0 + DRIVE_STATE_TTL_MS - 1)).toBe(URI);
  });

  it('refuses another user', async () => {
    const state = await signDriveState(KEY, 'user_a', URI, T0);
    expect(await verifyDriveState(KEY, state, 'user_b', T0)).toBeNull();
  });

  it('refuses once expired', async () => {
    const state = await signDriveState(KEY, 'user_a', URI, T0);
    expect(await verifyDriveState(KEY, state, 'user_a', T0 + DRIVE_STATE_TTL_MS + 1)).toBeNull();
  });

  it('refuses a forged or altered payload', async () => {
    const state = await signDriveState(KEY, 'user_a', URI, T0);
    const [, sig] = state.split('.');
    const forged = `${btoa(JSON.stringify({ sub: 'user_a', redirectUri: 'https://evil.example/drive/connected', exp: T0 + 1e9, nonce: 'x' })).replace(/=+$/, '')}.${sig}`;
    expect(await verifyDriveState(KEY, forged, 'user_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, 'nope', 'user_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, '', 'user_a', T0)).toBeNull();
  });

  it('refuses a state signed with another key', async () => {
    const other = bytesToBase64(new Uint8Array(32).map((_, i) => 255 - i));
    const state = await signDriveState(other, 'user_a', URI, T0);
    expect(await verifyDriveState(KEY, state, 'user_a', T0)).toBeNull();
  });
});

describe('isAllowedRedirectUri', () => {
  it('accepts https on any host, and http only on loopback, always at /drive/connected', () => {
    expect(isAllowedRedirectUri('https://livediagram.app/drive/connected')).toBe(true);
    expect(isAllowedRedirectUri('https://self.example/drive/connected')).toBe(true);
    // livediagram.app redirects the apex to www before the app runs, so the
    // consent flow sends the www origin; both hosts are registered at Google.
    expect(isAllowedRedirectUri('https://www.livediagram.app/drive/connected')).toBe(true);
    expect(isAllowedRedirectUri('https://staging.livediagram.app/drive/connected')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:3000/drive/connected')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:3002/drive/connected')).toBe(true);
  });

  it('refuses other paths, schemes, query strings and plain http', () => {
    expect(isAllowedRedirectUri('https://livediagram.app/drive/open')).toBe(false);
    expect(isAllowedRedirectUri('http://livediagram.app/drive/connected')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirectUri('https://livediagram.app/drive/connected?x=1')).toBe(false);
    expect(isAllowedRedirectUri('not a url')).toBe(false);
    expect(isAllowedRedirectUri(42)).toBe(false);
  });
});
