import { useRef } from 'react';
import type { TabTimer, TabVote, TimerMode } from '@livediagram/diagram';

import { PortalMenu } from './TabPortalMenu';
import type { CanvasMenuActions } from './TabBar';

// The tab-bar ⋯ button: toggles the unified tab / canvas PortalMenu anchored
// to itself. Extracted from TabBar.tsx. Pure prop-based component.
export function EllipsisMenuButton({
  open,
  onToggle,
  onClose,
  canvas,
  canDelete,
  canClearContent,
  locked,
  otherDiagrams,
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onRename,
  onDuplicate,
  onClearContent,
  onImport,
  onExport,
  onCopyTo,
  onToggleLock,
  onDelete,
  selfId,
  timer,
  vote,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
  onStartVote,
  onEndVote,
  onRevealVote,
  onClearVote,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  // The active tab's canvas actions (theme / background / add element). Passed
  // so the tab ellipsis menu renders the SAME Canvas + Add sections as the
  // canvas right-click menu, i.e. one unified menu rather than two.
  canvas?: CanvasMenuActions;
  canDelete: boolean;
  canClearContent: boolean;
  locked: boolean;
  // Viewer identity, forwarded to the menu's Add to Diagram thumbnails.
  selfId: string;
  otherDiagrams: { id: string; name: string; savedAt?: number }[];
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  onExport: () => void;
  onCopyTo: (targetDiagramId: string) => void;
  onToggleLock: () => void;
  onDelete: () => void;
  // Session tools (spec/39) for this (active) tab's Session category.
  timer: TabTimer | null;
  vote: TabVote | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-label="Tab menu"
        aria-expanded={open}
        data-tour-id="tab-menu-trigger"
        className="flex h-6 w-6 items-center justify-center rounded text-current/70 transition hover:bg-white/40 hover:text-current"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="3" cy="7" r="1.25" fill="currentColor" />
          <circle cx="7" cy="7" r="1.25" fill="currentColor" />
          <circle cx="11" cy="7" r="1.25" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <PortalMenu
          anchor={buttonRef.current}
          onClose={onClose}
          canvas={canvas}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onClearContent={onClearContent}
          onImport={onImport}
          onExport={onExport}
          onCopyTo={onCopyTo}
          onToggleLock={onToggleLock}
          locked={locked}
          selfId={selfId}
          otherDiagrams={otherDiagrams}
          folderNames={folderNames}
          currentFolder={currentFolder}
          onMoveToFolder={onMoveToFolder}
          onRemoveFromFolder={onRemoveFromFolder}
          onDelete={onDelete}
          canDelete={canDelete}
          canClearContent={canClearContent}
          timer={timer}
          vote={vote}
          onStartTimer={onStartTimer}
          onPauseTimer={onPauseTimer}
          onResumeTimer={onResumeTimer}
          onResetTimer={onResetTimer}
          onClearTimer={onClearTimer}
          onStartVote={onStartVote}
          onEndVote={onEndVote}
          onRevealVote={onRevealVote}
          onClearVote={onClearVote}
        />
      ) : null}
    </div>
  );
}
