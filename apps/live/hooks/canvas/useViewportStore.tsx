'use client';

// The editor's viewport store in React (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the
// canvas"): a provider per editor, and a subscription that renders a reader only when the slice of
// the view it shows changed.

import { createContext, useContext, type ReactNode } from 'react';
import { useStoreSlice } from '@/hooks/ui/useStoreSlice';
import type { View, ViewportStore } from '@/lib/viewport-store';

const ViewportStoreContext = createContext<ViewportStore | null>(null);

export function ViewportStoreProvider({
  store,
  children,
}: {
  store: ViewportStore;
  children: ReactNode;
}) {
  return <ViewportStoreContext.Provider value={store}>{children}</ViewportStoreContext.Provider>;
}

export function useViewportStore(): ViewportStore {
  const store = useContext(ViewportStoreContext);
  if (!store) throw new Error('ViewportStoreMissing: [viewport] store missing');
  return store;
}

export function useViewportOf<T>(
  select: (view: View) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T {
  return useStoreSlice(useViewportStore(), select, equal);
}

const zoomOf = (v: View) => v.zoom;
const zoomAndOffset = (v: View) => `${v.offset.x},${v.offset.y},${v.zoom}`;

// For the overlays that convert canvas points to the screen: the zoom, and a key naming what moves
// the canvas wrapper on screen (the view and the canvas size), on which they re-measure its origin
// (useCanvasClientOrigin). They read it themselves, so the chrome around them takes no view.
export function useCanvasViewKey(mainSize: { width: number; height: number }): {
  viewportZoom: number;
  viewKey: string;
} {
  const view = useViewportOf(zoomAndOffset);
  const viewportZoom = useViewportOf(zoomOf);
  return { viewportZoom, viewKey: `${view},${mainSize.width},${mainSize.height}` };
}
