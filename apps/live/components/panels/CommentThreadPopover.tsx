'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CloseIcon, useClickOutside, useEscape, Portal } from '@livediagram/ui';
import { useReposition } from '@/hooks/canvas/useReposition';
import type { CommentMention, CommentThread } from '@livediagram/document';
import { isMobileViewportSync } from '@/lib/responsive';
import { VIEWPORT_EDGE_MARGIN as EDGE_MARGIN } from '@/lib/clamp-to-viewport';
import { CommentComposer, CommentResolveToggle, CommentThreadList } from './comment-thread-parts';

type CommentThreadPopoverProps = {
  // Element this thread belongs to. The popover anchors itself by querying
  // the DOM for the matching `[data-element-id]` wrapper.
  elementId: string;
  thread: CommentThread | undefined;
  onAddComment: (text: string, mentions: CommentMention[]) => void;
  onDeleteComment: (commentId: string) => void;
  onResolve: () => void;
  onUnresolve: () => void;
  onClose: () => void;
  // True for a view-only ('view' share role) session. View-role
  // visitors can still READ the thread (so they can see what the
  // host's collaborators have been discussing), the composer stays
  // open (they can chime in) and they can resolve or reopen the
  // thread: replying, resolving and reopening are participation, open
  // to view-role (docs/specs/015-api/api.md, the comment thread verbs).
  // What this flag limits is per-row delete, to THEIR OWN comments (see
  // selfId); deleting anyone else's needs edit rights. The
  // selection-popover gate in Canvas means a view-role visitor can't
  // open the popover from the toolbar anyway, but the element
  // comment-badge is a separate entry point, so delete needs its own gate.
  readOnly?: boolean;
  // The local participant's stable id, matched against each comment's
  // server-stamped authorId to decide whether a view-role visitor may
  // delete it. The API only ever exposes the visitor's own authorId
  // (others are redacted), so this can't reveal anyone else's comments
  // as deletable. Editors can delete any comment, so this is only
  // consulted in read-only mode.
  selfId: string;
};

const WIDTH = 288;
const GAP = 12;

// Portal-rendered comments panel anchored to the right edge of the element.
// Lets the user read existing comments, post a reply, delete individual
// comments, and resolve / unresolve the whole thread. Closes on outside
// click and on Escape.
export function CommentThreadPopover({
  elementId,
  thread,
  onAddComment,
  onDeleteComment,
  onResolve,
  onUnresolve,
  onClose,
  readOnly = false,
  selfId,
}: CommentThreadPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Focus the composer when the popover opens, but only on desktop.
  // On mobile, autofocus would pop the soft keyboard the instant the
  // popover lands, hiding most of the thread + the canvas underneath
  // it. Desktop users want to type immediately; mobile users want to
  // read first, then tap the field deliberately to start typing.
  // Once, when it is first placed: until then nothing is drawn, so there is no composer to focus
  // (an anchor that lands in the same commit, a new margin note's, is placed a render later).
  const placed = pos !== null;
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (!placed || focusedOnce.current) return;
    focusedOnce.current = true;
    if (isMobileViewportSync()) return;
    composerRef.current?.focus();
  }, [placed]);

  // Resolve the element's on-screen rect (after the canvas transform has
  // been applied), then place the popover just to the right with a small
  // gap. Re-measures on resize / scroll so it stays attached during pans.
  const reposition = useCallback(() => {
    const node = document.querySelector(`[data-element-id="${elementId}"]`);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    let left = rect.right + GAP;
    let top = rect.top;
    // Flip to the left of the element if there's no room on the right.
    if (left + WIDTH > window.innerWidth - EDGE_MARGIN) {
      left = rect.left - GAP - WIDTH;
    }
    // Clamp to viewport edges.
    left = Math.max(EDGE_MARGIN, Math.min(left, window.innerWidth - WIDTH - EDGE_MARGIN));
    top = Math.max(EDGE_MARGIN, top);
    setPos({ left, top });
  }, [elementId]);
  useReposition(reposition);

  // Don't close on a click that lands on a comment badge: those are
  // the popover's own toggle, and parent state handles flip-flop.
  useClickOutside(ref, onClose, true, '[data-comment-trigger]');
  useEscape(onClose);

  if (!pos) return null;

  const resolved = thread?.resolved ?? false;
  const comments = thread?.comments ?? [];

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] flex animate-fade-in flex-col rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{ left: pos.left, top: pos.top, width: WIDTH }}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Comments
            {comments.length > 0 ? (
              <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                ({comments.length})
              </span>
            ) : null}
          </h3>
          <div className="flex items-center gap-1">
            {comments.length > 0 ? (
              <CommentResolveToggle
                resolved={resolved}
                onResolve={onResolve}
                onUnresolve={onUnresolve}
              />
            ) : null}
            <button
              type="button"
              aria-label="Close comments"
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        </header>

        <CommentThreadList
          thread={thread}
          readOnly={readOnly}
          selfId={selfId}
          onDeleteComment={onDeleteComment}
        />

        {/* Add-comment textarea is available even in view-role: viewers
          can chime in, resolve and reopen (the comments endpoints allow
          view-role), but can't delete others' comments. Resolved threads
          still hide the textarea: adding a comment would functionally reopen the
          thread and that's a deliberate intent best surfaced as the
          reopen button up top, not a sneaky side effect of typing. */}
        {!resolved ? <CommentComposer onAddComment={onAddComment} fieldRef={composerRef} /> : null}
      </div>
    </Portal>
  );
}
