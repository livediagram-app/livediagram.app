import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import {
  checkProfilePatch,
  deleteProfile,
  mergeGuestProfile,
  readOwnProfile,
  readProfileColour,
  readProfileLook,
  readProfiles,
  storeAccountPicture,
  withSessionColour,
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
      {
        id: 'user_ada',
        name: 'Ada Lovelace',
        color: null,
        picture: null,
        createdAt: null,
        updatedAt: null,
      },
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
        picture: null,
        googlePicture: null,
        showPicture: true,
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

describe('profile pictures', () => {
  const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s96-c';
  const image = () =>
    (sql.prepare('SELECT image FROM "user" WHERE id = ?').get('user_ada') as { image: unknown })
      .image;

  it("stores a Google sign-in's picture on the account, only when it changed", async () => {
    await storeAccountPicture(db, 'user_ada', PICTURE);
    expect(image()).toBe(PICTURE);
    await storeAccountPicture(db, 'user_ada', PICTURE);
    expect(sql.prepare('SELECT changes() AS n').get()).toEqual({ n: 0 });
    // Anything that isn't a Google picture URL is no picture.
    await storeAccountPicture(db, 'user_ada', 'https://evil.example/ada.png');
    expect(image()).toBeNull();
  });

  it('publishes the picture with the name, and hides it from others with the switch off', async () => {
    await storeAccountPicture(db, 'user_ada', PICTURE);
    expect((await readProfiles(db, ['user_ada']))[0]!.picture).toBe(PICTURE);
    await write('user_ada', { showPicture: false });
    expect((await readProfiles(db, ['user_ada']))[0]!.picture).toBeNull();
    expect(await readOwnProfile(db, 'user_ada')).toMatchObject({
      picture: null,
      googlePicture: PICTURE,
      showPicture: false,
    });
    expect(await readProfileLook(db, 'user_ada')).toEqual({ color: null, showPicture: false });
    // A name save leaves the switch as it was; turning it on publishes the picture again.
    await write('user_ada', { name: 'Ada' });
    expect((await readOwnProfile(db, 'user_ada'))!.showPicture).toBe(false);
    await write('user_ada', { showPicture: true });
    expect((await readProfiles(db, ['user_ada']))[0]!.picture).toBe(PICTURE);
  });

  it('keeps no picture for a guest, and checks the switch', async () => {
    await write(GUEST, { name: 'Bea' });
    expect((await readProfiles(db, [GUEST]))[0]!.picture).toBeNull();
    expect(checkProfilePatch({ showPicture: 'yes' })).toEqual({
      ok: false,
      error: 'invalid_show_picture',
    });
    expect(checkProfilePatch({ showPicture: false })).toEqual({
      ok: true,
      patch: { showPicture: false },
    });
    expect(await readProfileLook(db, 'user_nobody')).toEqual({ color: null, showPicture: true });
  });
});

describe("the account menu's colour", () => {
  it('reads one owner’s colour, null for none', async () => {
    expect(await readProfileColour(db, 'user_ada')).toBeNull();
    await write('user_ada', { color: '#f97316' });
    expect(await readProfileColour(db, 'user_ada')).toBe('#f97316');
    expect(await readProfileColour(db, 'user_nobody')).toBeNull();
  });

  it("adds it to /get-session's user, and passes any other answer on as it was", async () => {
    await write('user_ada', { color: '#f97316' });
    const session = Response.json(
      { session: { id: 's' }, user: { id: 'user_ada', name: 'Ada Lovelace' } },
      { headers: { 'set-cookie': 'a=1' } },
    );
    const answered = await withSessionColour(session, db);
    expect(await answered.json()).toEqual({
      session: { id: 's' },
      user: { id: 'user_ada', name: 'Ada Lovelace', color: '#f97316' },
    });
    expect(answered.headers.get('set-cookie')).toBe('a=1');

    const none = await withSessionColour(
      Response.json({ session: {}, user: { id: 'user_bo' } }),
      db,
    );
    expect(((await none.json()) as { user: { color: unknown } }).user.color).toBeNull();

    const signedOut = Response.json(null);
    expect(await withSessionColour(signedOut, db)).toBe(signedOut);
    const refused = new Response('no', { status: 401 });
    expect(await withSessionColour(refused, db)).toBe(refused);
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
