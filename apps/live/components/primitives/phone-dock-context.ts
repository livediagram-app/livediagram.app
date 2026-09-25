'use client';

import { createContext, useContext } from 'react';

// Whether a phone puts panels behind the dock (spec/07 "Mobile chrome"): true
// in every layout but Toolbar (spec/148), where a phone keeps the desktop
// chrome and panels float in their corners. Provided by CanvasChrome; read by
// MovablePanel, which otherwise can't tell a phone's layout from its width.
const PhoneDockContext = createContext(true);

export const PhoneDockProvider = PhoneDockContext.Provider;

export function usePhoneDock(): boolean {
  return useContext(PhoneDockContext);
}
