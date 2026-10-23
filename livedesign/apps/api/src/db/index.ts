// Thin D1 wrapper, split by resource. Designs + tabs each have their
// own table (docs/specs/006-design/per-tab-storage.md).
//
// This barrel re-exports every resource module so callers keep
// importing from '../db'. Add a new query to its resource module (or
// a new module here) rather than growing one file.

export * from './designs';
export * from './team-recent';
export * from './tab-save-design';
export * from './tabs';
export * from './share';
export * from './shared';
export * from './folders';
export * from './favourites';
export * from './tags';
export * from './placement-defaults';
export * from './teams';
export * from './api-tokens';
export * from './notify-email-claims';
export * from './account';
export * from './images';
export * from './image-grants';
export * from './timeline';
export * from './collab-index';
export * from './ws-tickets';
export * from './trash';
export * from './empty-design-sweep';
export * from './changesets';
