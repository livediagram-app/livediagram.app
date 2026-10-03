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
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsPlacementDefaultRowSpec } from './settings-catalogue';

// One row of Settings > Documents > Where New Documents Go
// (docs/specs/013-workspace/default-folders.md "Settings"): an entry, where its new documents go
// (a folder, My documents, or a dangling default and where they go instead), Change (the default
// folder picker) and Clear. Not a preference: it reads and writes the page's default-folders store.

export type SettingsPlacementLists = ReturnType<typeof usePlacementOptions>;

const BUTTON =
  'shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500/60';

/** Where new documents of this entry go, in words. */
export function destinationText(destination: DefaultDestination): string {
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
      // The label over where its documents go (a dangling default's line can be long), the
      // buttons beside them.
      wrapper={() => (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {row.label}
            </span>
            <span
              className={`text-xs ${
                dangling
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {text}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {destination ? (
              <>
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={`Change default folder for ${entry.noun}`}
                  onClick={() => setChanging(true)}
                >
                  Change
                </button>
                {destination.kind !== 'root' ? (
                  <button
                    type="button"
                    className={BUTTON}
                    aria-label={`Clear default folder for ${entry.noun}`}
                    onClick={() => void clearPlacementDefault(key, 'settings')}
                  >
                    Clear
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
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
        </div>
      )}
    />
  );
}
