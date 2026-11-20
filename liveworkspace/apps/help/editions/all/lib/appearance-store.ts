import { createAppearanceStore } from '@liveworkspace/ui/appearance-store';

// All Apps' Appearance store (docs/specs/004-interface-design/appearance.md), under liveworkspace.app's own key (the
// one its site has always read, liveworkspace/apps/site lib/appearance/appearance-keys.ts PLATFORM_APPEARANCE_KEY),
// so a pick made on liveworkspace.app holds in its help and back. lib/bindings/all.tsx's boot script reads the same
// key before first paint. Deliberately NOT a `'use client'` module, like each product's store.
export const PLATFORM_APPEARANCE_KEY = 'livediagram:v2:ui-mode';

export const ALL_APPS_APPEARANCE_STORE = createAppearanceStore(PLATFORM_APPEARANCE_KEY);
