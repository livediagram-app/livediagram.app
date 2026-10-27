'use client';

import { workbench } from '../../bindings';
import { useLocalStorageValue, writeLocalStorageValue } from '../ui/useLocalStorageValue';

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md "Hide Participant Cursors"):
// this screen stops drawing other people's cursor arrows and name pills. Remembered on this device, never synced,
// like the Keyboard Shortcuts switch. Settings and the Collaborators modal each show it; both read this one store,
// so a flip in either (or in another tab) reaches both at once.
//
// Stored as the literal 'true' while on; absent or anything else is off, the default.

export function useHideCursors(): { hidden: boolean; setHidden: (next: boolean) => void } {
  const key = workbench.hideCursorsKey;
  const hidden = useLocalStorageValue(key) === 'true';
  const setHidden = (next: boolean) => {
    // Sent before the write, like every Settings flip (docs/specs/017-telemetry/telemetry.md).
    workbench.track('UI', 'Toggled', next ? 'HideCursorsOn' : 'HideCursorsOff');
    writeLocalStorageValue(key, next ? 'true' : 'false');
  };
  return { hidden, setHidden };
}
