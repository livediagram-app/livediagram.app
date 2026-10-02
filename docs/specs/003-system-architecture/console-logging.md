# Console logging

How the editor (`apps/live`) writes to the browser console. Every decision point logs a line with
a recognisable fingerprint (`[drive-mirror] pass-end`, `[board-scene] landed`), so a behaviour is
traceable from the console. A production console stays clean all the same: the people using the
app are not reading it, and a page that writes a dozen lines on every load hides the one warning
that matters.

## Three kinds of line

- **Trace lines** (a decision taken, a step done: what used to be `console.info`, `console.log`
  and `console.debug`) go through **`debugLog(message, ...details)`** (`apps/live/lib/debug-log.ts`),
  the editor's one logger. They show:
  - always in development and in tests (any build but production);
  - in a production build only when the **debug flag** is set for the browser:
    `localStorage['livediagram:debug']` holding `*` (everything) or a comma-separated list of
    fingerprint scopes (`drive-mirror,board-scene`; the scope is the text in the message's leading
    brackets, or the word before its first colon). The flag is read once per page load: set it in
    the console, then reload.
- **Warnings** (`console.warn`): something went wrong but the app carried on. Always shown.
- **Errors** (`console.error`): always shown.

No file in `apps/live` calls `console.info`, `console.log` or `console.debug` directly; a unit
test holds that line (only `debug-log.ts` itself may). An inline boot script, which runs before any
module can load (the stale-page guard), writes no trace lines: its two lines are warnings, and its
source is static, never built from values. A Node script
under `apps/live` (a fixture generator) writes its own output with `process.stdout.write`.

## Workers

A web worker has no `localStorage`, so in a production build its own trace lines are off; in
development they show as anywhere else. A trace line a spec or a user relies on is therefore
written by the page, from the worker's answer: the boundary model's `[photo-model] ready on …` and
`[photo-model] N notes on … in … ms` are written by its client (`apps/live/lib/photo-model/client.ts`)
as the `ready` and `cues` answers arrive.

## End-to-end tests

The end-to-end suite runs the production build, so its fixture sets the debug flag (`*`) on every
page of every browser context it creates. Specs that wait for a trace line (the Drive mirror's
`[drive-mirror] pass-end`, the photo reader's `[photo-…]`) see it exactly as before, while a real
production page never writes it.
