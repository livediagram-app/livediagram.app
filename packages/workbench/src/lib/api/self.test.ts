import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTokenUnavailableError } from './core';
import { createSelfApi, type SelfApiCore } from './self';

type Participant = { id: string; name: string; color: string; status: 'online' | 'away' };

// The shared participant calls every editor binds (each editor's lib/api/self.ts), over a fake api core.
function setup(overrides: Partial<SelfApiCore> = {}) {
  const calls: { method: string; url: string; headers: HeadersInit | undefined; body?: unknown }[] = [];
  let answer: unknown = { participant: { id: 'p-1', name: 'Swift Otter', color: '#0ea5e9' } };
  const core: SelfApiCore = {
    apiBase: '/api',
    apiFetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', url, headers: init?.headers, body: init?.body });
      return new Response(JSON.stringify(answer), { status: 200 });
    }),
    apiHeaders: vi.fn(async (ownerId: string) => ({ 'X-As': ownerId })),
    expectOkOrNull: vi.fn(async (res: Response) => (await res.json()) as unknown),
    expectOkVoid: vi.fn(async () => {}),
  };
  // Copied as descriptors, so an override's getter stays a getter.
  Object.defineProperties(core, Object.getOwnPropertyDescriptors(overrides));
  return {
    api: createSelfApi<Participant>(core),
    calls,
    gets: () => calls.filter((c) => c.method === 'GET'),
    answer: (next: unknown) => (answer = next),
  };
}

afterEach(() => vi.useRealTimers());

// /new hands the new item to the editor in place, and both load the participant: the editor must reuse the one
// /new just read and saved rather than asking the server again on every new item.
describe('the participant the page already knows', () => {
  it('answers a load straight after a save without a request', async () => {
    const { api, calls, gets } = setup();
    await api.apiSaveSelf({ id: 'p-save', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    expect(calls[0]).toMatchObject({ method: 'PUT', url: '/api/participants/p-save' });
    expect(JSON.parse(String(calls[0]!.body))).toEqual({ name: 'Brave Heron', color: '#22c55e' });
    const self = await api.apiLoadSelf('p-save');
    expect(self).toEqual({ id: 'p-save', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    expect(gets()).toEqual([]);
  });

  it('asks the server for a participant it has not seen, once for loads in the same tick', async () => {
    const { api, gets } = setup();
    const [a, b] = await Promise.all([api.apiLoadSelf('p-1'), api.apiLoadSelf('p-1')]);
    expect(a).toEqual({ id: 'p-1', name: 'Swift Otter', color: '#0ea5e9', status: 'online' });
    expect(b).toEqual(a);
    expect(gets()).toHaveLength(1);
    expect(gets()[0]).toMatchObject({ url: '/api/participants/p-1', headers: { 'X-As': 'p-1' } });
  });

  it('asks again once the handoff window has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { api, gets } = setup();
    await api.apiSaveSelf({ id: 'p-old', name: 'Brave Heron', color: '#22c55e', status: 'online' });
    vi.setSystemTime(Date.now() + 31_000);
    await api.apiLoadSelf('p-old');
    expect(gets()).toHaveLength(1);
  });

  it('reads the api base at call time', async () => {
    let apiBase = '/first';
    const { api, calls } = setup({
      get apiBase() {
        return apiBase;
      },
    });
    apiBase = '/later';
    await api.apiLoadSelf('p-1');
    expect(calls[0]!.url).toBe('/later/participants/p-1');
  });
});

// docs/specs/015-api/api.md: the api answers the caller's own absent profile with { participant: null }.
describe('loading your own profile before you have saved one', () => {
  it('reads no profile, or no answer, as null', async () => {
    const { api, answer } = setup();
    answer({ participant: null });
    expect(await api.apiLoadSelf('p-fresh')).toBeNull();
    answer(null);
    expect(await api.apiLoadSelf('p-fresh-2')).toBeNull();
  });

  it('still loads a signed-in profile, anonymously, while the session token is unavailable', async () => {
    const { api, calls } = setup({
      apiHeaders: async () => {
        throw new SessionTokenUnavailableError();
      },
    });
    expect((await api.apiLoadSelf('user_ann'))?.name).toBe('Swift Otter');
    expect(calls[0]!.headers).toEqual({});
  });

  it('passes any other header failure on', async () => {
    const { api } = setup({
      apiHeaders: async () => {
        throw new Error('boom');
      },
    });
    await expect(api.apiLoadSelf('user_bob')).rejects.toThrow('boom');
  });
});

describe('deleting an account', () => {
  it('asks for the code, then deletes with it', async () => {
    const { api, calls } = setup();
    expect(await api.apiSendDeletionCode()).toBe('sent');
    await api.apiDeleteAccount('123456');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/account/deletion-code',
      'DELETE /api/account',
    ]);
    expect(JSON.parse(String(calls[1]!.body))).toEqual({ code: '123456' });
  });
});
