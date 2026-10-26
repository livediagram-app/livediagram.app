import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_CLIENT_IP_HEADER } from '@liveworkspace/sites/workspace-proxy';
import { createSharePage, SHARE_CARD_TIMEOUT_MS } from './share-page';

// A share link's page head (liveworkspace/docs/previews.md "The share page's head"): a working share link previews
// with its item's name and card; anything else is the shell as built.

const PITCH = 'Open it in livediagram: diagrams, made together.';
const { isSharePagePath, shareHead, sharePage } = createSharePage({
  app: 'livediagram',
  pagePath: /^\/(?:document|diagram)\/shared\/?$/,
  untitled: 'Untitled document',
  pitch: PITCH,
});

// HTMLRewriter is a Workers runtime global. This stand-in runs every handler against one recording element per
// selector and answers what was set, so a test reads exactly what was written into the head.
type Edits = Record<string, { attrs: Record<string, string>; inner?: string }>;
class RecordingRewriter {
  handlers: [string, { element(el: unknown): void }][] = [];
  on(selector: string, handler: { element(el: unknown): void }) {
    this.handlers.push([selector, handler]);
    return this;
  }
  transform(response: Response): Response {
    const edits: Edits = {};
    for (const [selector, handler] of this.handlers) {
      const edit = (edits[selector] ??= { attrs: {} });
      handler.element({
        setAttribute: (name: string, value: string) => void (edit.attrs[name] = value),
        setInnerContent: (content: string) => void (edit.inner = content),
      });
    }
    return new Response(JSON.stringify(edits), {
      status: response.status,
      headers: response.headers,
    });
  }
}

const SHELL = '<html><head><title>livediagram</title></head><body></body></html>';
const shell =
  (status = 200) =>
  async () =>
    new Response(SHELL, { status, headers: { 'content-type': 'text/html' } });

function service(answer: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const doFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return answer(url, init);
  }) as typeof fetch;
  return { calls, doFetch };
}

const visit = (path: string, init: RequestInit = {}) =>
  new Request(`https://livediagram-router.liveworkspace-easing509.workers.dev${path}`, init);

beforeEach(() => {
  vi.stubGlobal('HTMLRewriter', RecordingRewriter);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isSharePagePath', () => {
  it("is the app's share page, with or without its slash", () => {
    expect(isSharePagePath('/document/shared')).toBe(true);
    expect(isSharePagePath('/document/shared/')).toBe(true);
    expect(isSharePagePath('/diagram/shared')).toBe(true);
    expect(isSharePagePath('/document/abc')).toBe(false);
    expect(isSharePagePath('/document/shared/x')).toBe(false);
  });
});

describe('shareHead', () => {
  it('names the item and points at its share card on this origin', () => {
    expect(
      shareHead(
        'Payments flow',
        'Ab 12',
        'https://livediagram-router-staging.liveworkspace-easing509.workers.dev',
      ),
    ).toEqual({
      title: 'Payments flow',
      description: PITCH,
      image:
        'https://livediagram-router-staging.liveworkspace-easing509.workers.dev/api/previews/share/Ab%2012/image.png',
      imageAlt: 'Payments flow, drawn in livediagram',
    });
  });

  it('keeps a preview to one tidy line, and never blank', () => {
    expect(shareHead('  Q3\n\n  plan  ', 'c', 'https://x').title).toBe('Q3 plan');
    expect(shareHead('x'.repeat(500), 'c', 'https://x').title).toHaveLength(200);
    expect(shareHead('   ', 'c', 'https://x').title).toBe('Untitled document');
  });
});

describe('sharePage', () => {
  it("fills the shell's head with the item the link names, asking the service once", async () => {
    const { calls, doFetch } = service(() => Response.json({ name: 'Payments flow' }));
    const res = await sharePage(visit('/document/shared?s=CODE1234'), shell(), { fetch: doFetch });
    expect(calls.map((c) => c.url)).toEqual([
      'https://www.liveworkspace.app/api/previews/share/CODE1234/card',
    ]);
    const edits = (await res.json()) as Edits;
    const image =
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/previews/share/CODE1234/image.png';
    expect(edits.title!.inner).toBe('Payments flow');
    expect(edits['meta[name="description"]']!.attrs.content).toBe(PITCH);
    expect(edits['meta[property="og:title"]']!.attrs.content).toBe('Payments flow');
    expect(edits['meta[property="og:description"]']!.attrs.content).toBe(PITCH);
    expect(edits['meta[property="og:image"]']!.attrs.content).toBe(image);
    expect(edits['meta[property="og:image:alt"]']!.attrs.content).toBe(
      'Payments flow, drawn in livediagram',
    );
    expect(edits['meta[name="twitter:title"]']!.attrs.content).toBe('Payments flow');
    expect(edits['meta[name="twitter:description"]']!.attrs.content).toBe(PITCH);
    expect(edits['meta[name="twitter:image"]']!.attrs.content).toBe(image);
  });

  it("asks the origin named (local dev, staging), passing the visitor's address on", async () => {
    const { calls, doFetch } = service(() => Response.json({ name: 'n' }));
    await sharePage(
      visit('/document/shared?s=C', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }),
      shell(),
      { fetch: doFetch, previewsOrigin: 'http://127.0.0.1:8792' },
    );
    expect(calls[0]!.url).toBe('http://127.0.0.1:8792/api/previews/share/C/card');
    expect(new Headers(calls[0]!.init!.headers).get(WORKSPACE_CLIENT_IP_HEADER)).toBe(
      '203.0.113.9',
    );
    expect(calls[0]!.init!.signal).toBeInstanceOf(AbortSignal);
    await sharePage(visit('/document/shared?s=C'), shell(), { fetch: doFetch });
    expect(new Headers(calls[1]!.init!.headers).has(WORKSPACE_CLIENT_IP_HEADER)).toBe(false);
  });

  it('serves the shell as built when the link previews as the app', async () => {
    const { doFetch } = service(() => Response.json({ error: 'not_found' }, { status: 404 }));
    const res = await sharePage(visit('/document/shared?s=GATED'), shell(), { fetch: doFetch });
    expect(await res.text()).toBe(SHELL);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('serves the shell as built, and says so, when the service fails or cannot be reached', async () => {
    const failing = service(() => new Response('boom', { status: 500 }));
    const page = visit('/document/shared?s=C');
    expect(await (await sharePage(page, shell(), { fetch: failing.doFetch })).text()).toBe(SHELL);
    expect(console.warn).toHaveBeenCalledWith('[share-page] previews answered', 500);

    const down = service(() => Promise.reject(new Error('timeout')));
    expect(await (await sharePage(page, shell(), { fetch: down.doFetch })).text()).toBe(SHELL);
    expect(console.warn).toHaveBeenCalledWith(
      '[share-page] previews unreachable',
      'Error: timeout',
    );
  });

  it('ignores an answer with no name in it', async () => {
    const { doFetch } = service(() => Response.json({}));
    const res = await sharePage(visit('/document/shared?s=C'), shell(), { fetch: doFetch });
    expect(await res.text()).toBe(SHELL);
  });

  it('waits on the service no longer than its budget', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { doFetch } = service(() => Response.json({ name: 'n' }));
    await sharePage(visit('/document/shared?s=C'), shell(), { fetch: doFetch });
    expect(timeout).toHaveBeenCalledWith(SHARE_CARD_TIMEOUT_MS);
  });

  it('asks nothing without a code or a GET', async () => {
    const { calls, doFetch } = service(() => Response.json({ name: 'n' }));
    expect(
      await (await sharePage(visit('/document/shared'), shell(), { fetch: doFetch })).text(),
    ).toBe(SHELL);
    const head = await sharePage(visit('/document/shared?s=C', { method: 'HEAD' }), shell(), {
      fetch: doFetch,
    });
    expect(head.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it('leaves a failed shell alone', async () => {
    const { doFetch } = service(() => Response.json({ name: 'n' }));
    const res = await sharePage(visit('/document/shared?s=C'), shell(503), { fetch: doFetch });
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(SHELL);
  });
});
