import { describe, expect, it } from 'vitest';
import type { Comment, Element, ShapeElement } from '@livediagram/diagram';
import {
  findComment,
  hasNewComments,
  redactCommentAuthorIds,
  removeComment,
  rewriteCommentAuthors,
} from './comments';
import type { ParticipantDTO } from './types';

// Server-side comment-author rewrite is a security boundary: the
// client's request body's authorName / authorColor on any comment
// must NOT win over the server-trusted participant record (for
// brand-new comments) or the stored values (for existing comments).
// These tests pin the three branches and the noop edge cases so the
// PUT-tab handler stays safe through future refactors.

function mkShape(id: string, comments: Comment[]): ShapeElement {
  return {
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    commentThread: { comments, resolved: false },
  };
}

function mkComment(
  id: string,
  authorName: string,
  authorColor: string,
  text = 't',
  authorId?: string,
): Comment {
  return { id, text, createdAt: 1, authorName, authorColor, authorId };
}

const writer: ParticipantDTO = {
  id: 'writer-id',
  name: 'Server Writer',
  color: '#0ea5e9',
  createdAt: 0,
};

describe('rewriteCommentAuthors', () => {
  it('passes elements without a commentThread through unchanged', () => {
    const el: Element = {
      id: 'a',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    const result = rewriteCommentAuthors([el], [], writer);
    expect(result).toEqual([el]);
  });

  it('passes elements with an empty commentThread through unchanged', () => {
    const el = mkShape('a', []);
    const result = rewriteCommentAuthors([el], [], writer);
    expect(result[0]).toBe(el);
  });

  it('overwrites author fields on a brand-new comment with the writer', () => {
    const next = mkShape('a', [mkComment('c1', 'CLIENT LIE', '#ff0000')]);
    const result = rewriteCommentAuthors([next], [], writer);
    const out = (result[0] as ShapeElement).commentThread!.comments[0]!;
    expect(out.authorName).toBe('Server Writer');
    expect(out.authorColor).toBe('#0ea5e9');
    expect(out.id).toBe('c1');
    expect(out.text).toBe('t');
  });

  it('preserves the original author of an existing comment even when the body claims otherwise', () => {
    const prev = mkShape('a', [mkComment('c1', 'Original Author', '#10b981')]);
    const next = mkShape('a', [mkComment('c1', 'HACKED', '#ff0000')]);
    const result = rewriteCommentAuthors([next], [prev], writer);
    const out = (result[0] as ShapeElement).commentThread!.comments[0]!;
    expect(out.authorName).toBe('Original Author');
    expect(out.authorColor).toBe('#10b981');
  });

  it('mixes preserved (existing) and rewritten (new) comments in the same thread', () => {
    const prev = mkShape('a', [mkComment('c1', 'Original', '#10b981')]);
    const next = mkShape('a', [
      mkComment('c1', 'HACKED', '#ff0000'),
      mkComment('c2', 'CLIENT LIE', '#ff0000'),
    ]);
    const [out] = rewriteCommentAuthors([next], [prev], writer) as [ShapeElement];
    expect(out.commentThread!.comments[0]!.authorName).toBe('Original');
    expect(out.commentThread!.comments[0]!.authorColor).toBe('#10b981');
    expect(out.commentThread!.comments[1]!.authorName).toBe('Server Writer');
    expect(out.commentThread!.comments[1]!.authorColor).toBe('#0ea5e9');
  });

  it('preserves the comment text and other fields while rewriting author fields', () => {
    const next = mkShape('a', [mkComment('c1', 'lie', '#ff0000', 'visible body')]);
    const [out] = rewriteCommentAuthors([next], [], writer) as [ShapeElement];
    expect(out.commentThread!.comments[0]!.text).toBe('visible body');
    expect(out.commentThread!.comments[0]!.createdAt).toBe(1);
  });

  it('keeps preservation scoped by id, not by element: a comment that moves elements still keeps its original author', () => {
    // Comment c1 was on element a in the prior tab. The new tab
    // somehow has it on element b (impossible via normal UI, but
    // models the rule: id wins, not parent). Author still locked.
    const prev = mkShape('a', [mkComment('c1', 'Original', '#10b981')]);
    const next = mkShape('b', [mkComment('c1', 'HACKED', '#ff0000')]);
    const [out] = rewriteCommentAuthors([next], [prev], writer) as [ShapeElement];
    expect(out.commentThread!.comments[0]!.authorName).toBe('Original');
  });

  it('returns new array references so the caller can detect a rewrite (no mutation in place)', () => {
    const next = mkShape('a', [mkComment('c1', 'lie', '#ff0000')]);
    const result = rewriteCommentAuthors([next], [], writer);
    expect(result[0]).not.toBe(next);
    expect((result[0] as ShapeElement).commentThread).not.toBe(next.commentThread);
    expect((result[0] as ShapeElement).commentThread!.comments[0]).not.toBe(
      next.commentThread!.comments[0],
    );
    // Original element untouched.
    expect(next.commentThread!.comments[0]!.authorName).toBe('lie');
  });

  it('stamps the writer id as authorId on a brand-new comment (ignoring any client-sent id)', () => {
    const next = mkShape('a', [mkComment('c1', 'lie', '#ff0000', 't', 'CLIENT-FORGED-ID')]);
    const [out] = rewriteCommentAuthors([next], [], writer) as [ShapeElement];
    expect(out.commentThread!.comments[0]!.authorId).toBe('writer-id');
  });

  it('preserves the stored authorId of an existing comment even if the body reassigns it', () => {
    const prev = mkShape('a', [mkComment('c1', 'Orig', '#10b981', 't', 'owner-1')]);
    const next = mkShape('a', [mkComment('c1', 'Orig', '#10b981', 't', 'attacker-id')]);
    const [out] = rewriteCommentAuthors([next], [prev], writer) as [ShapeElement];
    expect(out.commentThread!.comments[0]!.authorId).toBe('owner-1');
  });
});

describe('findComment', () => {
  it('finds a comment by id across elements', () => {
    const els = [mkShape('a', [mkComment('c1', 'A', '#fff')]), mkShape('b', [])];
    expect(findComment(els, 'c1')?.id).toBe('c1');
  });

  it('returns null when the id is absent', () => {
    expect(findComment([mkShape('a', [mkComment('c1', 'A', '#fff')])], 'missing')).toBeNull();
  });
});

describe('removeComment', () => {
  it('removes the matching comment from its thread', () => {
    const els = [mkShape('a', [mkComment('c1', 'A', '#fff'), mkComment('c2', 'B', '#fff')])];
    const [out] = removeComment(els, 'c1') as [ShapeElement];
    expect(out.commentThread!.comments.map((c) => c.id)).toEqual(['c2']);
  });

  it('drops the whole thread once its last comment is removed', () => {
    const els = [mkShape('a', [mkComment('c1', 'A', '#fff')])];
    const [out] = removeComment(els, 'c1');
    expect((out as { commentThread?: unknown }).commentThread).toBeUndefined();
  });

  it('returns elements unchanged when the comment id is absent', () => {
    const els = [mkShape('a', [mkComment('c1', 'A', '#fff')])];
    const result = removeComment(els, 'nope');
    expect(result[0]).toBe(els[0]);
  });
});

describe('redactCommentAuthorIds', () => {
  it("blanks other people's author ids but keeps the viewer's own", () => {
    const els = [
      mkShape('a', [
        mkComment('c1', 'Me', '#fff', 't', 'viewer-1'),
        mkComment('c2', 'Owner', '#000', 't', 'owner-9'),
      ]),
    ];
    const [out] = redactCommentAuthorIds(els, 'viewer-1') as [ShapeElement];
    expect(out.commentThread!.comments[0]!.authorId).toBe('viewer-1');
    expect(out.commentThread!.comments[1]!.authorId).toBeUndefined();
  });

  it('blanks every author id when the viewer matches none', () => {
    const els = [mkShape('a', [mkComment('c1', 'Owner', '#000', 't', 'owner-9')])];
    const [out] = redactCommentAuthorIds(els, 'someone-else') as [ShapeElement];
    expect(out.commentThread!.comments[0]!.authorId).toBeUndefined();
  });
});

describe('hasNewComments (docs/specs/014-identity/transactional-email.md #1)', () => {
  const cm = (id: string): Comment => ({
    id,
    text: 't',
    createdAt: 0,
    authorName: 'a',
    authorColor: '#000',
  });
  it('is true when a comment id appears that was not in prev', () => {
    expect(hasNewComments([mkShape('e1', [cm('c1'), cm('c2')])], [mkShape('e1', [cm('c1')])])).toBe(
      true,
    );
  });
  it('is false when nothing new was added (a removal)', () => {
    expect(hasNewComments([mkShape('e1', [cm('c1')])], [mkShape('e1', [cm('c1'), cm('c2')])])).toBe(
      false,
    );
  });
  it('is false on identical sets and with empty threads', () => {
    const els = [mkShape('e1', [cm('c1')])];
    expect(hasNewComments(els, els)).toBe(false);
    expect(hasNewComments([mkShape('e1', [])], [])).toBe(false);
  });
});

describe('rewriteCommentAuthors with the room ledger (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  const posted = new Map([['c1', { authorName: 'Bea', authorColor: '#f00' }]]);
  const commentsOf = (els: Element[]) => (els[0] as ShapeElement).commentThread!.comments;

  // THE bug: Bea's comment reached the writer live, and the writer's save
  // landed first, crediting it to the writer.
  it("credits somebody else's comment as the room saw it posted, not to the saver", () => {
    const next = [mkShape('a', [mkComment('c1', 'Whatever', '#000')])];
    const [c] = commentsOf(rewriteCommentAuthors(next, [], writer, posted));
    expect(c).toMatchObject({ authorName: 'Bea', authorColor: '#f00' });
    expect(c!.authorId).toBeUndefined();
  });

  it('stamps the writer on their OWN new comment even when the room knows it', () => {
    const next = [mkShape('a', [mkComment('c1', 'x', '#000', 't', writer.id)])];
    const [c] = commentsOf(rewriteCommentAuthors(next, [], writer, posted));
    expect(c).toMatchObject({ authorName: writer.name, authorId: writer.id });
  });

  it('lets the author claim a stored comment that has no author id yet', () => {
    const prev = [mkShape('a', [mkComment('c1', 'Bea', '#f00')])];
    const next = [mkShape('a', [mkComment('c1', 'Bea', '#f00', 't', writer.id)])];
    const [c] = commentsOf(rewriteCommentAuthors(next, prev, writer));
    expect(c!.authorId).toBe(writer.id);
  });

  it('never lets anyone take over a comment that already has an author', () => {
    const prev = [mkShape('a', [mkComment('c1', 'Bea', '#f00', 't', 'bea-id')])];
    const next = [mkShape('a', [mkComment('c1', 'Bea', '#f00', 't', writer.id)])];
    const [c] = commentsOf(rewriteCommentAuthors(next, prev, writer));
    expect(c!.authorId).toBe('bea-id');
  });
});
