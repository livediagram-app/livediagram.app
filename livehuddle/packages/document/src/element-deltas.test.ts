import { describe, expect, it } from 'vitest';
import type { Comment, ElementDelta, ShapeElement } from './index';
import { applyElementDelta, elementChangeIsDeltaOnly, mergeIncomingElement } from './index';

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
  it('two replies at once both land; a replay does not duplicate', () => {
    const el = apply(
      card(),
      { kind: 'comment-add', comment: comment('c1') },
      { kind: 'comment-add', comment: comment('c2') },
      { kind: 'comment-add', comment: comment('c1') },
    );
    expect(el.commentThread?.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  // A refused delete put back (useEditorComments): before the comment that followed it, else at the end.
  it('puts a comment back before the one it preceded, or at the end when that one has gone', () => {
    const three = apply(
      card(),
      { kind: 'comment-add', comment: comment('c1') },
      { kind: 'comment-add', comment: comment('c3') },
      { kind: 'comment-add', comment: comment('c2'), before: 'c3' },
    );
    expect(three.commentThread?.comments.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    const gone = apply(
      card(),
      { kind: 'comment-add', comment: comment('c1') },
      { kind: 'comment-add', comment: comment('c2'), before: 'nope' },
    );
    expect(gone.commentThread?.comments.map((c) => c.id)).toEqual(['c1', 'c2']);
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
  // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") holds stored answers
  // nothing writes any more: a peer's whole copy is taken as it comes, those with it.
  it("takes a retired element's stored fields from the peer's copy", () => {
    const stored = { responses: [{ participantId: 'a', value: '3', at: 1 }], collabRound: 'r1' };
    const local = { ...card(), shape: 'estimate', ...stored } as unknown as ShapeElement;
    const incoming = { ...local, x: 50 } as ShapeElement;
    expect(mergeIncomingElement(local, incoming)).toBe(incoming);
  });

  it('keeps our comments, takes their other edits', () => {
    const local = card({
      commentThread: { comments: [comment('c1'), comment('c2')], resolved: false },
    });
    const incoming = card({
      x: 40,
      commentThread: { comments: [comment('c1')], resolved: false },
    });
    const merged = mergeIncomingElement(local, incoming) as ShapeElement;
    expect(merged.x).toBe(40);
    expect(merged.commentThread).toBe(local.commentThread);
  });
});

describe('elementChangeIsDeltaOnly (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  it('is true for a comment alone', () => {
    const before = card();
    expect(
      elementChangeIsDeltaOnly(
        before,
        apply(before, { kind: 'comment-add', comment: comment('c1') }),
      ),
    ).toBe(true);
  });

  it('is false for a move or a relabel', () => {
    const before = card({ label: 'one' });
    expect(elementChangeIsDeltaOnly(before, { ...before, x: 9 })).toBe(false);
    expect(elementChangeIsDeltaOnly(before, { ...before, label: 'uno' })).toBe(false);
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
    const merged = mergeIncomingElement(local, { ...withThread(), label: 'renamed' });
    expect((merged as ShapeElement).commentThread?.comments[0]?.reactions).toHaveLength(1);
    expect(elementChangeIsDeltaOnly(withThread(), local)).toBe(true);
  });
});
