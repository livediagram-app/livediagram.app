'use client';

import { useState } from 'react';
import { DefaultFolderPickerDialog } from '@/components/placement/DefaultFolderPickerDialog';
import type { PickerFolder } from '@/components/placement/PlacementBrowser';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { defaultKeyEntry } from '@/lib/placement-defaults/default-key-entries';
import type { AlwaysSave, WizardDefault, WizardDefaults } from './useWizardPlacement';

// The Location step's default-folder line (docs/specs/013-workspace/default-folders.md "The New
// Document wizard"): either why the selection is what it is ("Whiteboards go to Workshops by
// default", with Change default), or the offer to make the selection the default ("Always save
// whiteboards here"). The two never show together, so they share one slot under the folder browser,
// reserved whenever the folder step shows: neither can push the browser as it appears.

export function WizardDefaultFolder({
  shown,
  offer,
  alwaysSave,
  onAlwaysSave,
  defaults,
  onDefaultChanged,
  folders,
  teams,
  teamFolders,
  onCreateFolder,
}: {
  shown: WizardDefault | null;
  offer: AlwaysSave | null;
  alwaysSave: boolean;
  onAlwaysSave: (on: boolean) => void;
  defaults: WizardDefaults | undefined;
  /** A new default was chosen through Change default. */
  onDefaultChanged: () => void;
  folders: PickerFolder[];
  teams: { id: string; name: string }[];
  teamFolders: Record<string, PickerFolder[]>;
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
}) {
  const [changing, setChanging] = useState(false);
  return (
    <div className="flex min-h-6 items-center text-xs text-slate-600 dark:text-slate-300">
      {shown ? (
        <p role="note" className="min-w-0">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {defaultKeyEntry(shown.key).label}
          </span>{' '}
          go to{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {shown.folderName}
          </span>{' '}
          by default.{' '}
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="rounded font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:focus-visible:outline-brand-400"
          >
            Change default
          </button>
        </p>
      ) : offer ? (
        <SwitchRow checked={alwaysSave} onChange={onAlwaysSave} className="text-sm">
          Always save {defaultKeyEntry(offer.key).noun} here
        </SwitchRow>
      ) : null}
      {changing && shown && defaults ? (
        <DefaultFolderPickerDialog
          entryKey={shown.key}
          current={defaults.currentValue(shown.key)}
          folders={folders}
          teams={teams}
          teamFolders={teamFolders}
          onCreateFolder={onCreateFolder}
          onPick={(folderId) => {
            void defaults.change(shown.key, folderId).then((ok) => {
              if (ok) onDefaultChanged();
            });
          }}
          onClose={() => setChanging(false)}
        />
      ) : null}
    </div>
  );
}
