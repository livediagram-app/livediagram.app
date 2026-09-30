'use client';

import { SettingsRowShell } from './SettingsRowShell';
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
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500/60"
          >
            {row.cta}
          </button>
        ) : null
      }
    />
  );
}
