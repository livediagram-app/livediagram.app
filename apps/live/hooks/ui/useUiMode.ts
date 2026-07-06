'use client';

import { useEffect, useState } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
import { track } from '@/lib/telemetry';

// UI chrome mode (light / dark). Distinct from the per-tab diagram
// theme (apps/live/lib/themes.ts): the diagram theme recolours
// CANVAS content, this flag recolours editor CHROME around it.
// Persists to localStorage so a refresh keeps the user's pick.
//
// Default is light. We deliberately do NOT auto-detect
// prefers-color-scheme on first load: the toggle is opt-in so the
// choice belongs to the user, not the OS. (Spec/07 documents the
// reasoning.)

type UiMode = 'light' | 'dark';

// The storage key lives in a plain (non-client) module so the server
// layout's pre-hydration script can inline the real value — see
// ui-mode-storage.ts for why. Re-exported here under the name this
// hook's client consumers already import.
import { UI_MODE_STORAGE_KEY } from './ui-mode-storage';

export { UI_MODE_STORAGE_KEY as STORAGE_KEY };

function read(): UiMode {
  return readLocalStorageSafe(UI_MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function apply(mode: UiMode) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (mode === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
}

export function useUiMode(): { mode: UiMode; toggle: () => void } {
  // Mirror the stored value to React state so toggling re-renders
  // the toggle button's icon. The SSR initial pass returns 'light'
  // (no window); the post-mount effect below reconciles to the
  // real stored value if it differs.
  const [mode, setMode] = useState<UiMode>('light');

  useEffect(() => {
    const stored = read();
    setMode(stored);
    apply(stored);
  }, []);

  const toggle = () => {
    // Side effects (localStorage, DOM class, telemetry) live OUTSIDE
    // the setMode updater because React strict mode runs updaters
    // twice in dev to surface impure callbacks — that double-fired
    // the telemetry emit, double-wrote localStorage, and double-
    // applied the DOM class. The current `mode` from render-closure
    // is fine here: toggle is a single button click, never a rapid
    // race, so there's no stale-state risk.
    const next: UiMode = mode === 'dark' ? 'light' : 'dark';
    writeLocalStorageSafe(UI_MODE_STORAGE_KEY, next);
    apply(next);
    setMode(next);
    track('UI', 'Toggled', next === 'dark' ? 'Dark' : 'Light');
  };

  return { mode, toggle };
}
