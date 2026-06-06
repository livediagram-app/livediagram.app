'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from './Portal';
import type { Comment, CommentThread } from '@livediagram/diagram';
import { initialsOf } from '@/lib/identity';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useEscape } from '@/hooks/useEscape';
import { isMobileViewportSync } from '@/lib/responsive';
import { formatRelativeTimeCompact } from '@/lib/relative-time';

type CommentThreadPopoverProps = {
  // Element this thread belongs to. The popover anchors itself by querying
  // the DOM for the matching `[data-element-id]` wrapper.
  elementId: string;
  thread: CommentThread | undefined;
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onResolve: () => void;
  onUnresolve: () => void;
  onClose: () => void;
  // True for a view-only ('view' share role) session. View-role
  // visitors can still READ the thread (so they can see what the
  // host's collaborators have been discussing), but the composer
  // hides, per-row delete buttons hide, and the resolve/unresolve
  // toggle becomes a plain "Resolved" badge they can't flip. The
  // selection-popover gate in Canvas means a view-role visitor
  // can't open the popover from the toolbar anyway — but the
  // element comment-badge is a separate entry point, so the
  // mutations need their own gate.
  readOnly?: boolean;
};

const WIDTH = 288;
const GAP = 12;
const EDGE_MARGIN = 8;

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
}: CommentThreadPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [draft, setDraft] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Focus the composer when the popover opens, but only on desktop.
  // On mobile, autofocus would pop the soft keyboard the instant the
  // popover lands, hiding most of the thread + the canvas underneath
  // it. Desktop users want to type immediately; mobile users want to
  // read first, then tap the field deliberately to start typing.
  useEffect(() => {
    if (isMobileViewportSync()) return;
    composerRef.current?.focus();
  }, []);

  // Resolve the element's on-screen rect (after the canvas transform has
  // been applied), then place the popover just to the right with a small
  // gap. Re-measures on resize / scroll so it stays attached during pans.
  useLayoutEffect(() => {
    const update = () => {
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
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [elementId]);

  // Don't close on a click that lands on a comment badge: those are
  // the popover's own toggle, and parent state handles flip-flop.
  useClickOutside(ref, onClose, true, '[data-comment-trigger]');
  useEscape(onClose);

  if (!pos) return null;

  const resolved = thread?.resolved ?? false;
  const comments = thread?.comments ?? [];

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddComment(text);
    setDraft('');
  };

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-50 flex animate-fade-in flex-col rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
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
              readOnly ? (
                // View-role can see WHETHER the thread is resolved
                // but can't flip the state. Unresolved threads show
                // nothing here (no toggleable affordance to suggest
                // they could act on it).
                resolved ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Resolved
                  </span>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={resolved ? onUnresolve : onResolve}
                  className={
                    resolved
                      ? 'rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25'
                      : 'rounded px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }
                  aria-pressed={resolved}
                >
                  {resolved ? 'Resolved' : 'Resolve'}
                </button>
              )
            ) : null}
            <button
              type="button"
              aria-label="Close comments"
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <ul className="max-h-72 overflow-y-auto px-3 py-1">
          {comments.length === 0 ? (
            <li className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              No comments yet.
            </li>
          ) : (
            comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                resolved={resolved}
                // View-role hides the per-row delete button entirely.
                onDelete={readOnly ? undefined : () => onDeleteComment(c.id)}
              />
            ))
          )}
        </ul>

        {/* Add-comment textarea is available even in view-role: viewers
          can chime in (POSTs go through a dedicated comments endpoint
          that allows view-role), but can't toggle resolve / unresolve
          or delete others' comments. Resolved threads still hide the
          textarea — adding a comment would functionally reopen the
          thread and that's a deliberate intent best surfaced as the
          reopen button up top, not a sneaky side effect of typing. */}
        {!resolved ? (
          <footer className="border-t border-slate-100 p-2 dark:border-slate-800">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl+Enter submits — Enter alone keeps newline support.
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Add a comment…"
              rows={2}
              className="w-full resize-none rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">⌘↵ to send</p>
              <button
                type="button"
                onClick={submit}
                disabled={!draft.trim()}
                className="rounded bg-brand-500 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Comment
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </Portal>
  );
}

function CommentRow({
  comment,
  resolved,
  onDelete,
}: {
  comment: Comment;
  resolved: boolean;
  // Undefined in view-only mode so the row never renders a delete
  // affordance. Editable rows pass the bound delete handler.
  onDelete?: () => void;
}) {
  return (
    <li className={`group flex gap-2 py-2 ${resolved ? 'opacity-60' : ''}`}>
      <div
        aria-hidden
        style={{ backgroundColor: comment.authorColor }}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      >
        {initialsOf(comment.authorName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
            {comment.authorName}
          </span>
          <span className="text-slate-400 dark:text-slate-500">
            {formatRelativeTimeCompact(Date.now() - comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
          {comment.text}
        </p>
      </div>
      {!resolved && onDelete ? (
        <button
          type="button"
          aria-label="Delete comment"
          onClick={onDelete}
          className="self-start rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
        >
          <TrashIcon />
        </button>
      ) : null}
    </li>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 3l6 6M3 9l6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  );
}
