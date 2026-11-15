import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_CLIENT_IP_HEADER } from '@liveworkspace/sites/workspace-proxy';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  embedOpensReadOnly,
  embedSessionRole,
  EMBED_READ_ONLY_PARAM,
  isReadOnlyEmbed,
} from './embed-read-only';
import { createOEmbed, OEMBED_CACHE_AGE, oembedSize, readLimit } from './oembed';
import { SHARE_CARD_TIMEOUT_MS } from './share-card';

// A pasted share link's embed (liveworkspace/docs/specs/006-media/previews.md "Pasting a share link: GET /oembed"):
// a link the card door lets preview unfolds into its read-only embed; every other answer says nothing more.

const diagram = createOEmbed({ app: 'livediagram', untitled: 'Untitled canvas' });
const planner = createOEmbed({ app: 'liveplanner', untitled: 'Untitled plan' });

const SITE = 'https://www.livediagram.app';
const LINK = `${SITE}/document/shared?s=CODE1234`;

function service(answer: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const doFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return answer(url, init);
  }) as typeof fetch;
  return { calls, doFetch };
}

const named = (name = 'Payments flow') => service(() => Response.json({ name }));

const ask = (query: Record<string, string>, init: RequestInit = {}, origin = SITE) =>
  new Request(`${origin}/oembed?${new URLSearchParams(query)}`, init);

type Body = Record<string, unknown> & { html: string; error?: string };

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('isOEmbedPath', () => {
  it('is /oembed, with or without its slash', () => {
    expect(diagram.isOEmbedPath('/oembed')).toBe(true);
    expect(diagram.isOEmbedPath('/oembed/')).toBe(true);
    expect(diagram.isOEmbedPath('/oembed/x')).toBe(false);
    expect(diagram.isOEmbedPath('/api/oembed')).toBe(false);
  });
});

describe('oembed', () => {
  it('unfolds a working link into a rich, read-only iframe of its embed, with its name and share card', async () => {
    const { calls, doFetch } = named();
    const res = await diagram.oembed(ask({ url: LINK, format: 'json' }), { fetch: doFetch });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(calls.map((c) => c.url)).toEqual([
      'https://www.liveworkspace.app/api/previews/share/CODE1234/card',
    ]);
    expect(await res.json()).toEqual({
      version: '1.0',
      type: 'rich',
      title: 'Payments flow',
      provider_name: 'livediagram',
      provider_url: SITE,
      html:
        `<iframe src="${SITE}/embed?s=CODE1234&amp;readonly=1" width="800" height="500" ` +
        'title="Payments flow" style="border:0" allowfullscreen></iframe>',
      width: 800,
      height: 500,
      cache_age: OEMBED_CACHE_AGE,
      thumbnail_url: `${SITE}/api/previews/share/CODE1234/image.png`,
      thumbnail_width: 1200,
      thumbnail_height: 630,
    });
  });

  it('unfurls an edit link read-only: every iframe carries the read-only flag, whatever the role', async () => {
    // The endpoint never learns the role (the card door answers only the name), so every link gets the flag.
    const { doFetch } = named();
    const body = (await (
      await diagram.oembed(ask({ url: LINK }), { fetch: doFetch })
    ).json()) as Body;
    const src = /src="([^"]+)"/.exec(body.html)![1]!.replace(/&amp;/g, '&');
    expect(isReadOnlyEmbed(new URL(src).search)).toBe(true);
  });

  it('answers 404 for a link the share card refuses (password, revoked, expired, trashed), and no-store', async () => {
    const { doFetch } = service(() => Response.json({ error: 'not_found' }, { status: 404 }));
    const res = await diagram.oembed(ask({ url: LINK }), { fetch: doFetch });
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(((await res.json()) as Body).error).toBe('not_found');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('answers 404 for an answer with no name in it', async () => {
    const { doFetch } = service(() => Response.json({}));
    expect((await diagram.oembed(ask({ url: LINK }), { fetch: doFetch })).status).toBe(404);
  });

  it('answers 503 when the service fails or cannot be reached, and says so', async () => {
    const failing = service(() => new Response('boom', { status: 500 }));
    const res = await diagram.oembed(ask({ url: LINK }), { fetch: failing.doFetch });
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(console.warn).toHaveBeenCalledWith('[oembed] previews answered', 500);

    const down = service(() => Promise.reject(new Error('timeout')));
    expect((await diagram.oembed(ask({ url: LINK }), { fetch: down.doFetch })).status).toBe(503);
    expect(console.warn).toHaveBeenCalledWith('[oembed] previews unreachable', 'Error: timeout');
  });

  it("asks the origin named, within the card's budget, passing the visitor's address on", async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { calls, doFetch } = named();
    await diagram.oembed(ask({ url: LINK }, { headers: { 'CF-Connecting-IP': '203.0.113.9' } }), {
      fetch: doFetch,
      previewsOrigin: 'http://127.0.0.1:8792',
    });
    expect(calls[0]!.url).toBe('http://127.0.0.1:8792/api/previews/share/CODE1234/card');
    expect(new Headers(calls[0]!.init!.headers).get(WORKSPACE_CLIENT_IP_HEADER)).toBe(
      '203.0.113.9',
    );
    expect(timeout).toHaveBeenCalledWith(SHARE_CARD_TIMEOUT_MS);
  });

  it('accepts the share page with its slash, the old /diagram/ address and the www twin', async () => {
    for (const url of [
      `${SITE}/document/shared/?s=CODE1234`,
      `${SITE}/diagram/shared?s=CODE1234`,
      'https://livediagram.app/document/shared?s=CODE1234',
    ]) {
      const { doFetch } = named();
      expect((await diagram.oembed(ask({ url }), { fetch: doFetch })).status).toBe(200);
    }
    // Asked on the bare domain, about a www link.
    const { doFetch } = named();
    const bare = ask({ url: LINK }, {}, 'https://livediagram.app');
    expect((await diagram.oembed(bare, { fetch: doFetch })).status).toBe(200);
  });

  it("follows each app's own share page", async () => {
    const { doFetch } = named('Launch');
    const ok = await planner.oembed(
      ask(
        { url: 'https://www.liveplanner.app/project/shared?s=CODE1234' },
        {},
        'https://www.liveplanner.app',
      ),
      { fetch: doFetch },
    );
    expect(((await ok.json()) as Body).provider_name).toBe('liveplanner');
    const other = await planner.oembed(
      ask(
        { url: 'https://www.liveplanner.app/document/shared?s=CODE1234' },
        {},
        'https://www.liveplanner.app',
      ),
      { fetch: doFetch },
    );
    expect(other.status).toBe(404);
  });

  it('never asks the service about another site, another page or a malformed code', async () => {
    const { calls, doFetch } = named();
    for (const url of [
      'https://evil.example/document/shared?s=CODE1234',
      'https://www.livediagram.app.evil.example/document/shared?s=CODE1234',
      'https://www.liveplanner.app/document/shared?s=CODE1234',
      `${SITE}/document/abc?s=CODE1234`,
      `${SITE}/embed?s=CODE1234`,
      `${SITE}/document/shared`,
      `${SITE}/document/shared?s=abc`,
      `${SITE}/document/shared?s=CODE-1234`,
      `${SITE}/document/shared?s=${'A'.repeat(65)}`,
      `${SITE}/document/shared?s=CODE%2F..%2Fx`,
    ]) {
      const res = await diagram.oembed(ask({ url }), { fetch: doFetch });
      expect(res.status, url).toBe(404);
    }
    expect(calls).toEqual([]);
  });

  it('answers 400 without a url, or with one that is not a URL', async () => {
    const missing = await diagram.oembed(ask({}));
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as Body).error).toBe('url_required');
    const junk = await diagram.oembed(ask({ url: 'not a url' }));
    expect(((await junk.json()) as Body).error).toBe('url_invalid');
  });

  it('answers 501 for a format other than json, and 405 for a method other than GET or HEAD', async () => {
    expect((await diagram.oembed(ask({ url: LINK, format: 'xml' }))).status).toBe(501);
    const post = await diagram.oembed(ask({ url: LINK }, { method: 'POST' }));
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('answers a HEAD with the headers and no body', async () => {
    const { doFetch } = named();
    const res = await diagram.oembed(ask({ url: LINK }, { method: 'HEAD' }), { fetch: doFetch });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('keeps the title to one tidy line, never blank, and escapes it in the iframe', async () => {
    const tidy = named('  Q3\n\n  plan  ');
    const t = (await (
      await diagram.oembed(ask({ url: LINK }), { fetch: tidy.doFetch })
    ).json()) as Body;
    expect(t.title).toBe('Q3 plan');

    const blank = named('   ');
    const b = (await (
      await diagram.oembed(ask({ url: LINK }), { fetch: blank.doFetch })
    ).json()) as Body;
    expect(b.title).toBe('Untitled canvas');

    const hostile = named('"><script>alert(1)</script>\'');
    const h = (await (
      await diagram.oembed(ask({ url: LINK }), { fetch: hostile.doFetch })
    ).json()) as Body;
    expect(h.html).toContain('title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&#39;"');
    expect(h.html).not.toContain('<script>');
  });

  it("honours a host's maxwidth and maxheight, and leaves out a thumbnail that would not fit", async () => {
    const { doFetch } = named();
    const small = (await (
      await diagram.oembed(ask({ url: LINK, maxwidth: '400', maxheight: '600' }), {
        fetch: doFetch,
      })
    ).json()) as Body;
    expect([small.width, small.height]).toEqual([400, 250]);
    expect(small.html).toContain('width="400" height="250"');
    expect(small.thumbnail_url).toBeUndefined();

    const wide = (await (
      await diagram.oembed(ask({ url: LINK, maxwidth: '1600', maxheight: '900' }), {
        fetch: doFetch,
      })
    ).json()) as Body;
    expect([wide.width, wide.height]).toEqual([800, 500]);
    expect(wide.thumbnail_width).toBe(1200);

    const short = (await (
      await diagram.oembed(ask({ url: LINK, maxheight: '600' }), { fetch: doFetch })
    ).json()) as Body;
    expect(short.thumbnail_url).toBeUndefined();
  });
});

describe('oembedSize', () => {
  it('scales 800 x 500 down whole to fit both limits, never up, never to nothing', () => {
    expect(oembedSize(null, null)).toEqual({ width: 800, height: 500 });
    expect(oembedSize(2000, 2000)).toEqual({ width: 800, height: 500 });
    expect(oembedSize(600, null)).toEqual({ width: 600, height: 375 });
    expect(oembedSize(null, 250)).toEqual({ width: 400, height: 250 });
    expect(oembedSize(600, 250)).toEqual({ width: 400, height: 250 });
    expect(oembedSize(1, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('readLimit', () => {
  it('reads a positive whole number of pixels, and ignores anything else', () => {
    expect(readLimit('640')).toBe(640);
    expect(readLimit(null)).toBeNull();
    expect(readLimit('')).toBeNull();
    expect(readLimit('0')).toBeNull();
    expect(readLimit('-5')).toBeNull();
    expect(readLimit('12.5')).toBeNull();
    expect(readLimit('1e3')).toBeNull();
    expect(readLimit('1234567')).toBeNull();
  });

  it('stays cheap on a huge limit', () => {
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) readLimit('9'.repeat(50_000));
    });
    expect(ms).toBeLessThan(50);
  });
});

describe('isReadOnlyEmbed', () => {
  it('is the embed address carrying readonly=1', () => {
    expect(EMBED_READ_ONLY_PARAM).toBe('readonly');
    expect(isReadOnlyEmbed('?s=CODE1234&readonly=1')).toBe(true);
    expect(isReadOnlyEmbed('?s=CODE1234')).toBe(false);
    expect(isReadOnlyEmbed('?s=CODE1234&readonly=0')).toBe(false);
    expect(isReadOnlyEmbed('')).toBe(false);
  });

  it('opens an embed read-only only when it is one, in a browser, asked to', () => {
    // No location (a prerender): never.
    expect(embedOpensReadOnly(true)).toBe(false);
    vi.stubGlobal('location', { search: '?s=CODE1234&readonly=1' });
    expect(embedOpensReadOnly(true)).toBe(true);
    expect(embedOpensReadOnly(false)).toBe(false);
    vi.stubGlobal('location', { search: '?s=CODE1234' });
    expect(embedOpensReadOnly(true)).toBe(false);
    vi.unstubAllGlobals();
  });
});

// Share roles (each product's docs/specs/013-workspace/share-roles.md): an unfolded link is a Viewer's, whatever role
// the link carries; an embed without the flag keeps the link's role (an edit link's iframe stays editable).
describe('embedSessionRole', () => {
  it.each(['edit', 'participate', 'view'] as const)('a %s link unfolds as a Viewer', (role) => {
    expect(embedSessionRole(role, true)).toBe('view');
  });

  it.each(['edit', 'participate', 'view'] as const)(
    'a %s link keeps its role without the flag',
    (role) => {
      expect(embedSessionRole(role, false)).toBe(role);
    },
  );
});
