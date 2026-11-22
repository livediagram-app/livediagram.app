import { describe, expect, it, vi } from 'vitest';
import type { PageThread } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { createPageThreadsStore, optimisticThreads } from './page-threads-store';
import { ownCommentKey } from './own-comment-key';

// The threads at a page's foot (docs/specs/030-knowledgebase/page-comments.md "Live", "Performance"): read once a
// page a session, kept current by the room, each change shown at once and put back on a refusal.

const WHO = { ownerId: 'user_a', shareCode: null };
const AUTHOR = { by: 'key_a', name: 'Priya', color: '#0ea5e9' };
const comment = (id: string, at: number) => ({
  id,
  text: `words ${id}`,
  createdAt: at,
  authorName: 'Priya',
  authorColor: '#0ea5e9',
  by: 'key_a',
});
const thread = (id: string, at: number, extra: Partial<PageThread> = {}): PageThread => ({
  id,
  tab: 'p1',
  createdAt: at,
  updatedAt: at,
  resolved: false,
  comments: [comment(`${id}-c1`, at)],
  ...extra,
});

describe('the page threads store', () => {
  it('reads a page once a session, sharing a request in flight, oldest thread first', async () => {
    const list = vi.fn(async () => [thread('t2', 20), thread('t1', 10)]);
    const store = createPageThreadsStore({ list, change: vi.fn() });
    expect(store.entryOf('kb', 'p1').status).toBe('loading');
    await Promise.all([store.load(WHO, 'kb', 'p1'), store.load(WHO, 'kb', 'p1')]);
    await store.load(WHO, 'kb', 'p1');
    expect(list).toHaveBeenCalledTimes(1);
    expect(store.entryOf('kb', 'p1').threads.map((t) => t.id)).toEqual(['t1', 't2']);
    await store.load(WHO, 'kb', 'p1', true);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('says a failed first read failed, and keeps what it held on a later one', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([thread('t1', 10)])
      .mockRejectedValueOnce(new Error('offline'));
    const store = createPageThreadsStore({ list, change: vi.fn() });
    await store.load(WHO, 'kb', 'p1');
    expect(store.entryOf('kb', 'p1').status).toBe('failed');
    await store.load(WHO, 'kb', 'p1');
    await store.load(WHO, 'kb', 'p1', true);
    expect(store.entryOf('kb', 'p1')).toMatchObject({ status: 'ready', threads: [{ id: 't1' }] });
  });

  it('takes the room’s thread and its removal, only for a page it has read', async () => {
    const store = createPageThreadsStore({ list: async () => [thread('t1', 10)], change: vi.fn() });
    store.receive('kb', { kind: 'page-thread', tabId: 'p2', thread: thread('x', 1) });
    expect(store.entryOf('kb', 'p2').status).toBe('loading');
    await store.load(WHO, 'kb', 'p1');
    const listener = vi.fn();
    store.subscribe(listener);
    store.receive('kb', {
      kind: 'page-thread',
      tabId: 'p1',
      thread: thread('t1', 10, { resolved: true }),
    });
    store.receive('kb', { kind: 'page-thread', tabId: 'p1', thread: thread('t0', 5) });
    expect(store.entryOf('kb', 'p1').threads.map((t) => [t.id, t.resolved])).toEqual([
      ['t0', false],
      ['t1', true],
    ]);
    store.receive('kb', { kind: 'page-thread', tabId: 'p1', threadId: 't0', removed: true });
    expect(store.entryOf('kb', 'p1').threads.map((t) => t.id)).toEqual(['t1']);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('shows a new thread at once, then the api’s, or puts everything back on a refusal', async () => {
    let answer: (value: { thread: PageThread }) => void = () => {};
    const change = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
      .mockRejectedValueOnce(new ApiError('reply', 409, 'thread_full'));
    const store = createPageThreadsStore({ list: async () => [], change });
    await store.load(WHO, 'kb', 'p1');
    const posting = store.change(WHO, 'kb', 'p1', { op: 'start', text: ' Hi ' }, AUTHOR, 50);
    expect(store.entryOf('kb', 'p1').threads[0]).toMatchObject({
      id: 'pending-1',
      comments: [{ text: 'Hi', authorName: 'Priya', by: 'key_a' }],
    });
    answer({ thread: thread('t9', 50) });
    await posting;
    expect(store.entryOf('kb', 'p1').threads.map((t) => t.id)).toEqual(['t9']);
    await expect(
      store.change(WHO, 'kb', 'p1', { op: 'reply', thread: 't9', text: 'More' }, AUTHOR, 60),
    ).rejects.toBeInstanceOf(ApiError);
    expect(store.entryOf('kb', 'p1').threads[0]!.comments).toHaveLength(1);
  });

  it('drops a thread whose last comment the api removed', async () => {
    const store = createPageThreadsStore({
      list: async () => [thread('t1', 10)],
      change: async () => ({ removed: 't1' }),
    });
    await store.load(WHO, 'kb', 'p1');
    await store.change(
      WHO,
      'kb',
      'p1',
      { op: 'delete', thread: 't1', comment: 't1-c1' },
      AUTHOR,
      20,
    );
    expect(store.entryOf('kb', 'p1').threads).toEqual([]);
  });
});

describe('a change drawn before the api answers', () => {
  const two = thread('t1', 10, {
    comments: [comment('a', 10), comment('b', 11)],
    resolved: true,
    resolvedBy: 'Sam',
    resolvedAt: 12,
  });
  const draw = (change: Parameters<typeof optimisticThreads>[2]) =>
    optimisticThreads([two], 'p1', change, AUTHOR, 99, 'pending-x');

  it('reopens a resolved thread on a reply, and resolves, reopens, edits and deletes', () => {
    const replied = draw({ op: 'reply', thread: 't1', text: 'Yes' })![0]!;
    expect(replied).toMatchObject({ resolved: false, updatedAt: 99 });
    expect(replied).not.toHaveProperty('resolvedBy');
    expect(replied.comments.at(-1)).toMatchObject({ id: 'pending-x', text: 'Yes' });
    expect(draw({ op: 'reopen', thread: 't1' })![0]).not.toHaveProperty('resolvedAt');
    expect(
      optimisticThreads(
        [thread('t1', 1)],
        'p1',
        { op: 'resolve', thread: 't1' },
        AUTHOR,
        5,
        'x',
      )![0],
    ).toMatchObject({ resolved: true, resolvedBy: 'Priya', resolvedAt: 5 });
    expect(
      draw({ op: 'edit', thread: 't1', comment: 'a', text: ' New ' })![0]!.comments[0],
    ).toMatchObject({
      text: 'New',
      editedAt: 99,
    });
    expect(
      draw({ op: 'delete', thread: 't1', comment: 'a' })![0]!.comments.map((c) => c.id),
    ).toEqual(['b']);
    expect(
      optimisticThreads(
        [thread('t1', 1)],
        'p1',
        { op: 'delete', thread: 't1', comment: 't1-c1' },
        AUTHOR,
        5,
        'x',
      ),
    ).toEqual([]);
  });

  it('draws nothing for a thread it does not hold', () => {
    expect(draw({ op: 'resolve', thread: 'gone' })).toBeNull();
  });
});

describe('one’s own comments', () => {
  it('are known by the collab key the api derives, the same on every call', async () => {
    const key = await ownCommentKey('user_a');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(await ownCommentKey('user_a')).toBe(key);
    expect(await ownCommentKey('user_b')).not.toBe(key);
  });
});
