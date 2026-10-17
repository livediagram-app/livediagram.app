'use client';

import { useState } from 'react';
import { DefaultFolderPickerDialog } from '@/components/placement/DefaultFolderPickerDialog';
import { placementValue } from '@/components/placement/PlacementBrowser';
import { useDefaultFolderIndex } from '@/hooks/persistence/useDefaultFolderMenus';
import type { usePlacementOptions } from '@/hooks/persistence/usePlacementOptions';
import { usePlacementDefaultsState } from '@/hooks/persistence/usePlacementDefaults';
import {
  destinationOf,
  type DefaultDestination,
} from '@/lib/placement-defaults/default-destination';
import { rememberedDefaultFolder } from '@/lib/placement-defaults/default-folder-names';
import { defaultKeyEntry } from '@/lib/placement-defaults/default-key-entries';
import {
  clearPlacementDefault,
  setPlacementDefault,
} from '@/lib/placement-defaults/placement-defaults-store';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from './SettingsRowShell';
import type { SettingsPlacementDefaultRowSpec } from './settings-catalogue';

// One row of Settings > Documents > Default Folders
// (docs/specs/013-workspace/default-folders.md "Settings"): an entry, where its new documents go
// (a folder, My documents, or a dangling default and where they go instead), Clear and Change (the
// default folder picker). Not a preference: it reads and writes the page's default-folders store.

export type SettingsPlacementLists = ReturnType<typeof usePlacementOptions>;

/** Where new documents of this entry go, in words. */
function destinationText(destination: DefaultDestination): string {
  switch (destination.kind) {
    case 'root':
      return 'My documents';
    case 'folder':
      return destination.teamName
        ? `${destination.folder.name} · ${destination.teamName}`
        : destination.folder.name;
    case 'dangling': {
      const instead = destination.fallback?.name ?? 'My documents';
      if (destination.name === null) return `A deleted folder, using ${instead}`;
      const why = destination.reason === 'deleted' ? 'deleted' : 'no longer available';
      return `${destination.name} (${why}), using ${instead}`;
    }
  }
}

export function SettingsPlacementDefaultRow({
  row,
  lists,
}: {
  row: SettingsPlacementDefaultRowSpec;
  lists: SettingsPlacementLists;
}) {
  const { status, defaults, ownerId } = usePlacementDefaultsState();
  const index = useDefaultFolderIndex({
    personal: lists.folders,
    team: lists.teamFolders,
    teams: lists.teams,
  });
  const [changing, setChanging] = useState(false);
  const key = row.placementKey;
  const entry = defaultKeyEntry(key);
  const failed = status === 'failed' || lists.failed;
  const ready = status === 'ready' && lists.ready;
  const destination = ready
    ? destinationOf(key, defaults, index, (id) =>
        ownerId ? rememberedDefaultFolder(ownerId, id) : null,
      )
    : null;
  const text = failed
    ? "Couldn't load your default folders"
    : destination
      ? destinationText(destination)
      : 'Loading…';
  const dangling = destination?.kind === 'dangling';
  // A dangling default names its lost folder, so choosing the root (a clear) counts as a change.
  const current =
    destination?.kind === 'folder'
      ? placementValue(destination.folder.teamId, destination.folder.id)
      : destination?.kind === 'dangling'
        ? placementValue(null, destination.folderId)
        : 'unsorted';
  return (
    <SettingsRowShell
      row={row}
      // Where its documents go IS the row's description: the shared explanation sits once, under
      // the section's heading.
      descriptionContent={
        <span
          data-default-destination
          className={dangling ? 'text-amber-700 dark:text-amber-300' : undefined}
        >
          {destination?.kind === 'folder' || destination?.kind === 'dangling' ? (
            <FolderMark />
          ) : null}
          {text}
        </span>
      }
      control={
        destination ? (
          <>
            {destination.kind !== 'root' ? (
              <button
                type="button"
                className={SETTINGS_ROW_BUTTON}
                aria-label={`Clear default folder for ${entry.noun}`}
                onClick={() => void clearPlacementDefault(key, 'settings')}
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              className={SETTINGS_ROW_BUTTON}
              aria-label={`Change default folder for ${entry.noun}`}
              onClick={() => setChanging(true)}
            >
              Change
            </button>
          </>
        ) : null
      }
    >
      {changing ? (
        <DefaultFolderPickerDialog
          entryKey={key}
          current={current}
          folders={lists.folders}
          teams={lists.teams}
          teamFolders={lists.teamFolders}
          onCreateFolder={lists.createPickerFolder}
          onPick={(folderId) =>
            void (folderId
              ? setPlacementDefault(key, folderId, 'settings')
              : clearPlacementDefault(key, 'settings'))
          }
          onClose={() => setChanging(false)}
        />
      ) : null}
    </SettingsRowShell>
  );
}

// A small folder before a chosen folder's name, so a default that is set reads apart from one
// that is not (My documents) at a glance.
function FolderMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mr-1 inline-block h-3 w-3 -translate-y-px fill-none stroke-current"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.3 1.5h5.1A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z" />
    </svg>
  );
}
