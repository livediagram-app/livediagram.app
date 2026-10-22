'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Minimal chrome (docs/specs/007-editor/power-user-mode.md) as ONE flag any chrome surface reads.
// Each surface decides what it hides within the rule: words and hints go,
// controls stay. False outside a provider, so the Explorer page and /new,
// which never mount one, are untouched.
const MinimalChromeContext = createContext(false);
// Power user mode itself (docs/specs/007-editor/power-user-mode.md), for the chrome that steps back
// for the mode as a whole rather than for its Minimal chrome option: the selection toolbars' More
// button, which a power user reaches by right-click. False outside a provider, like the above.
const PowerUserContext = createContext(false);

export function MinimalChromeProvider({
  value,
  powerUser = false,
  children,
}: {
  value: boolean;
  powerUser?: boolean;
  children: ReactNode;
}) {
  return (
    <MinimalChromeContext.Provider value={value}>
      <PowerUserContext.Provider value={powerUser}>{children}</PowerUserContext.Provider>
    </MinimalChromeContext.Provider>
  );
}

export function usePowerUser(): boolean {
  return useContext(PowerUserContext);
}

export function useMinimalChrome(): boolean {
  return useContext(MinimalChromeContext);
}
