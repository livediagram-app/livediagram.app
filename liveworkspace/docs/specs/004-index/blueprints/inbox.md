# What items push, and the Inbox: blueprint

Derived from [one-explorer-contracts.md "What an item pushes"](../one-explorer-contracts.md#what-an-item-pushes) and
["Inbox"](../one-explorer-contracts.md#inbox). The spec decides; this file only adds engineering precision, read
from the code. Defaults are cited as `IDXn`. Paths are relative to the repository root.

Scope, by file:

| File                                                            | Role                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/app-routes.ts`                    | `/app/…` dispatch; the summary push                                                                                                                             |
| `liveworkspace/apps/index/src/collab-push.ts`                   | `parseCard`, `parseThread`, `parseAction`, `pushCollab`, `collabEvents`, `retractedComments`, `parseForm`, `pushForm`, `pushFormSeen`, `formByCode`, `formSeen` |
| `liveworkspace/apps/index/src/inbox.ts`                         | `inboxQueries`, `handleInbox`                                                                                                                                   |
| `liveworkspace/apps/index/src/collab-parse.ts`                  | `parseSuggestion` (and the other row parsers); `suggestionRowStatements` is in `collab-push.ts`                                                                 |
| `liveworkspace/apps/index/src/calendar-feeds.ts`                | `handleCalendarFeed`, `calendarFeedByToken`, `calendarCardsQuery`: a person's calendar feed and its cards                                                       |
| `packages/explorer/src/inbox-apps.ts`                           | `APPS_WITHOUT_INBOX` (livehuddle), `appHasInbox`: the per-app switch that hides the Inbox and skips its fetch                                                   |
| `packages/explorer/src/data/inbox-settled.ts`                   | `createSettledStore`, `settledStoreFor`: the rows done from the pane, held for the reader across a reload until the index catches up                            |
| `liveworkspace/apps/index/scripts/livehuddle-inbox-cleanup.sql` | The one-off cleanup of livehuddle's Inbox rows from before it stopped pushing (Work Tracker 736)                                                                |
| `packages/index-app/src/outbox.ts`                              | The item's outbox in its Durable Object: what it owes the index, drained on idle                                                                                |
| `packages/index-app/src/cards.ts`, `forms.ts`                   | Cards and their threads under `~cards`; a form's code lookup, cached                                                                                            |
| `packages/index-client/src/card-ref.ts`                         | `cardNumber(card)`: a card's number as every cross-item reader shows it, `ref` (`WI-100`), else `#key`, null for none                                           |
| `packages/index-client/src/app-client.ts`                       | `createIndexAppClient`: `pushSummary`, `pushCollab`, `pushForm`, `pushFormSeen`, `formByCode`, `formSeen`, `pushEvents`, `pushPersonEvents`, `pushUpdates`      |
| `packages/index-client/src/updates.ts`                          | `UPDATE_KINDS`, `isUpdateKind`, `UpdatePush`, `UpdateActor`, `InboxUpdate` and the updates' caps                                                                |
| `liveworkspace/apps/index/src/updates.ts`                       | `parseUpdate`, `parseUpdates`, `pushUpdates`, `updatesQuery`, `inboxUpdateOf`, `sweepUpdates`: updates on watched pages                                         |

## Domain and naming

| Term       | Identifier                                                              | Meaning                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary    | `items.summary`, JSON ≤ 2,048 bytes                                     | What the item last said of its content (counts, mode, `hasContent`)                                                                                         |
| Thread     | `collab_threads (app, item, tab, element)`                              | A comment thread's facts; the comments stay in the item                                                                                                     |
| Action     | `collab_actions (app, item, tab, element, action)`                      | An element's action, or an open card assigned to someone                                                                                                    |
| Card       | `CollabCard { id?, key, ref?, type, typeLabel, title, board, column? }` | A Plan card's facts, pushed under the tab `~cards`; `id` on a thread's row; `ref` its prefixed number (`WI-100`), read as `ref ?? '#' + key` (`cardNumber`) |
| Form       | `collab_forms (item, tab)`; `collab_form_reads (person, item, tab)`     | Responses taken and seen                                                                                                                                    |
| Suggestion | `collab_suggestions (app, item, tab, suggestion)`                       | An agent's suggested edit waiting on a page (liveknowledge): its reason and change, cut; the whole suggestion stays in the app                              |

## Behaviour and state

### The pushes (an app's key; only the item's own app: `403 wrong_app`; unknown item `404`)

| Route                                          | Body                                                                     | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /app/items/:id/summary`                   | `{ summary: object, updatedAt }`                                         | ≤ 2,048 bytes (`400 invalid_summary`); `updated_at = MAX(updated_at, min(updatedAt, now + 5 min))`; Drive signalled when a personal item's time moved on; `204`                                                                                                                                                                                                                                                                                                                                       |
| `PUT /app/items/:id/collab/:tabId`             | `{ threads (≤ 500), actions (≤ 500), tabName?, suggestions? (≤ 50) }`    | the tab's rows made to match in one batch (one statement per table through `json_each`): a row the push no longer holds deleted, the rest upserted only where a column differs, so a push that changes one row writes one; its events written ([events.md](events.md)); `204`; any malformed entry `400 invalid_collab` Its `suggestions` (absent is none) replace the tab's `collab_suggestions` rows the same way (`suggestionRowStatements`: one delete, then one upsert when any), with no event. |
| `PUT /app/items/:id/forms/:tabId`              | `{ form: { heading, responses, latestAt, boardTabId?, code? } \| null }` | upsert (a push without `code` keeps the old one); `null` deletes the form and every read; `400 invalid_form`                                                                                                                                                                                                                                                                                                                                                                                          |
| `PUT /app/items/:id/forms/:tabId/seen`         | `{ personId, seen }`                                                     | `seen = MAX(seen, new)` (never goes back); `400 invalid_form_seen`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /app/forms/:code`                         |                                                                          | `{ itemId, tabId }` for a live code of this app's; else `404`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `GET /app/items/:id/forms/:tabId/seen/:person` |                                                                          | `{ seen }` (0 when none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PUT /app/items/:id/updates`                   | `{ updates: UpdatePush[] }` (≤ 50)                                       | the item's whole set replaced in one batch: `DELETE` of its `item_updates` (cascading to `item_update_people`), then one `INSERT … SELECT … FROM json_each(?)` per table, so a push of 50 updates for 200 people each binds two JSON parameters; `204`; any malformed entry `400 invalid_updates`; an archived item's push (`a:` scope) is taken and dropped, `204`                                                                                                                                   |

Parsing. A card's `start` and `due` are kept only as `YYYY-MM-DD` strings; anything else is dropped from the card,
never the push refused. Its `ref` is kept only when it matches `^[A-Z][A-Z0-9]{0,5}-(\d+)$` with that number the card's
`key` (`CARD_REF` in `collab-parse.ts`); anything else is dropped the same way, so the reader shows `#key`. Shown text is cut, not refused: labels, names and titles to 200, texts to 500, colours to 32. Ids and times
must be well formed. A thread needs `elementId`, `elementLabel`, `resolved` (boolean), `commentCount`,
`participantIds` and `mentionedIds` (≤ 100 ids), `latestText`, `latestAuthorName`, `firstAt`, `latestAt`, and may
carry `latestAuthorColor`, `latestAuthorId`, `resolvedById`, `agentIds` (≤ 100 ids; they join `collab_thread_people`
with the participants and the mentioned, so they reach the thread, but are not stored in `participant_ids`, so
`youCommented` stays false for them), `mentionedBy` (an object keyed by ids in `mentionedIds`, each `{ id, name, color? }`:
`id` an id or null, `name` cut to 200, `color` to 32; an entry whose key is not in `mentionedIds`, or that is
malformed, is dropped, never the push refused), `card` (whose optional `id`, 1 to 128 characters, names the card when the row's
`elementId` is a card thread's own id, and whose optional `column` is `{ name ≤ 200, color? #rrggbb, done boolean }`
or null; a malformed `column` is dropped from the card, never the push refused). An action needs `elementId`, `actionId`,
`elementLabel`, `name`, `status` (`open`, `done`, `wont-do`), `assignerId`, `createdAt`, `updatedAt`, and may carry
`description`, `assigneeId`, `assigneeName`, `assignerName`, `teamId`, `doneById`, `card`. A repeated key keeps its
last entry. A form's `code` is `^[A-Za-z0-9_-]{1,64}$`; `responses` at most 10,000,000. A suggested edit
(`parseSuggestion`) needs `id` (1 to 128 characters), `agent`, `kind` (`replace`, `append`), `after`, `createdAt`, and may
carry `ownerId` (an id or null, null meaning the item's owner), `reason` and `before` (`''` when absent); `before` and
`after` are cut to 2,000 (`COLLAB_SUGGESTION_TEXT_MAX`), `reason` to 500, `agent` to 200. More than 50 is
`400 invalid_collab`; a repeated `id` keeps its last entry.

An update (`parseUpdate`) is refused, naming the first fault, for: an `id` not 1 to 128 characters or repeated in the
push; a `tabId` not an id; `kinds` empty, unknown or repeated; more than `UPDATE_ACTORS_MAX` (5) actors or one without
an id; `actorCount` below `actors.length`; `count` below 1; `firstAt` after `latestAt`, or either not a time; `people`
outside 1 to `UPDATE_PEOPLE_MAX` (200), repeated or not ids. `tabName` is cut to 200 characters and an actor's name to
80, never refused. Account-ness of `people` is not checked: the app names its watchers, and a row for someone who never
reads the Inbox costs a few bytes for 14 days.

### The item's outbox (`@liveworkspace/index-app` `outbox.ts`)

Keys written in the item's own SQLite in the transaction of the change: `summary` (key `''`), `tab` (the tab id),
`edit` (`<person>@<time>`, one per person). The room's alarm drains on idle: 2 s after a write, at least 60 s between
drains, retried after 60 s on failure; up to 50 tabs and `APP_EVENTS_MAX` (100) editors a drain, 6 pushes in flight,
`more` drained straight after. A key written again meanwhile stays for the next drain. An item the index doesn't hold
takes no push (the key is done). Each `tab` key's push is `capCollabPush` of the tab's rows, one request whatever
its size (never paged, Work Tracker 870): its suggested edits are cut as the index cuts them, the newest 50 kept
(`createdAt` then `id`), and counted in the push's bytes with the threads and actions, all three taken newest first;
a push without `suggestions` sends none. One that left rows out logs `[outbox] collab capped` `{ itemId, tabId,
threads, threadsKept, actions, actionsKept }` (with `suggestions, suggestionsKept` when it had any).

### The Inbox (`GET /inbox?app=&limit=`)

`limit` default 100, at most 200. One batch of six statements:

1. **Threads**: candidates are unresolved threads on items the person owns, unioned with threads they are in
   (`collab_thread_people`); then unresolved, item live, in the app asked, reachable; with `mentionsYou`,
   `youCommented`, `onYourItem`; newest `latest_at` first.
2. **Actions**: open, assigned to or by the person, item live, reachable; newest `updated_at` first.
3. **Forms**: on items the person owns or reaches by team (not a link), with more responses than they have seen;
   `unseen = responses - seen`; newest first. Read from the person's items, a union of their personal items
   (`items_owner`) and their scopes' (`items_live`), joined to `collab_forms` by item: one `WHERE` with the `OR`
   let SQLite walk every form in the index instead.

4. **Access requests**: open requests on items in the person's scopes ([request-access.md](request-access.md)).
5. **Shares**: the person's own requests granted in the last `INBOX_SHARES_MS` (7 days), still reached through a
   live link, with the grant's `shared` event's actor and name ([inbox-notices.md](inbox-notices.md#data)).
6. **Suggestions**: candidates are the suggested edits naming the person (`collab_suggestions_owner`, a range on
   `owner_id`) unioned (`UNION ALL`, two terms) with those naming no one on items the person owns (`items_owner`, then
   `collab_suggestions_item`'s `(item_id, owner_id IS NULL)` range); then item live, in the app asked, reachable (the
   threads' reach without its card clause: a page owner on a team item reaches it through the team scope); newest
   `created_at` first, then `suggestion_id`; at most `min(limit, INBOX_SUGGESTIONS_MAX)` (100). `lists.test.ts` "the
   Inbox walks indexes" pins that no table is scanned.
7. **Updates** (`updatesQuery`): from `item_update_people (person_id, latest_at DESC)` for the person, newer than
   `INBOX_UPDATES_MS` (14 days), joined to `item_updates` and `items`; item live and not in the Trash, in the app asked,
   reachable by `reachable('u', false)` (the card clause left out: an update has no `card` column); newest first, at
   most `limit`. A row's corrupt `kinds` or `actors` JSON reads as none (`inboxUpdateOf`), never failing the read.

Reachable: owner of a personal item, one of their scopes, or a live link they opened whose tab is the row's tab (or
every tab), or for a card the tab of its board (`json_extract(card, '$.board.tabId')`).

Answer: `{ threads: InboxThread[], actions: InboxAction[], forms: InboxForm[], accessRequests: InboxAccessRequest[], shares: InboxShare[], suggestions: InboxSuggestion[], updates: InboxUpdate[] }`
(`InboxSuggestion`: `{ app, itemId, itemTitle, itemTeamId, tabId, tabName, suggestionId, agent, reason, kind, before,
after, createdAt }`).
`InboxResponse.updates` is optional in `@liveworkspace/index-client`: a reader of an index from before reads none.

The Explorer's update rows (`sections.ts`): kind `Update`, key `updateKey` (`u:<app>:<itemId>:<id>`), time `latestAt`,
reason `updateReason` (`{kind: 'update', label}`, `UPDATE_KIND_LABEL` of the first kind, `+N` past it), the filter
`updates` (label **Updates**, telemetry `Updates`) shown by `shownFilters` like `requests`. `inboxTotal` counts them;
`inboxCount` does not. `entryFacts` (`InboxRows.tsx`) names the newest actor who is not the viewer, else **Someone**,
with `needsYou` false; `Lead` draws the eye (`leadGlyph`) when nobody is behind it. The pane (`InboxReaderBody.tsx`
`updateSentence`, `updateLines`) and `entryPlace` (`{tabId}`, `{}` for a deleted page); `entryTarget` is null, so no
host verb is offered.

The Explorer (`packages/explorer/src/explorer/inbox/sections.ts` `inboxEntries`) keeps one row per card thread: two
rows of one app whose `card.id` is set and whose `elementId` is the same (a thread shared between two plans) are one,
the newer. Such a row's title is its `elementLabel` (the thread's title), its place `card.id` and `threadId`, and its
verbs go to `…/threads/:elementId/comments` and `…/threads/:elementId/resolve` (`inbox-actions.ts`).

An element part's thread (a Sheet cell's, `elementId` `<elementId>:<cell>`) is found in the item's listing
(`GET …/comments?status=all`) by `listedThreadKey` (`inbox-actions.ts`: `elementId`, then `:cell` when the listing
gives one); Reply posts the listed thread's own `elementId` and `cell`, Resolve its first comment as any thread's.

The header's doors (`InboxHost.headerActions`, `packages/explorer/src/types.ts`): each a `HeaderIconButton`
(`packages/explorer/src/ui/HeaderIconButton.tsx`, the panel header's quiet glyph button), drawn in the panel's header
row before the filter's slot (`panel/Pane.tsx`) and in the page's `PaneHeader` actions before its slot
(`InboxPane.tsx`), whatever the list's state.

A Plan card's row (an action or thread with `card`) draws `CardStatusChip` (`packages/explorer/src/explorer/badges.tsx`)
from `card.column` beside its title: no read of its own, the column rides in the row's `card` JSON. `inboxCount`
(`sections.ts`) is `forMe` plus the threads whose `threadReason` is `mention` or `yours`, and the sidebar and the
rail draw no badge at 0; with `app` (`inboxCount(data, viewerId, app)`, `inboxBadge`) it counts that app's rows only,
as the panel's rail (`panel/Rail.tsx`) and the editor's button do. `useInbox` holds the rows done from the pane
(`settle(key, at)`, each with the row's time as it was): `data` leaves them out while a read lists them at that time,
so the badge, the rail, Home's pill and the list drop together, and a row that changes after (a new reply, reopened)
comes back. For a signed-in reader the hold is `settledStoreFor(viewerId)` (`data/inbox-settled.ts`):
`localStorage` key `liveworkspace:inbox-settled:<viewerId>`, `{ [key]: [at, doneAt] }`, the newest 200, each let go
an hour after it was done, heard across tabs through `storage`; so a reload before the app's next push does not list
the row again. Signed out, the page holds it alone. A thread's row names who mentioned
the reader from `mentionedBy`, falling back to the latest author unless that is the reader (**A teammate**).
`threadReason` reads a
thread reached for no other reason (an agent with the reader's token wrote in it, nobody mentioned them, the item is
not theirs) as `agent`, **Your agent wrote**.

### Calendar feeds (`liveworkspace/apps/index/src/calendar-feeds.ts`)

The person's feed of their open, dated cards in one app ([one-explorer-contracts.md "Calendar feeds"](../one-explorer-contracts.md#calendar-feeds)).

| Route                                | Caller                                 | Answer                                                                                                                                               |
| ------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /calendar-feed`                 | an app for an account (`person.app`)   | `{ feed: { createdAt } \| null }`                                                                                                                    |
| `PUT /calendar-feed`                 | the same                               | body `{ tokenHash }` (`^[0-9a-f]{64}$`, else `400 calendar_feed_invalid`): upsert on `(person_id, app)`, `created_at` now; `{ feed: { createdAt } }` |
| `DELETE /calendar-feed`              | the same                               | `204`, whether or not one went                                                                                                                       |
| `GET /calendar-feed/cards`           | the same, its teams in `X-Index-Teams` | `{ cards: CalendarCard[] }` (below)                                                                                                                  |
| `GET /app/calendar-feeds/:tokenHash` | the app's key                          | `{ personId }` for this app's row with that hash; else, or a malformed hash, `404`                                                                   |

Any other caller of `/calendar-feed…` (a person's own token, a link visitor, the Drive mirror, the export) is
`403 calendar_feed_app_only`; another method, or another path below it, `404`. The cards read:

```sql
SELECT a.item_id, i.title, a.element_id, a.card, a.updated_at
FROM collab_actions a JOIN items i ON i.id = a.item_id
WHERE a.assignee_id = ? AND a.status = 'open' AND a.app = ? AND a.tab_id = '~cards' AND i.trashed_at IS NULL
  AND (json_extract(a.card, '$.start') IS NOT NULL OR json_extract(a.card, '$.due') IS NOT NULL)
  AND ((i.owner_id = ? AND i.team_id IS NULL) OR i.scope IN (SELECT value FROM json_each(?)))
ORDER BY a.updated_at DESC LIMIT 1000
```

`CalendarCard` (`@liveworkspace/index-client`) is `{ itemId, itemTitle, cardId, card: CollabCard, updatedAt }`
(`cardId` the action's `elementId`). A row whose card JSON does not parse is skipped. The reach is the Inbox's
`reachable` without its link clause: a plan reached only through a share link never lists.

## Data and persistence

| Table                  | Key                                             | Indexes                                                                                                                | Written by                    | Read by             |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------- |
| `collab_threads`       | `(app, item_id, tab_id, element_id)`            | `collab_threads_item (item_id, tab_id, resolved, latest_at DESC)`                                                      | collab push; purge anonymises | Inbox, events       |
| `collab_thread_people` | `(person_id, app, item_id, tab_id, element_id)` | `collab_thread_people_item (item_id, tab_id)`                                                                          | collab push; merge; purge     | Inbox               |
| `collab_actions`       | `(app, item_id, tab_id, element_id, action_id)` | `collab_actions_item`; `collab_actions_assignee (assignee_id, status, updated_at DESC)`; `collab_actions_assigner (…)` | collab push; merge; purge     | Inbox, events       |
| `calendar_feeds`       | `(person_id, app)`                              | `calendar_feeds_token` UNIQUE `(token_hash)` (0018)                                                                    | calendar feed routes; purge   | feed routes         |
| `collab_forms`         | `(item_id, tab_id)`                             | `collab_forms_code` UNIQUE `(code) WHERE code IS NOT NULL` (0004)                                                      | form push                     | Inbox, `formByCode` |
| `collab_form_reads`    | `(person_id, item_id, tab_id)`                  | `collab_form_reads_item (item_id)`                                                                                     | seen push; merge; purge       | Inbox, `formSeen`   |
| `collab_suggestions`   | `(app, item_id, tab_id, suggestion_id)`         | `collab_suggestions_owner (owner_id, created_at DESC)`; `collab_suggestions_item (item_id, owner_id, created_at DESC)` | collab push; merge; purge     | Inbox               |
| `item_updates`         | `(item_id, update_id)`                          | `item_updates_latest (latest_at)` (0028)                                                                               | updates push; sweep; purge    | Inbox               |
| `item_update_people`   | `(person_id, item_id, update_id)`               | `item_update_people_latest (person_id, latest_at DESC)`; `item_update_people_update (item_id, update_id)` (0028)       | updates push; sweep; purge    | Inbox               |

`0028_item_updates.sql`: `item_updates` holds `app`, `tab_id`, `tab_name`, `kinds` and `actors` (JSON), `actor_count`,
`count`, `first_at`, `latest_at`, cascading from `items`; `item_update_people` cascades from `item_updates` by
`(item_id, update_id)` and copies `latest_at` for its index. The daily cron's `updates` step (`sweepUpdates`) deletes
`item_updates` older than 14 days, 500 a statement, up to 20 rounds a run. An account's purge deletes its
`item_update_people` rows and rewrites its entry in `item_updates.actors` as `{id: <anonymised>, name: 'Someone'}`.

`collab_threads` also holds `latest_author_id` (null when the app did not say) and `mentioned_by` (`'{}'`), added by
`0020_thread_mentioned_by.sql`. The purge anonymises them with the rest: `latest_author_id` becomes the anonymised id,
and `mentioned_by` drops the entries keyed by the person or naming them.

`collab_suggestions` (`0027_collab_suggestions.sql`, Work Tracker 1362) holds `tab_name`, `owner_id` (null: the item's
owner), `agent`, `reason`, `kind` (CHECK `replace`, `append`), `before_text`, `after_text`, `created_at`. Archiving
deletes an item's rows with its other Inbox rows; a guest's merge moves `owner_id` to the account; closing an account
deletes the rows naming it (`account-purge.ts`, through `collab_suggestions_owner`, chunked).

Defaults: `tab_name ''`, `participant_ids '[]'`, `mentioned_ids '[]'`, `mentioned_by '{}'`, `latest_author_color ''`, `description ''`,
`reason ''`, `before_text ''`; `status` CHECK the three. Every table cascades from `items`.

**livehuddle's old rows** (Work Tracker 736). livehuddle stopped pushing (#1612), but what it pushed before stays.
Every row a push writes carries the pushing app in `app` (it is in each key), so `app = 'livehuddle'` selects them
and nothing of another app's, whichever item they sit on. `scripts/livehuddle-inbox-cleanup.sql` is three plain
`DELETE ... WHERE app = 'livehuddle'` statements, `collab_thread_people` first, then `collab_threads` and
`collab_actions`; no compound select, no bound parameter, no event or webhook (a direct delete is not a push, so
`collabEvents` never sees it). `collab_forms` and `collab_form_reads` are left alone: livehuddle never had forms.
Idempotent: a second run deletes nothing. It is not a migration, so no deploy runs it: the owner runs it once,
locally first (`corepack pnpm --filter @liveworkspace/index-service exec wrangler d1 execute liveworkspace-index --local --file scripts/livehuddle-inbox-cleanup.sql`), then
on production with `--remote`.

## Errors and edge cases

| Case                               | Answer                                         |
| ---------------------------------- | ---------------------------------------------- |
| Another app pushing                | `403 wrong_app`                                |
| A summary over 2 KB                | `400 invalid_summary`                          |
| A push from a clock running fast   | its time taken as now + 5 min at most          |
| More than 500 threads or actions   | `400 invalid_collab`                           |
| More than 50 suggestions           | `400 invalid_collab`                           |
| More than 50 updates, or a bad one | `400 invalid_updates`, naming the first fault  |
| An archived item's updates         | taken and dropped, `204`                       |
| A form link deleted or suspended   | pushed `null`: off the Inbox, its code with it |

## Testing

| Test                                                            | Pins                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/inbox.test.ts` (11)               | Inbox threads, cards, forms; the Inbox at scale                                             |
| `liveworkspace/apps/index/src/updates.test.ts`                  | the updates push and read: replace, reach, Trash, 14 days, refusals, 50 × 200, sweep, purge |
| `packages/explorer/src/explorer/inbox/updates.test.tsx`         | update rows: never counted, the filter, words, the pane, Open at the page, the notice       |
| `liveworkspace/apps/index/src/calendar-feeds.test.ts`           | feed make, reset, read, turn off, token lookup, the cards read's reach and refusals         |
| `liveworkspace/apps/index/src/app.test.ts` (15)                 | app pushes and the Inbox among the rest                                                     |
| `liveworkspace/apps/index/src/inbox-suggestions.test.ts`        | suggested edits: pushed, replaced, cut, refused, whose, trashed, one batch                  |
| `packages/index-app/src/outbox.test.ts`                         | the outbox's keys, drain, caps and retries                                                  |
| `packages/index-app/src/outbox-suggestions-cap.test.ts`         | `capCollabPush`'s suggestions: cut, newest 50, fixed order, counted in the bytes            |
| `packages/explorer/src/explorer/inbox/suggestions.test.tsx`     | the suggestion row, its count, filter, pane, Accept and Dismiss, their errors               |
| `packages/index-app/src/cards.test.ts`, `forms.test.ts`         | cards under `~cards`; a form's code lookup                                                  |
| `packages/explorer/src/inbox-apps.test.tsx`                     | no Inbox for livehuddle; the other four keep it                                             |
| `packages/explorer/src/data/inbox-settled.test.ts`              | the hold across a reload, its cap and hour, broken storage, other tabs                      |
| `packages/explorer/src/data/useInbox.test.tsx`                  | a row done from the pane stays out after a reload, back once it changes                     |
| `liveworkspace/apps/index/src/livehuddle-inbox-cleanup.test.ts` | the cleanup deletes livehuddle's thread, people and action rows only, twice safely          |

## Constants and configuration

`SUMMARY_MAX_BYTES` 2048, `COLLAB_MAX_THREADS` 500, `COLLAB_MAX_ACTIONS` 500, `COLLAB_CARDS_TAB` `'~cards'`,
`COLLAB_EVENTS_MAX` 100, `COLLAB_MAX_SUGGESTIONS` 50, `COLLAB_SUGGESTION_TEXT_MAX` 2,000,
`COLLAB_SUGGESTION_REASON_MAX` 500, `COLLAB_SUGGESTION_AGENT_MAX` 200, `INBOX_SUGGESTIONS_MAX` 100, `INDEX_BODY_MAX_BYTES` 512 KiB (the index's `MAX_BODY_BYTES`, and the most a collab push
`capCollabPush` sends), `COLLAB_TEXT_MAX` 500, `COLLAB_PEOPLE_MAX` 100 (`packages/index-client`); `LABEL_MAX` 200,
`TEXT_MAX` 500 (`COLLAB_TEXT_MAX`), `UPDATES_PUSH_MAX` 50, `UPDATE_ACTORS_MAX` 5, `UPDATE_PEOPLE_MAX` 200,
`UPDATE_TAB_NAME_MAX` 200, `UPDATE_ACTOR_NAME_MAX` 80, `INBOX_UPDATES_MS` 14 days (`packages/index-client` `updates.ts`),
`COLOR_MAX` 32, `CALENDAR_CARDS_MAX` 1,000 (`calendar-feeds.ts`), `PEOPLE_MAX` 100 (`COLLAB_PEOPLE_MAX`),
`RESPONSES_MAX` 10,000,000 (`collab-push.ts`); `INBOX_LIMIT_DEFAULT` 100 (`config.ts`); `FUTURE_SLACK_MS` 5 min
(`events.ts`); `FLUSH_IDLE_MS` 2 s, `FLUSH_MIN_GAP_MS` 60 s, `FLUSH_RETRY_MS` 60 s (a key's first wait after a
failure, doubling to `RETRY_MAX_MS` 1 h), `OUTBOX_MAX_ATTEMPTS` 12, `FINAL_STATUSES` 400, 403, 413, 422, `DRAIN_TABS`
50, `PUSH_CONCURRENCY` 6 (`outbox.ts`); `FORM_PLACE_TTL_MS` 60 s, `FORM_PLACE_CACHE_MAX` 1,000 (`forms.ts`).

## Defaults ledger

- `IDX8`: shown text in a push past its cap is cut rather than refused; ids and times are refused when malformed.
