import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { writeItem } from './items';

// docs/specs/026-plan/item-types.md "An item type": an undo or redo reaches the api as `undo: true` in the body.

const scope = { ownerId: 'owner-me', documentId: 'doc-cloud', shareCode: null, tabId: null };
const by = { id: 'p-me', name: 'Me', color: '#2563eb' };

beforeEach(() => __setOfflineBackend(memBackend()));
afterEach(() => {
  __setOfflineBackend(null);
  vi.unstubAllGlobals();
});

describe('writeItem undo', () => {
  it('flags an undo’s patch and move, and leaves any other write unflagged', async () => {
    const fetch = vi.fn(async () => Response.json({ item: { id: 'i1', rev: 2 }, rev: 2 }));
    vi.stubGlobal('fetch', fetch);
    const body = (n: number) =>
      JSON.parse(String((fetch.mock.calls[n] as unknown as [string, RequestInit])[1].body));
    await writeItem(scope, { kind: 'move', id: 'i1', move: { status: 'done' }, undo: true }, by);
    expect(body(0)).toEqual({ status: 'done', undo: true });
    await writeItem(
      scope,
      { kind: 'patch', id: 'i1', patch: { set: { status: 'done' } }, undo: true },
      by,
    );
    expect(body(1)).toEqual({ set: { status: 'done' }, undo: true });
    await writeItem(scope, { kind: 'move', id: 'i1', move: { status: 'done' } }, by);
    expect(body(2)).toEqual({ status: 'done' });
  });
});
