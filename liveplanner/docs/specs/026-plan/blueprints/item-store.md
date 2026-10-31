# Item store blueprint

Derived from [Items](../items.md). Implementation contract for the `@liveplanner/items` package, the api's item
store, the room op, and the editor's item slice.

## Domain and naming

| Spec term  | Identifier                                                   |
| ---------- | ------------------------------------------------------------ |
| item       | `Item` (`packages/items/src/item.ts`)                        |
| item type  | `ItemTypeDef`, catalogue `ITEM_TYPES`, id `ItemTypeId`       |
| field      | a key of `Item.fields` (`ItemFields`); kinds `ItemFieldKind` |
| item store | plan table `items`; editor slice `usePlanItems`              |
| item key   | `Item.key` (number), drawn `#${key}`                         |
| rank       | `Item.rank` (string), made by `rankBetween`                  |
| status     | `fields.status` (string)                                     |
| person     | `ItemPerson { id, name, color }`                             |

## Package `@liveplanner/items` (pure, no DOM, no dependencies)

```
src/item.ts          Item, ItemFields, ItemFieldValue, ItemPerson, ItemCreate, ItemPatch, ItemMove
src/item-types.ts    ITEM_TYPES, itemTypeOf(id) (unknown -> fallback def), ItemTypeId
src/fields.ts        KNOWN_FIELDS (field -> kind), PRIORITIES, validateFields, validateFieldKey
src/limits.ts        named constants (Constants table)
src/rank.ts          rankBetween(a, b), rankAfter(a), rankBefore(b), compareRank
src/apply.ts         makeItem, applyPatch, applyMove, applyTally (shared by api and offline store), rankInColumn,
                     itemPlacer (ranks a batch of creates: one sort per column, not one per create)
src/status-since.ts  STATUS_SINCE_FIELD, itemStatusSince (falls back to updatedAt), stampStatusSince (apply.ts's
                     stamp), statusSinceUndo (the old value an inverse puts back), cardAgeDays, cardAgeTone
src/write-checks.ts  readItemPlace, readItemCreate, readItemPatch, readItemMove, statusExcluded, readItemWrite,
                     writtenItemsRefusal: the api's body checks, run by an offline project on its own writes
src/board.ts         PlanBoardSetup, PlanColumn, SwimlaneBy, projectBoard
src/tab-items.ts     itemIdsShownOnTab(elements, items)
src/board-status-picks.ts the column picker's statuses: pickableStatuses(names, items, types), missingStatuses(setup,
                     names), missingBoardStatuses(setup, names, { items, types, boards }) (cards, boards, colour)
src/views.ts         itemSummary, itemAccessibleName: one-line text for agents and announcements
src/store.ts         ItemStoreState, applyItemWrite, mergeItemChanges, inverseItemWrites, writeLimitedTo, storeAsCreates
src/presets.ts       PLAN_BOARD_PRESETS, presetSetup, presetSetupOrBlank
src/person.ts        itemPersonId(ownerId): the hashed person id
src/refs.ts          resolveItemRef(items, ref): #12, 12 or an id prefix
src/index.ts
```

### Types

```ts
type ItemFieldValue =
  string | number | boolean | null | ItemFieldValue[] | { [k: string]: ItemFieldValue };
type ItemFields = Record<string, ItemFieldValue>;
interface ItemPerson {
  id: string;
  name: string;
  color: string;
}
interface Item {
  id: string;
  type: string;
  key: number;
  rank: string;
  fields: ItemFields;
  rev: number;
  createdAt: number;
  updatedAt: number;
  createdBy: ItemPerson;
  updatedBy: ItemPerson;
}
interface ItemCreate {
  id?: string;
  type: string;
  fields: ItemFields;
  place?: ItemPlace;
  key?: number;
  votes?: Record<string, number>;
}
interface ItemPlace {
  status?: string;
  after?: string | null;
  before?: string | null;
}
interface ItemPatch {
  set?: ItemFields;
  clear?: string[];
  type?: string;
}
interface ItemMove extends ItemPlace {
  set?: ItemFields;
  clear?: string[];
  type?: string;
} // a swimlane drop
```

- `ItemCreate.key` and `votes` are accepted only to restore an item (undo, sync); `validateVotes` bounds the votes
  (`ITEM_VOTERS_MAX`, `ITEM_VOTES_PER_PERSON_MAX`).
- `ItemMove.set` / `clear` may name only `SWIMLANE_FIELDS` (`assignee`, `priority`), `LANE_FIELD_BUILT_INS`, a
  custom field id (Parent's `parent` among them) or `ARCHIVED_FIELD` (`archived`: a card dragged off an Archive
  board, and that move's undo): `isMoveSettable`; `type` moves a type swimlane.

### Validation (`validateFields(fields, mode)`)

Returns `{ ok: true, fields }` or `{ ok: false, error: ItemRejection, field }`. Rejections are a closed union:
`title_required`, `title_too_long`, `field_key_invalid`, `field_value_invalid`, `fields_too_many`,
`fields_too_large`, `votes_read_only`, `comments_read_only`, `type_invalid`, `id_invalid`, `place_invalid`.

| Kind      | Accepts                                                            |
| --------- | ------------------------------------------------------------------ |
| text      | string, trimmed, 1..`ITEM_TITLE_MAX` (title); empty title rejected |
| long text | string ≤ `ITEM_DESCRIPTION_MAX`                                    |
| status    | string ≤ 40, trimmed, not empty                                    |
| person    | `{ id ≤ 64, name ≤ 80, color #rrggbb }`                            |
| priority  | one of `PRIORITIES`                                                |
| labels    | ≤ `ITEM_LABELS_MAX` strings ≤ 32, de-duplicated                    |
| number    | finite, 0..999                                                     |
| date      | `YYYY-MM-DD` that parses                                           |
| checklist | ≤ `ITEM_CHECKLIST_MAX` rows `{ text ≤ 200, done boolean }`         |
| item ref  | id string matching `ITEM_ID_PATTERN`                               |
| votes     | rejected in create/patch (`votes_read_only`)                       |
| comments  | rejected in create/patch and clear (`comments_read_only`)          |
| timestamp | `statusSince` only: a finite integer ms epoch ≥ 0                  |
| unknown   | scalar, or array of ≤ 50 scalars; strings ≤ 2,000                  |

- Keys match `ITEM_FIELD_KEY_PATTERN`; at most `ITEM_FIELDS_MAX` keys; serialised fields ≤ `ITEM_FIELDS_BYTES`,
  measured without `comments` (`fieldsByteSize`); the thread is measured on its own (`commentsByteSize`).
- A type id matches `/^[a-z][a-z0-9-]{0,31}$/`.

### Rank

Base-36 fractional keys over `0-9a-z`. `rankBetween(null, null)` is `'i'`; `rankBetween(a, b)` returns the
shortest key strictly between (midpoint digit, extending with a digit when adjacent). At an open end it steps
instead of halving: `rankAfter(a)` is the next key above `a` at its own width (the last digit runs `1-z`, the others
`0-z`, carrying), and once every key of that width is used it doubles the width with the smallest tail (`z` to `z1`,
`zz` to `zz01`); `rankBefore(b)` mirrors it (`1` to `0z`, `01` to `00zz`). So n appends cost O(log n) digits. Keys
never end in `0`, so a key between always exists. Ties (equal ranks after concurrent inserts) order by `key`.

### apply.ts

- `makeItem(create, ctx: { id, key, now, by, items })` places at `place` (default: end of `status`'s column, or
  end of all), ranks from neighbours with `rankBetween`.
- `applyPatch(item, patch, ctx)` merges `set`, deletes `clear`, `rev + 1`, stamps `updatedBy/At`.
- `applyMove(item, move, items, ctx)` sets status, computes rank against the target neighbours (`after` wins
  over `before`; a missing neighbour id falls back to the column end), merges `set`.
- `makeItem`, `applyPatch` and `applyMove` pass their result through `stampStatusSince(before, next, written, now)`:
  a status change (or a create) stamps `statusSince` with `now`; a write that names `statusSince` keeps it; any
  other write on a card without one backfills it from the card's previous `updatedAt`, so an older card's age
  never restarts on an edit. `inversePatch` and the move branch of `inverseItemWrites` add the old
  `itemStatusSince` when the write changes the status, and `isMoveSettable` admits `statusSince` so a move's
  undo can carry it.
- `applyTally(item, tally, ctx, field = 'votes')` adds each voter's dots to what they had in `field`, caps a voter's
  count at `ITEM_VOTES_PER_PERSON_MAX`, admits no new voter past `ITEM_VOTERS_MAX`, `rev + 1`. The route picks
  `field` per card with `tallyFieldOn(type, body.field)` (comments-votes-fields.ts): the vote's field while the
  card's type offers it, else the built-in `votes`. `itemVotes(item, field?)` / `itemVoteTotal(item, field?)` read
  one Votes field (the built-in by default).

### Board projection (`projectBoard(setup, items, quick?)`)

- `PlanBoardSetup = { title; columns: PlanColumn[]; doneColumnId?; swimlaneBy: SwimlaneBy;
cardFields: CardField[]; hideWriting: boolean }` (a stored `voting` is read past: a vote is the tab's session vote).
- `PlanColumn = { id; status; name; wipLimit?; color?; width?; done? }` (`done`: counts as done, plan-board.md "Done columns"); `SwimlaneBy = 'none' | 'assignee' | 'type' | 'priority' | 'status' | 'field'` (a stored
  `'parent'` reads as `'field'` with `swimlaneField: 'parent'`).
- No scope: a `scope` an older board stored is read past. Types are the one filter: the types `boardAddTypes(setup, types)`
  resolves (every type when `addTypes` is absent or names none still in the catalogue) drops an item of a type the board does not show, before columns, lanes,
  unplaced and counts, on every board kind (All Cards and Archive included, when they name types). The board's
  drop target refuses such a card (`accepts`) and such a palette type (`acceptsType`), refusal "This board shows
  <types> cards".
- Output: `{ columns: { column, count, overLimit, lanes: { laneKey, items[] }[] }[], lanes: LaneHead[],
unplaced: Item[], doneCount, total }` (`doneCount`: cards in every done column, `isDoneColumn`). Items sorted by `compareRank`, then `key`. Lanes ordered: assignee by
  name, type by catalogue order, priority by `PRIORITIES`, a Card field (Parent among them) by the linked card's key,
  any other field by `fieldLaneOrder`; the empty group last.
- `quick = { text?: string; mine?: string }` narrows (title/key/labels substring; `mine` = assignee id).

### Tab items (`itemIdsShownOnTab`)

Union of every `plan-card`'s `planCard.itemId` and every item any `plan-board` on the tab scopes (columns or
unplaced). Structural input `{ shape?: string; planBoard?: PlanBoardSetup; planCard?: { itemId: string } }[]`.

### Description formatting

- `descriptionRich` (`DESCRIPTION_RICH_FIELD`): `normaliseRichRuns` keeps runs `{ text, bold?, italic?,
underline?, strikethrough?, size? xs|sm|md|lg, color? #rrggbb, link? http(s)/mailto ≤ 2048, heading? 1|2|3 }`,
  at most `ITEM_RICH_RUNS_MAX` (2000) runs and `ITEM_DESCRIPTION_MAX` characters in all; anything else is
  `field_value_invalid`. `description` stays the plain-text mirror (search, card faces, agents).
- A Long Text custom field's formatting rides under `richFieldOf(id)` (`<id>Rich`); `isRichFieldKey(key)` accepts
  `descriptionRich` and `/^f-[a-z0-9-]{1,30}Rich$/` (custom ids are lower case, so no field id ends that way), and
  `validateFields` holds either to `normaliseRichRuns(v, richTextMaxOf(key))`: `ITEM_DESCRIPTION_MAX` for the
  description, `ITEM_UNKNOWN_STRING_MAX` (2,000) for a Long Text. The field's own value stays a plain string (≤ 2,000).
  `richRunsOf(fields, id)` returns the runs only while their text joined equals the plain value (else undefined: the
  value was rewritten plain since); `runsAreMarked(runs)` says whether any run carries a mark, so unmarked text is
  stored plain.

### Label usage

- `labelUsage(items)` (`label-usage.ts`) → `LabelUse[]` `{ label, count }`: one pass over the cards, skipping
  `isTrashed`, each card's labels deduplicated; sorted by count descending, then by lower-cased name, then code
  point. `planSpellingOf(text, uses)` → the first (most used) plan label equal to `text` case aside, else `text`.
  `matchLabels(uses, query, taken)` → `{ matches, creatable }`: the query trimmed, a leading `#` dropped, lower-cased;
  labels the card has (case aside) left out; with no query every label; else those starting with it, then those
  containing it, each in usage order; `creatable` when no plan or card label equals it.
- Cost: measured 1.5 ms median (5.5 ms worst of 20, a loaded machine) for 2,000 cards of 12 labels from 300 names;
  `matchLabels` over those 300 labels 0.03 ms median per keystroke. The host (`PlanSheetsHost`) memoises
  `labelUsage` on the cards map and the open card, so it runs once per change of the cards while a card is open, never
  per keystroke; `label-usage.test.ts` holds the 2,000-card case to a 250 ms budget.

### Colour

- `color` is a known field of kind `colour`: one of `PLAN_TYPE_COLOURS` (compared lower-case, stored as given in
  the palette), anything else is `field_value_invalid`; clearing removes the key. `itemColourOf(item)` returns the
  stored swatch or `undefined`, so a value written before validation (or by hand) never draws.
- Built-in Project fields: `title, description, status, assignee, priority, color, start, due, labels` (+
  comments). `BUILT_IN_FIELD_IDS` lists `color` after `priority`, before `estimate`.
- Editor: `apps/editor/components/plan/ColourSwatches.tsx` puts Plan on the one colour picker: `TypeColourButton` (a
  swatch at the end of the type editor's Name field, opening the picker in a popover) and `ColourSelect` (the panel's
  Colour field, None first) (`patch { set: { color } }` or `{ clear: ['color'] }`, tracked `('Plan', 'Changed', 'ProjectColour')`).
  `ColourDot` draws an item's colour (8 px, ringed) beside a Parent chip and a Project swimlane header; the
  Gantt draws a project's bar and diamond in `itemColourOf(project)` else the Project type colour (overdue red
  still edges it) and a dot in the row's name.

### Archive

- `archived` is a known field of kind `flag`: `true` is stored, anything else is `field_value_invalid`; clearing
  removes the key. `isArchived(item)`.
- `projectBoard` skips archived items on an ordinary board (columns, unplaced, counts); with `setup.archive`
  it takes only archived items, all into `columns[0]`. `normaliseBoardSetup` keeps `archive: true` only.
- Preset `archive`: one column `archived` "Archived", Detailed cards, widgets count, types, filter.
- Board drop: onto an Archive board patches `{ set: { archived: true } }` (status kept; its own cards do not
  reorder); off one onto another board is one move carrying `clear: ['archived']` (one write, one undo step). An Archive board refuses
  palette cards and has no Add Card.
- Card Finder (`card-finder.ts`, items.md "Finding a card"): `findCards(items, { query, show, boardStatuses, types?,
typeLabel? })` keeps live cards of any type id (no catalogue filter), narrowed to `types` when non-empty;
  `cardMatches(item, query, typeLabel?)` also matches the type's name. `CardFinderPanel` holds the pressed types in
  component state and counts from the type-narrowed list.

## Data and persistence: the plan's store

The plan's schema, `apps/api/src/plan-room/plan-schema.ts`:

```sql
CREATE TABLE items (
  plan_id TEXT NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  item_key INTEGER NOT NULL,
  rank TEXT NOT NULL,
  fields TEXT NOT NULL,            -- JSON object
  rev INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL,   -- JSON ItemPerson
  PRIMARY KEY (plan_id, id)
);
CREATE UNIQUE INDEX items_plan_key ON items(plan_id, item_key);
-- on the plan's own row:
--   plan.items_rev INTEGER NOT NULL DEFAULT 0
--   plan.items_next_key INTEGER NOT NULL DEFAULT 1
```

- Field classification: `fields` is user content (never logged); `created_by`/`updated_by` display identity;
  the rest structural.
- A purged plan's Durable Object drops its whole store (`PlanRoom.purge`), items with it.
- `copyProject` copies items verbatim to the new project id and copies `items_rev`/`items_next_key`.
- Writes: one `batch` per write in the plan's store: `UPDATE plan SET items_rev = items_rev + 1 [, items_next_key = ...]
WHERE id = ? RETURNING items_rev, items_next_key`, then the row write guarded by `rev = ?` (update) or
  `INSERT` (create). A lost `rev` race retries up to `ITEM_WRITE_RETRIES` from a fresh read, then `409 item_busy`.
- `apps/api/src/db/items.ts`: `getItemStoreHead`, `listItems`, `readItem`, `readItems`, `insertItems`,
  `updateItemAtRev`, `updateItemsAtRev`, `deleteItemRow`; `itemFromRow`: row ↔ `Item`.

## Interfaces and contracts: REST

All under `/projects/:id/items`, auth `guest-or-clerk`, token-usable, registered in `openapi/manifest.ts`
(tag `Items`), DTOs in `packages/api-schema/src/items.ts` (`ItemsResponse { items, rev }`, `ItemResponse { item, rev }`).

| Method | Path                  | Gate | Body                                                         | Answers             |
| ------ | --------------------- | ---- | ------------------------------------------------------------ | ------------------- |
| GET    | `/items[?tabId=]`     | read |                                                              | `ItemsResponse`     |
| POST   | `/items`              | edit | `ItemCreate`                                                 | 201 `ItemResponse`  |
| POST   | `/items/bulk`         | edit | `{ items: ItemCreate[] }` ≤ `ITEM_BULK_MAX`                  | 201 `ItemsResponse` |
| POST   | `/items/patches`      | edit | `{ items: ({ id } & ItemPatch)[], undo? }` ≤ `ITEM_BULK_MAX` | `ItemsResponse`     |
| POST   | `/items/:itemId`      | edit | `ItemPatch`                                                  | `ItemResponse`      |
| POST   | `/items/:itemId/move` | edit | `ItemMove`                                                   | `ItemResponse`      |
| POST   | `/items/tally`        | edit | `{ items: { id, votes }[], field? }` ≤ `ITEM_BULK_MAX`       | `ItemsResponse`     |
| DELETE | `/items/:itemId`      | edit |                                                              | 204                 |

Comment writes (below, "Comments") add four more under `/items/:itemId/comments`.

- Tab-scoped grants: GET requires `tabId` matching the grant and filters to `itemIdsShownOnTab` of that tab's
  stored elements; writes require `tabId` (query) and the target id in that set (create: always allowed into the
  tab's scope).
- Rejections: `400 { error: ItemRejection }`, `404 item_not_found`, `409 item_exists` (create with a taken id),
  `409 item_busy`, `413 items_full`, plus the project gates' 403/404/410.
- `ItemCreate.key` is honoured only when `< items_next_key` and free; otherwise the store assigns one.
- `POST /projects` create body accepts `items?: ItemCreate[]` (sync to cloud), written in the
  same request after the tabs.
- The patch is a POST: the api's CORS admits GET, POST, PUT and DELETE only.
- `/items/patches` changes many items at once (a type's or a removed column's cards sent to the Trash): every id
  must exist (`404 item_not_found`, and in a tab-scoped grant be in scope), each patch is validated as a single
  one is, and every resulting item is checked (`status_excluded` and `field_required` unless `undo`, the field bounds) before anything
  is written, so one refusal refuses the whole request, naming the item (`{ error, field?, id }`). The updates go
  in one batch, each guarded by the rev read, with one `items_rev` raise; an item a concurrent write moved on
  is read again and retried (`ITEM_WRITE_RETRIES`), the rest kept. One room op relays every changed item. Logs
  `[items] patched` with the count. Every attempt checks all its items before writing its batch; a retry that then
  fails (an item refused as read again, or `item_busy` after the retries) answers its refusal with the items that
  already landed added (`items`, `rev`, as `ItemsResponse`), logging `[items] items.write.partial`. `/items/tally` shares
  the same loop (`routes/item-write-loop.ts`), so a busy tally names the cards already tallied and they are never resent. The editor's
  client (`lib/api/items.ts`) throws `ItemWritePartlyLanded { landed, code }` for that, or for a later request of
  a many-item write failing after earlier ones landed; `usePlanItems` keeps what landed and pushes one undo step for
  it alone (`writeLimitedTo`).
- A create, bulk create or seed (`createMany`) reads the store once per attempt: a named key is free when that
  read's keys lack it (a key a racing write took fails the insert, which retries), and one `itemPlacer` ranks every
  create, so n creates cost no per-create query and one sort per column.
- A move reads its neighbours on every attempt (`writeItem`'s change may be async): a retry ranks against the
  column as it then is.
- Routes live in `apps/api/src/routes/item-routes.ts` (`/items/patches` in `item-patches-route.ts`, the parts they
  share, such as the caller, refusals and relay, in `item-route-kit.ts`), dispatched from
  `project-subresource-routes.ts`; `db/items.ts` holds `readItems` and `updateItemsAtRev` for the many-item write.

## Comments

A card's comment threads (spec items.md "Comments"). A thread is stored once, in its home plan's SQLite, and named
on each card it is on by a link row in that card's plan.

### Pure core (`packages/project/src/card-threads.ts`, type-only imports of `@liveplanner/items`)

- **Types**: `CardRef = { projectId, itemId, key: number | null, projectName?: string }`; `ThreadPerson = { name,
color, authorId? }`; `CardThread = { id, title, resolved, resolvedBy?: string, resolvedAt?: number, comments:
Comment[], createdAt, createdBy: ThreadPerson, updatedAt, home, cards: CardRef[], field?: string, rev }`. `field`
  is the Comments field it belongs to (item-types.md "Comments and Votes fields"), set at start and never changed;
  absent is the built-in `comments`. `isThreadFieldId(s)` (`comments` or a custom field id) checks it. `Comment` gains
  `ai?: true` (comments.ts) and `editedAt?: number`.
- **Constants**: `THREAD_COMMENTS_MAX` 200 and `THREAD_BYTES` 131,072 (the old per-card `ITEM_COMMENTS_MAX` /
  `ITEM_COMMENTS_BYTES`), `CARD_THREADS_MAX` 50, `THREAD_CARDS_MAX` 20, `THREAD_TITLE_MAX` 120,
  `THREAD_OPENING_MAX` 60, `THREAD_ID_PREFIX` `'th-'`.
- **Titles**: `autoThreadTitle(name, text)` (`{name}: {opening}`, the first line cut at a word to
  `THREAD_OPENING_MAX` with `…`, the whole cut to `THREAD_TITLE_MAX`); `threadTitle(thread)` (the stored title, or
  the automatic one from `createdBy.name` and the first comment when it is `''`, as a migrated thread is).
- **Ids**: `newThreadId(random)`; `isThreadId(s)` (`^th-[a-z0-9]{16}$`, or a migrated `c-<item id>`).
- **Writes**: `ThreadChange = add { comment } | edit { commentId, text, mentions, now } | remove { commentId } |
resolve { resolved, by } | rename { title } | react { commentId, emoji, by, name, on } | addCard { card } |
removeCard { projectId, itemId }`;
  `applyThreadChange(thread, change, now)` answers `{ ok, thread }` (rev + 1, `updatedAt` now except for card
  changes and reactions; `react` goes through `withReaction`/`commentWithReactions` from
  `@liveworkspace/model-core/comment-reactions`, `comments_full` only when one is added past the byte budget) or a refusal: `comments_full`, `comment_not_found`, `title_too_long`, `thread_on_card`,
  `thread_cards_full`, `unchanged`. `startThread({ id, home, card, comment, title?, field?, now })` makes one (title
  `autoThreadTitle` unless given; `field` stored unless it is `comments`). Who may is the caller's (routes), never here.
- **Reads**: `isCardThread(v)` (shape, caps, `field`), `openCommentCount(threads, projectId, itemId)` (the face
  count), `openCommentCounts(threads, projectId)` (every card's face count by item id, and each card's count in
  each Comments field a thread names under `fieldCountKey(itemId, field)`),
  `threadsOnCard(threads, projectId, itemId)`, `sortedThreads(threads)` (open first by `updatedAt` desc, then
  resolved by `resolvedAt` desc), `threadParticipants(thread)` (authors, first seen order).
- **Redaction**: `threadForViewer(thread, viewer)` (author and token ids on the viewer's own comments and
  `createdBy` only), `threadForRoom(thread)` (none), `keepOwnThreadAuthors(local, incoming)`,
  `readRestoredThread(raw, owner, card)` (a restore's thread, cleaned as a posted comment is; `null` when not one).
- **Legacy**: `legacyThreadOf(item, projectId)` reads an old `fields.comments` `CommentThread` into a `CardThread`
  (`c-<item id>`, title `''`, resolved kept); `withoutLegacyThread(item)` drops the field.
- `item-comments.ts` (the per-card `applyItemComment`, `itemThread`, `itemForViewer`, `itemForRoom`,
  `keepOwnCommentAuthors`) goes: an item no longer holds a thread. `readRestoredThread` (old shape) is kept only
  through `legacyThreadOf`.

### Items package

`comments` stays a built-in field id of kind `comments` (offered last in Overview, the card field after
checklist), still refused by `validateFields` / `validateClear`. `ItemCreate.comments` (a restore's old thread)
becomes `ItemCreate.threads` (restore: `unknown[]`, checked by the api); `itemCommentCount(item, counts?)` takes the
face count from a `ReadonlyMap<itemId, number>` (an item carries none); `itemsWithCommentCounts` is not added: the
renderers take the map.

A type's own Comments fields (custom kind `comments`) are read by `comments-votes-fields.ts`: `commentsFieldsOf(type)`
(the built-in and its own, in its order), `threadFieldOn(thread, type)` (the thread's field while the type offers it,
else the built-in when offered, else the type's first; `null` with none), `threadsInField(threads, type, field)` and
`storedThreadField(field)` (`{}` for the built-in). `tabsOf`'s default Overview tab ends with every Comments field in
the type's order. A Comments field is never required (`canBeRequired`), never written as a value (`resolveFields`
refuses it, pointing at change_threads) and has no CSV value.

### Storage (plan schema step V7, `plan-room/plan-schema.ts`)

```sql
card_threads      (plan_id, id, title, resolved, resolved_by, resolved_at, comments JSON, created_at,
                   created_by JSON, updated_at, rev, cards JSON, field NULL) PK (plan_id, id)  -- the home's
card_thread_links (plan_id, item_id, thread_id, home, added_at, open_comments)
                                                                            PK (plan_id, item_id, thread_id)
                   INDEX (plan_id, thread_id)                                                  -- each card's
```

- `field` (step V9, `ALTER TABLE card_threads ADD COLUMN field TEXT NULL`, run only when `PRAGMA
table_info(card_threads)` lacks it, so the step runs again harmlessly; `STEPS` may hold a function step for this):
  the thread's Comments field, null the built-in; read back only when `isThreadFieldId`.
- `plan_id` is the home on `card_threads` and the card's plan on `card_thread_links` (`home` = `plan_id` for a
  thread stored here). `open_comments` caches the thread's comment count while open (0 resolved), for faces drawn
  without the thread (thumbnails, renders, agents' listings).
- **Migration** in the step itself: every item whose `fields.comments.comments` is a non-empty array gets a thread
  `c-<item id>` (title `''`, its comments, `resolved`, `created_at` / `created_by` from its first comment, `cards` the
  card), a link, and `fields.comments` removed (`json_remove`), in the step's one transaction.
- **Triggers**: `items_legacy_thread` (AFTER INSERT ON items WHEN `NEW.fields ->> '$.comments'` holds a thread): the
  same, for a copy, an import or an old restore that lands later; `items_threads_gone` (AFTER DELETE ON items):
  the card's links go (the threads are told by the route, below); `outbox_cards_threads` (AFTER INSERT, UPDATE or
  DELETE on `card_thread_links`): the `~cards` key, so the Inbox push follows.
- **`db/card-threads.ts`**: `readThreads(env, home, ids)`, `readThread`, `insertThread`, `updateThreadAtRev` (guarded
  by `rev`; a lost race retried by the writer, `ITEM_WRITE_RETRIES`), `deleteThread`, `linksOfPlan(env, plan)`,
  `linksOfItem`, `linksOfThread`, `insertLink`, `deleteLinks(env, plan, threadId, itemIds?)`,
  `setOpenComments(env, plan, threadId, n)`, `threadCountsByItem(env, plan)` (`SUM(open_comments)` per card).

### Across plans (`plan-room/card-thread-store.ts`, RPCs on `PlanRoom`, plan-client.ts)

| RPC on the home            | Does                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `threadsFor(ids, via)`     | the threads of `ids` that list a card of plan `via`, as stored                                            |
| `threadWrite(id, op, via)` | one `ThreadOp` (below) on a thread listing a card of `via`; answers `{ thread }`, `{ gone }` or a refusal |

| RPC on a plan holding a card | Does                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `threadLinked(link)`         | adds a link row for a card here (`thread_cards_full`, `threads_full`, `item_not_found` refused)       |
| `threadsRelayed(op)`         | keeps the links' `open_comments`, drops links of removed threads, keys `~cards`, broadcasts `threads` |

`ThreadOp = { change: ThreadChange | 'delete'; actor: { owner, editor, agent } }`. The home runs it through
`writeThread(env, home, id, op, via)` (`card-thread-store.ts`), the same function a write on the home itself runs
directly: the thread read, the actor's right checked against it (below), `applyThreadChange`, the guarded write,
the links' counts here, then `relayThread`: `threadsRelayed` on every other plan in `cards` (in `waitUntil`, each
failure logged `[threads] relay.failed`) and the home's own room. A plan that answers `gone` for a link is taken
off `cards` (`[threads] card.gone`).

Rights, against the thread as stored: a comment edit needs `authorId === owner` (and `ai` for an agent); a comment
delete `authorId === owner`, or `editor` (never an agent's); `delete` `editor` or `createdBy.authorId === owner`
(never an agent); `rename`, `react` and `addCard` never an agent. Refused: `403 forbidden`.

### REST (`apps/api/src/routes/card-thread-routes.ts`, dispatched by `handleProjects` on `segments[3] ===

'threads'`and by`handleItemRoutes`on`segments[5] === 'threads'`)

| Method | Path                                                    | Gate (on `:id`, the plan viewed)   | Body                                  | Answers                                                 |
| ------ | ------------------------------------------------------- | ---------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| GET    | `/projects/:id/threads`                                 | read                               | `?item=` narrows to one card          | `CardThreadsResponse`                                   |
| POST   | `/projects/:id/items/:itemId/threads`                   | participate                        | `{ text, mentions?, title?, field? }` | 201 `CardThreadWriteResponse`                           |
| POST   | `/projects/:id/threads/:threadId/comments`              | participate                        | `{ text, mentions? }`                 | `CardThreadWriteResponse`                               |
| PUT    | `/projects/:id/threads/:threadId/comments/:c`           | participate; own                   | `{ text, mentions? }`                 | `CardThreadWriteResponse`                               |
| DELETE | `/projects/:id/threads/:threadId/comments/:c`           | participate; own, or edit          | none                                  | `CardThreadWriteResponse` (`thread: null` once it went) |
| POST   | `/projects/:id/threads/:threadId/comments/:c/reactions` | participate                        | `{ emoji, on, key }`                  | `CardThreadWriteResponse`, 204 if unchanged             |
| POST   | `/projects/:id/threads/:threadId/resolve`               | participate                        | none                                  | `CardThreadWriteResponse`, 204 if already               |
| POST   | `/projects/:id/threads/:threadId/reopen`                | participate                        | none                                  | the same                                                |
| PUT    | `/projects/:id/threads/:threadId/title`                 | participate                        | `{ title }` (`''` automatic)          | `CardThreadWriteResponse`                               |
| POST   | `/projects/:id/threads/:threadId/cards`                 | participate here and on the target | `{ projectId?, itemId }`              | `CardThreadWriteResponse`                               |
| DELETE | `/projects/:id/threads/:threadId`                       | participate; every comment own     | none                                  | 204                                                     |

- The thread is reached through `:id`: a link row of the plan for a card the caller's scope holds, else
  `404 thread_not_found`. Writes count against the write rate limit.
- `GET /threads` reads the plan's links once, its own threads in one query, and each other home's in one
  `threadsFor` per home (in parallel; a home that cannot answer is left out, `[threads] home.unreachable`).
  `?item=` reads one card's.
- A start, a reply, an edit: `newComment` (comment-routes.ts) stamps author, colour, id, token and `ai` (from
  `ctx.token`); a start or reply then runs `afterCommentPosted(ctx, caller, comment, itemId, threadId)`.
- **React**: `emoji` one of the six (`isReactionId`), `on` a boolean and `key` the caller's collab key (1 to
  `REACTION_BY_MAX` characters), else `400` (`unknown emoji`, `missing on`, `missing key`); the name is the caller's profile name
  (`getParticipant`, else "Someone"). Not activity: no timeline entry, email or Inbox change.
- **Add to card**: the target is always a card of `:id`; a body naming another plan (`projectId` other than `:id`)
  is refused `400 thread_other_plan` before anything is read. Then the card is linked here (`linkThread`) and the
  home's `addCard` runs (a thread shared in before the rule has another home; it is asked through it). Refusals:
  `400 thread_other_plan`, `404 item_not_found`, `409 thread_on_card`, `413 threads_full`, `413 thread_cards_full`,
  `403`.
- **Every answer** is `threadForViewer(thread, caller.owner)`; **every relay** `threadForRoom`.
- **Card delete** (`DELETE /items/:itemId`): the card's links are read before the row goes; after it, each thread
  takes a `removeCard` through its home (a thread left on no card is deleted there).
- **Card restore** (`POST /items`, `/items/bulk`, an Editor's): `threads: CardThread[]` (each `readRestoredThread`;
  bad: `field_value_invalid`): a thread this plan stores and still holds takes the card back (`addCard`); one it no
  longer holds is inserted, on this card alone; another plan's is asked back through its home (`addCard`), and
  dropped when that home no longer holds it. The old `comments` body (one `CommentThread`) is still read, as the
  card's legacy thread (the trigger takes it).
- The old `/items/:itemId/comments` routes are removed.

- **Start in a field**: `body.field`, when given, must pass `isThreadFieldId` and be one of
  `commentsFieldsOf(typeIn(typesOf(caller.doc.itemTypes), item.type))`, else `400 { error: 'field_invalid', message }`
  (the message names the type's Comments fields as `id (Name)`, or says the type has none), checked after the card is
  read and before the card's thread count. Stored through `startThread`'s `field`.

Refusals, by name: `400` text missing or too long, `400 title_too_long`, `400 field_invalid`, `403 forbidden`, `404 thread_not_found`,
`404 comment_not_found`, `404 item_not_found`, `409 thread_on_card`, `409 thread_busy`, `409 thread_has_others`,
`413 comments_full`, `413 threads_full`, `413 thread_cards_full`.

- **Thread delete**: the home's `threadRightRefusal` (card-thread-store.ts) refuses an agent `403 forbidden`, and
  anyone else `409 thread_has_others` unless `threadOnlyBy(thread, actor.owner)` (`@liveplanner/project`: every
  stored comment's `authorId` is the actor's; an empty thread passes), read from the thread as stored on each try,
  so a delete made through another plan is checked in the home the same way. 409, not 403: the person may delete
  threads; this one's content stands in the way, and resolving is the way on. The editor's This Browser path
  (`offline-threads.ts`) refuses the same; the ⋯ menu shows Delete Thread… greyed, with the reason, when
  `threadOnlyBy(thread, selfId)` is false (the viewer's copy keeps only their own author ids, so another's comment
  reads as not theirs).

### Room op

`CardThreadsRoomOp = { kind: 'threads'; upserts: CardThread[]; removed: string[] }` (api-schema
`card-threads.ts`), broadcast ordered with no store rev. A tab-scoped session (`room-scope.ts`) hears it with both
lists empty and reads `GET /threads` again.

### Copies and offline

- `PlanCopy.threads`: the threads stored here on the copied cards (`threadForViewer` for `redactAuthorsFor`), each
  re-homed into the copy with only its copied cards (`projectId` the copy's); `importPlanCopy` inserts them and their
  links.
- **This Browser**: `OfflineProjectRecord.threads?: CardThread[]`; `recordThreads(rec)` moves an old item's
  `fields.comments` into it on read (`legacyThreadOf`); `offlineWriteThread(projectId, op)` applies
  `applyThreadChange` (same rights) in `serializeOfflineWrite`. **Sync to cloud** sends `threads` with the create
  (`POST /projects` `threads`, each read as a restore); **Take offline** fetches `GET /threads` and keeps those whose
  `home` is the plan. A start's `field` is checked against the record's types as the api checks it
  (`field_invalid`).

### Inbox

`plan-cards-push.ts` reads the plan's threads (`planThreads`: its own and the other homes', as `GET /threads`) and
hands each card its threads (`InboxCardSource.threads`); `cardsCollabPush` pushes one Inbox thread per thread
(`elementId` the thread id, `elementLabel` its title, `card` its first card here, with `card.id`), once however
many of the plan's cards it is on.

### Editor

- `lib/api/card-threads.ts`: `fetchThreads(scope)`, `writeThread(scope, action)` (`ThreadAction = start { itemId,
text, mentions?, field? } | reply | edit | delete | resolve | rename | addToCard { projectId, itemId } | deleteThread`),
  offline through `lib/offline/offline-threads.ts`.
- `hooks/plan/useCardThreads.ts`: the plan's threads (`Map` by id), loaded with the items and again on a reconnect,
  kept live by `receive(op)` (`keepOwnThreadAuthors`), `countsByItem` (memoised `openCommentCount` per card), and
  `act(action)`: telemetry, applied now (a start shows at once under a temporary id), sent, settled on the answer;
  a refusal toasts and reloads. Mention notices as before (`onMentioned`).
- `components/plan/threads/`: `CardThreads.tsx` (one Comments field: `{ item, type?, field? }`, listing
  `threadsInField`, its New Thread starting in `field`; header, empty state, starter, list, Resolved disclosure;
  `ItemFieldEditor` draws one per Comments field the type offers, under the field's name), `ThreadTile.tsx` (one thread: header, meta, menu, body), `ThreadStarter.tsx`, `ThreadTitleEditor.tsx`,
  `ThreadSharedChip.tsx`, `AddThreadToCardDialog.tsx` (with `useThreadCardPicker.ts`: this plan's live cards and the
  search over them, never another plan's), `thread-words.ts` (counts,
  titles, announcements). `comment-thread-parts.tsx`'s `CommentRow` draws **Generated by AI** and **Edited**, and
  takes `onEdit`.
- `PlanContext.threads` (`{ byItem, counts, act, selfId, canComment, canEdit }`); `CommentsPill` reads
  `counts` through `useFieldThreadCount(store, itemId, type, field)` (thread-store.ts): a custom field's own key, and
  for the field unknown threads land in (the built-in, else the first) the whole less the type's other fields; a
  custom Comments field placed on the face draws the same chip, named `{Field}: N comments`; the Display tab's sample
  card has a store with two comments in each Comments field; exports get the counts map; `collab-deep-link.ts` reads `thread`.

## History

A card's history (spec items.md "History"): entries the plan appends as it applies each card write, kept in the plan's
own SQLite, read one card at a time.

### Pure core (`packages/items/src/item-history.ts`)

- **Types**: `ItemHistoryChange` = `{ kind: 'created', status? }` | `{ kind: 'moved', from: string | null, to: string |
null }` | `{ kind: 'trashed' }` | `{ kind: 'untrashed' }` | `{ kind: 'archived' }` | `{ kind: 'unarchived' }` |
  `{ kind: 'flagged' }` | `{ kind: 'unflagged' }` | `{ kind: 'type', from, to }` | `{ kind: 'set', field, value? }` |
  `{ kind: 'cleared', field }`; `ItemHistoryTag` = `'ai' | 'undo' | 'form'`; `StoredHistoryEntry = { at, by:
ItemPerson, tag?, changes }`; `ItemHistoryEntry = { at, by: { name, color }, mine?: true, tag?, changes }` (the wire).
- `historyChangesOf(before: Item | null, after: Item)`: `created` (with the status) for no `before`; else, in order, the
  status (`trash` in or out reads `trashed` / `untrashed`, any other change `moved`), `archived`, `flagged`, the type,
  then every other key of either `fields` whose JSON differs, skipping `status`, `trashedFrom`, `archived`, `flagged`,
  `votes`, `comments`, `example` and every formatting key (`isRichFieldKey`: a `descriptionRich` or `<id>Rich` change
  reads as its field). A set field carries `historyValueOf` of its value, or no value for a field with formatting;
  `cleared` when the value went (absent, null, '' or an empty list). Rank alone, or votes alone, give `[]`, and an
  empty list writes no entry. At most `ITEM_HISTORY_CHANGES_MAX` changes an entry.
- `historyValueOf(field, value)`: `undefined` (named, not copied) for `description`, `checklist`
  and any object or list of objects but a person; a person (an object with a string `name`) is its name; a string is
  cut to `ITEM_HISTORY_VALUE_MAX` characters (an ellipsis); a list of scalars keeps its first `ITEM_HISTORY_LIST_MAX`,
  each string cut to 40; numbers and booleans as they are.
- `groupHistory(entries)` (newest first in, newest first out): an entry joins the group before it when the author id
  and tag match and it is within `ITEM_HISTORY_GROUP_MS` of the group's oldest entry. Changes merge by key (`created`,
  status, `archive`, `flag`, `type`, each field): a `moved` keeps the oldest `from` and the newest `to` and drops out
  when they meet; an on and off pair (flag, archive, trash) cancels; a field keeps its newest change; `created` stays
  first. A group left with no changes is dropped. The group's `at` is its newest.
- `historyForReader(entries, readerId)`: each entry's `by` as `{ name, color }`, and `mine: true` where `by.id` is the
  reader's `itemPersonId`.

### Storage (plan schema step V8, `plan-room/item-history-schema.ts`)

```sql
CREATE TABLE IF NOT EXISTS item_history (
  id      INTEGER PRIMARY KEY,           -- rowid: append order
  plan_id TEXT    NOT NULL,
  item_id TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  by      TEXT    NOT NULL,              -- JSON ItemPerson, as items.updated_by
  tag     TEXT    NULL,                  -- 'ai' | 'undo' | 'form'
  changes TEXT    NOT NULL,              -- JSON ItemHistoryChange[]
  FOREIGN KEY (plan_id, item_id) REFERENCES items (plan_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS item_history_item ON item_history (plan_id, item_id, id);
```

- Every statement is `IF NOT EXISTS`, so the step is idempotent: run twice, or renumbered past another step, it
  changes nothing. A step that lands beside it under the same number must be renumbered so each runs once.
- The foreign key deletes a card's history with the card (`DELETE /items/:itemId`, Empty Trash) and with the plan.
- `apps/api/src/db/item-history.ts`:
  - `appendItemHistory(env, projectId, writes: { before: Item | null; after: Item }[], tag?)`: one batch. A single
    `INSERT ... SELECT ... FROM json_each(?)` writes every write with changes (by `after.updatedBy`, or `createdBy`
    for a create; `at` = `after.updatedAt`), so a bulk of 40 cards is still one statement. Then, for each changed
    (not created) card, `DELETE ... WHERE plan_id = ? AND item_id = ? AND (at < cutoff OR id <= the id
ITEM_HISTORY_MAX back)`, which reads at most that card's `ITEM_HISTORY_MAX` + 1 index entries. A new card has
    nothing to trim. Never throws: a failure logs `[items] history.append.failed` and the write stands.
  - `readItemHistory(env, projectId, itemId, now)`: `SELECT at, by, tag, changes FROM item_history WHERE plan_id = ?
AND item_id = ? AND at >= ? ORDER BY id DESC LIMIT ITEM_HISTORY_MAX`, rows that do not parse skipped.
  - `deleteOldItemHistory(env, cutoff)`: the daily upkeep's sweep (`PlanRoom.maintain`): deletes every row before the
    first (by id) at or after the cutoff, so it reads only the rows it deletes plus one. Logs `[items]
history.retention` with the count.
- Callers, in the plan's request path (`routes/`), each after its write landed: `writeItem` (patch, move), `create`
  and `bulk` (`item-routes.ts`), `patches` (through `writeItemsWithRetry`'s `history` option) and a form's response
  (`forms/respond.ts`, tag `form`). Tag: `undo` when the body's `undo` is true or a create restores (a key, votes or
  threads), else `ai` for an API token (`ctx.token !== null`), else none (`historyTagOf`). Not called by: `tally`, a
  project create's seed (`seedItems`), the copy and file imports (`plan-content.ts`, `project-file.ts`), the migration
  door, the schema's own steps and `anonymisePlan`.
- `anonymisePlan` sets the `by` of the rows the person wrote (`by ->> '$.id'` = their hashed `itemPersonId`) to the
  Deleted account author: history names authors by hashed id, so the raw-id `anonymiseJsonText` would miss them.
- Copies (`exportPlanCopy`), project files and offline records carry no history: none of them reads the table.

### REST

| Method | Path                     | Gate | Answers                           |
| ------ | ------------------------ | ---- | --------------------------------- |
| GET    | `/items/:itemId/history` | read | `ItemHistoryResponse { entries }` |

- `routes/item-history-route.ts`: the caller (`itemCaller(..., 'read')`), a tab-scoped caller only for a card in scope,
  `404 item_not_found` for a card not in the store; then `readItemHistory`, `groupHistory`, `historyForReader`.
  Registered in `openapi/manifest.ts` (tag `Items`, token-usable); `ItemHistoryResponse` in
  `packages/api-schema/src/items.ts`. Logs `[items] history.read` with the entry count.

### Editor

- `lib/api/item-history.ts` `fetchItemHistory(scope, itemId)`: `'offline'` for a This Browser plan (no request), else
  the entries.
- `hooks/plan/useCardHistory.ts` `useCardHistory({ scope, itemId, rev, enabled })`: `{ status: 'loading' | 'ready' |
'error' | 'offline', entries, retry }`; reads when enabled and again when the card's `rev` moves (debounced
  `ITEM_HISTORY_REFETCH_MS`), dropping an answer for a card no longer shown.
- `components/plan/threads/CardActivity.tsx`: `ActivityRow` (one entry) and `activityFeed(open threads, entries)`
  (both by time, newest first; a thread by `updatedAt`); `activity-words.ts` words an entry (`activityParts`)
  from the plan's `statusNames`, the card's type (field labels: `BUILT_IN_FIELD_LABELS`, then custom labels) and its
  items (a Card field's title).
- `CardThreads` draws the **Activity** switch (`SwitchRow`, `xs`) in its header and, on, the feed in place of the
  open list, the first `ACTIVITY_ROWS_SHOWN` activity rows and **Show N More**; the switch is
  `useLocalStorageValue('liveplanner:v2:card-activity')` (`'off'` is off, anything else on). `useCardThreads` exposes
  its `scope` for the read.

## Live: room op

`packages/api-schema/src/room-messages.ts` adds
`{ kind: 'items'; upserts: Item[]; removed: string[]; rev: number }`, a system kind (dropped from client sockets).
Sent by `relayItems(env, docId, op)` in `room-client.ts` through `/broadcast` with `ordered: true` after each
successful write. `room-scope.ts` hands a tab-scoped session the op with empty `upserts` and `removed`; its client
refetches. Presence on cards is a separate ephemeral op, `plan-presence` (`{ tabId, itemId | null, state }`), in
`PRESENCE_OP_KINDS`.

## Editor slice

- `apps/editor/lib/api/items.ts`: `fetchItems(scope)` and `writeItem(scope, write, by)` (one `ItemWrite`: create,
  patch, patches, move, vote, delete; a create of many goes to `/items/bulk` and a patch of many to
  `/items/patches`, each in batches of `ITEM_BULK_MAX`); each dispatches
  `isOfflineId(docId)` to `lib/offline/offline-items.ts`, which applies `applyItemWrite` to the record's store
  inside `serializeOfflineWrite`.
- `apps/editor/hooks/plan/usePlanItems.ts`: `{ store, items, status, self, write, receive, refetch }`. `self` is the
  person with the hashed id (`itemPersonId` of the editor's self id, the id the api resolves as owner).
  - Optimistic: a write applies `applyItemWrite` locally (creates carry client-made ids, `withCreateIds`), sends,
    then merges the answer. A failed write refetches the store and toasts "Couldn't save that change".
  - Room op `items`: `mergeItemChanges` keeps the higher `rev` per item; `removed` deletes; a rev past
    `serverRevRef + 1`, or an op with no items (a tab-scoped session), refetches (`ITEM_REFETCH_DEBOUNCE_MS`). Room
    resync and reconnect (`onRoomJoined`) refetch.
- `apps/editor/hooks/plan/usePlanSlice.ts` composes the board actions into `PlanContext`; `usePlanPresence` sends
  and hears `plan-presence`.
- Offline record: `OfflineProjectRecord.items?`, `itemsRev?`, `itemsNextKey?`.
- Sync to cloud sends `storeAsCreates(items)` (column order kept, votes carried); Take offline fetches the store
  first and aborts without it; Duplicate copies it (cloud: the create body; offline: the new record); the Drive
  mirror's `ProjectEnvelope.project.items` (optional, so the file stays version 1).
- Tab JSON export: `tabToJsonText(tab, plan?)` (`@liveplanner/project`, `export-tab-text.ts`) adds
  `ExportedTabEnvelope.items` from `tabExportItems(tab, items)` (`export-tab-plan.ts`: `itemIdsShownOnTab`, the Trash
  dropped, `votes` and `comments` stripped from `fields`, key order) and `itemTypes` (the stored catalogue, only with
  items). `TabPlanData = { items, types, catalogue }` is what every text export takes; the Export dialog builds it
  from `usePlan()` once per item or type change and memoises the open format's text.
- Tab JSON import: `parseImportedTab` reads `items` through `isItemLike` (shared with `parseProjectEnvelope`) and
  `itemTypes` through `readItemTypeCatalogue`, as `ImportResult.plan`. `useTabImport` lands the tab, then calls
  `importPlanItems` (`hooks/plan/usePlanTabImport.ts`): `planTabItemsImport(incoming, catalogue, existing, types)`
  (`@liveplanner/items`, `tab-import.ts`) returns the file's types its fresh items use and the project lacks, the
  fresh items as `storeAsCreates` without `key`, and the skipped count; `itemTypes.addTypes(types)` then one undoable
  `write({ kind: 'create', creates })`. A refused write returns `failed: creates.length`, reported as the `Plan Cards`
  failure line (`planCardsFailure`) on the import's report. Logged as `[plan-tab-import]`.
- Markdown export: `tabPlanMarkdown(tab, plan)` appends `## Plan Boards` (`### title`, `#### Column · count`,
  `- #key Title (Type)` per card, `_No cards._` for an empty column) and `## Plan Cards`, shapes in y then x order.
- Board layout: `planBoardLayout(el, items, types)` (`plan-board-layout.ts`) places the columns and the cards that
  fit; `svgPlanBoard` reads it.

## Undo

`useProjectHistory` keeps two counters beside its snapshots: `depth` (steps behind the present, uncapped) and
`branch` (raised by every new step, which clears redo). `useItemUndo` wraps the history's undo and redo with a
journal (`hooks/plan/item-undo-journal.ts`, pure): each item step records the depth it was made at; undo runs the
item step when the depth still matches (no canvas step since), else the canvas's; redo mirrors it by the redo
side's length and branch. An item step's closures send the inverse writes (`inverseItemWrites`: the old values of
the touched keys, the old status and neighbour, a delete for a create, a restoring create for a delete, one `patches` of each item's inverse for a `patches`), and redo
replays the write with the keys the first write was given. Votes push nothing.

## Errors and edge cases

| Case                                            | Handling                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Unknown type                                    | Kept; drawn with the fallback type (grey, generic glyph)              |
| Card points at a missing item                   | "Item not found" face                                                 |
| Move relative to a neighbour that was deleted   | Falls back to the column end                                          |
| Undo patch after someone else changed the field | Writes the old value anyway (last write wins), as canvas undo         |
| Create at the cap                               | `413 items_full`; toast "This project holds 2,000 items"              |
| Comment on a full thread                        | `413 comments_full`; toast "This card holds the most comments it can" |
| Delete a comment already gone                   | `404 comment_not_found`; the store refetches                          |
| Resolve a resolved thread                       | 204, nothing written or relayed                                       |
| Room copy lands after our answer                | Our own comments keep their author id (`keepOwnCommentAuthors`)       |
| A type stops offering comments                  | The thread stays stored, unshown (like votes)                         |
| Room op arrives before the GET answer           | Kept; GET merges by higher rev                                        |
| Offline record without `items`                  | Empty store                                                           |

## Security and trust

- Every write passes the project gate; tab-scoped links are confined by `itemIdsShownOnTab`.
- Items never change from a client socket; `items` is a system op.
- Field values are validated and bounded; text is drawn as text, never HTML.
- Vote budget is a facilitation aid enforced in the editor only (stated, not a trust boundary).
- People on items (authors, voters) are keyed by `itemPersonId`, a one-way hash: a guest's owner id is their
  credential and never reaches an item.
- Hide writing hides faces only; the api returns full items to anyone who may read.
- History entries keep their author as an `ItemPerson` (a hashed id); the read answers only name and colour, and
  `mine` to the author ([History](#history)). Nobody writes history through the api: only the plan's own item writes.
- Comment author ids are owner ids (a guest's credential): they reach only their author (`itemForViewer`), never
  the room (`itemForRoom`), and a restore cannot claim someone else's (`readRestoredThread`). Author name and
  colour are stamped server-side from the caller.

## Performance and limits

- Worst case 2,000 items × 16 KB = 32 MB is refused by the GET's practical size: `ITEMS_MAX` × typical 0.5 KB
  = 1 MB; the GET streams one JSON array. The per-item cap bounds the row; SQLite's 2 MB row limit in a Durable Object is never reached.
- Projection is O(n log n) per board render, memoised on `(setup, items map identity)`.
- Changing many cards at once (`patches`) is one request per `ITEM_BULK_MAX` cards and one batch, never a
  request per card; a type with 2,000 cards is 10 requests.
- A bulk create or a seed of n cards is one store read and one insert batch per `ITEM_BULK_MAX` cards, and ranks
  them in O(n log n): measured 2,000 creates at 5.3 ms CPU against 73 ms with a sort per create
  (`store-growth.test.ts` holds the growth ratio).
- Ranks stay short at an open end: 2,000 appends or prepends end at 8 digits (halving the gap reached 334 and 401,
  past `isValidRank`'s 64).
- Room op carries only the changed items. A card with a long thread (up to `ITEM_COMMENTS_BYTES`, 128 KB) sends
  its whole thread with every write to it: typical threads are a few KB; the cap bounds the worst case.

- History: a card write adds one batch to its request, of one row insert (one table row and one index entry, about
  0.2 KB) and one bounded delete per card it changed; measured in `apps/api/src/db/item-history.test.ts` (rows
  written and time per append, held to a budget). A card at the cap answers `ITEM_HISTORY_MAX` entries before grouping,
  measured there at its worst case. Storage is bounded at `ITEMS_MAX` x `ITEM_HISTORY_MAX` rows, in practice far
  fewer (the age limit, and most cards change a few times).

## Observability

Log fingerprints (console, `[items]`): `items.write.retry`, `items.write.busy`, `items.rejected <error>`,
`items.refetch.gap`, `items.offline.write`, `items.offline.rejected`, `items.offline.comment`, `items.comment.failed` (editor), `items.write.partial` (api),
`comment added`, `comment deleted`, `comments resolved|reopened|unchanged`, `comments.full` (api), `history.read`,
`history.append.failed`, `history.retention` (api), `items.history.failed` (editor). Api logs never
include `fields` or comment text.

## Testing

| Rule                                           | Test                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation per kind, every rejection           | `packages/items/src/fields.test.ts`                                                                                                                                                         |
| Long Text formatting: key, limit, stale runs   | `packages/items/src/rich-text-field.test.ts`, `apps/editor/components/plan/ParagraphField.test.tsx`, `apps/editor/components/plan/ItemFieldEditor.longtext.test.tsx`                        |
| Label usage, spelling, matching, 2,000 cards   | `packages/items/src/label-usage.test.ts`, `apps/editor/components/plan/LabelsEditor.test.tsx`                                                                                               |
| Rank always between, stable under repeats      | `rank.test.ts` (property: 1,000 random inserts; 2,000 appends and prepends stay at most 8 digits)                                                                                           |
| Bulk create grows linearly, keeps column order | `packages/items/src/store-growth.test.ts`; no per-card key query: `apps/api/src/routes/item-routes.test.ts`                                                                                 |
| Write checks shared with offline               | `packages/items/src/write-checks.test.ts`, `apps/editor/lib/offline/offline-items.test.ts`                                                                                                  |
| Partial many-item write: answer, client, undo  | `apps/api/src/routes/item-routes.test.ts`, `apps/editor/lib/api/items-patches.test.ts`, `apps/editor/hooks/plan/usePlanItems.undo.test.ts`                                                  |
| Archive drag-off is one move                   | `apps/editor/hooks/plan/usePlanBoardDrop.restore.test.ts`, `apps/api/src/routes/item-routes.test.ts`                                                                                        |
| apply functions                                | `apply.test.ts`                                                                                                                                                                             |
| Projection: columns, lanes, unplaced, quick    | `board.test.ts`                                                                                                                                                                             |
| Tab-scoped set                                 | `board.test.ts` (`itemIdsShownOnTab`)                                                                                                                                                       |
| Routes: gates, rejections, keys, cascade, copy | `apps/api/src/routes/item-routes.test.ts`                                                                                                                                                   |
| Room op redacted for a tab-scoped session      | `apps/api/src/room-scope.test.ts`                                                                                                                                                           |
| Store transitions, inverses, sync order        | `packages/items/src/store.test.ts`                                                                                                                                                          |
| Undo interleaving                              | `apps/editor/hooks/plan/item-undo-journal.test.ts`                                                                                                                                          |
| Agent verbs and tools                          | `agent-verbs/src/verbs/item.test.ts`, `agent-verbs/src/verbs/thread.test.ts`, `agent-verbs/src/plan/card-threads.test.ts`, `apps/mcp/src/output-schema.test.ts`                             |
| Offline store                                  | `apps/editor/lib/offline/offline-items.test.ts`                                                                                                                                             |
| Comments field: read-only, budget, restore     | `packages/items/src/comments-field.test.ts`                                                                                                                                                 |
| Thread ops, titles, redaction, restore, legacy | `packages/project/src/card-threads.test.ts`, `apps/api/src/plan-room/card-thread-schema.test.ts`                                                                                            |
| Thread routes: roles, agents, cross-plan, AI   | `apps/api/src/routes/card-thread-routes.test.ts`                                                                                                                                            |
| Editor thread writes, room merge, refusals     | `apps/editor/hooks/plan/useCardThreads.test.ts`, `apps/editor/lib/api/card-threads.test.ts`, `apps/editor/lib/offline/offline-threads.test.ts`                                              |
| Panel threads, Add to Card, shared chip, words | `apps/editor/components/plan/threads/*.test.tsx`, `apps/editor/components/plan/threads/thread-words.test.ts`                                                                                |
| History: changes, values, grouping, redaction  | `packages/items/src/item-history.test.ts`                                                                                                                                                   |
| History: storage, bounds, cascade, no D1       | `apps/api/src/db/item-history.test.ts`, `apps/api/src/plan-room/plan-schema.test.ts`                                                                                                        |
| History: writes tagged, roles, scope, redacted | `apps/api/src/routes/item-history-route.test.ts`                                                                                                                                            |
| History: panel feed, switch, words, offline    | `apps/editor/components/plan/threads/CardActivity.test.tsx`, `apps/editor/components/plan/threads/activity-words.test.ts`                                                                   |
| Tab export: items, catalogue, Markdown, layout | `packages/project/src/export-tab-plan.test.ts`, `apps/editor/components/dialogs/ExportTabDialog.plan.test.tsx`                                                                              |
| Tab import: parse, plan, land, report          | `apps/editor/lib/import-tab.test.ts`, `packages/items/src/tab-import.test.ts`, `apps/editor/hooks/plan/usePlanTabImport.test.ts`, `apps/editor/hooks/persistence/useTabImport.plan.test.ts` |

## Constants and configuration

| Constant                   | Value                     | Provenance / safe range                                 |
| -------------------------- | ------------------------- | ------------------------------------------------------- |
| `ITEMS_MAX`                | 2000                      | Spec; a board past a few hundred cards stops being read |
| `ITEM_FIELDS_BYTES`        | 16384                     | Spec; 4 KB–64 KB                                        |
| `ITEM_FIELDS_MAX`          | 64                        | Spec                                                    |
| `ITEM_TITLE_MAX`           | 500                       | Spec; raised from 200 for long card titles              |
| `ITEM_DESCRIPTION_MAX`     | 10000                     | Spec                                                    |
| `ITEM_LABELS_MAX`          | 12                        | Spec                                                    |
| `ITEM_CHECKLIST_MAX`       | 50                        | Spec                                                    |
| `ITEM_BULK_MAX`            | 200                       | A sync of a big offline doc batches                     |
| `ITEM_WRITE_RETRIES`       | 3                         | As changesets' retry                                    |
| `ITEM_KEY_MAX`             | 1000000                   | A named key's ceiling; keeps the next key far from 2^53 |
| `ITEM_COMMENTS_MAX`        | 200                       | Spec; a card's conversation, well past a real one       |
| `ITEM_COMMENTS_BYTES`      | 131072                    | Spec; 200 × typical 0.5 KB; 32 KB–512 KB                |
| `ITEM_REFETCH_DEBOUNCE_MS` | 400                       | Coalesces a burst of gaps                               |
| `ITEM_ID_PATTERN`          | `/^[A-Za-z0-9_-]{6,32}$/` | Client ids are 12-char nanoid-style                     |
| `ITEM_FIELD_KEY_PATTERN`   | `/^[A-Za-z0-9_-]{1,40}$/` | Spec                                                    |
| `ITEM_HISTORY_MAX`         | 200                       | Card #122; a busy card's year of moves; 50 to 1000      |
| `ITEM_HISTORY_MAX_AGE_MS`  | 180 days                  | What a reader asks about; 30 to 365 days                |
| `ITEM_HISTORY_GROUP_MS`    | 60000                     | Spec "within a minute"                                  |
| `ITEM_HISTORY_VALUE_MAX`   | 80                        | One readable line; 40 to 200                            |
| `ITEM_HISTORY_LIST_MAX`    | 12                        | `ITEM_LABELS_MAX`                                       |
| `ITEM_HISTORY_CHANGES_MAX` | 16                        | Bounds one entry; a write changes a few fields          |
| `ITEM_HISTORY_REFETCH_MS`  | 400                       | As `ITEM_REFETCH_DEBOUNCE_MS`                           |
| `ACTIVITY_ROWS_SHOWN`      | 8                         | Spec; a panel's worth before Show More                  |
