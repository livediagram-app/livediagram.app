'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { getUiScalePreview, subscribeUiScalePreview } from '@/lib/ui-scale-preview';
import { UNSCALED, type UiScalePart, type UiScales } from '@/lib/ui-scale';
import type { UserPreferences } from '@/lib/user-preferences';

// The resolved UI scales (docs/specs/007-editor/ui-scale.md), one per part of
// the chrome, read by every scaled surface. 1 everywhere outside a provider,
// so the Explorer page and /new, which never mount one, are untouched.
const UiScaleContext = createContext<UiScales>(UNSCALED);

export function UiScaleProvider({ value, children }: { value: UiScales; children: ReactNode }) {
  return <UiScaleContext.Provider value={value}>{children}</UiScaleContext.Provider>;
}

// The scale a surface of this part is drawn at.
export function useUiScale(part: UiScalePart): number {
  return useContext(UiScaleContext)[part];
}

// The dragged slider's patch, or null (lib/ui-scale-preview).
export function useUiScalePreview(): Partial<UserPreferences> | null {
  return useSyncExternalStore(subscribeUiScalePreview, getUiScalePreview, () => null);
}
