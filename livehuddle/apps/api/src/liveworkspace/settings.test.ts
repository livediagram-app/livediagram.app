import { SettingsError } from '@liveworkspace/auth-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePreferences, PREFERENCES_PATCH_MAX } from '../routes/preferences';
import { makeTestRouteContext } from '../routes/test-route-context';
import { accountsServiceFor, type TestAccountsService } from '../test-accounts-service';
import type { Env } from '../types';
import { getNotificationPrefs } from './notification-prefs';
import { readPreferences, writePreferences } from './settings';

const GUEST = 'guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let env: Env;
let accounts: TestAccountsService;

beforeEach(() => {
  env = {} as Env;
  accounts = accountsServiceFor(env);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const call = (method: string, owner: string | null, body?: unknown, e: Env = env) =>
  handlePreferences(
    makeTestRouteContext(method, '/api/preferences', {
      owner,
      env: e,
      ...(typeof body === 'string' ? { rawBody: body } : { body }),
    }),
  );

describe('readPreferences / writePreferences (liveworkspace settings)', () => {
  it('joins the all scope and this app’s own into one flat set', async () => {
    accounts.settings.set('user_a all', { reduceMotion: true });
    accounts.settings.set('user_a livediagram.app', { gridSnap: true });
    expect(await readPreferences(env, 'user_a')).toEqual({ reduceMotion: true, gridSnap: true });
  });

  it('splits a patch: shared keys to all, the rest to livediagram.app; null deletes', async () => {
    accounts.settings.set('user_a livediagram.app', { gridSnap: true, gone: 1 });
    expect(
      await writePreferences(env, 'user_a', { reduceMotion: false, gridSnap: false, gone: null }),
    ).toBe(true);
    expect(accounts.settings.get('user_a all')).toEqual({ reduceMotion: false });
    expect(accounts.settings.get('user_a livediagram.app')).toEqual({ gridSnap: false });
  });

  it('keeps a common setting this app held before it was shared, until its first change moves it to all', async () => {
    accounts.settings.set('user_a livediagram.app', { showMinimap: false, gridSnap: true });
    expect(await readPreferences(env, 'user_a')).toEqual({ showMinimap: false, gridSnap: true });
    await writePreferences(env, 'user_a', { showMinimap: true });
    expect(accounts.settings.get('user_a all')).toEqual({ showMinimap: true });
    expect(accounts.settings.get('user_a livediagram.app')).toEqual({ gridSnap: true });
    expect(await readPreferences(env, 'user_a')).toEqual({ showMinimap: true, gridSnap: true });
  });

  it('writes a guest under its guest_<uuid> id, and sends nothing for an empty patch', async () => {
    await writePreferences(env, GUEST, { gridSnap: true });
    expect(accounts.settings.get(`${GUEST} livediagram.app`)).toEqual({ gridSnap: true });
    accounts.calls.length = 0;
    expect(await writePreferences(env, GUEST, {})).toBe(true);
    expect(accounts.calls).toEqual([]);
  });

  it('keeps nothing without sign-in configured, or for an id liveworkspace can’t hold', async () => {
    expect(await readPreferences({} as Env, 'user_a')).toBeNull();
    expect(await writePreferences(env, 'owner', { reduceMotion: true })).toBe(false);
  });
});

describe('/api/preferences', () => {
  it('GET answers the flat set, in one accounts call', async () => {
    accounts.settings.set('user_a all', { reduceMotion: true });
    const res = await call('GET', 'user_a');
    expect(await res.json()).toEqual({ prefs: { reduceMotion: true } });
    expect(accounts.calls).toEqual(['POST /settings/read']);
  });

  it('GET answers null where nothing is kept, so the editor keeps them in the browser', async () => {
    const res = await call('GET', 'user_a', undefined, {} as Env);
    expect(await res.json()).toEqual({ prefs: null });
  });

  it('GET answers 503 when liveworkspace is out of reach', async () => {
    accounts.failWith = 502;
    expect((await call('GET', 'user_a')).status).toBe(503);
  });

  it('PUT applies a patch and answers 204', async () => {
    accounts.settings.set('user_a livediagram.app', { gridSnap: true, keep: 1 });
    const res = await call('PUT', 'user_a', { prefs: { gridSnap: false, reduceMotion: true } });
    expect(res.status).toBe(204);
    expect(accounts.settings.get('user_a livediagram.app')).toEqual({ gridSnap: false, keep: 1 });
    expect(accounts.settings.get('user_a all')).toEqual({ reduceMotion: true });
  });

  it('PUT answers 409 where nothing is kept', async () => {
    expect((await call('PUT', 'owner', { prefs: { a: 1 } })).status).toBe(409);
  });

  it('PUT refuses a malformed or oversized body', async () => {
    expect((await call('PUT', 'user_a', 'nope')).status).toBe(400);
    expect((await call('PUT', 'user_a', 'null')).status).toBe(400);
    expect((await call('PUT', 'user_a', { prefs: [1] })).status).toBe(400);
    const big = JSON.stringify({ prefs: { a: 'x'.repeat(PREFERENCES_PATCH_MAX) } });
    expect((await call('PUT', 'user_a', big)).status).toBe(400);
  });

  it('PUT passes liveworkspace’s refusal on', async () => {
    accounts.failWith = 413;
    const res = await call('PUT', 'user_a', { prefs: { a: 1 } });
    expect(res.status).toBe(413);
    accounts.failWith = 400;
    expect((await call('PUT', 'user_a', { prefs: { a: 1 } })).status).toBe(400);
  });

  it('PUT rethrows anything that is not a refusal', async () => {
    accounts.failWith = 500;
    await expect(call('PUT', 'user_a', { prefs: { a: 1 } })).rejects.not.toBeInstanceOf(
      SettingsError,
    );
  });

  it('needs an owner, and answers 404 off its route', async () => {
    expect((await call('GET', null)).status).toBe(400);
    expect((await call('DELETE', 'user_a')).status).toBe(404);
  });
});

describe('getNotificationPrefs', () => {
  it('reads explicit false as off, in either scope, and defaults the rest to on', async () => {
    accounts.settings.set('user_a all', { notifyComments: false });
    accounts.settings.set('user_a livediagram.app', { notifyDocumentJoin: false });
    expect(await getNotificationPrefs(env, 'user_a')).toMatchObject({
      notifyComments: false,
      notifyDocumentJoin: false,
      notifyMentions: true,
    });
  });

  it('defaults to on when nothing is kept or liveworkspace is out of reach', async () => {
    expect((await getNotificationPrefs(env, 'owner')).notifyComments).toBe(true);
    accounts.failWith = 503;
    expect((await getNotificationPrefs(env, 'user_a')).notifyComments).toBe(true);
  });
});
