// HTTP/WS plumbing shared by every api-client domain module, bound to this editor: the shared core
// (@liveworkspace/workbench/lib/api/core: the request funnel, identity headers, response helpers, the DELETE shape,
// the token and share-password state) with this editor's guest token, error telemetry, grants, release signal and
// share-password cache prefix, plus the envelope types only this editor's calls read. The per-domain call
// collections import from here; callers go through the lib/api-client.ts barrel.
import type {
  ApiToken,
  CommunityShareInfo,
  LiveDoc,
  Folder,
  ShareLink,
  ShareRole,
} from '@livedesign/api-schema';
import { DESIGN_FORMAT_HEADER, BUILD_ID_HEADER } from '@livedesign/api-schema';
import { noteServerBuild, noteServerDesignFormat } from '../server-release';
import { stampTabKind, type Tab } from '@livedesign/design';
import { readGuestToken } from '../guest-token';
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import {
  createApiCore,
  stripUiTabFields,
  type ApiDeleteOptions,
  type ApiHeadersOptions,
  type TokenProvider,
} from '@liveworkspace/workbench/lib/api/core';
import { confinementRefusal, noteWorkbenchResponse } from './workbench-confinement';
import { withDesignGrant } from './design-grants';
// A workbench session's confinement (workbench-confinement.ts), part of this module's surface.
export {
  getWorkbenchConfinement,
  setWorkbenchConfinement,
  subscribeWorkbenchSessionRefused,
  WorkbenchConfinedError,
} from './workbench-confinement';
// Every non-2xx the expectOk* helpers throw, and every fetch that rejects in
// apiFetch, is reported through here (docs/specs/017-telemetry/telemetry.md 'Error').
import {
  markReported,
  reportApiError,
  reportApiWarning,
  reportNetworkError,
  reportNoSessionToken,
} from './error-report';

// Where the api lives (@liveworkspace/workbench/lib/api/base.ts): `NEXT_PUBLIC_API_BASE` when the build set it (local
// development), else same-origin `/api`, served by the router worker in production.
export { API_BASE };
// The error every non-2xx response throws (@liveworkspace/workbench/lib/api/api-error.ts).
export { ApiError };
export {
  SAVE_TIMEOUT_BASE_MS,
  SESSION_TOKEN_TIMEOUT_MS,
  SessionTokenUnavailableError,
  saveTimeoutMs,
  saveTimeoutSignal,
  stripUiTabFields,
  wsUrl,
} from '@liveworkspace/workbench/lib/api/core';

// Hard cap on how long the Explorer's design-list spinner spins before
// we give up and show whatever we have. Both mount paths that load the
// list (the editor and the new-design screen) arm this same safety
// timeout, so it lives here next to the list-load calls.
export const DESIGN_LIST_LOAD_SAFETY_MS = 10_000;

// The share-password cache's localStorage prefix (share-password.md): one entry per share code, so a returning
// visitor on a protected design doesn't retype the password every load.
export const SHARE_PASSWORD_CACHE_PREFIX = 'livedesign:share-password:';

// Each callback reads its module at call time, so a test's mock of one is the one called.
const core = createApiCore({
  readGuestToken: () => readGuestToken(),
  report: {
    apiError: (status, action, code) => reportApiError(status, action, code),
    apiWarning: (type) => reportApiWarning(type),
    networkError: (method, url, err) => reportNetworkError(method, url, err),
    noSessionToken: () => reportNoSessionToken(),
    markReported: (err) => markReported(err),
  },
  // A request about one design carries the index's grant on it (design-grants.ts), fetched once per ten minutes.
  withGrant: (apiBase, input, init) => withDesignGrant(apiBase, input, init),
  // The server release signal rides every response: the format number and the live build id
  // (docs/specs/016-platform/new-version-prompt.md, docs/specs/016-platform/stale-builds.md).
  noteResponse: (res) => {
    noteServerDesignFormat(res.headers?.get(DESIGN_FORMAT_HEADER));
    noteServerBuild(res.headers?.get(BUILD_ID_HEADER));
  },
  // A workbench session's request outside its allow-list is refused unsent; every response passes it.
  confinement: {
    refusal: (url, init) => confinementRefusal(url, init),
    noteResponse: (init, res) => noteWorkbenchResponse(init, res),
  },
  sharePasswordCachePrefix: SHARE_PASSWORD_CACHE_PREFIX,
});

// Every api request goes through here rather than bare `fetch` (the shared core's funnel).
// `designGrant: false` sends the request as it is, at once: the unload flush, which adds the grant it holds itself
// and cannot wait for one (a beforeunload handler runs to its end before anything it awaits).
export function apiFetch(
  input: string,
  init?: RequestInit,
  opts: { designGrant?: boolean } = {},
): Promise<Response> {
  return core.apiFetch(input, init, { grant: opts.designGrant });
}

// Declared as functions, as they were before the core was shared, so a module that reaches one while an import cycle
// is still loading this one gets the function (the core is read only when one is called).
export function registerTokenProvider(provider: TokenProvider): () => void {
  return core.registerTokenProvider(provider);
}
// Set / clear the provider outright, dropping every registration (tests, and callers that own the whole identity).
export function setTokenProvider(provider: TokenProvider | null): void {
  core.setTokenProvider(provider);
}
// Synchronous read of the last token apiHeaders fetched: for the unload beacon only.
export function getLastKnownToken(): string | null {
  return core.getLastKnownToken();
}
// Share password for the current visitor session (docs/specs/013-workspace/share-password.md).
export function setSessionSharePassword(password: string | null): void {
  core.setSessionSharePassword(password);
}
export function getSessionSharePassword(): string | null {
  return core.getSessionSharePassword();
}
export function readCachedSharePassword(shareCode: string): string | null {
  return core.readCachedSharePassword(shareCode);
}
export function writeCachedSharePassword(shareCode: string, password: string | null): void {
  core.writeCachedSharePassword(shareCode, password);
}
// The identity half of every request: the account's token, else the guest's, else nothing (a link visitor).
export function identityHeaders(ownerId: string, token: string | null): Record<string, string> {
  return core.identityHeaders(ownerId, token);
}
// The Bearer this page sends, for a request that goes outside apiHeaders: the account's, else the guest's.
export function currentBearer(): Promise<string | null> {
  return core.currentBearer();
}
export function apiHeaders(ownerId: string, opts?: ApiHeadersOptions): Promise<HeadersInit> {
  return core.apiHeaders(ownerId, opts);
}
// Throws an ApiError on a non-2xx, else parses the JSON.
export function expectOk<T>(
  res: Response,
  action: string,
  expected?: (code: string | null) => boolean,
): Promise<T> {
  return core.expectOk<T>(res, action, expected);
}
// As expectOk, but a 404 answers null.
export function expectOkOrNull<T>(res: Response, action: string): Promise<T | null> {
  return core.expectOkOrNull<T>(res, action);
}
// For endpoints with no response body.
export function expectOkVoid(res: Response, action: string): Promise<void> {
  return core.expectOkVoid(res, action);
}
// The shared DELETE shape: a 404 tolerated unless `allow404: false`.
export function apiDelete(url: string, ownerId: string, opts: ApiDeleteOptions): Promise<void> {
  return core.apiDelete(url, ownerId, opts);
}

// Envelope shapes the API wraps payloads in. The canonical inner
// types come from `@livedesign/api-schema`, as do the envelopes the
// MCP server reads too (DesignResponse, TabResponse, ...); the ones
// below are the editor-only glue for `expectOk` to destructure.
export type FolderResponse = { folder: Folder };
export type FoldersResponse = { folders: Folder[] };
export type TokensResponse = { tokens: ApiToken[] };
// POST /api/tokens returns the one-time plaintext secret alongside the new
// token's public metadata (the secret is never retrievable again).
export type CreateTokenResponse = {
  token: string;
  id: string;
  name: string | null;
  expiresAt: number;
};
// The share-links list doubles as the owner's read of the design's
// share password (docs/specs/013-workspace/share-password.md): owner-only endpoint, so it's safe in the
// clear. `password` is null when the design has no password.
// The share password itself is never returned, only whether one is set: the
// api keeps a hash (docs/specs/013-workspace/share-password.md).
export type ShareLinksResponse = { links: ShareLink[]; passwordSet: boolean };
export type SharePasswordResponse = { passwordSet: boolean };
// GET /api/participants/<id>. `null` when you ask for your own id before you have saved a profile
// (docs/specs/015-api/api.md); another absent id is a 404.
export type ParticipantResponse = {
  participant: {
    id: string;
    name: string;
    color: string;
    createdAt: number;
  } | null;
};

// Result of resolving a share code (docs/specs/013-workspace/share-password.md). A protected design
// returns `passwordRequired` instead of the design until the visitor
// supplies the matching password; `invalid` is true only when a wrong
// password was submitted (vs none yet), so the gate can show an error.
export type SharedDesignResolution =
  // `tabId`: the tab a tab-scoped link opens (docs/specs/013-workspace/tab-scoped-share-links.md); null = All tabs.
  // `community`: set only when the code is a Community post's link (docs/specs/025-community/community.md).
  | {
      design: LiveDoc;
      role: ShareRole;
      tabId: string | null;
      community: CommunityShareInfo | null;
    }
  | { passwordRequired: true; invalid: boolean };

// Strip fields that ride on the Tab type for the editor's convenience
// but must never enter the persisted tab body (`tabs.data`):
//   - `templateChosen`: UI-only (have we dismissed the per-tab
//     template picker yet?); a pure frontend concern.
//   - `folder`: per-design membership (docs/specs/006-design/tab-folders.md) that lives on the
//     design_tabs link, carried via the meta/reorder path. Leaking it
//     into the shared body would make a folder follow the tab into
//     every design it's shared into, breaking per-design scope.
// Shared by apiCreateDesign + apiSaveTab.
// The single normalisation every tab passes through on its way to the wire:
// strip the UI-only fields, and stamp the tab kind.
//
// The kind is stamped HERE rather than only at the editor's commit choke
// point because several mutation paths reach persistence (the history
// commit, the non-undoable session tick, a remote apply), and a field whose
// presence depends on which one ran is a field no reader can trust.
// `stampTabKind` resolves a tab stored before `kind` existed, so it is stamped the same way on its next save.
export function tabForWire(tab: Tab): Tab {
  return stampTabKind(stripUiTabFields(tab));
}
