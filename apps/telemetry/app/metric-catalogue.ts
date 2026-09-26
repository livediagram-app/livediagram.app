// Charts defined once and reused (docs/specs/017-telemetry/telemetry.md). A chart stack references these
// rather than declaring its own copies, so one chart can sit in several
// stacks, on several tabs, or on its own, and its wording stays in one place.
// Split by Dashboard area under ./catalogue; this module is the one place
// the views and tests import them from.

export * from './catalogue/collaboration';
export * from './catalogue/connections';
export * from './catalogue/content';
export * from './catalogue/email';
export * from './catalogue/features';
export * from './catalogue/health';
export * from './catalogue/settings';
export * from './catalogue/visitors';
