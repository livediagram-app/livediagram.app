'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Whether the canvas is showing a presented slide (docs/specs/012-collaboration/presentation-mode.md "Numbers count
// up"). Set once above the canvas; the stat row's count-up is the one thing that reads it, so a slide's elements
// learn it without a prop through every element view.
const PresentingContext = createContext(false);

export function PresentingProvider({ when, children }: { when: boolean; children: ReactNode }) {
  return <PresentingContext.Provider value={when}>{children}</PresentingContext.Provider>;
}

/** Whether this canvas is presenting a slide. */
export function usePresenting(): boolean {
  return useContext(PresentingContext);
}
