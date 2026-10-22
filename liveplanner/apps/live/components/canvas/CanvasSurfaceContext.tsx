'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { themeChartPalette, type CanvasSurface, type ThemeDefinition } from '@liveplanner/project';

// Which paper the active tab's canvas is: light or dark. Every element that
// carries no colour of its own is drawn in that paper's ink
// (`defaultStrokeColor` and friends in @liveplanner/project), and the Default
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

// The active tab's theme, for the few element faces that dress themselves in it with no colour
// stored on the element: the empty image placeholder. Null outside the editor canvas (a preview tile, a test): those draw
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

/** The categorical ramp the active tab's theme gives its charts, as the canvas hands them: for the
 *  previews drawn by the export renderer (minimap, layer rows, layout previews), which otherwise fall
 *  back to the built-in ramp and show charts in other colours (docs/specs/009-elements/pie-chart.md).
 *  Undefined outside the editor canvas, where that built-in ramp is the right answer. */
export function useCanvasChartPalette(): readonly string[] | undefined {
  const theme = useContext(CanvasThemeContext);
  return useMemo(() => (theme ? themeChartPalette(theme) : undefined), [theme]);
}
