// The Inbox's verbs over an app's api: offered only where the page can carry them out, sent to the right routes,
// one listing shared by the pane's thread and Resolve, and nothing for rows only this browser holds.
import { describe, expect, it, vi } from 'vitest';
import { createInboxActions, type InboxApi } from './inbox-actions';
import type { InboxTarget } from './types';

const target = (patch: Partial<InboxTarget> = {}): InboxTarget => ({
  kind: 'Thread',
  app: 'livedocuments',
  itemId: 'doc 1',
  tabId: 't1',
  elementId: 'p4',
  actionId: null,
  local: false,
  ...patch,
});

const SIGNAL = new AbortController().signal;

const listing = {
  threads: [
    {
      tabId: 't1',
      elementId: 'p4',
      resolved: false,
      comments: [
        {
          id: 'c1',
          text: 'First',
          createdAt: 1,
          authorName: 'Me',
          authorColor: '#111',
          authorId: 'u',
        },
        { id: 'c2', text: 'Second', createdAt: 2, authorName: 'Ada', authorColor: '#222' },
      ],
    },
  ],
};

function fakeApi() {
  const calls: { path: string; method: string; body?: unknown }[] = [];
  const api: InboxApi = vi.fn(async (path, init) => {
    calls.push({ path, method: init.method, body: init.body });
    if (init.method === 'GET') return new Response(JSON.stringify(listing), { status: 200 });
    return new Response(null, { status: 204 });
  });
  return { api, calls };
}

describe('createInboxActions', () => {
  it('offers Reply and Resolve on a thread only where it can call that app', () => {
    const { api } = fakeApi();
    const actions = createInboxActions({ api: (app) => (app === 'livedocuments' ? api : null) });
    expect(actions.offers(target())).toEqual(['reply', 'resolve']);
    expect(actions.offers(target({ kind: 'CardThread', app: 'livedocuments' }))).toEqual([
      'reply',
      'resolve',
    ]);
    // Another app's row, on a page whose token is this app's.
    expect(actions.offers(target({ app: 'livediagram' }))).toEqual([]);
    // Nothing on these pages reaches this browser's store.
    expect(actions.offers(target({ local: true }))).toEqual([]);
    // An action has no route; a card's done is its board's column.
    expect(actions.offers(target({ kind: 'Action', actionId: 'a1' }))).toEqual([]);
    expect(actions.offers(target({ kind: 'Card' }))).toEqual([]);
  });

  it('offers Mark Done only for an action on the tab the editor has open, and marks it there', async () => {
    const markDone = vi.fn();
    const actions = createInboxActions({ openAction: { itemId: 'doc 1', tabId: 't1', markDone } });
    const here = target({ kind: 'Action', actionId: 'a1' });
    expect(actions.offers(here)).toEqual(['done']);
    expect(actions.offers({ ...here, tabId: 't2' })).toEqual([]);
    expect(actions.offers({ ...here, itemId: 'doc 2' })).toEqual([]);
    expect(actions.offers({ ...here, local: true })).toEqual([]);
    // No api here: threads are Open only.
    expect(actions.offers(target())).toEqual([]);
    await actions.done!(here);
    expect(markDone).toHaveBeenCalledWith('p4', 'a1');
    await expect(actions.done!({ ...here, tabId: 't2' })).rejects.toThrow();
  });

  it('replies and resolves an element’s thread through its tab’s comment routes, named by the first comment', async () => {
    const { api, calls } = fakeApi();
    const actions = createInboxActions({ api: () => api });
    await actions.reply!(target(), 'Agreed');
    expect(calls).toEqual([
      {
        path: '/documents/doc%201/tabs/t1/comments',
        method: 'POST',
        body: { elementId: 'p4', text: 'Agreed' },
      },
    ]);
    calls.length = 0;
    await actions.resolve!(target());
    expect(calls).toEqual([
      { path: '/documents/doc%201/comments?status=all', method: 'GET', body: undefined },
      { path: '/documents/doc%201/tabs/t1/comments/c1/resolve', method: 'POST', body: undefined },
    ]);
  });

  it('replies and resolves a Plan card’s thread through the thread routes', async () => {
    const { api, calls } = fakeApi();
    const actions = createInboxActions({ api: () => api });
    const card = target({
      kind: 'CardThread',
      app: 'liveplanner',
      itemId: 'p1',
      elementId: 'th-card7',
    });
    await actions.reply!(card, 'On it');
    await actions.resolve!(card);
    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['POST', '/projects/p1/threads/th-card7/comments', { text: 'On it' }],
      ['POST', '/projects/p1/threads/th-card7/resolve', undefined],
    ]);
  });

  it('reads the thread once for the pane and Resolve, and again after a write', async () => {
    const { api, calls } = fakeApi();
    const actions = createInboxActions({ api: () => api });
    const comments = await actions.loadThread!(target(), SIGNAL);
    expect(comments).toEqual([
      { id: 'c1', authorName: 'Me', authorColor: '#111', mine: true, text: 'First', at: 1 },
      { id: 'c2', authorName: 'Ada', authorColor: '#222', mine: false, text: 'Second', at: 2 },
    ]);
    await actions.loadThread!(target(), SIGNAL);
    await actions.resolve!(target());
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    await actions.loadThread!(target(), SIGNAL);
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
    // A card's thread isn't read here: Open shows it.
    expect(await actions.loadThread!(target({ kind: 'CardThread' }), SIGNAL)).toBeNull();
  });

  it('fails a refused write, so the pane can say so', async () => {
    const api: InboxApi = async () => new Response(null, { status: 403 });
    const actions = createInboxActions({ api: () => api });
    await expect(actions.reply!(target(), 'x')).rejects.toThrow('403');
    await expect(actions.resolve!(target({ kind: 'CardThread' }))).rejects.toThrow('403');
  });
});
