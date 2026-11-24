# Start a Call Here: blueprint

Derived from [item-calls.md](../item-calls.md). The spec decides; this file adds engineering precision. Nothing here is
a new Worker, queue or binding: the editors already reach the index, the index already calls each app's internal doors
with the app's key (livehuddle's template door, its new `call` door, every app's `source-changed` door), and
livehuddle's rooms already push to the index with its key. The index gains one D1 migration (`0031_item_calls.sql`),
and a second for Calls Spaces (`0033_item_calls_spaces.sql`, below).

## Flow

```
item's editor: Call ── window.open('', 'lw-call-<item>') (an empty tab, named) ──┐
   └─ POST /api/index/items/:item/calls {} ─▶ index (person, account)            │
        limiter `item-call:<person>`; loadItem(view) as the person (share code)  │
        a live call for the item? → answer it (started: false)                  │
        else livehuddle POST /api/internal/items/from-template                   │
             {owner, folderId: null, name: "<title> Call", template: team-pod}   │
             share_links row (participate) on the Space                          │
             livehuddle POST /api/internal/items/:space/call {callId}            │
             INSERT item_calls → 201 {call, started: true}                       │
   tab.location = call.link ◀────────────────────────────────────────────────────┘

livehuddle room: hello / tab-focus / close ── 1.5 s settle ─▶ PUT /app/items/:space/call-people {people, names}
   index: UPDATE item_calls (people, names ∪, live_at / ended_at) ─ count changed? ─▶ the item's app
   POST /api/internal/items/:item/source-changed {app: livehuddle, itemId: space, sheetIds: [], calls: true}
   the item's room broadcasts `source-changed`; each open editor reads GET /items/:item/calls again
```

## Wire (`@liveworkspace/index-client`, src/item-calls.ts)

| Shape             | Fields                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ItemCall`        | `id`, `spaceId`, `link` (the Space's Participant link), `people`, `names`, `startedAt`, `endedAt` (null while live), `live`     |
| `ItemMeeting`     | `ItemCall` and `summary: {title, link} \| null`, `plan: {id, title, link} \| null`, `you` (the reader hosted it)                |
| `ItemCallsRead`   | `{live: ItemCall \| null, meetings: ItemMeeting[]}`                                                                             |
| `ItemCallStart`   | `{call: ItemCall, started: boolean, fallback?: 'unavailable' \| 'busy'}` (the Calls Space was skipped, and why)                 |
| `ItemCallAsk`     | `{space?: id}`: the start's body, the person's Calls Space when they chose one                                                  |
| `SpaceCall`       | `{id, item: {app, id, title, link}, host: boolean, live, names, startedAt, summary, plan, summaryDefault: {id, title} \| null}` |
| `CallPeoplePush`  | `{people: number, names: string[]}`: livehuddle's room's push                                                                   |
| `CallSummaryAsk`  | `{knowledgebase: id, title, body}`                                                                                              |
| `CallInviteAsk`   | `{people: id[]}` (1 to `ITEM_CALL_INVITES_MAX`)                                                                                 |
| `InboxCallInvite` | `{id, app, itemId, itemTitle, itemTeamId, byName, at, live}`, in `InboxResponse.calls`                                          |

- `SourceChange` gains `calls?: true`; `app` may then be `livehuddle` and `sheetIds` and `cards` empty.
  `readSourceChange` takes it.
- `readItemCallAsk` (an empty or absent `space` is none; a malformed one is null, 400), `readCallPeoplePush`,
  `readCallSummaryAsk`, `readCallInviteAsk` check a body; anything over a cap or of the wrong
  type is null. Names are trimmed, cut at 80 characters, blanks dropped, at most `ITEM_CALL_NAMES_MAX`.
- `itemCallTabName(itemId)` is `lw-call-<id>` (the call's tab); `itemTabName(itemId)` is `lw-item-<id>` (the item's).
- `@liveworkspace/index-client/browser` `call-tabs.ts`: `namedTab`, `isBlank`, `sendTab` (the opener cut; a share
  link (`?s=`) goes through its app's `/api/auth/silent?return=` first, `viaSilentSignIn`),
  `focusOrOpen(name, url)` and `nameItemTab(itemId)`, shared by the workbench, the Explorer's Inbox and livehuddle.
- Constants as the spec's Limits table, plus `ITEM_CALL_START_GRACE_MS` (120,000: a call nobody has joined yet still
  counts as the item's call, so two quick presses never make two), `ITEM_CALL_TEMPLATE` (`team-pod`), and
  `ITEM_CALL_NAME_SUFFIX` (" Call").
- `CALL_SPACE_SETTING` (`callSpace`, the `all` scope's key), `CALL_SPACES_LISTED` (200), `CALL_SPACE_LINK_DAYS` (7),
  `readCallSpaceSetting(prefs)` (a stored id, else null).
- `IndexClient.startItemCall(itemId, share?, space?)` (sends `{space}` only when given), `IndexClient.itemCalls(itemId, share?)`, `IndexClient.spaceCall(spaceId,
share?)`, `IndexClient.sendCallSummary(spaceId, ask)`, `IndexClient.callInvitePeople(spaceId, share?)` (`GET
/items/:space/call/people`: `{teamId, people}`, who Invite may name), `IndexClient.inviteToCall(spaceId, ask)`;
  `IndexAppClient.callPeople(spaceId, push)`.

## The index (liveworkspace/apps/index)

```
src/item-calls.ts         POST|GET /items/:id/calls, GET /items/:space/call, POST /items/:space/call/summary,
                          POST /items/:space/call/invite
src/item-call-people.ts   PUT /app/items/:space/call-people (livehuddle's room), the signal to the item
src/item-call-reads.ts    rows to wire: ItemCall, ItemMeeting (with the reader's access to the page and the plan)
migrations/0031_item_calls.sql
migrations/0033_item_calls_spaces.sql   space_id no longer UNIQUE, `chosen`, INDEX (space_id, started_at DESC)
```

### Tables

```
item_calls (id TEXT PK 'ic_'+20, item_id → items CASCADE, space_id → items CASCADE, host_id,
            share_code → share_links SET NULL, people INT, names TEXT (JSON array), started_at, live_at NULL,
            ended_at NULL, summary_item_id → items SET NULL, summary_link, summary_title, plan_id → items SET NULL,
            updated_at, chosen INT 0|1 (held in the host's Calls Space))
  INDEX (item_id, started_at DESC)
  INDEX (space_id, started_at DESC)  -- a Space's call: its newest row
  INDEX (host_id)  -- the account purge
item_call_invites (id TEXT PK 'ci:'+sha256(call, person), call_id → item_calls CASCADE, person_id, by_name, at)
  INDEX (person_id, at DESC)
```

A call is **live** when `ended_at IS NULL AND (people > 0 OR started_at >= now - ITEM_CALL_START_GRACE_MS)`.

A Space's call is its newest row (`ORDER BY started_at DESC LIMIT 1`): a Space made for one item has one row, a Calls
Space one a call. `0033_item_calls_spaces.sql` rebuilds `item_calls` without the `UNIQUE` on `space_id` (SQLite can't
drop it in place), the way `0026_items_liveknowledge.sql` rebuilt `items`: `item_call_invites`, its one child, is
copied aside and dropped first, then made again and refilled, every row kept, all in D1's one transaction; every
existing row is `chosen = 0`. `item-calls-spaces-migration.test.ts` runs it over a database with rows in both tables.

### Routes

- `POST /items/:id/calls`: `sender` (an account in person, not a delegate); `overRunLimit('item-call:<person>')`;
  `loadItem(view)` with the caller (their share code counts); the item's app is not livehuddle (400
  `not_for_spaces`), not trashed or archived (404). The live call, if any, is answered with `started: false`. Else the
  Space is made through `callAppForJson(livehuddle, '/items/from-template', …, KIT_CREATE_TIMEOUT_MS)`, checked to be
  the person's and livehuddle's (`getItemRow`), linked (`share_links`, level `participate`, never expiring), marked
  (`callApp(livehuddle, POST, /items/:space/call, {callId})`, a failure logged: the call works, its count never moves),
  and inserted. A failure to make the Space is 503 `call_unavailable`.
  With `space` in the body (`readItemCallAsk`, malformed 400), and no live call: the Space is `loadItem(edit,
{manage: true})` as the person with no share code, livehuddle's, not trashed or archived; anything else answers the
  default path with `fallback: 'unavailable'`. Its newest row live → the default path with `fallback: 'busy'`. Else
  one batch: every earlier row of the Space still open is ended (`ended_at`, `people = 0`); the call link is the newest
  row's `share_code` when that link is still on the Space at `participate`, its `expires_at` moved to now +
  `CALL_SPACE_LINK_DAYS` (`expiry` `week`), else a new one so; the row is inserted with `chosen = 1`. Then the room is
  marked, as for a made Space. 201 `{call, started: true}`. Without `space`, nothing above runs: the default path is
  the same statements as before.
- `GET /items/:id/calls`: `loadItem(view)` with the caller (a guest with the link included); the newest
  `ITEM_CALLS_READ_MAX` rows; the summary's knowledgebase and the plan checked with the reader's own access (at most
  `ITEM_CALL_CHECKS_MAX` distinct items, each `loadItem(view)` with no share code), shown only where it opens.
- `GET /items/:space/call`: the Space's newest row first (one indexed read; none answers `{call: null}`), then
  `loadItem(view)` on the Space with the caller. `summaryDefault` only for the host: the knowledgebase connected to the
  item (`connections` either way, the target's app liveknowledge, not trashed), else the newest liveknowledge item in
  the item's team the host can edit.
- `POST /items/:space/call/summary`: the host alone (`host_id`), limiter; the knowledgebase `loadItem(edit)` as the
  host through the cross-app step (`takeTargetedStep` in automation-steps.ts, factored out of `pushAutomationStep`)
  with a `kb_page` step `{target, title, body}`, rule `{id: 'call-summary', name: 'Meeting Summary'}`, from `{title:
<item title>, url: <the item's address>}`. On `ok`, the row keeps the page's link and title, and the item is told.
- `POST /items/:space/call/invite`: an account in the call's Space (view on it) who reaches the item; limiter; each
  person must reach the whole item (`checkNameable` from approval-people.ts); one `item_call_invites` row each
  (`INSERT OR IGNORE`, so asking twice writes nothing new), `by_name` the inviter's token name.
- `PUT /app/items/:space/call-people` (livehuddle's key only, the Space livehuddle's): `UPDATE … RETURNING item_id,
people_before`; names merged in order, first come, at most `ITEM_CALL_NAMES_MAX`; `people > 0` sets `live_at` and
  clears `ended_at`; `0` sets `ended_at`. When the count moved, the item's app is told through `source-changed`.
  The Space's newest row takes it. A `chosen` row that has been live (`live_at`) and ended more than
  `ITEM_CALL_START_GRACE_MS` ago takes nothing (204, no write): a Calls Space's later use is not that item's call.
- Send to Plan's `sendToPlan` (plan-sends.ts): when the source is a call's Space (its newest row), each card's description gains the
  line back to the item, and the row keeps `plan_id`; the item is told.
- Inbox (`inbox.ts`): `calls`, the reader's invites of the last `ITEM_CALL_INVITE_DAYS`, joined to the call and its
  item, the item out of the Trash, each `live` as above.
- Purges: rows cascade with the item and the Space; `account-purge.ts` deletes a closed account's invites
  (`person_id`) and writes `deleted` over its `host_id`.

## Settings › Calls (`@liveworkspace/settings-ui`)

- `callSpace` is in `ALL_SETTING_KEYS` and `ACCOUNT_KEYS` (`@liveworkspace/settings/account` `CALL_SPACE_KEY`), so an
  editor's write sends it to `all` and its own Settings never shows it twice. `AccountSection.set` takes any stored
  value (`StoredValue`); `null` deletes the key (Default). `ownToggleSetter` passes a non-boolean to its fallback.
- `account-panels/calls/`: `CallSpacePanel` (its own chunk, `accountPanels`' `renderCalls`), drawn in the account's
  **Calls** category (tile `calls`, cyan, a camera) only when the host hands a `callSpaces` door:
  `{list(): Promise<Item[] | null>, token(): Promise<string | null>}`. The editors' host (workbench
  `settings-panel-host.tsx`) lists with its `indexClient`, liveworkspace.app's with the Explorer's client
  (`workspaceToken`); both `listItems({app: livehuddle, view: all, limit: CALL_SPACES_LISTED})`, kept to `access ===
edit` and no `sharedVia` (`choosableSpaces`). Each preview is `GET /api/previews/items/:id?v=&appearance=` on the
  page’s own origin with the bearer, asked once its card comes within 200px of view (one IntersectionObserver for the
  panel, disconnected when it goes), each version once, at most 3 at once, as blob URLs revoked when the panel goes.
- A stored id not among the listed (with fewer than `CALL_SPACES_LISTED` listed) is **Unavailable**.

## Every editor's Call

- `startCall` sends `readCallSpaceSetting(workbench.readPreferences())`; `fallback` answers an info toast
  (`callFallbackWords`), the call opening all the same.

## livehuddle

- `packages/index-app`: the internal door `POST /api/internal/items/:id/call {callId}` calls the app's `call` handler
  (absent: 404). livehuddle's handler asks the Space's room to keep the call's id (`ctx.storage.put('item-call', id)`).
- The room (`document-room/room-item-call.ts`): after `noteAttendance` on a hello, a tab-focus and a close, when the
  room holds a call id, counts the distinct presence keys of its sockets and their names, and arms one
  `setTimeout(ITEM_CALL_SETTLE_MS)`; when it fires, pushes `{people, names}` if it differs from the last pushed. A
  push that fails is dropped (the next change carries the count again).
- The editor: [Calls from other apps](../../../../livehuddle/docs/specs/012-collaboration/blueprints/calls-from-items.md).

## Every editor

- `packages/workbench/src/components/item-call/`: `ItemCallButton` (the Call button, and the pill only while
  `people > 0`, drawn in `EditorCornerActions`' `call` slot), `item-call-store.ts` (one read on mount, again on each
  `source-changed` frame with `calls` and when the tab comes back into view, aborted on unmount; no timer),
  `ItemCallHost.tsx` (names the open item to the store, names the tab, publishes the Meetings Tools row through the
  Tools door), `MeetingsDialog.tsx` (lazy: the list is read only once it opens) and `ItemAppMark.tsx` (an item's app
  by its logo, shared with livehuddle's Open Item).
- Each app passes `call={<ItemCallButton />}` to its corner card and mounts `ItemCallHost` beside `SendToPlanHost`.
  The button and host are the only call code in the item's tab; Meetings' dialog loads on its first open.
- The item's tab names itself `itemTabName(itemId)` while the host is mounted, so Open Item in the call finds it.
- The Explorer's Inbox: a `CallInvite` entry under the `calls` filter (`k:<id>` key), its pane `CallInvitePane.tsx`
  (`itemCalls(itemId)` once on open; Join Call is `focusOrOpen(itemCallTabName(itemId), link)`), and a `call` notice.

## Tests

- Calls Space (index): unset is the default path, statement for statement; set starts in the Space with `chosen` and a
  week's link, reused and extended by the next; a live call about the item joined, not restarted; a deleted, trashed,
  archived, someone else's or link-only Space falls back `unavailable`; a Space in another live call falls back
  `busy`; a guest still refused; the room's push after the grace ignored; the migration keeps every row.
- Calls Space (settings-ui, workbench): the picker's states (loading, empty, list, chosen, unavailable, error) and
  writes; Default deletes the key; the button sends the setting and toasts a fallback.
- index: start (a new call; the live call joined; a guest refused; a Space refused; the template door failing),
  read (a guest with the link; summary and plan hidden from a reader who can't open them), call-people (names merged
  and capped, the count's moves told once, a second app refused), summary (the host alone; a knowledgebase the host
  can't edit refused), invite (someone who can't reach the item refused before any row), Send to Plan's line back,
  Inbox `calls`, purge.
- index-client: each reader's caps and wrong types; `readSourceChange` with `calls`.
- livehuddle: the room's push settles and pushes once, only for a call; the door.
- workbench: the button's states (idle, live, guest, failure), Join and Start open the named tab, the Meetings list's
  rows and empty state, the store re-reads on a `calls` signal and on nothing else.
- Every app: its corner card holds the button (a render test).
