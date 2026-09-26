'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { track } from '@/lib/telemetry';
import {
  applyAppearance,
  getAppearanceSetting,
  getResolvedAppearance,
  getServerAppearance,
  setAppearance,
  subscribeAppearance,
  type Appearance,
  type AppearanceSetting,
} from './appearance-store';
import { APPEARANCE_STORAGE_KEY } from './appearance-storage';

// Appearance: the editor's own light / dark chrome. Distinct from the
// per-tab theme (apps/live/lib/themes.ts): a theme
// recolours CANVAS content, appearance recolours editor CHROME around
// it. Persists to localStorage so a refresh keeps the user's pick.
//
// The value, its storage, the OS watch and the DOM class live in
// appearance-store, which has no React in it and is directly testable.
// This file is the subscription and the cycle.
//
// Two values come back, because the pick and the paint are different
// things: `setting` is what the user chose (including System) and is
// what a control should render, `appearance` is what the chrome is
// currently painted as and is what a colour decision should read.
//
// Both live in a module-level store shared by every hook instance
// (useSyncExternalStore). They used to be per-instance useState, which
// meant toggling from the status bar only re-rendered the status bar:
// other subscribers (the tab bar's active-pill inline colours,
// ThemeModeBanner's mismatch check) kept the stale value until
// something else re-rendered them.

// Re-exported under the name this hook's client consumers already import.
export { APPEARANCE_STORAGE_KEY as STORAGE_KEY };

// The cycle the tab-bar control walks. Light and Dark first (the two
// picks anyone reaching for the control wants), System last as the
// "actually, you decide" step that hands the choice back to the OS.
const CYCLE: AppearanceSetting[] = ['light', 'dark', 'system'];

export function nextAppearanceSetting(setting: AppearanceSetting): AppearanceSetting {
  return CYCLE[(CYCLE.indexOf(setting) + 1) % CYCLE.length]!;
}

// Telemetry labels are presets, never user content (docs/specs/017-telemetry/telemetry.md).
const TELEMETRY_LABEL: Record<AppearanceSetting, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function useAppearance(): {
  setting: AppearanceSetting;
  appearance: Appearance;
  set: (next: AppearanceSetting) => void;
  cycle: () => void;
} {
  const setting = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSetting,
    getServerAppearance,
  );
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    getResolvedAppearance,
    getServerAppearance,
  );

  // Reconcile the DOM class with the stored value once on mount — the
  // pre-hydration script normally handles this, but embeds / tests that
  // render without the root layout still get the right chrome.
  useEffect(() => {
    applyAppearance(getResolvedAppearance());
  }, []);

  const set = (next: AppearanceSetting) => {
    setAppearance(next);
    track('UI', 'Toggled', TELEMETRY_LABEL[next]);
  };

  return {
    setting,
    appearance,
    set,
    cycle: () => set(nextAppearanceSetting(getAppearanceSetting())),
  };
}
