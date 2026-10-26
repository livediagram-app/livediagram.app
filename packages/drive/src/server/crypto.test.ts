import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64Url } from '../base64';
import { driveKeyBytes, importDriveKey, openRefreshToken, sealRefreshToken } from './crypto';

// The refresh token is sealed with AES-GCM under DRIVE_TOKEN_KEY before it is stored (liveworkspace/docs/specs/005-drive/drive.md
// "Tokens").

const plainBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const KEY_BYTES = new Uint8Array(32).map((_, i) => i + 1);
const KEY = plainBase64(KEY_BYTES);
const OTHER_KEY = plainBase64(new Uint8Array(32).map((_, i) => 200 - i));

// Flips one bit of the decoded bytes of a sealed value's part (1 = IV, 2 = ciphertext and tag). Editing the base64
// text instead is not reliable: the last character carries padding bits, so some edits decode to the same bytes and
// the "tampered" value is the original.
function flipBit(sealed: string, part: 1 | 2, byteIndex: number): string {
  const parts = sealed.split('.');
  const bytes = base64ToBytes(parts[part]!)!;
  const index = byteIndex < 0 ? bytes.length + byteIndex : byteIndex;
  bytes[index]! ^= 0x01;
  parts[part] = bytesToBase64Url(bytes);
  return parts.join('.');
}

describe('driveKeyBytes', () => {
  it('reads base64 or base64url of exactly 32 bytes, trimmed', () => {
    expect(driveKeyBytes(KEY)).toEqual(KEY_BYTES);
    expect(driveKeyBytes(bytesToBase64Url(KEY_BYTES))).toEqual(KEY_BYTES);
    expect(driveKeyBytes(`  ${KEY}\n`)).toEqual(KEY_BYTES);
  });

  it('refuses a missing, malformed, short or long key', () => {
    expect(driveKeyBytes(undefined)).toBeNull();
    expect(driveKeyBytes('')).toBeNull();
    expect(driveKeyBytes('not base64!')).toBeNull();
    expect(driveKeyBytes(plainBase64(new Uint8Array(16)))).toBeNull();
    expect(driveKeyBytes(plainBase64(new Uint8Array(33)))).toBeNull();
  });
});

describe('importDriveKey', () => {
  it('accepts base64 of exactly 32 bytes', async () => {
    expect(await importDriveKey(KEY)).not.toBeNull();
  });

  it('refuses a missing, malformed or short key', async () => {
    expect(await importDriveKey(undefined)).toBeNull();
    expect(await importDriveKey('not base64!')).toBeNull();
    expect(await importDriveKey(plainBase64(new Uint8Array(16)))).toBeNull();
  });
});

describe('sealRefreshToken / openRefreshToken', () => {
  it('round-trips a token for the same person', async () => {
    const key = (await importDriveKey(KEY))!;
    const sealed = await sealRefreshToken(key, 'person_a', '1//refresh-token');
    expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain('refresh-token');
    expect(await openRefreshToken(key, 'person_a', sealed)).toBe('1//refresh-token');
  });

  it('round-trips a token with any characters', async () => {
    const key = (await importDriveKey(KEY))!;
    const token = '1//0g-Ünïcødé_✓ token';
    expect(await openRefreshToken(key, 'p', await sealRefreshToken(key, 'p', token))).toBe(token);
  });

  it('uses a fresh IV every time', async () => {
    const key = (await importDriveKey(KEY))!;
    const a = await sealRefreshToken(key, 'person_a', 'same');
    const b = await sealRefreshToken(key, 'person_a', 'same');
    expect(a).not.toBe(b);
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
  });

  it('refuses a sealed value moved to another person', async () => {
    const key = (await importDriveKey(KEY))!;
    const sealed = await sealRefreshToken(key, 'person_a', 'secret');
    expect(await openRefreshToken(key, 'person_b', sealed)).toBeNull();
  });

  it('refuses a value sealed under another key, or tampered with', async () => {
    const key = (await importDriveKey(KEY))!;
    const other = (await importDriveKey(OTHER_KEY))!;
    const sealed = await sealRefreshToken(other, 'person_a', 'secret');
    expect(await openRefreshToken(key, 'person_a', sealed)).toBeNull();
    const mine = await sealRefreshToken(key, 'person_a', 'secret');
    expect(await openRefreshToken(key, 'person_a', mine)).toBe('secret');
    expect(await openRefreshToken(key, 'person_a', flipBit(mine, 1, 0))).toBeNull();
    expect(await openRefreshToken(key, 'person_a', flipBit(mine, 2, 0))).toBeNull();
    expect(await openRefreshToken(key, 'person_a', flipBit(mine, 2, -1))).toBeNull();
  });

  it('refuses malformed values: wrong version, missing parts, bad base64, a short IV', async () => {
    const key = (await importDriveKey(KEY))!;
    const [, iv, body] = (await sealRefreshToken(key, 'p', 'secret')).split('.');
    expect(await openRefreshToken(key, 'p', 'garbage')).toBeNull();
    expect(await openRefreshToken(key, 'p', '')).toBeNull();
    expect(await openRefreshToken(key, 'p', `v2.${iv}.${body}`)).toBeNull();
    expect(await openRefreshToken(key, 'p', `v1.${iv}`)).toBeNull();
    expect(await openRefreshToken(key, 'p', `v1..${body}`)).toBeNull();
    expect(await openRefreshToken(key, 'p', `v1.${iv}.!!!`)).toBeNull();
    expect(
      await openRefreshToken(key, 'p', `v1.${bytesToBase64Url(new Uint8Array(8))}.${body}`),
    ).toBeNull();
  });
});
