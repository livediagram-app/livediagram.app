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

describe('graftLiveTabState collaborative fields (spec/152)', () => {
  // A snapshot taken before anybody answered: undoing some earlier edit
  // restores it, and must not take the room's answers with it.
  it('keeps answers, ideas, the roll and the picker result through an undo', () => {
    const answered: ShapeElement = {
      ...shape('card'),
      responses: [{ participantId: 'k1', value: 'done', at: 1 }],
      responsesRevealed: true,
      ideaCards: ['more coffee'],
      ideasRevealed: true,
      rollCall: [{ name: 'Sam', color: '#f00', at: 1 }],
      agendaCurrent: 2,
      pickerResult: 'Sam',
    };
    const restored = graftLiveTabState(
      [tab('t1', [answered])],
      [tab('t1', [{ ...shape('card'), x: 40 }])],
    );
    const card = restored[0]!.elements[0] as ShapeElement;
    // The undone edit (the move) is undone...
    expect(card.x).toBe(40);
    // ...and nobody's answer is.
    expect(card.responses).toEqual(answered.responses);
    expect(card.responsesRevealed).toBe(true);
    expect(card.ideaCards).toEqual(['more coffee']);
    expect(card.ideasRevealed).toBe(true);
    expect(card.rollCall).toEqual(answered.rollCall);
    expect(card.agendaCurrent).toBe(2);
    expect(card.pickerResult).toBe('Sam');
  });

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

  it('keeps a clear: answers the present no longer has stay gone', () => {
    const snapshot: ShapeElement = {
      ...shape('card'),
      responses: [{ participantId: 'k1', value: '8', at: 1 }],
    };
    const restored = graftLiveTabState([tab('t1', [shape('card')])], [tab('t1', [snapshot])]);
    expect('responses' in restored[0]!.elements[0]!).toBe(false);
  });
});
