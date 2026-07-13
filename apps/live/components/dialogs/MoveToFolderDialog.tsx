'use client';

// Move-destination modal (spec/15 + spec/35): a Dialog shell around the
// shared PlacementBrowser, so moving a diagram (or re-parenting a folder)
// uses the exact same space -> folder tile browse as the New Diagram
// wizard's Save In step (spec/76). One selection UI everywhere a diagram
// can change folders.
//
// The browser keeps its "always something selected" rule: the picker opens
// with the subject's CURRENT placement highlighted, and the Move button
// stays disabled until the selection actually changes. Double-clicking a
// destination card selects and commits the move in one gesture (the same
// dblclick contract the wizard has).
//
// Generic by design: the caller supplies the folder nodes (already
// cycle-filtered for a folder move) and receives the pick — a
// `{ teamId, folderId }` destination — via `onPick`. Team-scoped surfaces
// (the team library) pass `teams` only and no `personalFolders`, which
// drops the personal space entirely and opens straight inside the team.

import { useState } from 'react';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import {
  PlacementBrowser,
  parsePlacement,
  placementValue,
  type PickerFolder,
} from '@/components/placement/PlacementBrowser';
import { useEscape } from '@/hooks/ui/useEscape';

// One folder in a tree. The caller passes a flat list; the browser
// rebuilds the hierarchy from `parentId`.
export type MoveFolderNode = PickerFolder;

// A team library destination: its root (= the team's Unsorted) plus
// its folder tree.
type MoveTeamDest = { id: string; name: string; folders: MoveFolderNode[] };

// Where the subject should move to. `teamId` null = the caller's
// personal library; `folderId` null = that scope's root / Unsorted.
export type MoveDestination = { teamId: string | null; folderId: string | null };

type MoveToFolderDialogProps = {
  // What's being moved, for the header ("Move "Roadmap 2026"").
  subjectName: string;
  // Tweaks the copy: a folder move re-parents, a diagram move files.
  subjectKind: 'diagram' | 'folder';
  // Personal folder nodes, pre-filtered by the caller (a folder move
  // excludes its own subtree). Omit entirely to hide the personal
  // space — team-scoped surfaces pass `teams` only.
  personalFolders?: MoveFolderNode[];
  // Team libraries (spec/35). Omitted / [] = no team spaces.
  teams?: MoveTeamDest[];
  // The subject's current placement: it opens pre-selected and the
  // Move button unlocks once the choice differs. teamId null +
  // folderId null = the personal root.
  currentTeamId?: string | null;
  currentFolderId?: string | null;
  // Inline folder creation (the "New Folder" tile): create in the
  // given scope and hand back the fresh folder (null on failure).
  // Absent = tile hidden.
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  onPick: (dest: MoveDestination) => void;
  onClose: () => void;
};

export function MoveToFolderDialog({
  subjectName,
  subjectKind,
  personalFolders,
  teams,
  currentTeamId = null,
  currentFolderId = null,
  onCreateFolder,
  onPick,
  onClose,
}: MoveToFolderDialogProps) {
  // Open on the subject's current home so the browser has a live
  // selection from the first paint (the "always something selected"
  // rule) and "no move" is visibly the default.
  const current = placementValue(currentTeamId, currentFolderId);
  const [placement, setPlacement] = useState(current);
  // Capture-phase Esc so this wins over the editor's global shortcuts; the
  // Dialog shell's own (bubble-phase) Esc is suppressed via closeOnEscape.
  useEscape(onClose, { capture: true, stopPropagation: true });

  const commit = (value: string) => {
    if (value === current) return;
    onPick(parsePlacement(value));
    onClose();
  };

  const teamList = (teams ?? []).map((t) => ({ id: t.id, name: t.name }));
  const teamFolders = Object.fromEntries((teams ?? []).map((t) => [t.id, t.folders]));

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Move to folder"
      size="lg"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            Move &ldquo;{subjectName}&rdquo;
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {subjectKind === 'folder'
              ? 'Pick the folder it should live inside.'
              : teamList.length > 0
                ? 'Pick a destination folder or team.'
                : 'Pick a destination folder.'}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PlacementBrowser
          placement={placement}
          onPlacement={setPlacement}
          onCommitPlacement={commit}
          folders={personalFolders ?? []}
          showPersonal={personalFolders !== undefined}
          teams={teamList}
          teamFolders={teamFolders}
          onCreateFolder={onCreateFolder}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={placement === current} onClick={() => commit(placement)}>
          Move here
        </Button>
      </div>
    </Dialog>
  );
}
