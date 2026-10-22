// Barrel for the liveplanner HTTP/WS client. The implementation is split
// by domain under lib/api/* (core plumbing + documents / tabs / share /
// folders / self / room / preferences / ai); this
// file re-exports the public surface so existing `@/lib/api-client`
// imports keep working unchanged.

// Wire-format types re-exported under the names the live app has
// historically imported from here. The canonical definitions live in
// `@liveplanner/api-schema`; see that package's index.ts for the shapes
// and per-type rationale.
export type {
  Folder,
  ShareLink,
  ShareLinkExpiry,
  ShareRole,
  TeamInvite,
  TeamListItem,
  TeamMember,
  TeamMemberStatus,
  TeamRole,
} from '@liveplanner/api-schema';

// Core plumbing the app uses directly (base URL, identity headers,
// token / share-password session state). The internal helpers
// (expectOk family, apiDelete, envelope types) stay package-local to
// lib/api/* and are deliberately not re-exported here — except
// `ApiError`, the error type every call throws on non-2xx: callers
// catch it to branch on `err.status` / `err.code` (the api worker's
// snake_case error token), so it belongs in the public surface.
export { ApiError, SessionTokenUnavailableError } from './api/core';
export { reportSaveFailure, setApiErrorReporter, setApiWarningReporter } from './api/error-report';
export {
  API_BASE,
  DOCUMENT_LIST_LOAD_SAFETY_MS,
  setTokenProvider,
  registerTokenProvider,
  setSessionSharePassword,
  getSessionSharePassword,
  readCachedSharePassword,
  writeCachedSharePassword,
} from './api/core';

export * from './api/documents';
export * from './api/tabs';
export * from './api/changesets';
export * from './api/qa-board';
export * from './api/share';
export * from './api/folders';
export * from './api/custom-themes';
export * from './api/teams';
export * from './api/tokens';
export * from './api/oauth';
export * from './api/self';
export * from './api/room';
export * from './api/favourites';
export * from './api/placement-defaults';
export * from './api/timeline';
export * from './api/activity';
export * from './api/home';
export * from './api/preferences';
export * from './api/ai';
export * from './api/unfurl';
export * from './api/trash';
// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
export * from './api/workbench';
