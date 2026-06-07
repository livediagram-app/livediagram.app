// HTTP/WS plumbing shared by every api-client domain module: base URL,
// the hybrid-identity header builder, the response-handling helpers, the
// shared DELETE shape, and the module-level token / share-password
// state. The per-domain call collections (diagrams, tabs, share, …)
// import from here; callers go through the lib/api-client.ts barrel.
import type {
  ChangeLogEntry,
  Diagram,
  DiagramSummary,
  Folder,
  ShareLink,
  ShareRole,
  TabRecord,
} from '@livediagram/api-schema';
import type { Tab } from '@livediagram/diagram';
import { readLocalStorageSafe, writeLocalStorageSafe } from '../local-storage-safe';

// `API_BASE` resolution:
//   1. `NEXT_PUBLIC_API_BASE` env var if set — used for local dev (e.g.
//      `https://www.livediagram.app/api` to hit prod, or
//      `http://localhost:8787/api` to point at a local `wrangler dev`
//      session of `@livediagram/api`). Baked into the static export at
//      build time so it works in deployed builds too.
//   2. Default `/api` — same-origin, served by the router worker in
//      production (router stitches the api worker onto the same
//      hostname). This is what the deployed live app uses.
//
// All requests carry an `X-Owner-Id` header set to the current
// participant's id — the API uses it as the diagram-owner filter and
// for create-time `owner_id` — unless a Clerk token provider is wired
// up (see below), in which case a Bearer token replaces it.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Hard cap on how long the Explorer's diagram-list spinner spins before
// we give up and show whatever we have. Both mount paths that load the
// list (the editor and the new-diagram screen) arm this same safety
// timeout, so it lives here next to the list-load calls.
export const DIAGRAM_LIST_LOAD_SAFETY_MS = 10_000;

// WebSocket counterpart of API_BASE. Converts http(s):// to ws(s):// for
// absolute bases; for the same-origin default it builds from
// `window.location` at call time (so SSR-safe modules can still import
// this file).
export function wsUrl(path: string): string {
  if (API_BASE.startsWith('http://')) {
    return `ws://${API_BASE.slice('http://'.length)}${path}`;
  }
  if (API_BASE.startsWith('https://')) {
    return `wss://${API_BASE.slice('https://'.length)}${path}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${API_BASE}${path}`;
}

// Envelope shapes the API wraps payloads in. The canonical inner
// types come from `@livediagram/api-schema`; these envelopes are
// purely client-side glue for `expectOk` to destructure.
export type DiagramResponse = { diagram: Diagram };
export type TabResponse = { tab: TabRecord };
export type ListResponse = { diagrams: DiagramSummary[] };
export type FolderResponse = { folder: Folder };
export type FoldersResponse = { folders: Folder[] };
export type ShareLinkResponse = { link: ShareLink };
// The share-links list doubles as the owner's read of the diagram's
// share password (spec/24): owner-only endpoint, so it's safe in the
// clear. `password` is null when the diagram has no password.
export type ShareLinksResponse = { links: ShareLink[]; password: string | null };
export type SharePasswordResponse = { password: string | null };
export type ChangeLogListResponse = { entries: ChangeLogEntry[] };
export type ChangeLogAppendResponse = { entry: ChangeLogEntry };
export type ParticipantResponse = {
  participant: { id: string; name: string; color: string; createdAt: number };
};

// Result of resolving a share code (spec/24). A protected diagram
// returns `passwordRequired` instead of the diagram until the visitor
// supplies the matching password; `invalid` is true only when a wrong
// password was submitted (vs none yet), so the gate can show an error.
export type SharedDiagramResolution =
  | { diagram: Diagram; role: ShareRole }
  | { passwordRequired: true; invalid: boolean };

// Hybrid identity (spec/04, spec/11). When a token provider has been
// registered via `setTokenProvider` and resolves to a non-null Clerk
// session token, every request goes out with
// `Authorization: Bearer <jwt>` and NO `X-Owner-Id` — the api worker
// verifies the token, derives the owner from the `sub` claim, and
// ignores the legacy header. Without a provider (or when the provider
// resolves to null — guest, or signed out), requests go out with
// `X-Owner-Id: <participant-id>` as before.
//
// Module-level state (rather than threading a tokenProvider through
// 22 function signatures) because livediagram ships only as a static
// export — single browser tab, single-threaded, single Clerk session
// per page load. The editor wires it up once in a `useEffect`
// (`setTokenProvider(() => getToken())`) and clears on unmount.
// Tests reset between cases via the same setter.
//
// Visitors on a share URL include their own participant id PLUS the
// share code that admitted them in `X-Share-Code` — the api checks
// the code's role before allowing the write. Share-code visitors who
// happen to also be signed in send Bearer + X-Share-Code; the
// per-link role still gates write access.
//
// `body: true` adds `Content-Type: application/json` for write
// requests; GETs / DELETEs omit it.
type TokenProvider = () => Promise<string | null>;

let currentTokenProvider: TokenProvider | null = null;

// Register / clear the Clerk token provider. Call sites:
//   - `apps/live/app/diagram/[id]/editor-page.tsx`: useEffect with
//     `setTokenProvider(() => getToken())` and a cleanup that clears
//     it.
//   - `apps/live/app/new/page.tsx`: same pattern.
// Pass `null` to clear (sign-out / unmount).
export function setTokenProvider(provider: TokenProvider | null): void {
  currentTokenProvider = provider;
}

// Share password for the current visitor session (spec/24). Same
// module-level rationale as the token provider: rather than thread the
// password through every call signature, the viewer sets it once after
// passing the password gate and `apiHeaders` (HTTP) + `connectRoom`
// (WebSocket) attach it automatically. Owners never set it, so their
// requests never carry it. Null = no password in play.
let sessionSharePassword: string | null = null;
export function setSessionSharePassword(password: string | null): void {
  sessionSharePassword = password && password.length > 0 ? password : null;
}
export function getSessionSharePassword(): string | null {
  return sessionSharePassword;
}

// localStorage cache so a returning visitor on a protected diagram
// doesn't have to retype the password every load. Keyed by share code
// rather than diagram id because the diagram id only resolves AFTER
// the gate is passed; the share code is what the URL carries on
// arrival. Entry lifetime is bounded by the share code's validity:
//   - Code revoked: apiLoadShared returns null, no cache read happens
//     on later loads anyway (the bootstrap surfaces NotFound first).
//   - Password rotated: the cached value comes back from the server
//     as passwordRequired { invalid: true }, the bootstrap clears the
//     entry, and the gate prompts the visitor afresh.
// Threat model (spec/24) is anti-URL-guessing, not cryptographic
// protection of user data; storing plain text mirrors what the api
// worker already does in D1. The owner cleartext-reads it on the
// Share dialog anyway.
const SHARE_PASSWORD_CACHE_PREFIX = 'livediagram:share-password:';
export function readCachedSharePassword(shareCode: string): string | null {
  const raw = readLocalStorageSafe(`${SHARE_PASSWORD_CACHE_PREFIX}${shareCode}`);
  return raw && raw.length > 0 ? raw : null;
}
export function writeCachedSharePassword(shareCode: string, password: string | null): void {
  const key = `${SHARE_PASSWORD_CACHE_PREFIX}${shareCode}`;
  if (password && password.length > 0) writeLocalStorageSafe(key, password);
  else writeLocalStorageSafe(key, '');
}

// Exported for direct testing of the hybrid identity gate (spec/04):
// Bearer token wins when present, X-Owner-Id is the fallback, and the
// two MUST NOT coexist on a single request (an api worker that sees
// both would derive owner from the JWT and silently ignore the header
// , which is fine for happy paths but leaves a confusing footprint in
// audit logs). Internal callers still get the same return type, so
// the export is additive.
export async function apiHeaders(
  ownerId: string,
  opts: { share?: string | null; body?: boolean } = {},
): Promise<HeadersInit> {
  const h: Record<string, string> = {};
  const token = currentTokenProvider ? await currentTokenProvider() : null;
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  } else {
    h['X-Owner-Id'] = ownerId;
  }
  if (opts.body) h['Content-Type'] = 'application/json';
  if (opts.share) h['X-Share-Code'] = opts.share;
  // Share password (spec/24) rides on every request once the visitor
  // has passed the gate; the api ignores it unless the diagram is
  // protected + accessed via a share code. Owners never set it.
  if (sessionSharePassword) h['X-Share-Password'] = sessionSharePassword;
  return h;
}

// Response-handling shape every fetch call here used to inline:
// throw a labelled Error on non-2xx, otherwise parse JSON. The `action`
// string gets baked into the thrown message so debugging keeps the
// caller's intent without a stack walk.
export async function expectOk<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return (await res.json()) as T;
}

// Same as `expectOk`, but 404 means "doesn't exist" not "broken" —
// used by read paths where a missing row is a legitimate result the
// caller wants to handle (welcome flow, share-resolution etc.)
export async function expectOkOrNull<T>(res: Response, action: string): Promise<T | null> {
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return (await res.json()) as T;
}

// For endpoints with no response body (DELETE, write-only PUT). Same
// error-on-non-ok contract; nothing to return.
export async function expectOkVoid(res: Response, action: string): Promise<void> {
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
}

// DELETE that tolerates 404 — used everywhere "remove this if it
// exists" is the semantic. A racing concurrent delete shouldn't
// throw.
export async function expectOkOr404Void(res: Response, action: string): Promise<void> {
  if (!res.ok && res.status !== 404) throw new Error(`${action} failed: ${res.status}`);
}

// Shared DELETE shape. Every apiDelete*-style endpoint in this file
// (8 callers at the time of writing) did the same three things:
// fetch with method DELETE + apiHeaders, then either expectOkOr404Void
// (the common "remove this if it exists" semantic) or expectOkVoid
// (the rarer "404 should surface as a failure" case). Centralising
// that here means a new DELETE caller never has to think about which
// helper to reach for, and the share-code wiring is opt-in via the
// `share` field instead of a 4th positional argument on every site.
export async function apiDelete(
  url: string,
  ownerId: string,
  opts: {
    action: string;
    // Forwarded to apiHeaders when present. Skip the field (or pass
    // null) for endpoints that don't accept a share-code path.
    share?: string | null;
    // Defaults to true: most DELETEs are idempotent ("if it exists,
    // remove it") and a racing concurrent delete should NOT throw.
    // Pass `false` to require a successful 2xx and surface 404 as a
    // real error.
    allow404?: boolean;
  },
): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, opts.share === undefined ? {} : { share: opts.share }),
  });
  if (opts.allow404 ?? true) {
    await expectOkOr404Void(res, opts.action);
  } else {
    await expectOkVoid(res, opts.action);
  }
}

// `templateChosen` is UI-only state (have we dismissed the per-tab
// template picker yet?). It rides on the Tab type so the editor can
// flip it locally, but there's no reason for the server to persist
// it — strip before every write so it stays purely a frontend
// concern. Shared by apiCreateDiagram + apiSaveTab.
export function stripTemplateChosen(tab: Tab): Tab {
  if (tab.templateChosen === undefined) return tab;
  const { templateChosen: _tc, ...rest } = tab;
  void _tc;
  return rest as Tab;
}
