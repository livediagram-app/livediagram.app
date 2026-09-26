'use client';

import { createContext, useContext } from 'react';

// Whether a phone puts panels behind the dock (docs/specs/007-editor/live-app.md "Mobile chrome"): true
// in every layout but Toolbar (docs/specs/007-editor/toolbar-layout.md), where a phone keeps the desktop
// chrome and panels float in their corners. Provided by CanvasChrome; read by
// MovablePanel, which otherwise can't tell a phone's layout from its width.
const PhoneDockContext = createContext(true);

export const PhoneDockProvider = PhoneDockContext.Provider;

export function usePhoneDock(): boolean {
  return useContext(PhoneDockContext);
}
