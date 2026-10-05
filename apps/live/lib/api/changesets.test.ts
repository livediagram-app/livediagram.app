import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiListChangesets, apiRevertChangeset } from './changesets';

describe('apiRevertChangeset', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the revert as the editor and answers what it reverted and kept', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        calls.push({ url, init });
        return Promise.resolve(
          Response.json({
            changeset: null,
            reverted: 0,
            kept: [{ id: 'a', reason: 'changed' }],
            lint: null,
          }),
        );
      }),
    );
    const answer = await apiRevertChangeset('owner-1', 'd1', 'cs_0000000001', null);
    expect(answer.kept).toEqual([{ id: 'a', reason: 'changed' }]);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/changesets\/cs_0000000001\/revert$/);
    expect(calls[0]!.init.method).toBe('POST');
    expect(new Headers(calls[0]!.init.headers).get('X-Livediagram-Client')).toBe('editor');
  });
});

describe('apiListChangesets', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the document's newest changesets", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        return Promise.resolve(
          Response.json({ changesets: [{ id: 'cs_0000000001', tabId: 't1', rev: 4 }] }),
        );
      }),
    );
    expect((await apiListChangesets('owner-1', 'd1', null)).map((c) => c.rev)).toEqual([4]);
    expect(calls[0]).toMatch(/\/documents\/d1\/changesets$/);
  });
});
