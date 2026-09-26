// Error telemetry hook for the api client (docs/specs/017-telemetry/telemetry.md 'Error' category). This
// module can't import lib/telemetry directly: it sits under the
// user-preferences -> api-client import cycle that already forced the emitter
// lazy, so the editor's boot registers a reporter instead (same module-level
// pattern as setTokenProvider in core.ts). A no-op while unwired (SSR, tests,
// other hosts of this lib).
//
// Two failures reach it, each labelled with WHERE, from closed vocabularies:
//
//   - a non-2xx response: `Http<status>.<Action>.<Code>`
//     (`Http403.SaveTab.Forbidden`), the action being the caller's own intent
//     string and the code the worker's snake_case `error` token. Reporting
//     only the status made a spike unattributable: 297 `Http403` in a day
//     tells you something is being refused and nothing about what, and 8
//     `Http401.SaveTab` could have been any of three different rules.
//   - a request that never got a response (fetch rejected: DNS, CORS, a
//     dropped connection): `Network.<Method>.<Route>`
//     (`Network.Put.Diagrams.Tabs`), since apiFetch sees the URL but not the
//     caller's action. The route label keeps only the api's fixed route words,
//     never an id or share code.
//   - a signed-in owner with no session token, whose request is never sent
//     (core.ts SessionTokenUnavailableError): `Auth.NoSessionToken`.
//   - any other autosave failure (reportSaveFailure): `SaveFailed.<Kind>`.
//     Without it, a throw outside the api client showed "Couldn't save your
//     changes" and left no trace at all.
//
// Each type reports at most ERROR_EMIT_CAP_PER_TYPE times per page load, the
// same budget the uncaught-error path has (docs/specs/017-telemetry/telemetry.md). A request that fails in
// a loop floods as hard as a throw that does: one editor stuck refetching a
// forbidden tab sent `Http403.LoadTab` every 15 to 65 seconds for weeks,
// nearly half of every stored event.
import { apiRouteLabel, errorNameToken, errorTypeToken } from '@livediagram/api-schema';
import { createPerTypeCap } from '@livediagram/telemetry-client';

let apiErrorReporter: ((type: string) => void) | null = null;
let allowReport = createPerTypeCap();

// Failures already reported where they happened, so the autosave's catch-all
// (reportSaveFailure) doesn't count them a second time.
const reported = new WeakSet<object>();

export function markReported(err: unknown): void {
  if (typeof err === 'object' && err !== null) reported.add(err);
}

// Wiring a reporter (or clearing it) starts a fresh budget, so a test, or a
// host that re-registers, isn't charged for reports made before it.
export function setApiErrorReporter(fn: ((type: string) => void) | null): void {
  apiErrorReporter = fn;
  allowReport = createPerTypeCap();
}

function report(type: string): void {
  try {
    if (!apiErrorReporter || !allowReport(type)) return;
    apiErrorReporter(type);
  } catch {
    // Telemetry can never throw into the caller's error handling.
  }
}

// The worker's `error` field is a snake_case token (`sign_in_required`) on
// almost every route; the few that put a sentence there are left out.
const ERROR_CODE_TOKEN = /^[a-z][a-z0-9_]*$/;

// The api-client's intent string ('save tab') becomes a PascalCase suffix
// ('SaveTab'), then the worker's error token ('Forbidden'). Safe by construction: these strings are written in lib/api,
// never derived from anything a user typed, and errorTypeToken keeps only
// letters and digits so a future one can't smuggle in a path, id, or share
// code.
export function apiErrorType(status: number, action: string, code: string | null = null): string {
  const token = code && ERROR_CODE_TOKEN.test(code) ? code : null;
  return errorTypeToken(`Http${status}`, action, token);
}

export function reportApiError(status: number, action: string, code: string | null = null): void {
  report(apiErrorType(status, action, code));
}

export function reportNoSessionToken(): void {
  report('Auth.NoSessionToken');
}

// The autosave's catch-all, so every failed save leaves a trace exactly once.
export function reportSaveFailure(err: unknown): void {
  if (typeof err === 'object' && err !== null && reported.has(err)) return;
  report(errorTypeToken('SaveFailed', errorNameToken(err)));
}

export function networkErrorType(method: string, url: string): string {
  return errorTypeToken('Network', apiRouteLabel(method, url));
}

// A rejected fetch. Two rejections are not faults and stay out of the count:
// an abort is the caller cancelling on purpose, and a browser that knows it
// is offline is the user's connection, not ours (it would also report every
// autosave retry until the connection came back).
export function reportNetworkError(method: string, url: string, err: unknown): void {
  // Decided here either way, so the autosave catch-all never recounts it.
  markReported(err);
  if (err instanceof Error && err.name === 'AbortError') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  report(networkErrorType(method, url));
}
