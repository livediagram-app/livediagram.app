'use client';

import { useCallback } from 'react';
import { useLocalStorageValue, writeLocalStorageValue } from './useLocalStorageValue';

// A disclosure's open state, remembered in this browser: an optional section that starts closed (or open) and stays
// the way the person last left it, through page reloads, until they flip it again (livediagram's palette groups,
// docs/specs/007-editor/toolbar-layout.md "Optional groups"). Kept through useLocalStorageValue, so every reader of
// one key agrees, a blocked or refused store degrades to this session's memory, and a static export renders the
// default.
//
// Stored as the literal 'open' or 'closed'; absent or anything else is `defaultOpen`.

export function useStoredOpen(
  key: string,
  defaultOpen = false,
): { open: boolean; setOpen: (next: boolean) => void; toggle: () => void } {
  const stored = useLocalStorageValue(key);
  const open = stored === 'open' ? true : stored === 'closed' ? false : defaultOpen;
  const setOpen = useCallback(
    (next: boolean) => writeLocalStorageValue(key, next ? 'open' : 'closed'),
    [key],
  );
  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);
  return { open, setOpen, toggle };
}
