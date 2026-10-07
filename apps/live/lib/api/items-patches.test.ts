import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_BULK_MAX } from '@livediagram/items';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { writeItem } from './items';

// Blueprint item-store.md "Editor slice": a write of many patches goes to /items/patches in batches of
// ITEM_BULK_MAX, its answers folded into one.

const scope = { ownerId: 'owner-me', documentId: 'doc-cloud', shareCode: null, tabId: null };
const by = { id: 'p-me', name: 'Me', color: '#2563eb' };

beforeEach(() => __setOfflineBackend(memBackend()));
afterEach(() => {
  __setOfflineBackend(null);
  vi.unstubAllGlobals();
});

describe('writeItem patches', () => {
  it('sends one request per batch, flagged when an undo, and folds the answers', async () => {
    let rev = 0;
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const { items } = JSON.parse(String(init.body)) as { items: { id: string }[] };
      rev += 1;
      return Response.json({ items: items.map((i) => ({ id: i.id, rev: 2 })), rev });
    });
    vi.stubGlobal('fetch', fetch);
    const patches = Array.from({ length: ITEM_BULK_MAX + 5 }, (_, n) => ({
      id: `i${n}`,
      patch: { set: { status: 'trash' } },
    }));
    const answer = await writeItem(scope, { kind: 'patches', patches, undo: true }, by);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toContain('/documents/doc-cloud/items/patches');
    expect(JSON.parse(String(init.body))).toEqual({
      items: patches.slice(ITEM_BULK_MAX).map((p) => ({ id: p.id, set: { status: 'trash' } })),
      undo: true,
    });
    expect(answer.upserts).toHaveLength(ITEM_BULK_MAX + 5);
    expect(answer.rev).toBe(2);
  });
});
