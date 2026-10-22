'use client';

import { SETTINGS_ROW_BUTTON, SettingsRowShell } from './SettingsRowShell';
import type { SettingsLinkRowSpec } from './settings-catalogue';
import type { SettingsCategoryId } from './settings-icons';

// A way into another category of this dialog, opened in place
// (docs/specs/007-editor/user-preferences.md): never a page navigation.
export function SettingsLinkRow({
  row,
  onOpenCategory,
}: {
  row: SettingsLinkRowSpec;
  onOpenCategory?: (categoryId: SettingsCategoryId) => void;
}) {
  return (
    <SettingsRowShell
      row={row}
      control={
        onOpenCategory ? (
          <button
            type="button"
            onClick={() => onOpenCategory(row.target)}
            className={SETTINGS_ROW_BUTTON}
          >
            {row.cta}
          </button>
        ) : null
      }
    />
  );
}
