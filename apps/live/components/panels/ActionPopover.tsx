'use client';

import { useRef, useState } from 'react';
import type { ElementAction } from '@livediagram/diagram';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { Portal } from '@/components/primitives/Portal';
import { useReposition } from '@/hooks/canvas/useReposition';
import { useClickOutside } from '@/hooks/ui/useClickOutside';
import { useEscape } from '@/hooks/ui/useEscape';
import { initialsOf } from '@/lib/identity';
import { formatRelativeTimeCompact } from '@/lib/relative-time';
import { VIEWPORT_EDGE_MARGIN as EDGE_MARGIN } from '@/lib/clamp-to-viewport';

// Portal-rendered assigned-action panel (spec/68), anchored to the right
// edge of the element like CommentThreadPopover. Shows the action's name,
// description, assignee, and assigner + time, with Complete / Reopen,
// Edit, and Delete. Read-only sessions see the card without the mutating
// controls: an assignee following a share link should still find their
// action.

type ActionPopoverProps = {
  elementId: string;
  action: ElementAction;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  readOnly?: boolean;
  // The current user's Clerk id, for the "Assigned to you" accent.
  selfUserId: string | null;
};

const WIDTH = 288;
const GAP = 12;

export function ActionPopover({
  elementId,
  action,
  onComplete,
  onReopen,
  onEdit,
  onDelete,
  onClose,
  readOnly = false,
  selfUserId,
}: ActionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Two-step delete: the first click arms, the second confirms. Kept
  // inline (no nested dialog over a popover) and disarmed on reopen.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Anchor to the element's live rect, flipping left when there's no
  // room on the right — the CommentThreadPopover placement.
  useReposition(() => {
    const node = document.querySelector(`[data-element-id="${elementId}"]`);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    let left = rect.right + GAP;
    let top = rect.top;
    if (left + WIDTH > window.innerWidth - EDGE_MARGIN) {
      left = rect.left - GAP - WIDTH;
    }
    left = Math.max(EDGE_MARGIN, Math.min(left, window.innerWidth - WIDTH - EDGE_MARGIN));
    top = Math.max(EDGE_MARGIN, top);
    setPos({ left, top });
  }, [elementId]);

  // Don't close on a click landing on the element's action badge — that
  // is this popover's own toggle (parent state handles the flip-flop).
  useClickOutside(ref, onClose, true, '[data-action-trigger]');
  useEscape(onClose);

  if (!pos) return null;

  const done = action.status === 'done';
  const assigneeName = action.assignee.name?.trim() || 'Teammate';
  const mine = selfUserId !== null && action.assignee.userId === selfUserId;

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
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Action</h3>
          <div className="flex items-center gap-1">
            {done ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                Done
              </span>
            ) : null}
            <button
              type="button"
              aria-label="Close action"
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        </header>

        <div className={`px-3 py-2.5 ${done ? 'opacity-70' : ''}`}>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{action.name}</p>
          {action.description ? (
            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
              {action.description}
            </p>
          ) : null}
          <div className="mt-2.5 flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white"
            >
              {initialsOf(assigneeName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">
              {mine ? 'Assigned to you' : `Assigned to ${assigneeName}`}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-400">
            {action.assignerName?.trim() ? `By ${action.assignerName.trim()}, ` : ''}
            {formatRelativeTimeCompact(Date.now() - action.createdAt)}
          </p>
        </div>

        {!readOnly ? (
          <footer className="flex items-center gap-1.5 border-t border-slate-100 p-2 dark:border-slate-800">
            <button
              type="button"
              onClick={done ? onReopen : onComplete}
              className={
                done
                  ? 'rounded px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  : 'rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700'
              }
            >
              {done ? 'Reopen' : 'Complete'}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Edit
            </button>
            <span className="flex-1" />
            {confirmingDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-rose-700"
              >
                Confirm delete
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15"
              >
                Delete
              </button>
            )}
          </footer>
        ) : null}
      </div>
    </Portal>
  );
}
