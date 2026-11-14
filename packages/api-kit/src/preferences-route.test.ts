import { SettingsError } from '@liveworkspace/auth-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreferencesRoute, PREFERENCES_PATCH_MAX } from './preferences-route';

type Env = { kept: boolean };
type Ctx = {
  request: Request;
  env: Env;
  segments: string[];
  resolveOwner: () => string | null;
};

const readPreferences =
  vi.fn<(env: Env, owner: string) => Promise<Record<string, unknown> | null>>();
const writePreferences =
  vi.fn<(env: Env, owner: string, patch: Record<string, unknown>) => Promise<boolean>>();

const route = createPreferencesRoute<Env, Ctx>({
  readPreferences,
  writePreferences,
  json: (body, init) => Response.json(body, init),
  badRequest: (message) => Response.json({ error: message }, { status: 400 }),
  missingAuth: () => Response.json({ error: 'missing_auth' }, { status: 400 }),
  noContent: () => new Response(null, { status: 204 }),
  notFound: () => Response.json({ error: 'not_found' }, { status: 404 }),
});

const call = (
  method: string,
  {
    body,
    owner = 'guest_1',
    segments = ['api', 'preferences'],
  }: {
    body?: string;
    owner?: string | null;
    segments?: string[];
  } = {},
) =>
  route({
    request: new Request('https://app.test/api/preferences', { method, body }),
    env: { kept: true },
    segments,
    resolveOwner: () => owner,
  });

afterEach(() => {
  vi.restoreAllMocks();
  readPreferences.mockReset();
  writePreferences.mockReset();
});

describe('createPreferencesRoute', () => {
  it('answers 404 off its path and for another method', async () => {
    expect((await call('GET', { segments: ['api', 'preferences', 'x'] })).status).toBe(404);
    expect((await call('GET', { segments: ['api', 'other'] })).status).toBe(404);
    expect((await call('DELETE')).status).toBe(404);
  });

  it('asks for an identity first', async () => {
    expect((await call('GET', { owner: null })).status).toBe(400);
  });

  it('answers the flat set, or null where none are kept', async () => {
    readPreferences.mockResolvedValueOnce({ theme: 'dark' });
    expect(await (await call('GET')).json()).toEqual({ prefs: { theme: 'dark' } });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    readPreferences.mockResolvedValueOnce(null);
    expect(await (await call('GET')).json()).toEqual({ prefs: null });
  });

  it('answers 503 when liveworkspace is out of reach', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    readPreferences.mockRejectedValueOnce(new Error('down'));
    const res = await call('GET');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'preferences_unavailable' });
  });

  it('refuses a body over the cap, and one that is not an object of prefs', async () => {
    const big = JSON.stringify({ prefs: { k: 'x'.repeat(PREFERENCES_PATCH_MAX) } });
    expect((await call('PUT', { body: big })).status).toBe(400);
    for (const body of ['not json', 'null', '{"prefs":null}', '{"prefs":[1]}', '{"prefs":"a"}']) {
      expect((await call('PUT', { body })).status, body).toBe(400);
    }
    expect(writePreferences).not.toHaveBeenCalled();
  });

  it('applies a patch, and says when there is nowhere to keep it', async () => {
    writePreferences.mockResolvedValueOnce(true);
    expect((await call('PUT', { body: '{"prefs":{"a":1}}' })).status).toBe(204);
    expect(writePreferences).toHaveBeenCalledWith({ kept: true }, 'guest_1', { a: 1 });
    writePreferences.mockResolvedValueOnce(false);
    const res = await call('PUT', { body: '{"prefs":{"a":1}}' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'preferences_local_only' });
  });

  it("answers liveworkspace's refusal: 413 as itself, anything else as 400", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writePreferences.mockRejectedValueOnce(new SettingsError(413, 'too_large'));
    let res = await call('PUT', { body: '{"prefs":{"a":1}}' });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    writePreferences.mockRejectedValueOnce(new SettingsError(422, 'bad_key'));
    res = await call('PUT', { body: '{"prefs":{"a":1}}' });
    expect(res.status).toBe(400);
  });

  it('rethrows a failure that is not a refusal', async () => {
    writePreferences.mockRejectedValueOnce(new Error('boom'));
    await expect(call('PUT', { body: '{"prefs":{"a":1}}' })).rejects.toThrow('boom');
  });
});
