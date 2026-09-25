// Comment-thread state machine for the editor, lifted out of
// editor-page.tsx. The bundle covers:
//
// - `commentThreadOpenId`: which element's thread popover is open
//   (null when none). The dynamic `<CommentThreadPopover>` is
//   gated on this so the chunk only loads when a thread is opened.
// - `updateThread`: mutator that runs a per-thread updater function
//   against the active tab via `tickTabs` (no history push, per
//   the long-standing rule that comment edits aren't undoable so
//   typing a comment then Ctrl+Z doesn't blow it away).
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
// snapshot history, so they call `tickTabs` directly. Keeping that
// rule in one file makes the policy auditable.

import { useState } from 'react';
import { createComment, isBoxed, type CommentThread, type Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type EditorCommentsDeps = {
  // The tab id every mutation targets. Comments are tab-scoped:
  // switching tabs while a thread is open keeps the popover up
  // (matches the previous inline behaviour), but the mutator
  // writes against whichever tab is active at call time.
  activeId: string;
  // The history hook's element-only setter. Mutates tabs WITHOUT
  // pushing a snapshot, which is exactly what comments need (per
  // the spec/12 activity-log carve-out for non-undoable edits).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
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

  // Per-thread mutator. Updates one element's commentThread on the
  // active tab; returning `undefined` from `fn` drops the field
  // entirely (the threaded element returns to "no comments").
  const updateThread = (
    elementId: string,
    fn: (thread: CommentThread | undefined) => CommentThread | undefined,
  ) => {
    deps.tickTabs((ts) =>
      ts.map((t) =>
        t.id !== deps.activeId
          ? t
          : {
              ...t,
              elements: t.elements.map((el) => {
                if (el.id !== elementId || !isBoxed(el)) return el;
                const next = fn(el.commentThread);
                if (!next) {
                  const { commentThread: _drop, ...rest } = el;
                  return rest as typeof el;
                }
                return { ...el, commentThread: next };
              }),
            },
      ),
    );
  };

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
    updateThread(elementId, (thread) => ({
      comments: [...(thread?.comments ?? []), comment],
      // Adding a comment unresolves a resolved thread, the new
      // message is itself a signal that the conversation isn't
      // done.
      resolved: false,
    }));
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
    updateThread(elementId, (thread) =>
      thread
        ? {
            ...thread,
            comments: thread.comments.map((c) => (c.id === oldId ? { ...c, id: newId } : c)),
          }
        : undefined,
    );
  };

  const deleteComment = (elementId: string, commentId: string, persist?: PersistDelete) => {
    updateThread(elementId, (thread) => {
      if (!thread) return undefined;
      const remaining = thread.comments.filter((c) => c.id !== commentId);
      if (remaining.length === 0) return undefined;
      return { ...thread, comments: remaining };
    });
    if (persist) {
      void persist()
        .then(() => track('Comment', 'Deleted'))
        .catch(() => {});
    } else {
      track('Comment', 'Deleted');
    }
  };

  const resolveThread = (elementId: string) => {
    updateThread(elementId, (thread) => (thread ? { ...thread, resolved: true } : undefined));
    track('Comment', 'Resolved');
  };
  const unresolveThread = (elementId: string) => {
    updateThread(elementId, (thread) => (thread ? { ...thread, resolved: false } : undefined));
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
