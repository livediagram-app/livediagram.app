// The canvas's own two colours, in each appearance. A leaf module on purpose:
// the colour-scheme catalogue builds its Default entries out of these at module
// scope, so they cannot live in index.ts (which imports the catalogue back, and
// a cycle leaves the constants undefined exactly when the catalogue reads them).
// index.ts re-exports them, so every existing importer is unaffected.

// The light canvas is the board's off-white (docs/specs/007-editor/editor-modes.md "One look"), so
// Diagram and Draw mode share one backdrop.
export const DEFAULT_BACKGROUND_COLOR = '#fbfaf7';
export const DEFAULT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// The same canvas in dark appearance: the Default colour scheme's dark half
// (docs/specs/008-canvas/canvas-and-palette.md, Default scheme, dark half). The blue-slate of the dark
// chrome, so paper and panels read as one material. The grid is #2e4057 at 45 %
// over the canvas, stored as the opaque blend so every renderer paints the same
// colour without knowing about the alpha.
export const DARK_CANVAS_BACKGROUND_COLOR = '#0d121a';
export const DARK_CANVAS_PATTERN_COLOR = '#1c2735';
