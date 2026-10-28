import { describe, expect, it } from 'vitest';
import type { Item } from '@liveplanner/items';
import type { CardThread, Comment } from '@liveplanner/project';
import { fakeApi } from '../testing/fake-api';
import {
  applyThreadChanges,
  listedThread,
  readThreadsState,
  resolveComment,
  resolveThread,
  threadListing,
} from './card-threads';

// A card's comment threads as agents work them (docs/specs/026-plan/plan-agents.md "Comment threads"): names in,
// ids out, an agent's own comments only, and refusals that say what is there.
const P = 'plan1';
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const item = (key: number, id: string, title: string): Item => ({
  id,
  type: 'task',
  key,
  rank: 'i',
  fields: { title },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const ITEMS = [item(12, 'card12', 'Basket'), item(4, 'card4', 'Promo')];
const comment = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: `text of ${id}`,
  createdAt: Date.UTC(2026, 9, 1),
  authorName: 'Ada',
  authorColor: '#f97316',
  ...extra,
});
const thread = (id: string, extra: Partial<CardThread> = {}): CardThread => ({
  id,
  title: `Ada: ${id}`,
  resolved: false,
  comments: [comment(`${id}-c1`)],
  createdAt: 1,
  createdBy: { name: 'Ada', color: '#f97316' },
  updatedAt: 1,
  home: P,
  cards: [{ projectId: P, itemId: 'card12', key: 12 }],
  rev: 1,
  ...extra,
});

const T1 = thread('th-aaaa1111bbbb2222', {
  updatedAt: 5,
  comments: [comment('cm-person'), comment('cm-agent1', { ai: true, editedAt: 9 })],
  cards: [
    { projectId: P, itemId: 'card12', key: 12 },
    { projectId: 'other', itemId: 'x', key: 4, projectName: 'Sprint 12' },
  ],
});
const T2 = thread('th-aaaa9999cccc0000', {
  title: 'Promo maths',
  resolved: true,
  resolvedBy: 'Bo',
  updatedAt: 9,
  cards: [{ projectId: P, itemId: 'card4', key: 4 }],
});
const STATE = { threads: [T1, T2], items: ITEMS };

describe('naming a thread and a comment', () => {
  it('takes an id, a title (case aside) or a prefix of four or more', () => {
    expect(resolveThread('th-aaaa1111bbbb2222', STATE.threads)).toMatchObject({ value: T1 });
    expect(resolveThread('PROMO MATHS', STATE.threads)).toMatchObject({ value: T2 });
    expect(resolveThread('th-aaaa1', STATE.threads)).toMatchObject({ value: T1 });
  });

  it('refuses a name that matches several, or none, listing the threads', () => {
    expect(resolveThread('th-aaaa', STATE.threads)).toMatchObject({
      ok: false,
      code: 'thread_ambiguous',
    });
    const none = resolveThread('nope', STATE.threads);
    expect(none).toMatchObject({ ok: false, code: 'thread_unknown' });
    expect(!none.ok && none.message).toContain('th-aaaa1111bbbb2222 "Ada: th-aaaa1111bbbb2222"');
    expect(resolveThread('x', [])).toMatchObject({ ok: false, code: 'thread_unknown' });
    // Too short to be a prefix.
    expect(resolveThread('th-', STATE.threads)).toMatchObject({
      ok: false,
      code: 'thread_unknown',
    });
  });

  it('names a comment by its id or a prefix, refusing the rest with the comments there are', () => {
    expect(resolveComment('cm-agent1', T1)).toMatchObject({ value: { id: 'cm-agent1' } });
    expect(resolveComment('cm-a', T1)).toMatchObject({ value: { id: 'cm-agent1' } });
    expect(resolveComment('cm-', T1)).toMatchObject({ ok: false, code: 'comment_unknown' });
    const both = resolveComment('cm-p', {
      ...T1,
      comments: [comment('cm-p1'), comment('cm-p2')],
    });
    expect(both).toMatchObject({ ok: false, code: 'comment_ambiguous' });
    expect(!both.ok && both.message).toContain('cm-p1 by Ada');
  });
});

describe('listing threads', () => {
  it('lists open threads by default, newest activity first, with cards and comments', () => {
    const out = threadListing(STATE, P, 'open');
    expect(out).toEqual({
      ok: true,
      threads: [
        {
          id: T1.id,
          title: T1.title,
          state: 'open',
          cards: ['#12 Basket', '#4 in Sprint 12'],
          comments: [
            {
              id: 'cm-person',
              author: 'Ada',
              at: '2026-10-01T00:00:00.000Z',
              text: 'text of cm-person',
            },
            {
              id: 'cm-agent1',
              author: 'Ada',
              at: '2026-10-01T00:00:00.000Z',
              text: 'text of cm-agent1',
              ai: true,
              edited: true,
            },
          ],
        },
      ],
    });
  });

  it('lists resolved ones, all, or one card’s', () => {
    const resolved = threadListing(STATE, P, 'resolved');
    expect(resolved.ok && resolved.threads.map((t) => [t.id, t.resolvedBy])).toEqual([
      [T2.id, 'Bo'],
    ]);
    const all = threadListing(STATE, P, 'all');
    expect(all.ok && all.threads.map((t) => t.id)).toEqual([T2.id, T1.id]);
    const card = threadListing(STATE, P, 'all', '#4');
    expect(card.ok && card.threads.map((t) => t.id)).toEqual([T2.id]);
    expect(threadListing(STATE, P, 'all', '#99')).toMatchObject({ ok: false });
  });

  it('names a card it cannot find by its number, or as a card', () => {
    const lone = thread('th-zzzz', {
      cards: [
        { projectId: P, itemId: 'gone', key: 7 },
        { projectId: 'q', itemId: 'y', key: null },
      ],
    });
    expect(listedThread(lone, P, new Map()).cards).toEqual(['#7', 'a card in another plan']);
  });
});

describe('reading the state', () => {
  it('reads the threads and the items together', async () => {
    const api = fakeApi({
      [`/projects/${P}/threads`]: { threads: [T1] },
      [`/projects/${P}/items`]: { items: ITEMS, rev: 1 },
    });
    expect(await readThreadsState(api, P)).toEqual({ threads: [T1], items: ITEMS });
  });
});

// A fake api recording each write's method, path and body, answering as the routes do.
function writes(answer: (method: string, path: string) => Response) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const handler = async (r: Request) => {
    const path = new URL(r.url).pathname.replace(/^\/api/, '');
    const text = await r.text();
    sent.push({ method: r.method, path, body: text ? JSON.parse(text) : undefined });
    return answer(r.method, path);
  };
  const base = `/projects/${P}`;
  const api = fakeApi({
    [`${base}/items/card12/threads`]: handler,
    [`${base}/threads/${T1.id}/comments`]: handler,
    [`${base}/threads/th-newnewnewnewnew1/comments`]: handler,
    [`${base}/threads/${T1.id}/comments/cm-agent1`]: handler,
    [`${base}/threads/${T1.id}/comments/cm-person`]: handler,
    [`${base}/threads/${T1.id}/resolve`]: handler,
    [`${base}/threads/${T2.id}/reopen`]: handler,
  });
  return { api, sent };
}

describe('changing threads', () => {
  it('starts, replies, edits, resolves and reopens in order, each seeing the ones before', async () => {
    const made = thread('th-newnewnewnewnew1', { title: 'Priya: Started' });
    const { api, sent } = writes((_method, path) => {
      if (path.endsWith('/items/card12/threads'))
        return Response.json({ thread: made, commentId: 'cm-1' });
      if (path.endsWith('/reopen')) return new Response(null, { status: 204 });
      if (path.endsWith('/resolve')) return Response.json({ thread: { ...T1, resolved: true } });
      return Response.json({ thread: T1, commentId: 'cm-2' });
    });
    const out = await applyThreadChanges(
      api,
      P,
      [
        { op: 'start', item: '#12', text: 'Started' },
        // The new thread, named by its title.
        { op: 'reply', thread: 'priya: started', text: 'More' },
        { op: 'reply', thread: T1.id, text: 'Again' },
        { op: 'edit', thread: T1.id, comment: 'cm-agent1', text: 'Fixed' },
        { op: 'resolve', thread: T1.id },
        { op: 'reopen', thread: 'Promo maths' },
      ],
      STATE,
    );
    expect(out.refusal).toBeUndefined();
    expect(out.applied).toEqual([
      `+ thread ${made.id} "Priya: Started" on #12`,
      `+ comment cm-2 on "Priya: Started"`,
      `+ comment cm-2 on "${T1.title}"`,
      `~ comment cm-agent1 on "${T1.title}"`,
      `~ thread "${T1.title}" resolved`,
      `~ thread "Promo maths" open`,
    ]);
    expect(sent.map((s) => [s.method, s.body])).toEqual([
      ['POST', { text: 'Started' }],
      ['POST', { text: 'More' }],
      ['POST', { text: 'Again' }],
      ['PUT', { text: 'Fixed' }],
      ['POST', undefined],
      ['POST', undefined],
    ]);
  });

  it('deletes its own comment, saying when the thread went with it', async () => {
    const { api } = writes(() => Response.json({ thread: null }));
    const out = await applyThreadChanges(
      api,
      P,
      [{ op: 'delete', thread: T1.id, comment: 'cm-agent1' }],
      STATE,
    );
    expect(out.applied).toEqual([
      `- comment cm-agent1 from "${T1.title}" (its last: the thread went)`,
    ]);
  });

  it('refuses to edit or delete a comment a person wrote, sending nothing', async () => {
    const { api, sent } = writes(() => Response.json({ thread: T1 }));
    for (const change of [
      { op: 'edit' as const, thread: T1.id, comment: 'cm-person', text: 'x' },
      { op: 'delete' as const, thread: T1.id, comment: 'cm-person' },
    ]) {
      const out = await applyThreadChanges(api, P, [change], STATE);
      expect(out.refusal?.code).toBe('forbidden');
      expect(out.refusal?.message).toMatch(/written by a person/);
    }
    expect(sent).toEqual([]);
  });

  it('stops at an unknown card, thread or comment, keeping what was applied', async () => {
    const { api } = writes(() => Response.json({ thread: T1, commentId: 'cm-9' }));
    const out = await applyThreadChanges(
      api,
      P,
      [
        { op: 'reply', thread: T1.id, text: 'ok' },
        { op: 'start', item: '#99', text: 'x' },
        { op: 'reply', thread: T1.id, text: 'never' },
      ],
      STATE,
    );
    expect(out.applied).toHaveLength(1);
    expect(out.refusal?.code).toBe('item_unknown');
    const noThread = await applyThreadChanges(api, P, [{ op: 'resolve', thread: 'zzz' }], STATE);
    expect(noThread.refusal?.code).toBe('thread_unknown');
    const noComment = await applyThreadChanges(
      api,
      P,
      [{ op: 'edit', thread: T1.id, comment: 'cm-zzzz', text: 'x' }],
      STATE,
    );
    expect(noComment.refusal?.code).toBe('comment_unknown');
  });

  it('words the api’s refusals, and throws what it cannot word', async () => {
    const refusing = (status: number, error: string) =>
      writes(() => Response.json({ error }, { status })).api;
    const full = await applyThreadChanges(
      refusing(409, 'comments_full'),
      P,
      [{ op: 'reply', thread: T1.id, text: 'x' }],
      STATE,
    );
    expect(full.refusal).toEqual({
      code: 'comments_full',
      message:
        'The api refused it: that thread holds the most comments it can (200): start a new thread.',
    });
    const other = await applyThreadChanges(
      refusing(400, 'odd_thing'),
      P,
      [{ op: 'resolve', thread: T1.id }],
      STATE,
    );
    expect(other.refusal?.code).toBe('odd_thing');
    await expect(
      applyThreadChanges(
        refusing(500, 'boom'),
        P,
        [{ op: 'reply', thread: T1.id, text: 'x' }],
        STATE,
      ),
    ).rejects.toThrow();
  });

  it('words an answer with no comment id, a delete that kept the thread, and a refusal with no code', async () => {
    const plain = writes(() => Response.json({ thread: T1 })).api;
    const out = await applyThreadChanges(
      plain,
      P,
      [
        { op: 'reply', thread: T1.id, text: 'x' },
        { op: 'delete', thread: T1.id, comment: 'cm-agent1' },
      ],
      STATE,
    );
    expect(out.applied).toEqual([
      `+ comment on "${T1.title}"`,
      `- comment cm-agent1 from "${T1.title}"`,
    ]);
    const bare = writes(() => new Response('nope', { status: 403 })).api;
    const refused = await applyThreadChanges(bare, P, [{ op: 'resolve', thread: T1.id }], STATE);
    expect(refused.refusal?.code).toBe('http_403');
  });

  it('names an untitled card as Untitled', () => {
    const blank = { ...item(5, 'card5', ''), fields: { title: '' } };
    const t = thread('th-u', { cards: [{ projectId: P, itemId: 'card5', key: 5 }] });
    expect(listedThread(t, P, new Map([['card5', blank]])).cards).toEqual(['#5 Untitled']);
  });
});
