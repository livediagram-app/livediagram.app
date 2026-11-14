# New version prompt blueprint

Derived from [New version prompt](../new-version-prompt.md).

## Domain and naming

| Term                 | Identifier                   | Meaning                                                                   |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Design format number | `DESIGN_FORMAT`              | The version of the stored design shapes                                   |
| Format header        | `DESIGN_FORMAT_HEADER`       | `X-Livedesign-Format`, on every api response                              |
| Room format message  | `{ kind: 'format'; format }` | The room's number, sent to each socket on `hello`                         |
| Server format        | `serverDesignFormat()`       | The highest number this page has heard from the server                    |
| Newer editor live    | `checkLiveEditor()`          | What a reload would load: the page's build meta against `EDITOR_BUILD_ID` |
| Prompt               | `NewVersionPrompt`           | The status panel offering "Reload"                                        |

## Modules

| File                                                               | Responsibility                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/design-format.ts`                         | `DESIGN_FORMAT`, `DESIGN_FORMAT_HEADER`, `parseDesignFormat`                                          |
| `apps/api/src/server-release-header.ts`                            | `withServerRelease(response, buildId)`: the headers on every response but a 101                       |
| `apps/api/src/index.ts`                                            | The worker's `fetch` returns `withServerRelease(..., env.BUILD_ID)`                                   |
| `apps/api/src/responses.ts`                                        | `CORS_HEADERS` exposes the header                                                                     |
| `apps/api/src/design-room/design-room.ts`                          | Sends the room format message on `hello`                                                              |
| `packages/api-schema/src/room-messages.ts`                         | The `format` kind on `ServerMessage` and `RoomIncoming`                                               |
| `apps/live/lib/server-release.ts`                                  | The page's server release store (format number and build id, docs/specs/016-platform/stale-builds.md) |
| `apps/live/lib/api/core.ts`                                        | `apiFetch` notes the header                                                                           |
| `apps/live/lib/api/room.ts`                                        | The room client notes the message                                                                     |
| `../packages/workbench/src/lib/reload-when-saved.ts`               | `reloadWhenSaved`: wait for a settled save, then reload, or give up                                   |
| `apps/live/components/chrome/NewVersionPrompt.tsx`                 | This editor's binding of the shared prompt: its name, `DESIGN_FORMAT`, store, meta name and build id  |
| `../packages/workbench/src/components/chrome/NewVersionPrompt.tsx` | The prompt, shared by all five editors                                                                |
| `../packages/workbench/src/hooks/ui/useNewerEditorLive.ts`         | Waits until a reload would load a newer editor: checks, the minute, the bound, hidden pauses          |
| `../packages/workbench/src/lib/live-editor-build.ts`               | `checkLiveEditor`: one GET of the page, its build meta read and compared                              |
| `apps/live/app/design/[id]/useAutosave.ts`                         | Returns `hasUnsavedChanges()`                                                                         |
| `apps/live/app/design/[id]/EditorView.tsx`                         | Mounts the prompt with `hasUnsavedChanges`                                                            |

## Interfaces and contracts

```ts
// packages/api-schema/src/design-format.ts
export const DESIGN_FORMAT = 2;
export const DESIGN_FORMAT_HEADER = 'X-Livedesign-Format';
export function parseDesignFormat(value: unknown): number | null; // a positive integer or null

// apps/api/src/server-release-header.ts
export function withServerRelease(response: Response, buildId: string | null | undefined): Response;

// apps/live/lib/server-release.ts
export function noteServerDesignFormat(value: unknown): void; // ignores anything unparsable
export function serverDesignFormat(): number | null;
export function subscribeServerRelease(listener: () => void): () => void;
export function resetServerReleaseForTests(): void;

// ../packages/workbench/src/lib/reload-when-saved.ts
export const RELOAD_SAVE_WAIT_MS = 10_000;
export const RELOAD_SAVE_POLL_MS = 200;
export function reloadWhenSaved(opts: {
  hasUnsavedChanges: () => boolean;
  reload: () => void;
  waitMs?: number;
  pollMs?: number;
}): Promise<'reloaded' | 'unsaved'>;

// apps/live/components/chrome/NewVersionPrompt.tsx
export function NewVersionPrompt(props: {
  hasUnsavedChanges: () => boolean;
  reload?: () => void; // window.location.reload by default
}): JSX.Element | null; // binds the shared prompt below

// ../packages/workbench/src/components/chrome/NewVersionPrompt.tsx
export const STILL_ARRIVING = 'The new version is still on its way. Try again in a minute.';
export function NewVersionPrompt(props: {
  product: string; // 'livedesign'
  editorFormat: number; // DESIGN_FORMAT
  serverFormat: () => number | null;
  subscribe: (listener: () => void) => () => void;
  buildMetaName: string; // 'livedesign-build'
  editorBuildId: string | null; // EDITOR_BUILD_ID
  hasUnsavedChanges: () => boolean;
  reload?: () => void;
}): JSX.Element | null;

// ../packages/workbench/src/hooks/ui/useNewerEditorLive.ts
export const LIVE_BUILD_POLL_MS = 60_000;
export const LIVE_BUILD_MAX_CHECKS = 30;
export function useNewerEditorLive(active: boolean, check: () => Promise<LiveEditor>): boolean;

// ../packages/workbench/src/lib/live-editor-build.ts
export type LiveEditor = 'newer' | 'same' | 'unknown';
export const LIVE_BUILD_TIMEOUT_MS = 5_000;
export const LIVE_BUILD_READ_LIMIT = 256 * 1024;
export function readBuildMeta(html: string, metaName: string): string | null;
export function checkLiveEditor(opts: {
  metaName: string;
  ownBuild: string | null;
  url?: string; // the page's own path and query by default
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LiveEditor>;
```

- `checkLiveEditor`: `unknown` with no request when `ownBuild` is null; else one `GET`
  (`cache: 'no-store'`, `credentials: 'same-origin'`, aborted after `LIVE_BUILD_TIMEOUT_MS`), its body read
  as it streams until the meta is found, `</head>` arrives, the stream ends or
  `LIVE_BUILD_READ_LIMIT` is passed, then cancelled. A non-2xx, a failure, a timeout or no meta is
  `unknown`; the meta equal to `ownBuild` is `same`, else `newer`.
- `readBuildMeta`: scans `<meta` tags (text, never a parser), so a script that names the meta in
  a selector is never read as one; the first tag carrying `name="<metaName>"` gives its `content`,
  empty or unterminated content null.

- `parseDesignFormat`: a number or numeric string that is a safe positive integer; anything
  else null.
- `withServerRelease`: returns the response itself for status 101 (a WebSocket upgrade carries
  its socket and must not be rebuilt); otherwise a response with the header set, rebuilt from
  body, status and headers when the original's headers are immutable.
- `noteServerDesignFormat` keeps the maximum seen and notifies listeners only when it rises.

## Behaviour and state

Prompt states: `hidden` (nothing newer, or dismissed at the current server format), `waiting`
(newer on the server, but the page still serves this editor), `offered`, `saving` (Reload pressed,
waiting), `unsaved` (gave up waiting), `arriving` (saved, but the page still serves this editor).
Transitions:

- `hidden` → `waiting`: the server format rises above the editor's. `useNewerEditorLive` checks
  at once (`checkLiveEditor`).
- `waiting` → `waiting`: `same`; asks again after `LIVE_BUILD_POLL_MS` while
  the page is visible (its visibility state). Hidden clears the timer; visible again schedules the
  rest of the minute from the last check (at once when it has passed). No second timer while one
  runs or a check is out.
- `waiting` → `offered`: `newer` or `unknown`, or the `LIVE_BUILD_MAX_CHECKS`th `same` (which
  warns), and the user has not dismissed this server format. Settled once per page: a later rise
  offers at once. Fires `track('UI', 'Opened', 'NewVersionPrompt')` once per page.
- `offered` | `unsaved` | `arriving` → `saving`: Reload. Fires `track('UI', 'Used', 'NewVersionPrompt')`.
- `saving` → reload: `hasUnsavedChanges()` false within `RELOAD_SAVE_WAIT_MS` (checked every
  `RELOAD_SAVE_POLL_MS`, immediately first), then `checkLiveEditor` answers `newer` or `unknown`.
- `saving` → `arriving`: saved, but `checkLiveEditor` answers `same`. Both buttons stay enabled;
  Reload runs the same steps again.
- `saving` → `unsaved`: still unsaved at the deadline.
- `offered` | `unsaved` | `arriving` → `hidden`: Not now, remembering the dismissed server format; a higher
  one offers again.

`hasUnsavedChanges()` (useAutosave): false when read-only or not hydrated; else true while a save
is in flight or `computeTabSaveDiff(lastSaved, tabs, …).hasChanges`, read through refs so it is
current when called.

## Presentation and UX

- Fixed, bottom centre, 80 px above the viewport edge (clear of the bottom tab bar, as the photo
  import bars sit), on the chrome layer (`z-[var(--z-chrome)]`, below dialogs), lifted one above the overlay
  layer (`z-[calc(var(--z-overlay)+1)]`, still below `--z-canvas-modal` and dialogs) on a phone and a
  short window while a start panel is open (`useStartPanelOpen`), whose sheet sits on the overlay layer there; max width 28rem,
  never wider than the viewport less 2rem; rounded panel, chrome surface colours (`bg-white` /
  `dark:bg-slate-900`, border `slate-200` / `slate-700`), shadow.
- Text: "A new version of livedesign is ready." In `saving`: "Saving your changes…" with the
  buttons disabled. In `unsaved`: "Your latest changes aren't saved yet. Reload once they are." In `arriving`:
  "The new version is still on its way. Try again in a minute."
- Buttons: primary "Reload", secondary "Not now" (the shared `Button` primitive).

## Accessibility

- Container `role="status"` (polite); not focused on appearance; buttons keyboard reachable with
  the shared focus ring; contrast as the shared chrome (AA in both themes); no animation, so
  reduced motion is honoured by construction.

## Web experience

- `position: fixed`, so showing it shifts no layout (no CLS); it renders nothing until needed. Its one
  request (the page, read to the end of its head, about 13 KB of a 64 KB page, 15 KB gzipped
  whole) goes out only after the format rises, off the main thread's critical path (no LCP or INP
  cost), then at most once a minute while the page is visible and the deploy window lasts.

## Errors and edge cases

| Case                                              | Handling                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Header missing (an old api, a proxy strips it)    | Ignored; the room message may still arrive                                 |
| Garbage header or message value                   | Ignored                                                                    |
| Server number lower than the editor's             | No prompt                                                                  |
| Save keeps failing (offline, 5xx, 403)            | `unsaved` after the wait; never reloads                                    |
| Read-only or shared view                          | Reloads at once                                                            |
| Deploy window (api newer, page still this editor) | `waiting`: no prompt until the page serves a different build, or 30 checks |
| Reload while the page still serves this editor    | `arriving`: no reload, says the new version is still on its way            |
| No build id (local development)                   | `unknown`, no request: offered at once                                     |
| Page request fails, is slow or has no meta        | `unknown`: offered (as before this check)                                  |

## Security and trust

The number is not a secret and grants nothing; a forged value can only show a reload prompt.

## Observability

- `console.info('[design-format] newer on the server', { editor, server })` when the prompt is
  first offered.
- `console.warn('[design-format] reload waiting for unsaved changes', { waitedMs })` on giving up.
- `console.warn('[design-format] the page still serves this editor; offering the reload anyway', { checks })` after
  the last check.
- `console.info('[design-format] reload held: the page still serves this editor')` (a trace line) on `arriving`.

## Testing

| Rule                                                                        | Test                                                                    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Format parsing                                                              | `packages/api-schema/src/design-format.test.ts`                         |
| Header on responses, not on a 101; CORS exposes it                          | `apps/api/src/server-release-header.test.ts`                            |
| Room sends its format on hello                                              | `apps/api/src/design-room.test.ts`                                      |
| Store keeps the maximum, notifies on rise, ignores junk                     | `apps/live/lib/server-release.test.ts`                                  |
| `apiFetch` and the room client note the number                              | `apps/live/lib/api/core.test.ts`, `apps/live/lib/api/room.test.ts`      |
| Reload waits for a settled save, gives up after the wait                    | `../packages/workbench/src/lib/reload-when-saved.test.ts`               |
| Build meta read, page check: same, newer, unknown, streaming stops, timeout | `../packages/workbench/src/lib/live-editor-build.test.ts`               |
| Waits while the same build is served: the minute, the bound, hidden pauses  | `../packages/workbench/src/hooks/ui/useNewerEditorLive.test.tsx`        |
| Prompt states, copy, role, keyboard, telemetry, Reload held while arriving  | `../packages/workbench/src/components/chrome/NewVersionPrompt.test.tsx` |
| This editor's binding: its format, store and copy                           | `apps/live/components/chrome/NewVersionPrompt.test.tsx`                 |
| `hasUnsavedChanges`                                                         | `apps/live/app/design/[id]/useAutosave.test.tsx`                        |
| An older editor against a newer server (Playwright)                         | `apps/live/e2e/new-version-prompt.spec.ts`                              |

## Constants and configuration

| Constant                | Value  | Provenance                                                                  | Safe range        |
| ----------------------- | ------ | --------------------------------------------------------------------------- | ----------------- |
| `DESIGN_FORMAT`         | 2      | Packed stroke points                                                        | rises by 1 only   |
| `RELOAD_SAVE_WAIT_MS`   | 10,000 | Autosave debounce 600 ms plus a slow save                                   | 3,000 to 30,000   |
| `RELOAD_SAVE_POLL_MS`   | 200    | Imperceptible wait, a local check only                                      | 50 to 1,000       |
| `LIVE_BUILD_POLL_MS`    | 60,000 | One small request a minute during a deploy window                           | 30,000 to 300,000 |
| `LIVE_BUILD_MAX_CHECKS` | 30     | Half an hour; the window measured on 12 November 2026 ran 13 minutes        | 10 to 60          |
| `LIVE_BUILD_TIMEOUT_MS` | 5,000  | A slow page answers unknown rather than hold Reload                         | 2,000 to 15,000   |
| `LIVE_BUILD_READ_LIMIT` | 256 KB | Far past the head (about 13 KB); a page without `</head>` is not read whole | 64 KB to 1 MB     |

## Defaults ledger

See [DEFAULTS.md](./DEFAULTS.md).
