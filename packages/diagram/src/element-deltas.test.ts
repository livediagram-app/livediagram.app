import { describe, expect, it } from 'vitest';
import type { Comment, ElementDelta, ShapeElement } from './index';
import {
  IDEA_MAX_CARDS,
  applyElementDelta,
  checklistDeltaFor,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
  responseDeltaFor,
} from './index';

const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'card',
  type: 'shape',
  shape: 'done-check',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
});

const done = (participantId: string, at = 1): ElementDelta => ({
  kind: 'response',
  participantId,
  value: 'done',
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

describe('applyElementDelta (spec/152)', () => {
  // THE bug: two people pressing the same done check inside one save window.
  // Each receiver used to take the other's whole element and lose a mark.
  it('two marks cast at once both land, whatever order they arrive in', () => {
    const ab = apply(card(), done('a'), done('b'));
    const ba = apply(card(), done('b'), done('a'));
    const who = (el: ShapeElement) => (el.responses ?? []).map((r) => r.participantId).sort();
    expect(who(ab)).toEqual(['a', 'b']);
    expect(who(ba)).toEqual(['a', 'b']);
  });

  it('a withdraw removes only that participant', () => {
    const el = apply(card(), done('a'), done('b'), {
      kind: 'response',
      participantId: 'a',
      value: null,
      at: 2,
    });
    expect(el.responses?.map((r) => r.participantId)).toEqual(['b']);
  });

  it('is idempotent: a replayed cast changes nothing', () => {
    const once = apply(card(), done('a'));
    expect(applyElementDelta(once, done('a'))).toBe(once);
  });

  it('drops an answer cast in another round (a cast from before a clear)', () => {
    const cleared = card({ collabRound: 'r2' });
    expect(applyElementDelta(cleared, done('a'))).toBe(cleared);
    expect(applyElementDelta(cleared, { ...done('a'), round: 'r1' } as ElementDelta)).toBe(cleared);
    expect(
      (applyElementDelta(cleared, { ...done('a'), round: 'r2' } as ElementDelta) as ShapeElement)
        .responses,
    ).toHaveLength(1);
  });

  it('two ideas posted at once both land, and a full box takes no more', () => {
    const box = card({ shape: 'idea-box' });
    const el = apply(box, { kind: 'idea', text: 'one' }, { kind: 'idea', text: 'two' });
    expect(el.ideaCards).toEqual(['one', 'two']);
    const full = card({ shape: 'idea-box', ideaCards: Array(IDEA_MAX_CARDS).fill('x') });
    expect(applyElementDelta(full, { kind: 'idea', text: 'late' })).toBe(full);
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

describe('mergeIncomingElement (spec/152)', () => {
  it("keeps our answers over a peer's snapshot from the same round", () => {
    const local = apply(card(), done('a'), done('b'));
    // The peer moved the card; their copy was saved before b's mark arrived.
    const incoming = { ...apply(card(), done('a')), x: 50 };
    const merged = mergeIncomingElement(local, incoming) as ShapeElement;
    expect(merged.x).toBe(50);
    expect(merged.responses).toBe(local.responses);
  });

  it('takes the incoming (empty) answers when the peer started a new round', () => {
    const local = apply(card(), done('a'));
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

describe('elementChangeIsDeltaOnly (spec/152)', () => {
  it('is true for an answer, a tick or a comment alone', () => {
    const before = card({ checklistItems: [{ text: 'one', done: false }] });
    expect(elementChangeIsDeltaOnly(before, apply(before, done('a')))).toBe(true);
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
    const el = apply(card({ collabRound: 'r1' }), { ...done('a'), round: 'r1' } as ElementDelta);
    expect(responseDeltaFor(el, 'a', 'done', 5)).toEqual({
      kind: 'response',
      participantId: 'a',
      value: null,
      at: 5,
      round: 'r1',
    });
  });
});

describe('comment-rekey when the server copy arrived first (spec/152)', () => {
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
