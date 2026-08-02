'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { track } from '@/lib/telemetry';
import {
  applyUiMode,
  getServerUiMode,
  getUiMode,
  setUiMode,
  subscribeUiMode,
  type UiMode,
} from './ui-mode-store';
import { UI_MODE_STORAGE_KEY } from './ui-mode-storage';

// UI chrome mode (light / dark). Distinct from the per-tab diagram
// theme (apps/live/lib/themes.ts): the diagram theme recolours
// CANVAS content, this flag recolours editor CHROME around it.
// Persists to localStorage so a refresh keeps the user's pick.
//
// The value, its storage and the DOM class live in ui-mode-store, which
// has no React in it and is directly testable. This file is the
// subscription and the toggle.
//
// The mode lives in a module-level store shared by every hook
// instance (useSyncExternalStore). It used to be per-instance
// useState, which meant toggling from the status bar only re-rendered
// the status bar: other subscribers (the tab bar's active-pill inline
// colours, ThemeModeBanner's mismatch check) kept the stale mode until
// something else re-rendered them.

// Re-exported under the name this hook's client consumers already import.
export { UI_MODE_STORAGE_KEY as STORAGE_KEY };

export function useUiMode(): { mode: UiMode; toggle: () => void } {
  const mode = useSyncExternalStore(subscribeUiMode, getUiMode, getServerUiMode);

  // Reconcile the DOM class with the stored value once on mount — the
  // pre-hydration script normally handles this, but embeds / tests that
  // render without the root layout still get the right chrome.
  useEffect(() => {
    applyUiMode(getUiMode());
  }, []);

  const toggle = () => {
    const next: UiMode = getUiMode() === 'dark' ? 'light' : 'dark';
    setUiMode(next);
    track('UI', 'Toggled', next === 'dark' ? 'Dark' : 'Light');
  };

  return { mode, toggle };
}
