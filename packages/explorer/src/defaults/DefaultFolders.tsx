'use client';

// Default Folders: one row per entry ("Plans", "Kanban plans"), saying where its new items go (a folder, My Work,
// or a default the reader can no longer reach and where they go instead), with Clear and Change. Change opens the
// default folder picker: the placement browser for one entry, where My Work's top clears the default and a team's
// top cannot be chosen (only a folder inside the team). The Explorer opens it as a dialog; a host's Settings page
// renders <DefaultFoldersSettings> with the same rows.

import { useMemo, useState } from 'react';
import type { App, Folder, IndexClient } from '@liveworkspace/index-client';
import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import { FolderOutlineIcon } from '../ui/icons';
import { ToastProvider, useToast } from '../ui/Toasts';
import {
  PlacementBrowser,
  parsePlacement,
  placementValue,
  type PickerFolder,
  type PickerTeam,
} from '../dialogs/PlacementBrowser';
import { useFolderStore } from '../data/useFolders';
import { useExplorer } from '../explorer/context';
import type { LensOption } from '../lens';
import type { TeamRef } from '../types';
import { kindWords } from '../words';
import { defaultEntries, destinationOf, type DefaultEntry } from './entries';
import { usePlacementDefaults, type PlacementDefaultsStore } from './usePlacementDefaults';

type Lists = {
  folders: readonly Folder[];
  byId: ReadonlyMap<string, Folder>;
  teams: readonly TeamRef[];
  createFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
};

const pick = (f: Folder): PickerFolder => ({ id: f.id, name: f.name, parentId: f.parentId });

export function DefaultFoldersList({
  entries,
  defaults,
  lists,
  loading = false,
}: {
  entries: readonly DefaultEntry[];
  defaults: PlacementDefaultsStore;
  lists: Lists;
  loading?: boolean;
}) {
  const [changing, setChanging] = useState<DefaultEntry | null>(null);
  const names = useMemo(() => new Map(lists.teams.map((t) => [t.id, t.name])), [lists.teams]);
  const teamName = (id: string | null) => (id ? (names.get(id) ?? 'Team') : null);
  if (defaults.status === 'failed') {
    return (
      <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
        Couldn’t load your default folders.
      </p>
    );
  }
  const ready = defaults.status === 'ready' && !loading;
  return (
    <>
      <ul
        data-default-folders=""
        className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
      >
        {entries.map((entry) => {
          const where = ready
            ? destinationOf(entry, entries, defaults.defaults, lists.byId, teamName)
            : null;
          const text = !where
            ? 'Loading…'
            : where.kind === 'root'
              ? 'My Work'
              : where.kind === 'folder'
                ? where.teamName
                  ? `${where.folder.name} · ${where.teamName}`
                  : where.folder.name
                : `A folder you can no longer reach, using ${where.fallback?.name ?? 'My Work'}`;
          return (
            <li
              key={entry.key}
              data-default-entry={entry.key}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {entry.label}
                </p>
                <p
                  data-default-destination=""
                  className={`flex items-center gap-1 truncate text-xs ${
                    where?.kind === 'unreachable'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {where && where.kind !== 'root' ? <FolderOutlineIcon size={11} /> : null}
                  <span className="truncate">{text}</span>
                </p>
              </div>
              {where && where.kind !== 'root' ? (
                <Button
                  variant="secondary"
                  size="xs"
                  aria-label={`Clear default folder for ${entry.noun}`}
                  onClick={() => void defaults.clear(entry.key)}
                >
                  Clear
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="xs"
                disabled={!where}
                aria-label={`Change default folder for ${entry.noun}`}
                onClick={() => setChanging(entry)}
              >
                Change
              </Button>
            </li>
          );
        })}
      </ul>
      {changing ? (
        <DefaultFolderPickerDialog
          entry={changing}
          current={defaults.defaults.get(changing.key) ?? null}
          lists={lists}
          onPick={(folderId) =>
            void (folderId ? defaults.set(changing.key, folderId) : defaults.clear(changing.key))
          }
          onClose={() => setChanging(null)}
        />
      ) : null}
    </>
  );
}

export function DefaultFolderPickerDialog({
  entry,
  current,
  lists,
  onPick,
  onClose,
}: {
  entry: DefaultEntry;
  // The entry's folder now; null for none (My Work).
  current: string | null;
  lists: Lists;
  // The chosen folder, or null for My Work (clear the default).
  onPick: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const currentFolder = current ? lists.byId.get(current) : undefined;
  const start = currentFolder
    ? placementValue(currentFolder.teamId, currentFolder.id)
    : current
      ? // A default out of reach: choosing My Work clears it, so it counts as a change.
        placementValue(null, current)
      : 'unsorted';
  const [placement, setPlacement] = useState(start);
  const personal = useMemo(
    () => lists.folders.filter((f) => f.teamId === null).map(pick),
    [lists.folders],
  );
  const teams = useMemo<PickerTeam[]>(
    () =>
      lists.teams.map((t) => ({
        id: t.id,
        name: t.name,
        folders: lists.folders.filter((f) => f.teamId === t.id).map(pick),
      })),
    [lists.teams, lists.folders],
  );
  const { teamId, folderId } = parsePlacement(placement);
  const teamTop = teamId !== null && folderId === null;
  const commit = (value: string) => {
    const chosen = parsePlacement(value);
    if (value === start || (chosen.teamId && !chosen.folderId)) return;
    onPick(chosen.folderId);
    onClose();
  };
  const title = `Default folder for new ${entry.noun}`;
  return (
    <Dialog onClose={onClose} ariaLabel={title} size="lg" className="max-h-[80vh]">
      <DialogHeader
        title={title}
        subtitle={`New ${entry.noun} you make without choosing a place are saved here.`}
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PlacementBrowser
          placement={placement}
          onPlacement={setPlacement}
          onCommitPlacement={commit}
          folders={personal}
          teams={teams}
          onCreateFolder={lists.createFolder}
        />
      </div>
      <DialogFooter>
        {teamTop ? (
          <p role="note" className="mr-auto text-xs text-slate-600 dark:text-slate-300">
            Choose a folder inside the team.
          </p>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={placement === start || teamTop}
          onClick={() => commit(placement)}
        >
          {folderId === null && !teamTop ? 'Use My Work' : 'Use This Folder'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Default Folders in the Explorer, as a dialog (from Use as Default for…). */
export function DefaultFoldersDialog({ onClose }: { onClose: () => void }) {
  const { folders, defaults, defaultEntries: entries, teams, kind } = useExplorer();
  const lists = useMemo<Lists>(
    () => ({
      folders: folders.folders,
      byId: folders.byId,
      teams,
      createFolder: async (name, parentId, teamId) => {
        const made = await folders.create({ name, parentId, teamId });
        return made ? pick(made) : null;
      },
    }),
    [folders, teams],
  );
  return (
    <Dialog onClose={onClose} ariaLabel="Default Folders" size="md">
      <DialogHeader
        title="Default Folders"
        subtitle={`Where new ${kind.lowerMany} go when you make one without choosing a place.`}
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="px-5 py-4">
        <DefaultFoldersList
          entries={entries}
          defaults={defaults}
          lists={lists}
          loading={folders.loading}
        />
      </div>
    </Dialog>
  );
}

export type DefaultFoldersSettingsProps = {
  client: IndexClient;
  app: App;
  // Teams the person has joined (their token's `teams` claim): their folders can be defaults.
  teams?: readonly TeamRef[];
  // The host's template families, each an entry of its own (the Explorer's `lensTemplates`).
  templates?: readonly LensOption[];
};

const NO_TEAMS: readonly TeamRef[] = [];
const NO_TEMPLATES: readonly LensOption[] = [];

/** Default Folders for a host's Settings page: the same rows, loading the folders and defaults itself. */
export function DefaultFoldersSettings(props: DefaultFoldersSettingsProps) {
  return (
    <ToastProvider>
      <DefaultFoldersSettingsInner {...props} />
    </ToastProvider>
  );
}

function DefaultFoldersSettingsInner({
  client,
  app,
  teams = NO_TEAMS,
  templates = NO_TEMPLATES,
}: DefaultFoldersSettingsProps) {
  const toast = useToast();
  const folders = useFolderStore(client, toast.error, NOOP);
  const defaults = usePlacementDefaults(client, toast.error);
  const entries = useMemo(() => defaultEntries(app, kindWords(app), templates), [app, templates]);
  const lists = useMemo<Lists>(
    () => ({
      folders: folders.folders,
      byId: folders.byId,
      teams,
      createFolder: async (name, parentId, teamId) => {
        const made = await folders.create({ name, parentId, teamId });
        return made ? pick(made) : null;
      },
    }),
    [folders, teams],
  );
  return (
    <DefaultFoldersList
      entries={entries}
      defaults={defaults}
      lists={lists}
      loading={folders.loading}
    />
  );
}

const NOOP = () => {};
