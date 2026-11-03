import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { ItemWritePartlyLanded, writeItem } from './items';

// docs/specs/026-plan/tracker-import.md "The import": an import's cards (a `whole` create) go as the parts of one
// import, which the plan lands all at once; a failure at any part throws with nothing landed, never a part.

const scope = { ownerId: 'owner-me', projectId: 'doc-cloud', shareCode: null, tabId: null };
const by = { id: 'p-me', name: 'Me', color: '#2563eb' };
const creates = Array.from({ length: 450 }, (_, i) => ({
  id: `card-${i}`,
  type: 'task',
  fields: { title: `Card ${i}` },
}));
const whole = { kind: 'create' as const, creates, whole: true as const };
const staged = (n: number) => Response.json({ staged: n }, { status: 202 });

beforeEach(() => __setOfflineBackend(memBackend()));
afterEach(() => {
  __setOfflineBackend(null);
  vi.unstubAllGlobals();
});

describe('writeItem: a whole create', () => {
  it('sends the parts of one import, and answers what the last landed', async () => {
    const landed = creates.map((c, i) => ({ ...c, key: i + 1 }));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(staged(200))
      .mockResolvedValueOnce(staged(400))
      .mockResolvedValueOnce(Response.json({ items: landed, rev: 3 }, { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const answer = await writeItem(scope, whole, by);
    expect(answer).toEqual({ upserts: landed, removed: [], rev: 3 });
    const sent = (fetch.mock.calls as [unknown, RequestInit][]).map(([url, init]) => ({
      url: String(url),
      body: sentJson(init) as { importId: string; part: number; parts: number; items: unknown[] },
    }));
    expect(sent.every((s) => s.url.includes('/projects/doc-cloud/items/import'))).toBe(true);
    expect(sent.map((s) => [s.body.part, s.body.parts, s.body.items.length])).toEqual([
      [0, 3, 200],
      [1, 3, 200],
      [2, 3, 50],
    ]);
    expect(new Set(sent.map((s) => s.body.importId)).size).toBe(1);
  });

  it('throws with nothing landed when a part fails mid-way', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(staged(200))
      .mockResolvedValueOnce(
        Response.json({ error: 'items_full', message: 'a plan holds 2000 items' }, { status: 413 }),
      );
    vi.stubGlobal('fetch', fetch);
    const failure = await writeItem(scope, whole, by).catch((e: unknown) => e);
    expect(failure).toMatchObject({ code: 'items_full' });
    // Never a partial answer: the plan wrote no card, so the editor keeps none.
    expect(failure).not.toBeInstanceOf(ItemWritePartlyLanded);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
