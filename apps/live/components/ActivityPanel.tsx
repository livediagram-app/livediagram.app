'use client';

import type { ChangeLogEntry } from '@/lib/api-client';
import { MovablePanel } from './MovablePanel';

type ActivityPanelProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  entries: ChangeLogEntry[];
  loading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRevert: (entry: ChangeLogEntry) => void;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
};

// Floating "Activity" panel — per-diagram audit of every edit, with a
// surgical Revert button on each row and the Undo / Redo controls
// docked at the top. Same shape language as Explorer / Palette so the
// editor's chrome stays consistent. See specs/12-activity-and-audit.md.
export function ActivityPanel({
  position,
  minimized,
  entries,
  loading,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRevert,
  onMoveTo,
  onToggleMinimized,
}: ActivityPanelProps) {
  if (minimized) return null;
  return (
    <MovablePanel
      title="Activity"
      position={position}
      defaultCorner="top-left"
      width="w-72"
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
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
          <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} onRevert={() => onRevert(entry)} />
            ))}
          </ul>
        )}
      </div>
    </MovablePanel>
  );
}

function ActivityRow({
  entry,
  onRevert,
}: {
  entry: ChangeLogEntry;
  onRevert: () => void;
}) {
  const relative = formatRelativeTime(Date.now() - entry.createdAt);
  return (
    <li className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-50">
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
      <button
        type="button"
        onClick={onRevert}
        className="opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        title="Revert this change"
        aria-label={`Revert: ${entry.summary}`}
      >
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700">
          <RevertIcon />
          Revert
        </span>
      </button>
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

// Hand-rolled relative-time formatter. Shared with the SaveStatus pill
// in TabBar — kept inline here to avoid a one-line helper file.
function formatRelativeTime(deltaMs: number): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
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
      <path d="M3 6h14M3 10h14M3 14h9" />
    </svg>
  );
}
