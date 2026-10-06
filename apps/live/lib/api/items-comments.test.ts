import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import { writeItemComment } from './items';

// A card's comment writes against the api (docs/specs/026-plan/items.md "Comments", blueprint item-store.md
// "Comments"): the path and method for each change, a 204 for a resolve that changed nothing, and refusals.

const scope = { ownerId: 'owner-me', documentId: 'doc-cloud', shareCode: null, tabId: 't1' };
const who = { ownerId: 'owner-me', by: { id: 'p-me', name: 'Me', color: '#2563eb' } };
const item = { id: 'item-one', rev: 4 };

function stub(response: () => Promise<Response>) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => __setOfflineBackend(memBackend()));
afterEach(() => {
  __setOfflineBackend(null);
  vi.unstubAllGlobals();
});

const sent = (fetch: ReturnType<typeof stub>, n = 0) => {
  const [url, init] = fetch.mock.calls[n]!;
  return { url: new URL(String(url), 'https://x.test'), init: init! };
};

describe('writeItemComment', () => {
  it('posts a new comment with its mentions, naming the tab', async () => {
    const fetch = stub(async () => Response.json({ item, rev: 9 }));
    const mention = { userId: 'u1', name: 'Ann', handle: 'ann' };
    const answer = await writeItemComment(
      scope,
      'item-one',
      { kind: 'add', text: 'Hi @ann', mentions: [mention] },
      who,
    );
    expect(answer).toEqual({ upserts: [item], removed: [], rev: 9 });
    const { url, init } = sent(fetch);
    expect(url.pathname).toBe('/api/documents/doc-cloud/items/item-one/comments');
    expect(url.searchParams.get('tabId')).toBe('t1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ text: 'Hi @ann', mentions: [mention] });
    await writeItemComment(scope, 'item-one', { kind: 'add', text: 'plain' }, who);
    expect(JSON.parse(String(sent(fetch, 1).init.body))).toEqual({ text: 'plain' });
  });

  it('deletes, resolves and reopens on their own paths', async () => {
    const fetch = stub(async () => Response.json({ item, rev: 10 }));
    await writeItemComment(scope, 'item-one', { kind: 'delete', commentId: 'c/1' }, who);
    expect(sent(fetch).init.method).toBe('DELETE');
    expect(sent(fetch).url.pathname).toBe('/api/documents/doc-cloud/items/item-one/comments/c%2F1');
    await writeItemComment(scope, 'item-one', { kind: 'resolve', resolved: true }, who);
    expect(sent(fetch, 1).url.pathname).toMatch(/\/comments\/resolve$/);
    await writeItemComment(scope, 'item-one', { kind: 'resolve', resolved: false }, who);
    expect(sent(fetch, 2).url.pathname).toMatch(/\/comments\/reopen$/);
  });

  it('answers null for a change that changed nothing, and throws a refusal with its code', async () => {
    stub(async () => new Response(null, { status: 204 }));
    expect(
      await writeItemComment(scope, 'item-one', { kind: 'resolve', resolved: true }, who),
    ).toBeNull();
    stub(async () => Response.json({ error: 'comments_full' }, { status: 413 }));
    await expect(
      writeItemComment(scope, 'item-one', { kind: 'add', text: 'x' }, who),
    ).rejects.toMatchObject({ code: 'comments_full' });
  });
});
