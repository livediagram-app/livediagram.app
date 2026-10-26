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
});
