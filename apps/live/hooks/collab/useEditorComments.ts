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
//   selection popover + the comment thread popover bind to.
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

type EditorCommentsApi = {
  commentThreadOpenId: string | null;
  // Toggle open / closed: clicking the same id again closes the
  // popover (matches the existing behaviour).
  openComments: (elementId: string) => void;
  closeComments: () => void;
  addComment: (elementId: string, text: string) => void;
  deleteComment: (elementId: string, commentId: string) => void;
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

  const addComment = (elementId: string, text: string) => {
    updateThread(elementId, (thread) => ({
      comments: [
        ...(thread?.comments ?? []),
        createComment(text, {
          id: deps.selfParticipant.id,
          name: deps.selfParticipant.name,
          color: deps.selfParticipant.color,
        }),
      ],
      // Adding a comment unresolves a resolved thread, the new
      // message is itself a signal that the conversation isn't
      // done.
      resolved: false,
    }));
  };

  const deleteComment = (elementId: string, commentId: string) => {
    updateThread(elementId, (thread) => {
      if (!thread) return undefined;
      const remaining = thread.comments.filter((c) => c.id !== commentId);
      if (remaining.length === 0) return undefined;
      return { ...thread, comments: remaining };
    });
  };

  const resolveThread = (elementId: string) => {
    updateThread(elementId, (thread) => (thread ? { ...thread, resolved: true } : undefined));
  };
  const unresolveThread = (elementId: string) => {
    updateThread(elementId, (thread) => (thread ? { ...thread, resolved: false } : undefined));
  };

  return {
    commentThreadOpenId,
    openComments,
    closeComments,
    addComment,
    deleteComment,
    resolveThread,
    unresolveThread,
  };
}
