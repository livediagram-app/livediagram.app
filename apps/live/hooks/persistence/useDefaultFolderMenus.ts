'use client';

import { useEffect, useMemo } from 'react';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import {
  buildDefaultFolderIndex,
  workingDefault,
  type DefaultFolderIndex,
  type TeamFolderLists,
} from '@/lib/placement-defaults/default-destination';
import { rememberDefaultFolders } from '@/lib/placement-defaults/default-folder-names';
import {
  clearPlacementDefault,
  setPlacementDefault,
} from '@/lib/placement-defaults/placement-defaults-store';
import { usePlacementDefaults } from './usePlacementDefaults';

// The "Use as default for" submenu's data (docs/specs/013-workspace/default-folders.md "Use as
// default for"; blueprint "Menus"): for a folder, an entry is checked when the folder holds that
// key; for My documents, when the key has no working default. Undefined until the defaults load,
// so a menu opened early shows no submenu rather than wrong checks.

export type DefaultFolderMenu = {
  isChecked: (key: PlacementDefaultKey) => boolean;
  isDisabled: (key: PlacementDefaultKey) => boolean;
  toggle: (key: PlacementDefaultKey) => void;
};

export type DefaultFolderMenus = {
  forFolder: (folder: { id: string; teamId?: string | null }) => DefaultFolderMenu | undefined;
  forRoot: DefaultFolderMenu | undefined;
};

const never = () => false;

/** The folders a surface lists: its own folders, its team folders, the teams it has joined. */
export type DefaultFolderLists = {
  personal: readonly { id: string; name: string; parentId: string | null }[];
  team: TeamFolderLists;
  teams: readonly { id: string; name: string }[];
};

export function useDefaultFolderIndex({
  personal,
  team,
  teams,
}: DefaultFolderLists): DefaultFolderIndex {
  return useMemo(() => buildDefaultFolderIndex(personal, team, teams), [personal, team, teams]);
}

export function useDefaultFolderMenus(
  ownerId: string | null | undefined,
  lists: DefaultFolderLists,
): DefaultFolderMenus {
  const index = useDefaultFolderIndex(lists);
  const { status, defaults, ownerId: loadedOwner } = usePlacementDefaults(ownerId);
  const ready = status === 'ready' && !!ownerId && loadedOwner === ownerId;

  // Note the names of visible default folders, so Settings can name one once it is deleted.
  useEffect(() => {
    if (ready && ownerId) rememberDefaultFolders(ownerId, defaults, index);
  }, [ready, ownerId, defaults, index]);

  return useMemo<DefaultFolderMenus>(() => {
    if (!ready) return { forFolder: () => undefined, forRoot: undefined };
    const rootHolds = (key: PlacementDefaultKey) => workingDefault(key, defaults, index) === null;
    return {
      forFolder: (folder) => {
        // A team folder only for a member of a team the reader has joined.
        if (folder.teamId && !index.teams.has(folder.teamId)) return undefined;
        return {
          isChecked: (key) => defaults.get(key) === folder.id,
          isDisabled: never,
          toggle: (key) =>
            void (defaults.get(key) === folder.id
              ? clearPlacementDefault(key, 'menu')
              : setPlacementDefault(key, folder.id, 'menu')),
        };
      },
      forRoot: {
        isChecked: rootHolds,
        isDisabled: rootHolds,
        toggle: (key) => {
          if (!rootHolds(key)) void clearPlacementDefault(key, 'menu');
        },
      },
    };
  }, [ready, defaults, index]);
}
