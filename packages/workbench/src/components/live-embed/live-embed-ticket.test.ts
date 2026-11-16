// A live embed's ticket (workbench.md "Live embed tickets"): asked of this page's own address with the reader's own
// token, bound to this page's origin; each refusal in the face's words.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { LIVE_EMBED_TICKET_PATH, requestLiveEmbedTicket } from './live-embed-ticket';

const ORIGIN = 'https://www.livedocuments.app';
const item = { app: 'liveplanner', itemId: 'p1' } as const;

function bind(bearer: string | null) {
  configureWorkbench(
    testBindings({
      api: { ...WORKBENCH_DEFAULTS.api, currentBearer: () => Promise.resolve(bearer) },
    }),
  );
}

function answer(res: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  configureWorkbench(WORKBENCH_DEFAULTS);
  vi.unstubAllGlobals();
});

describe('a live embed ticket', () => {
  it("asks with the reader's own token, for the item, bound to this page's origin", async () => {
    bind('at-ada');
    const fetchMock = answer(
      Response.json(
        { ticket: 't.1', path: '/embed/workbench?d=p1', expiresAt: 9 },
        { status: 201 },
      ),
    );
    expect(await requestLiveEmbedTicket(item, ORIGIN)).toEqual({
      ok: true,
      ticket: 't.1',
      path: '/embed/workbench?d=p1',
      expiresAt: 9,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`${ORIGIN}${LIVE_EMBED_TICKET_PATH}`);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer at-ada');
    expect(JSON.parse(init.body as string)).toEqual({
      target: 'liveplanner',
      itemId: 'p1',
      origin: ORIGIN,
    });
  });

  it('is no access with no one to ask as, and for 401, 403 and 404', async () => {
    bind(null);
    expect(await requestLiveEmbedTicket(item, ORIGIN)).toEqual({ ok: false, reason: 'no-access' });
    bind('at');
    for (const status of [401, 403, 404]) {
      answer(new Response(null, { status }));
      expect(await requestLiveEmbedTicket(item, ORIGIN)).toEqual({
        ok: false,
        reason: 'no-access',
      });
    }
  });

  it('is gone for a trashed item, and failed for anything else', async () => {
    bind('at');
    answer(new Response(null, { status: 410 }));
    expect(await requestLiveEmbedTicket(item, ORIGIN)).toEqual({ ok: false, reason: 'gone' });
    for (const res of [
      new Response(null, { status: 429 }),
      new Response(null, { status: 503 }),
      new Error('offline'),
      new Response('not json', { status: 201 }),
      Response.json({ ticket: 1, path: '/embed/workbench?d=p1', expiresAt: 1 }, { status: 201 }),
      Response.json({ ticket: 't', path: 'https://evil.example/', expiresAt: 1 }, { status: 201 }),
      Response.json({ ticket: 't', path: '/embed/workbench?d=p1' }, { status: 201 }),
    ]) {
      answer(res);
      expect(await requestLiveEmbedTicket(item, ORIGIN)).toEqual({ ok: false, reason: 'failed' });
    }
  });

  it("defaults to this page's origin", async () => {
    bind('at');
    const fetchMock = answer(new Response(null, { status: 404 }));
    vi.stubGlobal('window', { location: { origin: ORIGIN } });
    await requestLiveEmbedTicket(item);
    expect(String((fetchMock.mock.calls[0] as unknown as [URL])[0])).toBe(
      `${ORIGIN}${LIVE_EMBED_TICKET_PATH}`,
    );
  });
});
