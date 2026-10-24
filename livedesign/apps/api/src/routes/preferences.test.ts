import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { handlePreferences, PREFERENCES_PUT_MAX } from './preferences';
import { makeTestRouteContext } from './test-route-context';

// /api/preferences (docs/specs/007-editor/user-preferences.md) against a stand-in for the liveworkspace
// accounts Worker, which keeps them in two scopes: `all`, shown by every app, and `livedesign.app`.

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let accounts: FakeAccounts;
beforeEach(() => {
  accounts = fakeAccounts();
  vi.stubGlobal('fetch', accounts.fetch);
});
afterEach(() => vi.unstubAllGlobals());

const call = (
  method: string,
  opts: { owner?: string | null; body?: unknown; rawBody?: string; env?: Partial<Env> } = {},
) =>
  handlePreferences(
    makeTestRouteContext(method, '/api/preferences', {
      owner: opts.owner === undefined ? GUEST : opts.owner,
      body: opts.body,
      rawBody: opts.rawBody,
      env: (opts.env ?? accounts.env) as Env,
    }),
  );

describe('GET /api/preferences', () => {
  it('answers both scopes as one set, in one accounts read', async () => {
    accounts.settings.set(`guest_${GUEST}`, {
      all: { reduceMotion: true, logoGuides: 'stray' },
      app: { logoGuides: 'tall', reduceMotion: false },
      updatedAt: 1,
    });
    const res = await call('GET');
    expect(res.status).toBe(200);
    // A shared key only ever comes from `all`.
    expect(await res.json()).toEqual({ prefs: { reduceMotion: true, logoGuides: 'tall' } });
    expect(accounts.calls).toEqual([
      { path: 'settings/read', body: { owner: `guest_${GUEST}`, app: 'livedesign.app' } },
    ]);
  });

  it("keeps a common setting's value from before it was shared, until `all` has one", async () => {
    accounts.settings.set(`guest_${GUEST}`, {
      all: { showMinimap: true },
      app: { showMinimap: false, mapSize: 'tall', presentation: { loop: true } },
      updatedAt: 1,
    });
    expect(await (await call('GET')).json()).toEqual({
      prefs: { showMinimap: true, mapSize: 'tall', presentation: { loop: true } },
    });
  });

  it('reads an account under its own id', async () => {
    await call('GET', { owner: 'user_ann' });
    expect(accounts.calls[0]!.body).toEqual({ owner: 'user_ann', app: 'livedesign.app' });
  });

  it('refuses a caller with no owner', async () => {
    expect((await call('GET', { owner: null })).status).toBe(400);
  });

  it('keeps nothing without an accounts Worker, or for an id it cannot vouch for', async () => {
    for (const opts of [{ env: {} }, { owner: 'not-an-id' }]) {
      const res = await call('GET', opts);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'preferences_not_stored' });
    }
    expect(accounts.calls).toHaveLength(0);
  });

  it('answers 503 when the accounts Worker cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.failing.set('settings/read', 500);
    expect((await call('GET')).status).toBe(503);
    warn.mockRestore();
  });
});

describe('PUT /api/preferences', () => {
  it('splits a patch into the two scopes, in one write', async () => {
    const res = await call('PUT', {
      body: { prefs: { reduceMotion: true, logoGuides: true, presentation: { speed: 2 } } },
    });
    expect(res.status).toBe(204);
    expect(accounts.calls).toEqual([
      {
        path: 'settings/write',
        body: {
          owner: `guest_${GUEST}`,
          app: 'livedesign.app',
          patch: {
            // A common setting goes to `all`, and its copy from before it was shared goes.
            all: { reduceMotion: true, presentation: { speed: 2 } },
            app: { logoGuides: true, presentation: null },
          },
        },
      },
    ]);
  });

  it('moves a common setting to `all` on its first change, so every app reads it', async () => {
    accounts.settings.set(`guest_${GUEST}`, {
      all: {},
      app: { presentation: { speed: 1, loop: true }, logoGuides: true },
      updatedAt: 1,
    });
    await call('PUT', { body: { prefs: { presentation: { speed: 2, loop: true } } } });
    expect(accounts.settings.get(`guest_${GUEST}`)).toMatchObject({
      all: { presentation: { speed: 2, loop: true } },
      app: { logoGuides: true },
    });
    expect(accounts.settings.get(`guest_${GUEST}`)!.app).not.toHaveProperty('presentation');
  });

  it('replaces each value whole, deletes on null, and leaves other keys alone', async () => {
    accounts.settings.set(`guest_${GUEST}`, {
      all: { notifyTips: false },
      app: { logoGuideStrength: 1, logoGuides: true },
      updatedAt: 1,
    });
    await call('PUT', { body: { prefs: { logoGuideStrength: 2, logoGuides: null } } });
    expect(accounts.settings.get(`guest_${GUEST}`)).toMatchObject({
      all: { notifyTips: false },
      app: { logoGuideStrength: 2 },
    });
    expect(accounts.settings.get(`guest_${GUEST}`)!.app).not.toHaveProperty('logoGuides');
  });

  it('writes only the scope a patch touches', async () => {
    await call('PUT', { body: { prefs: { notifyTips: false } } });
    expect(accounts.calls[0]!.body.patch).toEqual({ all: { notifyTips: false } });
  });

  it('writes nothing for an empty patch', async () => {
    expect((await call('PUT', { body: { prefs: {} } })).status).toBe(204);
    expect(accounts.calls).toHaveLength(0);
  });

  it('refuses a body that is too big, not JSON, not an object, or names a bad key', async () => {
    for (const opts of [
      { rawBody: 'x'.repeat(PREFERENCES_PUT_MAX + 1) },
      { rawBody: '{' },
      { body: { prefs: [] } },
      { body: { prefs: null } },
      { body: null },
      { body: { prefs: { 'bad key': 1 } } },
    ]) {
      expect((await call('PUT', opts)).status).toBe(400);
    }
    expect(accounts.calls).toHaveLength(0);
  });

  it('passes on the accounts Worker’s refusal, and 503s when it is down', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.failing.set('settings/write', 413);
    let res = await call('PUT', { body: { prefs: { mapSize: 'tall' } } });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'failing' });
    accounts.failing.set('settings/write', 500);
    res = await call('PUT', { body: { prefs: { mapSize: 'tall' } } });
    expect(res.status).toBe(503);
    warn.mockRestore();
  });

  it('keeps nothing without an accounts Worker', async () => {
    const res = await call('PUT', { env: {}, body: { prefs: { mapSize: 'tall' } } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'preferences_not_stored' });
  });

  it('answers other methods and paths with a 404', async () => {
    expect((await call('POST')).status).toBe(404);
  });
});
