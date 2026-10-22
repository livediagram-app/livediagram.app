import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, bytesToBase64Url } from '@livediagram/api-schema';
import { importDriveKey, openRefreshToken, sealRefreshToken } from './crypto';

// The refresh token is sealed with AES-GCM under DRIVE_TOKEN_KEY before it
// reaches D1 (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Data").

const KEY = bytesToBase64(new Uint8Array(32).map((_, i) => i + 1));
const OTHER_KEY = bytesToBase64(new Uint8Array(32).map((_, i) => 200 - i));

// Flips one bit of the decoded bytes of a sealed value's part (1 = IV,
// 2 = ciphertext and tag). Editing the base64 text instead is not reliable:
// the last character carries padding bits, so some edits decode to the same
// bytes and the "tampered" value is the original.
function flipBit(sealed: string, part: 1 | 2, byteIndex: number): string {
  const parts = sealed.split('.');
  const bytes = base64ToBytes(parts[part]!)!;
  const index = byteIndex < 0 ? bytes.length + byteIndex : byteIndex;
  bytes[index]! ^= 0x01;
  parts[part] = bytesToBase64Url(bytes);
  return parts.join('.');
}

describe('importDriveKey', () => {
  it('accepts base64 of exactly 32 bytes', async () => {
    expect(await importDriveKey(KEY)).not.toBeNull();
  });

  it('refuses a missing, malformed or short key', async () => {
    expect(await importDriveKey(undefined)).toBeNull();
    expect(await importDriveKey('not base64!')).toBeNull();
    expect(await importDriveKey(bytesToBase64(new Uint8Array(16)))).toBeNull();
  });
});

describe('sealRefreshToken / openRefreshToken', () => {
  it('round-trips a token for the same owner', async () => {
    const key = (await importDriveKey(KEY))!;
    const sealed = await sealRefreshToken(key, 'user_a', '1//refresh-token');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('refresh-token');
    expect(await openRefreshToken(key, 'user_a', sealed)).toBe('1//refresh-token');
  });

  it('uses a fresh IV every time', async () => {
    const key = (await importDriveKey(KEY))!;
    const a = await sealRefreshToken(key, 'user_a', 'same');
    const b = await sealRefreshToken(key, 'user_a', 'same');
    expect(a).not.toBe(b);
  });

  it('refuses a sealed value moved to another owner', async () => {
    const key = (await importDriveKey(KEY))!;
    const sealed = await sealRefreshToken(key, 'user_a', 'secret');
    expect(await openRefreshToken(key, 'user_b', sealed)).toBeNull();
  });

  it('refuses a value sealed under another key, or tampered with', async () => {
    const key = (await importDriveKey(KEY))!;
    const other = (await importDriveKey(OTHER_KEY))!;
    const sealed = await sealRefreshToken(other, 'user_a', 'secret');
    expect(await openRefreshToken(key, 'user_a', sealed)).toBeNull();
    const mine = await sealRefreshToken(key, 'user_a', 'secret');
    expect(await openRefreshToken(key, 'user_a', mine)).toBe('secret');
    expect(await openRefreshToken(key, 'user_a', flipBit(mine, 1, 0))).toBeNull();
    expect(await openRefreshToken(key, 'user_a', flipBit(mine, 2, 0))).toBeNull();
    expect(await openRefreshToken(key, 'user_a', flipBit(mine, 2, -1))).toBeNull();
    expect(await openRefreshToken(key, 'user_a', 'garbage')).toBeNull();
  });
});
