import { describe, expect, it } from 'vitest';
import type { DocumentCommentThread } from '@livediagram/api-schema';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, tabsOfA } from '../testing/fake-api';
import { commentAdd, commentLs, commentReopen, commentReply, commentResolve } from './comment';
import { presenceClear, presenceSet } from './presence';

// docs/specs/015-api/cli.md "Commands" (comment, presence), blueprint "Addressing" (CLI78).

const TAB = `/documents/${DOC_A}/tabs/tab-one-0000`;
const box = (id: string, comments: string[] = []) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(comments.length
    ? {
        commentThread: {
          resolved: false,
          comments: comments.map((c) => ({
            id: c,
            text: c,
            createdAt: 0,
            authorName: 'A',
            authorColor: '#000',
          })),
        },
      }
    : {}),
});
const plainTab = {
  tab: {
    id: 'tab-one-0000',
    name: 'Overview',
    elements: [box('api-gw', ['c1', 'c2']), box('api-db'), box('web')],
  },
};

function recorder(answer: (path: string, method: string, body: unknown) => Response | undefined) {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const route = async (request: Request) => {
    const url = new URL(request.url);
    const text = await request.text();
    seen.push({
      method: request.method,
      path: url.pathname.replace(/^\/api/, ''),
      body: text ? JSON.parse(text) : undefined,
    });
    return (
      answer(url.pathname, request.method, text ? JSON.parse(text) : undefined) ??
      new Response(null, { status: 204 })
    );
  };
  return { seen, route };
}

const thread = (over: Partial<DocumentCommentThread>): DocumentCommentThread => ({
  tabId: 'tab-one-0000',
  tabName: 'Overview',
  elementId: 'api-gw',
  ref: 'api-gw',
  label: 'Gateway',
  resolved: false,
  comments: [
    {
      id: 'c1',
      text: 'Retry?',
      createdAt: Date.UTC(2026, 9, 1),
      authorName: 'Sam',
      authorColor: '#000',
      authorId: 'u',
    },
  ],
  ...over,
});

describe('comment ls', () => {
  it('lists the document’s threads, or one tab’s, as the listing prints them', async () => {
    const listing = {
      threads: [
        thread({}),
        thread({ tabId: 'tab-two-0000', tabName: 'Details', ref: 'x9', label: null }),
      ],
    };
    const logs: string[] = [];
    const api = fakeApi({
      ...tabsOfA,
      [`/documents/${DOC_A}/comments?status=open`]: listing,
      [`/documents/${DOC_A}/comments?status=all`]: { threads: [] },
    });
    const ctx = contextOf(api, [], logs);
    const all = await commentLs.run!(ctx, { doc: DOC_A, status: 'open' });
    expect(commentLs.text!(all)).toEqual([
      'api-gw "Gateway" · open · 1 · tab "Overview"',
      '  Sam 2026-10-01: "Retry?"',
      'x9 · open · 1 · tab "Details"',
      '  Sam 2026-10-01: "Retry?"',
    ]);
    expect(all.threads[0]!.comments[0]).not.toHaveProperty('authorId');
    const one = await commentLs.run!(ctx, { doc: DOC_A, tab: 'Details', status: 'open' });
    expect(commentLs.quiet!(one)).toEqual(['x9']);
    expect(logs).toContain('comments 1 of 2 threads');
    expect(commentLs.text!(await commentLs.run!(ctx, { doc: DOC_A, status: 'all' }))).toEqual([
      'no threads',
    ]);
    expect(commentLs.text!({ status: 'resolved', threads: [] })).toEqual(['no resolved threads']);
    expect(commentLs.text!({ status: 'open', threads: [] })).toEqual(['no open threads']);
  });
});

describe('comment add, reply, resolve, reopen', () => {
  function setUp() {
    const { seen, route } = recorder((path, method) => {
      if (method === 'POST' && (path.endsWith('/comments') || path.endsWith('/reply')))
        return Response.json({ comment: { id: 'c9' } }, { status: 201 });
      return undefined;
    });
    const api = fakeApi({
      ...tabsOfA,
      [TAB]: plainTab,
      [`${TAB}/comments`]: route,
      [`${TAB}/comments/c2/reply`]: route,
      [`${TAB}/comments/c2/resolve`]: route,
      [`${TAB}/comments/c2/reopen`]: route,
    });
    return { seen, ctx: contextOf(api) };
  }

  it('adds to an element named by a unique ref prefix', async () => {
    const { seen, ctx } = setUp();
    const out = await commentAdd.run!(ctx, { doc: DOC_A, ref: 'api-g', text: 'Needs a cache' });
    expect(out).toEqual({ id: 'c9', text: '+ comment c9 on api-g' });
    expect(commentAdd.quiet!(out)).toEqual(['c9']);
    expect(commentAdd.text!(out)).toEqual(['+ comment c9 on api-g']);
    expect(seen).toEqual([
      {
        method: 'POST',
        path: `${TAB}/comments`,
        body: { elementId: 'api-gw', text: 'Needs a cache' },
      },
    ]);
  });

  it('replies to, resolves and reopens a thread through its last comment', async () => {
    const { seen, ctx } = setUp();
    expect((await commentReply.run!(ctx, { doc: DOC_A, ref: 'api-gw', text: 'Yes' })).text).toBe(
      '+ comment c9 on api-gw',
    );
    expect(
      commentResolve.text!(await commentResolve.run!(ctx, { doc: DOC_A, ref: 'api-gw' })),
    ).toEqual(['~ thread api-gw resolved']);
    expect((await commentReopen.run!(ctx, { doc: DOC_A, ref: 'api-gw' })).text).toBe(
      '~ thread api-gw open',
    );
    expect(seen.map((s) => [s.path.split('/').pop(), s.body])).toEqual([
      ['reply', { text: 'Yes' }],
      ['resolve', undefined],
      ['reopen', undefined],
    ]);
  });

  it('refuses a ref that matches nothing or several, and an element with no thread', async () => {
    const { ctx } = setUp();
    const refusal = (p: Promise<unknown>) =>
      p.then(
        () => null,
        (e: unknown) => (e instanceof VerbRefusal ? [e.status, e.code, e.message] : e),
      );
    expect(await refusal(commentAdd.run!(ctx, { doc: DOC_A, ref: 'nope', text: 'x' }))).toEqual([
      404,
      'ref_not_found',
      'no element nope on tab "Overview"',
    ]);
    await expect(
      commentAdd.run!(ctx, { doc: DOC_A, ref: 'webb', text: 'x' }),
    ).rejects.toMatchObject({
      lines: ['  web'],
    });
    expect(await refusal(commentAdd.run!(ctx, { doc: DOC_A, ref: 'api', text: 'x' }))).toEqual([
      404,
      'ref_ambiguous',
      'api names 2 elements on tab "Overview"',
    ]);
    expect(await refusal(commentReply.run!(ctx, { doc: DOC_A, ref: 'web', text: 'x' }))).toEqual([
      404,
      'no_thread',
      'no thread on web',
    ]);
  });

  it('surfaces the api’s refusal of a thread state change', async () => {
    const api = fakeApi({
      ...tabsOfA,
      [TAB]: plainTab,
      [`${TAB}/comments/c2/resolve`]: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    });
    await expect(
      commentResolve.run!(contextOf(api), { doc: DOC_A, ref: 'api-gw' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('presence set and clear', () => {
  it('sends status, focus and ttl, and says until when', async () => {
    const { seen, route } = recorder(() =>
      Response.json({
        presence: {
          tabId: 'tab-one-0000',
          status: 'Reviewing',
          focus: ['api-gw'],
          expiresAt: Date.UTC(2026, 9, 5, 8, 1, 30),
        },
      }),
    );
    const ctx = contextOf(fakeApi({ ...tabsOfA, [`${TAB}/presence`]: route }));
    const out = await presenceSet.run!(ctx, {
      doc: DOC_A,
      status: 'Reviewing',
      focus: 'api-gw, ,db',
      ttl: 90,
    });
    expect(presenceSet.text!(out)).toEqual(['presence on "Overview" until 08:01:30']);
    await presenceSet.run!(ctx, { doc: DOC_A });
    expect(seen.map((s) => [s.method, s.body])).toEqual([
      ['PUT', { status: 'Reviewing', focus: ['api-gw', 'db'], ttl: 90_000 }],
      ['PUT', {}],
    ]);
  });

  it('refuses flags the api would refuse, before reaching it', async () => {
    const api = fakeApi(tabsOfA);
    const ctx = contextOf(api);
    await expect(presenceSet.run!(ctx, { doc: DOC_A, ttl: 500 })).rejects.toMatchObject({
      code: 'ttl_out_of_range',
      message: '--ttl is a whole number of seconds from 1 to 120',
    });
    await expect(
      presenceSet.run!(ctx, { doc: DOC_A, status: 'x'.repeat(81) }),
    ).rejects.toMatchObject({ code: 'status_too_long' });
    expect(api.calls).toEqual([]);
  });

  it('clears, and surfaces a refusal', async () => {
    const { seen, route } = recorder(() => undefined);
    const ctx = contextOf(fakeApi({ ...tabsOfA, [`${TAB}/presence`]: route }));
    expect(presenceClear.text!(await presenceClear.run!(ctx, { doc: DOC_A }))).toEqual([
      'presence cleared on "Overview"',
    ]);
    expect(seen.map((s) => s.method)).toEqual(['DELETE']);
    const refused = contextOf(
      fakeApi({
        ...tabsOfA,
        [`${TAB}/presence`]: () => Response.json({ error: 'room_unavailable' }, { status: 503 }),
      }),
    );
    await expect(presenceClear.run!(refused, { doc: DOC_A })).rejects.toMatchObject({
      status: 503,
    });
  });
});
