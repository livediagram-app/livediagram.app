import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_BULK_MAX } from '@livediagram/items';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { ItemWritePartlyLanded, writeItem } from './items';

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

describe('writeItem tally', () => {
  it('posts a vote’s tally to /items/tally', async () => {
    const fetch = vi.fn(async () => Response.json({ items: [{ id: 'i1', rev: 2 }], rev: 3 }));
    vi.stubGlobal('fetch', fetch);
    const answer = await writeItem(
      scope,
      { kind: 'tally', tallies: [{ id: 'i1', votes: { p: 2 } }] },
      by,
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/documents/doc-cloud/items/tally');
    expect(JSON.parse(String(init.body))).toEqual({ items: [{ id: 'i1', votes: { p: 2 } }] });
    expect(answer.rev).toBe(3);
  });
});

// A many-item change refused after part of it landed (blueprint item-store.md "Interfaces and contracts: REST"):
// the part that landed comes back with the failure, so the editor keeps it and can undo it.
describe('writeItem patches refused part way', () => {
  const patches = Array.from({ length: ITEM_BULK_MAX + 2 }, (_, n) => ({
    id: `i${n}`,
    patch: { set: { status: 'trash' } },
  }));

  it('throws ItemWritePartlyLanded with the earlier batches and the refused one’s landed items', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        call += 1;
        const { items } = JSON.parse(String(init.body)) as { items: { id: string }[] };
        if (call === 1) return Response.json({ items: items.map((i) => ({ id: i.id })), rev: 4 });
        return Response.json(
          { error: 'item_busy', items: [{ id: items[0]!.id }], rev: 5 },
          { status: 409 },
        );
      }),
    );
    const failure = await writeItem(scope, { kind: 'patches', patches }, by).catch((e) => e);
    expect(failure).toBeInstanceOf(ItemWritePartlyLanded);
    expect(failure.code).toBe('item_busy');
    expect(failure.landed.upserts).toHaveLength(ITEM_BULK_MAX + 1);
    expect(failure.landed.rev).toBe(5);
  });

  it('throws the plain refusal when nothing landed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'item_busy' }, { status: 409 })),
    );
    const failure = await writeItem(scope, { kind: 'patches', patches }, by).catch((e) => e);
    expect(failure).not.toBeInstanceOf(ItemWritePartlyLanded);
    expect(failure.code).toBe('item_busy');
  });
});
