'use client';

import { readSkipLocationStep, turnOffSkipLocationStep } from '@/lib/skip-location-step';
import type { UserPreferences } from '@/lib/user-preferences';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from './SettingsRowShell';
import type { SettingsSkipLocationRowSpec } from './settings-catalogue';

// Settings > Documents > New Documents > Always Save in One Place
// (docs/specs/013-workspace/default-folders.md "Settings"): while the New Document wizard skips its
// Location step, where every new document is saved, with Turn Off; otherwise that it is off and
// where it is turned on. A status pill says which at a glance. It is turned on from the wizard,
// where the place is chosen, so there is no switch to flip on here.
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
      descriptionContent={
        step ? (
          <>
            New documents go straight to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {step.placeName}
            </span>
            , without the wizard asking where.
          </>
        ) : (
          <>
            The New Document wizard asks where each document goes. To skip that, tick “Always save
            new documents in…” on its Location step.
          </>
        )
      }
      control={
        <>
          <span
            data-skip-location-status
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              step
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {step ? 'On' : 'Off'}
          </span>
          {step ? (
            <button
              type="button"
              className={SETTINGS_ROW_BUTTON}
              onClick={() => onChange(turnOffSkipLocationStep(settings))}
            >
              Turn Off
            </button>
          ) : null}
        </>
      }
    />
  );
}
