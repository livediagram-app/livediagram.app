'use client';

import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsTrashRowSpec } from './settings-catalogue';
import { track } from '@/lib/telemetry';

// The way into the Trash (docs/specs/013-workspace/trash.md). A link rather
// than a list: the Trash view has the room for its groups and confirmations,
// and Settings only has to say it exists. For everyone, guests included.
export function SettingsTrashRow({ row }: { row: SettingsTrashRowSpec }) {
  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {row.label}
          </span>
          <a
            href="/explorer/trash"
            onClick={() => track('Trash', 'Opened', 'Settings')}
            aria-describedby={`${row.key}-description`}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-500/60"
          >
            Open Trash
          </a>
        </div>
      )}
    />
  );
}
