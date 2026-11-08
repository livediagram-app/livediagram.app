'use client';

import { DefaultFoldersSettings } from '@liveworkspace/explorer';
import { DEFAULT_FOLDER_OPTIONS } from '@livediagram/api-schema';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useTokenTeams } from '@/lib/explorer-host';
import { trackOrganise } from '@/lib/explorer-organise';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { SettingsRowShell } from '@liveworkspace/settings-ui';
import type { SettingsDefaultFoldersRowSpec } from './settings-catalogue';

// Settings › Explorer › Default Folders (docs/specs/013-workspace/default-folders.md "Surfaces"): where new canvases
// go when they are made without choosing a place, one row per mode (Diagrams, Drawings, Workshops), with Clear and
// Change. The shared Explorer draws the rows and keeps them on the index, per person and per app.
export function SettingsDefaultFoldersRow({ row }: { row: SettingsDefaultFoldersRowSpec }) {
  const { isSignedIn } = useAccountBootstrap();
  const teams = useTokenTeams(isSignedIn);
  return (
    <SettingsRowShell row={row}>
      <div className="mt-2">
        <DefaultFoldersSettings
          client={indexClient}
          app="livediagram"
          teams={teams}
          options={DEFAULT_FOLDER_OPTIONS}
          onOrganise={trackOrganise}
        />
      </div>
    </SettingsRowShell>
  );
}
