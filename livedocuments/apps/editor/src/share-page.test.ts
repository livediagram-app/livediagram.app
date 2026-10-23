import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import {
  SHARE_CARD_TIMEOUT_MS,
  SHARE_PITCH,
  isSharePagePath,
  shareHead,
  type Fetcher,
} from './share-page';

// The share page's head (docs/specs/013-workspace/share-link-previews.md "The share page's head"): a working share
// link previews with its document's name and card; anything else is the shell as built.

// HTMLRewriter is a Workers runtime global. This stand-in runs every handler against one recording element per
// selector and answers what was set, so a test reads exactly what the worker wrote into the head.
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

const SHELL = '<html><head><title>livedocuments</title></head><body></body></html>';

function makeEnv(
  api?: (path: string, init?: RequestInit) => Promise<Response> | Response,
  shellStatus = 200,
) {
  const assets: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        assets.push(new URL(req.url).pathname);
        return new Response(SHELL, {
          status: shellStatus,
          headers: { 'content-type': 'text/html' },
        });
      },
    },
    ...(api
      ? {
          API: {
            fetch: async (input, init) =>
              api(new URL(typeof input === 'string' ? input : input.url).pathname, init),
          } satisfies Fetcher,
        }
      : {}),
  };
  return { env: env as never, assets };
}

const get = (path: string, env: never, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://www.livedocuments.app${path}`, init), env);

beforeEach(() => {
  vi.stubGlobal('HTMLRewriter', RecordingRewriter);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isSharePagePath', () => {
  it('is the share page, with or without its slash, and its legacy address', () => {
    expect(isSharePagePath('/document/shared')).toBe(true);
    expect(isSharePagePath('/document/shared/')).toBe(true);
    expect(isSharePagePath('/diagram/shared')).toBe(true);
    expect(isSharePagePath('/document/abc')).toBe(false);
    expect(isSharePagePath('/document/shared/x')).toBe(false);
  });
});

describe('shareHead', () => {
  it('names the document and points at its share card on this origin', () => {
    expect(shareHead('Payments flow', 'Ab 12', 'https://staging.livedocuments.app')).toEqual({
      title: 'Payments flow',
      description: SHARE_PITCH,
      image: 'https://staging.livedocuments.app/api/share/Ab%2012/image.png',
      imageAlt: 'Payments flow, drawn in livedocuments',
    });
  });

  it('keeps a preview to one tidy line, and never blank', () => {
    expect(shareHead('  Q3\n\n  plan  ', 'c', 'https://x').title).toBe('Q3 plan');
    expect(shareHead('x'.repeat(500), 'c', 'https://x').title).toHaveLength(200);
    expect(shareHead('   ', 'c', 'https://x').title).toBe('Untitled document');
  });
});

describe('editor worker: the share page', () => {
  it("fills the shell's head with the document the link names, asking the api once", async () => {
    const seen: string[] = [];
    const { env, assets } = makeEnv((path) => {
      seen.push(path);
      return Response.json({ name: 'Payments flow' });
    });
    const res = await get('/document/shared?s=CODE1234', env);
    expect(assets).toEqual(['/document/placeholder']);
    expect(seen).toEqual(['/api/share/CODE1234/card']);
    expect(res.status).toBe(200);
    // Still the editor page's headers.
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    const edits = (await res.json()) as Edits;
    const image = 'https://www.livedocuments.app/api/share/CODE1234/image.png';
    expect(edits.title!.inner).toBe('Payments flow');
    expect(edits['meta[name="description"]']!.attrs.content).toBe(SHARE_PITCH);
    expect(edits['meta[property="og:title"]']!.attrs.content).toBe('Payments flow');
    expect(edits['meta[property="og:description"]']!.attrs.content).toBe(SHARE_PITCH);
    expect(edits['meta[property="og:image"]']!.attrs.content).toBe(image);
    expect(edits['meta[property="og:image:alt"]']!.attrs.content).toBe(
      'Payments flow, drawn in livedocuments',
    );
    expect(edits['meta[name="twitter:title"]']!.attrs.content).toBe('Payments flow');
    expect(edits['meta[name="twitter:description"]']!.attrs.content).toBe(SHARE_PITCH);
    expect(edits['meta[name="twitter:image"]']!.attrs.content).toBe(image);
  });

  it("forwards the visitor's address, so the api limits previews per visitor", async () => {
    let init: RequestInit | undefined;
    const { env } = makeEnv((_, i) => {
      init = i;
      return Response.json({ name: 'n' });
    });
    await get('/document/shared?s=C', env, { headers: { 'CF-Connecting-IP': '203.0.113.9' } });
    expect(new Headers(init!.headers).get('CF-Connecting-IP')).toBe('203.0.113.9');
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    await get('/document/shared?s=C', env);
    expect(new Headers(init!.headers).has('CF-Connecting-IP')).toBe(false);
  });

  it('serves the shell as built when the api says the link previews as livedocuments', async () => {
    const { env } = makeEnv(() => Response.json({ error: 'not_found' }, { status: 404 }));
    const res = await get('/document/shared?s=GATED', env);
    expect(await res.text()).toBe(SHELL);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('serves the shell as built, and says so, when the api fails or cannot be reached', async () => {
    const failing = makeEnv(() => new Response('boom', { status: 500 }));
    expect(await (await get('/document/shared?s=C', failing.env)).text()).toBe(SHELL);
    expect(console.warn).toHaveBeenCalledWith('[share-page] api answered', 500);

    const down = makeEnv(() => Promise.reject(new Error('timeout')));
    expect(await (await get('/document/shared?s=C', down.env)).text()).toBe(SHELL);
    expect(console.warn).toHaveBeenCalledWith('[share-page] api unreachable', 'Error: timeout');
  });

  it('ignores an answer with no name in it', async () => {
    const { env } = makeEnv(() => Response.json({}));
    expect(await (await get('/document/shared?s=C', env)).text()).toBe(SHELL);
  });

  it('waits on the api no longer than its budget', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { env } = makeEnv(() => Response.json({ name: 'n' }));
    await get('/document/shared?s=C', env);
    expect(timeout).toHaveBeenCalledWith(SHARE_CARD_TIMEOUT_MS);
  });

  it('asks nothing without a code, a GET, or an api binding', async () => {
    const api = vi.fn(() => Response.json({ name: 'n' }));
    const { env } = makeEnv(api);
    expect(await (await get('/document/shared', env)).text()).toBe(SHELL);
    expect((await get('/document/shared?s=C', env, { method: 'HEAD' })).status).toBe(200);
    expect(api).not.toHaveBeenCalled();

    const unbound = makeEnv();
    const res = await get('/document/shared?s=C', unbound.env);
    expect(unbound.assets).toEqual(['/document/placeholder']);
    expect(await res.text()).toBe(SHELL);
  });

  it('leaves a failed shell alone', async () => {
    const { env } = makeEnv(() => Response.json({ name: 'n' }), 503);
    const res = await get('/document/shared?s=C', env);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(SHELL);
  });

  it("never asks about a document's own address, which only its owner can open", async () => {
    const api = vi.fn(() => Response.json({ name: 'n' }));
    const { env } = makeEnv(api);
    expect(await (await get('/document/abc?s=C', env)).text()).toBe(SHELL);
    expect(api).not.toHaveBeenCalled();
  });
});
