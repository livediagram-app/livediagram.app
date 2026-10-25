'use client';

import type { ReactNode } from 'react';
import { Switch } from '@liveworkspace/ui';
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
        // The one control: the shared Switch at its compact size, named by the label and described by the
        // description. `coversRow` stretches it over the whole cell, so a click anywhere on the row flips it, while
        // the help link and the illustration sit above that layer and keep their own clicks.
        <Switch
          size="sm"
          coversRow
          checked={checked}
          labelledBy={`${row.key}-label`}
          describedBy={`${row.key}-description`}
          disabled={disabled}
          onChange={onChange}
        />
      }
    />
  );
}
