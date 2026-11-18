// The link unfurl's fetch (unfurl-fetch.ts): every hop checked by the address its name resolves to, redirects
// followed by hand, bounded in time and bytes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Resolve } from './public-address';
import { unfurl, UNFURL_MAX_REDIRECTS, type UnfurlOptions } from './unfurl-fetch';

// HTMLRewriter is the Workers runtime's; this stand-in replays a page's elements and text, in document order, to the
// handlers the unfurl registers.
type Handlers = {
  element?: (el: { getAttribute: (name: string) => string | null }) => void;
  text?: (t: { text: string }) => void;
};
type Node = { tag: string; attrs?: Record<string, string>; text?: string };

function stubRewriter(nodes: Node[]) {
  class FakeRewriter {
    private handlers: [string, Handlers][] = [];
    on(selector: string, handlers: Handlers) {
      this.handlers.push([selector, handlers]);
      return this;
    }
    transform(res: Response) {
      for (const node of nodes) {
        for (const [selector, h] of this.handlers) {
          if (selector !== node.tag) continue;
          h.element?.({ getAttribute: (name) => node.attrs?.[name] ?? null });
          if (node.text !== undefined) h.text?.({ text: node.text });
        }
      }
      return res;
    }
  }
  vi.stubGlobal('HTMLRewriter', FakeRewriter);
}

const PUBLIC: Resolve = async () => ['93.184.216.34'];
const html = (body = '<html></html>') =>
  new Response(body, { headers: { 'content-type': 'text/html' } });
const redirect = (location: string | null, status = 302) =>
  new Response(null, { status, headers: location === null ? {} : { Location: location } });

// A site: each URL's answer, and every request it was asked, in order.
function site(answers: Record<string, () => Response>, resolve: Resolve = PUBLIC) {
  const asked: Request[] = [];
  const options: UnfurlOptions = {
    resolve,
    fetch: async (request) => {
      asked.push(request);
      const answer = answers[request.url];
      if (!answer) throw new TypeError(`no route to ${request.url}`);
      return answer();
    },
  };
  return { options, asked };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('unfurl', () => {
  it("titles the card with the page's <title>, never an inline SVG's titles after it", async () => {
    stubRewriter([
      { tag: 'title', text: 'My Page' },
      { tag: 'title', text: 'Menu' },
      { tag: 'title', text: 'Close' },
    ]);
    const { options, asked } = site({ 'https://example.com/page': () => html() });
    const out = await unfurl(new URL('https://example.com/page'), 'test', options);
    expect(out).toMatchObject({ result: { url: 'https://example.com/page', title: 'My Page' } });
    expect(asked[0]!.redirect).toBe('manual');
    expect(asked[0]!.headers.get('User-Agent')).toBe('test');
  });

  it('keeps a title that arrives in several text chunks', async () => {
    // One <title> element whose text arrives in two chunks.
    class Chunked {
      private h: Handlers | undefined;
      on(selector: string, handlers: Handlers) {
        if (selector === 'title') this.h = handlers;
        return this;
      }
      transform(res: Response) {
        this.h?.element?.({ getAttribute: () => null });
        this.h?.text?.({ text: 'My ' });
        this.h?.text?.({ text: 'Page' });
        return res;
      }
    }
    vi.stubGlobal('HTMLRewriter', Chunked);
    const { options } = site({ 'https://example.com/page': () => html() });
    const out = await unfurl(new URL('https://example.com/page'), 'test', options);
    expect(out).toMatchObject({ result: { title: 'My Page' } });
  });

  it('keeps the deadline while the body is read: a page trickling its <head> is cut off', async () => {
    vi.useFakeTimers();
    // The headers come at once; the body never finishes until the request is aborted.
    let aborted = false;
    const options: UnfurlOptions = {
      resolve: PUBLIC,
      fetch: async (request) => {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode('<html><head>'));
            request.signal.addEventListener('abort', () => {
              aborted = true;
              c.error(new DOMException('aborted', 'AbortError'));
            });
          },
        });
        return new Response(body, { headers: { 'content-type': 'text/html' } });
      },
    };
    stubRewriter([]);
    const out = unfurl(new URL('https://example.com/slow'), 'test', options);
    await vi.advanceTimersByTimeAsync(8000);
    expect(aborted).toBe(true);
    await expect(out).resolves.toEqual({
      result: { url: 'https://example.com/slow', favicon: 'https://example.com/favicon.ico' },
    });
  });

  it('asks for nothing once the lookups have run past the deadline', async () => {
    vi.useFakeTimers();
    const { options, asked } = site({ 'https://example.com/': () => html() }, async () => {
      await new Promise((settle) => setTimeout(settle, 9000));
      return ['93.184.216.34'];
    });
    const out = unfurl(new URL('https://example.com/'), 'test', options);
    await vi.advanceTimersByTimeAsync(9000);
    await expect(out).resolves.toEqual({ result: { url: 'https://example.com/' } });
    expect(asked).toHaveLength(0);
  });

  it('answers the bare URL when the fetch itself fails', async () => {
    const { options } = site({});
    const out = await unfurl(new URL('https://example.com/down'), 'test', options);
    expect(out).toEqual({ result: { url: 'https://example.com/down' } });
  });

  it('offers a favicon alone for a page that is not HTML', async () => {
    const { options } = site({
      'https://example.com/a.pdf': () =>
        new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    });
    const out = await unfurl(new URL('https://example.com/a.pdf'), 'test', options);
    expect(out).toEqual({
      result: { url: 'https://example.com/a.pdf', favicon: 'https://example.com/favicon.ico' },
    });
  });

  it('reads the first of each card field from the <head>, og tags before bare ones', async () => {
    stubRewriter([
      { tag: 'title', text: '  ' },
      { tag: 'meta', attrs: { charset: 'utf-8' } },
      { tag: 'meta', attrs: { property: 'og:title' } },
      { tag: 'meta', attrs: { property: 'OG:Title', content: 'Open Graph Title' } },
      { tag: 'meta', attrs: { property: 'og:title', content: 'Second Title' } },
      { tag: 'meta', attrs: { property: 'og:site_name', content: 'Example' } },
      { tag: 'meta', attrs: { property: 'og:image:url', content: '/card.png' } },
      { tag: 'meta', attrs: { property: 'og:image', content: '/other.png' } },
      { tag: 'meta', attrs: { name: 'description', content: 'Plain description' } },
      { tag: 'meta', attrs: { property: 'og:description', content: 'OG description' } },
      { tag: 'meta', attrs: { name: 'keywords', content: 'ignored' } },
      { tag: 'link', attrs: { rel: 'stylesheet', href: '/s.css' } },
      { tag: 'link', attrs: { rel: 'icon' } },
      { tag: 'link', attrs: { rel: 'Shortcut Icon', href: '/icon.png' } },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple.png' } },
      { tag: 'link', attrs: {} },
    ]);
    const { options } = site({ 'https://example.com/a': () => html() });
    const out = await unfurl(new URL('https://example.com/a'), 'test', options);
    expect(out).toEqual({
      result: {
        url: 'https://example.com/a',
        title: 'Open Graph Title',
        siteName: 'Example',
        description: 'OG description',
        image: 'https://example.com/card.png',
        favicon: 'https://example.com/icon.png',
      },
    });
  });

  it('reads a page with no body as an empty <head>', async () => {
    stubRewriter([]);
    const { options } = site({
      'https://example.com/empty': () =>
        new Response(null, { headers: { 'content-type': 'text/html' } }),
    });
    const out = await unfurl(new URL('https://example.com/empty'), 'test', options);
    expect(out).toEqual({
      result: { url: 'https://example.com/empty', favicon: 'https://example.com/favicon.ico' },
    });
  });

  it('stops reading at the byte cap and lets the rest go', async () => {
    stubRewriter([]);
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled += 1;
        c.enqueue(new Uint8Array(64 * 1024));
      },
      // A source that fails to let go still leaves the card its fields.
      cancel() {
        throw new Error('already gone');
      },
    });
    const { options } = site({
      'https://example.com/huge': () =>
        new Response(endless, { headers: { 'content-type': 'text/html' } }),
    });
    const out = await unfurl(new URL('https://example.com/huge'), 'test', options);
    expect(out).toMatchObject({ result: { url: 'https://example.com/huge' } });
    expect(pulled).toBeLessThan(20);
  });

  it('offers a favicon alone for an answer with no type', async () => {
    const { options } = site({ 'https://example.com/raw': () => new Response(null) });
    const out = await unfurl(new URL('https://example.com/raw'), 'test', options);
    expect(out).toEqual({
      result: { url: 'https://example.com/raw', favicon: 'https://example.com/favicon.ico' },
    });
  });

  it('keeps previewing an http link', async () => {
    stubRewriter([{ tag: 'title', text: 'Old Site' }]);
    const { options } = site({ 'http://example.com:8080/': () => html() });
    const out = await unfurl(new URL('http://example.com:8080/'), 'test', options);
    expect(out).toMatchObject({ result: { url: 'http://example.com:8080/', title: 'Old Site' } });
  });
});

describe('unfurl: every hop checked', () => {
  it('refuses a name that resolves to a private address, and never asks it', async () => {
    const { options, asked } = site(
      { 'https://sneaky.example.com/': () => html('secret') },
      async () => ['10.0.0.5'],
    );
    const out = await unfurl(new URL('https://sneaky.example.com/'), 'test', options);
    expect(out).toEqual({ disallowed: true });
    expect(asked).toHaveLength(0);
  });

  it('answers the bare URL for a name that will not resolve, without asking it', async () => {
    const { options, asked } = site(
      { 'https://gone.example.com/': () => html() },
      async () => null,
    );
    const out = await unfurl(new URL('https://gone.example.com/'), 'test', options);
    expect(out).toEqual({ result: { url: 'https://gone.example.com/' } });
    expect(asked).toHaveLength(0);
  });

  it('refuses a redirect to a private address, never asking it, and lets the first answer go', async () => {
    const cancel = vi.fn(async () => {});
    const { options, asked } = site({
      'https://example.com/redirects': () => {
        const res = redirect('http://169.254.169.254/latest/meta-data/');
        Object.defineProperty(res, 'body', { value: { cancel } });
        return res;
      },
    });
    const out = await unfurl(new URL('https://example.com/redirects'), 'test', options);
    expect(out).toEqual({ disallowed: true });
    expect(asked.map((r) => r.url)).toEqual(['https://example.com/redirects']);
    expect(cancel).toHaveBeenCalled();
  });

  it('refuses a redirect to a name that resolves to a private address, never asking it', async () => {
    const { options, asked } = site(
      {
        'https://example.com/go': () => redirect('https://internal-alias.example.net/admin'),
        'https://internal-alias.example.net/admin': () => html('secret'),
      },
      async (host) =>
        host === 'internal-alias.example.net' ? ['192.168.1.10'] : ['93.184.216.34'],
    );
    const out = await unfurl(new URL('https://example.com/go'), 'test', options);
    expect(out).toEqual({ disallowed: true });
    expect(asked.map((r) => r.url)).toEqual(['https://example.com/go']);
  });

  it('previews the end of a public redirect chain, relative locations included, and resolves each hop', async () => {
    stubRewriter([{ tag: 'title', text: 'Landed' }]);
    const looked: string[] = [];
    const { options, asked } = site(
      {
        'http://short.example/x': () => redirect('https://www.example.com/start', 301),
        'https://www.example.com/start': () => redirect('/landing', 307),
        'https://www.example.com/landing': () => html(),
      },
      async (host) => {
        looked.push(host);
        return ['93.184.216.34'];
      },
    );
    const out = await unfurl(new URL('http://short.example/x'), 'test', options);
    expect(out).toMatchObject({
      result: {
        url: 'https://www.example.com/landing',
        title: 'Landed',
        favicon: 'https://www.example.com/favicon.ico',
      },
    });
    expect(asked.map((r) => r.url)).toEqual([
      'http://short.example/x',
      'https://www.example.com/start',
      'https://www.example.com/landing',
    ]);
    expect(looked).toEqual(['short.example', 'www.example.com', 'www.example.com']);
  });

  it(`stops after ${UNFURL_MAX_REDIRECTS} redirects with the bare URL`, async () => {
    const answers: Record<string, () => Response> = {};
    for (let i = 0; i <= UNFURL_MAX_REDIRECTS + 1; i += 1) {
      answers[`https://example.com/${i}`] = () => redirect(`/${i + 1}`);
    }
    const { options, asked } = site(answers);
    const out = await unfurl(new URL('https://example.com/0'), 'test', options);
    expect(out).toEqual({ result: { url: 'https://example.com/0' } });
    expect(asked).toHaveLength(UNFURL_MAX_REDIRECTS + 1);
  });

  it.each([
    ['no Location', null],
    ['a Location that is no URL', 'http://['],
    ['a Location to another scheme', 'ftp://example.com/file'],
  ])('answers the bare URL for a redirect with %s', async (_label, location) => {
    const { options } = site({ 'https://example.com/r': () => redirect(location) });
    const out = await unfurl(new URL('https://example.com/r'), 'test', options);
    expect(out).toEqual({ result: { url: 'https://example.com/r' } });
  });

  it('asks the runtime’s resolver and fetch by default', async () => {
    stubRewriter([{ tag: 'title', text: 'Default' }]);
    const doh = vi.fn(async () => Response.json({ Answer: [{ type: 1, data: '93.184.216.34' }] }));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (typeof input === 'string' && input.startsWith('https://cloudflare-dns.com/'))
        return doh();
      return html();
    });
    const out = await unfurl(new URL('https://example.com/'), 'test');
    expect(out).toMatchObject({ result: { title: 'Default' } });
    expect(doh).toHaveBeenCalledTimes(2);
  });
});
