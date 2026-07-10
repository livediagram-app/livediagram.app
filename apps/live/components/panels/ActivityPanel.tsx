'use client';

import { memo } from 'react';
import type { ChangeLogEntry } from '@/lib/api-client';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { ActivitySettingsPopover } from '@/components/panels/ActivitySettingsPopover';
import { TrashIcon } from '@/components/panels/explorer-icons';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  ActivityRow,
  RedoIcon,
  SaveStatusBadge,
  UndoIcon,
  UndoRedoButton,
} from './activity-panel-parts';

// The row / badge / button parts and their icons moved to
// activity-panel-parts.tsx; the icons CanvasChrome consumes are
// re-exported so its import path keeps working.
export { ActivityIcon, RedoIcon, UndoIcon } from './activity-panel-parts';

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
  // Hover-to-preview a row's revert (spec/12): pointer enter shows the
  // entry's `before` state live on the canvas, leave restores. Only
  // fired for rows whose Revert button is available.
  onPreviewRevert: (entry: ChangeLogEntry) => void;
  onClearRevertPreview: () => void;
  // The revert hover-preview preference (spec/12), flipped from the
  // header gear. False stops rows previewing; the Revert button is
  // unaffected. The setter persists the flag (user-preferences).
  revertHoverPreview: boolean;
  onSetRevertHoverPreview: (value: boolean) => void;
  // True when the panel has been moved / docked away from its default
  // spot, enabling the gear's Reset-position row.
  resettable: boolean;
  // Click anywhere on a row (outside the Revert button) — used by
  // the editor to jump to the related element (tab-meta entries like
  // "Changed theme to X" just clear the selection).
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
  // Corner-docking bundle (spec/63), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
};

// Floating "Activity" panel — per-diagram audit of every edit, with a
// surgical Revert button on each row and the Undo / Redo controls
// docked at the top. Same shape language as Explorer / Palette so the
// editor's chrome stays consistent. See specs/12-activity-and-audit.md.
function ActivityPanelImpl({
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
  onPreviewRevert,
  onClearRevertPreview,
  revertHoverPreview,
  onSetRevertHoverPreview,
  resettable,
  onRowClick,
  onClearActivity,
  saveStatus,
  savedAt,
  onMoveTo,
  onReset,
  onToggleMinimized,
  dock,
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
      {...dock}
      onMinimize={onToggleMinimized}
      headerExtra={<SaveStatusBadge status={saveStatus} savedAt={savedAt} />}
      headerActions={
        <ActivitySettingsPopover
          revertHoverPreview={revertHoverPreview}
          onSetRevertHoverPreview={onSetRevertHoverPreview}
          onResetPosition={onReset}
          resettable={resettable}
        />
      }
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
                  onHoverStart={() => {
                    if (revertHoverPreview) onPreviewRevert(entry);
                  }}
                  onHoverEnd={onClearRevertPreview}
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
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition enabled:hover:border-rose-300 enabled:hover:bg-rose-50 enabled:hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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

export const ActivityPanel = memo(ActivityPanelImpl);
