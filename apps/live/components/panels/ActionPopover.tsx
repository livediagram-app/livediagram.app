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

// Portal-rendered assigned-action card (spec/68), anchored to the right
// edge of the element like CommentThreadPopover. Name + description up
// top, one calm assignee/assigner meta row, and an icon-button footer:
// Complete (check) / Reopen (undo), Edit (pencil), Delete (bin, two-step
// confirm). Read-only sessions see the card without the footer — an
// assignee following a share link should still find their action.

type ActionPopoverProps = {
  elementId: string;
  action: ElementAction;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  readOnly?: boolean;
  // The current user's identity (Clerk id or guest participant id), for
  // the "Assigned to you" line.
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
  const assignerName = action.assignerName?.trim() || null;
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
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
            <span className="text-slate-400 dark:text-slate-500">
              <ClipboardIcon />
            </span>
            Action
          </h3>
          <div className="flex items-center gap-1">
            {done ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckIcon size={9} />
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

        <div className={`flex flex-col gap-2.5 px-3 py-3 ${done ? 'opacity-70' : ''}`}>
          <div>
            <p className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
              {action.name}
            </p>
            {action.description ? (
              <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {action.description}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white"
            >
              {initialsOf(assigneeName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {mine ? 'Assigned to you' : `Assigned to ${assigneeName}`}
              </span>
              <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
                {assignerName ? `by ${assignerName} · ` : ''}
                {formatRelativeTimeCompact(Date.now() - action.createdAt)}
              </span>
            </span>
          </div>
        </div>

        {!readOnly ? (
          <footer className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            {done ? (
              <FooterButton onClick={onReopen} icon={<ReopenIcon />} label="Reopen" />
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-emerald-700"
              >
                <CheckIcon size={11} />
                Complete
              </button>
            )}
            <FooterButton onClick={onEdit} icon={<PencilIcon />} label="Edit" />
            <span className="flex-1" />
            {confirmingDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-rose-700"
              >
                <TrashIcon />
                Confirm
              </button>
            ) : (
              <button
                type="button"
                aria-label="Delete action"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15"
              >
                <TrashIcon />
              </button>
            )}
          </footer>
        ) : null}
      </div>
    </Portal>
  );
}

function FooterButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {icon}
      {label}
    </button>
  );
}

function CheckIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8.5 6.5 12.5 13.5 4" />
    </svg>
  );
}

function ReopenIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 6.5A6 6 0 1 1 2 9.5" />
      <path d="M2.5 2.5v4h4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-2.75.75L3 11z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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

// Clipboard-with-tick glyph, matching the element badge + menu tile.
function ClipboardIcon() {
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
      <path d="M6 3h-1.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H10" />
      <rect x="6" y="1.75" width="4" height="2.5" rx="0.75" />
      <path d="M5.75 9.25 7.5 11l3-3.5" />
    </svg>
  );
}
