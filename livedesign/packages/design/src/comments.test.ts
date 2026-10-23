import { describe, expect, it } from 'vitest';
import type { CommentThread, ShapeElement, Tab } from './index';
import { activeCommentCount, graftLiveTabState, opForTheWire } from './index';

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

describe('graftLiveTabState collaborative fields (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it("keeps checklist ticks but undoes the rows' own edit", () => {
    const live: ShapeElement = {
      ...shape('list'),
      checklistItems: [
        { text: 'one', done: true },
        { text: 'two', done: false },
      ],
    };
    // The undone step renamed a row; the tick on 'one' came after it.
    const snapshot: ShapeElement = {
      ...shape('list'),
      checklistItems: [{ text: 'one', done: false }],
    };
    const restored = graftLiveTabState([tab('t1', [live])], [tab('t1', [snapshot])]);
    expect((restored[0]!.elements[0] as ShapeElement).checklistItems).toEqual([
      { text: 'one', done: true },
    ]);
  });
});

describe('opForTheWire on a changeset (docs/specs/024-agents/agent-changesets.md)', () => {
  it('strips comment author ids from every element an add or update carries', () => {
    const authored = shape('a', {
      resolved: false,
      comments: [
        {
          id: 'c1',
          text: 'hi',
          createdAt: 1,
          authorName: 'Bea',
          authorColor: '#f00',
          authorId: 'user_bea',
        },
      ],
    });
    const op = {
      kind: 'changeset',
      tabId: 't1',
      elementOps: [
        { kind: 'add', element: authored, index: 0 },
        { kind: 'update', element: authored },
        { kind: 'remove', id: 'b' },
      ],
    };
    const wire = opForTheWire(op) as { elementOps: { element?: ShapeElement }[] };
    for (const elOp of wire.elementOps.slice(0, 2)) {
      expect(elOp.element?.commentThread?.comments[0]).not.toHaveProperty('authorId');
    }
    expect(wire.elementOps[2]).toBe(op.elementOps[2]);
  });
});

describe('opForTheWire and a comment token', () => {
  it('strips the token id with the author id, even on a comment that has only a token id', () => {
    const tokenOnly = {
      id: 'c2',
      text: 'x',
      createdAt: 1,
      authorName: 'A',
      authorColor: '#000',
      tokenId: 'tok_1',
    };
    const both = { ...tokenOnly, id: 'c3', authorId: 'user_a' };
    const op = {
      kind: 'changeset',
      tabId: 't1',
      elementOps: [
        {
          kind: 'add',
          element: shape('a', { resolved: false, comments: [tokenOnly, both] }),
          index: 0,
        },
      ],
    };
    const wire = opForTheWire(op) as { elementOps: { element: ShapeElement }[] };
    for (const c of wire.elementOps[0]!.element.commentThread!.comments) {
      expect(c).not.toHaveProperty('tokenId');
      expect(c).not.toHaveProperty('authorId');
    }
  });
});
