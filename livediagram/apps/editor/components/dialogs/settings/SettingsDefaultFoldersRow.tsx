'use client';

import { DefaultFoldersSettings } from '@liveworkspace/explorer';
import { DEFAULT_FOLDER_OPTIONS } from '@livediagram/api-schema';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useTokenTeams } from '@/lib/explorer-host';
import { trackOrganise } from '@/lib/explorer-organise';
import { CANVAS_TEMPLATE_FAMILIES } from '@/lib/canvas-template-families';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { SettingsRowShell } from '@liveworkspace/settings-ui';
import type { SettingsDefaultFoldersRowSpec } from './settings-catalogue';

// Settings › Canvases › Default Folders (docs/specs/013-workspace/default-folders.md "Settings"): where new canvases
// go when they are made without choosing a place, with Clear and Change. The shared Explorer draws the rows and keeps them on the index, per person and per app.
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
          templates={CANVAS_TEMPLATE_FAMILIES}
          options={DEFAULT_FOLDER_OPTIONS}
          onOrganise={trackOrganise}
        />
      </div>
    </SettingsRowShell>
  );
}
