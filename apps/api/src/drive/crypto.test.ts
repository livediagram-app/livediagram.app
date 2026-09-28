import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from '@livediagram/api-schema';
import { importDriveKey, openRefreshToken, sealRefreshToken } from './crypto';

// The refresh token is sealed with AES-GCM under DRIVE_TOKEN_KEY before it
// reaches D1 (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Data").

const KEY = bytesToBase64(new Uint8Array(32).map((_, i) => i + 1));
const OTHER_KEY = bytesToBase64(new Uint8Array(32).map((_, i) => 200 - i));

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
    const tampered = mine.slice(0, -2) + (mine.endsWith('A') ? 'BB' : 'AA');
    expect(await openRefreshToken(key, 'user_a', tampered)).toBeNull();
    expect(await openRefreshToken(key, 'user_a', 'garbage')).toBeNull();
  });
});
