# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Retention](../images.md#retention-unused-image-cleanup) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/api/`):

| File                                    | Role                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/image-refs/extract.ts`             | The JavaScript extractor: what a reference is                                               |
| `src/db/image-refs.ts`                  | The writers' statements, and the document's own reads (its set; whether it places an image) |
| `src/db/images.ts`                      | The usage map, reading D1's `document_images`                                               |
| `src/db/tabs.ts`                        | `upsertTab`, `seedTabs`, `swapTabData` carry index statements; `deleteTabRow` cascades      |
| `src/document-room/document-content.ts` | `importDocumentCopy` indexes a copy from its bodies                                         |
| `src/document-room/document-schema.ts`  | `image_refs`, and the outbox triggers that key a change to it                               |
| `src/document-room/document-outbox.ts`  | The push: `document_images`, the media queue and the placement grants, one D1 batch         |
| `src/db/document-removal.ts`            | `documentRemovalStatements` deletes the document's `document_images` and grants             |
| `src/image-refs/writer-census.test.ts`  | Fails when SQL writing `tabs` appears outside the known writers                             |

## Domain and naming

| Term          | Identifier                                          | Meaning                                                                     |
| ------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Reference     | row of `image_refs` `(tab_id, image_id)`            | Tab `tab_id` places gallery image `image_id` (in the document's own SQLite) |
| Document set  | rows of `document_images` `(document_id, image_id)` | Every image the document places, as its last push left it (D1)              |
| Gallery id    | `isGalleryImageId(value)`                           | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed |
| Reference ids | `imageRefIds(elements)`                             | Distinct gallery ids of top-level `type: 'image'` elements, document order  |
| Text scan     | `imageRefIdsFromText(data)`                         | Gallery ids after every `"imageId"` key in a body that isn't valid JSON     |
| Body ids      | `imageRefIdsFromData(data)`                         | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan |

Banned synonyms: "image usage table", "image links", "refcount". A reference is never counted, only present or absent.

## Behaviour and state

### Writers

Each writer appends statements to the batch that writes the body, one transaction in the document's object.

| Writer               | Statements, in the body's batch                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `upsertTab`          | `imageRefReplaceStatements(env, id, imageRefIds(tab.elements))`                                              |
| `seedTabs`           | the same, per seeded tab                                                                                     |
| `importDocumentCopy` | per copied tab: `INSERT OR IGNORE` of `imageRefIdsFromData(data)` under the fresh tab id                     |
| `swapTabData`        | batch `[UPDATE tabs … WHERE data = ?, ...imageRefAddStatements(nextData ids)]`; result 0's `changes` decides |
| `deleteTabRow`       | none: the tab's references go with it (`ON DELETE CASCADE`)                                                  |

`imageRefReplaceStatements(env, tabId, ids)`, with `ids` bound as one JSON array:

1. `DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`
2. `imageRefAddStatements`: when `ids` is non-empty,
   `INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)`

A save whose image set is unchanged deletes nothing and inserts nothing, so it keys nothing in the outbox.

### The push

A trigger on `image_refs` (insert, delete) and on `document_tabs` (insert, delete; a tab's references find their
document through its link, which a create writes after the tab and a delete removes before it) keys `images` in the
document's outbox, in the writer's transaction. The drain (`drainOutbox`) reads the document's set
(`documentImageIds`) and appends to its one D1 batch, in order:

1. `mediaRefQueueSetStatement(env, documentId, ids)`: queues the document for the media service when the set differs
   from its `document_images` rows ([Images](images.md#retention)).
2. `DELETE FROM document_images WHERE document_id = ?`, then one `INSERT` of the set.
3. `imageGrantPlacementStatements(env, documentId, ids, now)`.

### Extraction in SQL

`indexTabsSql(tabWhere)` is one `INSERT OR IGNORE INTO image_refs (tab_id, image_id)` over `tabs t` filtered by
`tabWhere`, joined to `json_each(<source>, '$.elements') e`, keeping rows where `e.type = 'object'`,
`json_extract(e.value, '$.type') = 'image'`, `json_type(e.value, '$.imageId') = 'text'`, the id's length is 1 to
`IMAGE_REF_ID_MAX_LENGTH` and it does not start with `data:`. `<source>` is a `CASE` giving `'{}'` when `t.data` lacks
`"imageId"` (`instr`), is not valid JSON, or has no `elements` array, else `t.data`. The `CASE` is what stops a corrupt
body failing the statement whatever order SQLite evaluates the join in, and keeps `json_each` off image-free tabs
(D1 bills each element it walks). Three statements use it:

| Statement                        | `tabWhere`                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `imageRefIndexPageStatement`     | `t.rowid > ?1 AND t.rowid <= ?2`                                                                                   |
| `imageRefIndexOwnerStatement`    | `t.id IN (SELECT dt.tab_id FROM document_tabs dt JOIN documents d ON d.id = dt.document_id WHERE d.owner_id = ?1)` |
| `imageRefIndexDocumentStatement` | `t.id IN (SELECT tab_id FROM document_tabs WHERE document_id = ?1)`                                                |

### Backfill

States: `settling` (`now - created_at < IMAGE_REFS_BACKFILL_SETTLE_MS`), `running`, `complete`.
`runImageRefsBackfill(env, now, clock = Date.now)`:

1. Missing row: warn, `restartImageRefsBackfill(env, now)`, return `settling`.
2. `completed_at` set: return `complete`. Settling: log, return `settling`.
3. Loop while `clock() - start < IMAGE_REFS_BACKFILL_BUDGET_MS`:
   1. `max = maxTabRowId(env)` (0 when `tabs` is empty).
   2. `cursor >= max`: `completeImageRefsBackfill(env, now)`, log, return `complete`.
   3. `to = min(cursor + IMAGE_REFS_BACKFILL_PAGE_ROWS, max)`.
   4. Corrupt tabs in `(cursor, to]` that mention `"imageId"`, one at a time (`nextCorruptTabMentioningImages`,
      keyset on `rowid`, `LIMIT 1`): `imageRefBackfillAddStatements(imageRefIdsFromText(data))` (the inserts
      without the media queue), warn.
   5. One batch: `[imageRefIndexPageStatement(cursor, to), imageRefsBackfillAdvanceStatement(to)]`.
4. Budget spent: log the range, return `running`.

The cursor moves only in the batch that indexes its page, so a failed run redoes that page. `MAX(rowid)` is re-read each
page, so tabs created meanwhile are reached.

`isImageRefIndexComplete(env)` is true only for a row with `completed_at` set, then memoised in a module variable for
the isolate's life (`D2`); `resetImageRefIndexMemo()` clears it for tests.

`runImageRetention(env, now)` (the cron's entry): the backfill, catching and logging a throw; then
`deleteOldUnusedImages(env, now - UNUSED_IMAGE_RETENTION_MS)`, logging its count or its throw. It never rejects.

### Readers

**Usage** `imageUsageByOwner(env, ownerId)`:
`SELECT DISTINCT r.image_id, d.id, d.name FROM documents d JOIN document_images r ON r.document_id = d.id WHERE d.owner_id = ? ORDER BY d.name, d.id`
(`D3`), folded into `Record<imageId, { id, name }[]>`.

**Share read**, two questions asked in parallel by the byte route (`routes/images.ts`):

- `documentPlacesImage(env, documentId, imageId, onlyTabId)` (`db/image-refs.ts`), through the `placesImage` RPC: the
  document places the image (`document_tabs` ⋈ `image_refs`, `[AND dt.tab_id = ?]`), answered from its own SQLite,
  so a placement serves before any push.
- `documentMayServeImage(env, documentId, imageId)` (`db/image-grants.ts`): one D1 query, `SERVES`, where
  `SERVES = i.owner_id = d.owner_id OR EXISTS (SELECT 1 FROM image_grants g WHERE g.document_id = d.id AND g.image_id = i.id) OR ENTITLED`,
  `ENTITLED` being the placement writer's condition below at the current time, and `i` the image's `media_images` row
  (whose it is, as this api names owners; [Images](images.md#data-and-persistence)).

An image with no `media_images` row serves nowhere and earns no grant until this api meets it (an upload, a gallery
list, or the first byte read, which fills the row). A refusal logs `[images] not servable by document` with the
document and image ids.

**Render read** `servableImageIds(env, documentId, ids)`: of a tab's ids, those `SERVES` admits, one query over a
bound JSON array. `thumbnail.ts` `loadEmbeddedImages` reads the media service only for those; the rest keep the placeholder.

### Placement grants

`image_grants (document_id, image_id, created_at)`, primary key `(document_id, image_id)`, `WITHOUT ROWID`, no
foreign keys (migration 0075, which also grants every reference that already crossed owners).

- **Placement writer** `imageGrantPlacementStatements(env, documentId, ids, now)`, run by the push with the
  document's whole set: `INSERT OR IGNORE` one row per placed image where `i.owner_id <> d.owner_id` AND (a
  `team_members` row with `team_id = d.team_id`, `user_id = i.owner_id`, `status = 'joined'`, OR a `shared_with` row
  with `owner_id = i.owner_id`, `document_id = d.id`, `role = 'edit'` whose link is still live). No row for an empty
  id list.
- **Copy writer** `imageGrantCopyStatements(env, sourceId, targetId, ids, now)`, after the import in `copyDocument`
  and the internal copy: `INSERT OR IGNORE` the target for each id the source `SERVES`.
- **Owner-change writer** `imageGrantOwnerChangeStatement`, in the owner change's batch: each image of
  `document_images` that the outgoing owner owns.
- **Removal** `imageGrantRemovalStatement`, in `documentRemovalStatements`, keyed on the doomed documents.
- I5: a document serves an image only if `SERVES` holds; a grant is written only by the writers above and migration 0075.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: after a push, the document's `document_images` rows equal the distinct ids of its references.
- I3: a push that changes a document's set queues it in `media_ref_outbox`, so the media service, whose sweep reads
  only what this api reports, hears of every reference (the spec's
  [Retention](../images.md#retention-unused-image-cleanup)).

## Interfaces and contracts

```ts
// src/image-refs/extract.ts
export const IMAGE_REF_ID_MAX_LENGTH = 128;
export function isGalleryImageId(value: unknown): value is string;
export function imageRefIds(elements: unknown): string[];
export function imageRefIdsFromText(data: string): string[];
export function imageRefIdsFromData(data: string): string[];

// src/db/image-refs.ts
export function imageRefReplaceStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[];
export function imageRefAddStatements(
  env: DocumentEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[];
export function documentImageIds(env: DocumentEnv, documentId: string): Promise<string[]>;
export function documentPlacesImage(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
  onlyTabId?: string | null,
): Promise<boolean>;
```

`imageRefIds` accepts `unknown` and returns `[]` for anything that isn't an array; a non-object entry is skipped. No
HTTP contract changes: `GET /api/images/usage` and `GET /api/images/:id` keep their shapes and status codes.

## Data and persistence

```sql
-- the document's own SQLite (src/document-room/document-schema.ts)
CREATE TABLE image_refs (
  tab_id   TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;

-- D1 (0001_livediagram_baseline.sql)
CREATE TABLE document_images (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;
CREATE INDEX document_images_image_idx ON document_images (image_id);
```

Both are derived data, rebuilt from `tabs.data` by the writers and the push. Not owner-keyed, so neither account
deletion nor owner migration lists them in [Owner-keyed data](../../015-api/api.md#owner-keyed-data).

## Errors and edge cases

| Case                                                   | Handling                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `imageId` is a `data:` URI or longer than 128          | Not a reference                                                          |
| Two elements place the same image                      | One row (primary key); `imageRefIds` is distinct                         |
| `elements` is an object, or missing                    | No references, on both extractors                                        |
| Corrupt body with no usable id                         | Warned with `(0 ids)`; nothing written                                   |
| Swap loses its compare                                 | Add-only statements may add references the stored body lacks: over-keeps |
| Tab deleted                                            | Its references go with it; the push drops them from `document_images`    |
| Image deleted from the gallery, references left behind | Harmless; they go when the element does                                  |
| A push fails                                           | Its keys stay; the next drain, a minute later, sends the whole set again |
| No `MEDIA_KEY`                                         | The index is still maintained; the queue is dropped each minute          |

## Security and trust

The share-read check authorises bytes to a share visitor, so it must never say yes to an image the document doesn't
place, nor to one it places but may not serve (an id written into a document its owner has no tie to; see
[Placement grants](#placement-grants)). The server renderer applies the same rule before reading the media service. A
reference exists only from a body that placed the image; the add-only writers can leave one behind only when a
concurrent write raced, and only for an id that tab's body carried. No input reaches SQL unbound: ids travel as one
bound JSON array read by `json_each`. The modules above are held to 100% coverage
([Testing](../../003-system-architecture/testing.md)).

## Performance and limits

The writers run in the document's own SQLite, inside the save's one transaction: no D1 round trip on a save. Measured
on a laptop (CPU time, node:sqlite standing in for the object's SQLite; `document-room-store.test.ts` keeps budgets on
them): a tab placing 500 images saves in about 7 ms, its push takes about 1.5 ms, and a save that keeps the set takes
about 3 ms and keys no push. The byte endpoint's share read is one RPC to the document and one D1 query, in parallel.

## Observability

| Fingerprint                                                                                      | Level | When                           |
| ------------------------------------------------------------------------------------------------ | ----- | ------------------------------ |
| `image-refs backfill: settling`                                                                  | info  | Run inside the settle hour     |
| `image-refs backfill: indexed tabs <from>..<to>`                                                 | info  | Budget spent, not yet complete |
| `image-refs backfill: corrupt tab <id> scanned as text (<n> ids)`                                | warn  | Text scan used                 |
| `image-refs backfill: state row missing; restarting`                                             | warn  | Row recreated                  |
| `image-refs backfill: complete at cursor <n>`                                                    | info  | Completion                     |
| `image-refs backfill failed`                                                                     | error | The run threw                  |
| `image sweep: paused, reference index backfill incomplete`                                       | info  | Sweep gated                    |
| `image-sweep-tripwire: <u> of <o> old images unreferenced; deleting at most <cap>, oldest first` | error | Tripwire                       |
| `image sweep: R2 delete failed`                                                                  | error | R2 threw after the D1 delete   |
| `image sweep: deleted N images older than <cutoff>`                                              | info  | End of every sweep             |
| `image sweep failed`                                                                             | error | The sweep threw                |

## Testing

| Rule                                                   | Test                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| What a reference is                                    | `src/image-refs/extract.test.ts`                |
| Each writer maintains the index (I1), routes included  | `src/db/image-refs-writers.test.ts`             |
| The push keeps `document_images` (I2) and queues (I3)  | `src/document-room/document-outbox.test.ts`     |
| Deleting a tab / document / account drops them         | `src/db/image-refs-writers.test.ts`             |
| No unknown writer of `tabs`, code or migration         | `src/image-refs/writer-census.test.ts`          |
| Placement grants (I5)                                  | `src/db/image-grants.test.ts`                   |
| The media service hears of every change (I3)           | `src/media.test.ts`                             |
| The share read answered by the document, before a push | `src/document-room/document-room-store.test.ts` |

All run against `src/test-sqlite-d1.ts` (real SQLite, every migration and the document's schema); shared arrangement
in `src/db/test-image-fixtures.ts`.

## Constants and configuration

| Constant                        | Value                     | Provenance                          | Safe range              |
| ------------------------------- | ------------------------- | ----------------------------------- | ----------------------- |
| `IMAGE_REF_ID_MAX_LENGTH`       | 128                       | Spec; gallery ids are 36-char UUIDs | 36 to 512               |
| `IMAGE_REFS_BACKFILL_PAGE_ROWS` | 100                       | Spec                                | 10 to 1000              |
| `IMAGE_REFS_BACKFILL_SETTLE_MS` | 3 600 000                 | Spec (one hour)                     | ≥ one deploy            |
| `IMAGE_REFS_BACKFILL_BUDGET_MS` | 60 000                    | Spec (one minute)                   | 1 s to 10 min           |
| `UNUSED_IMAGE_RETENTION_MS`     | 30 days                   | Spec                                | ≥ 7 days                |
| `IMAGE_SWEEP_PAGE`              | 1000                      | Spec; R2 `delete()` key limit       | 1 to 1000               |
| `IMAGE_SWEEP_TRIPPED_MAX`       | 1000 (`IMAGE_SWEEP_PAGE`) | Spec; one R2 call a tripped day     | 1 to `IMAGE_SWEEP_PAGE` |
| `IMAGE_SWEEP_TRIPWIRE_RATIO`    | 0.5                       | Spec (operator decision)            | 0 to 1                  |
| `IMAGE_SWEEP_TRIPWIRE_MIN`      | 20                        | Spec (operator decision)            | ≥ 0                     |

## Defaults ledger

`D1` to `D3` in [DEFAULTS.md](DEFAULTS.md).
