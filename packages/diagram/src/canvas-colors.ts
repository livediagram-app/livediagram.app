// The canvas's own two colours, in each appearance. A leaf module on purpose:
// the colour-scheme catalogue builds its Default entries out of these at module
// scope, so they cannot live in index.ts (which imports the catalogue back, and
// a cycle leaves the constants undefined exactly when the catalogue reads them).
// index.ts re-exports them, so every existing importer is unaffected.

export const DEFAULT_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// The same canvas in dark appearance: the Default colour scheme's dark half
// (spec/07), and before that the Charcoal scheme it absorbed. Neutral zinc
// rather than a hue, because this is the un-themed canvas — anything tinted
// would be a choice, and the tinted darks (Midnight, Pine, Plum) are where a
// choice belongs. Dots a step up from the backdrop so grid and outlines read
// as one material.
export const DARK_CANVAS_BACKGROUND_COLOR = '#2b2b33';
export const DARK_CANVAS_PATTERN_COLOR = '#636373';
