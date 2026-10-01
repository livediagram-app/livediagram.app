'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The resolved UI scale (docs/specs/007-editor/ui-scale.md) as ONE number any
// scaled surface reads. 1 outside a provider, so the Explorer page and /new,
// which never mount one, are untouched.
const UiScaleContext = createContext(1);

export function UiScaleProvider({ value, children }: { value: number; children: ReactNode }) {
  return <UiScaleContext.Provider value={value}>{children}</UiScaleContext.Provider>;
}

export function useUiScale(): number {
  return useContext(UiScaleContext);
}
