# Agent presence: blueprint

Derived from [Agent presence](../agent-presence.md), with the levels of
[Share roles](../../013-workspace/share-roles.md), the rooms and revisions of
[Agent changesets](../agent-changesets.md), the refs of [Design views](../design-views.md), the room and
comment routes of [API app](../../015-api/api.md) and the identity rules of
[Public API and API tokens](../../015-api/public-api-and-tokens.md) §6. The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `PRn`.

It builds on the sibling blueprints and calls what they provide by these names:

| Provided by      | Name used here                                                                    | What it is                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| share-roles      | `ShareRole` (`AccessLevel`)                                                       | The levels on grants, tickets, room sessions and tokens; no member is named here                                                                                                                                    |
| share-roles      | `gateParticipate`, `gateEdit` `(ctx, id, ownerId, teamId, tabId?)`                | True when the caller's grant and its token (if any) pass that gate; until share roles land, `gateParticipate` is read access (`apps/api/src/routes/context.ts`), read-only tokens refused writes at the choke point |
| share-roles      | The write choke point's route-gate matcher                                        | Lets a token's write reach a route only when the token passes that route's gate                                                                                                                                     |
| agent-changesets | `ctx.token: { id, ownerId, role } \| null` on `RouteContext`                      | The presenting API token, null for a session or a guest                                                                                                                                                             |
| agent-changesets | `roomStubFor` returns a stub for every server-stored design                       | Rooms for personal designs                                                                                                                                                                                          |
| agent-changesets | `upsertTabAtRev(env, designId, tab, orderIndex, rev)`, `tabs.rev`                 | The compare-and-swap tab write; every write increments `rev`                                                                                                                                                        |
| agent-changesets | `frontDoorOf(request): 'Mcp' \| 'Cli' \| 'Editor' \| 'Api'`                       | The telemetry type of an agent request                                                                                                                                                                              |
| agent-changesets | The changeset route's success step                                                | Calls `refreshAgentPresence` here                                                                                                                                                                                   |
| design           | `tabRefs(tab)`, `resolveRef(tab, input)` in `packages/design/src/element-refs.ts` | Refs and ref resolution                                                                                                                                                                                             |
| design-views     | `buildViewModel(tab)`, `commentHosts(model)`                                      | The refs and labels of the elements holding a thread, in outline order                                                                                                                                              |

Scope, by file:

| File                                                                                                                      | Role                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/api-schema/src/agent-presence.ts` (+ test)                                                                   | Constants, `AgentPresence` (wire), `AgentPresenceRequest`, `parseAgentPresenceRequest`, codes                                                           |
| `packages/api-schema/src/comment-threads.ts` (+ test)                                                                     | `COMMENT_LIST_STATUSES`, `CommentListStatus`, `isCommentListStatus`, `DesignCommentThread`, `DesignCommentsResponse`, `COMMENT_TEXT_MAX`                |
| `packages/api-schema/src/room-messages.ts`                                                                                | The `presence` frame gains `agents: AgentPresence[]`                                                                                                    |
| `packages/api-schema/src/index.ts`                                                                                        | Re-exports the two new modules                                                                                                                          |
| `packages/api-schema/src/telemetry-schema.ts`, `server-emitted-events.ts`                                                 | Action `Present` (category `Agent`); `Agent·Present` is server-emitted                                                                                  |
| `packages/design/src/comments.ts`                                                                                         | `Comment.tokenId`; `withoutCommentAuthorId` strips it too                                                                                               |
| `apps/api/src/db/tabs.ts`                                                                                                 | `tabIdsWithComments(env, designId)`                                                                                                                     |
| `apps/api/src/person-tag.ts`                                                                                              | `personTagFor(designId, ownerId)`                                                                                                                       |
| `apps/api/src/comments.ts`                                                                                                | `tokenId` locked by `rewriteCommentAuthors`, blanked by `redactCommentAuthorIds`; `threadsOfTab`                                                        |
| `apps/api/src/routes/comment-routes.ts` (+ test)                                                                          | `handleCommentRoutes`: add, delete-own (moved, PR28), reply, resolve, reopen, list                                                                      |
| `packages/design-views/src/comments.ts`                                                                                   | `commentHosts(model)`: the elements holding a thread in outline order, with ref and label                                                               |
| `apps/api/src/routes/agent-presence-routes.ts` (+ test), `../packages/api-kit/src/refusal-log.ts` (+ test)                | `handleAgentPresenceRoute`: `PUT` / `DELETE .../tabs/:tabId/presence`; `logRefusal` for both route families                                             |
| `apps/api/src/routes/design-subresource-routes.ts`                                                                        | Dispatches to the two handlers above; loses the inline add and delete-own                                                                               |
| `apps/api/src/routes/context.ts`                                                                                          | `deniedOnTab` moves here from the subresource routes; `gateParticipate`                                                                                 |
| `apps/api/src/routes/design-room-routes.ts`                                                                               | The mint stores the person tag; the upgrade sets `X-Verified-Person`                                                                                    |
| `apps/api/src/room-client.ts`                                                                                             | `putAgentPresence`, `deleteAgentPresence`, `refreshAgentPresence`; `relayElementDelta` logs                                                             |
| `../packages/api-kit/src/room-agent-presence.ts` (+ test)                                                                 | `RoomAgentPresence` (storage, set, refresh, clear, sweep), the pure `agentRosterFor`, `answerAgentPresence`, `clearAgentsForOp`, `agentPresenceWriteOf` |
| `apps/api/src/design-room/design-room.ts`, `room-internal.ts`, `room-roster.ts`                                           | `PUT` / `DELETE /presence`, restore, `armAlarm`, `alarm`, roster, clears on trash and revoke                                                            |
| `apps/api/src/index.ts`                                                                                                   | Unchanged: the choke point already refuses every write from a read-only token                                                                           |
| `apps/api/src/openapi/manifest.ts`, `schemas.generated.ts`, `apps/api/scripts/gen-openapi-schemas.mjs`                    | Six new routes, `tokenUsable` on the comment routes, the new schemas                                                                                    |
| `apps/live/lib/api/room.ts`                                                                                               | `onPresence(participants, agents)`                                                                                                                      |
| `apps/live/lib/api/tabs.ts`                                                                                               | `apiSetThreadResolved` (resolve or reopen)                                                                                                              |
| `apps/live/lib/agent-presence-rows.ts` (+ test)                                                                           | `splitPresenceFrame`, `foldAgentPresence`, `buildAgentFocusByElement`, `withoutAgentRows`                                                               |
| `apps/live/lib/identity.ts`                                                                                               | `Participant.statusLine`, `Participant.agent`                                                                                                           |
| `apps/live/lib/collaborator-roster.ts`                                                                                    | `peopleCount` and `peopleTabCount` leave agent rows out; `collaboratorRowDetail`; `participantBadges` reads the agent's level                           |
| `apps/live/app/design/[id]/usePresenceState.ts`, `useRoomConnection.ts`                                                   | `liveAgents` state, set from the frame                                                                                                                  |
| `apps/live/app/design/[id]/usePresenceRows.ts`, `useEditorState.ts`                                                       | Composes the fold and the focus map; the roll call reads `withoutAgentRows`                                                                             |
| `apps/live/hooks/collab/useEditorComments.ts`, `components/panels/EditorAnchoredPopovers.tsx`, `CommentThreadPopover.tsx` | A non-edit session resolves and reopens through the endpoints; the toggle shows to anyone who may comment                                               |
| `apps/live/components/primitives/ParticipantAvatar.tsx`                                                                   | The status line in the hover card and the accessible name                                                                                               |
| `apps/live/components/dialogs/CollaboratorsDialog.tsx`                                                                    | The status line on a row; no Follow button on an agent row                                                                                              |
| `apps/live/components/canvas/AgentFocusOverlay.tsx` (+ test), `CanvasElementsLayer.tsx`, `EditorView.tsx`                 | `AgentFocusOverlay` beneath the remote cursors, fed by `AgentFocusContext`                                                                              |
| `../liveworkspace/apps/site/app/telemetry/livedesign/catalogue/`                                                          | The `Present` series on the Agent stack the agent-changesets blueprint adds                                                                             |
| `packages/api-schema/src/index.ts`                                                                                        | `MAX_PARTICIPANT_NAME_LEN`, `MAX_COLOR_LEN`, moved from `apps/api/src/limits.ts` so the editor clamps to them                                           |

## Domain and naming

| Term            | Identifier                                                             | Meaning                                                               |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Agent           | `ctx.token` present                                                    | A caller holding an API token; never a session or a guest             |
| Agent presence  | `AgentPresence` (wire), `AgentPresenceRecord` (room storage)           | One token's presence on one tab                                       |
| Presence entry  | storage key `agent-presence:<tokenId>:<tabId>` (PR3)                   | The room's record of it                                               |
| Status line     | `status` (request, wire), `Participant.statusLine` (editor)            | The optional words beside the owner ("adding payment service")        |
| Focus           | `focus: string[]` (element ids), `AgentFocusOverlay`                   | Elements the agent marks, drawn with a ring in the owner's colour     |
| Time to live    | `ttl` (request, ms), `expiresAt` (epoch ms)                            | How long the entry lives without a refresh                            |
| Refresh         | `refreshAgentPresence`, room mode `refresh`                            | A changeset extending the entry, keeping status and focus             |
| Person tag      | `personTag`, `X-Verified-Person`                                       | Opaque per-design stand-in for an owner id, held inside the room only |
| Joins           | `AgentPresence.joins`, `AgentPresence.self`, `AgentPresence.person`    | Which roster sessions are the same person as the agent, per recipient |
| Thread verbs    | reply, resolve, reopen (`CommentVerb`)                                 | The comment endpoints beside add and delete-own                       |
| Thread listing  | `DesignCommentThread`, `CommentListStatus` (`open`, `resolved`, `all`) | One thread across the design, with its element's ref and label        |
| Comment's token | `Comment.tokenId`                                                      | The token a comment was posted with; audit only                       |
| Effective level | `AgentPresence.role`                                                   | The level the gates resolve for the token on this design (PR27)       |

Banned: "bot", "AI user", "assistant" (domain language); "virtual participant", "ghost"; "lock", "claim" or "hold"
for focus (focus never holds); "heartbeat" for a refresh; "unresolve" on the API surface (the verb is reopen; the
existing telemetry action `Unresolved` stays); "close" for resolve; "comment role", "comment token", "commenter" (the
level is Participant, `participate`).

## Behaviour and state

An entry is **absent** or **live**. Its key is the token and the tab, and a token is live on one tab at most: a set
or a refresh on another tab clears its other entries first (PR39).

| From   | Event                                                       | To     | Guard / effect                                                                     |
| ------ | ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| absent | `PUT .../presence`                                          | live   | token present; `gateParticipate`; tab exists; room under `AGENT_PRESENCE_ROOM_MAX` |
| live   | `PUT .../presence`                                          | live   | status and focus replaced (PR4); `expiresAt = now + ttl`                           |
| absent | changeset applied or reverted with a token on the tab       | live   | no status, no focus; `expiresAt = now + AGENT_PRESENCE_ACTIVITY_TTL_MS`            |
| absent | a token's read of the tab (`GET .../tabs/:tabId`), stamped  | live   | the same (PR38)                                                                    |
| live   | changeset applied or reverted with that token on the tab    | live   | status and focus kept; `expiresAt = max(expiresAt, now + ACTIVITY_TTL)` (PR9)      |
| live   | a token's read of that tab, stamped                         | live   | the same; nothing written when the expiry would move under a stamp (PR38)          |
| live   | a set or refresh of that token on another tab               | absent | the other tab's entry goes live in its place (PR39)                                |
| live   | `DELETE .../presence`                                       | absent | none                                                                               |
| live   | `expiresAt <= now` (alarm, or the sweep on any roster read) | absent | logs `expired`                                                                     |
| live   | `design-trashed` reaches the room                           | absent | every entry (PR15)                                                                 |
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
- **I3** `expiresAt - now <= AGENT_PRESENCE_MAX_TTL_MS` after a set and `<= AGENT_PRESENCE_ACTIVITY_TTL_MS` after a
  refresh.
- **I4** `personTag` and `tokenId` never leave the room on the wire; `joins` names only presence ids the recipient
  already holds.
- **I5** The room's one alarm is armed at the earliest entry's `expiresAt`, and cleared when there is none
  (`armAlarm`, PR29).
- **I6** A room holds at most `AGENT_PRESENCE_ROOM_MAX` entries.
- **I7** A comment's `tokenId` is set by the server only, kept by every later save, and seen only by its author.
- **I8** Every comment write increments the tab's `rev` through `upsertTabAtRev`.

Client state: `usePresenceState` gains `liveAgents: AgentPresence[]`, replaced on every `presence` frame.
`usePresenceRows` builds `participantsByTab` unchanged, then `foldAgentPresence` over it, and
`buildAgentFocusByElement` for the active tab.

## Interfaces and contracts

### REST

All `guest-or-account`; tab-scoped grants reach their own tab only; a trashed design answers 410 through
`missingDesign`.

| Method | Path                                                       | Gate                               | Success                                  |
| ------ | ---------------------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| PUT    | `/api/designs/:id/tabs/:tabId/presence`                    | token; `gateParticipate`           | 200 `{ presence: AgentPresenceResult }`  |
| DELETE | `/api/designs/:id/tabs/:tabId/presence`                    | token; `gateParticipate`           | 204                                      |
| POST   | `/api/designs/:id/tabs/:tabId/comments`                    | `gateParticipate`                  | 201 `{ comment }`                        |
| DELETE | `/api/designs/:id/tabs/:tabId/comments/:commentId`         | `gateParticipate`; author only     | 204                                      |
| POST   | `/api/designs/:id/tabs/:tabId/comments/:commentId/reply`   | `gateParticipate`                  | 201 `{ comment }`                        |
| POST   | `/api/designs/:id/tabs/:tabId/comments/:commentId/resolve` | `gateParticipate`                  | 204                                      |
| POST   | `/api/designs/:id/tabs/:tabId/comments/:commentId/reopen`  | `gateParticipate`                  | 204                                      |
| GET    | `/api/designs/:id/comments?status=open\|resolved\|all`     | `gateGrant` (any level, any token) | 200 `{ threads: DesignCommentThread[] }` |

The six writes above are gated by `gateParticipate` and belong to the participation-class routes, beside the
participation writes share-roles owns (comments, a Participant's stickies). The choke point lets a token that
passes `gateParticipate` but not `gateEdit` reach those routes and no other write; a token that fails
`gateParticipate` reaches none of them. Every other write keeps `gateEdit`.

`deniedOnTab(ctx, liveDoc)` answers a refused participation-class request: 404 when the caller holds a grant (to
another tab, or a tab the design does not have), 403 when it holds none.
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

`parseAgentPresenceRequest(body): { ok: true, value } | { ok: false, code }` lives in `@livedesign/api-schema` so
the CLI checks a request with the rule the api applies; ref resolution stays in the api.

Reply body: `{ text, mentions? }`, the add's rules (`text` trimmed, 1 to `COMMENT_TEXT_MAX` characters,
`sanitizeMentions`). The reply lands on the thread holding `:commentId` and answers 201 `{ comment }`, as the add
does; the add's route answers 201 too, as the OpenAPI manifest says. Resolve and reopen take no body and answer 204
(PR18).

Side effects, all in `waitUntil` (PR24, PR25):

| Verb    | Timeline                                                                                      | Email                                               |
| ------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| add     | `recordCommentAdded`, `reply` when the thread held a comment                                  | `notifyNewComment` when the caller is not the owner |
| reply   | `recordCommentAdded` with `reply: true`                                                       | as add                                              |
| resolve | `recordCommentResolved` with thread key `<designId>:<elementId>` and the first comment's text | none                                                |
| reopen  | none                                                                                          | none                                                |
| delete  | none                                                                                          | none                                                |

`DesignCommentThread`:

```ts
type DesignCommentThread = {
  tabId: string;
  tabName: string;
  elementId: string;
  ref: string; // the views' ref, from commentHosts(buildViewModel(tab))
  label: string | null; // the element's label, null when it has none
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

`status` absent means `open` (PR19); any other value is 400 `invalid_status`. Threads are ordered by the design's
tab order, then by `readingOrder` within a tab; comments keep their stored order (PR20). A tab-scoped grant lists
its own tab only.

The tabs are found by `tabIdsWithComments` (PR21):

```sql
SELECT dt.tab_id FROM design_tabs dt JOIN tabs t ON t.id = dt.tab_id
 WHERE dt.design_id = ? AND instr(t.data, '"commentThread"') > 0
 ORDER BY dt.order_index
```

then read one at a time with `getTab`, each passed to `threadsOfTab(tab, status, viewerId)` (in
`apps/api/src/comments.ts`), which applies `redactCommentAuthorIds`, orders by `commentHosts` (the comments view's
own order, so a thread on a hidden layer is left out as the views leave its element out) and drops threads with
no comments. A grant confined to one tab passes `gateRead` on that tab only, so it lists that tab alone.

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
  `{ designId, tokenId, tabId, personTag, shareCode, name, color, role, status, focus, ttlMs, mode }`, `mode`
  `'set' | 'refresh'`. Answers 200 `{ expiresAt, created }`, or 409 `{ error: 'agent_presence_full' }` when a new
  entry would pass `AGENT_PRESENCE_ROOM_MAX`. A refresh of an absent entry creates one with `status: null`,
  `focus: []`.
- `DELETE /presence?token=<tokenId>&tab=<tabId>` answers 200 `{ cleared: boolean }`.

The room broadcasts presence after a set, a refresh that creates an entry or changes its name, colour or level, a
write that moved a token off another tab, a clear and a sweep that removed anything. A refresh that only moves
`expiresAt` broadcasts nothing, since `expiresAt` is not on the wire, and one that would move it by less than
`AGENT_PRESENCE_STAMP_MS` writes nothing either (PR38). Every write ends in `armAlarm()`:
`storage.setAlarm(min(deadlines))`, or `storage.deleteAlarm()`
when there is none. `alarm()` sweeps entries, broadcasts presence when it removed any, then calls `armAlarm()` (PR29).

`room-client.ts`: `putAgentPresence(env, liveDoc, body)` returns the room's answer or throws `RoomUnavailableError`;
`deleteAgentPresence(env, liveDoc, tokenId, tabId)` likewise; `refreshAgentPresence(env, liveDoc, tabId, agent)`
calls `putAgentPresence` with `mode: 'refresh'` and `ttlMs: AGENT_PRESENCE_ACTIVITY_TTL_MS`, logs and swallows every
failure. The changeset route calls it in `waitUntil` after a token's changeset or revert is written
(`refreshAfterWrite`), and the tab read after a token's read (`refreshAfterRead`).

### Read stamps

`refreshAfterRead(ctx, design, tabId, owner)` runs on `GET /api/designs/:id/tabs/:tabId` (any view) once the read
gate has passed and the tab exists, for a token caller only. It first asks `agentPresenceStamps.shouldStamp(id, tokenId,
tabId, now)` (`@liveworkspace/api-kit/agent-presence-stamps`), an in-memory map per isolate keyed by design and
token, bounded at `AGENT_PRESENCE_STAMPS_MAX` with the oldest let go: it answers no for the tab last stamped inside
`AGENT_PRESENCE_STAMP_MS`, and yes for any other tab, so the agent follows its reads. Only on a yes does it look up
the owner's participant record, the person tag and the token's level (`gateEdit`, as an explicit set's, PR27), all
in `waitUntil`, and call `refreshAgentPresence`. `refreshAfterWrite` notes its tab in the same map. The room keeps
its own stamp (PR38), so a second isolate's read costs a room call and no storage write. A failure logs
`[agent-presence] read stamp failed` and the read stands.

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

Upgrade: the room ticket carries the grant (`@liveworkspace/index-app` `sealRoomTicket`); the upgrade opens it and
sets `X-Verified-Person` on every path to `personTagFor(designId, claims.sub)` for a person's grant, empty for a
share-link visitor (PR2), and the room pins it on the session attachment as `personTag`.

### Editor

- `connectRoom` handlers: `onPresence(participants: ParticipantPresence[], agents: AgentPresence[])`; a frame
  without `agents` passes `[]`.
- `splitPresenceFrame(frame)` returns `{ participants, agents }` with every agent entry validated (shape, string
  clamps) and invalid ones dropped.
- `foldAgentPresence({ participantsByTab, agents, tabIds, now })` returns a new map. Per agent entry whose `tabId`
  is a known tab, grouped by `person` with the last entry's status winning, a row
  `{ id, name: agentRowName(name), color, role, status: 'online', lastActiveAt: now, statusLine, agent: true }` is
  appended to the tab's bucket, beside the owner's own row when they are there (`joins` and `self` stay on the wire
  and fold nothing). `agentRowName(owner)` is "{owner}'s Agent". Entries on unknown tabs are skipped (PR16).
- `buildParticipantsByTab` takes `agentsPresent: boolean`: a design neither shareable nor in a team, whose map is
  otherwise empty, builds it (self on the active tab) while any agent entry is present, so a personal design's
  stack shows its owner's agent.
- `buildAgentFocusByElement(agents, activeId, elementIds)` returns `Map<elementId, { name, color }[]>` for entries on
  the active tab, ids missing from the tab skipped, once per person. It reaches the canvas through `AgentFocusContext`,
  apart from `remoteSelectionsByElement`, and never reaches `isElementHeldByOther`.
- `withoutAgentRows(rows)` drops agent rows for the roll call and the Collaborators count.
- `apiSetThreadResolved(ownerId, designId, tabId, commentId, resolved, shareCode)`: a session that may participate
  but not edit calls it from `resolveThread` / `unresolveThread` with the thread's first comment id, as its add calls
  `apiAddComment`; a session that may edit keeps the room path. A refused call puts the thread back (PR36).

## Data and persistence

| Field                                 | Class     | Notes                                                      |
| ------------------------------------- | --------- | ---------------------------------------------------------- |
| Session attachment `personTag`        | transient | Per socket, survives hibernation, gone with the socket     |
| DO storage `agent-presence:<t>:<tab>` | ephemeral | `AgentPresenceRecord`, at most 120 s without a refresh     |
| `Comment.tokenId`                     | audit     | Inside `tabs.data`; written once; deleted with its comment |

`AgentPresenceRecord = { id, designId, tokenId, tabId, personTag, shareCode, name, color, role, status, focus,
setAt, expiresAt }`.

- The person tag is derived from the room ticket's grant at the upgrade; no column is stored for it.
- The room restores every entry in its constructor (`storage.list({ prefix: 'agent-presence:' })` inside
  `blockConcurrencyWhile`), drops the expired ones and arms the alarm. Nothing about presence reaches the design's SQLite.
- `Comment.tokenId` is optional: every stored comment without one parses, an Offline Mode copy keeps it unread,
  a design copy carries it (redacted for every viewer but its author). Account deletion removes the account's
  tokens; a comment's token id then names nothing.

## Errors and edge cases

- **E1** Presence without a token (session, guest): 403 `presence_requires_token`.
- **E2** A token that fails `gateParticipate`, by its own level or its grant's: 403; one the choke point refuses never
  reaches the route.
- **E3** A tab outside a tab-scoped grant or not in the design: 404, as `deniedOnTab` decides.
- **E4** A malformed body: 400 with the codes in the request table; `invalid_json` when it does not parse.
- **E5** The room cannot be reached on PUT or DELETE: 503 `room_unavailable` (PR11); logged.
- **E6** The room is full: 409 `agent_presence_full`; logged.
- **E7** A refresh that fails or finds the room full: logged, the changeset stands.
- **E8** The alarm fires late or not before an eviction: every roster read sweeps first (PR30), and the constructor
  sweeps on wake. A write treats its own expired entry as absent (a refresh starts a bare one, PR9), and a write
  that finds the room full sweeps before refusing it.
- **E9** Several entries share the one alarm: `alarm()` sweeps every expired entry, then re-arms for the next.
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
  it from the stored tab on their next read, and the ledger merge does not apply because the room never saw it.
- **E20** A list over a design with no threads: 200 `{ threads: [] }` after one query.
- **E21** A tab body that fails to parse during the list: skipped, logged `[comment] list skipped tab`.

## Security and trust

- Presence is token-only: a browser shows itself through its socket, and only a token can mark an agent.
- The name and colour come from the token owner's participant record; nothing in a request names anyone.
- The person tag is a SHA-256 of the design id and the owner id: never the owner id, unusable outside the
  design, and kept in the room's attachments and storage. `joins` and `self` reveal only that two roster entries
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

- `PUT .../presence`: at most five reads (design meta, grant, tab, participant, a team membership) and one
  room call; the room does one storage write, one `setAlarm` and one roster broadcast.
- A roster broadcast is O(S x (S + A)) for S sockets and A entries: the person-tag index is built once per frame,
  then each recipient's projection is linear. With A at most 32 and an entry under 3 KiB (20 ids of at most
  128 characters, an 80-character status), `agents` adds under 96 KiB to a frame, inside the 256 KiB frame budget.
- An entry's storage value is under 4 KiB, far under the 128 KiB value limit (PR13).
- Changeset refresh: one room call per applied token changeset, off the response path.
- Read stamp: one in-memory map lookup per token read of a tab; at most one room call per agent, design and tab
  per `AGENT_PRESENCE_STAMP_MS` per isolate, off the response path, and at most one storage write per entry per
  stamp in the room (PR38). The map holds at most `AGENT_PRESENCE_STAMPS_MAX` agents per isolate. Measured: 100,000
  stamps against a full map in about 30 ms, and 50 refreshes inside one stamp write storage once.
- Comment verbs: one tab read, one compare-and-swap write (two of each on a lost race) and one relay.
- The list: one `instr` query naming the tabs that hold a thread, then one read per such tab, one tab in memory
  at a time (each at most `MAX_TAB_BYTES`). A design with T threaded tabs costs 1 + T queries.

## Presentation and UX

The status line shows in the hover card, the Collaborators row and the avatar's accessible name, never as text in
the tab pill.

- An agent row is an avatar in the owner's colour wearing the agent mark (`AgentIcon`, a filled four-point star at
  62% of the disc) instead of initials, and never a picture, always online (PR32). Its name is "{owner}'s Agent".
  Its hover card title carries the badges `participantBadges` gives it, "Agent" then its level, and its description
  reads "{status line}", or "Working on this tab" without one (`agentRowDetail`).
- Everyone on the design sees it, its owner included: the owner's own avatar is unchanged and the agent's sits
  beside it.
- Two tokens of one owner on one tab are one row, showing the status set last.
- A personal design's stack, otherwise hidden, shows while its owner's agent is present.
- The Collaborators modal lists agent rows under their tab, with the status line as the row's second line, no
  Follow button, and outside the "{n} people across {m} tabs" count.
- Focus rings: a 2 px outline in the owner's colour, 4 px outside the element's bounds (`elementBounds`), over a
  1 px halo (white in light, slate-900 in dark), static, beneath remote cursors (PR31).

## Accessibility

- The avatar's accessible name appends the status line: "Webber's Agent (Online), adding payment service".
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

| Fingerprint                                             | Where         | Fields (never text)                                |
| ------------------------------------------------------- | ------------- | -------------------------------------------------- |
| `[agent-presence] set`                                  | api           | designId, tabId, tokenId, created                  |
| `[agent-presence] set` / `cleared` / `expired`          | room          | tabId, tokenId                                     |
| `[agent-presence] refused`                              | api, warn     | designId, tabId, method, tokenId, status, code     |
| `[agent-presence] room unavailable` / `room full`       | api, warn     | designId, tabId, error or tokenId                  |
| `[agent-presence] refresh refused` / `refresh failed`   | api, warn     | designId, tabId, error                             |
| `[comments] added` / `replied` / `deleted`              | api           | designId, tabId, agent                             |
| `[comments] resolved` / `reopened` / `<verb> unchanged` | api           | designId, tabId, agent                             |
| `[comments] lost race`                                  | api           | designId, tabId, attempt                           |
| `[comments] refused`                                    | api, warn     | designId, tabId, route, agent, status, code        |
| `[comments] listed`                                     | api           | designId, status, tabsRead, threads                |
| `[comments] list skipped tab`                           | api, warn     | designId, tabId, error                             |
| `[room-mutation] el-delta did not reach the room`       | api, warn     | designId, tabId, delta (its kind), error           |
| `[agent-presence] skipped entry`                        | editor, debug | reason (`invalid_shape` with count, `unknown_tab`) |

Refusals are logged once each, at the route family's entry (`logRefusal` in `../packages/api-kit/src/refusal-log.ts`), from the
answer's status and error code.

Telemetry: `Agent·Present`, type `frontDoorOf(request)`, written with `reportServerEvent` in `waitUntil` when a
`PUT` creates an entry, as the spec says. `Agent·Present` joins `SERVER_EMITTED_EVENT_PAIRS`, so `/api/events` drops a
client's copy.

## Testing

| Spec rule                                                         | Test                                                                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presence and comments carry the owner's name and colour           | `apps/api/src/routes/agent-presence-routes.test.ts`, `comment-routes.test.ts`                                                                                                 |
| The token id is recorded on every comment, never shown as a name  | `comment-routes.test.ts`, `apps/api/src/comments.test.ts`, `packages/design/src/comments.test.ts`                                                                             |
| Appears as "{owner}'s Agent" beside its owner, with a status line | `apps/live/lib/agent-presence-rows.test.ts` (also a personal design, two tokens of one owner, the owner's own agent beside them)                                              |
| Owner with the tab open: they and their agent side by side        | `agent-presence-rows.test.ts`, `../packages/api-kit/src/room-agent-presence.test.ts` (`agentRosterFor`)                                                                       |
| Every changeset refreshes for `AGENT_PRESENCE_ACTIVITY_TTL_MS`    | `room-agent-presence.test.ts`; the changeset route test (agent-changesets)                                                                                                    |
| PUT `status` (80), `focus` (20), `ttl` (max); DELETE clears       | `packages/api-schema/src/agent-presence.test.ts`, `agent-presence-routes.test.ts`                                                                                             |
| The agent holds no socket                                         | `apps/api/src/design-room.test.ts` (agent presence) (entries with no socket, restored on wake)                                                                                |
| The room expires entries on their ttl                             | `design-room.test.ts` (alarm, sweep)                                                                                                                                          |
| Reads stamp presence, throttled; one tab per agent                | `packages/api-kit/src/agent-presence-stamps.test.ts`, `packages/api-kit/src/room-agent-presence.test.ts` (worst-case burst, a move between tabs)                              |
| Never holds an element                                            | `design-room.test.ts` (`/selections`), `agent-presence-rows.test.ts` (lock map)                                                                                               |
| Never in a head count, the Done check or a roll call              | `agent-presence-rows.test.ts` (`splitPresenceFrame`), `collaborator-roster.test.ts`, `design-room.test.ts` (multiplayer)                                                      |
| An agent comments through the comment endpoints                   | `comment-routes.test.ts` (token caller)                                                                                                                                       |
| Reply, resolve, reopen, each relayed as an `el-delta`             | `comment-routes.test.ts` (fake room stub records the deltas)                                                                                                                  |
| Agents and people use the same endpoints                          | `comment-routes.test.ts` (session, guest Participant link, token); `apps/live/lib/api/tabs.test.ts`                                                                           |
| The cross-tab list, status filter, ref and label                  | `comment-routes.test.ts`; `apps/api/src/db/tabs.test.ts` (`tabIdsWithComments`)                                                                                               |
| Agents cannot be mentioned                                        | `../packages/model-core/src/comment-mentions.test.ts` (closed mention shape)                                                                                                  |
| Levels: reading, participation (comments, presence), changesets   | `apps/api/src/index.test.ts` (choke point), `comment-routes.test.ts`, `agent-presence-routes.test.ts`                                                                         |
| The two constants                                                 | `packages/api-schema/src/agent-presence.test.ts` pins values and order                                                                                                        |
| Logs and telemetry                                                | the route and room tests assert each fingerprint; `server-emitted-events.test.ts`                                                                                             |
| Person tag through the ticket                                     | `routes/design-room-routes.test.ts`                                                                                                                                           |
| OpenAPI parity                                                    | `apps/api/src/openapi/route-parity.test.ts`, `manifest.test.ts`                                                                                                               |
| End to end, dark mode                                             | `apps/live/e2e/signed-in/agent-presence.spec.ts`: a token sets presence, the avatar and status show, a ring draws, a short ttl expires it, a REST reply and resolve land live |

Room and route tests run on the in-memory storage and SQLite fakes with a fixed clock; none waits on a real timer.

## Constants and configuration

| Constant                         | Value  | Provenance                                                            | Safe range      |
| -------------------------------- | ------ | --------------------------------------------------------------------- | --------------- |
| `AGENT_PRESENCE_TTL_MS`          | 30000  | Spec                                                                  | 10000 to 60000  |
| `AGENT_PRESENCE_MAX_TTL_MS`      | 120000 | Spec                                                                  | 60000 to 300000 |
| `AGENT_PRESENCE_ACTIVITY_TTL_MS` | 180000 | Spec: "a few minutes" after the last read or write                    | 60000 to 600000 |
| `AGENT_PRESENCE_STAMP_MS`        | 30000  | Spec: one room write per agent and tab per window (PR38)              | 10000 to 60000  |
| `AGENT_PRESENCE_STAMPS_MAX`      | 1000   | Agents an isolate remembers; a forgotten one costs one more room call | 100 to 10000    |
| `AGENT_PRESENCE_MIN_TTL_MS`      | 1000   | One second: below it an entry cannot reach a screen (PR5)             | 500 to 5000     |
| `AGENT_PRESENCE_STATUS_MAX`      | 80     | Spec                                                                  | 40 to 120       |
| `AGENT_PRESENCE_FOCUS_MAX`       | 20     | Spec                                                                  | 1 to 50         |
| `AGENT_PRESENCE_ROOM_MAX`        | 32     | Keeps `agents` under 96 KiB of a 256 KiB frame (PR12)                 | 8 to 64         |
| `COMMENT_TEXT_MAX`               | 2000   | The add route's existing literal, now named                           | 500 to 5000     |

No new environment variable or binding.

## Assets and external resources

None.

## Defaults ledger

PR1 to PR34 in [DEFAULTS.md](DEFAULTS.md).
