'use client';

import { DefaultFoldersSettings } from '@liveworkspace/explorer';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useTokenTeams } from '@/lib/explorer-host';
import { indexClient } from '@/lib/index-client';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsDefaultFoldersRowSpec } from './settings-catalogue';

// Settings › Documents › Default Folders (docs/specs/013-workspace/default-folders.md "Settings"): where new documents
// go when they are made without choosing a place, with Clear and Change. The shared Explorer draws the rows and keeps them on the index, per person and per app.
export function SettingsDefaultFoldersRow({ row }: { row: SettingsDefaultFoldersRowSpec }) {
  const { isSignedIn } = useAccountBootstrap();
  const teams = useTokenTeams(isSignedIn);
  return (
    <SettingsRowShell row={row}>
      <div className="mt-2">
        <DefaultFoldersSettings
          client={indexClient}
          app="livedocuments"
          teams={teams}
        />
      </div>
    </SettingsRowShell>
  );
}
