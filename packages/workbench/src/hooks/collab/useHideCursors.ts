'use client';

import { createContext, useContext, useMemo } from 'react';
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

// Whether the tab on screen draws other people's cursors at all ("Only where cursors are drawn"). The switch
// is offered only where it can change something: an editor whose tab draws none (a liveplanner Board, Sheet or
// Form) provides false, and the switch leaves the Collaborators modal, Settings and search. Its stored value is
// never touched, so it is there again, as it was, on a tab that draws them. Absent a provider, they are drawn.
export const CursorsDrawnContext = createContext(true);

export function useCursorsDrawn(): boolean {
  return useContext(CursorsDrawnContext);
}

// The Settings row's key in every editor's catalogue (`kind: 'hideCursors'`).
export const HIDE_CURSORS_ROW_KEY = 'hideCursors';

// The editor search's settings, less the switch while this tab draws no cursors: a result that opened Settings
// on a row that is not there would lead nowhere. The same array while they are drawn, so nothing downstream
// re-renders for it.
export function useOfferedSettingItems<T extends { rowKey: string }>(items: T[]): T[] {
  const drawn = useCursorsDrawn();
  return useMemo(
    () => (drawn ? items : items.filter((item) => item.rowKey !== HIDE_CURSORS_ROW_KEY)),
    [drawn, items],
  );
}
