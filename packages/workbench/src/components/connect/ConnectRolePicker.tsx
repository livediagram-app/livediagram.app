'use client';

// The Connect list's role (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the shared role switch
// (@liveworkspace/ui RoleSwitch), Editor first and chosen. Picked before the file, so it offers every role; a file whose
// app lacks the chosen one says so on its row. Painted from the list's ink.
import type { Level } from '@liveworkspace/index-client';
import { RoleSwitch } from '@liveworkspace/ui';
import { CONNECT_LEVELS, LEVEL_TITLES } from './connect-words';

const OPTIONS = CONNECT_LEVELS.map((value) => ({ value, label: LEVEL_TITLES[value] }));

export function ConnectRolePicker({
  level,
  onChange,
  describedBy,
}: {
  level: Level;
  onChange: (level: Level) => void;
  describedBy?: string;
}) {
  return (
    <RoleSwitch
      value={level}
      options={OPTIONS}
      onChange={onChange}
      label="Role for the file you connect"
      describedBy={describedBy}
    />
  );
}
