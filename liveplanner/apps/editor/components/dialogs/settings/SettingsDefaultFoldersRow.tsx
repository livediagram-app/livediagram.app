'use client';

import { DefaultFoldersSettings } from '@liveworkspace/explorer';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useTokenTeams } from '@/lib/explorer-host';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { trackOrganise } from '@/lib/explorer-organise';
import { PLAN_TEMPLATE_FAMILIES } from '@/lib/plan-template-families';
import { SettingsRowShell } from '@liveworkspace/settings-ui';
import type { SettingsDefaultFoldersRowSpec } from './settings-catalogue';

// Settings › Plans › Default Folders (docs/specs/013-workspace/default-folders.md "Settings"): where new plans go
// when they are made without choosing a place, one entry for plans and one per template family, each with Clear
// and Change. The shared Explorer draws the rows and keeps them on the index, per person and per app.
export function SettingsDefaultFoldersRow({ row }: { row: SettingsDefaultFoldersRowSpec }) {
  const { isSignedIn } = useAccountBootstrap();
  const teams = useTokenTeams(isSignedIn);
  return (
    <SettingsRowShell row={row}>
      <div className="mt-2">
        <DefaultFoldersSettings
          client={indexClient}
          app="liveplanner"
          teams={teams}
          templates={PLAN_TEMPLATE_FAMILIES}
          onOrganise={trackOrganise}
        />
      </div>
    </SettingsRowShell>
  );
}
