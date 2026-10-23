'use client';

// liveplanner's MoveToFolderDialog: "Move “<name>”", the placement browser, Cancel and Move Here. It takes
// plain folders and teams, so a host can use it without the rest of the Explorer.

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import {
  PlacementBrowser,
  parsePlacement,
  placementValue,
  type Destination,
  type PickerFolder,
  type PickerTeam,
} from './PlacementBrowser';

export type MoveToFolderDialogProps = {
  subjectName: string;
  subjectKind: 'item' | 'folder';
  // My Work's folders; omitted when My Work is not a destination.
  personalFolders?: PickerFolder[];
  // Teams the subject may move into, each with its folders (items only).
  teams?: PickerTeam[];
  currentTeamId?: string | null;
  currentFolderId?: string | null;
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  // New Team among the spaces (items only).
  onCreateTeam?: (name: string) => Promise<{ id: string; name: string } | null>;
  onPick: (dest: Destination) => void;
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
  onCreateTeam,
  onPick,
  onClose,
}: MoveToFolderDialogProps) {
  const current = placementValue(currentTeamId, currentFolderId);
  const [placement, setPlacement] = useState(current);
  const commit = (value: string) => {
    if (value === current) return;
    onPick(parsePlacement(value));
    onClose();
  };
  const teamList = teams ?? [];
  return (
    <Dialog onClose={onClose} ariaLabel="Move to folder" size="lg" className="max-h-[80vh]">
      <DialogHeader
        title={`Move “${subjectName}”`}
        subtitle={
          subjectKind === 'folder'
            ? 'Pick the folder it should live inside.'
            : teamList.length > 0 || onCreateTeam
              ? 'Pick a destination folder or team.'
              : 'Pick a destination folder.'
        }
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PlacementBrowser
          placement={placement}
          onPlacement={setPlacement}
          onCommitPlacement={commit}
          folders={personalFolders ?? []}
          showPersonal={personalFolders !== undefined}
          teams={teamList}
          onCreateFolder={onCreateFolder}
          onCreateTeam={onCreateTeam}
        />
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={placement === current} onClick={() => commit(placement)}>
          Move Here
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
