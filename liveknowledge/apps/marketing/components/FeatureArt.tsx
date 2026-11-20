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
// Review & history: Version History, Request Approval, Walkthroughs and a Live Embed of another app's file.
export * from './feature-art/review';
export * from './feature-art/foundations';
// Undo and redo, on this product's own surface.
export * from './feature-art/undo';
export * from './feature-art/reach';
export * from './feature-art/versatility-more';
// Presentation mode (docs/specs/012-collaboration/presentation-mode.md): decks, the full-screen slide, notes, and the
// fact that presenting is yours alone.
export * from './feature-art/present';
export * from './feature-art/slide-layouts';
// Builds: a slide's points numbered by step, brought in one press at a time while presenting.
export * from './feature-art/slide-builds';
// Flashcards (docs/specs/007-editor/flashcards.md): the stack, flipped one card at a time.
export * from './feature-art/flashcards';
// Infographic pages (docs/specs/007-editor/pages-mode.md): pages, layouts, backgrounds, export.
export * from './feature-art/infographics';
export * from './feature-art/infographics-export';
export * from './feature-art/pages-more';
// Articles: writing on pages, its flow, its looks.
export * from './feature-art/article';
export * from './feature-art/documents';
export * from './feature-art/article-looks';
// Tables, contents, headers and footers in an article's writing; Find and Replace; Word and PowerPoint import.
export * from './feature-art/article-blocks';
export * from './feature-art/writing-tools';
