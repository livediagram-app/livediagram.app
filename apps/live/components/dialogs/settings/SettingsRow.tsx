'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsRowSpec } from './settings-catalogue';

// An on/off setting: a single-line row holding the label and its switch, with
// the long explanation as a grey footnote below (see SettingsRowShell).
export function SettingsRow({
  row,
  checked,
  onChange,
  disabled = false,
  notice,
}: {
  // Presentational half only, so the device-local rows (shortcuts) reuse
  // this rather than growing a second copy of the toggle card.
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
      illustrationActive={checked}
      onIllustrationToggle={disabled ? undefined : onChange}
      notice={notice}
      wrapper={(children) => (
        // The whole row is the target, so the button carries role=switch and
        // the ToggleSwitch is the picture of that state. `presentational`
        // only stops it being a <button>; it still exposes role="switch" +
        // aria-label, so without the aria-hidden wrapper each row offers a
        // screen reader TWO nested switches of the same name. One control,
        // named by its label and described by its footnote.
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={`${row.key}-description`}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10"
        >
          {children}
        </button>
      )}
      control={
        <span aria-hidden>
          <ToggleSwitch presentational checked={checked} label={row.label} />
        </span>
      }
    />
  );
}
