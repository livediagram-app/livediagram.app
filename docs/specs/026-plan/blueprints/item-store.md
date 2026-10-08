# Item store blueprint

Derived from [Items](../items.md). Implementation contract for the `@livediagram/items` package, the api's item
store, the room op, and the editor's item slice.

## Domain and naming

| Spec term  | Identifier                                                   |
| ---------- | ------------------------------------------------------------ |
| item       | `Item` (`packages/items/src/item.ts`)                        |
| item type  | `ItemTypeDef`, catalogue `ITEM_TYPES`, id `ItemTypeId`       |
| field      | a key of `Item.fields` (`ItemFields`); kinds `ItemFieldKind` |
| item store | D1 table `items`; editor slice `usePlanItems`                |
| item key   | `Item.key` (number), drawn `#${key}`                         |
| rank       | `Item.rank` (string), made by `rankBetween`                  |
| status     | `fields.status` (string)                                     |
| person     | `ItemPerson { id, name, color }`                             |

## Package `@livediagram/items` (pure, no DOM, no dependencies)

```
src/item.ts          Item, ItemFields, ItemFieldValue, ItemPerson, ItemCreate, ItemPatch, ItemMove
src/item-types.ts    ITEM_TYPES, itemTypeOf(id) (unknown -> fallback def), ItemTypeId
src/fields.ts        KNOWN_FIELDS (field -> kind), PRIORITIES, validateFields, validateFieldKey
src/limits.ts        named constants (Constants table)
src/rank.ts          rankBetween(a, b), rankAfter(a), rankBefore(b), compareRank
src/apply.ts         makeItem, applyPatch, applyMove, applyVote (shared by api and offline store)
src/board.ts         PlanBoardSetup, PlanColumn, SwimlaneBy, projectBoard
src/tab-items.ts     itemIdsShownOnTab(elements, items)
src/views.ts         itemSummary, itemAccessibleName: one-line text for agents and announcements
src/store.ts         ItemStoreState, applyItemWrite, mergeItemChanges, inverseItemWrites, storeAsCreates
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
- `ItemMove.set` / `clear` may name only `SWIMLANE_FIELDS` (`assignee`, `priority`, `parent`); `type` moves a
  type swimlane.

### Validation (`validateFields(fields, mode)`)

Returns `{ ok: true, fields }` or `{ ok: false, error: ItemRejection, field }`. Rejections are a closed union:
`title_required`, `title_too_long`, `field_key_invalid`, `field_value_invalid`, `fields_too_many`,
`fields_too_large`, `votes_read_only`, `comments_read_only`, `type_invalid`, `id_invalid`, `place_invalid`.

| Kind      | Accepts                                                            |
| --------- | ------------------------------------------------------------------ |
| text      | string, trimmed, 1..`ITEM_TITLE_MAX` (title); empty title rejected |
| long text | string ≤ `ITEM_DESCRIPTION_MAX`                                    |
| status    | string ≤ 40                                                        |
| person    | `{ id ≤ 64, name ≤ 80, color #rrggbb }`                            |
| priority  | one of `PRIORITIES`                                                |
| labels    | ≤ `ITEM_LABELS_MAX` strings ≤ 32, de-duplicated                    |
| number    | finite, 0..999                                                     |
| date      | `YYYY-MM-DD` that parses                                           |
| checklist | ≤ `ITEM_CHECKLIST_MAX` rows `{ text ≤ 200, done boolean }`         |
| item ref  | id string matching `ITEM_ID_PATTERN`                               |
| votes     | rejected in create/patch (`votes_read_only`)                       |
| comments  | rejected in create/patch and clear (`comments_read_only`)          |
| unknown   | scalar, or array of ≤ 50 scalars; strings ≤ 2,000                  |

- Keys match `ITEM_FIELD_KEY_PATTERN`; at most `ITEM_FIELDS_MAX` keys; serialised fields ≤ `ITEM_FIELDS_BYTES`,
  measured without `comments` (`fieldsByteSize`); the thread is measured on its own (`commentsByteSize`).
- A type id matches `/^[a-z][a-z0-9-]{0,31}$/`.

### Rank

Base-36 fractional keys over `0-9a-z`. `rankBetween(null, null)` is `'i'`; `rankBetween(a, b)` returns the
shortest key strictly between (midpoint digit, extending with a digit when adjacent). Keys never end in `0`, so a
key between always exists. Ties (equal ranks after concurrent inserts) order by `key`.

### apply.ts

- `makeItem(create, ctx: { id, key, now, by, items })` places at `place` (default: end of `status`'s column, or
  end of all), ranks from neighbours with `rankBetween`.
- `applyPatch(item, patch, ctx)` merges `set`, deletes `clear`, `rev + 1`, stamps `updatedBy/At`.
- `applyMove(item, move, items, ctx)` sets status, computes rank against the target neighbours (`after` wins
  over `before`; a missing neighbour id falls back to the column end), merges `set`.
- `applyVote(item, personId, delta)` clamps the person's count at 0, drops zero entries.

### Board projection (`projectBoard(setup, items, quick?)`)

- `PlanBoardSetup = { title; columns: PlanColumn[]; doneColumnId?; swimlaneBy: SwimlaneBy;
cardFields: CardField[]; hideWriting: boolean }` (a stored `voting` is read past: a vote is the tab's session vote).
- `PlanColumn = { id; status; name; wipLimit?; color? }`; `SwimlaneBy = 'none' | 'assignee' | 'type' | 'priority' | 'parent'`.
- No scope: a `scope` an older board stored is read past. Types are the one filter: the types `boardAddTypes(setup, types)`
  resolves (every type when `addTypes` is absent or names none still in the catalogue) drops an item of a type the board does not show, before columns, lanes,
  unplaced and counts, on every board kind (All Cards and Archive included, when they name types). The board's
  drop target refuses such a card (`accepts`) and such a palette type (`acceptsType`), refusal "This board shows
  <types> cards".
- Output: `{ columns: { column, count, overLimit, lanes: { laneKey, items[] }[] }[], lanes: LaneHead[],
unplaced: Item[], doneCount, total }`. Items sorted by `compareRank`, then `key`. Lanes ordered: assignee by
  name, type by catalogue order, priority by `PRIORITIES`, parent by key; the empty group last.
- `quick = { text?: string; mine?: string }` narrows (title/key/labels substring; `mine` = assignee id).

### Tab items (`itemIdsShownOnTab`)

Union of every `plan-card`'s `planCard.itemId` and every item any `plan-board` on the tab scopes (columns or
unplaced). Structural input `{ shape?: string; planBoard?: PlanBoardSetup; planCard?: { itemId: string } }[]`.

### Description formatting

- `descriptionRich` (`DESCRIPTION_RICH_FIELD`): `normaliseRichRuns` keeps runs `{ text, bold?, italic?,
underline?, strikethrough?, size? xs|sm|md|lg, color? #rrggbb, link? http(s)/mailto ≤ 2048, heading? 1|2|3 }`,
  at most `ITEM_RICH_RUNS_MAX` (2000) runs and `ITEM_DESCRIPTION_MAX` characters in all; anything else is
  `field_value_invalid`. `description` stays the plain-text mirror (search, card faces, agents).

### Colour

- `color` is a known field of kind `colour`: one of `PLAN_TYPE_COLOURS` (compared lower-case, stored as given in
  the palette), anything else is `field_value_invalid`; clearing removes the key. `itemColourOf(item)` returns the
  stored swatch or `undefined`, so a value written before validation (or by hand) never draws.
- Built-in Project fields: `title, description, status, assignee, priority, color, start, due, labels` (+
  comments). `BUILT_IN_FIELD_IDS` lists `color` after `priority`, before `estimate`.
- Editor: `ColourSwatches` (apps/live/components/plan/ColourSwatches.tsx) is the shared radio group of the twelve
  swatches, used by the type editor's Colour and, with `allowNone`, by the panel's Colour field
  (`patch { set: { color } }` or `{ clear: ['color'] }`, tracked `('Plan', 'Changed', 'ProjectColour')`).
  `ColourDot` draws an item's colour (8 px, ringed) beside a Parent chip and a Project swimlane header; the
  Gantt draws a project's bar and diamond in `itemColourOf(project)` else the Project type colour (overdue red
  still edges it) and a dot in the row's name.

### Archive

- `archived` is a known field of kind `flag`: `true` is stored, anything else is `field_value_invalid`; clearing
  removes the key. `isArchived(item)`.
- `projectBoard` skips archived items on an ordinary board (columns, unplaced, counts); with `setup.archive`
  it takes only archived items, all into `columns[0]`. `normaliseBoardSetup` keeps `archive: true` only.
- Preset `archive`: one column `archived` "Archived", Compact cards, widgets count, types, filter.
- Board drop: onto an Archive board patches `{ set: { archived: true } }` (status kept; its own cards do not
  reorder); off one onto another board moves, then patches `{ clear: ['archived'] }`. An Archive board refuses
  palette cards and has no Add Card.
- Card Finder (`card-finder.ts`, items.md "Finding a card"): `findCards(items, { query, show, boardStatuses, types?,
typeLabel? })` keeps live cards of any type id (no catalogue filter), narrowed to `types` when non-empty;
  `cardMatches(item, query, typeLabel?)` also matches the type's name. `CardFinderPanel` holds the pressed types in
  component state and counts from the type-narrowed list.

## Data and persistence: D1

Migration `apps/api/migrations/0071_items.sql`:

```sql
CREATE TABLE items (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  item_key INTEGER NOT NULL,
  rank TEXT NOT NULL,
  fields TEXT NOT NULL,            -- JSON object
  rev INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL,   -- JSON ItemPerson
  PRIMARY KEY (document_id, id)
);
CREATE UNIQUE INDEX items_document_key ON items(document_id, item_key);
ALTER TABLE documents ADD COLUMN items_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN items_next_key INTEGER NOT NULL DEFAULT 1;
```

- Field classification: `fields` is user content (never logged); `created_by`/`updated_by` display identity;
  the rest structural.
- Cascade removes items on hard delete (`documentRemovalStatements` needs no new statement).
- `copyDocument` copies items verbatim to the new document id and copies `items_rev`/`items_next_key`.
- Writes: one D1 `batch` per write: `UPDATE documents SET items_rev = items_rev + 1 [, items_next_key = ...]
WHERE id = ? RETURNING items_rev, items_next_key`, then the row write guarded by `rev = ?` (update) or
  `INSERT` (create). A lost `rev` race retries up to `ITEM_WRITE_RETRIES` from a fresh read, then `409 item_busy`.
- `apps/api/src/db/items.ts`: `listItems`, `readItem`, `insertItem`, `updateItem`, `deleteItem`, `copyItems`,
  `insertItemsBulk`; `item-row.ts`: row ↔ `Item`.

## Interfaces and contracts: REST

All under `/documents/:id/items`, auth `guest-or-clerk`, token-usable, registered in `openapi/manifest.ts`
(tag `Items`), DTOs in `packages/api-schema/src/items.ts` (`ItemsResponse { items, rev }`, `ItemResponse { item, rev }`).

| Method | Path                  | Gate | Body                                                         | Answers             |
| ------ | --------------------- | ---- | ------------------------------------------------------------ | ------------------- |
| GET    | `/items[?tabId=]`     | read |                                                              | `ItemsResponse`     |
| POST   | `/items`              | edit | `ItemCreate`                                                 | 201 `ItemResponse`  |
| POST   | `/items/bulk`         | edit | `{ items: ItemCreate[] }` ≤ `ITEM_BULK_MAX`                  | 201 `ItemsResponse` |
| POST   | `/items/patches`      | edit | `{ items: ({ id } & ItemPatch)[], undo? }` ≤ `ITEM_BULK_MAX` | `ItemsResponse`     |
| POST   | `/items/:itemId`      | edit | `ItemPatch`                                                  | `ItemResponse`      |
| POST   | `/items/:itemId/move` | edit | `ItemMove`                                                   | `ItemResponse`      |
| POST   | `/items/tally`        | edit | `{ items: { id, votes }[] }` ≤ `ITEM_BULK_MAX`               | `ItemsResponse`     |
| DELETE | `/items/:itemId`      | edit |                                                              | 204                 |

Comment writes (below, "Comments") add four more under `/items/:itemId/comments`.

- Tab-scoped grants: GET requires `tabId` matching the grant and filters to `itemIdsShownOnTab` of that tab's
  stored elements; writes require `tabId` (query) and the target id in that set (create: always allowed into the
  tab's scope).
- Rejections: `400 { error: ItemRejection }`, `404 item_not_found`, `409 item_exists` (create with a taken id),
  `409 item_busy`, `413 items_full`, plus the document gates' 403/404/410.
- `ItemCreate.key` is honoured only when `< items_next_key` and free; otherwise the store assigns one.
- `POST /documents` create body accepts `items?: ItemCreate[]` (sync to cloud), written in the
  same request after the tabs.
- The patch is a POST: the api's CORS admits GET, POST, PUT and DELETE only.
- `/items/patches` changes many items at once (a type's or a removed column's cards sent to the Trash): every id
  must exist (`404 item_not_found`, and in a tab-scoped grant be in scope), each patch is validated as a single
  one is, and every resulting item is checked (`status_excluded` unless `undo`, the field bounds) before anything
  is written, so one refusal refuses the whole request, naming the item (`{ error, field?, id }`). The updates go
  in one D1 batch, each guarded by the rev read, with one `items_rev` raise; an item a concurrent write moved on
  is read again and retried (`ITEM_WRITE_RETRIES`), the rest kept. One room op relays every changed item. Logs
  `[items] patched` with the count.
- Routes live in `apps/api/src/routes/item-routes.ts` (`/items/patches` in `item-patches-route.ts`, the parts they
  share, such as the caller, refusals and relay, in `item-route-kit.ts`), dispatched from
  `document-subresource-routes.ts`; `db/items.ts` holds `readItems` and `updateItemsAtRev` for the many-item write.

## Comments

A card's thread (spec items.md "Comments") is the canvas's `CommentThread` in `fields.comments`.

- **Ops** (`packages/document/src/comment-thread.ts`, pure, type-only imports): `threadWithComment(thread,
comment, max)` (append unless present or full, `resolved: false`), `threadWithoutComment(thread, id)` (the last
  takes the thread: `undefined`), `threadResolved(thread, resolved)`. Each returns the same thread when nothing
  changes. `applyElementDelta`'s comment cases call them.
- **Item writes** (`packages/document/src/item-comments.ts`; `@livediagram/document` already reads items, the
  reverse would cycle): `ItemCommentChange = add { comment } | remove { commentId } | resolve { resolved }`;
  `applyItemComment(item, change, ctx)` returns `{ ok, item }` (rev + 1, `updatedAt/By`) or a refusal:
  `comments_full` (count ≥ `ITEM_COMMENTS_MAX`, or the thread past `ITEM_COMMENTS_BYTES`), `comment_not_found`,
  `unchanged`. `itemThread(item)` reads a valid thread or `undefined`.
- **Redaction**: `itemForViewer(item, owner)` keeps `authorId`/`tokenId` on the viewer's own comments only;
  `itemForRoom(item)` strips all; `keepOwnCommentAuthors(local, incoming)` carries our author ids onto a room copy.
  `readRestoredThread(raw, owner)` validates a restore's thread: author id kept only when it is the caller's,
  token ids dropped, mentions `sanitizeMentions`; `null` when not a thread.
- **Items package**: `ItemFieldId` `comments`, kind `comments`; `validateFields` / `validateClear` refuse it;
  `ItemCreate.comments` (restore) set by `makeItem`; `itemAsCreate` moves it out of `fields`; `itemCommentCount`;
  `BUILT_IN_FIELD_IDS` (before votes); `tabsOf`'s default Overview ends with it; every built-in type offers it
  last (`ITEM_TYPES` maps `BUILT_IN_TYPES`); card field `comments` (after checklist; Compact and Detailed; in
  `DEFAULT_CARD_FIELDS` and the work presets).
- **REST** (`apps/api/src/routes/item-comment-routes.ts`, dispatched by `handleItemRoutes` on
  `segments[5] === 'comments'`; each is a `writeItem`, so rev-guarded and relayed):

  | Method | Path                                 | Gate                      | Body                  | Answers                        |
  | ------ | ------------------------------------ | ------------------------- | --------------------- | ------------------------------ |
  | POST   | `/items/:itemId/comments`            | participate               | `{ text, mentions? }` | `ItemResponse`                 |
  | DELETE | `/items/:itemId/comments/:commentId` | participate; own, or edit | none                  | `ItemResponse`                 |
  | POST   | `/items/:itemId/comments/resolve`    | participate               | none                  | `ItemResponse`, 204 if already |
  | POST   | `/items/:itemId/comments/reopen`     | participate               | none                  | `ItemResponse`, 204 if already |

  The comment is made by `newComment` (comment-routes.ts: text trimmed, ≤ `COMMENT_TEXT_MAX`, author name,
  colour and id from the caller, token id for an agent); a post runs `afterCommentPosted` (timeline, owner email);
  a resolve records `recordCommentResolved` keyed `<doc>:item:<itemId>`. Refusals: 400 text, 403 another's
  comment, `404 comment_not_found`, `404 item_not_found`, `413 comments_full`, 409 `item_busy`.

- **Every item answer** (list, create, bulk, patch, move, vote, comment) is `itemForViewer(item, caller.owner)`;
  **every relay** is `itemForRoom`. A create's `comments` passes `readRestoredThread(raw, caller.owner)` (bad:
  `field_value_invalid`). A Community copy writes items with `json_remove(fields, '$.comments')`.
- **Editor**: `writeItemComment(scope, itemId, action, { ownerId, by })` in `lib/api/items.ts`
  (`ItemCommentAction = add { text, mentions? } | delete { commentId } | resolve { resolved }`; 204 → `null`);
  offline, `offlineWriteItemComment` applies `applyItemComment` to the record. `usePlanItems.comment(itemId,
action)` tracks `Comment · Added|Deleted|Resolved|Unresolved · Item`, applies locally, sends, merges the answer;
  a refusal toasts ("This card holds the most comments it can", else "Couldn't save that comment") and refetches.
  An `add` with mentions that the api accepted then calls `opts.onMentioned(text, mentions, itemId)`, which the
  editor wires to `useCommentMentions.notifyMentioned` (`Comment · Mentioned`, then `apiNotifyMention` with
  `itemId`, so the email opens the card).
- **Activity**: `readActivity` adds `cardThreads` from `CARD_THREADS_SQL` (`db/plan-card-threads.ts`), the card
  placement shared with `CARDS_SQL` (`itemPlacementCtes` in `db/plan-board-index.ts`). `useActivityFeed` merges them
  into `threads` as `{ kind: 'card' }` rows ordered by latest comment; `ActivityPane` draws them with
  `ActivityCardThreadRow`, linking `cardDeepLinkHref`.
  `receive` runs `keepOwnCommentAuthors` before `mergeItemChanges`. `PlanContext.commentItem` and `ownerId`;
  `PlanSheetsHost` hands `ItemPanel` `comments: { canComment: canVote, selfId: ownerId, onComment }`;
  `ItemFieldEditor` draws `ItemComments` for `comments`, from the shared `comment-thread-parts.tsx`
  (`CommentThreadList`, `CommentComposer`, `CommentResolveToggle`, also used by `CommentThreadPopover`).
  `PlanCardFace` draws the count (`CommentIcon` and the number, label "n comments") when the field is shown and
  the count is above 0.

## Live: room op

`packages/api-schema/src/room-messages.ts` adds
`{ kind: 'items'; upserts: Item[]; removed: string[]; rev: number }`, a system kind (dropped from client sockets).
Sent by `relayItems(env, docId, op)` in `room-client.ts` through `/broadcast` with `ordered: true` after each
successful write. `room-scope.ts` hands a tab-scoped session the op with empty `upserts` and `removed`; its client
refetches. Presence on cards is a separate ephemeral op, `plan-presence` (`{ tabId, itemId | null, state }`), in
`PRESENCE_OP_KINDS`.

## Editor slice

- `apps/live/lib/api/items.ts`: `fetchItems(scope)` and `writeItem(scope, write, by)` (one `ItemWrite`: create,
  patch, patches, move, vote, delete; a create of many goes to `/items/bulk` and a patch of many to
  `/items/patches`, each in batches of `ITEM_BULK_MAX`); each dispatches
  `isOfflineId(docId)` to `lib/offline/offline-items.ts`, which applies `applyItemWrite` to the record's store
  inside `serializeOfflineWrite`.
- `apps/live/hooks/plan/usePlanItems.ts`: `{ store, items, status, self, write, receive, refetch }`. `self` is the
  person with the hashed id (`itemPersonId` of the editor's self id, the id the api resolves as owner).
  - Optimistic: a write applies `applyItemWrite` locally (creates carry client-made ids, `withCreateIds`), sends,
    then merges the answer. A failed write refetches the store and toasts "Couldn't save that change".
  - Room op `items`: `mergeItemChanges` keeps the higher `rev` per item; `removed` deletes; a rev past
    `serverRev + 1`, or an op with no items (a tab-scoped session), refetches (`ITEM_REFETCH_DEBOUNCE_MS`). Room
    resync and reconnect (`onRoomJoined`) refetch.
- `apps/live/hooks/plan/usePlanSlice.ts` composes the board actions into `PlanContext`; `usePlanPresence` sends
  and hears `plan-presence`.
- Offline record: `OfflineDocumentRecord.items?`, `itemsRev?`, `itemsNextKey?`.
- Sync to cloud sends `storeAsCreates(items)` (column order kept, votes carried); Take offline fetches the store
  first and aborts without it; Duplicate copies it (cloud: the create body; offline: the new record); the Drive
  mirror's `DocumentEnvelope.document.items` (optional, so the file stays version 1).

## Undo

`useDocumentHistory` keeps two counters beside its snapshots: `depth` (steps behind the present, uncapped) and
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
| Create at the cap                               | `413 items_full`; toast "This document holds 2,000 items"             |
| Comment on a full thread                        | `413 comments_full`; toast "This card holds the most comments it can" |
| Delete a comment already gone                   | `404 comment_not_found`; the store refetches                          |
| Resolve a resolved thread                       | 204, nothing written or relayed                                       |
| Room copy lands after our answer                | Our own comments keep their author id (`keepOwnCommentAuthors`)       |
| A type stops offering comments                  | The thread stays stored, unshown (like votes)                         |
| Room op arrives before the GET answer           | Kept; GET merges by higher rev                                        |
| Offline record without `items`                  | Empty store                                                           |

## Security and trust

- Every write passes the document gate; tab-scoped links are confined by `itemIdsShownOnTab`.
- Items never change from a client socket; `items` is a system op.
- Field values are validated and bounded; text is drawn as text, never HTML.
- Vote budget is a facilitation aid enforced in the editor only (stated, not a trust boundary).
- People on items (authors, voters) are keyed by `itemPersonId`, a one-way hash: a guest's owner id is their
  credential and never reaches an item.
- Hide writing hides faces only; the api returns full items to anyone who may read.
- Comment author ids are owner ids (a guest's credential): they reach only their author (`itemForViewer`), never
  the room (`itemForRoom`), and a restore cannot claim someone else's (`readRestoredThread`). Author name and
  colour are stamped server-side from the caller.

## Performance and limits

- Worst case 2,000 items × 16 KB = 32 MB is refused by the GET's practical size: `ITEMS_MAX` × typical 0.5 KB
  = 1 MB; the GET streams one JSON array. The per-item cap bounds the row; D1's 1 MB row limit is never reached.
- Projection is O(n log n) per board render, memoised on `(setup, items map identity)`.
- Changing many cards at once (`patches`) is one request per `ITEM_BULK_MAX` cards and one D1 batch, never a
  request per card; a type with 2,000 cards is 10 requests.
- Room op carries only the changed items. A card with a long thread (up to `ITEM_COMMENTS_BYTES`, 128 KB) sends
  its whole thread with every write to it: typical threads are a few KB; the cap bounds the worst case.

## Observability

Log fingerprints (console, `[items]`): `items.write.retry`, `items.write.busy`, `items.rejected <error>`,
`items.refetch.gap`, `items.offline.write`, `items.offline.comment`, `items.comment.failed` (editor),
`comment added`, `comment deleted`, `comments resolved|reopened|unchanged`, `comments.full` (api). Api logs never
include `fields` or comment text.

## Testing

| Rule                                           | Test                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Validation per kind, every rejection           | `packages/items/src/fields.test.ts`                                                              |
| Rank always between, stable under repeats      | `rank.test.ts` (property: 1,000 random inserts)                                                  |
| apply functions                                | `apply.test.ts`                                                                                  |
| Projection: columns, lanes, unplaced, quick    | `board.test.ts`                                                                                  |
| Tab-scoped set                                 | `tab-items.test.ts`                                                                              |
| Routes: gates, rejections, keys, cascade, copy | `apps/api/src/routes/item-routes.test.ts`                                                        |
| Room op redacted for a tab-scoped session      | `apps/api/src/room-scope.test.ts`                                                                |
| Store transitions, inverses, sync order        | `packages/items/src/store.test.ts`                                                               |
| Undo interleaving                              | `apps/live/hooks/plan/item-undo-journal.test.ts`                                                 |
| Agent verbs and tools                          | `agent-verbs/src/verbs/item.test.ts`, `apps/mcp/src/output-schema.test.ts`                       |
| Offline store                                  | `apps/live/lib/offline/offline-items.test.ts`                                                    |
| Comments field: read-only, budget, restore     | `packages/items/src/comments-field.test.ts`                                                      |
| Thread ops, item writes, redaction, restore    | `packages/document/src/item-comments.test.ts`                                                    |
| Comment routes: gates, own/edit delete, relay  | `apps/api/src/routes/item-comment-routes.test.ts`                                                |
| Editor comment writes, room merge, refusals    | `apps/live/hooks/plan/usePlanItems.comments.test.ts`, `apps/live/lib/api/items-comments.test.ts` |
| Panel thread and card count                    | `apps/live/components/plan/ItemComments.test.tsx`                                                |

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
