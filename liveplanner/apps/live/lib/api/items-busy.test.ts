import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { ITEM_BUSY_RETRIES, writeItem } from './items';

// docs/specs/026-plan/items.md "Changing items": a write the store answers `item_busy` (nothing written) is sent
// again, so a quick run of new cards keeps every one; any other refusal is not.

const scope = { ownerId: 'owner-me', projectId: 'doc-cloud', shareCode: null, tabId: null };
const by = { id: 'p-me', name: 'Me', color: '#2563eb' };
const create = { kind: 'create' as const, creates: [{ id: 'i1', type: 'task', title: 'A' }] };
const busy = () =>
  Response.json({ error: 'item_busy', message: 'the item kept changing' }, { status: 409 });

beforeEach(() => {
  __setOfflineBackend(memBackend());
  vi.useFakeTimers();
});
afterEach(() => {
  __setOfflineBackend(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('writeItem when the store is busy', () => {
  it('sends the write again until it lands', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(
        Response.json({ item: { id: 'i1', key: 7 }, rev: 4 }, { status: 201 }),
      );
    vi.stubGlobal('fetch', fetch);
    const answer = writeItem(scope, create as never, by);
    await vi.runAllTimersAsync();
    expect((await answer).upserts.map((i) => i.id)).toEqual(['i1']);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up after its retries, with the busy refusal', async () => {
    const fetch = vi.fn(async () => busy());
    vi.stubGlobal('fetch', fetch);
    const answer = writeItem(scope, create as never, by).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect((await answer) as { code?: string }).toMatchObject({ code: 'item_busy' });
    expect(fetch).toHaveBeenCalledTimes(ITEM_BUSY_RETRIES + 1);
  });

  it('never repeats any other refusal', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ error: 'item_exists', message: 'taken' }, { status: 409 }),
    );
    vi.stubGlobal('fetch', fetch);
    const answer = writeItem(scope, create as never, by).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect((await answer) as { code?: string }).toMatchObject({ code: 'item_exists' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
