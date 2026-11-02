import { createAppearanceStore } from '@liveworkspace/ui/appearance-store';
import { APPEARANCE_STORAGE_KEY } from './appearance-storage';

// This product's one Appearance store (docs/specs/004-interface-design/appearance.md), under its own key:
// @liveworkspace/ui's createAppearanceStore. Deliberately NOT a `'use client'` module, so the server layout's
// import chain to the key stays plain.
export const APPEARANCE_STORE = createAppearanceStore(APPEARANCE_STORAGE_KEY);

export const {
  readAppearanceSetting,
  resolveAppearance,
  getAppearanceSetting,
  getResolvedAppearance,
  setAppearanceOverride,
  getServerAppearance,
  getServerAppearanceSetting,
  subscribeAppearance,
  setAppearance,
  resetAppearanceForTests,
} = APPEARANCE_STORE;
