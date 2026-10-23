'use client';

import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsToggleGroupRowSpec } from './settings-catalogue';

// Several related switches as one control (docs/specs/007-editor/user-preferences.md "Toggle
// groups"): the group's label and one description
// over a row of switch chips, one per preference, where a row per switch would repeat the same
// sentence six times.
export function SettingsToggleGroupRow({
  row,
  checked,
  onChange,
  disabled = false,
}: {
  row: SettingsToggleGroupRowSpec;
  // Each switch's state, by its key.
  checked: (key: string) => boolean;
  onChange: (key: string, next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingsRowShell row={row} dimmed={disabled}>
      <div
        role="group"
        aria-labelledby={`${row.key}-label`}
        aria-describedby={`${row.key}-description`}
        className="flex flex-wrap gap-2"
      >
        {row.toggles.map((toggle) => {
          const on = checked(toggle.key);
          return (
            // A chip per switch: ticked and tinted while on. Chips rather than a grid of
            // switches, so a row of short names fits without truncating any of them.
            <button
              key={toggle.key}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={disabled}
              data-settings-toggle={toggle.key}
              onClick={() => onChange(toggle.key, !on)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                on
                  ? 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                  on
                    ? 'bg-brand-700 text-white dark:bg-brand-600'
                    : 'border border-slate-300 dark:border-slate-500'
                }`}
              >
                {on ? (
                  <svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 fill-none stroke-current"
                    strokeWidth={2}
                  >
                    <path d="m3 6.2 2 2 4-4.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              {toggle.label}
            </button>
          );
        })}
      </div>
    </SettingsRowShell>
  );
}
