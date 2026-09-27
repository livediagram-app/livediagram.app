'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Minimal chrome (docs/specs/007-editor/power-user-mode.md) as ONE flag any chrome surface reads.
// Each surface decides what it hides within the rule: words and hints go,
// controls stay. False outside a provider, so the Explorer page and /new,
// which never mount one, are untouched.
const MinimalChromeContext = createContext(false);

export function MinimalChromeProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <MinimalChromeContext.Provider value={value}>{children}</MinimalChromeContext.Provider>;
}

export function useMinimalChrome(): boolean {
  return useContext(MinimalChromeContext);
}
