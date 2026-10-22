import { describe, expect, it } from 'vitest';
import { fakeIo, type Route } from './testing/fake-io';
import { transport } from './transport';

// A long-running command (`watch`) outlives a fresh `auth login`, which revokes the token it started with.
// The transport re-reads the stored credential when the api refuses the token it holds, and retries once.

const API = 'https://liveplanner.app/api';
const bearer = (request: Request) => request.headers.get('Authorization');

// Accepts only `lwt_new`; answers 401 to anything else.
const host: Route = (request) =>
  bearer(request) === 'Bearer lwt_new'
    ? Response.json({ ok: true, body: request.method === 'POST' ? 'sent' : null })
    : Response.json({ error: 'invalid_token' }, { status: 401 });

describe('transport', () => {
  it('retries once with a refreshed credential after a 401, body intact', async () => {
    const io = fakeIo({ routes: [host] });
    const logs: string[] = [];
    const api = transport(io, API, (l) => void logs.push(l)).forCredential(
      'lwt_old',
      async () => 'lwt_new',
    );

    const answer = await api.json('/projects', { method: 'POST', body: '{"a":1}' });

    expect(answer).toEqual({ ok: true, body: 'sent' });
    expect(io.requests.map(bearer)).toEqual(['Bearer lwt_old', 'Bearer lwt_new']);
    expect(await io.requests[1]!.text()).toBe('{"a":1}');
    expect(logs).toContain('credential refreshed');
    await api.json('/projects');
    expect(io.requests.map(bearer).at(-1)).toBe('Bearer lwt_new');
  });

  it('answers the 401 when the stored credential has not changed, or cannot be refreshed', async () => {
    const io = fakeIo({ routes: [host] });
    const same = transport(io, API, () => {}).forCredential('lwt_old', async () => 'lwt_old');
    const none = transport(io, API, () => {}).forCredential('lwt_old', null);
    const gone = transport(io, API, () => {}).forCredential('lwt_old', async () => null);

    for (const api of [same, none, gone])
      await expect(api.json('/projects')).rejects.toMatchObject({ status: 401 });
    expect(io.requests).toHaveLength(3);
  });

  it('retries every request refused in parallel, not only the first to refresh', async () => {
    const io = fakeIo({ routes: [host] });
    const api = transport(io, API, () => {}).forCredential('lwt_old', async () => 'lwt_new');

    const answers = await Promise.all([api.json('/projects'), api.json('/projects')]);

    expect(answers).toEqual([
      { ok: true, body: null },
      { ok: true, body: null },
    ]);
    expect(io.requests.map(bearer)).toEqual([
      'Bearer lwt_old',
      'Bearer lwt_old',
      'Bearer lwt_new',
      'Bearer lwt_new',
    ]);
  });
});
