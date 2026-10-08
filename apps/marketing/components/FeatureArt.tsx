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
export * from './feature-art/together';
export * from './feature-art/foundations';
export * from './feature-art/features';
export * from './feature-art/motion';
export * from './feature-art/versatility';
export * from './feature-art/content';
export * from './feature-art/structure';
// Presentation mode (docs/specs/012-collaboration/presentation-mode.md): decks, the full-screen slide, notes, and the
// fact that presenting is yours alone.
export * from './feature-art/present';
export * from './feature-art/room';
// Infographic pages (docs/specs/007-editor/illustrate-pages.md): pages, layouts, backgrounds, export.
export * from './feature-art/infographics';
export * from './feature-art/article';
// The mode categories (docs/specs/019-marketing/marketing-site.md "Story beats"): Draw's markers and
// erasers, Plan's boards, and the writing and slides of Illustrate's articles and slide pages.
export * from './feature-art/whiteboard';
export * from './feature-art/plan';
export * from './feature-art/documents';
