import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64 } from '@livediagram/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import { deleteAccount } from '../db/account';
import { getDriveConnection, putDriveItems, upsertBrokerConnection } from '../db/drive';
import { importDriveKey, sealRefreshToken } from './crypto';
import { disconnectDrive } from './disconnect';

// Disconnect and account deletion revoke the grant and delete the rows; the
// Drive files stay (docs/specs/022-drive-mirror/drive-mirror.md).

const KEY = bytesToBase64(new Uint8Array(32).fill(3));
const T0 = 1_700_000_000_000;

function vars() {
  return {
    GOOGLE_CLIENT_ID: 'cid',
    GOOGLE_CLIENT_SECRET: 'secret',
    DRIVE_TOKEN_KEY: KEY,
    GOOGLE_OAUTH_BASE_URL: 'https://oauth.test',
  };
}

async function connected(owner: string) {
  const db = sqliteD1(vars());
  const key = (await importDriveKey(KEY))!;
  await upsertBrokerConnection(db.env, owner, await sealRefreshToken(key, owner, 'rt-1'), T0);
  await putDriveItems(db.env, owner, [
    {
      kind: 'folder',
      ldId: 'f1',
      driveFileId: 'file-f1',
      name: 'F',
      ldName: 'F',
      parentId: null,
      trashed: false,
      md5: null,
      headRevisionId: null,
      mirroredSavedAt: null,
      notice: null,
      noticeParentId: null,
    },
  ]);
  return db;
}

function stubRevoke(status = 200) {
  const revoked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === 'https://oauth.test/revoke')
        revoked.push(new URLSearchParams(String(init.body)).get('token')!);
      return new Response('{}', { status });
    }),
  );
  return revoked;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('disconnectDrive', () => {
  it('revokes the stored refresh token and deletes the rows', async () => {
    const db = await connected('user_a');
    const revoked = stubRevoke();
    expect(await disconnectDrive(db.env, 'user_a')).toEqual({ revoked: true });
    expect(revoked).toEqual(['rt-1']);
    expect(await getDriveConnection(db.env, 'user_a')).toBeNull();
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM drive_items').get()!.n).toBe(0);
  });

  it('still deletes the rows when Google refuses the revoke', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = await connected('user_a');
    stubRevoke(500);
    expect(await disconnectDrive(db.env, 'user_a')).toEqual({ revoked: false });
    expect(await getDriveConnection(db.env, 'user_a')).toBeNull();
  });

  it('deletes without revoking when the key no longer opens the token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = await connected('user_a');
    const revoked = stubRevoke();
    db.env.DRIVE_TOKEN_KEY = bytesToBase64(new Uint8Array(32).fill(4));
    expect(await disconnectDrive(db.env, 'user_a')).toEqual({ revoked: false });
    expect(revoked).toEqual([]);
    expect(warn).toHaveBeenCalledWith('drive: revoke_skipped token_unreadable');
    expect(await getDriveConnection(db.env, 'user_a')).toBeNull();
  });
});

describe('account deletion', () => {
  it('revokes the Drive grant and removes the mirror rows', async () => {
    const db = await connected('user_a');
    const revoked = stubRevoke();
    await deleteAccount(db.env, 'user_a');
    expect(revoked).toEqual(['rt-1']);
    expect(await getDriveConnection(db.env, 'user_a')).toBeNull();
  });
});
