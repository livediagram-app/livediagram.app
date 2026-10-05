# Item store blueprint

Derived from [Items](../items.md). Implementation contract for the `@livediagram/items` package, the api's item
store, the room op, and the editor's item slice.

## Domain and naming

| Spec term     | Identifier                                                     |
| ------------- | -------------------------------------------------------------- |
| item          | `Item` (`packages/items/src/item.ts`)                          |
| item type     | `ItemTypeDef`, catalogue `ITEM_TYPES`, id `ItemTypeId`         |
| field         | a key of `Item.fields` (`ItemFields`); kinds `ItemFieldKind`   |
| item store    | D1 table `items`; editor slice `usePlanItems`                  |
| item key      | `Item.key` (number), drawn `#${key}`                           |
| rank          | `Item.rank` (string), made by `rankBetween`                    |
| status        | `fields.status` (string)                                       |
| person        | `ItemPerson { id, name, color }`                               |

## Package `@livediagram/items` (pure, no DOM, no dependencies)

```
src/item.ts          Item, ItemFields, ItemFieldValue, ItemPerson, ItemCreate, ItemPatch, ItemMove
src/item-types.ts    ITEM_TYPES, itemTypeOf(id) (unknown -> fallback def), ItemTypeId
src/fields.ts        KNOWN_FIELDS (field -> kind), PRIORITIES, validateFields, validateFieldKey
src/limits.ts        named constants (Constants table)
src/rank.ts          rankBetween(a, b), rankAfter(a), rankBefore(b), compareRank
src/apply.ts         makeItem, applyPatch, applyMove, applyVote (shared by api and offline store)
src/quick-add.ts     parseQuickAdd(text, types) -> { title, type?, fields, tokens }
src/board.ts         PlanBoardSetup, PlanColumn, SwimlaneBy, projectBoard, boardScopeMatches
src/tab-items.ts     itemIdsShownOnTab(elements, items)
src/views.ts         itemSummary(item) one-line text for views and announcements
src/index.ts
```

### Types

```ts
type ItemFieldValue = string | number | boolean | null | ItemFieldValue[] | { [k: string]: ItemFieldValue };
type ItemFields = Record<string, ItemFieldValue>;
interface ItemPerson { id: string; name: string; color: string }
interface Item {
  id: string; type: string; key: number; rank: string; fields: ItemFields; rev: number;
  createdAt: number; updatedAt: number; createdBy: ItemPerson; updatedBy: ItemPerson;
}
interface ItemCreate { id?: string; type: string; fields: ItemFields; place?: ItemPlace; key?: number }
interface ItemPlace { status?: string; after?: string | null; before?: string | null }
interface ItemPatch { set?: ItemFields; clear?: string[]; type?: string }
interface ItemMove extends ItemPlace { set?: ItemFields }   // set: a swimlane's field on a lane drop
```

- `ItemCreate.key` is accepted only to restore a deleted item (undo); see the api rules.
- `ItemMove.set` may hold only `assignee`, `priority`, `parent` or `type`-less fields named by `SWIMLANE_FIELDS`.

### Validation (`validateFields(fields, mode)`)

Returns `{ ok: true, fields }` or `{ ok: false, error: ItemRejection, field }`. Rejections are a closed union:
`title_required`, `title_too_long`, `field_key_invalid`, `field_value_invalid`, `fields_too_many`,
`fields_too_large`, `votes_read_only`, `type_invalid`, `id_invalid`, `place_invalid`.

| Kind      | Accepts                                                              |
| --------- | -------------------------------------------------------------------- |
| text      | string, trimmed, 1..`ITEM_TITLE_MAX` (title); empty title rejected   |
| long text | string ≤ `ITEM_DESCRIPTION_MAX`                                      |
| status    | string ≤ 40                                                          |
| person    | `{ id ≤ 64, name ≤ 80, color #rrggbb }`                              |
| priority  | one of `PRIORITIES`                                                  |
| labels    | ≤ `ITEM_LABELS_MAX` strings ≤ 32, de-duplicated                      |
| number    | finite, 0..999                                                       |
| date      | `YYYY-MM-DD` that parses                                             |
| checklist | ≤ `ITEM_CHECKLIST_MAX` rows `{ text ≤ 200, done boolean }`           |
| item ref  | id string matching `ITEM_ID_PATTERN`                                 |
| votes     | rejected in create/patch (`votes_read_only`)                         |
| unknown   | scalar, or array of ≤ 50 scalars; strings ≤ 2,000                    |

- Keys match `ITEM_FIELD_KEY_PATTERN`; at most `ITEM_FIELDS_MAX` keys; serialised fields ≤ `ITEM_FIELDS_BYTES`.
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

- `PlanBoardSetup = { title; columns: PlanColumn[]; doneColumnId?; swimlaneBy: SwimlaneBy; scope: BoardScope;
  cardFields: CardField[]; voting: { on: boolean; budget?: number }; hideWriting: boolean }`.
- `PlanColumn = { id; status; name; wipLimit?; color? }`; `SwimlaneBy = 'none' | 'assignee' | 'type' | 'priority' | 'parent'`.
- `BoardScope = { types?: string[]; label?: string }` (absent = all).
- Output: `{ columns: { column, count, overLimit, lanes: { laneKey, items[] }[] }[], lanes: LaneHead[],
  unplaced: Item[], doneCount, total }`. Items sorted by `compareRank`, then `key`. Lanes ordered: assignee by
  name, type by catalogue order, priority by `PRIORITIES`, parent by key; the empty group last.
- `quick = { text?: string; mine?: string }` narrows (title/key/labels substring; `mine` = assignee id).

### Tab items (`itemIdsShownOnTab`)

Union of every `plan-card`'s `planCard.itemId` and every item any `plan-board` on the tab scopes (columns or
unplaced). Structural input `{ shape?: string; planBoard?: PlanBoardSetup; planCard?: { itemId: string } }[]`.

## Data and persistence: D1

Migration `apps/api/migrations/0068_items.sql`:

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

| Method | Path                          | Gate        | Body                    | Answers                     |
| ------ | ----------------------------- | ----------- | ----------------------- | --------------------------- |
| GET    | `/items[?tabId=]`             | read        |                         | `ItemsResponse`             |
| POST   | `/items`                      | edit        | `ItemCreate`            | 201 `ItemResponse`          |
| POST   | `/items/bulk`                 | edit        | `{ items: ItemCreate[] }` ≤ `ITEM_BULK_MAX` | 201 `ItemsResponse` |
| PATCH  | `/items/:itemId`              | edit        | `ItemPatch`             | `ItemResponse`              |
| POST   | `/items/:itemId/move`         | edit        | `ItemMove`              | `ItemResponse`              |
| POST   | `/items/:itemId/vote`         | participate | `{ delta: 1 \| -1 }`    | `ItemResponse`              |
| DELETE | `/items/:itemId`              | edit        |                         | 204                         |

- Tab-scoped grants: GET requires `tabId` matching the grant and filters to `itemIdsShownOnTab` of that tab's
  stored elements; writes require `tabId` (query) and the target id in that set (create: always allowed into the
  tab's scope).
- Rejections: `400 { error: ItemRejection }`, `404 item_not_found`, `409 item_exists` (create with a taken id),
  `409 item_key_taken`, `409 item_busy`, `413 items_full`, plus the document gates' 403/404/410.
- `ItemCreate.key` is honoured only when `< items_next_key` and free; otherwise the store assigns one.
- `POST /documents` create body accepts `items?: ItemCreate[]` (sync to cloud, template seeds), written in the
  same request after the tabs.
- Routes live in `apps/api/src/routes/item-routes.ts`, dispatched from `document-subresource-routes.ts`.

## Live: room op

`packages/api-schema/src/room-messages.ts` adds
`{ kind: 'items'; upserts: Item[]; removed: string[]; rev: number }`, a system kind (dropped from client sockets).
Sent by `relayItems(env, docId, op)` in `room-client.ts` through `/broadcast` with `ordered: true` after each
successful write.

## Editor slice

- `apps/live/lib/api/items.ts`: `fetchItems`, `createItem`, `createItems`, `patchItem`, `moveItem`, `voteItem`,
  `deleteItem`; each dispatches `isOfflineId(docId)` to `lib/offline/offline-items.ts`, which applies the same
  `apply.ts` functions to the record's `items` array inside one IndexedDB transaction.
- `apps/live/hooks/plan/usePlanItems.ts`: `{ items: Map<string, Item>, rev, ready, actions }`.
  - Optimistic: an action applies `apply.ts` locally with a client-made id, sends, then replaces with the
    answer. A failed write reverts that item and toasts "Couldn't save that change".
  - Room op `items`: per item, keep the higher `rev`; `removed` deletes; `rev > known + 1` schedules a refetch
    (`ITEM_REFETCH_DEBOUNCE_MS`). Room resync and reconnect refetch.
- Offline record: `OfflineDocumentRecord.items?: Item[]`, `items_next_key` kept as `itemsNextKey?`.
- Sync to cloud sends `items`; Take offline fetches them first; client duplicate of an offline document copies
  them; JSON export `DocumentEnvelope.document.items` (schema version bump, absent = none).

## Undo

`useDocumentHistory` steps become `{ tabs: Tab[]; external?: ExternalStep }`. `pushExternal(step)` pushes a step
whose tabs are the present; undoing an external step keeps the present tabs and runs `step.undo()`; redo runs
`step.redo()`. Item actions push `{ undo, redo }` closures that issue the inverse writes (patch back the old
values of the changed keys; move back to the old status and between the old neighbours; delete ↔ create with
the same id and key). Votes push nothing.

## Errors and edge cases

| Case                                              | Handling                                                       |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Unknown type                                      | Kept; drawn with the fallback type (grey, generic glyph)        |
| Card points at a missing item                     | "Item not found" face                                           |
| Move relative to a neighbour that was deleted     | Falls back to the column end                                    |
| Undo patch after someone else changed the field   | Writes the old value anyway (last write wins), as canvas undo  |
| Create at the cap                                 | `413 items_full`; toast "This document holds 2,000 items"      |
| Room op arrives before the GET answer             | Kept; GET merges by higher rev                                 |
| Offline record without `items`                    | Empty store                                                    |

## Security and trust

- Every write passes the document gate; tab-scoped links are confined by `itemIdsShownOnTab`.
- Items never change from a client socket; `items` is a system op.
- Field values are validated and bounded; text is drawn as text, never HTML.
- Vote budget is a facilitation aid enforced in the editor only (stated, not a trust boundary).
- Hide writing hides faces only; the api returns full items to anyone who may read.

## Performance and limits

- Worst case 2,000 items × 16 KB = 32 MB is refused by the GET's practical size: `ITEMS_MAX` × typical 0.5 KB
  = 1 MB; the GET streams one JSON array. The per-item cap bounds the row; D1's 1 MB row limit is never reached.
- Projection is O(n log n) per board render, memoised on `(setup, items map identity)`.
- Room op carries only the changed items.

## Observability

Log fingerprints (console, `[items]`): `items.write.retry`, `items.write.busy`, `items.rejected <error>`,
`items.refetch.gap`, `items.offline.write`. Api logs never include `fields`.

## Testing

| Rule                                       | Test                                                   |
| ------------------------------------------ | ------------------------------------------------------ |
| Validation per kind, every rejection       | `packages/items/src/fields.test.ts`                    |
| Rank always between, stable under repeats  | `rank.test.ts` (property: 1,000 random inserts)        |
| apply functions                            | `apply.test.ts`                                        |
| Quick add tokens                           | `quick-add.test.ts`                                    |
| Projection: columns, lanes, unplaced, quick| `board.test.ts`                                        |
| Tab-scoped set                             | `tab-items.test.ts`                                    |
| Routes: gates, rejections, keys, cascade, copy | `apps/api/src/routes/item-routes.test.ts`         |
| Room op system-only                        | `document-room.test.ts` addition                       |
| History external steps                     | `useDocumentHistory.test.ts` addition                  |
| Offline store                              | `apps/live/lib/offline/offline-items.test.ts`          |

## Constants and configuration

| Constant                  | Value  | Provenance / safe range                                  |
| ------------------------- | ------ | -------------------------------------------------------- |
| `ITEMS_MAX`               | 2000   | Spec; a board past a few hundred cards stops being read  |
| `ITEM_FIELDS_BYTES`       | 16384  | Spec; 4 KB–64 KB                                         |
| `ITEM_FIELDS_MAX`         | 64     | Spec                                                     |
| `ITEM_TITLE_MAX`          | 200    | Spec                                                     |
| `ITEM_DESCRIPTION_MAX`    | 10000  | Spec                                                     |
| `ITEM_LABELS_MAX`         | 12     | Spec                                                     |
| `ITEM_CHECKLIST_MAX`      | 50     | Spec                                                     |
| `ITEM_BULK_MAX`           | 200    | Template seeds are ≤ 40; sync of a big offline doc batches |
| `ITEM_WRITE_RETRIES`      | 3      | As changesets' retry                                      |
| `ITEM_REFETCH_DEBOUNCE_MS`| 400    | Coalesces a burst of gaps                                 |
| `ITEM_ID_PATTERN`         | `/^[A-Za-z0-9_-]{6,32}$/` | Client ids are 12-char nanoid-style      |
| `ITEM_FIELD_KEY_PATTERN`  | `/^[A-Za-z0-9_-]{1,40}$/` | Spec                                     |
