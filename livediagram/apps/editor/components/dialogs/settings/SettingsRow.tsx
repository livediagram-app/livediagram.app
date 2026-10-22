'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsRowSpec } from './settings-catalogue';

// An on/off setting: the label and its description, with the switch beside them
// (see SettingsRowShell). The whole cell is the click target.
export function SettingsRow({
  row,
  checked,
  onChange,
  disabled = false,
  notice,
}: {
  // Presentational half only, so the device-local rows (shortcuts) reuse
  // this rather than growing a second copy of the toggle cell.
  row: Pick<
    SettingsRowSpec,
    'key' | 'label' | 'description' | 'helpArticle' | 'alsoIn' | 'illustration'
  >;
  checked: boolean;
  onChange: (next: boolean) => void;
  // Greys the row out and stops it flipping (a desktop-only setting on a
  // phone); `notice` says why.
  disabled?: boolean;
  notice?: React.ReactNode;
}) {
  return (
    <SettingsRowShell
      row={row}
      interactive={!disabled}
      dimmed={disabled}
      illustrationActive={checked}
      onIllustrationToggle={disabled ? undefined : onChange}
      notice={notice}
      control={
        // The one control: role=switch, named by the label and described by the description. Its
        // ::after stretches over the whole cell, so a click anywhere on the row flips it, while the
        // help link and the illustration sit above that layer and keep their own clicks.
        // `presentational` only stops the ToggleSwitch being a <button>; it still exposes
        // role="switch", so the aria-hidden wrapper keeps a screen reader to one switch.
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={`${row.key}-label`}
          aria-describedby={`${row.key}-description`}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="shrink-0 cursor-pointer rounded-full outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-offset-slate-800"
        >
          <span aria-hidden className="flex">
            <ToggleSwitch presentational checked={checked} label={row.label} />
          </span>
        </button>
      }
    />
  );
}
