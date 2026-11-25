# Error words: blueprint

Derived from [Error words](../error-words.md). Paths start at the repo root.

## The helper

`packages/ui/src/error-words.ts` (`@liveworkspace/ui/error-words`), plain TypeScript with no React:

- `errorKindOf(error)`: the class of anything a caller holds. A string is a code; a number is a status; an object is
  read for `code` or `error` (a string) and `status` (a number), which covers `IndexError`, `SnapshotsApiError`,
  `TeamsError` and the `{ ok: false, status, error }` results. A known code wins over the status. A fetch's own
  `TypeError` ("Failed to fetch", "Load failed", "NetworkError…"), status 0 and the code `offline` read as Offline
  when `navigator.onLine` is false, else Unreachable (a 5xx while offline reads as Offline too). An error with no
  class stays Unknown while offline, so a real fault never reads as the connection.
- `errorWords(error, { retriesItself })`: `{ kind, message, canRetry }`. `retriesItself` picks Offline's "It tries
  again when you reconnect." line, for a read that reruns on its own.
- `errorMessage(error, options)`: the words alone.
- `failedBecause(lead, error)`: an action's lead and the class's words; the lead with "Try again." for Unknown.
- `ownErrorWords(own, code, status?)`: a package's own map first, then the class's words. The code `offline` while
  the browser is offline takes the Offline words over the map's own (which say "couldn’t reach").
- `errorCodeForStatus(status)`: the code a refusal with no body code gets: `signed_out` (401), `forbidden` (403),
  `not_found` (404, 410), `conflict` (409), `rate_limited` (429), `server_error` (5xx), else `failed`.
- `whenBackOnline(run)`: runs `run` once on the next `online` event (at once when already online); returns the
  unsubscribe.
- Guard: `packages/ui/src/error-words.test.ts` covers every class, from a code, a status and a thrown error, the
  retry flags, both Offline lines, `failedBecause`, `ownErrorWords` and `whenBackOnline`.

## Where it is used

- `packages/settings-ui`: `accountErrorMessage` (`account-panels/errors.ts`), `settingsApiErrorMessage`
  (`store.ts`) and `webhookError` (`connections/connections-api.ts`) fall back through `ownErrorWords`.
  `bearerSettingsRequest` (`request.ts`) names a refusal with no body code by `errorCodeForStatus`, as does the
  site's `accountApi` (`liveworkspace/apps/site/lib/account-api.ts`). `ErrorNote` (`account-panels/error-note.tsx`)
  takes the refusal's `error`: with it, a Try Again shows only when the class can retry, and an Offline read swaps
  its words for the "tries again" line and reruns its action on reconnect (`AiKeyPanel`'s load).
- `packages/explorer`: `teamErrorMessage` (`data/teams.ts`) falls back through `ownErrorWords`, and a Teams change
  with no body code is named by `errorCodeForStatus` (a 504 keeps its own `timedOut`). `failureText`
  (`data/errors.ts`) keeps its own words for the index's codes, then answers `failedBecause(lead, error)`, the lead
  being the caller's fallback without its "Try again.".
- `packages/snapshots`: `refusalOf` (`client.ts`) words a refusal with no server message by `errorMessage`;
  `useSnapshots` words a thrown error the same way and keeps `listError` (`ErrorWords`) for the list: the dialog shows
  its message, Try Again only when `canRetry` and not Offline, and an Offline list reloads on `whenBackOnline`.
- `packages/workbench` `AreaErrorBoundary`: a caught error with a class other than Unknown shows "<Label> couldn’t
  load." and its words, Try Again only when `canRetry`; Offline (a chunk that couldn't load, or a request with no
  answer, while offline) keeps waiting for the connection; Unknown keeps "Something went wrong in <label>." and Try
  Again.
