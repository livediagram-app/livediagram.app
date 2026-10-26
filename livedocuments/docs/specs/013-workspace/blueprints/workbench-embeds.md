# Workbench embeds: blueprint

Derived from [Workbench embeds](../workbench-embeds.md), with the frame headers of [Embeds](../embeds.md), the token
choke point of [API](../../015-api/api.md#auth), the levels of [Share roles](../share-roles.md), the commands of
[CLI](../../015-api/cli.md) and the refs and kind words of [Document views](../../024-agents/document-views.md).

Pairing, tickets, sessions, revocation, the sweep and the pairing page are the platform's
([Workbenches](../../../../../liveworkspace/docs/specs/011-workbench/workbench.md)), in liveworkspace's accounts Worker. This blueprint
covers how livedocuments uses that service: the forward, the session check and confinement in the api, the frame and
the editor in it, the messages, the selection reference and the CLI.

## Scope, by file

| Area                | Files                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contract     | `packages/api-schema/src/workbench.ts` (constants, wire types, `WORKBENCH_ROUTES`, `WORKSPACE_ROUTES`, `workbenchRouteVerdict`, `parseWorkbenchOrigin`, `capWorkbenchRole`, `pairingCoversScope`, `normaliseWorkbenchName`, `WORKBENCH_ERROR_CODES`), `packages/api-schema/src/workbench-messages.ts` (`WORKBENCH_MESSAGE_TYPES`, `parseWorkbenchMessage`)                             |
| Api                 | `apps/api/src/index.ts` (the forward and the choke point), `apps/api/src/auth/workbench-session.ts` (`resolveWorkbenchSession`, `noteWorkbenchRoom`, `sessionPrefixOf`), `apps/api/src/auth/workbench-confinement.ts` (`workbenchRefusal`), `apps/api/src/room-access-client.ts` (`closeWorkbenchSessions`), `apps/api/src/routes/internal-items.ts` (`workbenchClose`)                |
| The page            | `apps/editor/app/embed/workbench/` (`page.tsx`, `WorkbenchPage.tsx`, `WorkbenchStatus.tsx`, `workbench-machine.ts`, `workbench-fragment.ts`, `useWorkbenchHandshake.ts`, `useWorkbenchRenewal.ts`)                                                                                                                                                                                     |
| The workspace frame | `apps/editor/app/embed/workbench/` (`WorkspaceFrame.tsx`, `ExplorerHost.tsx`, `useWorkspaceNavigation.ts`, `useWorkspacePlaceMessages.ts`, `create-in-place.ts`, `apps/editor/app/embed/workbench/explorer/page.tsx`), `apps/editor/lib/workbench/` (`workspace-place.ts`, `workbench-frame-path.ts`, `workbench-port.ts`)                                                             |
| The editor          | `apps/editor/app/document/[id]/` (`editor-surface.ts`, `editor-page.tsx`, `workbench-bootstrap.ts`, `useWorkbenchMessages.ts`, `useWorkbenchEnd.ts`), `apps/editor/components/providers/` (`WorkbenchAuthBridge.tsx`, `workbench-session-context.ts`, `AuthProvider.tsx`), `apps/editor/components/chrome/WorkbenchChrome.tsx`, `apps/editor/hooks/persistence/useAccountBootstrap.ts` |
| Client api          | `apps/editor/lib/api/workbench.ts` (`apiRedeemWorkbenchTicket`, `apiEndWorkbenchSession`, `apiListWorkbenchPairings`, `apiUnpairWorkbench`), `apps/editor/lib/api/workbench-confinement.ts` (`WorkbenchConfinedError`, `setWorkbenchConfinement`, `confinementRefusal`, `noteWorkbenchResponse`)                                                                                       |
| Settings            | `apps/editor/hooks/persistence/useWorkbenchPairings.ts`, `apps/editor/components/dialogs/settings/SettingsTokensRow.tsx`, `SettingsTokenPairings.tsx`                                                                                                                                                                                                                                  |
| CLI                 | `packages/agent-verbs/src/verbs/workbench.ts` (`workbench.open`), `apps/cli/src/commands/workbench-pair.ts` (`workbench pair`)                                                                                                                                                                                                                                                         |

`apps/editor/lib/workbench-bindings.ts` and `lib/workbench-keys.ts` bind the `@liveworkspace/workbench` package (the
shared editor), not this feature.

## Domain and naming

- **Workbench**: the developer tool that frames the page, known by its **origin**.
- **Pairing**: liveworkspace's record that one token may mint for one origin, with a scope (`document` or
  `workspace`; `pairingCoversScope`: a workspace pairing covers both).
- **Ticket**: the single-use credential in the frame URL's fragment, `WORKBENCH_TICKET_PATTERN`.
- **Session**: the `lvw_` bearer (`WORKBENCH_SESSION_PREFIX`) a ticket redeems to, with its scope, document (document
  scope), folder (workspace scope, optional), tab, origin and **level** (`view`, `participate` or `edit`, the token's
  level capped by `capWorkbenchRole`).
- **Surface**: where the editor runs, `EditorSurface = 'app' | 'embed' | 'workbench'`; `surfaceFlags` gives
  `embedMode`, `workbenchMode` and `appChrome`.
- **Place**: where a workspace frame is, `WorkspacePlace`: an Explorer view or a document.

## Behaviour and state

### Invariants

1. The frame never holds the person's own session, and stores the `lvw_` secret only in memory.
2. A session reaches what the allow-list names for its scope and nothing else, at the api and again in the editor.
3. A document-scope session reaches only its document; any other answers `404`, as if absent.
4. A session never writes more than its level; a `view` session writes nothing but its own end and a room ticket.
5. The page mounts nothing until a parent at the session's origin answers the handshake.
6. The editor in a workbench never writes the person's participant record or profile.

### The forward

`/api/workbench/*` is liveworkspace's. The router forwards it to the accounts Worker; a caller reaching the api
directly (the CLI against `wrangler dev`) is forwarded the same way by `apps/api/src/index.ts` through
`routeToWorkspace(request, { app: 'livedocuments', origin: ACCOUNTS_URL, routes: [WORKBENCH_ROUTE] })`, before
identity. No `ACCOUNTS_URL`, or accounts unreachable: `503 accounts_unavailable`.

### A request bearing `lvw_` (the choke point, `index.ts`)

Consulted only when neither an account session nor an API token resolved:

1. A bearer starting `lvw_` that fails `isWorkbenchSessionFormat` is refused as `malformed`.
2. Otherwise `resolveWorkbenchSession(env, secret)` asks liveworkspace through `@liveworkspace/auth-client`
   `createWorkbenchSessionChecker` (an answer is cached for a minute per isolate, a refusal for ten seconds) and maps
   the session's `item` scope to `document`. It answers a `WorkbenchContext` { `sessionId`, `ownerId`, `tokenId`,
   `pairingId`, `scope`, `documentId`, `folderId`, `tabId`, `origin`, `level`, `expiresAt`, `teams` }.
3. Accounts unreachable (`AccountsUnavailable`): `503 accounts_unavailable`, `Retry-After: 5`, logged
   `[workbench] liveworkspace unreachable`.
4. Refused or unknown: `401 invalid_session`, `WWW-Authenticate: Bearer error="invalid_token"`, logged
   `[workbench] bearer-refused { reason, sessionPrefix }` (the first 8 characters, `sessionPrefixOf`).
5. Resolved: `workbenchRefusal(workbench, method, segments, headers)` runs at once (below). The caller's id, its
   verified id and its teams are then the session's owner's and token's.
6. Writes key the rate limiter on `workbench:<sessionId>`, apart from the owner's own app use (WB10).

#### The choke point by scope

`workbenchRefusal`, in order:

1. **Ambient headers** (`workbenchAmbientHeaders(scope)`): the document scope refuses `X-Share-Code`, `X-Owner-Id`
   and `X-Share-Password`; the workspace scope refuses `X-Owner-Id` only, since a document shared with the person is
   opened by its link (WB53). `403 workbench_confined`.
2. **The verdict**, `workbenchRouteVerdict(method, segments, session)`: `other-document` answers `404 not_found`;
   `confined` answers `403 workbench_confined`, logged `[workbench] confined { scope, method, route, sessionPrefix }`.
3. **Level.** A `view` session's writes answer `403 workbench_read_only`, logged `[workbench] read-only-refused`,
   except `DELETE workbench/sessions/current` and `POST documents/:doc/room-ticket` (WB9). A `view` session is refused
   `GET documents/:doc/share` too, in both scopes: the share-link list is a credential (WB54).

### Route effects under a session

- **The room ticket** (`POST documents/:doc/room-ticket`): minted as for the owner, the role capped at the session's
  level, carrying the session's `pairingId` so ending access can find the socket; `noteWorkbenchRoom` tells
  liveworkspace the session joined that document's room (best effort, logged `[workbench] room note failed`), so a
  workspace session's rooms close too (WB55).
- **Images**: a document session reads `GET images/:id` only as its document's (`d` the session's document, no owner
  shortcut); a workspace session reads as its person.
- **The session's requests write nothing about the token** (no last-use note).

### Ending access

liveworkspace ends a pairing (unpaired, token revoked) and calls each document it noted:
`POST /api/internal/items/:id/workbench-close` (the index kit's `workbenchClose` handler in `routes/internal-items.ts`)
runs `closeWorkbenchSessions(env, documentId, pairingId)`, which closes the room's sockets of that pairing with
`WORKBENCH_ENDED_CLOSE` (4006, `workbench-ended`). The page's own end (`DELETE workbench/sessions/current`) closes
nothing (WB11).

### The workbench page (`/embed/workbench`)

`WorkbenchPhase` (`workbench-machine.ts`, `workbenchTransition`), from `INITIAL_WORKBENCH_PHASE`:

| Phase       | Entered when                                                 | Shows                                    | Leaves to                                                       |
| ----------- | ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------- |
| `reading`   | first render                                                 | the opening copy                         | `redeeming`, `refused('no-ticket')`                             |
| `redeeming` | `takeTicketFromAddress` returned a ticket                    | as `reading`                             | `binding`, `refused('ticket')`, `refused('mismatch')`, `failed` |
| `binding`   | the session fits the address (`sessionFitsAddress`)          | as `reading`                             | `mounted`, `unbound`                                            |
| `mounted`   | a valid `hello-ack` within `WORKBENCH_HANDSHAKE_MS`          | the editor, or the workspace frame       | `ended`                                                         |
| `ended`     | expiry unrenewed, `401 invalid_session`, close 4006, trashed | the editor read-only, the Reconnect line | terminal (WB12)                                                 |
| `unbound`   | not framed, or no valid ack in time                          | "This view opens only inside <origin>."  | terminal                                                        |
| `refused`   | no ticket, ticket refused, scope or document mismatch        | the refused copy                         | terminal                                                        |
| `failed`    | the redeem's network failure or 5xx                          | the load error card (`embed`)            | terminal                                                        |

1. `reading`: `addressOf(location)` gives the scope (`/embed/workbench` is `document`, with `d`;
   `/embed/workbench/explorer...` is `workspace`). `takeTicketFromAddress` reads `ticket` from the fragment and
   `history.replaceState`s it away before any request. None, or not `WORKBENCH_TICKET_PATTERN`: `refused('no-ticket')`.
2. `redeeming`: `apiRedeemWorkbenchTicket(ticket)` with no credential. `401 invalid_ticket`, 404 or 410:
   `refused('ticket')`. A session whose scope differs from the address's, or (document scope) whose document differs
   from `d`: `apiEndWorkbenchSession(secret)`, `ended { reason: 'refused' }` posted, `refused('mismatch')`.
3. `binding` (`runWorkbenchHandshake`): `window.parent === window` is `unbound` at once. Else
   `createWorkbenchPort(origin, window)` posts `hello` and waits `WORKBENCH_HANDSHAKE_MS` for a message from the
   parent at the origin that `parseWorkbenchMessage` reads as `hello-ack`. A missing or overlong name is invalid and
   the wait runs on (WB13). None: `unbound`, the session ended, `[workbench] handshake-failed`. Got:
   `[workbench] handshake-ok`, the name kept.
4. `mounted`: `WorkbenchAuthBridge` with the session; the document scope mounts `EditorPage surface="workbench"`,
   the workspace scope `WorkspaceFrame`.
5. Renewal (`useWorkbenchRenewal`): at `expiresAt - WORKBENCH_RENEW_LEAD_MS` post `renew`, then every
   `WORKBENCH_RENEW_RETRY_MS`. A `livedocuments:ticket` is redeemed, outside the window too (WB14); a session that
   `renewalFits` (same scope, origin and, in the document scope, document) replaces the old one, which is ended;
   logged `[workbench] renewed`, else `[workbench] renew-failed { reason }` and the retry continues.
6. `ended`: at `expiresAt` unrenewed (`expired`); a `401 invalid_session` from any request
   (`endReasonOfInvalidSession`: `revoked` before `expiresAt`, `expired` after); room close 4006 or 4005 (`revoked`,
   WB31); the document trashed (`trashed`, `useWorkbenchEnd`). The page posts `ended { reason }`, the editor's role
   turns `view`, the autosave and the room stop, and the confinement stays, so the dead bearer keeps refusing locally.
   Logged `[workbench] ended { reason }`.

### The editor in a workbench

- `AuthProvider` on a `/embed/workbench` path renders neither auth bridge and holds `DEFERRED_AUTH_PENDING`, so nothing
  above the page reads as a settled guest.
- `WorkbenchAuthBridge` publishes a `DeferredAuthContext` signed in as the session's person (`getToken` answers the
  newest secret), the session in `WorkbenchSessionContext`, and in a layout effect, before any child's,
  `registerTokenProvider` and `setWorkbenchConfinement` (document scope `{ scope, documentId, ownerId }`, workspace
  `{ scope: 'workspace', documentId: null, ownerId }`).
- `useAccountBootstrap` reads `useWorkbenchSession()` first: with one it answers signed in as the person at once, with
  no guest timeout and no guest token handling.
- `loadWorkbenchDocument` (`workbench-bootstrap.ts`) loads the session's document (or the frame's) as its owner, sets
  the role from the session's level, and opens the session's tab when it names one. The identity screen never opens
  and the participant record is never written (I6).
- `track('Session', 'Opened', 'Workbench')` once, document scope only.

The surface, where `workbenchMode` changes the editor:

| Gate                                                    | File                                  | In a workbench                                            |
| ------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| App header, account menu, Share, Make a copy, role pill | `EditorView.tsx` (`appChrome`)        | Not rendered                                              |
| Tab bar, palette, toolbars, Quick style, panels, search | `EditorView.tsx`                      | As the app; Open in livedocuments at the tab bar's right  |
| The Explorer menu button                                | `EditorCanvasHost.tsx`                | Hidden (`explorerHidden`); a workspace frame's Back there |
| Settings: documents, account and tokens rows; All apps  | `SettingsDialog.tsx`                  | Hidden; this app's settings only                          |
| Share, delete, move, copy commands                      | `useEditorCommands.ts`                | Absent                                                    |
| The document list                                       | `useEditorState.ts`                   | Never read                                                |
| Teams and mentions                                      | `useEditorState.ts` (`useTokenTeams`) | No team read, no notify                                   |
| Image picker gallery                                    | `EditorElementDialogs.tsx`            | Upload only (`uploadOnly`, `galleryHidden`)               |
| Start's save switch                                     | `StartSaveSwitch.tsx`                 | As an embed's                                             |

Appearance: `livedocuments:theme` calls `setAppearanceOverride(colourScheme)`; a workspace frame sets the override to
`system` until the first one (WB15).

Client confinement: `apiFetch` with a `lvw_` bearer and a verdict other than `allow` (`confinementRefusal`) throws
`WorkbenchConfinedError` without a request and logs `[workbench] request-confined { method, route }` once per route;
the network error report is not called (WB16). `noteWorkbenchResponse` turns a `401 invalid_session` into the end.

### Workbench messages (`useWorkbenchMessages`)

- `ready` once, after the document is in and its first tab is active: `documentId`, `documentName`, `tabId`,
  `tabName`, `role`. In a workspace frame the editor reports its place instead (`frame.reportDocumentPlace`).
- `tab` on every later active-tab change.
- `selection` after the selection has not changed for `WORKBENCH_SELECTION_SETTLE_MS`, only when its text differs
  from the last sent (WB17); empty is `count` 0 with the header and `whole tab` (WB28).
- `reveal`: each ref resolved over the active tab; found elements are brought into view and outlined as a changeset's
  Show does (WB18); the rest are skipped and logged `[workbench] reveal-missed { count }`.
- `theme`: as above. `renew`, `ticket` and `ended`: the page's.

Unknown types are ignored and logged `[workbench] message-ignored { type }` once each; a known type with a bad shape
is `[workbench] message-invalid`.

### The selection reference

Built from the tab's outline (`buildViewModel`), so refs, kind words and labels are the outline's own, with the tab's
last known revision:

1. Header: `[livedocuments] "<document>" › tab "<tab>" (doc <full id>, tab <tab ref>, rev <rev>)`. The document is
   named by its full id: the frame cannot see the library a shorter ref is unique in.
2. Selected elements in the tab's element order (WB20); none gives `whole tab` and no third line.
3. `selected: ` and the first `WORKBENCH_SELECTION_MAX_REFS` items, each `<kind> <ref> "<label>"` (the label cut at
   60 characters, left off when there is none), joined by `, `; more appends
   ` … and <n> more: livedocuments tab view <doc> --tab <tab> --view show --ref selected` on that line.
4. `read: livedocuments tab view <doc> --tab <tab> --view show --ref <first ref>`.

Lines joined by `\n`, no trailing newline.

### The CLI

`workbench open <doc> [--tab <t>] --origin <origin> [--json]` and
`workbench open --workspace [--folder <f>] --origin <origin> [--json]` (verb `workbench.open`):

1. `workbenchOriginOf`: `parseWorkbenchOrigin`, refused `invalid_origin` naming the shapes.
2. Exactly one of `<doc>` and `--workspace`; `--tab` only with a document, `--folder` only with `--workspace`; else a
   usage refusal (exit 2) with the right form.
3. A document resolves without a share code (a share-link URL exits 2, "a workbench opens your own documents"), then
   `--tab`. A folder resolves through `resolveFolderRef(folderChoices(...))`: full id, id prefix or name; none or
   several exit 3.
4. `POST /api/workbench/tickets`. 201 prints `url`, or with `--json` `{ url, documentId, tabId, expiresAt }` (workspace:
   `{ url, scope, folderId, expiresAt }`). `428 pairing_required` exits 4 (WB23) with the fix
   `livedocuments workbench pair --origin <origin>` (and `--workspace`). 404 exits 3.
5. `Cli·Used·WorkbenchOpen` on exit 0.

`workbench pair --origin <origin> [--name <workbench>] [--workspace] [--json]`:

1. The origin as above; `--name` through `workbenchNameOf` (`normaliseWorkbenchName`, 1 to
   `WORKBENCH_NAME_MAX_LENGTH` characters), else `invalid_name`.
2. Asks liveworkspace for a pairing. Already paired: prints it, exit 0.
3. Pending: the pairing URL on stdout's first line at once, flushed before waiting (WB24); opened in the browser only
   when stdout is a terminal (WB25).
4. Waits on the request's status (WB45). Approved: exit 0. Declined, expired or gone: exit 4 with
   `pairing_declined`, `pairing_expired` or `pairing_gone` (WB48).
5. `Cli·Used·WorkbenchPair` on exit 0.

`guide workbench` teaches an agent to read a selection reference: the header, the items as data, re-reading refs with
`tab view --view show --ref`, the tail with `--ref selected`, and that the person's own selection never holds the
agent's writes.

### The workspace scope

#### The workspace frame (`/embed/workbench/explorer...`)

**Addresses** (`workspace-place.ts`, WB56). `workspaceFramePath(place)`:

| Place          | Frame path                                                 |
| -------------- | ---------------------------------------------------------- |
| Home           | `/embed/workbench/explorer` (`WORKSPACE_FRAME_PAGE`)       |
| a folder       | `/embed/workbench/explorer/folder/<id>`                    |
| any other view | `/embed/workbench` + the view's `/explorer` path and query |
| a document     | `/embed/workbench/document/<id>[?s=<code>][&tab=<tabId>]`  |

`workspacePlaceOf(pathname, search)` is its inverse (an unreadable address is Home); `explorerRouteOfFrame` gives the
`/explorer` route a frame path stands for. One static page, `app/embed/workbench/explorer/page.tsx`, backs every
frame path: the editor worker (`isWorkspaceFramePath`) serves `/embed/workbench/explorer/**` and
`/embed/workbench/document/**` from it. Every frame path is under `/embed`, so frameable.

**Mounted** (`WorkspaceFrame`), under `WorkbenchAuthBridge`:

1. Once, in a layout effect: the scheme set to `system`, `ready { scope: 'workspace', role }` posted, and
   `track('Session', 'Opened', 'WorkbenchWorkspace')`.
2. `useWorkspaceNavigation` installs the app's navigation interceptor and a capture `click` listener on the frame's
   root, so every app href moves the frame: `/explorer/...` and `/document/<id>` become frame paths, pushed (or
   replaced) on the frame's history; `/new...` runs New document in place; anything else (help, sign-in, an outside
   page) opens in a new tab with `noopener`, logged `[workbench] opened outside the frame { origin }` (WB57). A
   document entry's `history.state` carries `workbenchFrom`, the path it was opened from.
3. The place renders: an Explorer view is `ExplorerHost` (the shared `@liveworkspace/explorer` for the person, with
   livedocuments's addresses, Help, New, welcome manifest and telemetry), unmounted while a document is open; a
   document is `EditorPage surface="workbench"`, keyed by id and share code, under a nested session whose document,
   tab and share code are the place's, with `frame` (`back`, `backTitle`, `reportDocumentPlace`).
4. `livedocuments:open` moves the frame (`placeOfOpen`), logged `[workbench] open { kind }`.
5. Ended: the Reconnect line shows over the Explorer and the editor turns read-only as in the document scope.

**New document in place** (`createInPlaceOf`, `createDocumentInPlace`, WB58): the `/new` href's `folder` or `team`,
else the place's folder (a folder view) or team (a team page), else none, so the person's default folder answers; the
href's template, else a blank that opens on the editor's start. The document is built as `/new` builds it
(`newDocumentContent`), created with `apiCreateDocument` and the template's untitled name, and its place pushed. A
refused create shows the toast "Couldn’t create the document. Try again." and stays, logged
`[workbench] create-failed { status }`.

**Back** (`WorkbenchBackButton`, WB59): on a document place, in the canvas's top-left card (`ToolbarMenuCard`, the
Explorer menu button's card, `region="header"` for F6), level with the palette strip, which keeps clear of it;
labelled from `sm` up, the glyph alone and inline on a phone. Its hover card names where it returns
("Back to <view>."). `history.back()` when the frame pushed the document from a view, else Home.

**Trashed** (WB60): the frame's nested session turns `end('trashed')` into the toast "That document is in the
Trash." and Back; the page never ends.

#### Workspace messages

- `ready` (workspace) once, above.
- `place` (`useWorkspacePlaceMessages`) after every move and whenever a field changes, never twice with the same
  fields (WB63): an Explorer view from `ExplorerPlaceReporter` (`view` the view's kind, `folderId` a folder's or a
  team page's folder, `folderName` and `documentCount` null, since the lists are the index's inside the Explorer); a
  document from the editor (`view: 'document'`, its id, name, tab and role, the folder fields null). Logged
  `[workbench] place { view }`.
- `tab`, `selection` and `reveal` as in the document scope while a document is open; nothing on an Explorer view.
- `open`: `{ view: 'home' }`, `{ folderId }` or `{ documentId, tabId? }`.

## Interfaces and contracts

### Routes

`WORKBENCH_ROUTES` (document scope; `:doc` the session's document, another is `other-document`; `:p` any one segment):

| Method           | Path under `/api`                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| GET              | `capabilities`, `openapi.json`, `templates`, `templates/:p`, `icons`, `schema`, `schema/:p`, `preferences` |
| GET              | `participants/:owner` (the owner only)                                                                     |
| POST, GET        | `images`, `images/:p`                                                                                      |
| GET, PUT         | `documents/:doc`                                                                                           |
| GET, PUT, DELETE | `documents/:doc/tabs/:p`; PUT `documents/:doc/tabs/:p/name`                                                |
| POST, GET        | `documents/:doc/tabs/:p/changesets`, `.../changesets/:p/revert`, `documents/:doc/changesets[/:p]`          |
| GET              | `documents/:doc/comments`, `documents/:doc/tabs/:p/render.svg`                                             |
| POST, DELETE     | the comment routes: add, reply, resolve, reopen, delete                                                    |
| POST             | `documents/:doc/room-ticket`                                                                               |
| DELETE           | `workbench/sessions/current`                                                                               |

`WORKSPACE_ROUTES` (`**` any rest, including none):

| Method                 | Path under `/api`                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET                    | `capabilities`, `openapi.json`, `templates/**`, `icons`, `schema/**`, `preferences`, `participants/:owner` |
| GET                    | `share/**`                                                                                                 |
| GET, POST, PUT, DELETE | `documents/**` but `documents/:p/tabs/:p/presence` (`WORKSPACE_CLOSED`, an agent's door)                   |
| GET, POST, PUT, DELETE | `folders/**`, `trash/**`, `images/**`                                                                      |
| GET                    | `teams`, `teams/:p/library` (never the segments of `WORKBENCH_RESERVED_SEGMENTS`)                          |
| DELETE                 | `workbench/sessions/current`                                                                               |

Everything else is `confined`: the account, tokens, workbench routes but the one above, preference and participant
writes, team writes and team administration (WB51), `ai/**`, `oauth/**`.

### Wire types

The redeem answer (`WorkbenchSessionResponse`), the pairing list (`WorkbenchPairing`) and the ticket answers are
`packages/api-schema/src/workbench.ts`'s; liveworkspace serves them. Error tokens: `WORKBENCH_ERROR_CODES` (WB26).

### Workbench messages

`packages/api-schema/src/workbench-messages.ts`: every message `{ type: 'livedocuments:<name>', v: 1, ... }`, the
names `hello`, `hello-ack` `{ name }`, `ready` (document or workspace), `tab`, `selection`, `renew`, `ticket`,
`reveal` `{ refs }`, `theme` `{ colourScheme }`, `ended` `{ reason: expired | revoked | trashed | refused }`, `place`,
`open` `{ to }`. `parseWorkbenchMessage` answers a typed message or null.

### CLI verbs

`workbench.open` in `@livedocuments/agent-verbs`; `workbench pair` in the CLI only, since it waits on a browser.

## Data and persistence

None in livedocuments. Pairings, tickets and sessions are liveworkspace's store
([Workbenches](../../../../../liveworkspace/docs/specs/011-workbench/workbench.md) "The store"); the page keeps the session in memory, and the
workspace frame's place is its own address and history.

## Errors and edge cases

| Case                                                      | Outcome                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Session-shaped bearer, malformed or unknown               | `401 invalid_session`; the page ends (`revoked` or `expired`)                    |
| liveworkspace unreachable                                 | `503 accounts_unavailable`, `Retry-After: 5`; the page keeps its session         |
| Another document, document scope                          | `404`                                                                            |
| A route outside the allow-list                            | `403 workbench_confined`, refused in the editor first (`WorkbenchConfinedError`) |
| A view session's write                                    | `403 workbench_read_only`                                                        |
| Ticket redeemed twice, expired or malformed               | `refused('ticket')`                                                              |
| Ticket for another document or scope than the address     | session ended, `refused('mismatch')`                                             |
| Not framed, or framed by another origin                   | `unbound`                                                                        |
| The document trashed                                      | document scope: `ended(trashed)`; workspace: toast and Back                      |
| Room closed 4006 (pairing ended) or 4005 (access changed) | `ended(revoked)`                                                                 |

## Security and trust

- The ticket rides the fragment and leaves the address before any request; the secret lives in memory only.
- `postMessage` goes only to the bound origin with `targetOrigin` set, and is accepted only from `window.parent` at it.
- Confinement is enforced at the api's choke point; the editor's check only saves the round trip.
- Logs name a session by `sessionPrefixOf` and an origin by its host (WB37), never a secret or a name.

## Performance and limits

- A session check is one call to liveworkspace per isolate per minute (`createWorkbenchSessionChecker`'s cache).
- The selection reference is built after the settle, off the input event, so a marquee drag costs one build.
- Constants: [Constants and configuration](#constants-and-configuration).

## Presentation and UX

### Workbench page copy

`WorkbenchStatus.tsx` (WB33, WB65), bare like an embed's:

| Scope     | Opening                   | Refused heading                           | Refused body                                                                       |
| --------- | ------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| document  | "Opening your document…"  | "Open this document from your workbench"  | "This link works once, for a minute. Open the document again from your workbench." |
| workspace | "Opening your workspace…" | "Open your workspace from your workbench" | "This link works once, for a minute. Open it again from your workbench."           |

Unbound: "This view opens only inside <origin>." Failed: the load error card. The Explorer waiting for its person:
"Opening your Explorer…".

### The workspace frame

The Explorer fills the frame on the app's background (`bg-slate-50`, dark `bg-slate-900`) without the app header or
Settings. **Open in livedocuments** (`WorkbenchOpenLink`) sits at the tab bar's right end beside Search and Settings,
"Opens this document in a full tab." (WB34), and on an Explorer view links the view's `/explorer` address. The
Reconnect line, "Reconnect in <workbench> to keep editing.", sits at the top centre once the session has ended.

### Settings > API tokens

`SettingsTokensRow` lists each token's paired workbenches (`useWorkbenchPairings`: `GET /api/workbench/pairings` once,
grouped by token, WB46) through `SettingsTokenPairings`: name (or unnamed), origin, scope ("One document at a time" or
"Whole workspace", WB67) and when paired, each with **Unpair**, which asks first (WB36) and removes the row once the
pairing has ended. A token with no pairings shows nothing extra (WB35). The tokens themselves are managed on
liveworkspace.app.

## Accessibility

- Back and Open in livedocuments are labelled controls with hover cards; Open names that it opens a new tab.
- Back is the editor's Header region for F6 and the first of the canvas's controls.
- The status screens and the Reconnect line are `role="status"`.
- The pairing surfaces this app draws (Settings) meet WCAG 2.2 AA in both schemes (`e2e/signed-in/workbench-contrast.spec.ts`).

## Web Experience

- Every frame path is under `/embed`, the one prefix the editor serves without `X-Frame-Options: DENY`
  ([Embeds](../embeds.md#frame-headers)); the workspace frame's paths are static (`isWorkspaceFramePath`), so they need
  no server.
- The ticket never reaches a server log or `Referer`: it rides the fragment.
- A link the frame cannot hold opens a new tab with `noopener`, so the frame's history holds only the frame's places.

## Observability

See the spec's [Observability and telemetry](../workbench-embeds.md#observability-and-telemetry); logs beyond its list
are none (WB47).

## Testing

- Contract: `packages/api-schema/src/workbench.test.ts` (verdicts per scope, origin rule, caps),
  `workbench-messages.test.ts`.
- Api: `apps/api/src/auth/workbench-session.test.ts`, `workbench-confinement.test.ts`,
  `apps/api/src/index.workbench-workspace.test.ts`.
- Page and frame: `app/embed/workbench/*.test.ts(x)` (machine, fragment, handshake, renewal, navigation, place
  messages, create in place, `WorkbenchPage`, `WorkspaceFrame`), `lib/workbench/*.test.ts`.
- Editor: `useWorkbenchMessages.test.ts`, `useWorkbenchEnd.test.ts`, `useRoomConnection.workbench.test.tsx`,
  `WorkbenchAuthBridge.test.tsx`, `WorkbenchChrome.test.tsx`, `TabBar.workbench.test.tsx`,
  `lib/api/workbench*.test.ts`, `useWorkbenchPairings.test.ts`.
- CLI: `packages/agent-verbs/src/verbs/workbench.test.ts`, `apps/cli/src/commands/workbench-open.test.ts`,
  `workbench-pair.test.ts`.
- End to end: `e2e/workbench-embed.spec.ts` and `e2e/workbench-workspace.spec.ts` against a fake workbench
  (`e2e/fixtures/fake-workbench.html`, which frames only loopback http or https), on the workbench stack's ports.

## Constants and configuration

In `packages/api-schema/src/workbench.ts`:

| Constant                        | Value      | Used by                                    |
| ------------------------------- | ---------- | ------------------------------------------ |
| `WORKBENCH_HANDSHAKE_MS`        | 5000       | `useWorkbenchHandshake`                    |
| `WORKBENCH_RENEW_LEAD_MS`       | 600000     | `useWorkbenchRenewal` (WB38)               |
| `WORKBENCH_RENEW_RETRY_MS`      | 60000      | `useWorkbenchRenewal`                      |
| `WORKBENCH_SELECTION_SETTLE_MS` | 250        | `useWorkbenchMessages`                     |
| `WORKBENCH_SELECTION_MAX_REFS`  | 20         | the selection reference                    |
| `WORKBENCH_NAME_MAX_LENGTH`     | 40         | `workbench pair --name`, `hello-ack` (WB2) |
| `WORKBENCH_SESSION_PREFIX`      | `lvw_`     | the api's choke point                      |
| `WORKBENCH_TICKET_PATTERN`      | see source | `takeTicketFromAddress`                    |

The ticket and session lifetimes, byte lengths, pairing lifetime and mint rate in the same file mirror
liveworkspace's and are not read by this app. `ACCOUNTS_URL` names the accounts Worker for the forward and the
session check.

## Assets and external resources

None.

## Defaults ledger

WB rows in [DEFAULTS.md](DEFAULTS.md).
