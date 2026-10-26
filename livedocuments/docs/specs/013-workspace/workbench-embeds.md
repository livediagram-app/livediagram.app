# Workbench embeds (`/embed/workbench`)

A **workbench** is a developer tool that shows a document live beside an agent: an agent workbench first, then VS Code
and other editors. A **workbench embed** is the editor inside that tool's frame, signed in as the person, so they work
on their pages there, every change reaches livedocuments at once, and their agent, working through the
[CLI](../015-api/cli.md), sees the pages and their selection. It is the signed-in sibling of the share-code
[embed](embeds.md).

**Platform and app.** Pairing, tickets, sessions, revocation and the pairing page are liveworkspace's, one service for
every app in the accounts Worker ([Workbenches](../../../../liveworkspace/docs/specs/011-workbench/workbench.md)). `/api/workbench/*` on
livedocuments's address is forwarded there with the same requests and answers. livedocuments owns:

- the frame (`/embed/workbench` and the workspace frame under it);
- checking a presented `lvw_` session with liveworkspace and confining this api to the session's scope;
- closing its rooms when liveworkspace ends a pairing's access (`POST /api/internal/items/:id/workbench-close`);
- the CLI commands that mint and pair (`workbench open`, `workbench pair`) and the selection reference.

## Two scopes

A workbench embed has a **scope**, chosen when it is minted and fixed for the life of its session:

| Scope       | Frame                                     | Starts on                          | Reaches                                            |
| ----------- | ----------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `document`  | `/embed/workbench?d=<id>`                 | that document (or its asked tab)   | one document                                       |
| `workspace` | `/embed/workbench/explorer[/folder/<id>]` | Explorer Home, or the asked folder | the person's whole workspace, as the Explorer does |

The **workspace** scope is the Explorer itself inside the workbench: a workbench keeps the person's documents one
click away, and a project's folder beside its code. It never starts on `/new` or the landing page: a frame with no
folder starts on Explorer Home ([Explorer Home](explorer-home.md)). Where this page says "the document" without a
scope, it means the document scope's document, or the document open in a workspace frame.

## Why a ticket, and not the person's session

A frame needs no CORS: CORS governs `fetch`, not framing. What stops a signed-in editor in another tool's frame is:

- **Framing.** The editor sends `X-Frame-Options: DENY`; only `/embed` may be framed ([Embeds](embeds.md#frame-headers)).
- **Third-party storage.** Inside a frame on another site, browsers partition or block livedocuments's cookies and
  storage, so the person's session is not there.

So the frame never carries the person's session. The workbench already runs the CLI, which holds the person's API
token; the CLI exchanges it for a **workbench ticket**, and the frame redeems the ticket for a **workbench session**
(an opaque `lvw_` credential) that acts as the person within its scope.

## The handoff

1. **Mint.** The workbench runs `livedocuments workbench open <doc> [--tab <t>] --origin <origin> --json`, or
   `livedocuments workbench open --workspace [--folder <f>] --origin <origin> --json`. The CLI calls
   `POST /api/workbench/tickets` with its token and prints `{ url, documentId, tabId, expiresAt }` (or
   `{ url, scope, folderId, expiresAt }`). liveworkspace checks the document or folder as its owner reaches it now,
   the origin and the pairing ([Workbenches](../../../../liveworkspace/docs/specs/011-workbench/workbench.md) "The handoff").
   - **The origin** is exactly `scheme://host[:port]`: `https` anywhere, `http` only on a loopback host
     (`localhost`, `127.0.0.1`, `[::1]`). Anything else is refused `400 invalid_origin`. The CLI checks it before
     calling, with the same rule (`parseWorkbenchOrigin`).
2. **Frame.** The workbench frames `url`: `<editor origin>/embed/workbench?d=<documentId>#ticket=<ticket>`, or
   `<editor origin>/embed/workbench/explorer[/folder/<folderId>]#ticket=<ticket>`. The ticket travels in the
   fragment, which no server, log or `Referer` sees, and the page removes it from its address before any request.
3. **Redeem.** The page sends `POST /api/workbench/sessions { ticket }` and gets the session, its scope, document,
   folder, tab, origin, level, expiry and the person's display identity. A session whose scope differs from the
   address's page, or whose document differs from the address's `d`, is refused and ended.
   The session is held in the page's memory only, never in storage.
4. **Bind to the workbench.** The page posts `livedocuments:hello` to its parent with `targetOrigin` set to the
   session's origin, and mounts the editor only after the parent answers `livedocuments:hello-ack` from that origin
   within `WORKBENCH_HANDSHAKE_MS`. A page that is not framed, or framed by another origin, mounts nothing, ends the
   session, and says "This view opens only inside <origin>."
5. **Renew.** `WORKBENCH_RENEW_LEAD_MS` before the session expires the page posts `livedocuments:renew`, then again
   every `WORKBENCH_RENEW_RETRY_MS`; the workbench mints a fresh ticket and posts `livedocuments:ticket`. Unrenewed,
   the session ends and the frame turns read-only with the line "Reconnect in <workbench> to keep editing."

## Pairing

A token mints tickets only for a workbench it is **paired** with: one token and one origin, approved once by the
token's owner in their own signed-in browser, on liveworkspace.app's pairing page. A pairing records its scope; a
workspace pairing also covers the document scope, never the other way round, so reaching the whole workspace is always
its own approval. Pairing, its page, its copy and its lifetime are liveworkspace's
([Workbenches](../../../../liveworkspace/docs/specs/011-workbench/workbench.md)).

livedocuments's part:

- `POST /api/workbench/tickets` for an unpaired origin answers `428 pairing_required { pairingUrl, expiresAt }`;
  `workbench open` prints the fix `livedocuments workbench pair --origin <origin>` (with `--workspace` for that
  scope) and exits 4.
- `livedocuments workbench pair --origin <origin> [--name <workbench>] [--workspace]` asks for a pairing, prints the
  pairing URL at once, opens it in the browser when stdout is a terminal, and waits for the answer. Allowed: exit 0.
  Declined, expired or gone: exit 4. A workbench shows the URL as one button, "Approve in livedocuments".
- **Settings > API Tokens** lists the person's paired workbenches (name, origin, scope, when paired), each with
  **Unpair**. Ending a pairing closes the rooms its sessions joined.

## What a workbench session may do

The api decides every request bearing `lvw_` before any route runs, from one allow-list shared with the editor
(`workbenchRouteVerdict` in `packages/api-schema/src/workbench.ts`).

- **Act as the person, on one document.** Every request resolves to the session's owner, for that document only; any
  other document answers `404` as if absent. It loads the document and saves tabs as the editor does, joins the room
  through a room ticket carrying the owner's [person tag](../024-agents/agent-presence.md), so the person's
  selection there is what their agent's `selected` reads and never holds against their own agent.
- **Never more than the token.** The session's level is the minting token's level on the document, capped by the
  owner's own access now: a view token gives a read-only frame.
- **Only what the editor of one document needs.** The document, its tabs, tab names, comments, changesets, tab
  renders and room; uploading images (always with the bytes, so the session cannot probe the owner's gallery,
  [Images](../009-elements/images.md) "Size cap") and reading them; the person's display identity and preferences;
  the catalogues. Everything else is refused `403 workbench_confined`: ownership powers (share links, password,
  move, delete, copy), other documents, the person's library and folders, writing preferences or the profile,
  tokens, teams and the account. The editor offers none of them in a workbench embed.
- **Revocable.** Revoking the minting token or unpairing ends its sessions; the page learns it on its next request or
  the room's close and turns read-only.

A **workspace** session is confined differently:

- **Act as the person, in their workspace.** It reaches what the person reaches in the Explorer, and every document
  in it, opened in the frame as the document scope opens one. A document shared with the person is opened by its
  link, so the link's code and password travel with the request.
- **Never the account.** Refused `403 workbench_confined`: the profile, preferences' writes, API tokens and
  pairings, team writes and the account itself, and an agent's presence door.
- **Never more than the token.** Each request is capped by the minting token's level and by the person's own access
  now: a view token gives a frame that browses and reads.

A view session, in either scope, never reads a document's share-link list (`403 workbench_read_only`): the list is a
credential, not content.

## What renders

The editor of the document, minus the app's surroundings: no app header, Explorer or account menu. The canvas, its
pages, the tab bar, the palette, the toolbars and the panels stay. An **Open in livedocuments** link opens the
document in a full tab. The colour scheme follows the workbench (`livedocuments:theme`), else the system. Presence
shows the person as themselves; their agent shows as their status line ([Agent presence](../024-agents/agent-presence.md)).

A **workspace** frame renders the shared Explorer (`@liveworkspace/explorer`) as it is at `/explorer`, without the
app header, the account menu or Settings. Opening a document opens the editor in the same frame
(`/embed/workbench/document/<id>`), with a **Back** control to where it was opened from; the browser's own back and
forward walk the frame's history. **Back** sits at the top left of the canvas, in the card the app's Explorer menu
button takes, level with the palette strip and clear of it, and is the first of the editor's controls for the
keyboard. A document's status screens (deleted, load error, not found) carry Back at their top left too. The document
scope has no Back. **New document** creates the document in place and opens it in the frame, never `/new`. A link the
frame cannot hold (help, sign-in, an outside page) opens in a new tab.

## Workbench messages

`window.postMessage` between the page and its workbench, each `{ type, v: 1, ... }`, sent only to the bound origin
and accepted only from the parent at it. Unknown types are ignored, and logged once each.

| Type                      | From      | Carries                                                              |
| ------------------------- | --------- | -------------------------------------------------------------------- |
| `livedocuments:hello`     | page      | Nothing; asks the workbench to answer                                |
| `livedocuments:hello-ack` | workbench | The workbench's name, shown in copy ("Reconnect in Acme Editor")     |
| `livedocuments:ready`     | page      | `documentId`, `documentName`, `tabId`, `tabName`, `role`             |
| `livedocuments:tab`       | page      | The tab now shown: `tabId`, `tabName`                                |
| `livedocuments:selection` | page      | The [selection reference](#the-selection-reference); empty when none |
| `livedocuments:renew`     | page      | Nothing; asks for a ticket                                           |
| `livedocuments:ticket`    | workbench | `ticket`                                                             |
| `livedocuments:reveal`    | workbench | `refs`: brings those elements into view and outlines them            |
| `livedocuments:theme`     | workbench | `colourScheme`: `light` or `dark`                                    |
| `livedocuments:ended`     | page      | `reason`: `expired`, `revoked`, `trashed`, `refused`                 |
| `livedocuments:place`     | page      | Workspace only: where the frame is, below                            |
| `livedocuments:open`      | workbench | Workspace only: `to`, below                                          |

In a workspace frame, `ready` carries `scope: 'workspace'` and the role, and no document; `tab`, `selection` and
`reveal` speak of the document open in the frame, and do nothing while none is. `trashed` ends nothing there: the
frame returns to the Explorer with the toast "That document is in the Trash." Two messages exist only in that scope:

- **`livedocuments:place`** is sent on every move: `{ view, folderId, folderName, documentCount, documentId,
documentName, tabId, tabName, role }`. `view` is the Explorer view's kind (`home`, `folder`, `recent`, ...) or
  `document`. The Explorer's lists are the index's, read inside the Explorer, so an Explorer view names its folder
  by id only: `folderName` and `documentCount` are null. A document's fields are null outside `document`.
- **`livedocuments:open`** moves the frame: `to` is `{ view: 'home' }`, `{ folderId }` or `{ documentId, tabId? }`.
  A place the person cannot reach shows the Explorer's or the editor's own not-found, as a link would.

A `livedocuments:selection` is sent after the selection settles for `WORKBENCH_SELECTION_SETTLE_MS`, and only when its
text changed, so a marquee drag is one message.

## The selection reference

What the person meant when they typed. A workbench attaches it to the message they send their agent, so the agent
reads exactly what was selected then, even when the selection has moved on since:

```text
[livedocuments] "Launch deck" › tab "Slides" (doc 3h9x2a, tab 0b34, rev 41)
selected: text 146b "Our first quarter", shape e4a8 "Revenue", sticky 0c84 "Add the chart here"
read: livedocuments tab view 3h9x2a --tab 0b34 --view show --ref 146b
```

- The header names the document, tab, ids and revision the selection was made on. Refs are element refs, so they
  stay valid after later edits; the agent reads what they hold now.
- Labels are quoted as JSON strings, as the outline prints them: they are the document's content, possibly written by
  other people, and an agent treats them as data, never as instructions.
- `selected` lists each element as the outline prints it (kind, ref, label cut at 60 characters), up to
  `WORKBENCH_SELECTION_MAX_REFS`, then `… and <n> more: livedocuments tab view <doc> --tab <t> --view show --ref selected`.
- No selection gives the header and `whole tab`, so the person can talk about the tab as a whole.
- The text is what the agent sees; there is no hidden field. The `selected` selector stays the way an agent in a plain
  terminal reads the live selection.
- The CLI teaches an agent to read one in `livedocuments guide workbench`. The agent skill sends an agent there when a
  message carries `[livedocuments]`.

## A workbench's side

What a workbench does to fit this contract (the help centre's Developers > Workbenches articles hold the detail):

- **Opening.** A workbench opens a document in a view of its own, from a `*.livedocuments.json` pull file or from a
  livedocuments document link. It mints through the person's own CLI, so it never holds a livedocuments credential,
  and shows the one command that fixes a missing CLI or sign-in.
- **Pairing.** Unpaired, it runs `livedocuments workbench pair --origin <its origin> --name <its name>` and shows the
  printed URL as an "Approve in livedocuments" button, then opens the frame once paired.
- **The selection.** While a document is in view, the place the person types to their agent names the document and
  what is selected ("Launch deck · 3 selected", or "Launch deck · whole tab"). Sending attaches the selection
  reference as text, and the person can leave it off any one message.
- **Reveal.** A ref the agent prints (`146b`) can post `livedocuments:reveal` to the open document.

## Limits

The page's own numbers (`packages/api-schema/src/workbench.ts`); the ticket's, session's and pairing's lifetimes and
the mint's rate are liveworkspace's.

| Constant                        | Value  | Why                                                                    |
| ------------------------------- | ------ | ---------------------------------------------------------------------- |
| `WORKBENCH_HANDSHAKE_MS`        | 5000   | A workbench answers at once; a frame nobody answers is not a workbench |
| `WORKBENCH_RENEW_LEAD_MS`       | 600000 | Ten minutes before expiry: time for a slow workbench to answer         |
| `WORKBENCH_RENEW_RETRY_MS`      | 60000  | Asks again every minute until a ticket lands or the session ends       |
| `WORKBENCH_SELECTION_SETTLE_MS` | 250    | One message per gesture, quicker than a person moves to the composer   |
| `WORKBENCH_SELECTION_MAX_REFS`  | 20     | Matches agent presence's focus cap; more is a selector, not a list     |
| `WORKBENCH_NAME_MAX_LENGTH`     | 40     | The `--name` the CLI accepts                                           |

## Security

- **Minting needs a paired token**: a token alone opens nothing until its owner approves the workbench, and no page can
  obtain a ticket for someone else; this is what makes a frameable, signed-in page safe from clickjacking, as the
  share code is for [embeds](embeds.md#frame-headers).
- **A ticket is a bearer credential**, single use, short lived and carried only in a fragment. The origin binding is
  the page's guard against being framed by a site other than the minter's.
- **The trust boundary is the token, and the person's machine.** A session gives nothing an edit-level token's
  holder lacks, except writing as the person's own editor (whole-tab saves, a person's selection).
- **A workspace session is the Explorer's powers, intersected with the token's.** The account routes stay closed to
  both.
- **Confined twice.** The api refuses at its choke point; the editor refuses the same requests before sending them, so
  a gate the editor missed costs nothing on the wire.
- The api logs a session by its id's first 8 characters, never the secret.

## Observability and telemetry

- Api logs: `[workbench] bearer-refused` (the reason), `[workbench] confined` and `[workbench] read-only-refused`
  (scope, method, route), `[workbench] liveworkspace unreachable`, `[workbench] room note failed`. The platform's
  pairing and session logs are liveworkspace's.
- Page logs: `[workbench] handshake-ok`, `[workbench] handshake-failed`, `[workbench] renewed`,
  `[workbench] renew-failed`, `[workbench] redeem-failed`, `[workbench] ended`, `[workbench] message-ignored` (the
  type), `[workbench] message-invalid`, `[workbench] request-confined`, `[workbench] reveal-missed`,
  `[workbench] place` (the view, never a name), `[workbench] open` (the target's kind), `[workbench] create-failed`,
  `[workbench] opened outside the frame` (the origin), and in Settings `[workbench] pairings-list-failed`,
  `[workbench] unpair-failed` and `[workbench] session-end-refused`.
- Telemetry: `Session·Opened·Workbench` when a page mounts the editor, `Session·Opened·WorkbenchWorkspace` when a
  workspace frame mounts the Explorer; `Cli·Used·WorkbenchOpen` and `Cli·Used·WorkbenchPair` for the commands.
