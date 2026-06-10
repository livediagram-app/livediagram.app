'use client';

import type { ChangeLogEntry } from '@/lib/api-client';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import type { SaveStatus } from './EditorHeader';
import { TrashIcon } from './explorer-icons';
import { MovablePanel } from './MovablePanel';
import { Tooltip } from './Tooltip';

type ActivityPanelProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  // True when the active tab is locked. Hides Revert buttons on rows
  // for the active tab (Undo/Redo are also disabled by the caller).
  // Locked-tab entries still render — the audit history stays
  // visible so the lock doesn't erase context.
  tabLocked: boolean;
  entries: ChangeLogEntry[];
  loading: boolean;
  // View-role / read-only mode. Hides the Undo / Redo bar at the
  // top and the per-row Revert button. The entries stay visible
  // (visitors still benefit from seeing the change history) and
  // row clicks still jump to the affected element via onRowClick.
  readOnly?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRevert: (entry: ChangeLogEntry) => void;
  // Click anywhere on a row (outside the Revert button) — used by
  // the editor to jump to the related element or open the matching
  // accordion (e.g. a "Changed theme to X" entry pops the Theme
  // accordion in the Editor panel).
  onRowClick: (entry: ChangeLogEntry) => void;
  // Wipe every audit entry for the active tab. The diagram state is
  // untouched (only the log dies). Disabled when the list is empty
  // so the button doesn't no-op. Optional so view-role visitors can
  // open the panel (to see the trail of edits) without exposing a
  // destructive button they aren't allowed to use.
  onClearActivity?: () => void;
  // Save state surfaced next to the panel title — moved out of the
  // footer so it sits with the related history information.
  saveStatus: SaveStatus;
  savedAt: number | null;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  onToggleMinimized: () => void;
};

// Floating "Activity" panel — per-diagram audit of every edit, with a
// surgical Revert button on each row and the Undo / Redo controls
// docked at the top. Same shape language as Explorer / Palette so the
// editor's chrome stays consistent. See specs/12-activity-and-audit.md.
export function ActivityPanel({
  position,
  minimized,
  tabLocked,
  entries,
  loading,
  readOnly = false,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRevert,
  onRowClick,
  onClearActivity,
  saveStatus,
  savedAt,
  onMoveTo,
  onReset,
  onToggleMinimized,
}: ActivityPanelProps) {
  if (minimized) return null;
  return (
    <MovablePanel
      title="Tab Activity"
      position={position}
      defaultCorner="bottom-left"
      width="w-64"
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
      headerExtra={<SaveStatusBadge status={saveStatus} savedAt={savedAt} />}
    >
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-1">
        {/* Undo / Redo bar lives at the top so the most common actions
            are the easiest to find. They drive the same local history
            stack as the old HistoryControls (moved here so the
            related concept, the audit log, and the related action,
            undo, live together). Suppressed in view-role mode since
            visitors can't author edits to roll back. */}
        {readOnly ? null : (
          <>
            <div className="grid grid-cols-2 gap-1">
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

            <div className="h-px bg-slate-100 dark:bg-slate-800" />
          </>
        )}

        {/* Entries area sized to ~8 rows; anything beyond scrolls
            inside the area so the panel stays predictable on long
            histories. API caps the underlying list at 30. */}
        <div className="scrollbar-slim flex-1 overflow-y-auto" style={{ maxHeight: '18rem' }}>
          {loading ? (
            <ul className="flex flex-col gap-1" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5" aria-hidden>
                  <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <span
                    className="h-3 animate-pulse rounded bg-slate-200"
                    style={{ width: `${80 - i * 10}%` }}
                  />
                </li>
              ))}
            </ul>
          ) : entries.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              No edits yet. Start drawing.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {entries.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  canRevert={!tabLocked && !readOnly}
                  onRevert={() => onRevert(entry)}
                  onClick={() => onRowClick(entry)}
                />
              ))}
            </ul>
          )}
        </div>

        {onClearActivity ? (
          <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
            <Tooltip
              block
              title="Clear Activity"
              description="Delete every entry for this tab. The diagram is untouched."
            >
              <button
                type="button"
                onClick={onClearActivity}
                disabled={entries.length === 0}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition enabled:hover:border-rose-300 enabled:hover:bg-rose-50 enabled:hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <TrashIcon size={12} />
                Clear Activity
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </MovablePanel>
  );
}

// Save-status badge that lived in the footer; the Activity panel
// title is its new home — same factual content, paired with the
// history it relates to.
function SaveStatusBadge({ status }: { status: SaveStatus; savedAt: number | null }) {
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

function ActivityRow({
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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-400 dark:enabled:hover:bg-slate-700 dark:enabled:hover:text-brand-200"
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
