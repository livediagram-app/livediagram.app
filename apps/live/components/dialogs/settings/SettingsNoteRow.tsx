'use client';

import { SettingsRowShell } from './SettingsRowShell';
import { SettingsSignInLink } from './SettingsSignInLink';
import type { SettingsNoteRowSpec } from './settings-catalogue';

// A row with no control, standing in for settings the reader cannot use
// yet. Same shape as the signed-out API tokens row, so "you need an account
// for this" reads the same wherever it turns up, Sign In link included.
export function SettingsNoteRow({ row }: { row: SettingsNoteRowSpec }) {
  return (
    <SettingsRowShell
      row={row}
      descriptionContent={
        <>
          {row.note}
          {row.signIn ? <SettingsSignInLink /> : null}
        </>
      }
    />
  );
}
