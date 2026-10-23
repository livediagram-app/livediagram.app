import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { handlePreferences, PREFERENCES_PATCH_MAX } from './preferences';
import { makeTestRouteContext } from './test-route-context';

// /api/preferences (docs/specs/007-editor/user-preferences.md): the editor's one flat set, kept at the
// accounts Worker in two scopes. Without it the editor keeps its preferences in the browser.

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const ctx = (
  method: string,
  opts: { owner?: string | null; body?: unknown; rawBody?: string; env?: Env } = {},
) =>
  makeTestRouteContext(method, '/api/preferences', {
    owner: opts.owner === undefined ? 'user_a' : opts.owner,
    body: opts.body,
    rawBody: opts.rawBody,
    env: opts.env ?? (ACCOUNTS_ON as Env),
  });

let accounts: FakeAccounts;
beforeEach(() => {
  accounts = stubAccounts();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/preferences', () => {
  it("answers the owner's settings joined, in one call to the accounts Worker", async () => {
    accounts.settings.set('user_a', { all: { reduceMotion: true }, app: { mapSize: 'tall' } });
    const res = await handlePreferences(ctx('GET'));
    expect(await res.json()).toEqual({ prefs: { reduceMotion: true, mapSize: 'tall' } });
    expect(accounts.calls).toHaveLength(1);
  });

  it('answers prefs null where they are kept in the browser', async () => {
    const off = await handlePreferences(ctx('GET', { env: {} as Env }));
    expect(await off.json()).toEqual({ prefs: null });
    const legacy = await handlePreferences(ctx('GET', { owner: 'self' }));
    expect(await legacy.json()).toEqual({ prefs: null });
    expect(accounts.calls).toHaveLength(0);
  });

  it('503s when the accounts Worker is down, and 400s with no owner', async () => {
    accounts.failWith = 502;
    expect((await handlePreferences(ctx('GET'))).status).toBe(503);
    expect((await handlePreferences(ctx('GET', { owner: null }))).status).toBe(400);
  });
});

describe('PUT /api/preferences', () => {
  it('applies a patch: a nested value whole, null deletes, other keys stay', async () => {
    accounts.settings.set(`guest_${GUEST}`, {
      all: { uiScalePanels: 0.9, telemetryEnabled: false },
      app: { presentation: { speed: 'slow', loop: true } },
    });
    const res = await handlePreferences(
      ctx('PUT', {
        owner: GUEST,
        body: { prefs: { uiScalePanels: null, presentation: { speed: 'fast' } } },
      }),
    );
    expect(res.status).toBe(204);
    expect(accounts.settings.get(`guest_${GUEST}`)).toEqual({
      all: { telemetryEnabled: false },
      app: { presentation: { speed: 'fast' } },
    });
  });

  it('refuses a body that is not an object of prefs, or too large', async () => {
    expect((await handlePreferences(ctx('PUT', { body: { prefs: [] } }))).status).toBe(400);
    expect((await handlePreferences(ctx('PUT', { rawBody: 'null' }))).status).toBe(400);
    expect((await handlePreferences(ctx('PUT', { rawBody: '{' }))).status).toBe(400);
    const big = { prefs: { x: 'a'.repeat(PREFERENCES_PATCH_MAX) } };
    expect((await handlePreferences(ctx('PUT', { body: big }))).status).toBe(400);
    expect(accounts.calls).toHaveLength(0);
  });

  it('answers 404 preferences_not_stored where nothing is kept server-side', async () => {
    const res = await handlePreferences(ctx('PUT', { env: {} as Env, body: { prefs: {} } }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'preferences_not_stored' });
  });

  it("passes the accounts Worker's size refusal on, and 503s when it is down", async () => {
    accounts.failWith = 413;
    const refused = await handlePreferences(ctx('PUT', { body: { prefs: { mapSize: 'tall' } } }));
    expect(refused.status).toBe(413);
    accounts.failWith = 502;
    const down = await handlePreferences(ctx('PUT', { body: { prefs: { mapSize: 'tall' } } }));
    expect(down.status).toBe(503);
  });
});
