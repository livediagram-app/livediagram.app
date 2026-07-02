// Barrel for the livediagram HTTP/WS client. The implementation is split
// by domain under lib/api/* (core plumbing + diagrams / tabs / share /
// change-log / folders / self / room / images / preferences / ai); this
// file re-exports the public surface so existing `@/lib/api-client`
// imports keep working unchanged.

// Wire-format types re-exported under the names the live app has
// historically imported from here. The canonical definitions live in
// `@livediagram/api-schema`; see that package's index.ts for the shapes
// and per-type rationale.
export type {
  ChangeLogEntry,
  ChangeLogKind,
  Folder,
  ImageSummary,
  ShareLink,
  ShareLinkExpiry,
  ShareRole,
  TeamInvite,
  TeamListItem,
  TeamMember,
  TeamRole,
} from '@livediagram/api-schema';

// Core plumbing the app uses directly (base URL, identity headers,
// token / share-password session state). The internal helpers
// (expectOk family, apiDelete, envelope types) stay package-local to
// lib/api/* and are deliberately not re-exported here — except
// `ApiError`, the error type every call throws on non-2xx: callers
// catch it to branch on `err.status` / `err.code` (the api worker's
// snake_case error token), so it belongs in the public surface.
export { ApiError } from './api/core';
export {
  API_BASE,
  DIAGRAM_LIST_LOAD_SAFETY_MS,
  setTokenProvider,
  setSessionSharePassword,
  getSessionSharePassword,
  readCachedSharePassword,
  writeCachedSharePassword,
} from './api/core';

export * from './api/diagrams';
export * from './api/tabs';
export * from './api/share';
export * from './api/change-log';
export * from './api/folders';
export * from './api/custom-themes';
export * from './api/teams';
export * from './api/tokens';
export * from './api/oauth';
export * from './api/self';
export * from './api/room';
export * from './api/images';
export * from './api/preferences';
export * from './api/ai';
export * from './api/unfurl';
