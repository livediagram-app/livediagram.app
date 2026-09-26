// Comment-thread state machine for the editor, lifted out of
// editor-page.tsx. The bundle covers:
//
// - `commentThreadOpenId`: which element's thread popover is open
//   (null when none). The dynamic `<CommentThreadPopover>` is
//   gated on this so the chunk only loads when a thread is opened.
// - every change goes out as ONE element delta (spec/152): an add, a
//   delete, an id swap or a resolve, applied locally without a history
//   push (typing a comment then Ctrl+Z doesn't blow it away) and sent to
//   the room at once. The thread used to ride the whole-element update,
//   so two replies inside one save window lost one of them.
// - `openComments`, `closeComments`, `addComment`, `deleteComment`,
//   `resolveThread`, `unresolveThread`: the six actions the
//   comment thread popover + the Comment panel bind to.
//
// Telemetry (spec/22) lives HERE, not at the call sites: the anchored
// popover and the Comment panel (spec/136) both drive these actions, and an
// emit beside one surface silently missed the other. Each action counts once,
// whichever surface ran it. Added / Deleted with a `persist` callback (the
// view-role path, which writes through the dedicated comment endpoints rather
// than the tab autosave) count only once the server accepted the write.
//
// History bypass is the key reason this lives in its own hook
// rather than alongside the main element-CRUD path: every other
// element mutation runs through `commit`, which captures
// before / after for history + activity log. Comments must NOT
// snapshot history, so they go through `applyElementDelta`, which
// ticks. Keeping that rule in one file makes the policy auditable.

import { useState } from 'react';
import { createComment } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';

type EditorCommentsDeps = {
  // Applies one delta to the ACTIVE tab without pushing a snapshot (per
  // the spec/12 activity-log carve-out for non-undoable edits) and sends
  // it to the room. Comments are tab-scoped: switching tabs while a
  // thread is open keeps the popover up, but the write targets whichever
  // tab is active at call time.
  applyElementDelta: ApplyElementDelta;
  // The local participant. Their name + color stamp every comment
  // the user adds so other participants see "Tom: ..." rather
  // than anonymous bubbles. The id is stamped as the comment's
  // authorId so the optimistic local copy already qualifies for the
  // delete-own affordance (it equals the server `owner` the API
  // stamps, for guests and Clerk users alike).
  selfParticipant: { id: string; name: string; color: string };
};

// A view-role write through the dedicated comment endpoints (spec/11). The
// add resolves to the server's comment (its id replaces the local one).
type PersistAdd = (localId: string) => Promise<{ id?: string } | null | undefined>;
type PersistDelete = () => Promise<unknown>;

type EditorCommentsApi = {
  commentThreadOpenId: string | null;
  // Toggle open / closed: clicking the same id again closes the
  // popover (matches the existing behaviour).
  openComments: (elementId: string) => void;
  closeComments: () => void;
  // Returns the minted comment id. With `persist` (view-role visitors, who
  // don't autosave the tab), the hook runs it, adopts the server-minted id
  // via `replaceCommentId`, and counts the add only once the server took it.
  addComment: (elementId: string, text: string, persist?: PersistAdd) => string;
  // Swap a comment's id in place — the view-role persist path gets the
  // authoritative id back from POST /comments, and without adopting it
  // the visitor's own delete sends an id the server doesn't have (the
  // comment resurrects on refresh).
  replaceCommentId: (elementId: string, oldId: string, newId: string) => void;
  deleteComment: (elementId: string, commentId: string, persist?: PersistDelete) => void;
  resolveThread: (elementId: string) => void;
  unresolveThread: (elementId: string) => void;
};

export function useEditorComments(deps: EditorCommentsDeps): EditorCommentsApi {
  const [commentThreadOpenId, setCommentThreadOpenId] = useState<string | null>(null);

  const openComments = (elementId: string) => {
    // Closure read before the toggle so we emit only on the open
    // transition, never on close, and never double-fire under React
    // strict mode (which would re-run an updater-internal side
    // effect).
    const wasOpen = commentThreadOpenId === elementId;
    setCommentThreadOpenId((cur) => (cur === elementId ? null : elementId));
    if (!wasOpen) track('Comment', 'Opened');
  };
  const closeComments = () => setCommentThreadOpenId(null);

  const addComment = (elementId: string, text: string, persist?: PersistAdd): string => {
    // Mint OUTSIDE the updater: state updaters must stay pure (strict
    // mode re-invokes them), and the caller needs the id.
    const comment = createComment(text, {
      id: deps.selfParticipant.id,
      name: deps.selfParticipant.name,
      color: deps.selfParticipant.color,
    });
    // Adding a comment unresolves a resolved thread (applyElementDelta):
    // the new message is itself a signal the conversation isn't done.
    deps.applyElementDelta(elementId, { kind: 'comment-add', comment });
    if (persist) {
      void persist(comment.id)
        .then((created) => {
          if (created?.id) replaceCommentId(elementId, comment.id, created.id);
          track('Comment', 'Added');
        })
        .catch(() => {});
    } else {
      // Owners / editors persist through the tab autosave, the same path
      // as every element edit, so the local add is the event.
      track('Comment', 'Added');
    }
    return comment.id;
  };

  const replaceCommentId = (elementId: string, oldId: string, newId: string) => {
    deps.applyElementDelta(elementId, { kind: 'comment-rekey', from: oldId, to: newId });
  };

  const deleteComment = (elementId: string, commentId: string, persist?: PersistDelete) => {
    // The last comment going takes the thread with it.
    deps.applyElementDelta(elementId, { kind: 'comment-remove', commentId });
    if (persist) {
      void persist()
        .then(() => track('Comment', 'Deleted'))
        .catch(() => {});
    } else {
      track('Comment', 'Deleted');
    }
  };

  const resolveThread = (elementId: string) => {
    deps.applyElementDelta(elementId, { kind: 'comment-resolve', resolved: true });
    track('Comment', 'Resolved');
  };
  const unresolveThread = (elementId: string) => {
    deps.applyElementDelta(elementId, { kind: 'comment-resolve', resolved: false });
    track('Comment', 'Unresolved');
  };

  return {
    commentThreadOpenId,
    openComments,
    closeComments,
    addComment,
    replaceCommentId,
    deleteComment,
    resolveThread,
    unresolveThread,
  };
}
