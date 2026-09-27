'use client';

import { useId } from 'react';
import { SettingsRowShell } from './SettingsRowShell';
import { presetSummaryLines } from './power-user-preset-rows';
import type { SettingsPresetSummaryRowSpec } from './settings-catalogue';
import type { SettingsCategoryId } from './settings-icons';
import type { UserPreferences } from '@/lib/user-preferences';

// "Set By Power User Mode" (docs/specs/007-editor/power-user-mode.md#in-settings): what the preset
// set, each value live from its own row, and whether switching off would put
// it back. Changing one happens in its row; "Change" goes there.
export function SettingsPresetSummaryRow({
  row,
  settings,
  offered,
  onGoToRow,
}: {
  row: SettingsPresetSummaryRowSpec;
  settings: UserPreferences;
  // Row keys offered in the dialog right now; others show without "Change".
  offered?: ReadonlySet<string>;
  onGoToRow?: (categoryId: SettingsCategoryId, rowKey: string) => void;
}) {
  const titleId = useId();
  const lines = presetSummaryLines(settings, offered ?? new Set(presetKeys(settings)));
  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <span id={titleId} className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {row.label}
          </span>
          <ul
            aria-labelledby={titleId}
            className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700"
          >
            {lines.map((line) => (
              <li key={line.setting} className="flex items-center gap-3 py-1.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs text-slate-700 dark:text-slate-200">
                    {line.label}: <span className="font-semibold">{line.value}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {' '}
                      · {line.categoryLabel}
                    </span>
                  </span>
                  {line.restorable ? (
                    <span
                      className={
                        line.changed
                          ? 'text-[11px] text-amber-700 dark:text-amber-300'
                          : 'text-[11px] text-slate-500 dark:text-slate-400'
                      }
                    >
                      {line.changed
                        ? 'Changed: kept when you switch off'
                        : 'Restored when you switch off'}
                    </span>
                  ) : null}
                </div>
                {line.reachable && onGoToRow ? (
                  <button
                    type="button"
                    onClick={() => onGoToRow(line.categoryId, line.rowKey)}
                    aria-label={`Change ${line.label} in ${line.categoryLabel}`}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
                  >
                    Change
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    />
  );
}

// Without an explicit list, every summarised row counts as offered.
function presetKeys(settings: UserPreferences): string[] {
  return presetSummaryLines(settings, new Set()).map((l) => l.rowKey);
}
