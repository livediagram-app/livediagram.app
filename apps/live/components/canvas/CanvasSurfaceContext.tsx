'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CanvasSurface, ThemeDefinition } from '@livediagram/document';

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
  // oxlint-disable-next-line react-hooks-js/exhaustive-deps -- keyed on the entries, not the map
  const stable = useMemo(() => (key ? surfaces : null), [key]);
  return <PageSurfacesContext.Provider value={stable}>{children}</PageSurfacesContext.Provider>;
}

/** The paper one element sits on: its page's, where its page has a fill, else the canvas's. */
export function useElementSurface(elementId: string): CanvasSurface {
  const canvas = useContext(CanvasSurfaceContext);
  return useContext(PageSurfacesContext)?.get(elementId) ?? canvas;
}

// What each chart on a page with a fill sits on (docs/specs/007-editor/illustrate-pages.md "Charts
// adapt as they are drawn"), by id: the tones its series and text are adapted to as it is drawn.
const ChartGroundsContext = createContext<ReadonlyMap<string, readonly string[]> | null>(null);

/** Provides the chart grounds. Its identity, and each ground's, holds while the entries do, so a
 *  drag elsewhere re-renders no chart through it. */
export function ChartGroundsProvider({
  grounds,
  children,
}: {
  grounds: ReadonlyMap<string, readonly string[]> | null;
  children: ReactNode;
}) {
  const key = grounds && grounds.size ? [...grounds].map(([id, g]) => `${id}:${g}`).join(';') : '';
  // oxlint-disable-next-line react-hooks-js/exhaustive-deps -- keyed on the entries, not the map
  const stable = useMemo(() => (key ? grounds : null), [key]);
  return <ChartGroundsContext.Provider value={stable}>{children}</ChartGroundsContext.Provider>;
}

/** The tones a chart sits on, where its page's fill makes them matter; undefined draws it as is. */
export function useChartGround(elementId: string): readonly string[] | undefined {
  return useContext(ChartGroundsContext)?.get(elementId);
}

// The active tab's theme, for the few element faces that dress themselves in it with no colour
// stored on the element: the empty image placeholder (docs/specs/009-elements/images.md
// "Placeholder rendering"). Null outside the editor canvas (a preview tile, a test): those draw
// the neutral look.
const CanvasThemeContext = createContext<ThemeDefinition | null>(null);

export function CanvasThemeProvider({
  theme,
  children,
}: {
  theme: ThemeDefinition | null;
  children: ReactNode;
}) {
  return <CanvasThemeContext.Provider value={theme}>{children}</CanvasThemeContext.Provider>;
}

export function useCanvasTheme(): ThemeDefinition | null {
  return useContext(CanvasThemeContext);
}
