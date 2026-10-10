import { describe, expect, it } from 'vitest';
import { presetSetup } from '@livediagram/items';
import type { Comment, ElementDelta, ShapeElement } from './index';
import {
  IDEA_MAX_CARDS,
  applyElementDelta,
  withoutIdeaCard,
  yieldIdeaToPeer,
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

describe('applyElementDelta (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
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

  // docs/specs/012-collaboration/blueprints/idea-box-race.md "Interfaces and contracts".
  it('keeps card ids aligned with the cards, padding id-less ones, and drops a replay', () => {
    const legacy = card({ shape: 'idea-box', ideaCards: ['old'] });
    expect(apply(legacy, { kind: 'idea', text: 'plain' })).not.toHaveProperty('ideaCardIds');
    const el = apply(
      legacy,
      { kind: 'idea', text: 'one', id: 'a' },
      { kind: 'idea', text: 'two' },
      { kind: 'idea', text: 'bad id', id: 'x'.repeat(65) },
    );
    expect(el.ideaCards).toEqual(['old', 'one', 'two', 'bad id']);
    expect(el.ideaCardIds).toEqual(['', 'a', '', '']);
    expect(applyElementDelta(el, { kind: 'idea', text: 'one', id: 'a' })).toBe(el);
    // Ids left longer than the cards (an older client emptied the box) are cut at the next card.
    const stale = card({ shape: 'idea-box', ideaCards: [], ideaCardIds: ['gone', 'gone2'] });
    expect(apply(stale, { kind: 'idea', text: 'new', id: 'n' }).ideaCardIds).toEqual(['n']);
  });

  it('takes one card out by its id', () => {
    const box = card({ shape: 'idea-box', ideaCards: ['a', 'b', 'c'], ideaCardIds: ['1', '2'] });
    expect(withoutIdeaCard(box, '2')).toMatchObject({
      ideaCards: ['a', 'c'],
      ideaCardIds: ['1', ''],
    });
    expect(withoutIdeaCard(box, 'nope')).toBe(box);
    expect(withoutIdeaCard(card({ shape: 'idea-box', ideaCards: ['a'] }), '')).toMatchObject({
      ideaCards: ['a'],
    });
  });

  describe('yieldIdeaToPeer', () => {
    const fullWith = (...own: string[]) =>
      card({
        shape: 'idea-box',
        ideaCards: [
          ...Array(IDEA_MAX_CARDS - own.length).fill('x'),
          ...own.map((id) => `own ${id}`),
        ],
        ideaCardIds: [...Array(IDEA_MAX_CARDS - own.length).fill(''), ...own],
      });
    const peer: ElementDelta = { kind: 'idea', text: 'peer', id: 'p' };

    it("lets this browser's newest pending card go for a peer's card at the cap", () => {
      const { el, yielded } = yieldIdeaToPeer(fullWith('o1', 'o2'), peer, ['o1', 'o2']);
      expect(yielded).toBe('o2');
      const box = el as ShapeElement;
      expect(box.ideaCards).toHaveLength(IDEA_MAX_CARDS);
      expect(box.ideaCards!.slice(-2)).toEqual(['own o1', 'peer']);
      expect(box.ideaCardIds!.slice(-2)).toEqual(['o1', 'p']);
    });

    it('applies the delta as usual with nothing pending, under the cap, or for a replay', () => {
      const full = fullWith('o1');
      expect(yieldIdeaToPeer(full, peer, [])).toEqual({ el: full, yielded: null });
      expect(yieldIdeaToPeer(full, peer, ['answered-elsewhere'])).toEqual({
        el: full,
        yielded: null,
      });
      const roomy = card({ shape: 'idea-box', ideaCards: ['own'], ideaCardIds: ['o1'] });
      const r = yieldIdeaToPeer(roomy, peer, ['o1']);
      expect(r.yielded).toBeNull();
      expect((r.el as ShapeElement).ideaCards).toEqual(['own', 'peer']);
      expect(
        yieldIdeaToPeer(full, { kind: 'idea', text: 'own o1', id: 'o1' }, ['o1']).yielded,
      ).toBe(null);
      expect(yieldIdeaToPeer(full, { ...peer, round: 'other' }, ['o1']).yielded).toBeNull();
      expect(
        yieldIdeaToPeer(full, { kind: 'check', index: 0, text: 'x', done: true }, ['o1']),
      ).toEqual({
        el: full,
        yielded: null,
      });
    });
  });

  it('keeps our card ids with our cards when a peer sends the whole element', () => {
    const local = card({ shape: 'idea-box', ideaCards: ['a'], ideaCardIds: ['1'] });
    const incoming = card({ shape: 'idea-box', label: 'Renamed' });
    const merged = mergeIncomingElement(local, incoming) as ShapeElement;
    expect(merged).toMatchObject({ label: 'Renamed', ideaCards: ['a'], ideaCardIds: ['1'] });
    expect(elementChangeIsDeltaOnly(incoming, { ...incoming, ideaCardIds: ['1'] })).toBe(true);
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

describe('elementChangeIsDeltaOnly (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
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
