# New version prompt

An editor left open across a deploy keeps running the code it loaded. When the server starts
serving documents in a shape that code cannot read (for example [Stroke points](../006-document/stroke-points.md)),
the open editor asks, calmly, to be reloaded.

## The document format number

- **`DOCUMENT_FORMAT`** (`@livediagram/api-schema`) is one integer, the version of the stored
  document shapes. The editor is built with it and the api worker serves it, from the same
  definition, so a deploy that changes it changes both.
- It is bumped only when an older editor can no longer read what the server now serves: a new
  stored shape that replaces an old one. A new optional field that old editors ignore does not
  bump it, so an ordinary deploy never prompts anybody.
- `2` is the first value: packed stroke points. (`1`, every shape before them, is implied: those
  editors predate the check.)

## How a running editor learns the server's number

No request is made for it; it rides traffic the editor already has. This **server release signal**
also carries the live build id, which [Stale builds](./stale-builds.md) uses; one mechanism, two
facts.

- **Every api response** carries the header `X-Livediagram-Format: <n>`, and
  `X-Livediagram-Build: <id>` when the deploy set one (the WebSocket upgrade excepted). The editor's one fetch wrapper (`apiFetch`) reads it. Both headers are exposed to
  cross-origin callers (`Access-Control-Expose-Headers`), for a self-hosted or local editor on
  another origin.
- **The realtime room** sends `{ kind: 'format', format, build? }` to each socket as it joins. A deploy
  restarts the room, every editor reconnects, so a viewer that makes no api calls hears it too.
- A value that is missing or not a positive integer is ignored.

## When the prompt shows

- When a server number is **greater** than the editor's own. Equal or lower (an editor deployed a
  moment before its api) shows nothing.
- Once seen, it stays shown for the page's life; "Not now" hides it until the page is next
  reloaded or a newer number arrives.
- Only the document editor (`/document/…`, the shared and embedded views included) shows it: it is
  the page that holds unsaved work and renders stored shapes.

## The prompt

- A small panel at the bottom centre of the screen, above the canvas, in the app's chrome
  colours, light and dark. It never covers the dialogs and never takes focus.
- Copy: **"A new version of livediagram is ready."** with two buttons, **"Reload"** and
  **"Not now"**.
- `role="status"`, so a screen reader announces it once, politely; both buttons are in the tab
  order and work from the keyboard; it honours reduced motion (no slide-in).
- **Never reloads by itself.**
- **Never loses work.** "Reload" first waits until everything edited has been saved (no
  difference left between the editor's tabs and its last saved copy, and no save in flight),
  showing **"Saving your changes…"** meanwhile, then reloads. If that has not happened within
  ten seconds (`RELOAD_SAVE_WAIT_MS`), it does not reload and says **"Your latest changes aren't
  saved yet. Reload once they are."**, keeping both buttons. A read-only view has nothing to save
  and reloads at once.

## Telemetry

- `track('UI', 'Opened', 'NewVersionPrompt')` the first time the prompt shows on a page.
- `track('UI', 'Used', 'NewVersionPrompt')` when "Reload" is pressed.

## Deploy window

The frontends and the api deploy in parallel. An editor loaded in the few seconds between the
api's deploy and the editor's may reload into the same older build and see the prompt again on
its next api response; once the editor is deployed a reload ends it.

## Help

The troubleshooting article "My Changes Are Missing" explains the prompt under "How saving works":
what it means, that Reload saves first, and that Not now is always safe.
