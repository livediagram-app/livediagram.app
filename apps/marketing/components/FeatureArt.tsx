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
// The isometric view.
export * from './feature-art/room';
// Infographic pages (docs/specs/007-editor/pages-mode.md): pages, layouts, backgrounds, export.
export * from './feature-art/infographics';
export * from './feature-art/infographics-export';
export * from './feature-art/logo';
export * from './feature-art/article';
// The mode categories (docs/specs/019-marketing/marketing-site.md "Story beats"): Draw's markers and
// erasers, Plan's boards, and the writing and slides of Pages mode's articles and slide pages.
export * from './feature-art/whiteboard';
export * from './feature-art/whiteboard-pen';
export * from './feature-art/plan';
export * from './feature-art/plan-views';
export * from './feature-art/plan-dashboard';
export * from './feature-art/documents';
export * from './feature-art/article-looks';
export * from './feature-art/slide-layouts';
// Sheets on a Plan tab, two tabs side by side, and boards brought in from other tools.
export * from './feature-art/sheet';
// Forms (docs/specs/030-forms/forms.md): built in place, shared by link, responses landing.
export * from './feature-art/forms';
export * from './feature-art/side-by-side';
export * from './feature-art/imports';
// Event storming boards and their photo import; the sequence diagram, charts and code blocks; search
// and live images.
export * from './feature-art/storming';
export * from './feature-art/canvas-data';
export * from './feature-art/reach';
// Plan cards beyond the board, Sheets beyond formulas, Forms beyond the build, pages beyond
// layouts, and Draw's dock.
export * from './feature-art/plan-more';
export * from './feature-art/sheet-more';
export * from './feature-art/forms-more';
export * from './feature-art/pages-more';
export * from './feature-art/whiteboard-dock';
