import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteSettings,
  isSettingsApp,
  isSettingsOwner,
  mergeGuestSettings,
  readSettings,
  SETTINGS_MAX_BYTES,
  writeSettings,
} from './settings.ts';
import { addUser, testD1 } from './test-d1.ts';

const ADA = 'user_ada';
const GUEST = 'guest_0b0e8c9a-6d7e-4f3b-9a51-2c1d0e9f8a7b';

let db: D1Database;
let sql: ReturnType<typeof testD1>['sql'];

beforeEach(() => {
  ({ db, sql } = testD1());
  addUser(sql, { id: ADA, email: 'ada@example.com', name: 'Ada Lovelace' });
});

async function write(owner: string, app: Parameters<typeof writeSettings>[2], patches: object) {
  const result = await writeSettings(db, owner, app, patches, 1_000);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('settings', () => {
  it('knows the apps and owners it takes', () => {
    expect(isSettingsApp('livediagram.app')).toBe(true);
    expect(isSettingsApp('livedesign.app')).toBe(true);
    expect(isSettingsApp('liveworkspace.app')).toBe(false);
    expect(isSettingsApp('livediagram')).toBe(false);
    expect(isSettingsOwner(ADA)).toBe(true);
    expect(isSettingsOwner(GUEST)).toBe(true);
    expect(isSettingsOwner('guest_nope')).toBe(false);
    expect(isSettingsOwner("user_x' OR 1")).toBe(false);
  });

  it('reads nothing as empty', async () => {
    expect(await readSettings(db, ADA, 'livediagram.app')).toEqual({
      all: {},
      app: {},
      updatedAt: null,
    });
  });

  it('keeps each app to its own row, and every app to the shared one', async () => {
    await write(ADA, 'livediagram.app', { all: { theme: 'dark' }, app: { snap: true } });
    await write(ADA, 'liveplanner.app', { app: { density: 'compact' } });
    expect(await readSettings(db, ADA, 'livediagram.app')).toEqual({
      all: { theme: 'dark' },
      app: { snap: true },
      updatedAt: 1_000,
    });
    expect(await readSettings(db, ADA, 'liveplanner.app')).toEqual({
      all: { theme: 'dark' },
      app: { density: 'compact' },
      updatedAt: 1_000,
    });
    expect((await readSettings(db, ADA, null)).app).toEqual({});
  });

  it('patches key by key, so two apps never undo each other', async () => {
    await write(ADA, 'livediagram.app', { all: { theme: 'dark', locale: 'en' } });
    // Two writes at once, each naming one key: both land.
    await Promise.all([
      writeSettings(db, ADA, 'livediagram.app', { all: { theme: 'light' } }),
      writeSettings(db, ADA, 'liveplanner.app', { all: { reduceMotion: true } }),
    ]);
    expect((await readSettings(db, ADA, null)).all).toEqual({
      theme: 'light',
      locale: 'en',
      reduceMotion: true,
    });
  });

  it('replaces a value whole, and deletes a key set to null', async () => {
    await write(ADA, 'livediagram.app', { app: { grid: { size: 8, show: true }, snap: true } });
    const after = await write(ADA, 'livediagram.app', { app: { grid: { size: 16 }, snap: null } });
    expect(after.app).toEqual({ grid: { size: 16 } });
  });

  it('answers the merged result, with the later of the two stamps', async () => {
    await writeSettings(db, ADA, 'livediagram.app', { all: { a: 1 } }, 1_000);
    const result = await writeSettings(db, ADA, 'livediagram.app', { app: { b: 2 } }, 2_000);
    expect(result).toEqual({ ok: true, value: { all: { a: 1 }, app: { b: 2 }, updatedAt: 2_000 } });
  });

  it('refuses anything but a plain object of named keys', async () => {
    for (const all of [[1], 'x', 3, null, new Date()]) {
      expect(await writeSettings(db, ADA, null, { all })).toMatchObject({
        ok: false,
        error: 'settings_not_object',
      });
    }
    expect(await writeSettings(db, ADA, null, { all: { 'a"b': 1 } })).toMatchObject({
      error: 'invalid_setting_key',
    });
    expect(await writeSettings(db, ADA, null, { app: { a: 1 } })).toMatchObject({
      error: 'app_required',
    });
  });

  it('bounds a row, and a write past it changes nothing', async () => {
    const half = 'x'.repeat(SETTINGS_MAX_BYTES / 2);
    expect(
      await writeSettings(db, ADA, null, { all: { big: 'x'.repeat(SETTINGS_MAX_BYTES) } }),
    ).toMatchObject({ ok: false, status: 400, error: 'settings_too_large' });
    await write(ADA, 'livediagram.app', { all: { one: half } });
    // Each patch fits, but the row would not: the app's patch in the same write is not kept either.
    const result = await writeSettings(db, ADA, 'livediagram.app', {
      all: { two: half },
      app: { snap: true },
    });
    expect(result).toMatchObject({ ok: false, status: 413, error: 'settings_too_large' });
    expect(await readSettings(db, ADA, 'livediagram.app')).toMatchObject({
      all: { one: half },
      app: {},
    });
  });

  it('a write naming nothing just reads', async () => {
    await write(ADA, null, { all: { a: 1 } });
    expect(await write(ADA, null, { all: {} })).toMatchObject({ all: { a: 1 } });
  });

  it('deletes every row of an owner', async () => {
    await write(ADA, 'livediagram.app', { all: { a: 1 }, app: { b: 2 } });
    await write(GUEST, null, { all: { a: 1 } });
    await deleteSettings(db, ADA);
    expect(await readSettings(db, ADA, 'livediagram.app')).toMatchObject({ updatedAt: null });
    expect((await readSettings(db, GUEST, null)).all).toEqual({ a: 1 });
  });
});

describe('a closed account', () => {
  it('can’t have its settings written back by a token that outlived it', async () => {
    await write(ADA, 'livediagram.app', { all: { theme: 'dark' } });
    await deleteSettings(db, ADA);
    sql.prepare('DELETE FROM "user" WHERE id = ?').run(ADA);
    expect(
      await writeSettings(db, ADA, 'livediagram.app', { all: { theme: 'light' }, app: { a: 1 } }),
    ).toMatchObject({ ok: false, status: 404, error: 'unknown_owner' });
    const left = sql.prepare('SELECT COUNT(*) AS n FROM settings WHERE owner_id = ?').get(ADA);
    expect(left).toEqual({ n: 0 });
  });

  it('still lets a guest, who has no account row, write', async () => {
    expect((await write(GUEST, null, { all: { theme: 'dark' } })).all).toEqual({ theme: 'dark' });
  });
});

describe('a guest signing in', () => {
  it("moves the guest's settings to the account, the account's keys winning", async () => {
    await write(ADA, 'livediagram.app', { all: { theme: 'dark' } });
    await write(GUEST, 'livediagram.app', {
      all: { theme: 'light', locale: 'fr' },
      app: { snap: true },
    });
    await mergeGuestSettings(db, GUEST, ADA, 5_000);
    expect(await readSettings(db, ADA, 'livediagram.app')).toEqual({
      all: { theme: 'dark', locale: 'fr' },
      app: { snap: true },
      updatedAt: 5_000,
    });
    expect(await readSettings(db, GUEST, 'livediagram.app')).toMatchObject({ updatedAt: null });
  });

  it('is a no-op for a guest with no settings, and safe to run twice', async () => {
    await write(ADA, null, { all: { theme: 'dark' } });
    await mergeGuestSettings(db, GUEST, ADA);
    await write(GUEST, null, { all: { locale: 'fr' } });
    await mergeGuestSettings(db, GUEST, ADA);
    await mergeGuestSettings(db, GUEST, ADA);
    expect((await readSettings(db, ADA, null)).all).toEqual({ theme: 'dark', locale: 'fr' });
  });

  it('fills only as much as fits under the limit', async () => {
    const big = 'x'.repeat(SETTINGS_MAX_BYTES - 100);
    await write(ADA, null, { all: { big } });
    await write(GUEST, null, { all: { small: 1, huge: 'y'.repeat(500) } });
    await mergeGuestSettings(db, GUEST, ADA);
    expect((await readSettings(db, ADA, null)).all).toEqual({ big, small: 1 });
  });
});
