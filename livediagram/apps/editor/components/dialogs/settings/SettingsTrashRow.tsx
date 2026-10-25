'use client';

import { SETTINGS_ROW_BUTTON, SettingsRowShell } from '@liveworkspace/settings-ui';
import type { SettingsTrashRowSpec } from './settings-catalogue';
import { track } from '@/lib/telemetry';
import { explorerHref } from '@/lib/explorer-href';

// The way into the Trash (docs/specs/013-workspace/trash.md). A link rather
// than a list: the Trash view has the room for its groups and confirmations,
// and Settings only has to say it exists. For everyone, guests included.
export function SettingsTrashRow({ row }: { row: SettingsTrashRowSpec }) {
  return (
    <SettingsRowShell
      row={row}
      control={
        <a
          href={explorerHref('trash')}
          onClick={() => track('Trash', 'Opened', 'Settings')}
          aria-describedby={`${row.key}-description`}
          className={SETTINGS_ROW_BUTTON}
        >
          Open Trash
        </a>
      }
    />
  );
}
