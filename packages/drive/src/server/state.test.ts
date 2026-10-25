import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64Url } from '../base64';
import { DRIVE_STATE_TTL_MS } from '../constants';
import { signDriveState, verifyDriveState } from './state';

// The consent `state` binds the person, the redirect URI, the return page and ten minutes (liveworkspace/docs/drive.md
// "Connecting").

const plainBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const KEY = plainBase64(new Uint8Array(32).map((_, i) => i + 7));
const URI = 'https://liveworkspace.test/drive/connected';
const RETURN = 'https://livediagram.test/editor?doc=1';
const INPUT = { sub: 'person_a', redirectUri: URI, returnTo: RETURN };
const T0 = 1_700_000_000_000;

const enc = (value: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));

describe('signDriveState / verifyDriveState', () => {
  it('verifies for the same person within the TTL and returns the payload', async () => {
    const state = await signDriveState(KEY, INPUT, T0);
    const payload = await verifyDriveState(KEY, state, 'person_a', T0 + DRIVE_STATE_TTL_MS - 1);
    expect(payload).toMatchObject({
      sub: 'person_a',
      redirectUri: URI,
      returnTo: RETURN,
      exp: T0 + DRIVE_STATE_TTL_MS,
    });
    expect(payload!.nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('is url-safe, and different each time', async () => {
    const a = await signDriveState(KEY, INPUT, T0);
    const b = await signDriveState(KEY, INPUT, T0);
    expect(a).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });

  it('verifies up to the expiry itself, and refuses after', async () => {
    const state = await signDriveState(KEY, INPUT, T0);
    expect(await verifyDriveState(KEY, state, 'person_a', T0 + DRIVE_STATE_TTL_MS)).not.toBeNull();
    expect(await verifyDriveState(KEY, state, 'person_a', T0 + DRIVE_STATE_TTL_MS + 1)).toBeNull();
  });

  it('refuses another person', async () => {
    const state = await signDriveState(KEY, INPUT, T0);
    expect(await verifyDriveState(KEY, state, 'person_b', T0)).toBeNull();
  });

  it('refuses a forged or altered payload', async () => {
    const state = await signDriveState(KEY, INPUT, T0);
    const [body, sig] = state.split('.');
    const original = JSON.parse(new TextDecoder().decode(base64ToBytes(body!)!)) as Record<
      string,
      unknown
    >;
    const forged = `${enc({ ...original, returnTo: 'https://evil.example/' })}.${sig}`;
    expect(await verifyDriveState(KEY, forged, 'person_a', T0)).toBeNull();
    const longer = `${enc({ ...original, exp: T0 + 1e9 })}.${sig}`;
    expect(await verifyDriveState(KEY, longer, 'person_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, `${body}.${sig!.slice(0, -2)}`, 'person_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, 'nope', 'person_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, '', 'person_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, `${body}.`, 'person_a', T0)).toBeNull();
    expect(await verifyDriveState(KEY, `${body}.!!`, 'person_a', T0)).toBeNull();
  });

  it('refuses a state signed with another key', async () => {
    const other = plainBase64(new Uint8Array(32).map((_, i) => 255 - i));
    const state = await signDriveState(other, INPUT, T0);
    expect(await verifyDriveState(KEY, state, 'person_a', T0)).toBeNull();
  });

  it('refuses a state when the key is missing or malformed, and will not sign with one', async () => {
    const state = await signDriveState(KEY, INPUT, T0);
    expect(await verifyDriveState('short', state, 'person_a', T0)).toBeNull();
    await expect(signDriveState('short', INPUT, T0)).rejects.toThrow(/32-byte/);
  });

  it('is never verifiable as a sealed token: the signing key is derived, not the sealing key itself', async () => {
    // An HMAC under the raw key would verify; the state's must not.
    const raw = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(base64ToBytes(KEY)!),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const state = await signDriveState(KEY, INPUT, T0);
    const [body, sig] = state.split('.');
    const rawSig = bytesToBase64Url(
      await crypto.subtle.sign('HMAC', raw, new TextEncoder().encode(body)),
    );
    expect(rawSig).not.toBe(sig);
    expect(await verifyDriveState(KEY, `${body}.${rawSig}`, 'person_a', T0)).toBeNull();
  });
});
