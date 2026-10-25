// Barrel for the liveplanner HTTP/WS client. The implementation is split
// by domain under lib/api/* (core plumbing + projects / tabs / share /
// folders / self / room / preferences / capabilities); this
// file re-exports the public surface so existing `@/lib/api-client`
// imports keep working unchanged.

// Wire-format types re-exported under the names the editor app has
// historically imported from here. The canonical definitions live in
// `@liveplanner/api-schema`; see that package's index.ts for the shapes
// and per-type rationale.
export type { ShareLink, ShareLinkExpiry, ShareRole } from '@liveplanner/api-schema';

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
  setTokenProvider,
  registerTokenProvider,
  setSessionSharePassword,
  getSessionSharePassword,
  readCachedSharePassword,
  writeCachedSharePassword,
} from './api/core';

export * from './api/projects';
export * from './api/tabs';
export * from './api/changesets';
export * from './api/share';
export * from '@liveworkspace/workbench/lib/api/tokens';
export * from '@liveworkspace/workbench/lib/api/oauth';
export * from './api/self';
export * from './api/room';
export * from './api/preferences';
export * from './api/capabilities';
// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
export * from './api/workbench';
export * from './api/team-people';
