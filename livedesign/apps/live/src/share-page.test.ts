import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import { isSharePagePath, SHARE_PITCH } from './share-page';

// The share page's head (docs/specs/013-workspace/share-link-previews.md "The share page's head"): the live worker
// hands its share page to liveworkspace's (@liveworkspace/media createSharePage, tested there) with livedesign's
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

const SHELL = '<html><head><title>livedesign</title></head><body></body></html>';

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
  worker.fetch(new Request(`https://www.livedesign.app${path}`), env);

let asked: string[];
beforeEach(() => {
  asked = [];
  vi.stubGlobal('HTMLRewriter', RecordingRewriter);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      asked.push(input instanceof Request ? input.url : input.toString());
      return Response.json({ name: 'Payments flow' });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('live worker: the share page', () => {
  it('is the share page, with or without its slash, and its legacy address', () => {
    expect(isSharePagePath('/design/shared')).toBe(true);
    expect(isSharePagePath('/diagram/shared/')).toBe(true);
    expect(isSharePagePath('/design/abc')).toBe(false);
  });

  it("names the design the link opens, from liveworkspace's previews, in the live page's headers", async () => {
    const { env, assets } = makeEnv();
    const res = await get('/design/shared?s=CODE1234', env);
    expect(assets).toEqual(['/design/placeholder']);
    expect(asked).toEqual(['https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/api/previews/share/CODE1234/card']);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    const edits = (await res.json()) as Record<string, string>;
    expect(edits.title).toBe('Payments flow');
    expect(edits['meta[name="description"]']).toBe(SHARE_PITCH);
    expect(edits['meta[property="og:image"]']).toBe(
      'https://www.livedesign.app/api/previews/share/CODE1234/image.png',
    );
    expect(edits['meta[property="og:image:alt"]']).toBe('Payments flow, drawn in livedesign');
  });

  it('asks the previews origin it is given (staging)', async () => {
    const { env } = makeEnv('https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev');
    await get('/design/shared?s=C', env);
    expect(asked).toEqual(['https://liveworkspace-gateway-staging.liveworkspace-easing509.workers.dev/api/previews/share/C/card']);
  });

  it("never asks about a design's own address, which only its owner can open", async () => {
    const { env } = makeEnv();
    expect(await (await get('/design/abc?s=C', env)).text()).toBe(SHELL);
    expect(asked).toEqual([]);
  });
});
