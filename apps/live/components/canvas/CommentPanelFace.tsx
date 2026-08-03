'use client';

import { useState } from 'react';

import { activeCommentCount, type ShapeElement } from '@livediagram/diagram';

import { relativeSince } from '@/lib/relative-time';

// The face of a Comment panel (spec/136): a card on the board that carries a
// comment thread, collapsing to a one-line summary and opening to the thread.
//
// It carries NO comment machinery of its own. Every element can already hold a
// `commentThread`, and the composer, resolve / unresolve, author identity,
// realtime and persistence all already work against that field, keyed by
// element id. A panel is an element whose only job is to hold one and show it
// in place, so this file is a layout and a toggle.
//
// The point of a panel over the anchored popover is that it STAYS. A popover
// is one reader's transient view; a panel connected to what it is about sits
// on the board, in the export, and in everyone's session — which is what makes
// a remark part of the diagram rather than a note somebody left.

export function CommentPanelFace({
  element,
  textColor,
  selfId,
  onAddComment,
  onDeleteComment,
  onResolve,
  onUnresolve,
}: {
  element: ShapeElement;
  textColor: string;
  selfId: string;
  // Absent on a surface with no comment session (the read-only embed, the
  // export renderer), which renders the panel readable but inert.
  onAddComment?: (text: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onResolve?: () => void;
  onUnresolve?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const thread = element.commentThread;
  const comments = thread?.comments ?? [];
  const resolved = thread?.resolved === true;
  const count = activeCommentCount(thread);

  const submit = () => {
    const text = draft.trim();
    if (!text || !onAddComment) return;
    onAddComment(text);
    setDraft('');
  };

  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-[inherit] ${
        resolved ? 'opacity-60' : ''
      }`}
      style={{ color: textColor }}
    >
      {/* A header, not a toggle. Collapsing was built and then dropped: a
          panel you have deliberately put on the board is there to be READ, and
          folding it to a summary line left you with an element whose whole
          purpose was hidden behind another click. The anchored popover already
          covers "I don't want to see this right now" — you simply don't add a
          panel. */}
      <span className="flex w-full shrink-0 items-baseline gap-2 px-2.5 py-2">
        <span className="text-[11px] font-semibold">
          {resolved ? 'Resolved' : count === 1 ? '1 comment' : `${count} comments`}
        </span>
      </span>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-1">
        {comments.length === 0 ? (
          <span className="text-[10px] italic opacity-50">
            Nothing yet. Say what this is about.
          </span>
        ) : (
          comments.map((c) => (
            <span key={c.id} className="flex min-w-0 flex-col">
              <span className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-semibold" style={{ color: c.authorColor }}>
                  {c.authorName}
                </span>
                <span className="text-[9px] opacity-45">{relativeSince(c.createdAt)}</span>
                {/* Your own comments only: the same rule the popover
                        applies, so a panel cannot become a way around it. */}
                {onDeleteComment && c.authorId && c.authorId === selfId ? (
                  <button
                    type="button"
                    aria-label="Delete this comment"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteComment(c.id);
                    }}
                    className="pointer-events-auto ml-auto cursor-pointer text-[9px] opacity-40 transition hover:opacity-90"
                  >
                    ✕
                  </button>
                ) : null}
              </span>
              <span className="whitespace-pre-wrap break-words text-[11px] leading-snug">
                {c.text}
              </span>
            </span>
          ))
        )}
      </div>

      {onAddComment ? (
        <div className="flex shrink-0 items-end gap-1.5 px-2.5 pb-2 pt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // The canvas listens for keys; a composer has to keep its
              // own or typing would fire tool shortcuts. Enter sends,
              // Shift+Enter breaks the line — the popover's rule.
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Reply…"
            className="pointer-events-auto min-w-0 flex-1 resize-none rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[11px] outline-none transition focus:border-brand-400 dark:border-white/15 dark:bg-white/10"
          />
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              submit();
            }}
            disabled={!draft.trim()}
            className="pointer-events-auto shrink-0 cursor-pointer rounded-md bg-slate-900/85 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-slate-900 disabled:cursor-default disabled:opacity-40"
          >
            Send
          </button>
        </div>
      ) : null}

      {comments.length > 0 && (onResolve || onUnresolve) ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (resolved) onUnresolve?.();
            else onResolve?.();
          }}
          className="pointer-events-auto shrink-0 cursor-pointer px-2.5 pb-2 text-left text-[10px] font-medium opacity-60 transition hover:opacity-100"
        >
          {resolved ? 'Reopen thread' : 'Resolve thread'}
        </button>
      ) : null}
    </div>
  );
}
