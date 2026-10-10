'use client';

// Focus (docs/specs/026-plan/plan-board.md "Focus"): a board's or a Sheet's header button gliding the view to fit
// that element. The editor provides the viewport's smooth fit; outside an editor's canvas (a slide, an export) there
// is none and the button is not drawn.
import { createContext, useContext } from 'react';

export type CanvasFocus = (bounds: { x: number; y: number; w: number; h: number }) => void;

const CanvasFocusContext = createContext<CanvasFocus | null>(null);

export const CanvasFocusProvider = CanvasFocusContext.Provider;

export function useCanvasFocus(): CanvasFocus | null {
  return useContext(CanvasFocusContext);
}
