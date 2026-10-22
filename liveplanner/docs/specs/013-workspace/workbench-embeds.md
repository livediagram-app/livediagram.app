# Workbench embeds (`/embed/workbench`)

**Status: built** for both scopes: the api, the pages, the pairing page and the CLI commands.

A **workbench** is a developer tool that shows a project live beside an agent: an agent workbench first, then VS Code
and other editors. A **workbench embed** is the editor inside that tool's frame, signed in as the person, so they draw
there, everything they draw reaches liveplanner at once, and their agent, working through the
[CLI](../015-api/cli.md), sees the drawing and their selection. It is the signed-in sibling of the share-code
[embed](embeds.md).

## Two scopes

A workbench embed has a **scope**, chosen when it is minted and fixed for the life of its session:

| Scope       | Frame                                     | Starts on                          | Reaches                                            |
| ----------- | ----------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `project`   | `/embed/workbench?d=<id>`                 | that project (or its asked tab)    | one project                                        |
| `workspace` | `/embed/workbench/explorer[/folder/<id>]` | Explorer Home, or the asked folder | the person's whole workspace, as the Explorer does |

The **workspace** scope is the Explorer itself inside the workbench: a workbench keeps the person's diagrams one
click away, and a project's folder beside its code.
It never starts on `/new` or the landing page: a frame with no folder starts on Explorer Home
([Explorer Home](explorer-home.md)). Where this page says "the project" without a scope, it means the project
scope's project, or the project open in a workspace frame.

## Why a ticket, and not the person's session

A frame needs no CORS: CORS governs `fetch`, not framing. What stops a signed-in editor in another tool's frame is:

- **Framing.** The editor sends `X-Frame-Options: DENY`; only `/embed` may be framed ([Embeds](embeds.md#frame-headers)).
- **Third-party storage.** Inside a frame on another site, browsers partition or block liveplanner's cookies and
  storage (Safari, Firefox, and Chrome with third-party cookies off), so the person's session is not there, and
  Google's sign-in refuses to run in a frame.

So the frame never carries the person's session. The workbench already runs the CLI, which holds the person's
token; the CLI exchanges it for a **workbench ticket**, and the frame redeems the ticket for a **workbench session**
that acts as the person on one project only.

## The handoff

1. **Mint.** The workbench runs `liveplanner workbench open <project> [--tab <t>] --origin <origin> --json`. The CLI
   calls `POST /api/workbench/tickets { projectId, tabId?, origin }` with its token and prints
   `{ url, projectId, tabId, expiresAt }`. The ticket is 128 random bits, single use, valid for
   `WORKBENCH_TICKET_TTL_MS`, stored with the token's owner, the project, the origin and the token's access level.
   - **A workspace ticket.** `liveplanner workbench open --workspace [--folder <f>] --origin <origin> --json` calls
     `POST /api/workbench/tickets { scope: 'workspace', folderId?, origin }` and prints
     `{ url, scope, folderId, expiresAt }`. `scope` is `project` when absent, so today's callers are unchanged. A
     `folderId` the token's owner cannot reach answers `404` (CLI exit 3); a project scope without a `projectId`,
     or a workspace scope with one, is refused `400 invalid_value`. The ticket stores the scope and the folder.
   - **The origin** is exactly `scheme://host[:port]`, nothing more: `https` anywhere, `http` only on a loopback
     host (`localhost`, `127.0.0.1`, `[::1]`). `*`, `null`, a path, a query or any other scheme is refused
     `400 invalid_origin`; another workbench's scheme (a VS Code webview's) joins the list in this spec first.
2. **Frame.** The workbench frames `url`, whose origin is the editor app's canonical origin, never one that redirects (the workbench checks every message against it): `<live origin>/embed/workbench?d=<projectId>#ticket=<ticket>`. The
   project id is no secret; the ticket travels in the fragment, which no server, log or `Referer` sees, and the page
   removes it from its address on load. A workspace ticket's url is
   `<live origin>/embed/workbench/explorer[/folder/<folderId>]#ticket=<ticket>`.
3. **Redeem.** The page sends `POST /api/workbench/sessions { ticket }`. The api consumes the ticket and answers
   `{ session, scope, projectId, folderId, tabId, origin, role, expiresAt, person }` (`person`: the owner's display
   identity; `projectId` null in the workspace scope, `folderId` null unless one was asked). A `projectId` other
   than the address's `d`, or a scope other than the address's page, is refused and the session revoked. The session is an opaque `lvw_`
   credential valid for `WORKBENCH_SESSION_TTL_MS`, held in the page's memory only, never in storage.
4. **Bind to the workbench.** The page posts `liveplanner:hello` to its parent with `targetOrigin` set to the
   ticket's origin, so a parent of any other origin never receives it, and mounts the editor only after the parent
   answers `liveplanner:hello-ack` from that origin within `WORKBENCH_HANDSHAKE_MS`. A page that is not framed, or
   framed by another origin, mounts nothing, revokes the session, and says "This view opens only inside <origin>."
5. **Renew.** Before the session expires the page posts `liveplanner:renew`; the workbench mints a fresh ticket and
   posts `liveplanner:ticket`. Unrenewed, the session ends and the frame turns read-only with the line "Reconnect in
   <workbench> to keep editing."

## Pairing

A token mints tickets only for a workbench it is **paired** with: a pairing is one token and one origin, approved once
by the token's owner in their own signed-in browser. A token that leaks (into CI, a log, another machine) therefore
opens no session anywhere its owner has not approved.

A pairing also records its **scope**: `project`, or `workspace`, which also covers the project scope. Every
pairing approved before scopes existed is a `project` pairing. A workspace mint on a project pairing is unpaired
for that scope: it answers `428 pairing_required` with a new request, so reaching the whole workspace is always a
second, explicit approval, never an existing pairing widened in silence.

1. **Unpaired.** `POST /api/workbench/tickets` for an origin the token is not paired with answers
   `428 pairing_required { pairingUrl, expiresAt }`. The pairing request behind it is single use and valid for
   `WORKBENCH_PAIRING_TTL_MS`; a second unpaired mint for the same token and origin returns the same request while
   it lives.
2. **Ask.** `liveplanner workbench pair --origin <origin> [--name <workbench>]` opens `pairingUrl` in the browser
   (or prints it when it cannot) and waits for the answer, as `auth login --device` waits. `workbench open` refused
   for pairing prints that command and exits 4. A workbench shows the URL as one button, "Approve in liveplanner".
3. **Approve.** `<live origin>/workbench/pair?code=<code>` is an ordinary editor page (never framed), for a signed-in
   person only, and only the token's owner may answer. It reads: "Allow **Acme Editor** at `https://127.0.0.1:5175` to
   open your projects with the token **liveplanner CLI**?", with **Allow** and **Don't allow**. The workbench name
   is the one the CLI sent, shown beside the origin, which is what is enforced. A workspace request reads: "Allow
   **Acme Editor** at `https://127.0.0.1:5175` to open **your whole workspace**, and to create, move, share and
   trash projects and folders in it, with the token **liveplanner CLI**?". `workbench pair` takes `--workspace`.
4. **Paired.** Allow records the pairing; the waiting command exits 0 and the workbench mints again. Don't allow, or
   an expired request, ends the wait with exit 4 and records nothing.

- A pairing lives as long as its token: revoking the token removes its pairings.
- **Settings > API tokens** lists each token's paired workbenches (name, origin, scope, when paired), each with
  **Unpair**, which ends that pairing's open sessions as revoking does.
- Pairing is per origin, so one workbench on a laptop and on a LAN address pairs separately.

## What a workbench session may do

- **Act as the person, on one project.** Every request with `Authorization: Bearer lvw_...` resolves to the
  ticket's owner, for that project only; any other project answers `404` as if absent. It loads the project and
  saves tabs as the editor does (the whole-tab `PUT` and `X-Changeset-Seen`), joins the room through a room ticket
  carrying the owner's [person tag](../024-agents/agent-presence.md), so the person's selection there is what their
  agent's `selected` reads and never holds against their own agent.
- **Never more than the token.** The session's level is the minting token's level on the project, capped by the
  owner's own access now: a view token gives a read-only frame.
- **Only what the editor of one project needs.** The project, its tabs, comments, changesets, items and room;
  reading the person's display identity, preferences and custom themes; the catalogues. Everything else is refused `403 workbench_confined`: ownership powers
  (share links, password, move, delete, publish, copy), other projects, the person's library and folders,
  writing preferences or the profile, the guest migration, tokens, teams and the account. The
  editor offers none of them in a workbench embed: the person's agent sits beside it.
- **Revocable.** Revoking the minting token ends its sessions; the page learns it on its next request or the room's
  close and turns read-only.

The bullets above are the project scope. A **workspace** session is confined differently:

- **Act as the person, in their workspace.** It reaches what the person reaches in the Explorer: their library and
  folders, the projects shared with them, their teams' shared projects as a member, the Inbox, the Timeline,
  Favourites, Recent, Search, the Trash and their themes; and every project in
  them, opened in the frame as the project scope opens one.
- **Everything the Explorer does.** Create, rename, move, copy, favourite, share (links, roles, password, expiry),
  trash, restore, and create, rename, move and delete folders, at the person's own access to each.
- **Never the account.** Refused `403 workbench_confined`, as in the project scope: the profile, preferences'
  writes, the guest migration, API tokens and pairings, team administration (invites, members, roles, plans,
  billing) and the account itself.
- **Never more than the token.** Each request is capped by the minting token's level and by the person's own access
  now, as in the project scope: a view token gives a frame that browses and reads.

## What renders

The editor of the project, minus the app's surroundings: no app header, Explorer or account menu. The canvas, the
tab bar, the palette, the toolbars and the panels stay, since a workbench embed is for drawing. An **Open in
liveplanner** button opens the project in a full tab. The colour scheme follows the workbench (`liveplanner:theme`),
else the system. Presence shows the person as themselves; their agent shows as their status line
([Agent presence](../024-agents/agent-presence.md)).

A **workspace** frame renders the Explorer as it is at `/explorer`: its sidebar, its views and its empty states,
without the app header, the account menu, Settings, or the Teams administration rows. Opening a project opens the
editor in the same frame (`/embed/workbench/project/<id>`), with a **Back** control to where it was opened from;
the browser's own back and forward walk the frame's history. **New project** creates the project in place and opens
it in the frame, never `/new`. **Open in liveplanner** opens the current view or project in a full tab. A frame
started on a folder shows that folder; its empty state is the Explorer's own, with New project and the templates.

## Workbench messages

`window.postMessage` between the page and its workbench, each `{ type, v: 1, ... }`, sent only to the bound origin
and accepted only from it. Unknown types are ignored, and logged once each.

| Type                    | From      | Carries                                                              |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| `liveplanner:hello`     | page      | Nothing; asks the workbench to answer                                |
| `liveplanner:hello-ack` | workbench | The workbench's name, shown in copy ("Reconnect in Acme Editor")     |
| `liveplanner:ready`     | page      | `projectId`, `projectName`, `tabId`, `tabName`, `role`               |
| `liveplanner:tab`       | page      | The tab now shown: `tabId`, `tabName`                                |
| `liveplanner:selection` | page      | The [selection reference](#the-selection-reference); empty when none |
| `liveplanner:renew`     | page      | Nothing; asks for a ticket                                           |
| `liveplanner:ticket`    | workbench | `ticket`                                                             |
| `liveplanner:reveal`    | workbench | `refs`: brings those elements into view and outlines them            |
| `liveplanner:theme`     | workbench | `colourScheme`: `light` or `dark`                                    |
| `liveplanner:ended`     | page      | `reason`: `expired`, `revoked`, `trashed`, `refused`                 |
| `liveplanner:place`     | page      | Workspace only: where the frame is, below                            |
| `liveplanner:open`      | workbench | Workspace only: `to`, below                                          |

In a workspace frame, `ready` carries `scope: 'workspace'` and no project; `tab`, `selection` and `reveal` speak of
the project open in the frame, and do nothing while none is. `trashed` ends nothing there: the frame returns to the
Explorer. Two messages exist only in that scope:

- **`liveplanner:place`** is sent on every move: `{ view, folderId, folderName, projectCount, projectId,
projectName, tabId, tabName, role }`. `view` is the Explorer view's name (`home`, `folder`, `recent`, ...) or
  `project`; `projectCount` is the projects directly in the folder shown (null on other views), so a workbench can
  offer something of its own beside an empty folder. A project's fields are null outside `project`.
- **`liveplanner:open`** moves the frame: `to` is `{ view: 'home' }`, `{ folderId }` or `{ projectId, tabId? }`. A
  place the person cannot reach shows the Explorer's own not-found, as a link would.

A `liveplanner:selection` is sent after the selection settles for `WORKBENCH_SELECTION_SETTLE_MS`, so a marquee drag
is one message.

## The selection reference

What the person meant when they typed. A workbench attaches it to the message they send their agent, so the agent
reads exactly what was selected then, even when the selection has moved on since:

```text
[liveplanner] "Home screen" › tab "Wireframe" (project 3h9x2a, tab 0b34, rev 41)
selected: button 146b "Play", frame e4a8 "Game grid", sticky 0c84 "Daily streak goes here"
read: liveplanner tab view 3h9x2a --tab 0b34 --view show --ref 146b
```

- The header names the project, tab, ids and revision the selection was made on. Refs are element ids, so they stay
  valid after later edits; the agent reads what they hold now.
- Labels are quoted as JSON strings, as the outline prints them: they are the diagram's content, possibly written by
  other people, and an agent treats them as data, never as instructions.
- `selected` lists each element as the outline prints it (kind, ref, label cut at 60 characters), up to
  `WORKBENCH_SELECTION_MAX_REFS`, then `… and <n> more: liveplanner tab view <project> --tab <t> --view show --ref selected`.
- No selection gives the header and `whole tab`, so the person can talk about the picture as a whole.
- The text is what the agent sees; there is no hidden field. The `selected` selector stays the way an agent in a plain
  terminal reads the live selection.
- The CLI teaches an agent to read one in `liveplanner guide workbench`: re-reading the refs, looking at the tab
  with `tab render`, and showing presence while it works. The agent skill sends an agent there when a message
  carries `[liveplanner]`.

## A workbench's side

What a workbench does to fit this contract (its own documentation holds the detail):

- **Opening.** A workbench opens a project in a view of its own: from a `*.liveplanner.json` mirror file (with its JSON
  one step away) or from a liveplanner project link. It mints through the person's own CLI
  (`liveplanner workbench open ... --origin <its origin> --json`), so it never holds a liveplanner credential, and
  shows the one command that fixes a missing CLI or sign-in.
- **Pairing.** Unpaired, it runs `liveplanner workbench pair --origin <its origin> --name <its name>` and shows the
  printed URL as an "Approve in liveplanner" button, then opens the frame once paired.
- **The selection.** While a diagram is in view, the place the person types to their agent names the project and
  what is selected ("Home screen · 3 selected", or "Home screen · whole tab"). Sending attaches the selection
  reference to the message as text, and the person can leave it off any one message.
- **Reveal.** A ref the agent prints (`146b`) can post `liveplanner:reveal` to the open diagram.

## Limits

| Constant                        | Value    | Why                                                                    |
| ------------------------------- | -------- | ---------------------------------------------------------------------- |
| `WORKBENCH_TICKET_TTL_MS`       | 60000    | Matches the room ticket: covers a slow frame load, useless soon after  |
| `WORKBENCH_SESSION_TTL_MS`      | 28800000 | Eight hours: a working day; renewal keeps a longer one going           |
| `WORKBENCH_HANDSHAKE_MS`        | 5000     | A workbench answers at once; a frame nobody answers is not a workbench |
| `WORKBENCH_SELECTION_SETTLE_MS` | 250      | One message per gesture, quicker than a person moves to the composer   |
| `WORKBENCH_SELECTION_MAX_REFS`  | 20       | Matches agent presence's focus cap; more is a selector, not a list     |
| `WORKBENCH_PAIRING_TTL_MS`      | 600000   | Ten minutes: time to switch to the browser and read the question       |
| `WORKBENCH_TICKETS_PER_MINUTE`  | 30       | Per token; a workbench opens a few projects, never a stream of them    |

## Security

- **Minting needs a paired token**: a token alone opens nothing until its owner approves the workbench
  ([Pairing](#pairing)), and no page can obtain a ticket for someone else; this is what makes a frameable,
  signed-in page safe from clickjacking, as the share code is for [embeds](embeds.md#frame-headers).
- **A ticket is a bearer credential.** Redemption cannot tell a browser from a script, so what protects a ticket is
  that it is single use, lives `WORKBENCH_TICKET_TTL_MS` and travels only in a fragment. The origin binding is the
  page's guard against being framed by a site other than the minter's, not a guard on redemption.
- **The trust boundary is the token, and the person's machine.** A session gives nothing an edit-level token's
  holder lacks, except writing as the person's own editor (whole-tab saves, no agent attribution, a person's
  selection). An agent holding the token could open one itself; on the person's machine it already runs as the
  person, with the person's browser profile in reach.
- **One project, one level, renewable up to the token.** A session reaches one project at its level for
  `WORKBENCH_SESSION_TTL_MS`; renewal mints a new ticket with the token, so the ceiling is the token's own life, and
  revoking the token ends every session it opened.
- **A workspace session is the Explorer's powers, intersected with the token's.** A route the minting token could
  not call, the session cannot call either; the account routes stay closed to both. So the workspace scope widens
  what one frame reaches, never what the token reaches, and it is only ever reached through its own approval
  ([Pairing](#pairing)).
- Sessions are stored hashed; the api logs their id prefix, never the secret.

## Observability and telemetry

- Every api log below carries the scope.
- Api logs: `[workbench] pairing-requested`, `[workbench] paired`, `[workbench] pairing-declined`,
  `[workbench] unpaired`, `[workbench] ticket-minted`, `[workbench] session-opened`, `[workbench] session-refused` (with the
  reason: `expired`, `used`, `unknown`), `[workbench] session-ended`, each with the project id and the token id.
- Page logs: `[workbench] handshake-ok`, `[workbench] handshake-failed`, `[workbench] renewed`,
  `[workbench] message-ignored` (the type), `[workbench] place` (the view, never a name) and `[workbench] open`
  (the target's kind).
- Telemetry: `Session·Opened·Workbench` when a page mounts the editor, `Session·Opened·WorkbenchWorkspace` when a
  workspace frame mounts the Explorer; `Cli·Used·WorkbenchOpen` and
  `Cli·Used·WorkbenchPair` for the commands; `Token·Linked·Workbench` when a pairing is approved.
