import { describe, expect, it } from 'vitest';
import type { Comment, ElementDelta, ShapeElement } from './index';
import {
  applyElementDelta,
  checklistDeltaFor,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
} from './index';

const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'card',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
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
  it('is true for a tick or a comment alone', () => {
    const before = card({ checklistItems: [{ text: 'one', done: false }] });
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

  it('is false for a move or a retitled row', () => {
    const before = card({ checklistItems: [{ text: 'one', done: false }] });
    expect(elementChangeIsDeltaOnly(before, { ...before, x: 9 })).toBe(false);
    expect(
      elementChangeIsDeltaOnly(before, {
        ...before,
        checklistItems: [{ text: 'uno', done: false }],
      }),
    ).toBe(false);
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
