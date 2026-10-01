import { describe, expect, it, vi } from 'vitest';
import { OpenverseSearchError } from './openverse';
import { searchOpenverse } from './search';

// docs/specs/009-elements/image-search.md "The Search tab" errors.

const answer = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof OpenverseSearchError ? e.kind : 'other';
  }
};

describe('searchOpenverse', () => {
  it('returns the parsed page without cookies or a referrer', async () => {
    const fetchImpl = answer(200, { page_count: 4, results: [] });
    await expect(searchOpenverse('cat', 2, fetchImpl)).resolves.toEqual({
      results: [],
      page: 2,
      pageCount: 4,
    });
    const init = vi.mocked(fetchImpl).mock.calls[0]![1]!;
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('reports 429 as rate-limited', async () => {
    expect(await kindOf(searchOpenverse('cat', 1, answer(429, {})))).toBe('rate-limited');
  });

  it('reports a server error, a network error and bad JSON as failed', async () => {
    expect(await kindOf(searchOpenverse('cat', 1, answer(500, {})))).toBe('failed');
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await kindOf(searchOpenverse('cat', 1, offline))).toBe('failed');
    const junk = vi.fn(
      async () => new Response('<html>', { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await kindOf(searchOpenverse('cat', 1, junk))).toBe('failed');
  });
});
