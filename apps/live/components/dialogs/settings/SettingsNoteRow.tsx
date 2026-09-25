'use client';

import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsNoteRowSpec } from './settings-catalogue';

// A card with no control, standing in for settings the reader cannot use
// yet. Same shape as the signed-out API tokens row, so "you need an account
// for this" reads the same wherever it turns up.
export function SettingsNoteRow({ row }: { row: SettingsNoteRowSpec }) {
  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {row.label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{row.note}</span>
        </div>
      )}
    />
  );
}
