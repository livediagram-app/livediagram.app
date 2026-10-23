// Per-card mini illustrations for the landing-page feature grids.
//
// Each export is a small, self-contained, animated mock of the editor
// surface its card describes (Default-scheme canvas and shapes, pinned
// arrows, presence avatars, floating panels). Motion is pure CSS (fa-*
// classes + keyframes in globals.css) so it survives the static export
// with no JS and settles under prefers-reduced-motion.
//
// The scenes were split out of this (formerly 2,400-line) file into
// ./feature-art/* by section; shared primitives (Frame + color
// constants) live in ./feature-art/shared. This barrel re-exports them
// so callers keep importing from '@/components/FeatureArt'.
export * from './feature-art/canvas';
export * from './feature-art/tabs';
export * from './feature-art/together';
export * from './feature-art/sharing';
export * from './feature-art/foundations';
export * from './feature-art/features';
export * from './feature-art/features-more';
export * from './feature-art/motion';
export * from './feature-art/versatility';
export * from './feature-art/content';
export * from './feature-art/content-tech';
export * from './feature-art/structure';
export * from './feature-art/embeds-timeline';
// Presentation mode (docs/specs/012-collaboration/presentation-mode.md): decks, notes, and the fact that
// presenting is yours alone.
export * from './feature-art/present';
export * from './feature-art/room';
export * from './feature-art/workshop';
// The presenter's clock beside them.
export * from './feature-art/present-timing';
// The mode categories (docs/specs/019-marketing/marketing-site.md "Story beats"): Draw's markers and
// erasers.
export * from './feature-art/whiteboard';
export * from './feature-art/whiteboard-pen';
// Two tabs side by side, and boards brought in from other tools.
export * from './feature-art/side-by-side';
export * from './feature-art/imports';
// Event storming boards and their photo import; the sequence diagram, charts and code blocks; search,
// follow along and live images.
export * from './feature-art/storming';
export * from './feature-art/canvas-data';
export * from './feature-art/reach';
// Draw's dock.
export * from './feature-art/whiteboard-dock';
