import { afterEach, describe, expect, it, vi } from 'vitest';
import { unfurl } from './unfurl-fetch';

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

function stubPage() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const res = new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(res, 'url', { value: 'https://example.com/page' });
      return res;
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('unfurl', () => {
  it("titles the card with the page's <title>, never an inline SVG's titles after it", async () => {
    stubRewriter([
      { tag: 'title', text: 'My Page' },
      { tag: 'title', text: 'Menu' },
      { tag: 'title', text: 'Close' },
    ]);
    stubPage();
    const out = await unfurl(new URL('https://example.com/page'), 'test');
    expect(out).toMatchObject({ result: { title: 'My Page' } });
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
    stubPage();
    const out = await unfurl(new URL('https://example.com/page'), 'test');
    expect(out).toMatchObject({ result: { title: 'My Page' } });
  });

  it('keeps the deadline while the body is read: a page trickling its <head> is cut off', async () => {
    vi.useFakeTimers();
    try {
      // The headers come at once; the body never finishes until the request is aborted.
      let aborted = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init: RequestInit) => {
          const body = new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(new TextEncoder().encode('<html><head>'));
              init.signal?.addEventListener('abort', () => {
                aborted = true;
                c.error(new DOMException('aborted', 'AbortError'));
              });
            },
          });
          const res = new Response(body, { headers: { 'content-type': 'text/html' } });
          Object.defineProperty(res, 'url', { value: 'https://example.com/slow' });
          return res;
        }),
      );
      stubRewriter([]);
      const out = unfurl(new URL('https://example.com/slow'), 'test');
      await vi.advanceTimersByTimeAsync(8000);
      expect(aborted).toBe(true);
      await expect(out).resolves.toEqual({
        result: { url: 'https://example.com/slow', favicon: 'https://example.com/favicon.ico' },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers the bare URL when the fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      }),
    );
    const out = await unfurl(new URL('https://example.com/down'), 'test');
    expect(out).toEqual({ result: { url: 'https://example.com/down' } });
  });

  it('refuses a redirect that ends on a private host, and never reads its body', async () => {
    const cancel = vi.fn(async () => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const res = new Response('secret', { headers: { 'content-type': 'text/html' } });
        Object.defineProperty(res, 'url', { value: 'http://169.254.169.254/' });
        Object.defineProperty(res, 'body', { value: { cancel } });
        return res;
      }),
    );
    const out = await unfurl(new URL('https://example.com/redirects'), 'test');
    expect(out).toEqual({ disallowed: true });
    expect(cancel).toHaveBeenCalled();
  });

  it('offers a favicon alone for a page that is not HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const res = new Response('%PDF', { headers: { 'content-type': 'application/pdf' } });
        Object.defineProperty(res, 'url', { value: 'https://example.com/a.pdf' });
        return res;
      }),
    );
    const out = await unfurl(new URL('https://example.com/a.pdf'), 'test');
    expect(out).toEqual({
      result: { url: 'https://example.com/a.pdf', favicon: 'https://example.com/favicon.ico' },
    });
  });
});
