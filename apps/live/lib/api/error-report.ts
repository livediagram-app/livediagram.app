// Error telemetry hook for the api client (spec/22 'Error' category). This
// module can't import lib/telemetry directly: it sits under the
// user-preferences -> api-client import cycle that already forced the emitter
// lazy, so the editor's boot registers a reporter instead (same module-level
// pattern as setTokenProvider in core.ts). A no-op while unwired (SSR, tests,
// other hosts of this lib).
//
// Two failures reach it, each labelled with WHERE, from closed vocabularies:
//
//   - a non-2xx response: `Http<status>.<Action>` (`Http403.SaveTab`), the
//     action being the caller's own intent string. Reporting only the status
//     made a spike unattributable: 297 `Http403` in a day tells you something
//     is being refused and nothing about what.
//   - a request that never got a response (fetch rejected: DNS, CORS, a
//     dropped connection): `Network.<Method>.<Route>`
//     (`Network.Put.Diagrams.Tabs`), since apiFetch sees the URL but not the
//     caller's action. The route label keeps only the api's fixed route words,
//     never an id or share code.
import { apiRouteLabel, errorTypeToken } from '@livediagram/api-schema';

let apiErrorReporter: ((type: string) => void) | null = null;

export function setApiErrorReporter(fn: ((type: string) => void) | null): void {
  apiErrorReporter = fn;
}

function report(type: string): void {
  try {
    apiErrorReporter?.(type);
  } catch {
    // Telemetry can never throw into the caller's error handling.
  }
}

// The api-client's intent string ('save tab') becomes a PascalCase suffix
// ('SaveTab'). Safe by construction: these strings are written in lib/api,
// never derived from anything a user typed, and errorTypeToken keeps only
// letters and digits so a future one can't smuggle in a path, id, or share
// code.
export function apiErrorType(status: number, action: string): string {
  return errorTypeToken(`Http${status}`, action);
}

export function reportApiError(status: number, action: string): void {
  report(apiErrorType(status, action));
}

export function networkErrorType(method: string, url: string): string {
  return errorTypeToken('Network', apiRouteLabel(method, url));
}

// A rejected fetch. Two rejections are not faults and stay out of the count:
// an abort is the caller cancelling on purpose, and a browser that knows it
// is offline is the user's connection, not ours (it would also report every
// autosave retry until the connection came back).
export function reportNetworkError(method: string, url: string, err: unknown): void {
  if (err instanceof Error && err.name === 'AbortError') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  report(networkErrorType(method, url));
}
