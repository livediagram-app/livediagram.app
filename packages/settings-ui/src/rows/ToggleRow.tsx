'use client';

import type { ReactNode } from 'react';
import type { SettingsRowBase } from '../model';
import { SettingsRowShell } from '../SettingsRowShell';

// An on/off setting: the label and its description, with the switch beside them
// (see SettingsRowShell). The whole cell is the click target.
export function SettingsToggleRowView({
  row,
  checked,
  onChange,
  disabled = false,
  notice,
}: {
  // Presentational half only, so an app's own switch (a device-local one, say) reuses this rather
  // than growing a second copy of the toggle cell.
  row: Pick<
    SettingsRowBase,
    'key' | 'label' | 'description' | 'helpArticle' | 'alsoIn' | 'illustration' | 'allApps'
  >;
  checked: boolean;
  onChange: (next: boolean) => void;
  // Greys the row out and stops it flipping (a desktop-only setting on a
  // phone); `notice` says why.
  disabled?: boolean;
  notice?: ReactNode;
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
        // help link and the illustration sit above that layer and keep their own clicks. The
        // drawn switch inside is aria-hidden, so a screen reader hears one switch.
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
            <SwitchPicture checked={checked} />
          </span>
        </button>
      }
    />
  );
}

// The switch's picture: a track and its thumb, as the apps' ToggleSwitch draws it.
function SwitchPicture({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={
        checked
          ? 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-brand-500 transition'
          : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition dark:bg-slate-600'
      }
    >
      <span
        aria-hidden
        className={
          checked
            ? 'inline-block h-3.5 w-3.5 translate-x-[18px] rounded-full bg-white shadow-sm transition'
            : 'inline-block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-white shadow-sm transition'
        }
      />
    </span>
  );
}
