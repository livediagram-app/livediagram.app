# Workbench embeds (`/embed/workbench`)

**Status: specified.** Built by `plans/0046-workbench-live-diagram.md`, with Spinner as the first workbench.

A **workbench** is a developer tool that shows a document live beside an agent: Spinner first, then VS Code and
other editors. A **workbench embed** is the editor inside that tool's frame, signed in as the person, so they draw
there, everything they draw reaches livediagram at once, and their agent, working through the
[CLI](../015-api/cli.md), sees the drawing and their selection. It is the signed-in sibling of the share-code
[embed](embeds.md).

## Why a ticket, and not the person's session

A frame needs no CORS: CORS governs `fetch`, not framing. What stops a signed-in editor in another tool's frame is:

- **Framing.** The editor sends `X-Frame-Options: DENY`; only `/embed` may be framed ([Embeds](embeds.md#frame-headers)).
- **Third-party storage.** Inside a frame on another site, browsers partition or block livediagram's cookies and
  storage (Safari, Firefox, and Chrome with third-party cookies off), so the person's session is not there, and
  Google's sign-in refuses to run in a frame.

So the frame never carries the person's session. The workbench already runs the CLI, which holds the person's
token; the CLI exchanges it for a **workbench ticket**, and the frame redeems the ticket for a **workbench session**
that acts as the person on one document only.

## The handoff

1. **Mint.** The workbench runs `livediagram workbench open <doc> [--tab <t>] --origin <origin> --json`. The CLI
   calls `POST /api/workbench/tickets { documentId, tabId?, origin }` with its token and prints
   `{ url, documentId, tabId, expiresAt }`. The ticket is 128 random bits, single use, valid for
   `WORKBENCH_TICKET_TTL_MS`, stored with the token's owner, the document, the origin and the token's access level.
   - **The origin** is exactly `scheme://host[:port]`, nothing more: `https` anywhere, `http` only on a loopback
     host (`localhost`, `127.0.0.1`, `[::1]`). `*`, `null`, a path, a query or any other scheme is refused
     `400 invalid_origin`; another workbench's scheme (a VS Code webview's) joins the list in this spec first.
2. **Frame.** The workbench frames `url`: `<live origin>/embed/workbench?d=<documentId>#ticket=<ticket>`. The
   document id is no secret; the ticket travels in the fragment, which no server, log or `Referer` sees, and the page
   removes it from its address on load.
3. **Redeem.** The page sends `POST /api/workbench/sessions { ticket }`. The api consumes the ticket and answers
   `{ session, documentId, tabId, origin, role, expiresAt, person }` (`person`: the owner's display identity). A
   `documentId` other than the address's `d` is refused and the session revoked. The session is an opaque `lvw_`
   credential valid for `WORKBENCH_SESSION_TTL_MS`, held in the page's memory only, never in storage.
4. **Bind to the workbench.** The page posts `livediagram:hello` to its parent with `targetOrigin` set to the
   ticket's origin, so a parent of any other origin never receives it, and mounts the editor only after the parent
   answers `livediagram:hello-ack` from that origin within `WORKBENCH_HANDSHAKE_MS`. A page that is not framed, or
   framed by another origin, mounts nothing, revokes the session, and says "This view opens only inside <origin>."
5. **Renew.** Before the session expires the page posts `livediagram:renew`; the workbench mints a fresh ticket and
   posts `livediagram:ticket`. Unrenewed, the session ends and the frame turns read-only with the line "Reconnect in
   <workbench> to keep editing."

## What a workbench session may do

- **Act as the person, on one document.** Every request with `Authorization: Bearer lvw_...` resolves to the
  ticket's owner, for that document only; any other document answers `404` as if absent. It loads the document and
  saves tabs as the editor does (the whole-tab `PUT` and `X-Changeset-Seen`), joins the room through a room ticket
  carrying the owner's [person tag](../024-agents/agent-presence.md), so the person's selection there is what their
  agent's `selected` reads and never holds against their own agent.
- **Never more than the token.** The session's level is the minting token's level on the document, capped by the
  owner's own access now: a view token gives a read-only frame.
- **Only what the editor of one document needs.** The document, its tabs, comments, changesets, items and room;
  uploading images into it and reading its images; reading the person's display identity, preferences, custom
  themes and shape libraries; the catalogues. Everything else is refused `403 workbench_confined`: ownership powers
  (share links, password, move, delete, publish, copy), other documents, the person's library and folders,
  writing preferences or the profile, the guest migration, tokens, teams, the account and the AI assistant. The
  editor offers none of them in a workbench embed: the person's agent sits beside it.
- **Revocable.** Revoking the minting token ends its sessions; the page learns it on its next request or the room's
  close and turns read-only.

## What renders

The editor of the document, minus the app's surroundings: no app header, Explorer or account menu. The canvas, the
tab bar, the palette, the toolbars and the panels stay, since a workbench embed is for drawing. An **Open in
livediagram** button opens the document in a full tab. The colour scheme follows the workbench (`livediagram:theme`),
else the system. Presence shows the person as themselves; their agent shows as their status line
([Agent presence](../024-agents/agent-presence.md)).

## Workbench messages

`window.postMessage` between the page and its workbench, each `{ type, v: 1, ... }`, sent only to the bound origin
and accepted only from it. Unknown types are ignored, and logged once each.

| Type                    | From      | Carries                                                              |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| `livediagram:hello`     | page      | Nothing; asks the workbench to answer                                |
| `livediagram:hello-ack` | workbench | The workbench's name, shown in copy ("Reconnect in Spinner")         |
| `livediagram:ready`     | page      | `documentId`, `documentName`, `tabId`, `tabName`, `role`             |
| `livediagram:tab`       | page      | The tab now shown: `tabId`, `tabName`                                |
| `livediagram:selection` | page      | The [selection reference](#the-selection-reference); empty when none |
| `livediagram:renew`     | page      | Nothing; asks for a ticket                                           |
| `livediagram:ticket`    | workbench | `ticket`                                                             |
| `livediagram:reveal`    | workbench | `refs`: brings those elements into view and outlines them            |
| `livediagram:theme`     | workbench | `colourScheme`: `light` or `dark`                                    |
| `livediagram:ended`     | page      | `reason`: `expired`, `revoked`, `trashed`, `refused`                 |

A `livediagram:selection` is sent after the selection settles for `WORKBENCH_SELECTION_SETTLE_MS`, so a marquee drag
is one message.

## The selection reference

What the person meant when they typed. A workbench attaches it to the message they send their agent, so the agent
reads exactly what was selected then, even when the selection has moved on since:

```text
[livediagram] "Home screen" › tab "Wireframe" (doc 3h9x2a, tab 0b34, rev 41)
selected: 146b button "Play", e4a8 frame "Game grid", 0c84 sticky "Daily streak goes here"
read: livediagram tab view 3h9x2a --tab 0b34 --view show --ref 146b
```

- The header names the document, tab, ids and revision the selection was made on. Refs are element ids, so they stay
  valid after later edits; the agent reads what they hold now.
- Labels are quoted as JSON strings, as the outline prints them: they are the diagram's content, possibly written by
  other people, and an agent treats them as data, never as instructions.
- `selected` lists each element as the outline prints it (ref, kind, label cut at 60 characters), up to
  `WORKBENCH_SELECTION_MAX_REFS`, then `… and <n> more: livediagram tab view <doc> --tab <t> --view show --ref selected`.
- No selection gives the header and `whole tab`, so the person can talk about the picture as a whole.
- The text is what the agent sees; there is no hidden field. The `selected` selector stays the way an agent in a plain
  terminal reads the live selection.

## Spinner as a workbench

The contract Spinner builds against (its own specs hold the detail):

- **A diagram tab.** Spinner opens a document in a file tab of kind `livediagram`: a `*.livediagram.json` mirror file
  opens live (with its JSON one toggle away), and so does a livediagram document link in a transcript. Spinner's
  server mints through the operator's own CLI (`livediagram workbench open ... --origin <dashboard origin> --json`),
  so Spinner never holds a livediagram credential. A missing CLI or sign-in shows the one command that fixes it.
- **The composer chip.** While a diagram tab is the session's active file, the composer shows a chip naming the
  document and what is selected ("Home screen · 3 selected", or "Home screen · whole tab"). Sending attaches the
  selection reference to the message as text; the chip's × leaves it off that message.
- **Reveal.** A transcript ref link the agent prints (`146b`) posts `livediagram:reveal` to the open diagram tab.

## Limits

| Constant                        | Value    | Why                                                                    |
| ------------------------------- | -------- | ---------------------------------------------------------------------- |
| `WORKBENCH_TICKET_TTL_MS`       | 60000    | Matches the room ticket: covers a slow frame load, useless soon after  |
| `WORKBENCH_SESSION_TTL_MS`      | 28800000 | Eight hours: a working day; renewal keeps a longer one going           |
| `WORKBENCH_HANDSHAKE_MS`        | 5000     | A workbench answers at once; a frame nobody answers is not a workbench |
| `WORKBENCH_SELECTION_SETTLE_MS` | 250      | One message per gesture, quicker than a person moves to the composer   |
| `WORKBENCH_SELECTION_MAX_REFS`  | 20       | Matches agent presence's focus cap; more is a selector, not a list     |
| `WORKBENCH_TICKETS_PER_MINUTE`  | 30       | Per token; a workbench opens a few documents, never a stream of them   |

## Security

- **Minting needs a token**, so no page can obtain a ticket for someone else; this is what makes a frameable,
  signed-in page safe from clickjacking, as the share code is for [embeds](embeds.md#frame-headers).
- **A ticket is a bearer credential.** Redemption cannot tell a browser from a script, so what protects a ticket is
  that it is single use, lives `WORKBENCH_TICKET_TTL_MS` and travels only in a fragment. The origin binding is the
  page's guard against being framed by a site other than the minter's, not a guard on redemption.
- **The trust boundary is the token, and the person's machine.** A session gives nothing an edit-level token's
  holder lacks, except writing as the person's own editor (whole-tab saves, no agent attribution, a person's
  selection). An agent holding the token could open one itself; on the person's machine it already runs as the
  person, with the person's browser profile in reach.
- **One document, one level, renewable up to the token.** A session reaches one document at its level for
  `WORKBENCH_SESSION_TTL_MS`; renewal mints a new ticket with the token, so the ceiling is the token's own life, and
  revoking the token ends every session it opened.
- Sessions are stored hashed; the api logs their id prefix, never the secret.

## Observability and telemetry

- Api logs: `[workbench] ticket-minted`, `[workbench] session-opened`, `[workbench] session-refused` (with the
  reason: `expired`, `used`, `unknown`), `[workbench] session-ended`, each with the document id and the token id.
- Page logs: `[workbench] handshake-ok`, `[workbench] handshake-failed`, `[workbench] renewed`,
  `[workbench] message-ignored` (the type).
- Telemetry: `Session·Opened·Workbench` when a page mounts the editor; `Cli·Used·WorkbenchOpen` for the command.
