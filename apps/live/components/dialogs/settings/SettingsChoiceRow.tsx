'use client';

import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsRowSpec } from './settings-catalogue';

// A pick-one setting (the minimap's size, the appearance theme), drawn as a
// segmented control rather than a <select>: three short options fit on the
// row, and a native select in a dialog full of switches is the one bit of
// default browser chrome in the stack.
//
// It takes `options` / `value` / `onChange` directly rather than a
// preferences-backed row spec, because the two callers disagree about where
// the value LIVES: the minimap's size is a UserPreference, the appearance
// theme is device-local (docs/specs/007-editor/live-app.md). Asking for a read/write pair here would
// force the appearance caller to invent one it never uses.
//
// Radios rather than buttons, so a screen reader gets "2 of 3" and the arrow
// keys move between them for free.
export function SettingsChoiceRow({
  row,
  options,
  value,
  onChange,
  notice,
}: {
  // Only the shell's half of the spec is needed: label, description, help.
  row: Pick<
    SettingsRowSpec,
    'key' | 'label' | 'description' | 'helpArticle' | 'alsoIn' | 'illustration'
  >;
  // `disabled` greys an option out and stops it being picked (a desktop-only
  // layout on a phone); `notice` says why.
  options: { id: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (next: string) => void;
  notice?: React.ReactNode;
}) {
  return (
    <SettingsRowShell
      row={row}
      illustrationValue={value}
      onIllustrationChoose={onChange}
      illustrationDisabled={options.filter((o) => o.disabled).map((o) => o.id)}
      notice={notice}
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
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
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
