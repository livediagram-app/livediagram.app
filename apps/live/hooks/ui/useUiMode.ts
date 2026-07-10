'use client';

import { useEffect, useSyncExternalStore } from 'react';
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
//
// The mode lives in a module-level store shared by every hook
// instance (useSyncExternalStore). It used to be per-instance
// useState, which meant toggling from the status bar only re-rendered
// the status bar: other subscribers (the tab bar's active-pill inline
// colours, ThemeModeBanner's mismatch check) kept the stale mode until
// something else re-rendered them.

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

// null until first read so the store seeds lazily on the client;
// getSnapshot must stay pure, so seeding happens there but writing
// back to localStorage / the DOM only ever happens in setUiMode.
let current: UiMode | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): UiMode {
  if (current === null) current = read();
  return current;
}

function getServerSnapshot(): UiMode {
  return 'light';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setUiMode(next: UiMode) {
  current = next;
  writeLocalStorageSafe(UI_MODE_STORAGE_KEY, next);
  apply(next);
  listeners.forEach((l) => l());
}

export function useUiMode(): { mode: UiMode; toggle: () => void } {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Reconcile the DOM class with the stored value once on mount — the
  // pre-hydration script normally handles this, but embeds / tests that
  // render without the root layout still get the right chrome.
  useEffect(() => {
    apply(getSnapshot());
  }, []);

  const toggle = () => {
    // Side effects (localStorage, DOM class, telemetry) live in
    // setUiMode rather than a setState updater because React strict
    // mode runs updaters twice in dev to surface impure callbacks —
    // that double-fired the telemetry emit, double-wrote localStorage,
    // and double-applied the DOM class.
    const next: UiMode = getSnapshot() === 'dark' ? 'light' : 'dark';
    setUiMode(next);
    track('UI', 'Toggled', next === 'dark' ? 'Dark' : 'Light');
  };

  return { mode, toggle };
}
