'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Whether the canvas is STILL: elements appear exactly as drawn, with no
// entry animation. True on a whiteboard (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard
// shows"), where a mark is ink put down by hand and a pop-in would read as the
// app drawing it. A context rather than a prop, for the reason
// CanvasSurfaceContext is one: the element views are memoised.
const CanvasStillContext = createContext(false);

export function CanvasStillProvider({ still, children }: { still: boolean; children: ReactNode }) {
  return <CanvasStillContext.Provider value={still}>{children}</CanvasStillContext.Provider>;
}

export function useCanvasStill(): boolean {
  return useContext(CanvasStillContext);
}

// The still canvas is the whiteboard's, which also picks a shape by its drawn
// outline rather than its box (docs/specs/023-draw-mode/draw-mode.md "Selecting").
export function useCanvasPicksByOutline(): boolean {
  return useContext(CanvasStillContext);
}
