# Agent presence: blueprint

Derived from [Agent presence](../agent-presence.md), with the levels of
[Share roles](../../013-workspace/share-roles.md), the rooms and revisions of
[Agent changesets](../agent-changesets.md), the refs of [Document views](../document-views.md), the room and
comment routes of [API app](../../015-api/api.md) and the identity rules of
[Public API and API tokens](../../015-api/public-api-and-tokens.md) §6. The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `PRn`.

It builds on the sibling blueprints and calls what they provide by these names:

| Provided by      | Name used here                                                                                | What it is                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| share-roles      | `ShareRole`, `TokenRole`                                                                      | The levels on grants, tickets, room sessions and tokens; no member is named here |
| share-roles      | `gateParticipate`, `gateEdit` `(ctx, id, ownerId, teamId, tabId?)`                            | True when the caller's grant and its token (if any) pass that gate               |
| share-roles      | The write choke point's route-gate matcher                                                    | Lets a token's write reach a route only when the token passes that route's gate  |
| agent-changesets | `ctx.token: { id, ownerId, role } \| null` on `RouteContext`                                  | The presenting API token, null for a session or a guest                          |
| agent-changesets | `roomStubFor` returns a stub for every server-stored document                                 | Rooms for personal documents                                                     |
| agent-changesets | `upsertTabAtRev(env, documentId, tab, orderIndex, rev)`, `tabs.rev`                           | The compare-and-swap tab write; every write increments `rev`                     |
| agent-changesets | `agentFrontDoor(request): 'Mcp' \| 'Cli' \| 'Api'`                                            | The telemetry type of an agent request                                           |
| agent-changesets | The changeset route's success step                                                            | Calls `refreshAgentPresence` here                                                |
| document         | `tabRefs(tab)`, `resolveRef(tab, input)` in `packages/document/src/element-refs.ts` (planned) | Refs and ref resolution                                                          |
| document-views   | `viewLabel(el)`, `readingOrder(elements)`                                                     | The view label, reading order                                                    |

Scope, by file:

| File                                                                                                   | Role                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `packages/api-schema/src/agent-presence.ts` (planned)                                                  | Constants, `AgentPresence` (wire), `AgentPresenceRequest`, `parseAgentPresenceRequest`, codes    |
| `packages/api-schema/src/comment-threads.ts` (planned)                                                 | `COMMENT_LIST_STATUSES`, `CommentListStatus`, `DocumentCommentThread`, `COMMENT_TEXT_MAX`        |
| `packages/api-schema/src/room-messages.ts`                                                             | The `presence` frame gains `agents: AgentPresence[]`                                             |
| `packages/api-schema/src/index.ts`                                                                     | Re-exports the two new modules                                                                   |
| `packages/api-schema/src/telemetry-schema.ts`, `server-emitted-events.ts`                              | Action `Present` (category `Agent`); `Agent·Present` is server-emitted                           |
| `packages/document/src/comments.ts`                                                                    | `Comment.tokenId`; `withoutCommentAuthorId` strips it too                                        |
| `apps/api/migrations/0068_ws_ticket_person_tag.sql` (planned)                                          | `ws_tickets.person_tag` (PR1)                                                                    |
| `apps/api/src/db/ws-tickets.ts`                                                                        | `WsAdmission.personTag`; written at mint, returned at consume                                    |
| `apps/api/src/db/tabs.ts`                                                                              | `tabIdsWithComments(env, documentId)`                                                            |
| `apps/api/src/person-tag.ts` (planned)                                                                 | `personTagFor(documentId, ownerId)`                                                              |
| `apps/api/src/comments.ts`                                                                             | `tokenId` locked by `rewriteCommentAuthors`, blanked by `redactCommentAuthorIds`; `threadsOfTab` |
| `apps/api/src/routes/comment-routes.ts` (planned)                                                      | `handleCommentRoutes`: add, delete-own (moved, PR28), reply, resolve, reopen, list               |
| `apps/api/src/routes/agent-presence-routes.ts` (planned)                                               | `handleAgentPresenceRoute`: `PUT` / `DELETE .../tabs/:tabId/presence`                            |
| `apps/api/src/routes/document-subresource-routes.ts`                                                   | Dispatches to the two handlers above; loses the inline add and delete-own                        |
| `apps/api/src/routes/context.ts`                                                                       | `deniedOnTab` moves here from the subresource routes; `deniedParticipate`                        |
| `apps/api/src/routes/document-room-routes.ts`                                                          | The mint stores the person tag; the upgrade sets `X-Verified-Person`                             |
| `apps/api/src/room-client.ts`                                                                          | `putAgentPresence`, `deleteAgentPresence`, `refreshAgentPresence`; `relayElementDelta` logs      |
| `apps/api/src/room-agent-presence.ts` (planned)                                                        | `RoomAgentPresence` (storage, set, refresh, clear, sweep) and the pure `agentRosterFor`          |
| `apps/api/src/document-room.ts`                                                                        | `PUT` / `DELETE /presence`, restore, `armAlarm`, `alarm`, roster, clears on trash and revoke     |
| `apps/api/src/index.ts`                                                                                | The comment routes and presence among the participation-class routes of the choke point matcher  |
| `apps/api/src/openapi/manifest.ts`, `schemas.generated.ts`, `apps/api/scripts/gen-openapi-schemas.mjs` | Six new routes, `tokenUsable` on the comment routes, the new schemas                             |
| `apps/live/lib/api/room.ts`                                                                            | `onPresence(participants, agents)`                                                               |
| `apps/live/lib/api/tabs.ts`                                                                            | `apiResolveThread`, `apiReopenThread`                                                            |
| `apps/live/lib/agent-presence-rows.ts` (planned)                                                       | `splitPresenceFrame`, `foldAgentPresence`, `buildAgentFocusByElement`                            |
| `apps/live/lib/identity.ts`                                                                            | `Participant.statusLine`, `Participant.agent`                                                    |
| `apps/live/lib/collaborator-roster.ts`                                                                 | `peopleCount` leaves agent rows out; `participantBadges` reads the agent's level                 |
| `apps/live/app/document/[id]/usePresenceState.ts`, `useRoomConnection.ts`                              | `agentPresence` state, set from the frame                                                        |
| `apps/live/app/document/[id]/usePresenceRows.ts`                                                       | Composes the fold and the focus map                                                              |
| `apps/live/hooks/collab/useEditorComments.ts`                                                          | A non-edit session resolves and reopens through the endpoints                                    |
| `apps/live/components/primitives/ParticipantAvatar.tsx`                                                | The status line in the hover card and the accessible name                                        |
| `apps/live/components/dialogs/CollaboratorsDialog.tsx`                                                 | The status line on a row; no Follow on an agent row                                              |
| `apps/live/components/canvas/AgentFocusRings.tsx` (planned), `CanvasElementsLayer.tsx`                 | Focus rings beside `LaserOverlay`                                                                |
| `apps/telemetry/app/catalogue/`                                                                        | The `Present` series on the Agent stack the agent-changesets blueprint adds                      |

## Domain and naming

| Term            | Identifier                                                               | Meaning                                                                 |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Agent           | `ctx.token` present                                                      | A caller holding an API token; never a session or a guest               |
| Agent presence  | `AgentPresence` (wire), `AgentPresenceRecord` (room storage)             | One token's presence on one tab                                         |
| Presence entry  | storage key `agent-presence:<tokenId>:<tabId>` (PR3)                     | The room's record of it                                                 |
| Status line     | `status` (request, wire), `Participant.statusLine` (editor)              | The optional words beside the owner ("adding payment service")          |
| Focus           | `focus: string[]` (element ids), `AgentFocusRings`                       | Elements the agent marks, drawn with a ring in the owner's colour       |
| Time to live    | `ttl` (request, ms), `expiresAt` (epoch ms)                              | How long the entry lives without a refresh                              |
| Refresh         | `refreshAgentPresence`, room mode `refresh`                              | A changeset extending the entry, keeping status and focus               |
| Person tag      | `personTag`, `X-Verified-Person`, `ws_tickets.person_tag`                | Opaque per-document stand-in for an owner id, held inside the room only |
| Joins           | `AgentPresence.joins`, `AgentPresence.self`, `AgentPresence.person`      | Which roster sessions are the same person as the agent, per recipient   |
| Thread verbs    | reply, resolve, reopen (`CommentVerb`)                                   | The comment endpoints beside add and delete-own                         |
| Thread listing  | `DocumentCommentThread`, `CommentListStatus` (`open`, `resolved`, `all`) | One thread across the document, with its element's ref and label        |
| Comment's token | `Comment.tokenId`                                                        | The token a comment was posted with; audit only                         |
| Effective level | `AgentPresence.role`                                                     | The level the gates resolve for the token on this document (PR27)       |

Banned: "bot", "AI user", "assistant" (domain language); "virtual participant", "ghost"; "lock", "claim" or "hold"
for focus (focus never holds); "heartbeat" for a refresh; "unresolve" on the API surface (the verb is reopen; the
existing telemetry action `Unresolved` stays); "close" for resolve; "comment role", "comment token", "commenter" (the
level is Participant, `participate`).

## Behaviour and state

An entry is **absent** or **live**. Its key is the token and the tab, so one token may be live on several tabs.

| From   | Event                                                       | To     | Guard / effect                                                                     |
| ------ | ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| absent | `PUT .../presence`                                          | live   | token present; `gateParticipate`; tab exists; room under `AGENT_PRESENCE_ROOM_MAX` |
| live   | `PUT .../presence`                                          | live   | status and focus replaced (PR4); `expiresAt = now + ttl`                           |
| absent | changeset applied or reverted with a token on the tab       | live   | no status, no focus; `expiresAt = now + AGENT_PRESENCE_TTL_MS`                     |
| live   | changeset applied or reverted with that token on the tab    | live   | status and focus kept; `expiresAt = max(expiresAt, now + TTL)` (PR9)               |
| live   | `DELETE .../presence`                                       | absent | none                                                                               |
| live   | `expiresAt <= now` (alarm, or the sweep on any roster read) | absent | logs `expired`                                                                     |
| live   | `document-trashed` reaches the room                         | absent | every entry (PR15)                                                                 |
| live   | `share-revoked` / `share-rescoped` for the entry's code     | absent | entries admitted by that code (PR15)                                               |
| absent | `DELETE .../presence`                                       | absent | 204 all the same                                                                   |

A dry run, a refused changeset and a changeset written by a session leave presence untouched.

Threads are **open** or **resolved** (`commentThread.resolved`):

| From     | Event                 | To       | Effect                                                    |
| -------- | --------------------- | -------- | --------------------------------------------------------- |
| any      | add or reply          | open     | `comment-add` delta (it unresolves, as the editor's does) |
| open     | resolve               | resolved | `comment-resolve { resolved: true }`                      |
| resolved | reopen                | open     | `comment-resolve { resolved: false }`                     |
| resolved | resolve; open, reopen | same     | 204, nothing written, nothing relayed (PR17)              |
| any      | last comment deleted  | none     | the thread goes (`removeComment`)                         |

Invariants:

- **I1** An entry is never a session: it is absent from the frame's `participants`, from `/selections`, from the
  editor's `livePresence`, from `multiplayerDecision`, from `rosterSummary`'s count, from the Done check's
  `doneSplit` keys, from a roll call, a picker and every other reader of `livePresence`. Agents travel in their own
  array (PR14), so this holds by construction.
- **I2** An entry's name and colour are the token owner's participant record at its last set or refresh, never a
  value from the request.
- **I3** `expiresAt - now <= AGENT_PRESENCE_MAX_TTL_MS` at every write.
- **I4** `personTag` and `tokenId` never leave the room on the wire; `joins` names only presence ids the recipient
  already holds.
- **I5** The room's one alarm is armed at the earliest of the facilitator grace deadline and every entry's
  `expiresAt`, and cleared when there is neither (`armAlarm`, PR29).
- **I6** A room holds at most `AGENT_PRESENCE_ROOM_MAX` entries.
- **I7** A comment's `tokenId` is set by the server only, kept by every later save, and seen only by its author.
- **I8** Every comment write increments the tab's `rev` through `upsertTabAtRev`.

Client state: `usePresenceState` gains `agentPresence: AgentPresence[]`, replaced on every `presence` frame.
`usePresenceRows` builds `participantsByTab` unchanged, then `foldAgentPresence` over it, and
`buildAgentFocusByElement` for the active tab.

## Interfaces and contracts

### REST

All `guest-or-clerk`; tab-scoped grants reach their own tab only; a trashed document answers 410 through
`missingDocument`.

| Method | Path                                                         | Gate                               | Success                                    |
| ------ | ------------------------------------------------------------ | ---------------------------------- | ------------------------------------------ |
| PUT    | `/api/documents/:id/tabs/:tabId/presence`                    | token; `gateParticipate`           | 200 `{ presence: AgentPresenceResult }`    |
| DELETE | `/api/documents/:id/tabs/:tabId/presence`                    | token; `gateParticipate`           | 204                                        |
| POST   | `/api/documents/:id/tabs/:tabId/comments`                    | `gateParticipate`                  | 201 `{ comment }`                          |
| DELETE | `/api/documents/:id/tabs/:tabId/comments/:commentId`         | `gateParticipate`; author only     | 204                                        |
| POST   | `/api/documents/:id/tabs/:tabId/comments/:commentId/reply`   | `gateParticipate`                  | 201 `{ comment }`                          |
| POST   | `/api/documents/:id/tabs/:tabId/comments/:commentId/resolve` | `gateParticipate`                  | 204                                        |
| POST   | `/api/documents/:id/tabs/:tabId/comments/:commentId/reopen`  | `gateParticipate`                  | 204                                        |
| GET    | `/api/documents/:id/comments?status=open\|resolved\|all`     | `gateGrant` (any level, any token) | 200 `{ threads: DocumentCommentThread[] }` |

The six writes above are gated by `gateParticipate` and belong to the participation-class routes, beside the session
tools share-roles owns (live polls, the Q&A board, dots, answers, the idea box). The choke point lets a token that
passes `gateParticipate` but not `gateEdit` reach those routes and no other write; a token that fails
`gateParticipate` reaches none of them. Every other write keeps `gateEdit`.

`deniedParticipate(ctx, liveDoc, tabId)` answers a refused participation-class request: 404 when the caller's grant is
confined to another tab (`deniedOnTab`), 403 when the grant or the token fails `gateParticipate`, 403 with no grant.
`DELETE .../presence` skips the tab-existence check, so an entry on a deleted tab can still be cleared (PR34).

`AgentPresenceRequest` (PUT body, JSON object; unknown fields ignored):

| Field    | Type                 | Rule                                                                                                  | Rejection (400)                     |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `status` | string, optional     | Trimmed; empty means none; at most `AGENT_PRESENCE_STATUS_MAX` code points (PR7); no C0 or DEL (PR33) | `invalid_status`, `status_too_long` |
| `focus`  | string[], optional   | At most `AGENT_PRESENCE_FOCUS_MAX` before de-duplication; each a ref, unique prefix or id (PR8)       | `invalid_focus`, `too_many_focus`   |
| `ttl`    | integer ms, optional | `AGENT_PRESENCE_MIN_TTL_MS` to `AGENT_PRESENCE_MAX_TTL_MS`; absent is `AGENT_PRESENCE_TTL_MS`         | `ttl_out_of_range`                  |

Every limit refuses rather than cuts (PR6). A focus entry that matches nothing answers 400 `focus_not_found { refs }`; one that matches several answers 400
`focus_ambiguous { ref, candidates }` (the views' refusal). Resolution runs against the stored tab at the PUT; the
resolved full ids are stored, de-duplicated, in request order.

`AgentPresenceResult = { tabId, status: string | null, focus: string[], expiresAt: number }` (PR10).

`parseAgentPresenceRequest(body): { ok: true, value } | { ok: false, code }` lives in `@livediagram/api-schema` so
the CLI checks a request with the rule the api applies; ref resolution stays in the api.

Reply body: `{ text, mentions? }`, the add's rules (`text` trimmed, 1 to `COMMENT_TEXT_MAX` characters,
`sanitizeMentions`). The reply lands on the thread holding `:commentId` and answers 201 `{ comment }`, as the add
does; the add's route answers 201 too, as the OpenAPI manifest says. Resolve and reopen take no body and answer 204
(PR18).

Side effects, all in `waitUntil` (PR24, PR25):

| Verb    | Timeline                                                                                        | Email                                               |
| ------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| add     | `recordCommentAdded`, `reply` when the thread held a comment                                    | `notifyNewComment` when the caller is not the owner |
| reply   | `recordCommentAdded` with `reply: true`                                                         | as add                                              |
| resolve | `recordCommentResolved` with thread key `<documentId>:<elementId>` and the first comment's text | none                                                |
| reopen  | none                                                                                            | none                                                |
| delete  | none                                                                                            | none                                                |

`DocumentCommentThread`:

```ts
type DocumentCommentThread = {
  tabId: string;
  tabName: string;
  elementId: string;
  ref: string; // tabRefs(tab).get(elementId)
  label: string; // viewLabel(element)
  resolved: boolean;
  comments: {
    id: string;
    text: string;
    createdAt: number;
    authorName: string;
    authorColor: string;
    mentions?: CommentMention[];
    authorId?: string; // the caller's own comments only
    tokenId?: string; // the caller's own comments only
  }[];
};
```

`status` absent means `open` (PR19); any other value is 400 `invalid_status`. Threads are ordered by the document's
tab order, then by `readingOrder` within a tab; comments keep their stored order (PR20). A tab-scoped grant lists
its own tab only.

The tabs are found by `tabIdsWithComments` (PR21):

```sql
SELECT dt.tab_id FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
 WHERE dt.document_id = ? AND instr(t.data, '"commentThread"') > 0
 ORDER BY dt.order_index
```

then read one at a time with `getTab`, each passed to `threadsOfTab(tab, status, viewerId)` (in
`apps/api/src/comments.ts`), which applies `redactCommentAuthorIds` and drops threads with no comments.

### Comment stamping

Add and reply stamp `authorName`, `authorColor`, `authorId` from the caller, and `tokenId: ctx.token.id`
when a token presents the request (PR23). `rewriteCommentAuthors` restores a stored comment's `tokenId` like its
`authorId` and drops any `tokenId` a client sends on a new comment. `redactCommentAuthorIds` blanks `tokenId` with
`authorId`. `withoutCommentAuthorId` (and so `opForTheWire`) removes `tokenId` too, so neither the room nor a relay
carries it.

### Relays

Each comment write, after `upsertTabAtRev` succeeds, hands the room one `el-delta` through `relayElementDelta`,
without `authorId` or `tokenId`:

| Verb    | Delta                                          |
| ------- | ---------------------------------------------- |
| add     | `{ kind: 'comment-add', comment }`             |
| reply   | `{ kind: 'comment-add', comment }`             |
| resolve | `{ kind: 'comment-resolve', resolved: true }`  |
| reopen  | `{ kind: 'comment-resolve', resolved: false }` |
| delete  | `{ kind: 'comment-remove', commentId }`        |

A lost compare-and-swap re-reads the tab and repeats the verb once, then answers 409 `tab_busy` (PR22).

### Room

Internal, reached only through the stub:

- `PUT /presence` body
  `{ documentId, tokenId, tabId, personTag, shareCode, name, color, role, status, focus, ttlMs, mode }`, `mode`
  `'set' | 'refresh'`. Answers 200 `{ expiresAt, created }`, or 409 `{ error: 'agent_presence_full' }` when a new
  entry would pass `AGENT_PRESENCE_ROOM_MAX`. A refresh of an absent entry creates one with `status: null`,
  `focus: []`.
- `DELETE /presence?token=<tokenId>&tab=<tabId>` answers 200 `{ cleared: boolean }`.

The room broadcasts presence after a set, a refresh that creates an entry or changes its name, colour or level, a
clear and a sweep that removed anything. A refresh that only moves `expiresAt` broadcasts nothing, since `expiresAt`
is not on the wire. Every write ends in `armAlarm()`: `storage.setAlarm(min(deadlines))`, or `storage.deleteAlarm()`
when there is none. `startFacilitatorGrace` calls `armAlarm()` instead of setting the alarm itself, and `alarm()`
sweeps entries, judges the baton unchanged, then calls `armAlarm()` (PR29).

`room-client.ts`: `putAgentPresence(env, liveDoc, body)` returns the room's answer or throws `RoomUnavailableError`;
`deleteAgentPresence(env, liveDoc, tokenId, tabId)` likewise; `refreshAgentPresence(env, liveDoc, tabId, agent)`
calls `putAgentPresence` with `mode: 'refresh'` and `ttlMs: AGENT_PRESENCE_TTL_MS`, logs and swallows every
failure. The changeset route calls it in `waitUntil` after a token's changeset or revert is written.

The `presence` frame:

```ts
{ kind: 'presence'; participants: ParticipantPresence[]; agents: AgentPresence[] }

type AgentPresence = {
  id: string; // room-minted per entry, stable while it lives
  name: string;
  color: string;
  role: ShareRole; // the effective level
  tabId: string;
  status?: string;
  focus: string[];
  joins: string[]; // presence ids in this frame's participants that are the same person
  self?: true; // the recipient's own session is the same person
  person: number; // frame-local ordinal; equal for entries of one person
};
```

`agentRosterFor(recipient, sessions, entries)` (pure) builds `agents` per recipient: entries ordered by `setAt`
ascending, `joins` the presence ids of hello'd sessions other than the recipient whose `personTag` equals the
entry's, `self` when the recipient's `personTag` equals it (both non-null), `person` numbered by first appearance
in the frame. A frame with no live entries carries `agents: []`.

Upgrade: the ticket mint stores `personTagFor(documentId, ctx.resolveOwner())` when a verified account
(`ctx.verifiedUserId`) mints it, else null (PR2). The upgrade sets `X-Verified-Person` on every path, empty when
none, and the room pins it on the session attachment as `personTag`.

### Editor

- `connectRoom` handlers: `onPresence(participants: ParticipantPresence[], agents: AgentPresence[])`; a frame
  without `agents` passes `[]`.
- `splitPresenceFrame(frame)` returns `{ participants, agents }` with every agent entry validated (shape, string
  clamps) and invalid ones dropped.
- `foldAgentPresence({ participantsByTab, agents, selfParticipant, activeId, tabIds, now })` returns a new map.
  Per agent entry whose `tabId` is a known tab, grouped by `person` with the last entry's status winning: when
  `self` and the tab is active, `statusLine` goes on the self row; else when a row on that tab has an id in `joins`,
  on that row; else a row `{ id, name, color, role, status: 'online', lastActiveAt: now, statusLine, agent: true }`
  is appended to the tab's bucket. Entries on unknown tabs are skipped (PR16). The owner's own agent on another tab
  is such a row, in their name.
- `buildParticipantsByTab` takes `agentsPresent: boolean`: a document neither shareable nor in a team, whose map is
  otherwise empty, builds it (self on the active tab) while any agent entry is present, so a personal document's
  stack shows its owner's agent.
- `buildAgentFocusByElement(agents, activeId, elementIds)` returns `Map<elementId, { name, color }[]>` for entries on
  the active tab, ids missing from the tab skipped. It is a separate prop from `remoteSelectionsByElement` and never
  reaches `isElementHeldByOther`.
- `apiResolveThread(ownerId, documentId, tabId, commentId, shareCode)` and `apiReopenThread(...)`: a session that
  may participate but not edit calls them from `resolveThread` / `unresolveThread` with the thread's first comment id,
  as its add calls `apiAddComment`; a session that may edit keeps the room path.

## Data and persistence

| Field                                 | Class     | Notes                                                      |
| ------------------------------------- | --------- | ---------------------------------------------------------- |
| `ws_tickets.person_tag`               | transient | TEXT NULL; lives as long as the ticket (60 s)              |
| Session attachment `personTag`        | transient | Per socket, survives hibernation, gone with the socket     |
| DO storage `agent-presence:<t>:<tab>` | ephemeral | `AgentPresenceRecord`, at most 120 s without a refresh     |
| `Comment.tokenId`                     | audit     | Inside `tabs.data`; written once; deleted with its comment |

`AgentPresenceRecord = { id, documentId, tokenId, tabId, personTag, shareCode, name, color, role, status, focus,
setAt, expiresAt }`.

- Migration 0068 adds the nullable column; existing tickets expire within a minute; no backfill.
- The room restores every entry in its constructor (`storage.list({ prefix: 'agent-presence:' })` inside
  `blockConcurrencyWhile`), drops the expired ones and arms the alarm. Nothing about presence reaches D1.
- `Comment.tokenId` is optional: every stored comment without one parses, an Offline Mode copy keeps it unread,
  a document copy carries it (redacted for every viewer but its author). Account deletion removes the account's
  tokens; a comment's token id then names nothing.

## Errors and edge cases

- **E1** Presence without a token (session, guest): 403 `presence_requires_token`.
- **E2** A token that fails `gateParticipate`, by its own level or its grant's: 403; one the choke point refuses never
  reaches the route.
- **E3** A tab outside a tab-scoped grant or not in the document: 404, as `deniedOnTab` decides.
- **E4** A malformed body: 400 with the codes in the request table; `invalid_json` when it does not parse.
- **E5** The room cannot be reached on PUT or DELETE: 503 `room_unavailable` (PR11); logged.
- **E6** The room is full: 409 `agent_presence_full`; logged.
- **E7** A refresh that fails or finds the room full: logged, the changeset stands.
- **E8** The alarm fires late or not before an eviction: every roster read sweeps first (PR30), and the constructor
  sweeps on wake.
- **E9** The facilitator grace and an entry share the one alarm: `alarm()` sweeps entries, then judges the baton,
  then re-arms.
- **E10** A token revoked while present: refreshes fail at auth; the entry leaves on its ttl (PR15).
- **E11** A tab deleted while an entry is on it: the entry expires on its ttl; editors skip it meanwhile.
- **E12** A focused element removed later: no ring for it; the entry keeps the id until the next PUT.
- **E13** An editor bundle older than the `agents` field: ignores it and shows no agent.
- **E14** The owner has the tab open in two browsers: both sessions are in `joins`; the fold attaches the status to
  the one row the stack keeps for that collab key.
- **E15** Two tokens of one owner on one tab: one `person`, one row, the later set's status.
- **E16** Reply, resolve or reopen naming a comment not on the tab: 404. The add naming an arrow or a missing element: 404.
- **E17** A reply that pushes the tab over `MAX_TAB_BYTES`: 413, nothing written, nothing relayed.
- **E18** A lost compare-and-swap twice: 409 `tab_busy`, nothing written.
- **E19** A relay that fails: the write stands; `[room-mutation] el-delta did not reach the room` warns (PR26); editors get
  it from D1 on their next read, and the ledger merge does not apply because the room never saw it.
- **E20** A list over a document with no threads: 200 `{ threads: [] }` after one query.
- **E21** A tab body that fails to parse during the list: skipped, logged `[comment] list skipped tab`.

## Security and trust

- Presence is token-only: a browser shows itself through its socket, and only a token can mark an agent.
- The name and colour come from the token owner's participant record; nothing in a request names anyone.
- The person tag is a SHA-256 of the document id and the owner id: never the owner id, unusable outside the
  document, and kept in the room's attachments and storage. `joins` and `self` reveal only that two roster entries
  are one person, which their shared name already shows.
- The token id is stored in room storage and in comments for audit, never sent to a socket, and returned on a
  read only to its comment's author. It is not a credential: revoking needs the owner's session.
- Status text is untrusted: length-clamped, control characters refused, rendered as React text.
- Focus ids are resolved against the tab, so an entry never carries an arbitrary string.
- A token that passes `gateParticipate` but not `gateEdit` reaches only the participation-class routes (comments,
  presence and the session tools); it submits no changeset and saves no tab.
- `PUT` / `DELETE /presence` on the room are reachable only through the stub, like `/broadcast`.
- Every presence write counts against the token's write rate limit (`token:<id>`); a room holds at most
  `AGENT_PRESENCE_ROOM_MAX` entries.
- An entry admitted by a share code dies with that code.

## Performance and limits

- `PUT .../presence`: at most five D1 reads (document meta, grant, tab, participant, a team membership) and one
  room call; the room does one storage write, one `setAlarm` and one roster broadcast.
- A roster broadcast is O(S x (S + A)) for S sockets and A entries: the person-tag index is built once per frame,
  then each recipient's projection is linear. With A at most 32 and an entry under 3 KiB (20 ids of at most
  128 characters, an 80-character status), `agents` adds under 96 KiB to a frame, inside the 256 KiB frame budget.
- An entry's storage value is under 4 KiB, far under the 128 KiB value limit (PR13).
- Changeset refresh: one room call per applied token changeset, off the response path.
- Comment verbs: one tab read, one compare-and-swap write (two of each on a lost race) and one relay.
- The list: one `instr` query naming the tabs that hold a thread, then one read per such tab, one tab in memory
  at a time (each at most `MAX_TAB_BYTES`). A document with T threaded tabs costs 1 + T queries.

## Presentation and UX

The status line shows in the hover card, the Collaborators row and the avatar's accessible name, never as text in
the tab pill.

- A folded agent adds nothing to the stack: the owner's avatar stays, and its hover card description reads
  "{status line} · {status} · Active {when}". Without a status line the card is unchanged. The owner sees their own
  agent's status this way on their own avatar when both are on the tab.
- A standalone agent row is an avatar in the owner's name and colour (initials, no picture, as the spec says),
  always online (PR32); its hover card title carries the badge `participantBadges` gives the entry's level, and its
  description reads "{status line}", or "Online" without one.
- Two tokens of one owner on one tab are one row, showing the status set last.
- A personal document's stack, otherwise hidden, shows while its owner's agent is present.
- The Collaborators modal lists agent rows under their tab, with the status line as the row's second line, no
  Follow button, and outside the "{n} people across {m} tabs" count.
- Focus rings: a 2 px outline in the owner's colour, 4 px outside the element's bounds (`elementBounds`), over a
  1 px halo (white in light, slate-900 in dark), static, beneath remote cursors (PR31).

## Accessibility

- The avatar's accessible name appends the status line: "Webber (Online), adding payment service".
- Focus rings are `aria-hidden`: the same information is in the avatar's name and the modal row.
- The ring's halo gives the 3:1 non-text contrast of WCAG 1.4.11 against the canvas whatever the owner's colour.
- Rings never animate, so reduced motion needs nothing; an avatar's pop-in is the stack's existing animation.
- Agent rows are the stack's existing buttons; keyboard order and focus states are unchanged.

## Web Experience

- Nothing new on first paint: agents arrive with the first `presence` frame after the socket opens.
- The rings draw in the existing absolutely positioned SVG layer, so they cause no layout shift (CLS 0).
- The fold is a memoised pure function of the frame and the tab list; a frame costs one state update (INP).
- No image or font, so LCP is unchanged.

## Observability

| Fingerprint                                       | Where         | Fields (never text)                                                          |
| ------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| `[agent-presence] set`                            | api           | documentId, tabId, tokenId, via (`put`, `changeset`), created                |
| `[agent-presence] cleared`                        | api, room     | documentId, tabId, tokenId, via (`delete`, `document-trashed`, `share-link`) |
| `[agent-presence] expired`                        | room          | documentId, tabId, tokenId                                                   |
| `[agent-presence] refused`                        | api, room     | documentId, tabId, tokenId?, reason (the error code)                         |
| `[agent-presence] room-unreachable`               | api, warn     | documentId, tabId, tokenId, mode                                             |
| `[comment] added` / `replied`                     | api           | documentId, tabId, elementId, commentId, tokenId?                            |
| `[comment] resolved` / `reopened`                 | api           | documentId, tabId, elementId, changed                                        |
| `[comment] deleted`                               | api           | documentId, tabId, commentId                                                 |
| `[comment] refused`                               | api           | documentId, tabId, verb, reason                                              |
| `[comment] listed`                                | api           | documentId, status, tabsRead, threads                                        |
| `[comment] list skipped tab`                      | api, warn     | documentId, tabId                                                            |
| `[room-mutation] el-delta did not reach the room` | api, warn     | documentId, tabId, delta kind                                                |
| `[agent-presence] skipped entry`                  | editor, debug | reason (`unknown_tab`, `invalid_shape`)                                      |

Telemetry: `Agent·Present`, type `agentFrontDoor(request)`, written with `reportServerEvent` in `waitUntil` when a
`PUT` creates an entry, as the spec says. `Agent·Present` joins `SERVER_EMITTED_EVENT_PAIRS`, so `/api/events` drops a
client's copy.

## Testing

| Spec rule                                                        | Test                                                                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presence and comments carry the owner's name and colour          | `apps/api/src/routes/agent-presence-routes.test.ts` (planned), `comment-routes.test.ts`                                                                                       |
| The token id is recorded on every comment, never shown as a name | `comment-routes.test.ts`, `apps/api/src/comments.test.ts`, `packages/document/src/comments.test.ts`                                                                           |
| Appears in the stack as its owner, with a status line            | `apps/live/lib/agent-presence-rows.test.ts` (planned) (also a personal document, two tokens of one owner, the owner's own agent)                                              |
| Owner with the tab open: shown once, status beside them          | `agent-presence-rows.test.ts`, `apps/api/src/room-agent-presence.test.ts` (planned) (`agentRosterFor`)                                                                        |
| Every changeset refreshes for `AGENT_PRESENCE_TTL_MS`            | `room-agent-presence.test.ts`; the changeset route test (agent-changesets)                                                                                                    |
| PUT `status` (80), `focus` (20), `ttl` (max); DELETE clears      | `packages/api-schema/src/agent-presence.test.ts` (planned), `agent-presence-routes.test.ts`                                                                                   |
| The agent holds no socket                                        | `apps/api/src/document-room-agents.test.ts` (planned) (entries with no socket, restored on wake)                                                                              |
| The room expires entries on their ttl                            | `document-room-agents.test.ts` (alarm, sweep, shared with the facilitator grace)                                                                                              |
| Never holds an element                                           | `document-room-agents.test.ts` (`/selections`), `agent-presence-rows.test.ts` (lock map)                                                                                      |
| Never in a head count, the Done check or a roll call             | `agent-presence-rows.test.ts` (`splitPresenceFrame`), `collaborator-roster.test.ts`, `document-room-agents.test.ts` (multiplayer)                                             |
| An agent comments through the comment endpoints                  | `comment-routes.test.ts` (token caller)                                                                                                                                       |
| Reply, resolve, reopen, each relayed as an `el-delta`            | `comment-routes.test.ts` (fake room stub records the deltas)                                                                                                                  |
| Agents and people use the same endpoints                         | `comment-routes.test.ts` (session, guest Participant link, token); `apps/live/lib/api/tabs.test.ts`                                                                           |
| The cross-tab list, status filter, ref and label                 | `comment-routes.test.ts`; `apps/api/src/db/tabs.test.ts` (`tabIdsWithComments`)                                                                                               |
| Agents cannot be mentioned                                       | `packages/document/src/comment-mentions.test.ts` (closed mention shape)                                                                                                       |
| Levels: reading, participation (comments, presence), changesets  | `apps/api/src/index.test.ts` (choke point), `comment-routes.test.ts`, `agent-presence-routes.test.ts`                                                                         |
| The two constants                                                | `packages/api-schema/src/agent-presence.test.ts` (planned) pins values and order                                                                                              |
| Logs and telemetry                                               | the route and room tests assert each fingerprint; `server-emitted-events.test.ts`                                                                                             |
| Person tag through the ticket                                    | `apps/api/src/db/ws-tickets.test.ts`, `routes/document-room-routes.test.ts`                                                                                                   |
| OpenAPI parity                                                   | `apps/api/src/openapi/route-parity.test.ts`, `manifest.test.ts`                                                                                                               |
| End to end, dark mode                                            | `apps/live/e2e/agent-presence.spec.ts` (planned): a token sets presence, the avatar and status show, a ring draws, a short ttl expires it, a REST reply and resolve land live |

Room and route tests run on the in-memory storage and SQLite fakes with a fixed clock; none waits on a real timer.

## Constants and configuration

| Constant                    | Value  | Provenance                                                | Safe range      |
| --------------------------- | ------ | --------------------------------------------------------- | --------------- |
| `AGENT_PRESENCE_TTL_MS`     | 30000  | Spec                                                      | 10000 to 60000  |
| `AGENT_PRESENCE_MAX_TTL_MS` | 120000 | Spec                                                      | 60000 to 300000 |
| `AGENT_PRESENCE_MIN_TTL_MS` | 1000   | One second: below it an entry cannot reach a screen (PR5) | 500 to 5000     |
| `AGENT_PRESENCE_STATUS_MAX` | 80     | Spec                                                      | 40 to 120       |
| `AGENT_PRESENCE_FOCUS_MAX`  | 20     | Spec                                                      | 1 to 50         |
| `AGENT_PRESENCE_ROOM_MAX`   | 32     | Keeps `agents` under 96 KiB of a 256 KiB frame (PR12)     | 8 to 64         |
| `COMMENT_TEXT_MAX`          | 2000   | The add route's existing literal, now named               | 500 to 5000     |

No new environment variable or binding. Self-hosting needs only migration 0068.

## Assets and external resources

None.

## Defaults ledger

PR1 to PR34 in [DEFAULTS.md](DEFAULTS.md).
