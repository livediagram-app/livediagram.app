import { afterEach, describe, it, expect, vi } from 'vitest';
import { apiAiReadNotes } from './ai';

// Reading sticky crops (docs/specs/021-event-storming/event-storming.md Phase 8). Non-streaming and BATCHED, so what
// matters is that a run of any size becomes the right requests, that every
// answer comes back in one list, and that a failure arrives as its TOKEN.
describe('apiAiReadNotes', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const crops = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: i, image: 'data:image/jpeg;base64,AAA' }));

  function respondPerBatch(status = 200) {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { crops: { id: number }[] };
      return new Response(
        JSON.stringify({
          texts: body.crops.map((c) => ({ id: c.id, text: `note ${c.id}`, legible: true })),
        }),
        { status },
      );
    });
    globalThis.fetch = spy as unknown as typeof fetch;
    return spy;
  }

  it('sends one request for a small run, and returns what it read', async () => {
    const spy = respondPerBatch();
    const out = await apiAiReadNotes('owner-1', crops(3));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.texts.map((t) => t.id)).toEqual([0, 1, 2]);
  });

  it('splits a big run into batches, and puts every answer in one list', async () => {
    const spy = respondPerBatch();
    const out = await apiAiReadNotes('owner-1', crops(40));
    // READ_MAX_CROPS_PER_REQUEST per request, in order: 40 crops is 7 calls.
    expect(spy).toHaveBeenCalledTimes(7);
    expect(out.texts).toHaveLength(40);
    expect(out.texts.map((t) => t.id)).toEqual(Array.from({ length: 40 }, (_, i) => i));
  });

  it('keeps the words it DID read when one batch fails', async () => {
    // What the operator saw on a hundred-note wall: one batch failed and every
    // box read "Type the words…", including the ninety-odd the model had
    // already read. A run of seventeen requests will lose one sooner or later
    // — a rate limit, a truncated answer, a provider hiccup — and losing one
    // must cost one batch's words, not the wall's.
    let call = 0;
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      call += 1;
      const body = JSON.parse(init!.body as string) as { crops: { id: number }[] };
      if (call === 2) return new Response(JSON.stringify({ error: 'ai_quota' }), { status: 429 });
      return new Response(
        JSON.stringify({
          texts: body.crops.map((c) => ({ id: c.id, text: `note ${c.id}`, legible: true })),
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const out = await apiAiReadNotes('owner-1', crops(18));
    // Three batches of six, one of them lost: twelve words and a reason.
    expect(out.texts).toHaveLength(12);
    expect(out.unread).toBe(6);
    expect(out.failure).toBe('ai_quota');
  });

  it('throws when EVERY batch fails, so the one message names the cause', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: 'ai_not_configured' }), { status: 503 }),
    );
    await expect(apiAiReadNotes('o', crops(12))).rejects.toThrow('ai_not_configured');
  });

  it('throws the route’s own token, so each cause can be told apart', async () => {
    for (const [status, token] of [
      [503, 'ai_not_configured'],
      [413, 'crops_too_large'],
      [400, 'crops_invalid'],
      [502, 'ai_error'],
      [429, 'rate_limited'],
    ] as const) {
      globalThis.fetch = vi.fn(
        async () => new Response(JSON.stringify({ error: token }), { status }),
      );
      await expect(apiAiReadNotes('o', crops(1))).rejects.toThrow(token);
    }
  });

  it('falls back to a usable token when the failure is not our envelope', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html>502</html>', { status: 502 }));
    await expect(apiAiReadNotes('o', crops(1))).rejects.toThrow('ai_error');
  });
});
