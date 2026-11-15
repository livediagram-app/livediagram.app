import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { ITEM_BULK_MAX } from '@liveplanner/items';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { ItemWritePartlyLanded, writeItem } from './items';

// Blueprint item-store.md "Editor slice": a write of many patches goes to /items/patches in batches of
// ITEM_BULK_MAX, its answers folded into one.

const scope = { ownerId: 'owner-me', projectId: 'doc-cloud', shareCode: null, tabId: null };
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
      const { items } = sentJson(init) as { items: { id: string }[] };
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
    expect(url).toContain('/projects/doc-cloud/items/patches');
    expect(sentJson(init)).toEqual({
      items: patches.slice(ITEM_BULK_MAX).map((p) => ({ id: p.id, set: { status: 'trash' } })),
      undo: true,
    });
    expect(answer.upserts).toHaveLength(ITEM_BULK_MAX + 5);
    expect(answer.rev).toBe(2);
  });

  // A card's fields hold up to 64 KB (items.md "Limits", Work Tracker 944): 200 full ones would pass the api's 8 MB
  // request cap, so a batch is cut by size too.
  it('cuts a batch of large changes under the api’s request cap', async () => {
    const sizes: number[] = [];
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      sizes.push(JSON.stringify(sentJson(init)).length);
      const { items } = sentJson(init) as { items: { id: string }[] };
      return Response.json({ items: items.map((i) => ({ id: i.id, rev: 2 })), rev: 1 });
    });
    vi.stubGlobal('fetch', fetch);
    const patches = Array.from({ length: 150 }, (_, n) => ({
      id: `i${n}`,
      patch: { set: { 'f-notes': 'n'.repeat(60_000) } },
    }));
    const answer = await writeItem(scope, { kind: 'patches', patches }, by);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(Math.max(...sizes)).toBeLessThan(8 * 1024 * 1024);
    expect(answer.upserts).toHaveLength(150);
  });
});

describe('writeItem moves', () => {
  it('posts a group of moves to /items/moves, in order, flagged when an undo', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        items: [
          { id: 'a', rev: 2 },
          { id: 'b', rev: 2 },
        ],
        rev: 4,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const moves = [
      { id: 'a', move: { status: 'done', before: null } },
      { id: 'b', move: { status: 'done', after: 'a' } },
    ];
    const answer = await writeItem(scope, { kind: 'moves', moves, undo: true }, by);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/projects/doc-cloud/items/moves');
    expect(sentJson(init)).toEqual({
      items: [
        { id: 'a', status: 'done', before: null },
        { id: 'b', status: 'done', after: 'a' },
      ],
      undo: true,
    });
    expect(answer).toMatchObject({ rev: 4 });
    expect(answer.upserts).toHaveLength(2);
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
    expect(url).toContain('/projects/doc-cloud/items/tally');
    expect(sentJson(init)).toEqual({ items: [{ id: 'i1', votes: { p: 2 } }] });
    expect(answer.rev).toBe(3);
  });

  // docs/specs/012-collaboration/session-tools.md "Count In".
  it('sends the Votes field the vote counts in', async () => {
    const fetch = vi.fn(async () => Response.json({ items: [{ id: 'i1', rev: 2 }], rev: 3 }));
    vi.stubGlobal('fetch', fetch);
    await writeItem(
      scope,
      { kind: 'tally', field: 'f-pri', tallies: [{ id: 'i1', votes: { p: 2 } }] },
      by,
    );
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(sentJson(init)).toEqual({ field: 'f-pri', items: [{ id: 'i1', votes: { p: 2 } }] });
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
        const { items } = sentJson(init) as { items: { id: string }[] };
        if (call === 1) return Response.json({ items: items.map((i) => ({ id: i.id })), rev: 4 });
        return Response.json(
          { error: 'item_busy', items: [{ id: items[0]!.id }], rev: 5 },
          { status: 409 },
        );
      }),
    );
    const failure = await writeItem(scope, { kind: 'patches', patches }, by).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(ItemWritePartlyLanded);
    expect(failure).toMatchObject({ code: 'item_busy', landed: { rev: 5 } });
    expect(failure).toHaveProperty('landed.upserts.length', ITEM_BULK_MAX + 1);
  });

  it('throws the plain refusal when nothing landed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'item_busy' }, { status: 409 })),
    );
    const failure = await writeItem(scope, { kind: 'patches', patches }, by).catch(
      (e: unknown) => e,
    );
    expect(failure).not.toBeInstanceOf(ItemWritePartlyLanded);
    expect(failure).toMatchObject({ code: 'item_busy' });
  });
});

// docs/specs/026-plan/items.md "Limits": a refused value's field and limit ride on the error the toast reads.
describe('writeItem refused for a field', () => {
  const limit = { unit: 'characters', max: 10_000, given: 12_412 };
  const refusal = { error: 'field_value_invalid', id: 'i1', field: 'f-solution', limit };

  it('carries the field and limit on one card’s refusal, many cards’ and a part-landed one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(refusal, { status: 400 })),
    );
    const one = await writeItem(
      scope,
      { kind: 'patch', id: 'i1', patch: { set: { 'f-solution': 's' } } },
      by,
    ).catch((e: unknown) => e);
    expect(one).toMatchObject({ code: 'field_value_invalid', field: 'f-solution', limit });
    const many = await writeItem(
      scope,
      { kind: 'patches', patches: [{ id: 'i1', patch: { set: { 'f-solution': 's' } } }] },
      by,
    ).catch((e: unknown) => e);
    expect(many).toMatchObject({ code: 'field_value_invalid', field: 'f-solution', limit });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ ...refusal, items: [{ id: 'i0' }], rev: 3 }, { status: 400 }),
      ),
    );
    const part = await writeItem(
      scope,
      {
        kind: 'patches',
        patches: [
          { id: 'i0', patch: {} },
          { id: 'i1', patch: {} },
        ],
      },
      by,
    ).catch((e: unknown) => e);
    expect(part).toBeInstanceOf(ItemWritePartlyLanded);
    expect(part).toMatchObject({ code: 'field_value_invalid', field: 'f-solution', limit });
  });

  it('carries nothing more for a refusal that names no field, or a body that is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'plan_full', limit: { unit: 'x' } }, { status: 413 }),
      ),
    );
    const full = await writeItem(
      scope,
      { kind: 'patch', id: 'i1', patch: { set: { title: 'x' } } },
      by,
    ).catch((e: unknown) => e);
    expect(full).toMatchObject({ code: 'plan_full' });
    expect(full).not.toHaveProperty('field');
    expect(full).not.toHaveProperty('limit');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 400 })),
    );
    const plain = await writeItem(
      scope,
      { kind: 'patch', id: 'i1', patch: { set: { title: 'x' } } },
      by,
    ).catch((e: unknown) => e);
    expect(plain).not.toHaveProperty('field');
  });
});
