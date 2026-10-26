# What items push, and the Inbox: blueprint

Derived from [one-explorer-contracts.md "What an item pushes"](../one-explorer-contracts.md#what-an-item-pushes) and
["Inbox"](../one-explorer-contracts.md#inbox). The spec decides; this file only adds engineering precision, read
from the code. Defaults are cited as `IDXn`. Paths are relative to the repository root.

Scope, by file:

| File                                          | Role                                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/app-routes.ts`  | `/app/…` dispatch; the summary push                                                                                                                             |
| `liveworkspace/apps/index/src/collab-push.ts` | `parseCard`, `parseThread`, `parseAction`, `pushCollab`, `collabEvents`, `retractedComments`, `parseForm`, `pushForm`, `pushFormSeen`, `formByCode`, `formSeen` |
| `liveworkspace/apps/index/src/inbox.ts`       | `inboxQueries`, `handleInbox`                                                                                                                                   |
| `packages/index-app/src/outbox.ts`            | The item's outbox in its Durable Object: what it owes the index, drained on idle                                                                                |
| `packages/index-app/src/cards.ts`, `forms.ts` | Cards and their threads under `~cards`; a form's code lookup, cached                                                                                            |
| `packages/index-client/src/client.ts`         | `createAppIndexClient`: `pushSummary`, `pushCollab`, `pushForm`, `pushFormSeen`, `formByCode`, `formSeen`, `pushEvents`, `pushPersonEvents`                     |

## Domain and naming

| Term    | Identifier                                                          | Meaning                                                             |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Summary | `items.summary`, JSON ≤ 2,048 bytes                                 | What the item last said of its content (counts, mode, `hasContent`) |
| Thread  | `collab_threads (app, item, tab, element)`                          | A comment thread's facts; the comments stay in the item             |
| Action  | `collab_actions (app, item, tab, element, action)`                  | An element's action, or an open card assigned to someone            |
| Card    | `CollabCard { key, type, typeLabel, title, board }`                 | A Plan card's facts, pushed under the tab `~cards`                  |
| Form    | `collab_forms (item, tab)`; `collab_form_reads (person, item, tab)` | Responses taken and seen                                            |

## Behaviour and state

### The pushes (an app's key; only the item's own app: `403 wrong_app`; unknown item `404`)

| Route                                          | Body                                                                     | Effect                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /app/items/:id/summary`                   | `{ summary: object, updatedAt }`                                         | ≤ 2,048 bytes (`400 invalid_summary`); `updated_at = MAX(updated_at, min(updatedAt, now + 5 min))`; Drive signalled when a personal item's time moved on; `204`                               |
| `PUT /app/items/:id/collab/:tabId`             | `{ threads (≤ 500), actions (≤ 500), tabName? }`                         | the tab's rows replaced in one batch (one statement per table through `json_each`); its Timeline events written ([timeline.md](timeline.md)); `204`; any malformed entry `400 invalid_collab` |
| `PUT /app/items/:id/forms/:tabId`              | `{ form: { heading, responses, latestAt, boardTabId?, code? } \| null }` | upsert (a push without `code` keeps the old one); `null` deletes the form and every read; `400 invalid_form`                                                                                  |
| `PUT /app/items/:id/forms/:tabId/seen`         | `{ personId, seen }`                                                     | `seen = MAX(seen, new)` (never goes back); `400 invalid_form_seen`                                                                                                                            |
| `GET /app/forms/:code`                         |                                                                          | `{ itemId, tabId }` for a live code of this app's; else `404`                                                                                                                                 |
| `GET /app/items/:id/forms/:tabId/seen/:person` |                                                                          | `{ seen }` (0 when none)                                                                                                                                                                      |

Parsing. Shown text is cut, not refused: labels, names and titles to 200, texts to 500, colours to 32. Ids and times
must be well formed. A thread needs `elementId`, `elementLabel`, `resolved` (boolean), `commentCount`,
`participantIds` and `mentionedIds` (≤ 100 ids), `latestText`, `latestAuthorName`, `firstAt`, `latestAt`, and may
carry `latestAuthorColor`, `latestAuthorId`, `resolvedById`, `card`. An action needs `elementId`, `actionId`,
`elementLabel`, `name`, `status` (`open`, `done`, `wont-do`), `assignerId`, `createdAt`, `updatedAt`, and may carry
`description`, `assigneeId`, `assigneeName`, `assignerName`, `teamId`, `doneById`, `card`. A repeated key keeps its
last entry. A form's `code` is `^[A-Za-z0-9_-]{1,64}$`; `responses` at most 10,000,000.

### The item's outbox (`@liveworkspace/index-app` `outbox.ts`)

Keys written in the item's own SQLite in the transaction of the change: `summary` (key `''`), `tab` (the tab id),
`edit` (`<person>@<time>`, one per person). The room's alarm drains on idle: 2 s after a write, at least 60 s between
drains, retried after 60 s on failure; up to 50 tabs and `APP_EVENTS_MAX` (100) editors a drain, 6 pushes in flight,
`more` drained straight after. A key written again meanwhile stays for the next drain. An item the index doesn't hold
takes no push (the key is done).

### The Inbox (`GET /inbox?app=&limit=`)

`limit` default 100, at most 200. One batch of four statements:

1. **Threads**: candidates are unresolved threads on items the person owns, unioned with threads they are in
   (`collab_thread_people`); then unresolved, item live, in the app asked, reachable; with `mentionsYou`,
   `youCommented`, `onYourItem`; newest `latest_at` first.
2. **Actions**: open, assigned to or by the person, item live, reachable; newest `updated_at` first.
3. **Forms**: on items the person owns or reaches by team (not a link), with more responses than they have seen;
   `unseen = responses - seen`; newest first.
4. **The Timeline's new count** (`timelineNewQuery`), returned as `timelineNew`.

Reachable: owner of a personal item, one of their scopes, or a live link they opened whose tab is the row's tab (or
every tab), or for a card the tab of its board (`json_extract(card, '$.board.tabId')`).

Answer: `{ threads: InboxThread[], actions: InboxAction[], forms: InboxForm[], timelineNew }`.

## Data and persistence

| Table                  | Key                                             | Indexes                                                                                                                | Written by                    | Read by             |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------- |
| `collab_threads`       | `(app, item_id, tab_id, element_id)`            | `collab_threads_item (item_id, tab_id, resolved, latest_at DESC)`                                                      | collab push; purge anonymises | Inbox, events       |
| `collab_thread_people` | `(person_id, app, item_id, tab_id, element_id)` | `collab_thread_people_item (item_id, tab_id)`                                                                          | collab push; merge; purge     | Inbox               |
| `collab_actions`       | `(app, item_id, tab_id, element_id, action_id)` | `collab_actions_item`; `collab_actions_assignee (assignee_id, status, updated_at DESC)`; `collab_actions_assigner (…)` | collab push; merge; purge     | Inbox, events       |
| `collab_forms`         | `(item_id, tab_id)`                             | `collab_forms_code` UNIQUE `(code) WHERE code IS NOT NULL` (0004)                                                      | form push                     | Inbox, `formByCode` |
| `collab_form_reads`    | `(person_id, item_id, tab_id)`                  | `collab_form_reads_item (item_id)`                                                                                     | seen push; merge; purge       | Inbox, `formSeen`   |

Defaults: `tab_name ''`, `participant_ids '[]'`, `mentioned_ids '[]'`, `latest_author_color ''`, `description ''`;
`status` CHECK the three. Every table cascades from `items`.

## Errors and edge cases

| Case                             | Answer                                         |
| -------------------------------- | ---------------------------------------------- |
| Another app pushing              | `403 wrong_app`                                |
| A summary over 2 KB              | `400 invalid_summary`                          |
| A push from a clock running fast | its time taken as now + 5 min at most          |
| More than 500 threads or actions | `400 invalid_collab`                           |
| A form link deleted or suspended | pushed `null`: off the Inbox, its code with it |

## Testing

| Test                                                    | Pins                                            |
| ------------------------------------------------------- | ----------------------------------------------- |
| `liveworkspace/apps/index/src/inbox.test.ts` (11)       | Inbox threads, cards, forms; the Inbox at scale |
| `liveworkspace/apps/index/src/app.test.ts` (15)         | app pushes and the Inbox among the rest         |
| `packages/index-app/src/outbox.test.ts`                 | the outbox's keys, drain, caps and retries      |
| `packages/index-app/src/cards.test.ts`, `forms.test.ts` | cards under `~cards`; a form's code lookup      |

## Constants and configuration

`SUMMARY_MAX_BYTES` 2048, `COLLAB_MAX_THREADS` 500, `COLLAB_MAX_ACTIONS` 500, `COLLAB_CARDS_TAB` `'~cards'`,
`COLLAB_EVENTS_MAX` 100 (`packages/index-client`); `LABEL_MAX` 200, `TEXT_MAX` 500, `COLOR_MAX` 32, `PEOPLE_MAX` 100,
`RESPONSES_MAX` 10,000,000 (`collab-push.ts`); `INBOX_LIMIT_DEFAULT` 100 (`config.ts`); `FUTURE_SLACK_MS` 5 min
(`timeline.ts`); `FLUSH_IDLE_MS` 2 s, `FLUSH_MIN_GAP_MS` 60 s, `FLUSH_RETRY_MS` 60 s, `DRAIN_TABS` 50,
`PUSH_CONCURRENCY` 6 (`outbox.ts`); `FORM_PLACE_TTL_MS` 60 s, `FORM_PLACE_CACHE_MAX` 1,000 (`forms.ts`).

## Defaults ledger

- `IDX8`: shown text in a push past its cap is cut rather than refused; ids and times are refused when malformed.
