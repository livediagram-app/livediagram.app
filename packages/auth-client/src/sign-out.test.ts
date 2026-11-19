import { describe, expect, it, vi } from 'vitest';
import { askSignOut } from './sign-out';
import { SIGNED_OUT_HERE_KEY, takeSignedOutHere } from './signed-out-here';

const answer = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

describe('askSignOut', () => {
  it("posts to the app's own API with the way back, and answers the hop", async () => {
    const hop = 'https://www.liveworkspace.app/api/auth/end-session?ticket=t';
    const fetchImpl = answer({ signedIn: false, next: hop });
    expect(await askSignOut('/pricing?x=1', { fetchImpl })).toEqual({ ok: true, next: hop });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/api/auth/sign-out?return=%2Fpricing%3Fx%3D1');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
  });

  it('takes another API base', async () => {
    const fetchImpl = answer({ next: null });
    await askSignOut('/', { apiBase: '/x/api', fetchImpl });
    expect(fetchImpl.mock.calls[0]![0]).toBe('/x/api/auth/sign-out?return=%2F');
  });

  it('signs out without a hop when there is none, or none a browser should follow', async () => {
    expect(await askSignOut('/', { fetchImpl: answer({ next: null }) })).toEqual({
      ok: true,
      next: null,
    });
    expect(await askSignOut('/', { fetchImpl: answer({ next: 'javascript:alert(1)' }) })).toEqual({
      ok: true,
      next: null,
    });
    const notJson = vi.fn<typeof fetch>(async () => new Response('ok'));
    expect(await askSignOut('/', { fetchImpl: notJson })).toEqual({ ok: true, next: null });
  });

  it('notes a sign-out of this app alone for the landing page, only when asked and only without a hop', async () => {
    const items = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    });
    try {
      const hop = 'https://www.liveworkspace.app/api/auth/end-session?ticket=t';
      await askSignOut('/', { fetchImpl: answer({ next: hop }), noteHereOnly: true });
      await askSignOut('/', { fetchImpl: answer({}, 503), noteHereOnly: true });
      await askSignOut('/', { fetchImpl: answer({ next: null }) });
      expect(items.has(SIGNED_OUT_HERE_KEY)).toBe(false);
      await askSignOut('/', { fetchImpl: answer({ next: null }), noteHereOnly: true });
      expect(takeSignedOutHere()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('says so when the API refused or was not reached', async () => {
    expect(await askSignOut('/', { fetchImpl: answer({}, 429) })).toEqual({
      ok: false,
      next: null,
    });
    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError('offline');
    });
    expect(await askSignOut('/', { fetchImpl: down })).toEqual({ ok: false, next: null });
  });

  it('uses the global fetch by default', async () => {
    const fetchImpl = answer({ next: null });
    vi.stubGlobal('fetch', fetchImpl);
    try {
      expect(await askSignOut('/')).toEqual({ ok: true, next: null });
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
