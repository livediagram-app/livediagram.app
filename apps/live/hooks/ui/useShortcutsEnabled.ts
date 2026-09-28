'use client';

import { useLocalStorageValue, writeLocalStorageValue } from './useLocalStorageValue';
import { track } from '@/lib/telemetry';

// Per-device toggle that disables ALL editor keyboard shortcuts
// (Cmd-Z undo, Delete to wipe selection, Escape to cancel modes,
// etc.). Persists to localStorage so the choice survives refreshes
// but stays per-browser (users on a tablet with an external
// keyboard may want them; users dictating into the same browser
// may not).
//
// Default is ENABLED. docs/specs/007-editor/live-app.md documents the contract; the toggle
// lives in the new keyboard-shortcuts modal so it's discoverable
// alongside the list it disables.

const STORAGE_KEY = 'livediagram:v2:shortcuts-enabled';

export function useShortcutsEnabled(): { enabled: boolean; setEnabled: (next: boolean) => void } {
  // Stored as the literal string 'false' when disabled; absent or any other
  // value (including the default) is treated as enabled. Every reader (the
  // editor and the Settings row) shares the one store, so a flip reaches both.
  const enabled = useLocalStorageValue(STORAGE_KEY) !== 'false';

  const setEnabled = (next: boolean) => {
    // Settings flip (docs/specs/017-telemetry/telemetry.md): emit BEFORE persisting so the wire value
    // matches the value the user just chose, like the other UI toggles.
    track('UI', 'Toggled', next ? 'ShortcutsOn' : 'ShortcutsOff');
    writeLocalStorageValue(STORAGE_KEY, next ? 'true' : 'false');
  };

  return { enabled, setEnabled };
}
