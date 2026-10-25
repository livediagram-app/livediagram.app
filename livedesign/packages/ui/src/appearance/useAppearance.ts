'use client';

import { useAppearanceStore, type AppearanceSetting } from '@liveworkspace/ui';
import { APPEARANCE_STORE } from './appearance-store';

// Appearance, the reader's light / dark chrome for every app on the origin
// (docs/specs/004-interface-design/appearance.md): @liveworkspace/ui's useAppearanceStore on this product's
// store. `onSet` lets a host observe an explicit pick (the editor tracks it; the public sites pass nothing).
export function useAppearance(onSet?: (next: AppearanceSetting) => void) {
  return useAppearanceStore(APPEARANCE_STORE, onSet);
}
