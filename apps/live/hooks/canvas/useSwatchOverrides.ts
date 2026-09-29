'use client';

// Custom swatches' state (docs/specs/008-canvas/quick-style-panel.md "Custom swatches"): per user, synced,
// keyed by theme, in the preferences blob beside `customSwatches`, and
// written the way `customSwatches` is (the same owner, guest or signed in).
// The logic is pure, in lib/swatch-overrides.

import { useMemo } from 'react';
import type { QuickSwatchRole, QuickSwatchSlot } from '@livediagram/document';
import { readUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import {
  overridesForTheme,
  parseSwatchOverrideStore,
  storeWithOverride,
  storeWithoutOverride,
  type SwatchOverrideStore,
  type SwatchOverrides,
} from '@/lib/swatch-overrides';

export type SwatchOverridesApi = {
  // The active theme's overrides only: another theme shows its own slots.
  overrides: SwatchOverrides;
  setOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot, hex: string) => void;
  clearOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot) => void;
};

export function withSwatchOverrideStore(
  prefs: UserPreferences,
  store: SwatchOverrideStore,
): UserPreferences {
  const next = { ...prefs };
  if (store.length === 0) delete next.quickSwatchOverrides;
  else next.quickSwatchOverrides = store;
  return next;
}

export function useSwatchOverrides({
  themeId,
  userPreferences,
  setUserPreferences,
  writeUserPreferences,
  ownerId,
}: {
  themeId: string;
  userPreferences: UserPreferences;
  setUserPreferences: (prefs: UserPreferences) => void;
  writeUserPreferences: (prefs: UserPreferences, ownerId?: string | null) => void;
  ownerId: string | null;
}): SwatchOverridesApi {
  const stored = userPreferences.quickSwatchOverrides;
  const overrides = useMemo(
    () => overridesForTheme(parseSwatchOverrideStore(stored), themeId),
    [stored, themeId],
  );

  // Written off the FRESHEST stored preferences, not this render's snapshot:
  // the PUT sends the whole blob, so a stale base would undo other writes.
  const update = (next: (store: SwatchOverrideStore) => SwatchOverrideStore) => {
    const latest = readUserPreferences();
    const current = parseSwatchOverrideStore(latest.quickSwatchOverrides);
    const changed = next(current);
    if (changed === current) return;
    const merged = withSwatchOverrideStore(latest, changed);
    setUserPreferences(merged);
    writeUserPreferences(merged, ownerId);
  };

  return {
    overrides,
    setOverride: (role, slot, hex) =>
      update((store) => storeWithOverride(store, themeId, role, slot, hex)),
    clearOverride: (role, slot) =>
      update((store) => storeWithoutOverride(store, themeId, role, slot)),
  };
}
