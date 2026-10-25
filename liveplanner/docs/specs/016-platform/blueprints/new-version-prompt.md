# New version prompt blueprint

Derived from [New version prompt](../new-version-prompt.md).

## Domain and naming

| Term                  | Identifier                   | Meaning                                                  |
| --------------------- | ---------------------------- | -------------------------------------------------------- |
| Project format number | `PROJECT_FORMAT`             | The version of the stored project shapes                 |
| Format header         | `PROJECT_FORMAT_HEADER`      | `X-Liveplanner-Format`, on every api response            |
| Room format message   | `{ kind: 'format'; format }` | The room's number, sent to each socket on `hello`        |
| Server format         | `serverProjectFormat()`      | The highest number this page has heard from the server   |
| Outdated editor       | `newVersionAvailable()`      | Server format greater than the editor's `PROJECT_FORMAT` |
| Prompt                | `NewVersionPrompt`           | The status panel offering "Reload"                       |

## Modules

| File                                                 | Responsibility                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/project-format.ts`          | `PROJECT_FORMAT`, `PROJECT_FORMAT_HEADER`, `parseProjectFormat`                                       |
| `apps/api/src/server-release-header.ts`              | `withServerRelease(response, buildId)`: the headers on every response but a 101                       |
| `apps/api/src/index.ts`                              | The worker's `fetch` returns `withServerRelease(..., env.BUILD_ID)`                                   |
| `apps/api/src/responses.ts`                          | `CORS_HEADERS` exposes the header                                                                     |
| `apps/api/src/plan-room/plan-room.ts`                | Sends the room format message on `hello`                                                              |
| `packages/api-schema/src/room-messages.ts`           | The `format` kind on `ServerMessage` and `RoomIncoming`                                               |
| `apps/editor/lib/server-release.ts`                  | The page's server release store (format number and build id, docs/specs/016-platform/stale-builds.md) |
| `apps/editor/lib/api/core.ts`                        | `apiFetch` notes the header                                                                           |
| `apps/editor/lib/api/room.ts`                        | The room client notes the message                                                                     |
| `../packages/workbench/src/lib/reload-when-saved.ts` | `reloadWhenSaved`: wait for a settled save, then reload, or give up                                   |
| `apps/editor/components/chrome/NewVersionPrompt.tsx` | The prompt                                                                                            |
| `apps/editor/app/project/[id]/useAutosave.ts`        | Returns `hasUnsavedChanges()`                                                                         |
| `apps/editor/app/project/[id]/EditorView.tsx`        | Mounts the prompt with `hasUnsavedChanges`                                                            |

## Interfaces and contracts

```ts
// packages/api-schema/src/project-format.ts
export const PROJECT_FORMAT = 2;
export const PROJECT_FORMAT_HEADER = 'X-Liveplanner-Format';
export function parseProjectFormat(value: unknown): number | null; // a positive integer or null

// apps/api/src/server-release-header.ts
export function withServerRelease(response: Response, buildId: string | null | undefined): Response;

// apps/editor/lib/server-release.ts
export function noteServerProjectFormat(value: unknown): void; // ignores anything unparsable
export function serverProjectFormat(): number | null;
export function newVersionAvailable(): boolean;
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

// apps/editor/components/chrome/NewVersionPrompt.tsx
export function NewVersionPrompt(props: {
  hasUnsavedChanges: () => boolean;
  reload?: () => void; // window.location.reload by default
}): JSX.Element | null;
```

- `parseProjectFormat`: a number or numeric string that is a safe positive integer; anything
  else null.
- `withServerRelease`: returns the response itself for status 101 (a WebSocket upgrade carries
  its socket and must not be rebuilt); otherwise a response with the header set, rebuilt from
  body, status and headers when the original's headers are immutable.
- `noteServerProjectFormat` keeps the maximum seen and notifies listeners only when it rises.

## Behaviour and state

Prompt states: `hidden` (nothing newer, or dismissed at the current server format), `offered`,
`saving` (Reload pressed, waiting), `unsaved` (gave up waiting). Transitions:

- `hidden` → `offered`: `newVersionAvailable()` becomes true and the user has not dismissed this
  server format. Fires `track('UI', 'Opened', 'NewVersionPrompt')` once per page.
- `offered` | `unsaved` → `saving`: Reload. Fires `track('UI', 'Used', 'NewVersionPrompt')`.
- `saving` → reload: `hasUnsavedChanges()` false within `RELOAD_SAVE_WAIT_MS` (checked every
  `RELOAD_SAVE_POLL_MS`, immediately first).
- `saving` → `unsaved`: still unsaved at the deadline.
- `offered` | `unsaved` → `hidden`: Not now, remembering the dismissed server format; a higher
  one offers again.

`hasUnsavedChanges()` (useAutosave): false when read-only or not hydrated; else true while a save
is in flight or `computeTabSaveDiff(lastSaved, tabs, …).hasChanges`, read through refs so it is
current when called.

## Presentation and UX

- Fixed, bottom centre, 80 px above the viewport edge (clear of the bottom tab bar, as the photo
  import bars sit), on the chrome layer (`z-[var(--z-chrome)]`, below dialogs); max width 28rem,
  never wider than the viewport less 2rem; rounded panel, chrome surface colours (`bg-white` /
  `dark:bg-slate-900`, border `slate-200` / `slate-700`), shadow.
- Text: "A new version of liveplanner is ready." In `saving`: "Saving your changes…" with the
  buttons disabled. In `unsaved`: "Your latest changes aren't saved yet. Reload once they are."
- Buttons: primary "Reload", secondary "Not now" (the shared `Button` primitive).

## Accessibility

- Container `role="status"` (polite); not focused on appearance; buttons keyboard reachable with
  the shared focus ring; contrast as the shared chrome (AA in both themes); no animation, so
  reduced motion is honoured by construction.

## Web experience

- `position: fixed`, so showing it shifts no layout (no CLS); it renders nothing until needed and
  adds no request (no LCP or INP cost).

## Errors and edge cases

| Case                                           | Handling                                     |
| ---------------------------------------------- | -------------------------------------------- |
| Header missing (an old api, a proxy strips it) | Ignored; the room message may still arrive   |
| Garbage header or message value                | Ignored                                      |
| Server number lower than the editor's          | No prompt                                    |
| Save keeps failing (offline, 5xx, 403)         | `unsaved` after the wait; never reloads      |
| Read-only or shared view                       | Reloads at once                              |
| Deploy window (editor older for seconds)       | Prompt may reappear after a reload; harmless |

## Security and trust

The number is not a secret and grants nothing; a forged value can only show a reload prompt.

## Observability

- `console.info('[project-format] newer on the server', { editor, server })` when the prompt is
  first offered.
- `console.warn('[project-format] reload waiting for unsaved changes', { waitedMs })` on giving up.

## Testing

| Rule                                                     | Test                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Format parsing                                           | `packages/api-schema/src/project-format.test.ts`                       |
| Header on responses, not on a 101; CORS exposes it       | `apps/api/src/server-release-header.test.ts`                           |
| Room sends its format on hello                           | `apps/api/src/project-room.test.ts`                                    |
| Store keeps the maximum, notifies on rise, ignores junk  | `apps/editor/lib/server-release.test.ts`                               |
| `apiFetch` and the room client note the number           | `apps/editor/lib/api/core.test.ts`, `apps/editor/lib/api/room.test.ts` |
| Reload waits for a settled save, gives up after the wait | `../packages/workbench/src/lib/reload-when-saved.test.ts`              |
| Prompt states, copy, role, keyboard, telemetry           | `apps/editor/components/chrome/NewVersionPrompt.test.tsx`              |
| `hasUnsavedChanges`                                      | `apps/editor/app/project/[id]/useAutosave.test.tsx`                    |
| An older editor against a newer server (Playwright)      | `apps/editor/e2e/new-version-prompt.spec.ts`                           |

## Constants and configuration

| Constant              | Value  | Provenance                                | Safe range      |
| --------------------- | ------ | ----------------------------------------- | --------------- |
| `PROJECT_FORMAT`      | 2      | Packed stroke points                      | rises by 1 only |
| `RELOAD_SAVE_WAIT_MS` | 10,000 | Autosave debounce 600 ms plus a slow save | 3,000 to 30,000 |
| `RELOAD_SAVE_POLL_MS` | 200    | Imperceptible wait, a local check only    | 50 to 1,000     |

## Defaults ledger

See [DEFAULTS.md](./DEFAULTS.md).
