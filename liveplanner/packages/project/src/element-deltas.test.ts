import { describe, expect, it } from 'vitest';
import { presetSetup } from '@liveplanner/items';
import type { Comment, ElementDelta, ShapeElement } from './index';
import {
  applyElementDelta,
  checklistDeltaFor,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
  responseDeltaFor,
} from './index';

const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'card',
  type: 'shape',
  shape: 'temperature',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
});

const cast = (participantId: string, at = 1): ElementDelta => ({
  kind: 'response',
  participantId,
  value: '5',
  at,
});

const apply = (el: ShapeElement, ...deltas: ElementDelta[]) =>
  deltas.reduce<ShapeElement>((e, d) => applyElementDelta(e, d) as ShapeElement, el);

const comment = (id: string, text = id): Comment => ({
  id,
  text,
  createdAt: 1,
  authorName: 'Sam',
  authorColor: '#f00',
});

describe('applyElementDelta (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  // THE bug: two people pressing the same temperature check inside one save window.
  // Each receiver used to take the other's whole element and lose an answer.
  it('two marks cast at once both land, whatever order they arrive in', () => {
    const ab = apply(card(), cast('a'), cast('b'));
    const ba = apply(card(), cast('b'), cast('a'));
    const who = (el: ShapeElement) => (el.responses ?? []).map((r) => r.participantId).sort();
    expect(who(ab)).toEqual(['a', 'b']);
    expect(who(ba)).toEqual(['a', 'b']);
  });

  it('a withdraw removes only that participant', () => {
    const el = apply(card(), cast('a'), cast('b'), {
      kind: 'response',
      participantId: 'a',
      value: null,
      at: 2,
    });
    expect(el.responses?.map((r) => r.participantId)).toEqual(['b']);
  });

  it('is idempotent: a replayed cast changes nothing', () => {
    const once = apply(card(), cast('a'));
    expect(applyElementDelta(once, cast('a'))).toBe(once);
  });

  it('drops an answer cast in another round (a cast from before a clear)', () => {
    const cleared = card({ collabRound: 'r2' });
    expect(applyElementDelta(cleared, cast('a'))).toBe(cleared);
    expect(applyElementDelta(cleared, { ...cast('a'), round: 'r1' } as ElementDelta)).toBe(cleared);
    expect(
      (applyElementDelta(cleared, { ...cast('a'), round: 'r2' } as ElementDelta) as ShapeElement)
        .responses,
    ).toHaveLength(1);
  });

  it('ticks different checklist rows from two people without losing either', () => {
    const list = card({
      shape: 'checklist',
      checklistItems: [
        { text: 'one', done: false },
        { text: 'two', done: false },
      ],
    });
    const el = apply(list, checklistDeltaFor(list, 0)!, checklistDeltaFor(list, 1)!);
    expect(el.checklistItems?.map((i) => i.done)).toEqual([true, true]);
  });

  it('finds a checklist row by its text when the rows moved meanwhile', () => {
    const list = card({
      shape: 'checklist',
      checklistItems: [
        { text: 'two', done: false },
        { text: 'one', done: false },
      ],
    });
    const el = apply(list, { kind: 'check', index: 0, text: 'one', done: true });
    expect(el.checklistItems).toEqual([
      { text: 'two', done: false },
      { text: 'one', done: true },
    ]);
  });

  it('two replies at once both land; a replay does not duplicate', () => {
    const el = apply(
      card(),
      { kind: 'comment-add', comment: comment('c1') },
      { kind: 'comment-add', comment: comment('c2') },
      { kind: 'comment-add', comment: comment('c1') },
    );
    expect(el.commentThread?.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('removing the last comment removes the thread', () => {
    const el = apply(
      card(),
      { kind: 'comment-add', comment: comment('c1') },
      { kind: 'comment-remove', commentId: 'c1' },
    );
    expect('commentThread' in el).toBe(false);
  });

  it('ignores a malformed frame', () => {
    const el = card();
    expect(
      applyElementDelta(el, {
        kind: 'comment-add',
        comment: { id: 1 } as unknown as Comment,
      }),
    ).toBe(el);
  });
});

describe('mergeIncomingElement (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it("keeps our answers over a peer's snapshot from the same round", () => {
    const local = apply(card(), cast('a'), cast('b'));
    // The peer moved the card; their copy was saved before b's mark arrived.
    const incoming = { ...apply(card(), cast('a')), x: 50 };
    const merged = mergeIncomingElement(local, incoming) as ShapeElement;
    expect(merged.x).toBe(50);
    expect(merged.responses).toBe(local.responses);
  });

  it('takes the incoming (empty) answers when the peer started a new round', () => {
    const local = apply(card(), cast('a'));
    const incoming = card({ responses: [], collabRound: 'r2' });
    expect((mergeIncomingElement(local, incoming) as ShapeElement).responses).toEqual([]);
  });

  it('keeps our ticks and our comments, takes their row edits', () => {
    const local = card({
      shape: 'checklist',
      checklistItems: [{ text: 'one', done: true }],
      commentThread: { comments: [comment('c1'), comment('c2')], resolved: false },
    });
    const incoming = card({
      shape: 'checklist',
      checklistItems: [
        { text: 'one', done: false },
        { text: 'new row', done: false },
      ],
      commentThread: { comments: [comment('c1')], resolved: false },
    });
    const merged = mergeIncomingElement(local, incoming) as ShapeElement;
    expect(merged.checklistItems).toEqual([
      { text: 'one', done: true },
      { text: 'new row', done: false },
    ]);
    expect(merged.commentThread).toBe(local.commentThread);
  });
});

describe('elementChangeIsDeltaOnly (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it('is true for an answer, a tick or a comment alone', () => {
    const before = card({ checklistItems: [{ text: 'one', done: false }] });
    expect(elementChangeIsDeltaOnly(before, apply(before, cast('a')))).toBe(true);
    expect(elementChangeIsDeltaOnly(before, apply(before, checklistDeltaFor(before, 0)!))).toBe(
      true,
    );
    expect(
      elementChangeIsDeltaOnly(
        before,
        apply(before, { kind: 'comment-add', comment: comment('c1') }),
      ),
    ).toBe(true);
  });

  it('is false for a move, a retitled row, or a new round', () => {
    const before = card({ checklistItems: [{ text: 'one', done: false }] });
    expect(elementChangeIsDeltaOnly(before, { ...before, x: 9 })).toBe(false);
    expect(
      elementChangeIsDeltaOnly(before, {
        ...before,
        checklistItems: [{ text: 'uno', done: false }],
      }),
    ).toBe(false);
    expect(elementChangeIsDeltaOnly(before, { ...before, collabRound: 'r2' })).toBe(false);
  });
});

describe('responseDeltaFor', () => {
  it('withdraws when pressing your own answer again, and carries the round', () => {
    const el = apply(card({ collabRound: 'r1' }), { ...cast('a'), round: 'r1' } as ElementDelta);
    expect(responseDeltaFor(el, 'a', '5', 5)).toEqual({
      kind: 'response',
      participantId: 'a',
      value: null,
      at: 5,
      round: 'r1',
    });
  });
});

describe('comment-rekey when the server copy arrived first (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it('drops the local duplicate and lends the author id to the server copy', () => {
    const mine = { ...comment('local'), authorId: 'me' };
    const serverCopy = { ...comment('server') };
    const el = apply(
      card(),
      { kind: 'comment-add', comment: mine },
      { kind: 'comment-add', comment: serverCopy },
      { kind: 'comment-rekey', from: 'local', to: 'server' },
    );
    expect(el.commentThread?.comments).toEqual([{ ...serverCopy, authorId: 'me' }]);
  });
});

// A Plan board's set-up (docs/specs/012-collaboration/collab-race-hardening.md, phase 6).
describe('board deltas', () => {
  const setup = presetSetup('kanban');
  const boardEl = (over: Partial<ShapeElement> = {}): ShapeElement =>
    card({ id: 'b', shape: 'plan-board', planBoard: setup, ...over });
  const todo = setup.columns[1]!.id;
  const renamed = {
    ...setup,
    columns: setup.columns.map((c) => (c.id === todo ? { ...c, name: 'Ready' } : c)),
  };

  it('applies a set-up patch, and ignores one for an element with no board', () => {
    const delta: ElementDelta = {
      kind: 'board',
      patch: { columns: { [todo]: { set: { name: 'Ready' } } } },
    };
    expect((applyElementDelta(boardEl(), delta) as ShapeElement).planBoard).toEqual(renamed);
    const plain = card();
    expect(applyElementDelta(plain, delta)).toBe(plain);
  });

  it('keeps our set-up through a peer whole-element copy, but takes an agent copy', () => {
    const ours = boardEl({ planBoard: renamed });
    const theirs = boardEl({ x: 50 });
    const merged = mergeIncomingElement(ours, theirs) as ShapeElement;
    expect(merged.x).toBe(50);
    expect(merged.planBoard).toBe(renamed);
    expect(
      (mergeIncomingElement(ours, theirs, { keepBoard: false }) as ShapeElement).planBoard,
    ).toBe(setup);
  });

  it('counts a set-up-only change as delta-carried, but not a set-up appearing', () => {
    expect(elementChangeIsDeltaOnly(boardEl(), boardEl({ planBoard: renamed }))).toBe(true);
    expect(elementChangeIsDeltaOnly(boardEl(), boardEl({ planBoard: renamed, x: 9 }))).toBe(false);
    expect(elementChangeIsDeltaOnly(card({ shape: 'plan-board' }), boardEl())).toBe(false);
  });
});

describe('comment-react (docs/specs/012-collaboration/comment-reactions.md)', () => {
  const withThread = () =>
    card({ commentThread: { comments: [comment('c1'), comment('c2')], resolved: false } });
  const react = (by: string, on = true, commentId = 'c1'): ElementDelta => ({
    kind: 'comment-react',
    commentId,
    emoji: 'thumbs-up',
    by,
    name: by,
    on,
  });

  it("adds and takes back one person's reaction, and two at once both land", () => {
    const el = apply(withThread(), react('a'), react('b'));
    expect(el.commentThread?.comments[0]?.reactions?.map((r) => r.by)).toEqual(['a', 'b']);
    expect(el.commentThread?.comments[1]?.reactions).toBeUndefined();
    const back = apply(el, react('a', false), react('b', false));
    expect(back.commentThread?.comments[0]).toEqual(comment('c1'));
  });

  it('is the same element for a repeat, an unknown comment, or a malformed frame', () => {
    const el = apply(withThread(), react('a'));
    expect(applyElementDelta(el, react('a'))).toBe(el);
    expect(applyElementDelta(el, react('a', true, 'nope'))).toBe(el);
    expect(
      applyElementDelta(el, { ...react('a'), emoji: 'rocket' } as unknown as ElementDelta),
    ).toBe(el);
    expect(applyElementDelta(el, { ...react('a'), commentId: 1 } as unknown as ElementDelta)).toBe(
      el,
    );
    expect(applyElementDelta(card(), react('a'))).toEqual(card());
  });

  it('keeps reactions through a whole-element update from a peer', () => {
    const local = apply(withThread(), react('a'));
    const merged = mergeIncomingElement(local, { ...withThread(), x: 40 });
    expect((merged as ShapeElement).commentThread?.comments[0]?.reactions).toHaveLength(1);
    expect(elementChangeIsDeltaOnly(withThread(), local)).toBe(true);
  });
});
