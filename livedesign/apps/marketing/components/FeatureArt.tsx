// Per-card mini illustrations for the feature grids.
//
// Each export is a small, self-contained, animated mock of the editor surface its card describes
// (pages on the canvas, presence avatars, floating panels). Motion is pure CSS (fa-* classes and
// keyframes in app/feature-art/*.css) so it survives the static export with no JS and settles under
// prefers-reduced-motion.
//
// The scenes live in ./feature-art/*, one file per subject; shared primitives (Frame and the colour
// constants) live in ./feature-art/shared. This barrel re-exports them so callers keep importing
// from '@/components/FeatureArt'.
export * from './feature-art/canvas';
export * from './feature-art/together';
export * from './feature-art/sharing';
export * from './feature-art/foundations';
export * from './feature-art/features';
export * from './feature-art/embeds-timeline';
export * from './feature-art/reach';
export * from './feature-art/versatility-more';
// Presentation mode (docs/specs/012-collaboration/presentation-mode.md): decks, the full-screen slide, notes, and the
// fact that presenting is yours alone.
export * from './feature-art/present';
// Pages (docs/specs/007-editor/pages-mode.md): pages, backgrounds, export.
export * from './feature-art/infographics';
export * from './feature-art/infographics-export';
export * from './feature-art/pages-more';
// Logo and wireframe pages.
export * from './feature-art/logo';
export * from './feature-art/logo-more';
