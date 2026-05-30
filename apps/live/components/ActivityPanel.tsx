'use client';

import type { ChangeLogEntry } from '@/lib/api-client';
import { formatRelativeTime, formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import type { SaveStatus } from './EditorHeader';
import { MovablePanel } from './MovablePanel';

type ActivityPanelProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  size: { width: number; height: number } | null;
  // True when the active tab is locked. Hides Revert buttons on rows
  // for the active tab (Undo/Redo are also disabled by the caller).
  // Locked-tab entries still render — the audit history stays
  // visible so the lock doesn't erase context.
  tabLocked: boolean;
  entries: ChangeLogEntry[];
  loading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRevert: (entry: ChangeLogEntry) => void;
  // Wipe every audit entry for the active tab. The diagram state is
  // untouched — only the log dies. Disabled when the list is empty
  // so the button doesn't no-op.
  onClearActivity: () => void;
  // Save state surfaced next to the panel title — moved out of the
  // footer so it sits with the related history information.
  saveStatus: SaveStatus;
  savedAt: number | null;
  onMoveTo: (x: number, y: number) => void;
  onResize: (size: { width: number; height: number }) => void;
  onToggleMinimized: () => void;
};

// Floating "Activity" panel — per-diagram audit of every edit, with a
// surgical Revert button on each row and the Undo / Redo controls
// docked at the top. Same shape language as Explorer / Palette so the
// editor's chrome stays consistent. See specs/12-activity-and-audit.md.
export function ActivityPanel({
  position,
  minimized,
  size,
  tabLocked,
  entries,
  loading,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRevert,
  onClearActivity,
  saveStatus,
  savedAt,
  onMoveTo,
  onResize,
  onToggleMinimized,
}: ActivityPanelProps) {
  if (minimized) return null;
  return (
    <MovablePanel
      title="Activity"
      position={position}
      defaultCorner="bottom-left"
      width="w-64"
      size={size}
      minWidth={240}
      minHeight={360}
      onResize={onResize}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
      headerExtra={<SaveStatusBadge status={saveStatus} savedAt={savedAt} />}
    >
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-1">
        {/* Undo / Redo bar lives at the top so the most common actions
            are the easiest to find. They drive the same local history
            stack as the old HistoryControls — moved here so the
            related concept (the audit log) and the related action
            (undo) live together. */}
        <div className="flex items-center gap-1">
          <UndoRedoButton
            label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
            icon={<UndoIcon />}
          />
          <UndoRedoButton
            label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
            icon={<RedoIcon />}
          />
        </div>

        <div className="h-px bg-slate-100" />

        {/* Entries area. Grows with the panel when the user resizes
            it; otherwise sticks at a baseline of ~8 entry rows so the
            panel stays a predictable size with a small log. Overflow
            always scrolls inside this area. */}
        <div className="scrollbar-slim flex-1 overflow-y-auto" style={{ minHeight: '18rem' }}>
          {loading ? (
            <ul className="flex flex-col gap-1" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5"
                  aria-hidden
                >
                  <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <span
                    className="h-3 animate-pulse rounded bg-slate-200"
                    style={{ width: `${80 - i * 10}%` }}
                  />
                </li>
              ))}
            </ul>
          ) : entries.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
              No edits yet — start drawing.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {entries.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  canRevert={!tabLocked}
                  onRevert={() => onRevert(entry)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={onClearActivity}
            disabled={entries.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition enabled:hover:border-rose-300 enabled:hover:bg-rose-50 enabled:hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            title="Delete every activity entry for this tab. The diagram itself is untouched."
          >
            <TrashIcon />
            Clear Activity
          </button>
        </div>
      </div>
    </MovablePanel>
  );
}

// Save-status badge that lived in the footer; the Activity panel
// title is its new home — same factual content, paired with the
// history it relates to.
function SaveStatusBadge({
  status,
  savedAt,
}: {
  status: SaveStatus;
  savedAt: number | null;
}) {
  useRelativeTimeTick();
  if (status === 'idle' && savedAt === null) return null;
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
      <span
        role="status"
        title="The editor couldn't save your latest changes. Check your network and the API."
        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-rose-700 ring-1 ring-rose-200"
      >
        <WarningIcon />
        Not saved
      </span>
    );
  }
  const relative = savedAt !== null ? formatRelativeTime(Date.now() - savedAt) : null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-slate-500">
      <CheckIcon />
      {relative ? `Saved ${relative}` : 'Saved'}
    </span>
  );
}

function SpinnerDot() {
  return (
    <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" />
  );
}

function CheckIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 5.5L4 7.5L8 3" />
    </svg>
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

function ActivityRow({
  entry,
  canRevert,
  onRevert,
}: {
  entry: ChangeLogEntry;
  canRevert: boolean;
  onRevert: () => void;
}) {
  // Re-render every 30s so the "2 min ago" string doesn't stick.
  useRelativeTimeTick();
  const relative = formatRelativeTimeShort(Date.now() - entry.createdAt);
  return (
    <li className="group relative flex items-start gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-50">
      <span
        aria-hidden
        style={{ backgroundColor: entry.participantColor }}
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        title={entry.participantName}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800">{entry.summary}</p>
        <p className="truncate text-[10px] text-slate-500">
          {entry.participantName} · {relative}
        </p>
      </div>
      {/* Floats over the row on hover so it never reserves layout
          space when idle. Icon-only; the title attribute is the
          tooltip. */}
      {entry.elementIds.length > 0 && canRevert ? (
        <button
          type="button"
          onClick={onRevert}
          className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 group-hover:flex focus:flex"
          title="Revert this change"
          aria-label={`Revert: ${entry.summary}`}
        >
          <RevertIcon />
        </button>
      ) : null}
    </li>
  );
}

function UndoRedoButton({
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
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

function UndoIcon() {
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

function RedoIcon() {
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
