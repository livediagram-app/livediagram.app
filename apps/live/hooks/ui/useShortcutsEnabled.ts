'use client';

import { useEffect, useState } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
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

function read(): boolean {
  // Stored as the literal string 'false' when disabled; absent or
  // any other value (including the default) is treated as enabled.
  return readLocalStorageSafe(STORAGE_KEY) !== 'false';
}

export function useShortcutsEnabled(): { enabled: boolean; setEnabled: (next: boolean) => void } {
  const [enabled, setLocalEnabled] = useState(true);

  useEffect(() => {
    setLocalEnabled(read());
  }, []);

  const setEnabled = (next: boolean) => {
    // Settings flip (docs/specs/017-telemetry/telemetry.md): emit BEFORE persisting so the wire value
    // matches the value the user just chose, like the other UI toggles.
    track('UI', 'Toggled', next ? 'ShortcutsOn' : 'ShortcutsOff');
    writeLocalStorageSafe(STORAGE_KEY, next ? 'true' : 'false');
    setLocalEnabled(next);
  };

  return { enabled, setEnabled };
}
