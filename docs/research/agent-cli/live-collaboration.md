# The agent as a collaborator next to a live human

Research for the `livediagram` CLI: how an AI agent becomes a first-class participant in a
document a person has open, and what the CLI's collaboration model should be.

Scope: presence, attribution, streaming versus atomic writes, suggest and review, locking and
conflicts, how a stateless CLI call joins a room, comments as the conversation channel, watch
and notifications, and undo of an agent's batch. It ends with a recommended model and a mock
timeline.

Facts about livediagram were read from the code and specs at the time of writing (paths given).
Facts about other products are marked **verified** (read from their docs or source during this
research) or **recalled** (from general knowledge; treat as indicative, check before quoting).

## 1. Verdict in brief

- **Today an agent's write is invisible to the person and can be silently erased by them.** REST
  and MCP tab writes never reach the realtime room, and the editor's next whole-tab save of the
  same tab overwrites them in D1 (section 2). Fixing this is a prerequisite, not a nicety.
- **Route every CLI write through the room as one sequenced changeset**, applied to D1 by the
  api and recorded in the room's ledger so a racing editor save re-applies it. One CLI command
  is one changeset: atomic to store, revertable as a unit, revealed on screen as it lands.
- **Make the agent a visible participant without holding a socket.** A REST presence call with a
  short time-to-live (the Liveblocks `setPresence({ ttl })` pattern, verified) shows
  "Claude for Webber" in the avatar stack, highlights what it is touching, and expires on its own.
- **Respect the human's selection lock.** The room remembers each session's selection; a
  changeset touching an element a person holds waits briefly, then skips it and says so.
- **Comments are the asynchronous channel**, `@`-mentioning the agent summons it, and
  `livediagram wait` blocks until something relevant happens (the `gh run watch` and long-poll
  shape agents already handle well). A long-lived daemon is not needed for v1.
- **Undo of an agent batch is a revert of its changeset**, conflict-aware like `git revert`,
  offered as a toast in the editor and as `livediagram changes revert`. Personal Ctrl+Z stays
  personal, as the spec already decides.
- **Suggest mode comes second**: direct apply plus one-click revert covers the "person talks to
  the agent" case, where the conversation is the review. Unattended agents get `--propose` later.

## 2. Where livediagram stands

### 2.1 What exists and can be reused

| Asset                                                                | Where                                                  | Why it matters here                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Element-level ops `add / update / remove / reorder`, applied by id   | `packages/document/src/element-ops.ts`                 | The unit an agent changeset is made of; `diffToElementOps` derives them     |
| Per-field deltas (`comment-add`, `comment-resolve`, `check`, ...)    | `packages/document/src/element-deltas.ts`              | Comments from the agent travel as deltas and merge, never clobber           |
| Ordered room: `seq` within a persisted `epoch`, bounded op log (256) | `apps/api/src/document-room.ts`                        | Gives every agent change a total order and a cursor                         |
| Collaboration ledger merged into tab PUTs after `X-Room-Cursor`      | `room-client.ts` `mergeRoomLedger`, `collab-ledger.ts` | The exact mechanism that can keep an agent's change alive through a race    |
| Internal `POST /mutation` on the room (worker-originated op)         | `document-room.ts` (accepts only `el-delta` today)     | The seam a REST changeset enters the room through                           |
| One-time room ticket minted over authenticated REST                  | `routes/document-room-routes.ts`                       | How a CLI process with an `lvd_` token can open a socket for `wait`/`watch` |
| Server-built presence (random presence id, clamped name and colour)  | `helloPresence` in `document-room-rules.ts`            | An agent presence entry slots into the same roster                          |
| Room remembers per-session state in the socket attachment (`tabId`)  | `document-room.ts` `SessionAttachment`                 | Precedent for remembering each session's selection                          |
| Follow-me viewport, bring focus                                      | `docs/specs/012-collaboration/follow-me-viewport.md`   | "Show me what you changed" for free                                         |
| Comment endpoints (add, delete-own) that relay to the room           | `routes/document-subresource-routes.ts`                | Agent comments already go live                                              |

### 2.2 The gaps, verified

1. **Invisible writes.** The tab `PUT` in `document-subresource-routes.ts` writes D1 and returns.
   It calls `mergeRoomLedger` (read only) but never tells the room. Only comments
   (`relayElementDelta`), share changes and trash reach the room. A person with the tab open does
   not see the agent's change until a resync or reload.
2. **Silent erasure, both directions.**
   - Person over agent: the editor persists by PUTting its _whole copy_ of a changed tab. Its copy
     lacks the agent's change, so the next local edit on that tab writes the stale copy over it.
     The agent's work vanishes from D1 and nobody is told.
   - Agent over person: MCP `update_document` in `ops` mode reads the tab, applies, then PUTs the
     whole tab. For an LLM the read-to-write gap is the model's thinking time, often tens of
     seconds, and every human edit in that window is overwritten.
   - The ledger merge cannot help: it only covers multi-writer deltas, and a token save carries no
     `X-Room-Cursor` so it is never merged anyway.
3. **No room for personal documents.** `useRoomConnection` only connects when the document is
   shared or in a team, and `roomStubFor` returns null otherwise, on the premise "anything else
   has one writer". An agent is a second writer, so the premise no longer holds.
4. **No agent identity.** A comment posted with a token is credited to the token owner's
   participant record (`getParticipant(owner)`), so Claude's comment reads as Webber's. Created
   documents carry `source: 'mcp'` (the Made by AI filter); elements and edits carry nothing.
5. **Lock-blind.** The concurrent-selection lock is client-only (`docs/specs/007-editor/live-app.md`),
   the room relays `select` ops without remembering them, and REST writers never see it.
6. **No unit to undo.** Undo is a local snapshot stack of one's own changes (locked decision 1 in
   `realtime-conflict-resolution.md`). A remote change is not on it, and nothing groups an agent's
   change so it can be reverted.
7. **Comment surface holes.** There is no REST endpoint to resolve or reopen a thread (it only
   exists as a delta inside the editor's save), arrows cannot hold comments (the endpoint 404s on
   `type === 'arrow'`), and mentions resolve team members only (`comment-mentions.md`).
8. **No way to listen.** There is no read API for "what changed since cursor X" or "new comments
   mentioning me". The only live channel is the browser's socket.
9. **Budget lines in the room.** `OP_LOG_LIMIT = 256`, `OP_RATE_CAP = 240` frames per second per
   session, `MAX_MESSAGE_CHARS = 256 KiB`. A 60-element agent build sent as 60 `el` ops takes a
   quarter of the replay log in one go.

## 3. Prior art

| Product                                 | How the agent joins                                                                | Presence and attribution                                                                                | How edits land                                                                                         | Review and undo                                                                                                          | Lesson for livediagram                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Liveblocks** (verified)               | Server-side, no socket: `liveblocks.mutateStorage(roomId, fn)` from Node           | `liveblocks.setPresence(roomId, { userId, userInfo, data: { editingId }, ttl: 30 })`; `ttl: 2` to clear | Through the same Sync document humans edit, so it is live for everyone                                 | Docs recommend saving a version snapshot before the agent modifies, so the person can revert; "AI comments" join threads | The stateless, TTL presence pattern fits a CLI exactly                                              |
| **Hocuspocus / Yjs** (verified)         | `hocuspocus.openDirectConnection(name, context)` then `transact(fn)`, `disconnect` | Yjs Awareness: per-client JSON state, peers drop a client after 30 s without a heartbeat                | A CRDT transaction, merged with concurrent human edits                                                 | `Y.UndoManager({ trackedOrigins })` undoes only changes from chosen origins: per-actor undo                              | Tag every change with an origin; per-actor revert without a CRDT via changeset ids                  |
| **tldraw agent starter kit** (verified) | Agent runs beside the canvas, driven from a chat panel                             | Agent has its own viewport it moves to look at parts of the canvas                                      | Actions stream: shapes are created, updated, deleted "incrementally as each action finishes streaming" | Keeps a todo list; schedules follow-up reviews of its own work                                                           | Compact context: simplified shapes in view plus clusters outside; reveal work as it lands           |
| **Figma multiplayer** (recalled)        | Server-authoritative; clients send property changes                                | Cursors, avatar stack, "spotlight" and follow                                                           | Per-object, per-property last-writer-wins, server orders                                               | Undo is per user, of one's own changes                                                                                   | livediagram is Figma-shaped already, but per element, not per property: add a field-level patch op  |
| **Figma AI features** (recalled)        | In-client features act on the selection or file                                    | The person invoked it, so it is attributed to them                                                      | Applied as an ordinary edit                                                                            | Undoable as one step by the invoker                                                                                      | A batch should be one undo unit                                                                     |
| **Google Docs** (recalled)              | Gemini drafts inside the doc; humans use Suggesting mode                           | Suggestions carry author and time in the margin                                                         | Suggestion = pending, attributed change rendered inline                                                | Accept or reject per suggestion                                                                                          | The suggest-mode model, if built, should be per changeset with per-element reject                   |
| **Notion AI** (recalled)                | In-page AI blocks and an agent that edits pages                                    | AI output marked as such while pending                                                                  | Drafts in place                                                                                        | Keep or discard; page history as the backstop                                                                            | Pending-then-keep is friendly when the human is present                                             |
| **Miro AI** (recalled)                  | AI acts on selected stickies and frames                                            | Generated content placed beside the source                                                              | Adds new items rather than rewriting the person's                                                      | Ordinary undo                                                                                                            | Prefer adding beside over rewriting in place when unsure                                            |
| **Cursor / Zed agent edits** (recalled) | Agent edits the working buffers                                                    | Zed can follow the agent's location                                                                     | Applied as diffs                                                                                       | Accept or reject per hunk; checkpoints restore earlier state                                                             | Apply first, review after, granular reject; "follow" maps onto follow-me viewport                   |
| **GitHub Copilot in PRs** (recalled)    | Summoned by assignment or `@copilot` in a comment                                  | Acknowledges with a reaction, commits under its own identity on behalf of the user                      | Works on a branch, opens a draft PR                                                                    | Normal PR review; iterate through review comments                                                                        | Comments as summon and feedback channel; acknowledge at once; propose-as-branch for unattended work |

Three patterns recur:

- **The agent is a named participant, not a ghost writer.** It appears in presence with a
  distinct identity, and its work is credited to it, usually "on behalf of" a human.
- **Edits flow through the same live channel as humans'.** None of these products lets an agent
  write behind the room's back; Liveblocks does it server-side but still through the Sync document.
- **Revert is scoped to the actor.** Either per-origin undo (Yjs), a pre-change snapshot
  (Liveblocks), checkpoints (Cursor) or a branch (Copilot).

## 4. Design dimensions

### 4.1 How a CLI call joins the room

| Option                               | Shape                                                                                                        | Strengths                                                                                         | Weaknesses                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A. REST only (today)                 | `PUT` whole tabs                                                                                             | Simple                                                                                            | Invisible and erasable (section 2.2); disqualified                                                              |
| **B. REST relayed through the room** | `POST /api/documents/:id/changes`; the worker gates, the room sequences and broadcasts, the worker writes D1 | Every one-shot command is live-safe; no process to keep alive; mirrors Liveblocks `mutateStorage` | Room becomes part of the write path for agent changes; needs a ledger extension so racing saves keep the change |
| C. Session daemon holding the socket | `livediagram session start` forks a local process with a ticketed WebSocket; commands talk to it             | Live state, cursor, sub-second lock awareness, cheapest writes                                    | Agents juggle a background process; stale daemons; harder in sandboxes and CI; a second client to maintain      |
| D. CRDT peer (Yjs, Hocuspocus style) | Server-side direct connection                                                                                | Field-level merge                                                                                 | Dropped deliberately in `realtime-conflict-resolution.md`; would bring back a document copy in the room         |

**Recommendation: B for every write, plus a socket only while a `wait` or `watch` command runs.**
The socket is opened with a room ticket (`POST /room-ticket`, already token-capable) and closed
when the command exits. Hibernated WebSockets keep an idle `watch` cheap. C stays possible later
as an optimisation, built on the same pure functions; it is not needed for correctness.

### 4.2 Presence and attribution

- **Who the agent is.** The token proves the human; the agent names itself (`--as Claude`, or
  `LIVEDIAGRAM_AGENT` in the environment, default from the token's name). The server always
  renders it as **"Claude for Webber"**: the agent part is a self-declared label, the "for" part is
  the verified token owner, so an agent can never pass itself off as a person.
- **Presence without a socket.** `POST /api/documents/:id/presence` with `{ status, tabId,
focus: [elementIds], ttl }`. The room keeps a virtual roster entry with an alarm-driven expiry.
  Every changeset refreshes it (ttl about 20 s). The entry carries `agent: true` so the avatar
  stack shows a distinct mark (a sparkle badge) and the hover card reads "Claude for Webber:
  adding the payment service".
- **"Is editing" highlight.** `focus` element ids draw the agent's colour ring on those
  elements, the Liveblocks `editingId` pattern. It is a soft claim: it warns the human, it does
  not lock them out.
- **A cursor is optional and mostly theatre.** A CLI has no pointer. A presence `at` point (the
  centre of what it just changed) lets the editor draw the agent's cursor gliding to the work,
  which reads well on screen and costs one field. Respect reduced motion.
- **Attribution that persists.**
  - Comments: `authorName: "Claude for Webber"`, `authorId` = token owner (delete-own still
    works), plus `agent: "Claude"` so the UI can badge it. Today the name would be "Webber".
  - Changes: each changeset records `{ id, agent, for, summary, at, elementIds }` in the
    timeline (`docs/specs/013-workspace/timeline.md`) as "Claude for Webber changed 6 elements:
    added payment service". Per-element provenance (`createdBy`) is not needed for v1.

### 4.3 Write granularity and conflicts

- **One command, one changeset.** The CLI sends `{ changesetId, tabId, ops: ElementOp[],
summary }`. The room relays it as **one** sequenced `changeset` op (one log slot, one render on
  receivers), not N `el` ops.
- **Field-level patch for updates.** Add an `ElementOp` variant `patch` carrying only the fields
  the agent changed (`{ kind: 'patch', id, set: { label: 'Payments' } }`). "Rename this box" then
  cannot undo the drag a person made a second earlier. This is the cheap half of the dropped CRDT:
  per-field last-writer-wins, no library, no document copy in the room.
- **Base guard.** The CLI reads with a cursor (`rev`), and may send `--if-unchanged` with a
  per-element fingerprint for elements whose whole state matters (for example a table it rebuilt).
  The api checks it against the tab it is about to write; a mismatch rejects that element with a
  named reason (`changed_since_read`) instead of overwriting.
- **Persistence path.**
  1. Worker gates the token (edit), validates ops and size.
  2. Worker hands the changeset to the room (`/mutation`, widened to accept `changeset`). The room
     checks the selection lock (4.6), stamps `seq`, broadcasts, and records the changeset in a
     persisted, bounded **authored-change ledger** for the tab.
  3. Worker applies the accepted ops to the D1 tab (read, apply, write) and returns the result.
  4. When an editor's whole-tab PUT arrives carrying a cursor older than the changeset's `seq`, the
     existing ledger merge re-applies the changeset's ops to it, exactly as it already does for
     answers and dots. A stale snapshot can no longer erase the agent's work.
  - Residual, stated plainly: a save with no cursor (the unload beacon) is not merged, as today.
    The receiving editors hold the change, so their next save restores it.
- **Every document has a room (decided).** The editor always connects to its room, personal
  documents included, and `roomStubFor` stops returning null for them. Idle sockets hibernate,
  so the cost is a Durable Object wake per opened document. Connecting on demand, limiting
  agents to shared or team documents, and polling D1 were rejected.

### 4.4 Streaming versus atomic

- Atomic per command is the right storage and undo unit, and a CLI is naturally batched.
- Streaming happens at **command granularity**: an agent building a diagram issues several
  commands (skeleton, then arrows, then labels), and each lands visibly as it goes, much like the
  tldraw kit's per-action streaming.
- Inside one changeset, the editor may **reveal** elements in sequence over about 400 ms with a
  brief agent-coloured outline ("ink drying"), so a person sees where the change happened. Off
  under `prefers-reduced-motion`; never delays the data.
- No token-by-token element streaming: half-made elements would be persisted, broadcast and
  undone piecemeal for no gain.

### 4.5 Suggest and review

| Mode                      | When                                                                                                        | How it works                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **apply** (default)       | A person asked for it and is watching, or the agent works alone                                             | Changeset lands; toast "Claude for Webber changed 6 elements · Show · Undo"; revert per 4.7                                                                             |
| **propose** (`--propose`) | Unattended agents (a coding agent updating the architecture diagram), or a document set to "agents propose" | Changeset is stored pending, not applied; editors draw it as a ghost overlay; Accept, Reject, or reject individual elements; accepting applies it as a normal changeset |

- Apply-first matches Cursor and Zed: the conversation is the review, and revert is one click.
- Propose is the Google Docs Suggesting and Copilot draft-PR model. It needs a ghost renderer in
  the editor, so it ships after apply. A cheap stand-in until then: `--propose` writes to a copy
  tab named "Claude's proposal" and leaves a comment linking it. The person compares tabs; there
  is no merge tool, so this is a stopgap only.

### 4.6 Locking

- The room remembers each session's current selection in its socket attachment, the same way it
  already remembers `tabId` from `tab-focus`.
- A changeset touching an element a human holds: the room **holds** it for up to `--wait-lock`
  (default 5 s), re-checking as selections change, then applies everything else and **skips** the
  held elements, returning them as `skipped: [{ id, reason: 'held', by: 'Webber' }]`. `--force`
  overrides, and is shown to the person as such.
- The agent's own `focus` ring (4.2) is the mirror image: a soft claim that tells the person
  "Claude is on this one", without locking them out. People outrank agents.

### 4.7 Undo of an agent batch

- At apply time the room stores the changeset's **before-images** (the touched elements as they
  were, and the ids it added), bounded per document (last 50 changesets or 24 h) and capped under
  the Durable Object value size, as the ledger already is.
- **Revert** builds inverse ops and applies them as a new changeset, conflict-aware: an element
  changed by someone else since is left alone and reported (`kept: el-7, changed by Webber`),
  like `git revert` refusing a conflicting hunk. Removed elements come back; added ones go.
- Surfaces: the toast's Undo, a "Recent agent changes" list in the timeline, and
  `livediagram changes revert <changesetId>`. A person's own Ctrl+Z is untouched.

### 4.8 Comments as the conversation channel

- **Reading.** `livediagram comments <doc> --open` lists open threads compactly, one line per
  comment, with element id, label and author. `--mentions` narrows to threads that mention the
  agent.
- **Writing.** `comment add <element> "text"`, `comment reply <threadElement> "text"`,
  `comment resolve`, `comment reopen`. Needs a resolve/reopen REST endpoint (relayed as the
  existing `comment-resolve` delta) and comments on arrows or a canvas point (the Comment Panel
  element, `comment-pin`, already covers "a place").
- **Summoning.** Typing `@` in a thread offers the agents that have been present on this document
  recently ("Claude for Webber"), stored as a mention of kind `agent`. Only the agent's owner's
  `wait` sees it as addressed to them; nobody else's agent is summoned.
- **Acknowledge at once.** On picking a thread up, the agent sets presence `focus` on that element
  with status "reading your comment", the Copilot "eyes" reaction in livediagram's terms, then
  replies, edits, and resolves or leaves open for the person.
- **Trust.** Comment text is untrusted input to the agent. The CLI prints it fenced and labelled
  with its author; a comment from a share-link visitor is never treated as an instruction from
  the token owner. This deserves a line in the CLI help.

### 4.9 Watch and wait

- `livediagram watch <doc>` streams one compact line per event until interrupted, for agents that
  can run a background stream, and for humans.
- `livediagram wait <doc> --for mention|comment|change|presence [--timeout 300]` blocks, prints
  the first matching event, and exits 0; exit 2 on timeout. This is the shape agents handle best:
  a single blocking call, then act, then wait again.
- Both open a ticketed WebSocket, `sync` with `--since <rev>` so nothing is missed between calls,
  and print events from the room's op stream after filtering out the agent's own changes and
  pure presence noise (cursors, drag previews).
- A cursor is printed with each event (`rev=e1f3:418`) so the next call resumes exactly. When the
  room answers `resync`, the CLI prints one `resync` line and the agent re-reads.

### 4.10 Security and limits

- Agent label: length-clamped and sanitised like a presence name; always rendered with the
  verified owner.
- A changeset is capped (for example 200 ops and the 256 KiB frame cap) with a named rejection.
- Presence calls rate-limited per token per document; ttl clamped (2 to 60 s).
- Read-only tokens may `watch`, `wait`, read and comment (decided), the same as view-role
  share visitors. Every other write is still refused.
- Every decision point logs a fingerprint: `[agent-changeset] applied|skipped|rejected`,
  `[agent-presence] set|expired`, `[agent-revert] applied|kept`.

## 5. Recommended collaboration model

**The agent is a named, visible, polite participant whose every command is one live changeset.**

1. Every write is a changeset through the room: live for everyone, ordered, stored, revertable.
2. Presence by REST with a short ttl: "Claude for Webber", status line, focus rings, optional
   cursor glide. No socket required.
3. People outrank agents: held elements are waited on, then skipped and reported.
4. Field-level patches for updates; an `--if-unchanged` guard where the agent rebuilt something.
5. Comments are the asynchronous channel; `@`-mention summons the owner's agent; `wait` delivers.
6. Revert per changeset, conflict-aware, from the editor toast or the CLI.
7. Propose mode follows, for unattended agents.

### 5.1 CLI surface for this angle

```bash
livediagram whoami                                   # token owner, agent label
livediagram read <doc> [--tab t] [--view outline|graph|comments|changes] [--since rev]
livediagram apply <doc> --tab t <ops.json|-> [--summary "..."] [--if-unchanged] [--wait-lock 5] [--force] [--propose]
livediagram presence <doc> --status "adding payment service" [--focus el-4,el-9] [--ttl 20] [--clear]
livediagram comments <doc> [--open] [--mentions]
livediagram comment add|reply|resolve|reopen ...
livediagram changes <doc> [--mine]                   # recent changesets with ids
livediagram changes revert <changesetId>
livediagram watch <doc> [--since rev]
livediagram wait <doc> --for mention|comment|change [--timeout 300] [--since rev]
```

Output is compact text by default, `--json` on request. A changeset result:

```bash
$ livediagram apply d_7Kq --tab main ops.json --summary "add payment service"
cs_91 applied rev=e1f3:418 +3 ~2 -0
skipped el-12 held by Webber (5s)
```

A `wait` result:

```bash
$ livediagram wait d_7Kq --for mention
mention rev=e1f3:431 tab=main el-9 "Payments" Webber: "@Claude should this be async?"
```

### 5.2 What livediagram needs to change

| Change                                                                                     | Where                                                          | Size   |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------ |
| `POST /api/documents/:id/changes` (validate, room sequence, D1 apply, result)              | new route beside `document-subresource-routes.ts`              | medium |
| `changeset` room op (one log slot); `patch` element op                                     | `packages/api-schema/src/room-messages.ts`, `element-ops.ts`   | small  |
| Room: accept `changeset` on `/mutation`, lock check, authored-change ledger, before-images | `document-room.ts`, `room-ledger-store.ts`, `collab-ledger.ts` | medium |
| Tab PUT merge re-applies changesets after the saver's cursor                               | `room-client.ts` `mergeRoomLedger`                             | small  |
| Room remembers each session's selection                                                    | `document-room.ts` attachment                                  | small  |
| REST presence with ttl; `agent` flag on `ParticipantPresence`; alarm expiry                | `document-room.ts`, `api-schema`                               | medium |
| Editor: agent avatar badge, focus rings, reveal outline, changeset toast with Undo         | `apps/live`                                                    | medium |
| Room for every document, personal ones included                                            | `useRoomConnection.ts`, `roomStubFor`                          | small  |
| Comments: resolve/reopen endpoint, agent author fields, agent mentions                     | comment routes, `comments.ts`, `comment-mentions.md`           | medium |
| `wait` / `watch` over a ticketed socket with `--since`                                     | CLI; room `sync` already exists                                | small  |
| Retire whole-tab writes for agents: MCP `update_document` uses changesets too              | `apps/mcp/src/tools.ts`                                        | small  |
| Telemetry: agent changeset applied, reverted, skipped                                      | `TELEMETRY_*` enums                                            | small  |

The MCP server should move onto the same changeset path in the same change, so the two agent
front doors cannot drift.

## 6. Mock timeline

Webber has "Checkout architecture" open in the editor on the Main tab and is talking to Claude in
a chat app with the CLI available. Times are wall-clock seconds.

| Time  | Webber                                                                                           | Claude (CLI)                                                                                                                                                                                                           | What the canvas shows                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 00:00 | "Add a payment service between Checkout and the Order DB."                                       |                                                                                                                                                                                                                        |                                                                                                                       |
| 00:02 |                                                                                                  | `presence d_7Kq --status "reading the diagram"` then `read d_7Kq --view graph`                                                                                                                                         | A sparkle avatar "Claude for Webber" joins the stack: "reading the diagram"                                           |
| 00:03 |                                                                                                  | Output: 9 nodes, 8 edges, one line each, ids and labels, `rev=e1f3:410`                                                                                                                                                |                                                                                                                       |
| 00:09 | Drags the Order DB box down a little while waiting                                               |                                                                                                                                                                                                                        | Ordinary edit, saved and broadcast                                                                                    |
| 00:12 |                                                                                                  | `apply ... --summary "add payment service"`: add Payments box, rewire Checkout to Payments to Order DB (patches only the arrow endpoints)                                                                              | Payments box appears with a brief Claude-coloured outline; the arrow reroutes. Webber's drag of Order DB is untouched |
| 00:12 |                                                                                                  | `cs_91 applied rev=e1f3:418 +2 ~1 -0`                                                                                                                                                                                  | Toast: "Claude for Webber changed 3 elements · Show · Undo"                                                           |
| 00:20 | "Label the arrows with the calls, and make Stripe external." Clicks the Stripe box to look at it |                                                                                                                                                                                                                        | Webber now holds the Stripe box (selection lock)                                                                      |
| 00:24 |                                                                                                  | `apply ... --summary "label calls, mark Stripe external"`                                                                                                                                                              | Three arrow labels appear                                                                                             |
| 00:29 |                                                                                                  | `cs_92 applied +0 ~3 -0` / `skipped el-12 held by Webber (5s)`                                                                                                                                                         | Stripe box unchanged while Webber holds it                                                                            |
| 00:30 |                                                                                                  | Tells Webber in chat: "Labelled the calls. You had Stripe selected, so I left it; click away and I'll mark it external."                                                                                               |                                                                                                                       |
| 00:34 | Clicks the empty canvas: "Go ahead."                                                             | `apply ... --focus el-12` then `cs_93 applied ~1`                                                                                                                                                                      | Stripe box gets the external style; a ring flashes on it                                                              |
| 00:50 | "Hmm, I preferred it before the labels. Undo just that bit."                                     | `changes revert cs_92`                                                                                                                                                                                                 | Labels disappear; Payments box and Stripe styling stay                                                                |
| 00:51 |                                                                                                  | `cs_94 reverted cs_92 ~3 kept 0`                                                                                                                                                                                       | Toast: "Claude for Webber reverted 'label calls'"                                                                     |
| 01:10 | "I'm off to lunch. Anna will review; answer her comments."                                       | `presence --clear`, then `wait d_7Kq --for mention --timeout 1800`                                                                                                                                                     | Claude's avatar leaves the stack                                                                                      |
| 14:02 | (Anna, a teammate, comments on Payments: "@Claude should this call be async?")                   |                                                                                                                                                                                                                        | Comment appears live with Anna's name                                                                                 |
| 14:02 |                                                                                                  | `wait` returns: `mention rev=e1f3:431 tab=main el-9 "Payments" Anna: "@Claude should this call be async?"`                                                                                                             |                                                                                                                       |
| 14:03 |                                                                                                  | `presence --status "answering Anna" --focus el-9`; `comment reply el-9 "Yes: checkout can return once the payment intent exists. I've added a queue; revert cs_95 if not."`; `apply ... --summary "add payment queue"` | Claude reappears, ring on Payments; reply credited "Claude for Webber"; a Queue box slides in between                 |
| 14:05 |                                                                                                  | Leaves the thread open for Anna; `presence --clear`; `wait` again                                                                                                                                                      | Anna resolves the thread herself                                                                                      |

What the person never experiences: a change appearing only after reload, their drag being undone
by the agent, the agent's work disappearing after their own edit, or a comment from Claude that
looks like it came from them.

## 7. Decisions

Webber decided these four forks; specs should record them when this work is specified.

| Question                        | Decision                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Personal documents and the room | The editor always connects to its room, personal documents included                     |
| Default write mode for agents   | Apply, with a revert toast; `--propose` is opt-in and comes later                       |
| Agent mentions                  | `@` offers the agents seen on this document recently; only their owner's `wait` sees it |
| Read-only tokens and comments   | Allowed, like view-role visitors; other writes stay refused                             |

## 8. Sources

- livediagram: `docs/specs/012-collaboration/realtime-conflict-resolution.md`,
  `collab-race-hardening.md`, `resync-without-reload.md`, `comment-mentions.md`,
  `comment-pin.md`; `docs/specs/007-editor/live-app.md` (concurrent-selection lock);
  `docs/specs/015-api/mcp-server.md`, `public-api-and-tokens.md`;
  `apps/api/src/document-room.ts`, `room-client.ts`, `routes/document-room-routes.ts`,
  `routes/document-subresource-routes.ts`; `apps/live/app/document/[id]/useRoomConnection.ts`;
  `packages/document/src/element-ops.ts`, `element-deltas.ts`, `comments.ts`;
  `packages/api-schema/src/room-messages.ts`, `index.ts` (`ParticipantPresence`).
- Liveblocks (verified): <https://liveblocks.io/docs/products/sync/agentic-editing>,
  <https://liveblocks.io/docs/use-cases/agentic-users>,
  <https://liveblocks.io/docs/get-started/nextjs-ai-presence>.
- tldraw agent starter kit (verified): <https://tldraw.dev/starter-kits/agent>.
- Yjs (verified): <https://docs.yjs.dev/api/about-awareness>, <https://docs.yjs.dev/api/undo-manager>.
- Hocuspocus (verified in source): Hocuspocus's packages/server/src/Hocuspocus.ts (`openDirectConnection`),
  Hocuspocus's packages/server/src/DirectConnection.ts (`transact`, `disconnect`),
  <https://github.com/ueberdosis/hocuspocus>.
- Recalled, not re-checked in this research: Figma multiplayer (Figma engineering blog, "How
  Figma's multiplayer technology works"), Figma AI, Google Docs Suggesting mode and Gemini,
  Notion AI, Miro AI, Cursor and Zed agent review, GitHub Copilot coding agent.
