// Per-card mini illustrations for the landing-page feature grids.
//
// Each export is a small, self-contained, animated mock of the editor
// surface its card describes (boards of cards, Sheets, dashboards, forms,
// presence avatars, floating panels). Motion is pure CSS (fa-* classes +
// keyframes in app/feature-art/*.css) so it survives the static export
// with no JS and settles under prefers-reduced-motion.
//
// The scenes live in ./feature-art/* by card family; shared primitives
// (Frame + colour constants) live in ./feature-art/shared. This barrel
// re-exports them so callers keep importing from '@/components/FeatureArt'.
export * from './feature-art/canvas';
export * from './feature-art/together';
export * from './feature-art/sharing';
export * from './feature-art/foundations';
export * from './feature-art/embeds-timeline';
// Plan's boards, cards, views and dashboards (docs/specs/026-plan/plan-mode.md).
export * from './feature-art/plan';
export * from './feature-art/plan-views';
export * from './feature-art/plan-dashboard';
export * from './feature-art/plan-dashboard-more';
export * from './feature-art/plan-more';
// Sheet tabs (docs/specs/029-sheets/sheet.md), and boards brought in from other tools.
export * from './feature-art/sheet';
export * from './feature-art/sheet-more';
export * from './feature-art/imports';
// Forms (docs/specs/030-forms/forms.md): built in place, shared by link, responses landing.
export * from './feature-art/forms';
export * from './feature-art/forms-more';
