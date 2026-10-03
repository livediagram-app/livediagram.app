'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CanvasSurface } from '@livediagram/document';

// Which paper the active tab's canvas is: light or dark. Every element that
// carries no colour of its own is drawn in that paper's ink
// (`defaultStrokeColor` and friends in @livediagram/document), and the Default
// theme deliberately leaves elements uncoloured — so on a Default tab
// this context IS the element colour (docs/specs/007-editor/live-app.md, docs/specs/008-canvas/canvas-and-palette.md).
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

// Illustrate pages with a fill of their own (docs/specs/007-editor/illustrate-pages.md "A dark page
// has light ink"): the surface of each element on one, by id, over the canvas's own.
const PageSurfacesContext = createContext<ReadonlyMap<string, CanvasSurface> | null>(null);

/** Provides the per-element page surfaces. Its identity holds while the entries do, so a drag that
 *  keeps every element on its page re-renders no element view through it. */
export function PageSurfacesProvider({
  surfaces,
  children,
}: {
  surfaces: ReadonlyMap<string, CanvasSurface> | null;
  children: ReactNode;
}) {
  const key = surfaces && surfaces.size ? [...surfaces].map(([id, s]) => `${id}:${s}`).join() : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the entries, not the map
  const stable = useMemo(() => (key ? surfaces : null), [key]);
  return <PageSurfacesContext.Provider value={stable}>{children}</PageSurfacesContext.Provider>;
}

/** The paper one element sits on: its page's, where its page has a fill, else the canvas's. */
export function useElementSurface(elementId: string): CanvasSurface {
  const canvas = useContext(CanvasSurfaceContext);
  return useContext(PageSurfacesContext)?.get(elementId) ?? canvas;
}
