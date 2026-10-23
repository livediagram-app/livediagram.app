import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import {
  checkProfilePatch,
  deleteProfile,
  mergeGuestProfile,
  readProfiles,
  writeProfile,
} from './profiles.ts';
import { addUser, testD1 } from './test-d1.ts';

const GUEST = 'guest_0b0e8c9a-6d7e-4f3b-9a51-2c1d0e9f8a7b';
let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  ({ db, sql } = testD1());
  addUser(sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada Lovelace' });
});

const write = async (owner: string, body: Record<string, unknown>, now = 1000) => {
  const checked = checkProfilePatch(body);
  if (!checked.ok) throw new Error(checked.error);
  return writeProfile(db, owner, checked.patch, now);
};

describe('profiles', () => {
  it("shows an account's own name until it sets a display name", async () => {
    expect(await readProfiles(db, ['user_ada'])).toEqual([
      { id: 'user_ada', name: 'Ada Lovelace', color: null, createdAt: null, updatedAt: null },
    ]);
    await write('user_ada', { color: '#f97316' });
    expect((await readProfiles(db, ['user_ada']))[0]).toMatchObject({
      name: 'Ada Lovelace',
      color: '#f97316',
      createdAt: 1000,
    });
    await write('user_ada', { name: 'Ada' }, 2000);
    expect((await readProfiles(db, ['user_ada']))[0]).toMatchObject({
      name: 'Ada',
      color: '#f97316',
      createdAt: 1000,
      updatedAt: 2000,
    });
    // Clearing the display name shows the account's name again.
    await write('user_ada', { name: null });
    expect((await readProfiles(db, ['user_ada']))[0]!.name).toBe('Ada Lovelace');
  });

  it('keeps a guest by its id, and leaves out ids that are neither', async () => {
    const written = await write(GUEST, { name: '  Bea  ', color: 'hsl(200 80% 50%)' });
    expect(written).toEqual({
      ok: true,
      value: {
        id: GUEST,
        name: 'Bea',
        color: 'hsl(200 80% 50%)',
        createdAt: 1000,
        updatedAt: 1000,
      },
    });
    const read = await readProfiles(db, [GUEST, 'user_nobody', GUEST, 'user_ada']);
    expect(read.map((p) => p.id).sort()).toEqual([GUEST, 'user_ada']);
  });

  it('refuses an account id with no account behind it', async () => {
    expect(await write('user_gone', { name: 'Ghost' })).toEqual({
      ok: false,
      status: 404,
      error: 'unknown_owner',
    });
    expect(sql.prepare('SELECT count(*) AS n FROM profile').get()).toEqual({ n: 0 });
  });

  it('checks names and colours before they are painted into every peer', () => {
    expect(checkProfilePatch({})).toEqual({ ok: false, error: 'nothing_to_change' });
    expect(checkProfilePatch({ name: 'x'.repeat(121) })).toMatchObject({ error: 'invalid_name' });
    expect(checkProfilePatch({ name: 'a\nb' })).toMatchObject({ error: 'invalid_name' });
    expect(checkProfilePatch({ name: 7 })).toMatchObject({ error: 'invalid_name' });
    for (const color of ['url(https://x)', 'red;background:x', '"red"', 'x'.repeat(65)]) {
      expect(checkProfilePatch({ color })).toMatchObject({ error: 'invalid_color' });
    }
    expect(checkProfilePatch({ color: 'oklch(70% 0.1 200)', name: '' })).toEqual({
      ok: true,
      patch: { color: 'oklch(70% 0.1 200)', name: null },
    });
  });

  it('deletes a closed account’s profile', async () => {
    await write('user_ada', { name: 'Ada' });
    await deleteProfile(db, 'user_ada');
    expect((await readProfiles(db, ['user_ada']))[0]).toMatchObject({ name: 'Ada Lovelace' });
  });
});

describe('a guest signing in', () => {
  it("fills the account's gaps from the guest, keeps the account's own, and drops the guest", async () => {
    await write(GUEST, { name: 'Guesty', color: '#22c55e' });
    sql.prepare('INSERT INTO guest_seen (guest_id, seen_at) VALUES (?, 1)').run(GUEST);
    await mergeGuestProfile(db, GUEST, 'user_ada', 5000);
    // The account has a name of its own, so only the colour comes across.
    expect((await readProfiles(db, ['user_ada']))[0]).toMatchObject({
      name: 'Ada Lovelace',
      color: '#22c55e',
    });
    expect(await readProfiles(db, [GUEST])).toEqual([]);
    expect(sql.prepare('SELECT count(*) AS n FROM guest_seen').get()).toEqual({ n: 0 });
  });

  it("keeps the account's colour, and takes the guest's name when the account has none", async () => {
    addUser(sql, { id: 'user_nameless', email: 'n@example.com', name: '' });
    await write('user_nameless', { color: '#000000' });
    await write(GUEST, { name: 'Guesty', color: '#22c55e' });
    await mergeGuestProfile(db, GUEST, 'user_nameless');
    expect((await readProfiles(db, ['user_nameless']))[0]).toMatchObject({
      name: 'Guesty',
      color: '#000000',
    });
  });

  it('is safe to run twice, and with no guest profile', async () => {
    await mergeGuestProfile(db, GUEST, 'user_ada');
    await mergeGuestProfile(db, GUEST, 'user_ada');
    expect((await readProfiles(db, ['user_ada']))[0]).toMatchObject({ color: null });
  });
});
