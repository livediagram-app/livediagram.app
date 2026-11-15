import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { writeItem } from './items';

// docs/specs/007-editor/offline-changes.md "Held for review": a confirmed removal reaches the api as
// `?confirmRemoval=1`, beside a tab-scoped session's `tabId`; any other write carries neither.

const scope = { ownerId: 'owner-me', projectId: 'doc-cloud', shareCode: null, tabId: null };
const by = { id: 'p-me', name: 'Me', color: '#2563eb' };

beforeEach(() => __setOfflineBackend(memBackend()));
afterEach(() => {
  __setOfflineBackend(null);
  vi.unstubAllGlobals();
});

describe('writeItem confirmRemoval', () => {
  it('asks for a confirmed removal on every removing write', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : url.includes('/patches') || url.includes('/moves')
          ? Response.json({ items: [], rev: 2 })
          : Response.json({ item: { id: 'i1', rev: 2 }, rev: 2 }),
    );
    vi.stubGlobal('fetch', fetch);
    const url = (n: number) => (fetch.mock.calls[n] as unknown as [string])[0];
    const trash = { set: { status: 'trash' } };
    const confirm = { confirmRemoval: true };
    await writeItem(scope, { kind: 'delete', id: 'i1' }, by, confirm);
    await writeItem(scope, { kind: 'patch', id: 'i1', patch: trash }, by, confirm);
    await writeItem(scope, { kind: 'patches', patches: [{ id: 'i1', patch: trash }] }, by, confirm);
    await writeItem(scope, { kind: 'move', id: 'i1', move: { status: 'trash' } }, by, confirm);
    await writeItem(
      scope,
      { kind: 'moves', moves: [{ id: 'i1', move: { status: 'trash' } }] },
      by,
      confirm,
    );
    for (let n = 0; n < 5; n += 1) expect(url(n)).toMatch(/\?confirmRemoval=1$/);
    await writeItem({ ...scope, tabId: 't1' }, { kind: 'delete', id: 'i1' }, by, confirm);
    expect(url(5)).toMatch(/\?tabId=t1&confirmRemoval=1$/);
    await writeItem(scope, { kind: 'delete', id: 'i1' }, by);
    expect(url(6)).not.toContain('?');
  });
});
