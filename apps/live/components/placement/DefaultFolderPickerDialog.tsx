'use client';

import { useState } from 'react';
import { Button, useEscape } from '@livediagram/ui';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import {
  PlacementBrowser,
  parsePlacement,
  type PickerFolder,
} from '@/components/placement/PlacementBrowser';
import { defaultKeyEntry } from '@/lib/placement-defaults/default-key-entries';

// The default folder picker (docs/specs/013-workspace/default-folders.md "The default folder
// picker"): the shared placement browser in a dialog, for one key. The My documents root clears the
// default; a team's root cannot be a default, so with it selected the dialog says so and its button
// is unavailable. Opened by Settings' Change and the wizard's Change default.

export function DefaultFolderPickerDialog({
  entryKey,
  current,
  folders,
  teams,
  teamFolders,
  onCreateFolder,
  onPick,
  onClose,
}: {
  entryKey: PlacementDefaultKey;
  /** The key's current default as a placement value; 'unsorted' (the root) when none. */
  current: string;
  folders: PickerFolder[];
  teams: { id: string; name: string }[];
  teamFolders: Record<string, PickerFolder[]>;
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  /** The chosen folder, or null for the My documents root (clear the default). */
  onPick: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const [placement, setPlacement] = useState(current);
  useEscape(onClose, { capture: true, stopPropagation: true });
  const entry = defaultKeyEntry(entryKey);
  const { teamId, folderId } = parsePlacement(placement);
  const teamRoot = teamId !== null && folderId === null;
  const unchanged = placement === current;
  const commit = (value: string) => {
    const chosen = parsePlacement(value);
    if (value === current || (chosen.teamId && !chosen.folderId)) return;
    onPick(chosen.folderId);
    onClose();
  };
  const title = `Default folder for new ${entry.noun}`;
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={title}
      size="lg"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            New {entry.noun} you create without choosing a place are saved here.
          </p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center">
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PlacementBrowser
          placement={placement}
          onPlacement={setPlacement}
          onCommitPlacement={commit}
          folders={folders}
          teams={teams}
          teamFolders={teamFolders}
          onCreateFolder={onCreateFolder}
          layout="list"
        />
      </div>
      <div className="flex min-h-14 items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        {teamRoot ? (
          <p role="note" className="mr-auto text-xs text-slate-600 dark:text-slate-300">
            Choose a folder inside the team.
          </p>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={unchanged || teamRoot} onClick={() => commit(placement)}>
          {folderId === null && !teamRoot ? 'Use My documents' : 'Use this folder'}
        </Button>
      </div>
    </Dialog>
  );
}
