import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CROP_MAX_BYTES, READ_MAX_CROPS_PER_REQUEST, type NoteText } from '@livediagram/api-schema';
import { handleAiReadNotes } from './ai-read-notes';
import type { RouteContext } from './context';
import type { Env } from '../types';

// Reading sticky crops (spec/139 Phase 8). Three things are pinned: the shared
// gate still guards this route (it is the operator's model budget either way),
// what counts as a crop, and that EVERY crop that went out gets an answer back
// — whatever the provider did or did not say.

const TINY_JPEG = 'data:image/jpeg;base64,AAAA';

function providerSays(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }] }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as typeof fetch;
}

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = providerSays({ texts: [] });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function makeCtx(
  opts: {
    env?: Partial<Env>;
    origin?: string | null;
    clerkUserId?: string | null;
    owner?: string | null;
    method?: string;
    body?: unknown;
    rawBody?: string;
  } = {},
): RouteContext {
  const headers = new Headers();
  if (opts.origin) headers.set('Origin', opts.origin);
  const request = new Request('https://api.example.com/api/ai/read-notes', {
    method: opts.method ?? 'POST',
    headers,
    ...(opts.method === 'GET'
      ? {}
      : {
          body:
            opts.rawBody ?? JSON.stringify(opts.body ?? { crops: [{ id: 1, image: TINY_JPEG }] }),
        }),
  });
  return {
    request,
    env: { AI_API_KEY: 'test-key', ...opts.env } as Env,
    url: new URL(request.url),
    segments: ['api', 'ai', 'read-notes'],
    clerkUserId: opts.clerkUserId ?? null,
    verifiedUserId: opts.clerkUserId ?? null,
    clerkEmail: null,
    resolveOwner: () => (opts.owner === null ? null : (opts.owner ?? 'owner-anon')),
  } as RouteContext;
}

const answer = async (res: Response) => (await res.json()) as { texts: NoteText[] };

describe('the shared gate still guards this route', () => {
  it('503 without a key — the self-host default', async () => {
    const res = await handleAiReadNotes(makeCtx({ env: { AI_API_KEY: undefined } }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'ai_not_configured' });
  });

  it('403 from an origin the deployment does not serve', async () => {
    const res = await handleAiReadNotes(
      makeCtx({
        env: { AI_ALLOWED_ORIGINS: 'https://livediagram.app' },
        origin: 'https://evil.example',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('401 on the guest path when the deployment is Clerk-only', async () => {
    const res = await handleAiReadNotes(makeCtx({ env: { AI_REQUIRE_CLERK: 'true' } }));
    expect(res.status).toBe(401);
  });

  it('refuses a caller with no identity at all', async () => {
    expect((await handleAiReadNotes(makeCtx({ owner: null }))).status).toBe(400);
  });

  it('405 on anything but POST', async () => {
    expect((await handleAiReadNotes(makeCtx({ method: 'GET' }))).status).toBe(405);
  });

  it('429 when the caller is over the rate limit', async () => {
    const res = await handleAiReadNotes(
      makeCtx({
        env: { AI_RATE_LIMITER: { limit: async () => ({ success: false }) } } as Partial<Env>,
      }),
    );
    expect(res.status).toBe(429);
  });

  it('never calls the provider when the gate refuses', async () => {
    await handleAiReadNotes(makeCtx({ env: { AI_API_KEY: undefined } }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('what counts as a crop', () => {
  const bad = async (body: unknown) => (await handleAiReadNotes(makeCtx({ body }))).status;

  it('400 on a body that is not JSON', async () => {
    expect((await handleAiReadNotes(makeCtx({ rawBody: 'not json' }))).status).toBe(400);
  });

  it('400 with no crops at all', async () => {
    expect(await bad({})).toBe(400);
    expect(await bad({ crops: [] })).toBe(400);
  });

  it('400 when a crop has no integer id — the answer could not be matched back', async () => {
    expect(await bad({ crops: [{ id: 'one', image: TINY_JPEG }] })).toBe(400);
    expect(await bad({ crops: [{ id: 1.5, image: TINY_JPEG }] })).toBe(400);
  });

  it('400 on something that is not a data URL', async () => {
    expect(await bad({ crops: [{ id: 1, image: 'https://example.com/a.jpg' }] })).toBe(400);
  });

  it('400 on a GIF and on SVG', async () => {
    expect(await bad({ crops: [{ id: 1, image: 'data:image/gif;base64,AAAA' }] })).toBe(400);
    expect(await bad({ crops: [{ id: 1, image: 'data:image/svg+xml;base64,AAAA' }] })).toBe(400);
  });

  it('400 on more crops than a batch may hold', async () => {
    const crops = Array.from({ length: READ_MAX_CROPS_PER_REQUEST + 1 }, (_, i) => ({
      id: i,
      image: TINY_JPEG,
    }));
    expect(await bad({ crops })).toBe(400);
  });

  it('413 when a crop is over the cap', async () => {
    const big = `data:image/png;base64,${'A'.repeat(CROP_MAX_BYTES * 2)}`;
    const res = await handleAiReadNotes(makeCtx({ body: { crops: [{ id: 1, image: big }] } }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'crops_too_large' });
  });

  it('accepts jpeg, png and webp', async () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const res = await handleAiReadNotes(
        makeCtx({ body: { crops: [{ id: 1, image: `data:${type};base64,AAAA` }] } }),
      );
      expect(res.status, type).toBe(200);
    }
  });
});

describe('when the provider answers', () => {
  it('returns the words it read', async () => {
    globalThis.fetch = providerSays({
      texts: [{ id: 1, text: 'Order placed', legible: true }],
    });
    const res = await handleAiReadNotes(makeCtx());
    expect(res.status).toBe(200);
    expect(await answer(res)).toEqual({ texts: [{ id: 1, text: 'Order placed', legible: true }] });
  });

  it('gives every crop an answer, even one the provider skipped', async () => {
    globalThis.fetch = providerSays({ texts: [{ id: 2, text: 'Read', legible: true }] });
    const res = await handleAiReadNotes(
      makeCtx({
        body: {
          crops: [
            { id: 1, image: TINY_JPEG },
            { id: 2, image: TINY_JPEG },
          ],
        },
      }),
    );
    // The paper WAS there for crop 1, so it still becomes a note — empty.
    expect((await answer(res)).texts).toEqual([
      { id: 1, text: '', legible: false },
      { id: 2, text: 'Read', legible: true },
    ]);
  });

  it('drops an id nobody asked about', async () => {
    globalThis.fetch = providerSays({
      texts: [
        { id: 1, text: 'Mine', legible: true },
        { id: 99, text: 'Invented', legible: true },
      ],
    });
    const out = await answer(await handleAiReadNotes(makeCtx()));
    expect(out.texts.map((t) => t.id)).toEqual([1]);
  });

  it('does not believe "legible" when nothing came with it', async () => {
    globalThis.fetch = providerSays({ texts: [{ id: 1, text: '   ', legible: true }] });
    expect((await answer(await handleAiReadNotes(makeCtx()))).texts[0]).toEqual({
      id: 1,
      text: '',
      legible: false,
    });
  });

  it('caps a text that ran away', async () => {
    globalThis.fetch = providerSays({ texts: [{ id: 1, text: 'x'.repeat(5000), legible: true }] });
    expect((await answer(await handleAiReadNotes(makeCtx()))).texts[0]!.text.length).toBe(200);
  });

  it('502 on a provider failure, a throw, or unparseable content', async () => {
    globalThis.fetch = vi.fn(async () => new Response('no', { status: 500 })) as typeof fetch;
    expect((await handleAiReadNotes(makeCtx())).status).toBe(502);

    globalThis.fetch = vi.fn(async () => {
      throw new Error('network');
    }) as typeof fetch;
    expect((await handleAiReadNotes(makeCtx())).status).toBe(502);

    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), {
          status: 200,
        }),
    ) as typeof fetch;
    expect((await handleAiReadNotes(makeCtx())).status).toBe(502);
  });
});

describe('what leaves this worker', () => {
  it('sends the crops labelled by id, and writes none of them down', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = providerSays({ texts: [{ id: 7, text: 'Order placed', legible: true }] });
    await handleAiReadNotes(makeCtx({ body: { crops: [{ id: 7, image: TINY_JPEG }] } }));
    const sent = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(JSON.stringify(sent)).toContain('Crop 7:');
    expect(JSON.stringify(sent)).toContain(TINY_JPEG);
    expect(sent.response_format).toEqual({ type: 'json_object' });
    expect(sent.stream).toBeUndefined();
    for (const call of log.mock.calls) {
      expect(String(call[0])).not.toContain('base64');
      expect(String(call[0])).not.toContain('Order placed');
    }
  });

  it('asks the vision model when one is named', async () => {
    globalThis.fetch = providerSays({ texts: [] });
    await handleAiReadNotes(
      makeCtx({ env: { AI_MODEL: 'flash', AI_VISION_MODEL: 'flash-vision' } }),
    );
    const sent = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(sent.model).toBe('flash-vision');
  });

  it('goes wherever the base URL points', async () => {
    globalThis.fetch = providerSays({ texts: [] });
    await handleAiReadNotes(
      makeCtx({ env: { AI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai' } }),
    );
    expect(vi.mocked(globalThis.fetch).mock.calls[0]![0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
  });
});
