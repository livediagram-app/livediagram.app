'use client';

import { readSkipLocationStep, turnOffSkipLocationStep } from '@/lib/skip-location-step';
import type { UserPreferences } from '@/lib/user-preferences';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsSkipLocationRowSpec } from './settings-catalogue';
import { PLACEMENT_ROW_BUTTON } from './SettingsPlacementDefaultRow';

// Settings > Documents > Where New Documents Go > Skip the Location Step
// (docs/specs/013-workspace/default-folders.md "Settings"): where every new document is saved while
// the New Document wizard skips its Location step, with Turn Off; or that it is off. The same card
// as the default folder rows beneath it.
export function SettingsSkipLocationRow({
  row,
  settings,
  onChange,
}: {
  row: SettingsSkipLocationRowSpec;
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
}) {
  const step = readSkipLocationStep(settings);
  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {row.label}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {step ? (
                <>
                  New documents are saved in{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {step.placeName}
                  </span>
                </>
              ) : (
                'Off: the New Document wizard asks where each document goes.'
              )}
            </span>
          </div>
          {step ? (
            <button
              type="button"
              className={PLACEMENT_ROW_BUTTON}
              onClick={() => onChange(turnOffSkipLocationStep(settings))}
            >
              Turn Off
            </button>
          ) : null}
        </div>
      )}
    />
  );
}
