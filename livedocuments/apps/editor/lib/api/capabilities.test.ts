// The capabilities answer is deployment config, so a page asks once however many surfaces need
// it (the editor, each Settings open), and asks again only after a failure.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGetCapabilities, resetCapabilitiesForTests } from './capabilities';

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  resetCapabilitiesForTests();
  vi.unstubAllGlobals();
});

describe('apiGetCapabilities', () => {
  it('asks the api once for every caller on the page', async () => {
    const fetchSpy = answer({ emailEnabled: true });
    vi.stubGlobal('fetch', fetchSpy);
    const [a, b] = await Promise.all([apiGetCapabilities(), apiGetCapabilities()]);
    const c = await apiGetCapabilities();
    expect(a.emailEnabled).toBe(true);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('answers closed on a failure, and asks again next time', async () => {
    vi.stubGlobal('fetch', answer({}, 500));
    expect(await apiGetCapabilities()).toEqual({ emailEnabled: false });
    const fetchSpy = answer({ emailEnabled: true });
    vi.stubGlobal('fetch', fetchSpy);
    expect((await apiGetCapabilities()).emailEnabled).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('answers closed when the api cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    expect(await apiGetCapabilities()).toEqual({ emailEnabled: false });
  });
});
