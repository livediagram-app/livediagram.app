'use client';

import type { ReactNode } from 'react';
import type { SettingsChoiceOption, SettingsRowBase } from '../model';
import { SettingsRowShell } from '../SettingsRowShell';

// A pick-one setting (the minimap's size, the appearance theme), drawn as a
// segmented control rather than a <select>: three short options fit on the
// row, and a native select in a dialog full of switches is the one bit of
// default browser chrome in the stack.
//
// Radios rather than buttons, so a screen reader gets "2 of 3" and the arrow
// keys move between them for free.
export function SettingsChoiceRowView({
  row,
  options,
  value,
  onChange,
  notice,
}: {
  // Only the shell's half of the row is needed: label, description, help.
  row: Pick<
    SettingsRowBase,
    'key' | 'label' | 'description' | 'helpArticle' | 'alsoIn' | 'illustration' | 'allApps'
  >;
  // `disabled` greys an option out and stops it being picked (a desktop-only
  // layout on a phone); `notice` says why.
  options: readonly SettingsChoiceOption[];
  value: string;
  onChange: (next: string) => void;
  notice?: ReactNode;
}) {
  return (
    <SettingsRowShell
      row={row}
      illustrationValue={value}
      onIllustrationChoose={onChange}
      illustrationDisabled={options.filter((o) => o.disabled).map((o) => o.id)}
      notice={notice}
      dimmed={options.length > 0 && options.every((o) => o.disabled)}
      control={
        <span
          role="radiogroup"
          aria-label={row.label}
          aria-describedby={`${row.key}-description`}
          className="flex shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900"
        >
          {options.map((option) => {
            const active = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={option.disabled}
                onClick={() => onChange(option.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </span>
      }
    />
  );
}
