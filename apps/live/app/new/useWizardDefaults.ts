'use client';

import { useMemo } from 'react';
import { creationIntentOf, defaultKeysFor, type CreationIntent } from '@livediagram/api-schema';
import { templateFamilyOf, type TemplateKind } from '@livediagram/templates';
import { placementValue, type PickerFolder } from '@/components/placement/PlacementBrowser';
import type { AlwaysSave, WizardDefaults } from '@/components/palette/useWizardPlacement';
import { useDefaultFolderIndex } from '@/hooks/persistence/useDefaultFolderMenus';
import { usePlacementDefaults } from '@/hooks/persistence/usePlacementDefaults';
import { resolveDefaultFor, workingDefault } from '@/lib/placement-defaults/default-destination';
import {
  clearPlacementDefault,
  setPlacementDefault,
} from '@/lib/placement-defaults/placement-defaults-store';
import { buildTemplatedTab } from '@/lib/template-builders';

// The New Document wizard's view of the reader's default folders
// (docs/specs/013-workspace/default-folders.md "The New Document wizard"): per template, its
// creation intent (the first tab it builds, and its family), the default that intent resolves to
// over the folders the wizard has loaded, and the key Always save sets. Undefined until the
// defaults load: the wizard then shows the root and sends no placement, and the server decides.

const intents = new Map<TemplateKind, CreationIntent>();
function intentOf(kind: TemplateKind): CreationIntent {
  let intent = intents.get(kind);
  if (!intent) {
    intent = creationIntentOf(
      buildTemplatedTab(kind, 'brand', 'intent', 'Tab 1'),
      templateFamilyOf(kind),
    );
    intents.set(kind, intent);
  }
  return intent;
}

export function useWizardDefaults(
  ownerId: string | null,
  lists: {
    folders: PickerFolder[];
    teams: { id: string; name: string }[];
    teamFolders: Record<string, PickerFolder[]>;
  },
): WizardDefaults | undefined {
  const { status, defaults, ownerId: loaded } = usePlacementDefaults(ownerId);
  const index = useDefaultFolderIndex({
    personal: lists.folders,
    team: lists.teamFolders,
    teams: lists.teams,
  });
  return useMemo<WizardDefaults | undefined>(() => {
    if (status !== 'ready' || !ownerId || loaded !== ownerId) return undefined;
    return {
      resolve: (kind) => {
        const { resolved, skipped } = resolveDefaultFor(intentOf(kind), defaults, index);
        return {
          found: resolved
            ? {
                key: resolved.key,
                value: placementValue(resolved.folder.teamId, resolved.folder.id),
                folderName: resolved.folder.name,
              }
            : null,
          skipped,
        };
      },
      alwaysSaveKey: (kind) => defaultKeysFor(intentOf(kind))[0]!,
      currentValue: (key) => {
        const folder = workingDefault(key, defaults, index);
        return folder ? placementValue(folder.teamId, folder.id) : 'unsorted';
      },
      change: (key, folderId) =>
        folderId
          ? setPlacementDefault(key, folderId, 'wizard')
          : clearPlacementDefault(key, 'wizard'),
    };
  }, [status, ownerId, loaded, defaults, index]);
}

/** "Always save <these> here", written before the create: telemetry first (in the store), and a
 *  refusal logged there, never stopping the create. */
export async function applyAlwaysSave(alwaysSave: AlwaysSave | undefined): Promise<void> {
  if (!alwaysSave) return;
  const { key, folderId } = alwaysSave;
  await (folderId
    ? setPlacementDefault(key, folderId, 'wizard')
    : clearPlacementDefault(key, 'wizard'));
}
