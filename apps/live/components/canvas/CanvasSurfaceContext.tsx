'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CanvasSurface } from '@livediagram/diagram';

// Which paper the active tab's canvas is: light or dark. Every element that
// carries no colour of its own is drawn in that paper's ink
// (`defaultStrokeColor` and friends in @livediagram/diagram), and the Default
// colour scheme deliberately leaves elements uncoloured — so on a Default tab
// this context IS the element colour (spec/07, spec/09).
//
// A context rather than a prop chain, for two reasons. The element views are
// `React.memo`'d, and memo blocks a parent's re-render from reaching them but
// does NOT block a context update — which is exactly the propagation the
// appearance switch needs. And the same answer is wanted outside the canvas
// tree, by the colour swatches in the element menus, which would otherwise
// show a light-canvas blue next to a grey shape.
//
// The default is 'light': anything rendering a canvas element outside the
// editor (a preview tile, a test) is on white paper.
const CanvasSurfaceContext = createContext<CanvasSurface>('light');

export function CanvasSurfaceProvider({
  surface,
  children,
}: {
  surface: CanvasSurface;
  children: ReactNode;
}) {
  return <CanvasSurfaceContext.Provider value={surface}>{children}</CanvasSurfaceContext.Provider>;
}

export function useCanvasSurface(): CanvasSurface {
  return useContext(CanvasSurfaceContext);
}
