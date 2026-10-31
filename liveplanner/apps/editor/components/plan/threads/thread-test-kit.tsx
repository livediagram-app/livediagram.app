// What the card thread tests share: threads, a card, and a context whose writes are recorded and applied by the
// same pure change the api applies, so a test reads the panel as a person would after each click.
import { vi } from 'vitest';
import { useEffect, useState, type ReactNode } from 'react';
import {
  applyThreadChange,
  openCommentCounts,
  sortedThreads,
  threadsOnCard,
  type CardThread,
  type Comment,
} from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import type { ThreadAction } from '@/lib/api/card-threads';
import { createThreadStore } from '@/hooks/plan/thread-store';
import type { CardThreads } from '@/hooks/plan/useCardThreads';
import { CardThreadsProvider, type CardThreadsContextValue } from './CardThreadsContext';

export const PLAN = 'plan-a';
export const ME = 'owner-me';
const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };

export const card = (id = 'card-1', key = 1, title = 'Basket empties'): Item => ({
  id,
  type: 'task',
  key,
  rank: 'i',
  fields: { title },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

export const comment = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  text: `Text of ${id}`,
  createdAt: Date.now() - 60_000,
  authorName: 'Ada King',
  authorColor: '#f97316',
  ...extra,
});

export const thread = (id: string, extra: Partial<CardThread> = {}): CardThread => ({
  id,
  title: `Title of ${id}`,
  resolved: false,
  comments: [comment(`${id}-c1`)],
  createdAt: Date.now() - 60_000,
  createdBy: { name: 'Ada King', color: '#f97316' },
  updatedAt: Date.now() - 60_000,
  home: PLAN,
  cards: [{ projectId: PLAN, itemId: 'card-1', key: 1 }],
  rev: 1,
  ...extra,
});

/** A threads value over `initial`, recording each action and applying the ones it can. */
export function fakeThreads(initial: CardThread[], opts: { refuse?: boolean } = {}) {
  let held = new Map(initial.map((t) => [t.id, t]));
  const acts: ThreadAction[] = [];
  const store = createThreadStore();
  store.setCounts(openCommentCounts(held.values(), PLAN));
  const value = {
    status: 'ready',
    get threads() {
      return held;
    },
    threadsOf: (itemId: string) => sortedThreads(threadsOnCard(held.values(), PLAN, itemId)),
    store,
    act: vi.fn(async (action: ThreadAction) => {
      acts.push(action);
      if (opts.refuse) return false;
      if (action.kind === 'start') {
        const made = thread('th-new', {
          title: 'Sam: started',
          comments: [comment('c-new', { text: action.text, authorId: ME })],
          createdBy: { name: 'Sam', color: '#2563eb', authorId: ME },
          updatedAt: Date.now(),
          cards: [{ projectId: PLAN, itemId: action.itemId, key: 1 }],
        });
        held = new Map(held).set(made.id, made);
        return made;
      }
      const t = held.get(action.threadId);
      if (!t) return false;
      if (action.kind === 'deleteThread') {
        held = new Map(held);
        held.delete(t.id);
        return null;
      }
      if (action.kind === 'addToCard') {
        const next = {
          ...t,
          cards: [...t.cards, { projectId: PLAN, itemId: action.itemId, key: 9 }],
        };
        held = new Map(held).set(t.id, next);
        return next;
      }
      const change =
        action.kind === 'resolve'
          ? { kind: 'resolve' as const, resolved: action.resolved, by: 'Sam' }
          : action.kind === 'rename'
            ? { kind: 'rename' as const, title: action.title }
            : action.kind === 'delete'
              ? { kind: 'remove' as const, commentId: action.commentId }
              : action.kind === 'edit'
                ? { kind: 'edit' as const, commentId: action.commentId, text: action.text }
                : action.kind === 'react'
                  ? {
                      kind: 'react' as const,
                      commentId: action.commentId,
                      emoji: action.emoji,
                      by: action.key,
                      name: 'Sam',
                      on: action.on,
                    }
                  : {
                      kind: 'add' as const,
                      comment: comment('c-reply', { text: action.text, authorId: ME }),
                    };
      const out = applyThreadChange(t, change, Date.now());
      if (!out.ok) return false;
      if (!out.thread) {
        held = new Map(held);
        held.delete(t.id);
        return null;
      }
      held = new Map(held).set(t.id, out.thread);
      return out.thread;
    }),
    receive: vi.fn(),
    refetch: vi.fn(),
    projectId: PLAN,
    focused: null as string | null,
    focus: vi.fn(),
  };
  return { threads: value as unknown as CardThreads, acts };
}

export function contextOf(
  threads: CardThreads,
  extra: Partial<CardThreadsContextValue> = {},
): CardThreadsContextValue {
  return {
    threads,
    projectId: PLAN,
    projectName: 'Food Delivery App',
    selfId: ME,
    ownerId: ME,
    self: { name: 'Sam', color: '#2563eb' },
    selfKey: 'k-me',
    canComment: true,
    isEditor: true,
    openCard: vi.fn(),
    announce: vi.fn(),
    ...extra,
  };
}

export function Provide({
  value,
  children,
}: {
  value: CardThreadsContextValue;
  children: ReactNode;
}) {
  return <CardThreadsProvider value={value}>{children}</CardThreadsProvider>;
}

/** The panel's context, live: each action re-renders it with the threads as they then are. */
export function liveThreads(
  initial: CardThread[],
  extra: Partial<CardThreadsContextValue> = {},
  opts: { refuse?: boolean } = {},
) {
  const fake = fakeThreads(initial, opts);
  const listeners = new Set<() => void>();
  const base = fake.threads as unknown as Record<string, unknown> & {
    act: (a: ThreadAction) => Promise<unknown>;
  };
  const act = base.act;
  const snapshot = (): CardThreads =>
    ({
      ...base,
      threads: fake.threads.threads,
      threadsOf: fake.threads.threadsOf,
      act: async (a: ThreadAction) => {
        const out = await act(a);
        for (const l of listeners) l();
        return out;
      },
    }) as unknown as CardThreads;
  function Live({ children }: { children: ReactNode }) {
    const [value, setValue] = useState(() => contextOf(snapshot(), extra));
    useEffect(() => {
      const l = () => setValue(contextOf(snapshot(), extra));
      listeners.add(l);
      return () => void listeners.delete(l);
    }, []);
    return <CardThreadsProvider value={value}>{children}</CardThreadsProvider>;
  }
  return { Live, acts: fake.acts, act: fake.threads.act };
}
