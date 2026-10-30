// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardThread } from '@liveplanner/project';

vi.mock('@/lib/api/card-threads', () => ({ fetchThreads: vi.fn(), writeThread: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { fetchThreads, writeThread } from '@/lib/api/card-threads';
import { track } from '@/lib/telemetry';
import { createThreadStore, itemsWithCounts, useThreadCount } from './thread-store';
import { threadRefusalMessage, useCardThreads } from './useCardThreads';

// The plan's card threads in the editor (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Editor").
const P = 'plan-a';
const ME = 'owner-me';
const SELF = { id: 'p-me', name: 'Sam', color: '#2563eb' };
const thread = (id: string, extra: Partial<CardThread> = {}): CardThread => ({
  id,
  title: `T ${id}`,
  resolved: false,
  comments: [{ id: `${id}-c`, text: 'hi', createdAt: 1, authorName: 'Ada', authorColor: '#000' }],
  createdAt: 1,
  createdBy: { name: 'Ada', color: '#000' },
  updatedAt: 1,
  home: P,
  cards: [{ projectId: P, itemId: 'card-1', key: 1 }],
  rev: 1,
  ...extra,
});

beforeEach(() => {
  vi.mocked(fetchThreads).mockReset();
  vi.mocked(writeThread).mockReset();
  vi.mocked(track).mockReset();
});
afterEach(() => vi.useRealTimers());

function hook(onError = vi.fn(), onMentioned = vi.fn()) {
  const r = renderHook(() =>
    useCardThreads({
      projectId: P,
      ready: true,
      ownerId: ME,
      self: SELF,
      shareCode: null,
      tabScope: null,
      onError,
      onMentioned,
    }),
  );
  return { ...r, onError, onMentioned };
}

describe('loading', () => {
  it('reads the threads once the items are ready, and counts each card’s open comments', async () => {
    vi.mocked(fetchThreads).mockResolvedValue([thread('th-a'), thread('th-b', { resolved: true })]);
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.threadsOf('card-1').map((t) => t.id)).toEqual(['th-a', 'th-b']);
    expect(result.current.store.count('card-1')).toBe(1);
    expect(result.current.threadsOf('card-9')).toEqual([]);
  });

  it('says so when the first read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetchThreads).mockRejectedValue(new Error('down'));
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('waits for the items', () => {
    renderHook(() =>
      useCardThreads({
        projectId: P,
        ready: false,
        ownerId: ME,
        self: SELF,
        shareCode: null,
        tabScope: 't1',
        onError: vi.fn(),
      }),
    );
    expect(fetchThreads).not.toHaveBeenCalled();
  });
});

describe('the room', () => {
  it('takes upserts and removals, keeping this person’s own author ids', async () => {
    const mine = thread('th-a', {
      comments: [
        {
          id: 'c1',
          text: 'mine',
          createdAt: 1,
          authorName: 'Sam',
          authorColor: '#000',
          authorId: ME,
        },
      ],
    });
    vi.mocked(fetchThreads).mockResolvedValue([mine, thread('th-b')]);
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() =>
      result.current.receive({
        kind: 'threads',
        upserts: [
          {
            ...mine,
            comments: [
              {
                id: 'c1',
                text: 'mine, edited',
                createdAt: 1,
                authorName: 'Sam',
                authorColor: '#000',
              },
            ],
          },
        ],
        removed: ['th-b'],
      }),
    );
    const held = result.current.threads.get('th-a')!;
    expect(held.comments[0]).toMatchObject({ text: 'mine, edited', authorId: ME });
    expect(result.current.threads.has('th-b')).toBe(false);
  });

  it('reads again, once, when a tab-scoped session hears that something moved', async () => {
    vi.mocked(fetchThreads).mockResolvedValue([]);
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    vi.useFakeTimers();
    act(() => {
      result.current.receive({ kind: 'threads', upserts: [], removed: [] });
      result.current.refetch();
    });
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(fetchThreads).toHaveBeenCalledTimes(2);
  });
});

describe('writing', () => {
  it('shows a new thread at once, then the one the api stored, and tells of its mentions', async () => {
    vi.mocked(fetchThreads).mockResolvedValue([]);
    const stored = thread('th-stored', { title: 'Sam: Hello' });
    let answer!: (v: unknown) => void;
    vi.mocked(writeThread).mockReturnValue(new Promise((r) => (answer = r)) as never);
    const { result, onMentioned } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const mentions = [{ id: 'm1', name: 'Bo', start: 0, length: 3 }] as never;
    let made: Promise<unknown>;
    act(() => {
      made = result.current.act({ kind: 'start', itemId: 'card-1', text: 'Hello', mentions });
    });
    // Shown before the answer, titled as the api will title it.
    expect(result.current.threadsOf('card-1')[0]).toMatchObject({ title: 'Sam: Hello' });
    await act(async () => {
      answer({ thread: stored, commentId: 'c9' });
      await made;
    });
    expect(result.current.threadsOf('card-1').map((t) => t.id)).toEqual(['th-stored']);
    expect(onMentioned).toHaveBeenCalledWith('Hello', mentions, 'card-1', 'c9');
    expect(track).toHaveBeenCalledWith('Comment', 'Created', 'Thread');
  });

  it('applies a reply, a resolve and a rename at once', async () => {
    vi.mocked(fetchThreads).mockResolvedValue([thread('th-a')]);
    vi.mocked(writeThread).mockReturnValue(new Promise(() => {}) as never);
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => void result.current.act({ kind: 'reply', threadId: 'th-a', text: 'More' }));
    expect(result.current.threads.get('th-a')!.comments).toHaveLength(2);
    act(() => void result.current.act({ kind: 'resolve', threadId: 'th-a', resolved: true }));
    expect(result.current.threads.get('th-a')).toMatchObject({ resolved: true, resolvedBy: 'Sam' });
    act(() => void result.current.act({ kind: 'rename', threadId: 'th-a', title: 'New name' }));
    expect(result.current.threads.get('th-a')!.title).toBe('New name');
    act(() => void result.current.act({ kind: 'deleteThread', threadId: 'th-a' }));
    expect(result.current.threads.has('th-a')).toBe(false);
  });

  it('puts back what it showed when a write is refused, says why and reads again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetchThreads).mockResolvedValue([thread('th-a')]);
    vi.mocked(writeThread).mockRejectedValue(
      Object.assign(new Error('409'), { code: 'comments_full' }),
    );
    const { result, onError } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let out: unknown;
    await act(async () => {
      out = await result.current.act({ kind: 'reply', threadId: 'th-a', text: 'x' });
    });
    expect(out).toBe(false);
    expect(result.current.threads.get('th-a')!.comments).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith('This thread holds the most comments it can');
    expect(fetchThreads).toHaveBeenCalledTimes(2);
  });

  it('answers the thread as held when nothing changed', async () => {
    vi.mocked(fetchThreads).mockResolvedValue([thread('th-a', { resolved: true })]);
    vi.mocked(writeThread).mockResolvedValue({ unchanged: true });
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let out: unknown;
    await act(async () => {
      out = await result.current.act({ kind: 'resolve', threadId: 'th-a', resolved: true });
    });
    expect(out).toMatchObject({ id: 'th-a' });
  });

  it('counts a card added as a Linked thread', async () => {
    vi.mocked(fetchThreads).mockResolvedValue([thread('th-a')]);
    vi.mocked(writeThread).mockResolvedValue({ thread: thread('th-a') });
    const { result } = hook();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.act({ kind: 'addToCard', threadId: 'th-a', itemId: 'y' });
    });
    expect(track).toHaveBeenCalledWith('Comment', 'Linked', 'Thread');
  });
});

describe('refusals in words', () => {
  it('words every code, and a default', () => {
    for (const code of [
      'comments_full',
      'threads_full',
      'thread_cards_full',
      'thread_on_card',
      'title_too_long',
      'thread_not_found',
      'item_not_found',
      'forbidden',
      'field_invalid',
    ])
      expect(threadRefusalMessage(code)).not.toBe(threadRefusalMessage(null));
    expect(threadRefusalMessage(null)).toBe("Couldn't save that comment");
  });
});

describe('the faces’ count store', () => {
  it('tells only the cards whose count moved', () => {
    const store = createThreadStore();
    const a = vi.fn();
    const b = vi.fn();
    const offA = store.subscribe('a', a);
    store.subscribe('b', b);
    store.setCounts(new Map([['a', 2]]));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    store.setCounts(
      new Map([
        ['a', 2],
        ['b', 1],
      ]),
    );
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    store.setCounts(new Map());
    expect(a).toHaveBeenCalledTimes(1);
    expect(store.count('b')).toBe(0);
  });

  it('hands an export each card with its count', () => {
    const items = new Map([
      ['a', { id: 'a' }],
      ['b', { id: 'b' }],
    ]);
    expect(itemsWithCounts(items, new Map())).toBe(items);
    expect(itemsWithCounts(items, new Map([['a', 3]])).get('a')).toEqual({
      id: 'a',
      openComments: 3,
    });
  });

  it('reads one card’s count, zero with no store', () => {
    const store = createThreadStore();
    store.setCounts(new Map([['a', 4]]));
    expect(renderHook(() => useThreadCount(store, 'a')).result.current).toBe(4);
    expect(renderHook(() => useThreadCount(null, 'a')).result.current).toBe(0);
  });
});
