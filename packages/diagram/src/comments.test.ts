import { describe, expect, it } from 'vitest';
import type { CommentThread, ShapeElement, Tab } from './index';
import { activeCommentCount, graftLiveTabState } from './index';

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

  it('grafting with sessionFields off leaves session fields to the snapshot', () => {
    const live = [{ ...tab('t1', [shape('a')]), timer }];
    const snapshot = [tab('t1', [shape('a')])];
    const restored = graftLiveTabState(live, snapshot, { sessionFields: false });
    expect('timer' in restored[0]!).toBe(false);
  });
});
