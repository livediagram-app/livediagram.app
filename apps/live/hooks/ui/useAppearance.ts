'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { track } from '@/lib/telemetry';
import {
  applyAppearance,
  getAppearance,
  getServerAppearance,
  setAppearance,
  subscribeAppearance,
  type Appearance,
} from './appearance-store';
import { APPEARANCE_STORAGE_KEY } from './appearance-storage';

// Appearance: the editor's own light / dark chrome. Distinct from the
// per-tab colour scheme (apps/live/lib/themes.ts): a colour scheme
// recolours CANVAS content, appearance recolours editor CHROME around
// it. Persists to localStorage so a refresh keeps the user's pick.
//
// The value, its storage and the DOM class live in appearance-store,
// which has no React in it and is directly testable. This file is the
// subscription and the toggle.
//
// The value lives in a module-level store shared by every hook
// instance (useSyncExternalStore). It used to be per-instance
// useState, which meant toggling from the status bar only re-rendered
// the status bar: other subscribers (the tab bar's active-pill inline
// colours, ThemeModeBanner's mismatch check) kept the stale value until
// something else re-rendered them.

// Re-exported under the name this hook's client consumers already import.
export { APPEARANCE_STORAGE_KEY as STORAGE_KEY };

export function useAppearance(): { mode: Appearance; toggle: () => void } {
  const mode = useSyncExternalStore(subscribeAppearance, getAppearance, getServerAppearance);

  // Reconcile the DOM class with the stored value once on mount — the
  // pre-hydration script normally handles this, but embeds / tests that
  // render without the root layout still get the right chrome.
  useEffect(() => {
    applyAppearance(getAppearance());
  }, []);

  const toggle = () => {
    const next: Appearance = getAppearance() === 'dark' ? 'light' : 'dark';
    setAppearance(next);
    track('UI', 'Toggled', next === 'dark' ? 'Dark' : 'Light');
  };

  return { mode, toggle };
}
