import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_MAX_BYTES, PHOTO_MAX_NOTES, type DetectedNote } from '@livediagram/api-schema';
import { handleAiPhotoNotes } from './ai-photo-notes';
import type { RouteContext } from './context';
import type { Env } from '../types';

// Reading a wall photo (spec/139 Phase 8). Three things are pinned here: the
// shared admission gate still guards this route (it is the operator's model
// budget either way), what counts as an image on the wire, and that whatever
// the model says, what leaves this route is in range.

// A 1x1 JPEG is enough: nothing here looks at the pixels.
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function modelSays(body: unknown, status = 200) {
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
  globalThis.fetch = modelSays({ wall: true, notes: [] });
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
  const request = new Request('https://api.example.com/api/ai/photo-notes', {
    method: opts.method ?? 'POST',
    headers,
    ...(opts.method === 'GET'
      ? {}
      : {
          body: opts.rawBody ?? JSON.stringify(opts.body ?? { image: TINY_JPEG, tabName: 'Wall' }),
        }),
  });
  return {
    request,
    env: { OPENAI_API_KEY: 'sk-test', ...opts.env } as Env,
    url: new URL(request.url),
    segments: ['api', 'ai', 'photo-notes'],
    clerkUserId: opts.clerkUserId ?? null,
    verifiedUserId: opts.clerkUserId ?? null,
    clerkEmail: null,
    resolveOwner: () => (opts.owner === null ? null : (opts.owner ?? 'owner-anon')),
  } as RouteContext;
}

const note = (over: Partial<DetectedNote> = {}): DetectedNote => ({
  id: 1,
  text: 'Order placed',
  kind: 'domain-event',
  colour: '#fdba74',
  size: 'square',
  cx: 0.5,
  cy: 0.5,
  w: 0.1,
  h: 0.1,
  row: 0,
  order: 0,
  confidence: 0.9,
  ...over,
});

describe('the shared gate still guards this route', () => {
  it('503 without a model key — the self-host default', async () => {
    const res = await handleAiPhotoNotes(makeCtx({ env: { OPENAI_API_KEY: undefined } }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'ai_not_configured' });
  });

  it('403 from an origin the deployment does not serve', async () => {
    const res = await handleAiPhotoNotes(
      makeCtx({
        env: { AI_ALLOWED_ORIGINS: 'https://livediagram.app' },
        origin: 'https://evil.example',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('401 on the guest path when the deployment is Clerk-only', async () => {
    const res = await handleAiPhotoNotes(makeCtx({ env: { AI_REQUIRE_CLERK: 'true' } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });

  it('refuses a caller with no identity at all', async () => {
    // The worker-wide `missingAuth()` envelope, shared with /api/ai: a 400
    // naming what is missing rather than a 401, because there is no
    // credential to challenge — the request never said who it was.
    const res = await handleAiPhotoNotes(makeCtx({ owner: null }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('authentication required');
  });

  it('405 on anything but POST', async () => {
    expect((await handleAiPhotoNotes(makeCtx({ method: 'GET' }))).status).toBe(405);
  });

  it('429 when the caller is over the rate limit', async () => {
    const res = await handleAiPhotoNotes(
      makeCtx({
        env: { AI_RATE_LIMITER: { limit: async () => ({ success: false }) } } as Partial<Env>,
      }),
    );
    expect(res.status).toBe(429);
  });

  it('never calls the model when the gate refuses', async () => {
    await handleAiPhotoNotes(makeCtx({ env: { OPENAI_API_KEY: undefined } }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('what counts as a photo', () => {
  it('400 on a body that is not JSON', async () => {
    const res = await handleAiPhotoNotes(makeCtx({ rawBody: 'not json' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'photo_invalid' });
  });

  it('400 with no image at all', async () => {
    expect((await handleAiPhotoNotes(makeCtx({ body: {} }))).status).toBe(400);
  });

  it('400 on something that is not a data URL', async () => {
    const res = await handleAiPhotoNotes(makeCtx({ body: { image: 'https://example.com/a.jpg' } }));
    expect(res.status).toBe(400);
  });

  it('400 on a GIF — animation means nothing here and the first frame is a trap', async () => {
    const res = await handleAiPhotoNotes(
      makeCtx({ body: { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }),
    );
    expect(res.status).toBe(400);
  });

  it('400 on SVG — it is XML that can carry script (spec/19)', async () => {
    const res = await handleAiPhotoNotes(
      makeCtx({ body: { image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } }),
    );
    expect(res.status).toBe(400);
  });

  it('413 when the decoded image is over the cap', async () => {
    const big = `data:image/png;base64,${'A'.repeat(PHOTO_MAX_BYTES * 2)}`;
    const res = await handleAiPhotoNotes(makeCtx({ body: { image: big } }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'photo_too_large' });
  });

  it('accepts jpeg, png and webp', async () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const res = await handleAiPhotoNotes(
        makeCtx({ body: { image: `data:${type};base64,AAAA` } }),
      );
      expect(res.status, type).toBe(200);
    }
  });
});

describe('when the model answers', () => {
  it('returns the notes it found', async () => {
    globalThis.fetch = modelSays({ wall: true, notes: [note()], hint: 'Looks good' });
    const res = await handleAiPhotoNotes(makeCtx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notes: [note()], wall: true, hint: 'Looks good' });
  });

  it('passes through "this is not a wall" as a 200', async () => {
    globalThis.fetch = modelSays({ wall: false, notes: [], hint: 'This is a cat.' });
    const body = (await (await handleAiPhotoNotes(makeCtx())).json()) as { wall: boolean };
    expect(body.wall).toBe(false);
  });

  it('drops a note with no text', async () => {
    globalThis.fetch = modelSays({ wall: true, notes: [note({ text: '   ' }), note({ id: 2 })] });
    const body = (await (await handleAiPhotoNotes(makeCtx())).json()) as { notes: DetectedNote[] };
    expect(body.notes.map((n) => n.id)).toEqual([2]);
  });

  it('drops a box that is not inside the image', async () => {
    globalThis.fetch = modelSays({
      wall: true,
      notes: [note({ cx: 1.4 }), note({ id: 2, h: 0 }), note({ id: 3 })],
    });
    const body = (await (await handleAiPhotoNotes(makeCtx())).json()) as { notes: DetectedNote[] };
    expect(body.notes.map((n) => n.id)).toEqual([3]);
  });

  it('caps the count, however many come back', async () => {
    globalThis.fetch = modelSays({
      wall: true,
      notes: Array.from({ length: PHOTO_MAX_NOTES + 40 }, (_, i) => note({ id: i })),
    });
    const body = (await (await handleAiPhotoNotes(makeCtx())).json()) as { notes: DetectedNote[] };
    expect(body.notes).toHaveLength(PHOTO_MAX_NOTES);
  });

  it('pulls a stray confidence back into 0..1 and an odd size back to square', async () => {
    globalThis.fetch = modelSays({
      wall: true,
      notes: [note({ confidence: 7, size: 'enormous' as DetectedNote['size'] })],
    });
    const body = (await (await handleAiPhotoNotes(makeCtx())).json()) as { notes: DetectedNote[] };
    expect(body.notes[0]).toMatchObject({ confidence: 1, size: 'square' });
  });

  it('502 when the model call fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 500 })) as typeof fetch;
    const res = await handleAiPhotoNotes(makeCtx());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'ai_error' });
  });

  it('502 when the model returns something unparseable', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), {
          status: 200,
        }),
    ) as typeof fetch;
    expect((await handleAiPhotoNotes(makeCtx())).status).toBe(502);
  });

  it('502 when the upstream call throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network');
    }) as typeof fetch;
    expect((await handleAiPhotoNotes(makeCtx())).status).toBe(502);
  });
});

describe('what leaves this worker', () => {
  it('sends the image to the model and NOTHING to the log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = modelSays({ wall: true, notes: [note()] });
    await handleAiPhotoNotes(makeCtx());
    const sent = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(JSON.stringify(sent)).toContain(TINY_JPEG);
    // The photo is never stored, and never written down either: what is logged
    // is enough to diagnose a failure and nothing that could reconstruct it.
    for (const call of log.mock.calls) {
      expect(String(call[0])).not.toContain('base64');
      expect(String(call[0])).not.toContain('Order placed');
    }
  });

  it('asks the vision model when one is named, else the ordinary one', async () => {
    globalThis.fetch = modelSays({ wall: true, notes: [] });
    await handleAiPhotoNotes(
      makeCtx({ env: { OPENAI_MODEL: 'gpt-4o', OPENAI_VISION_MODEL: 'gpt-5-vision' } }),
    );
    const sent = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(sent.model).toBe('gpt-5-vision');

    globalThis.fetch = modelSays({ wall: true, notes: [] });
    await handleAiPhotoNotes(makeCtx({ env: { OPENAI_MODEL: 'gpt-4o' } }));
    const fallback = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(fallback.model).toBe('gpt-4o');
  });

  it('asks in strict JSON, at high detail', async () => {
    globalThis.fetch = modelSays({ wall: true, notes: [] });
    await handleAiPhotoNotes(makeCtx());
    const sent = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(sent.response_format.type).toBe('json_schema');
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(sent.stream).toBeUndefined();
    expect(JSON.stringify(sent)).toContain('"detail":"high"');
  });
});
