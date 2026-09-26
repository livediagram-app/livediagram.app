import type { Comment, Element } from '@livediagram/diagram';
import type { ParticipantDTO } from './types';

// Rewrite newly-added comments so the author fields come from the
// server-trusted participant record, not whatever the client posted.
// Compares each comment's id against the prior tab's comments by
// id: anything new is attributed to the writer (the resolved owner
// of the PUT); anything pre-existing passes through with its
// stored author fields restored. Closes the comment-author
// spoofing surface called out in the security audit (a share-link
// visitor could otherwise stamp another participant's name +
// colour onto a comment, or relabel someone else's existing one).
//
// A save can also carry SOMEBODY ELSE's new comment: it reached the saver
// live, and their save landed in D1 before the author's own. That comment is
// credited by `roomAuthors`, the name the room stamped it with when it was
// posted (spec/152), not to the saver, which is what used to happen. Its
// author id stays empty (the saver's copy has none: it is stripped from every
// room op) until the author's own save claims it; see below.
//
// Pure helper, exported so the api worker's PUT-tab handler and
// the colocated tests both consume the same implementation.
export function rewriteCommentAuthors(
  nextElements: Element[],
  prevElements: Element[],
  writer: ParticipantDTO,
  roomAuthors: ReadonlyMap<string, { authorName: string; authorColor: string }> = new Map(),
): Element[] {
  // Index existing comments by id so the lookup per new comment is
  // O(1). A comment id collision across two different elements is
  // impossible by construction (uuids) so flat indexing is safe.
  const existingComments = new Map<
    string,
    { authorName: string; authorColor: string; authorId?: string }
  >();
  for (const el of prevElements) {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    if (!thread?.comments) continue;
    for (const c of thread.comments) {
      existingComments.set(c.id, {
        authorName: c.authorName,
        authorColor: c.authorColor,
        authorId: c.authorId,
      });
    }
  }
  return nextElements.map((el) => {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    if (!thread?.comments?.length) return el;
    const sanitised = thread.comments.map((c) => {
      const prior = existingComments.get(c.id);
      if (prior) {
        // Existing comment: lock author fields (incl. the author id
        // used for delete-own checks) to whatever was stored. Stops a
        // malicious edit-role visitor from mutating someone else's
        // already-posted comment author or reassigning its ownership.
        //
        // The one opening: a comment stored WITHOUT an author id (credited
        // from the room, above) is claimed by the save that carries the
        // writer's own id on it, which only the author's copy does. What it
        // grants is delete-own over REST, and an edit-role writer can already
        // delete any comment through this very PUT.
        const claimed = prior.authorId === undefined && c.authorId === writer.id;
        return {
          ...c,
          authorName: prior.authorName,
          authorColor: prior.authorColor,
          authorId: claimed ? writer.id : prior.authorId,
        };
      }
      // Somebody else's comment, arriving in this writer's save before
      // their own: credited as the room saw it posted.
      const posted = roomAuthors.get(c.id);
      if (posted && c.authorId !== writer.id) {
        const { authorId: _none, ...rest } = c;
        return { ...rest, authorName: posted.authorName, authorColor: posted.authorColor };
      }
      // New comment: server-authoritative author (name, colour, and the
      // stable id that later authorises delete-own).
      return { ...c, authorName: writer.name, authorColor: writer.color, authorId: writer.id };
    });
    return { ...el, commentThread: { ...thread, comments: sanitised } } as Element;
  });
}

// Remove a single comment by id from whichever element's thread holds
// it, dropping the thread entirely once its last comment goes (so the
// element's comment badge clears, mirroring the client's deleteComment).
// Returns the elements unchanged when the id isn't present.
export function removeComment(elements: Element[], commentId: string): Element[] {
  return elements.map((el) => {
    const thread = (el as { commentThread?: { comments?: Comment[]; resolved: boolean } })
      .commentThread;
    if (!thread?.comments?.length) return el;
    const remaining = thread.comments.filter((c) => c.id !== commentId);
    if (remaining.length === thread.comments.length) return el;
    if (remaining.length === 0) {
      const { commentThread: _drop, ...rest } = el as { commentThread?: unknown };
      return rest as Element;
    }
    return { ...el, commentThread: { ...thread, comments: remaining } } as Element;
  });
}

// Find a comment by id across all elements and return it (with its
// author id), or null. Used to authorise delete-own before mutating.
export function findComment(elements: Element[], commentId: string): Comment | null {
  return findCommentHost(elements, commentId)?.comment ?? null;
}

// The comment and the element whose thread holds it.
export function findCommentHost(
  elements: Element[],
  commentId: string,
): { comment: Comment; elementId: string } | null {
  for (const el of elements) {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    const hit = thread?.comments?.find((c) => c.id === commentId);
    if (hit) return { comment: hit, elementId: el.id };
  }
  return null;
}

// Blank the author id on every comment a given visitor did NOT write,
// before serving a tab to a non-owner. The author id is the diagram /
// guest owner id of whoever posted the comment; exposing other people's
// ids to a visitor would re-open the observe-then-claim vector that
// `redactOwner` closes for the diagram owner id. A visitor still sees
// their OWN author id (which they already know — it's their own id), so
// the client can light up a delete button on their own comments. Pass
// the diagram owner's id as `viewerId` to no-op (the owner sees all).
export function redactCommentAuthorIds(elements: Element[], viewerId: string | null): Element[] {
  return elements.map((el) => {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    if (!thread?.comments?.length) return el;
    const comments = thread.comments.map((c) =>
      c.authorId && c.authorId === viewerId ? c : { ...c, authorId: undefined },
    );
    return { ...el, commentThread: { ...thread, comments } } as Element;
  });
}

// spec/64 (#1): true when `nextElements` adds at least one comment id not in
// `prevElements`. Used by the tab-autosave handler to fire the "someone
// commented on your diagram" notification only when a genuinely new comment
// landed (not on every autosave).
export function hasNewComments(nextElements: Element[], prevElements: Element[]): boolean {
  const seen = new Set<string>();
  for (const el of prevElements) {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    for (const c of thread?.comments ?? []) seen.add(c.id);
  }
  for (const el of nextElements) {
    const thread = (el as { commentThread?: { comments?: Comment[] } }).commentThread;
    for (const c of thread?.comments ?? []) {
      if (!seen.has(c.id)) return true;
    }
  }
  return false;
}
