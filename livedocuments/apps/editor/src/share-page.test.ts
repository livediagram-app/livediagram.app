import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import { isSharePagePath, SHARE_PITCH } from './share-page';

// The share page's head (docs/specs/013-workspace/share-link-previews.md "The share page's head"): the editor worker
// hands its share page to liveworkspace's (@liveworkspace/media createSharePage, tested there) with livedocuments'
// words and the previews origin it is given.

// HTMLRewriter is a Workers runtime global: this stand-in records what each handler set.
class RecordingRewriter {
  handlers: [string, { element(el: unknown): void }][] = [];
  on(selector: string, handler: { element(el: unknown): void }) {
    this.handlers.push([selector, handler]);
    return this;
  }
  transform(response: Response): Response {
    const edits: Record<string, string> = {};
    for (const [selector, handler] of this.handlers) {
      handler.element({
        setAttribute: (_: string, value: string) => void (edits[selector] = value),
        setInnerContent: (content: string) => void (edits[selector] = content),
      });
    }
    return new Response(JSON.stringify(edits), {
      status: response.status,
      headers: response.headers,
    });
  }
}

const SHELL = '<html><head><title>livedocuments</title></head><body></body></html>';

function makeEnv(previewsOrigin?: string) {
  const assets: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        assets.push(new URL(req.url).pathname);
        return new Response(SHELL, { headers: { 'content-type': 'text/html' } });
      },
    },
    ...(previewsOrigin ? { PREVIEWS_ORIGIN: previewsOrigin } : {}),
  };
  return { env: env as never, assets };
}

const get = (path: string, env: never) =>
  worker.fetch(new Request(`https://www.livedocuments.app${path}`), env);

let asked: string[];
beforeEach(() => {
  asked = [];
  vi.stubGlobal('HTMLRewriter', RecordingRewriter);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      asked.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return Response.json({ name: 'Payments flow' });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('editor worker: the share page', () => {
  it('is the share page, with or without its slash, and its legacy address', () => {
    expect(isSharePagePath('/document/shared')).toBe(true);
    expect(isSharePagePath('/diagram/shared/')).toBe(true);
    expect(isSharePagePath('/document/abc')).toBe(false);
  });

  it("names the document the link opens, from liveworkspace's previews, in the editor page's headers", async () => {
    const { env, assets } = makeEnv();
    const res = await get('/document/shared?s=CODE1234', env);
    expect(assets).toEqual(['/document/placeholder']);
    expect(asked).toEqual(['https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/previews/share/CODE1234/card']);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    const edits = (await res.json()) as Record<string, string>;
    expect(edits.title).toBe('Payments flow');
    expect(edits['meta[name="description"]']).toBe(SHARE_PITCH);
    expect(edits['meta[property="og:image"]']).toBe(
      'https://www.livedocuments.app/api/previews/share/CODE1234/image.png',
    );
    expect(edits['meta[property="og:image:alt"]']).toBe('Payments flow, drawn in livedocuments');
  });

  it('asks the previews origin it is given (staging)', async () => {
    const { env } = makeEnv('https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev');
    await get('/document/shared?s=C', env);
    expect(asked).toEqual(['https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev/api/previews/share/C/card']);
  });

  it("never asks about a document's own address, which only its owner can open", async () => {
    const { env } = makeEnv();
    expect(await (await get('/document/abc?s=C', env)).text()).toBe(SHELL);
    expect(asked).toEqual([]);
  });
});
