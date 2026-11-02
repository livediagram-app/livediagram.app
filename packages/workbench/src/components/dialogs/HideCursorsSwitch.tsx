'use client';

import { SettingsToggleRow } from '@liveworkspace/ui';
import { useCursorsDrawn, useHideCursors } from '../../hooks/collab/useHideCursors';

// The Hide Participant Cursors switch at the foot of the Collaborators modal
// (docs/specs/012-collaboration/collaborator-enhancements.md "Hide Participant Cursors"): the same switch Settings
// shows under Collaborate, one click away when a session gets busy.
export const HIDE_CURSORS_LABEL = 'Hide Participant Cursors';
export const HIDE_CURSORS_HINT =
  "Stops drawing other people's cursors and names on your screen. Avatars and Follow stay. Saved on this device only.";

export function HideCursorsSwitch() {
  const { hidden, setHidden } = useHideCursors();
  return (
    <SettingsToggleRow
      label={HIDE_CURSORS_LABEL}
      hint={HIDE_CURSORS_HINT}
      checked={hidden}
      onToggle={() => setHidden(!hidden)}
    />
  );
}

// The modal's footer that holds the switch, outside the scroller so it stays put however long the room gets.
// Nothing at all on a tab that draws no cursors ("Only where cursors are drawn"), not even the rule above it.
export function HideCursorsFooter() {
  if (!useCursorsDrawn()) return null;
  return (
    <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
      <HideCursorsSwitch />
    </div>
  );
}
