// Thin D1 wrapper, split by resource. Diagrams + tabs each have their
// own table — `diagrams.data` (the legacy single-row JSON blob) was
// dropped in migration 0006. See spec/13 for the rollout that got us
// here.
//
// This barrel re-exports every resource module so callers keep
// importing from '../db'. Add a new query to its resource module (or
// a new module here) rather than growing one file.

export * from './diagrams';
export * from './tabs';
export * from './participants';
export * from './share';
export * from './shared';
export * from './change-log';
export * from './folders';
export * from './teams';
export * from './account';
export * from './images';
export * from './telemetry';
