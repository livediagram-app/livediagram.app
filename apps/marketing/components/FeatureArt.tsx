// Per-card mini illustrations for the landing-page feature grids.
//
// Each export is a small, self-contained, animated mock of the editor
// surface its card describes (dot-grid canvas, brand-blue shapes, pinned
// arrows, presence avatars, floating panels). Motion is pure CSS (fa-*
// classes + keyframes in globals.css) so it survives the static export
// with no JS and settles under prefers-reduced-motion.
//
// The scenes were split out of this (formerly 2,400-line) file into
// ./feature-art/* by section; shared primitives (Frame + color
// constants) live in ./feature-art/shared. This barrel re-exports them
// so callers keep importing from '@/components/FeatureArt'.
export * from './feature-art/canvas';
export * from './feature-art/foundations';
export * from './feature-art/features';
export * from './feature-art/motion';
export * from './feature-art/versatility';
export * from './feature-art/content';
