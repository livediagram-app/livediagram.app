'use client';

// The canvas zoom, for the parts of an element that are counter-scaled to stay a constant size on
// screen: grips, badges, hit bands, the edit toolbar (docs/specs/008-canvas/canvas-performance.md).
// A zoom re-renders those consumers only; the element views around them, which take no zoom, keep
// their last render. Outside a provider the zoom is 1.

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';

const CanvasZoomContext = createContext(1);

export function CanvasZoomProvider({ zoom, children }: { zoom: number; children: ReactNode }) {
  return <CanvasZoomContext.Provider value={zoom}>{children}</CanvasZoomContext.Provider>;
}

export function useCanvasZoom(): number {
  return useContext(CanvasZoomContext);
}

// A div counter-scaled to keep its size on screen. It reads the zoom itself, so whatever renders it
// takes no zoom and does not render for one.
export function CounterScaled({ style, ...props }: ComponentProps<'div'>) {
  const zoom = useCanvasZoom();
  return <div {...props} style={{ ...style, transform: `scale(${1 / zoom})` }} />;
}
