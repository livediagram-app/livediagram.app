'use client';

// The Activity panel's parts (spec/12), split out of ActivityPanel:
// the save-status badge, the per-entry row with its hover Revert, the
// Undo / Redo button, and the icon set (Undo / Redo re-used by
// CanvasChrome's dock, plus the history ActivityIcon).

import type { ChangeLogEntry } from '@/lib/api-client';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { Tooltip } from '@/components/primitives/Tooltip';

// Save-status badge that lived in the footer; the Activity panel
// title is its new home — same factual content, paired with the
// history it relates to.
export function SaveStatusBadge({ status }: { status: SaveStatus; savedAt: number | null }) {
  // The "saved N ago" success state lives on the Explorer's Current
  // Diagram row now — no need to duplicate it here. We still surface
  // in-flight + error states because the Explorer doesn't carry
  // those signals, and silent save failures are precisely what we
  // want a visible warning for.
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-slate-400">
        <SpinnerDot />
        Saving…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <Tooltip title="Not saved" description="Couldn't save. Check your network.">
        <span
          role="status"
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-rose-700 ring-1 ring-rose-200"
        >
          <WarningIcon />
          Not saved
        </span>
      </Tooltip>
    );
  }
  return null;
}

function SpinnerDot() {
  return (
    <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" />
  );
}

function WarningIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 1.5l3.7 6.5H1.3z" />
      <path d="M5 4.2v2" />
      <circle cx="5" cy="7.3" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ActivityRow({
  entry,
  canRevert,
  onRevert,
  onClick,
}: {
  entry: ChangeLogEntry;
  canRevert: boolean;
  onRevert: () => void;
  onClick: () => void;
}) {
  // Re-render every 30s so the "2 min ago" string doesn't stick.
  useRelativeTimeTick();
  const relative = formatRelativeTimeShort(Date.now() - entry.createdAt);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <Tooltip title={entry.participantName} description="Made this change.">
          <span
            aria-hidden
            style={{ backgroundColor: entry.participantColor }}
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          />
        </Tooltip>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
            {entry.summary}
          </p>
          <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
            {entry.participantName} · {relative}
          </p>
        </div>
      </button>
      {/* Floats over the row on hover so it never reserves layout
          space when idle. The outer absolute wrapper carries the
          positioning + visibility — that way the inner Tooltip
          anchors to the actual button (its wrapping span tracks
          the button's bounding box), instead of a 0-size sibling
          which left the tooltip card drifting up to the row's
          top-left when the button was absolutely positioned
          itself. stopPropagation so clicking Revert doesn't ALSO
          fire the row click handler. Anchored to the row's top
          rather than vertically centred so the button sits beside
          the summary line on the now-taller two-line rows. */}
      {entry.elementIds.length > 0 && canRevert ? (
        <div className="absolute right-1.5 top-1.5 hidden group-hover:block group-focus-within:block">
          <Tooltip title="Revert" description={`Undo this change: ${entry.summary}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRevert();
              }}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              aria-label={`Revert: ${entry.summary}`}
            >
              <RevertIcon />
            </button>
          </Tooltip>
        </div>
      ) : null}
    </li>
  );
}

export function UndoRedoButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip
      title={label}
      description={disabled ? 'Nothing to apply.' : 'Step through history.'}
      block
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-400 dark:enabled:hover:bg-slate-700 dark:enabled:hover:text-brand-200"
      >
        {icon}
        {label}
      </button>
    </Tooltip>
  );
}

export function UndoIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 6.5h6.75A3.25 3.25 0 0 1 13.5 9.75v0a3.25 3.25 0 0 1-3.25 3.25H6" />
      <path d="M6 3.5L3 6.5L6 9.5" />
    </svg>
  );
}

export function RedoIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.5 6.5H5.75A3.25 3.25 0 0 0 2.5 9.75v0A3.25 3.25 0 0 0 5.75 13H10" />
      <path d="M10 3.5L13 6.5L10 9.5" />
    </svg>
  );
}

function RevertIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 5h6.25A2.25 2.25 0 0 1 11 7.25v0A2.25 2.25 0 0 1 8.75 9.5H5" />
      <path d="M4.5 2.5L2 5L4.5 7.5" />
    </svg>
  );
}

// Clock-with-counter-clockwise-arrow — the universal "history" icon.
// Lines up with the Activity panel's role as the editorial timeline.
export function ActivityIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 6.5A6.5 6.5 0 1 1 3 10.5" />
      <path d="M3 3.5V6.5H6" />
      <path d="M10 6.5V10.5L12.75 12" />
    </svg>
  );
}
