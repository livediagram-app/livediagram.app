// Thin D1 wrapper, split by resource. Projects + tabs each have their
// own table; see docs/specs/006-project/per-tab-storage.md.
//
// This barrel re-exports every resource module so callers keep
// importing from '../db'. Add a new query to its resource module (or
// a new module here) rather than growing one file.

export * from './projects';
export * from './team-recent';
export * from './tab-save-project';
export * from './tabs';
export * from './participants';
export * from './share';
export * from './shared';
export * from './folders';
export * from './favourites';
export * from './tags';
export * from './placement-defaults';
export * from './custom-themes';
export * from './team-invites';
export * from './teams';
export * from './api-tokens';
export * from './email-lifecycle';
export * from './notify-email-claims';
export * from './notification-prefs';
export * from './account';
export * from './auth-sightings';
export * from './telemetry';
export * from './timeline';
export * from './collab-index';
export * from './items';
export * from './sheets';
export * from './ws-tickets';
export * from './trash';
export * from './empty-project-sweep';
export * from './changesets';
export * from './forms';
export * from './tab-outlines';
