import { describe, expect, it } from 'vitest';
import type { CommentThread, ShapeElement, Tab } from './index';
import { activeCommentCount, graftCommentThreads, graftLiveTabState } from './index';

const shape = (id: string, thread?: CommentThread): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  ...(thread ? { commentThread: thread } : {}),
});

const thread = (...texts: string[]): CommentThread => ({
  comments: texts.map((text, i) => ({
    id: `c${i}-${text}`,
    text,
    createdAt: i,
    authorName: 'Sam',
    authorColor: '#f00',
  })),
  resolved: false,
});

const tab = (id: string, elements: ShapeElement[]): Tab => ({
  id,
  name: id,
  elements,
});

describe('activeCommentCount', () => {
  it('counts unresolved comments and hides resolved threads', () => {
    expect(activeCommentCount(undefined)).toBe(0);
    expect(activeCommentCount(thread('a', 'b'))).toBe(2);
    expect(activeCommentCount({ ...thread('a'), resolved: true })).toBe(0);
  });
});

describe('graftCommentThreads', () => {
  it('carries a live thread onto a snapshot that predates it (undo keeps the comment)', () => {
    const live = [tab('t1', [shape('a', thread('hello'))])];
    const snapshot = [tab('t1', [shape('a')])];
    const restored = graftCommentThreads(live, snapshot);
    expect((restored[0]!.elements[0] as ShapeElement).commentThread).toEqual(thread('hello'));
  });

  it('drops a snapshot thread the live state no longer has (deleted comment stays deleted)', () => {
    const live = [tab('t1', [shape('a')])];
    const snapshot = [tab('t1', [shape('a', thread('stale'))])];
    const restored = graftCommentThreads(live, snapshot);
    expect('commentThread' in restored[0]!.elements[0]!).toBe(false);
  });

  it('keeps the snapshot thread for an element the live state lacks (undone delete restores comments)', () => {
    const live = [tab('t1', [shape('other')])];
    const snapshot = [tab('t1', [shape('other'), shape('deleted', thread('kept'))])];
    const restored = graftCommentThreads(live, snapshot);
    expect((restored[0]!.elements[1] as ShapeElement).commentThread).toEqual(thread('kept'));
  });

  it('returns the same tab object when nothing changes', () => {
    const shared = shape('a', thread('same'));
    const live = [tab('t1', [shared])];
    const snapshot = [tab('t1', [shared])];
    const restored = graftCommentThreads(live, snapshot);
    expect(restored[0]).toBe(snapshot[0]);
  });

  it('leaves tabs missing from the live list untouched', () => {
    const live = [tab('t1', [shape('a')])];
    const snapshot = [tab('t2', [shape('b', thread('kept'))])];
    const restored = graftCommentThreads(live, snapshot);
    expect(restored[0]).toBe(snapshot[0]);
  });
});

describe('graftLiveTabState session fields (spec/39)', () => {
  const timer = { mode: 'stopwatch', running: true, anchorAt: 123 } as const;
  const vote = { active: true, revealed: false, votesPerPerson: 3, votes: {} } as const;

  it('carries a live timer and vote onto a snapshot that predates them (undo keeps them)', () => {
    const live = [{ ...tab('t1', [shape('a')]), timer, vote }];
    const snapshot = [tab('t1', [shape('a')])];
    const restored = graftLiveTabState(live, snapshot);
    expect(restored[0]!.timer).toEqual(timer);
    expect(restored[0]!.vote).toEqual(vote);
  });

  it('drops a snapshot timer the live state no longer has (cleared timer stays cleared)', () => {
    const live = [tab('t1', [shape('a')])];
    const snapshot = [{ ...tab('t1', [shape('a')]), timer }];
    const restored = graftLiveTabState(live, snapshot);
    expect('timer' in restored[0]!).toBe(false);
  });

  it('grafts comments and session fields together', () => {
    const live = [{ ...tab('t1', [shape('a', thread('hello'))]), vote }];
    const snapshot = [tab('t1', [shape('a')])];
    const restored = graftLiveTabState(live, snapshot);
    expect((restored[0]!.elements[0] as ShapeElement).commentThread).toEqual(thread('hello'));
    expect(restored[0]!.vote).toEqual(vote);
  });

  it('graftCommentThreads alone leaves session fields to the snapshot', () => {
    const live = [{ ...tab('t1', [shape('a')]), timer }];
    const snapshot = [tab('t1', [shape('a')])];
    const restored = graftCommentThreads(live, snapshot);
    expect('timer' in restored[0]!).toBe(false);
  });
});
