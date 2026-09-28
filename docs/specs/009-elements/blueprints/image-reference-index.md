# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Retention](../images.md#retention-unused-image-cleanup) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/api/`):

| File                                   | Role                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `migrations/0050_image_refs.sql`       | `image_refs`, `image_refs_image_idx`, `image_refs_backfill` and its single row |
| `src/image-refs/extract.ts`            | The JavaScript extractor: what a reference is                                  |
| `src/db/image-refs.ts`                 | Every statement on `image_refs` / `image_refs_backfill`; the SQL extractor     |
| `src/image-refs/backfill.ts`           | One backfill run                                                               |
| `src/image-refs/retention.ts`          | The daily image job: backfill, then sweep                                      |
| `src/db/image-retention.ts`            | The sweep and its tripwire                                                     |
| `src/db/images.ts`                     | The usage map and the share-read check, reading the index                      |
| `src/db/tabs.ts`                       | `upsertTab`, `seedTabs`, `swapTabData`, `deleteTabRow` carry index statements  |
| `src/db/diagrams.ts`                   | `copyDiagram` carries index statements                                         |
| `src/db/diagram-removal.ts`            | `diagramRemovalStatements` prunes the dropped tabs' references                 |
| `src/index.ts`                         | `scheduled()` hands the daily run to `runImageRetention`                       |
| `src/image-refs/writer-census.test.ts` | Fails when SQL writing `tabs` appears outside the known writers                |

## Domain and naming

| Term               | Identifier                                  | Meaning                                                                     |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------- |
| Reference          | row of `image_refs` `(tab_id, image_id)`    | Tab `tab_id` places gallery image `image_id`                                |
| Gallery id         | `isGalleryImageId(value)`                   | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed |
| Reference ids      | `imageRefIds(elements)`                     | Distinct gallery ids of top-level `type: 'image'` elements, document order  |
| Text scan          | `imageRefIdsFromText(data)`                 | Gallery ids after every `"imageId"` key in a body that isn't valid JSON     |
| Body ids           | `imageRefIdsFromData(data)`                 | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan |
| Live reference     | a reference whose `tab_id` is in `tabs`     | What the sweep counts                                                       |
| Dangling reference | a reference whose `tab_id` is not in `tabs` | Never counted; pruned by the delete paths and the sweep                     |
| Backfill           | `image_refs_backfill` row `id = 1`          | Progress of indexing tabs saved before 0050                                 |
| Complete           | `completed_at IS NOT NULL`                  | Every tab is indexed; readers trust the index alone                         |
| Tripwire           | `sweepTripped(old, unused)`                 | The sweep's refusal to delete a suspicious share                            |

Banned synonyms: "image usage table", "image links", "refcount". A reference is never counted, only present or absent.

## Behaviour and state

### Writers

Each writer appends statements to the D1 batch that writes the body.

| Writer                     | Statements, in the body's batch                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `upsertTab`                | after the collab statements: `imageRefReplaceStatements(env, id, imageRefIds(tab.elements))`                 |
| `seedTabs`                 | the same, per seeded tab                                                                                     |
| `copyDiagram`              | per copied tab: `imageRefAddStatements(env, freshTabId, imageRefIdsFromData(data))`                          |
| `swapTabData`              | batch `[UPDATE tabs … WHERE data = ?, ...imageRefAddStatements(nextData ids)]`; result 0's `changes` decides |
| `deleteTabRow`             | when no link is left: batch `[imageRefPruneTabStatement, DELETE tabs, DELETE change_log]`                    |
| `diagramRemovalStatements` | first: `DELETE FROM image_refs WHERE tab_id IN (doomed tabs)`; then the tabs and diagrams deletes            |

`imageRefReplaceStatements(env, tabId, ids)`, with `ids` bound as one JSON array:

1. `DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`
2. `imageRefAddStatements`: when `ids` is non-empty,
   `INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)`

A save whose image set is unchanged deletes nothing and inserts nothing. "Doomed tabs" in `diagramRemovalStatements`
is the same predicate its `DELETE FROM tabs` uses (linked into a doomed diagram and into nothing else), evaluated first
while the links still exist; the `DELETE FROM diagrams` stays last, its `meta.changes` the count callers read.

### Extraction in SQL

`indexTabsSql(tabWhere)` is one `INSERT OR IGNORE INTO image_refs (tab_id, image_id)` over `tabs t` filtered by
`tabWhere`, joined to `json_each(<source>, '$.elements') e`, keeping rows where `e.type = 'object'`,
`json_extract(e.value, '$.type') = 'image'`, `json_type(e.value, '$.imageId') = 'text'`, the id's length is 1 to
`IMAGE_REF_ID_MAX_LENGTH` and it does not start with `data:`. `<source>` is a `CASE` giving `'{}'` when `t.data` lacks
`"imageId"` (`instr`), is not valid JSON, or has no `elements` array, else `t.data`. The `CASE` is what stops a corrupt
body failing the statement whatever order SQLite evaluates the join in, and keeps `json_each` off image-free tabs
(D1 bills each element it walks). Three statements use it:

| Statement                       | `tabWhere`                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `imageRefIndexPageStatement`    | `t.rowid > ?1 AND t.rowid <= ?2`                                                                                |
| `imageRefIndexOwnerStatement`   | `t.id IN (SELECT dt.tab_id FROM diagram_tabs dt JOIN diagrams d ON d.id = dt.diagram_id WHERE d.owner_id = ?1)` |
| `imageRefIndexDiagramStatement` | `t.id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id = ?1)`                                               |

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
      keyset on `rowid`, `LIMIT 1`): `imageRefAddStatements(imageRefIdsFromText(data))`, warn.
   5. One batch: `[imageRefIndexPageStatement(cursor, to), imageRefsBackfillAdvanceStatement(to)]`.
4. Budget spent: log the range, return `running`.

The cursor moves only in the batch that indexes its page, so a failed run redoes that page. `MAX(rowid)` is re-read each
page, so tabs created meanwhile are reached.

`isImageRefIndexComplete(env)` is true only for a row with `completed_at` set, then memoised in a module variable for
the isolate's life (`D2`); `resetImageRefIndexMemo()` clears it for tests.

`runImageRetention(env, now)` (the cron's entry): the backfill, catching and logging a throw; then
`deleteOldUnusedImages(env, now - UNUSED_IMAGE_RETENTION_MS)`, logging its count or its throw. It never rejects.

### Readers

**Sweep** `deleteOldUnusedImages(env, cutoff)`:

1. No `IMAGES` binding: return 0.
2. Not complete: log, return 0.
3. One pass: `SELECT COUNT(*) AS old, COALESCE(SUM(NOT live), 0) AS unused FROM images WHERE created_at < ?`.
4. `unused = 0`: return 0. `sweepTripped(old, unused)`: error-log the tripwire line, return 0.
5. Keyset pages on `id` (`id > last`), `IMAGE_SWEEP_PAGE` at a time, of unreferenced old ids:
   `DELETE FROM images WHERE id IN (json_each(?)) AND NOT live RETURNING id`; for the returned ids,
   `DELETE FROM image_refs WHERE image_id IN (…)` then `IMAGES.delete(ids)`; an R2 throw is logged with the ids and
   the sweep carries on. Stop on an empty or short page.
6. Return the number of D1 rows deleted.

`live` is `EXISTS (SELECT 1 FROM image_refs r JOIN tabs t ON t.id = r.tab_id WHERE r.image_id = images.id)`.
`sweepTripped(old, unused) = unused > IMAGE_SWEEP_TRIPWIRE_MIN && unused / old > IMAGE_SWEEP_TRIPWIRE_RATIO`.

**Usage** `imageUsageByOwner(env, ownerId)`: when not complete, run `imageRefIndexOwnerStatement` first. Then
`SELECT DISTINCT r.image_id, d.id, d.name FROM diagrams d JOIN diagram_tabs dt ON dt.diagram_id = d.id JOIN image_refs r ON r.tab_id = dt.tab_id WHERE d.owner_id = ? ORDER BY d.name, d.id`
(`D3`), folded into `Record<imageId, { id, name }[]>`.

**Share read** `diagramReferencesImage(env, diagramId, imageId, onlyTabId)`: when not complete, run
`imageRefIndexDiagramStatement` first. Then
`SELECT 1 FROM diagram_tabs dt JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ? WHERE dt.diagram_id = ? [AND dt.tab_id = ?] LIMIT 1`.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: no reader counts a dangling reference.
- I3: the sweep deletes nothing while the backfill is incomplete or the tripwire holds.
- I4: an image with a live reference at the instant of its `DELETE` statement is not deleted.

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
  env: Env,
  tabId: string,
  ids: string[],
): D1PreparedStatement[];
export function imageRefAddStatements(
  env: Env,
  tabId: string,
  ids: string[],
): D1PreparedStatement[];
export function imageRefPruneTabStatement(env: Env, tabId: string): D1PreparedStatement;
export function imageRefIndexPageStatement(
  env: Env,
  fromRowId: number,
  toRowId: number,
): D1PreparedStatement;
export function imageRefIndexOwnerStatement(env: Env, ownerId: string): D1PreparedStatement;
export function imageRefIndexDiagramStatement(env: Env, diagramId: string): D1PreparedStatement;
export type ImageRefsBackfillRow = {
  created_at: number;
  cursor: number;
  completed_at: number | null;
};
export async function readImageRefsBackfill(env: Env): Promise<ImageRefsBackfillRow | null>;
export async function restartImageRefsBackfill(env: Env, now: number): Promise<void>;
export function imageRefsBackfillAdvanceStatement(env: Env, cursor: number): D1PreparedStatement;
export async function completeImageRefsBackfill(env: Env, now: number): Promise<void>;
export async function maxTabRowId(env: Env): Promise<number>;
export async function nextCorruptTabMentioningImages(
  env: Env,
  fromRowId: number,
  toRowId: number,
): Promise<{ rid: number; id: string; data: string } | null>;
export async function isImageRefIndexComplete(env: Env): Promise<boolean>;
export function resetImageRefIndexMemo(): void;

// src/image-refs/backfill.ts
export type ImageRefsBackfillResult = { state: 'settling' | 'running' | 'complete' };
export async function runImageRefsBackfill(
  env: Env,
  now: number,
  clock?: () => number,
): Promise<ImageRefsBackfillResult>;

// src/image-refs/retention.ts
export const UNUSED_IMAGE_RETENTION_MS: number;
export async function runImageRetention(env: Env, now: number): Promise<void>;

// src/db/image-retention.ts
export function sweepTripped(old: number, unused: number): boolean;
export async function deleteOldUnusedImages(env: Env, cutoff: number): Promise<number>;
```

`imageRefIds` accepts `unknown` and returns `[]` for anything that isn't an array; a non-object entry is skipped. No
HTTP contract changes: `GET /api/images/usage` and `GET /api/images/:id` keep their shapes and status codes.

## Data and persistence

```sql
CREATE TABLE image_refs (
  tab_id   TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
CREATE INDEX image_refs_image_idx ON image_refs (image_id);

CREATE TABLE image_refs_backfill (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  created_at   INTEGER NOT NULL,
  cursor       INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);
-- one row: created_at = now, cursor 0, completed_at = now only when `tabs` is empty
```

`now` in SQL is `CAST(strftime('%s', 'now') AS INTEGER) * 1000` (`D1`). Both tables are derived data: rebuildable from
`tabs.data` by resetting the backfill row (`cursor = 0, completed_at = NULL`). Not owner-keyed, so neither account
deletion nor owner migration lists them in [Owner-keyed data](../../015-api/api.md#owner-keyed-data). A migration that
rebuilds `tabs` must keep tab ids (the index is keyed on them); nothing cascades here.

## Errors and edge cases

| Case                                                   | Handling                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `imageId` is a `data:` URI or longer than 128          | Not a reference                                                           |
| Two elements place the same image                      | One row (primary key); `imageRefIds` is distinct                          |
| `elements` is an object, or missing                    | No references, on both extractors                                         |
| Corrupt body at backfill                               | Text scan; every id after `"imageId"` counts, image or not (over-keeps)   |
| Corrupt body with no usable id                         | Warned with `(0 ids)`; nothing written                                    |
| Corrupt body at the lazy owner / diagram index         | No references from it; the backfill still covers it                       |
| Swap loses its compare                                 | Add-only statements may add references the stored body lacks: over-keeps  |
| Backfill races a save                                  | `INSERT OR IGNORE` from an older body: an extra reference until next save |
| Worker from before 0050 still saving                   | The settle hour; its writes precede the backfill's reads                  |
| Backfill run fails mid-page                            | Cursor not advanced; the next run redoes the page (idempotent)            |
| Every tab gone before the backfill runs                | `MAX(rowid)` is 0; completes                                              |
| State row missing                                      | Never complete; the next run recreates it and starts over                 |
| Tab deleted, references left behind                    | Dangling; never counted; pruned when its image is swept                   |
| Image deleted from the gallery, references left behind | Harmless; they go when the element does                                   |
| Image placed between count and delete                  | The `DELETE` re-checks; it survives                                       |
| Unused count an exact multiple of the page             | A final empty page ends the loop                                          |
| R2 delete fails after D1 delete                        | Objects stay (bytes kept); ids logged; next page continues                |
| Unreferenced share over the tripwire                   | Nothing deleted; error logged; repeats daily                              |
| No `IMAGES` binding                                    | Sweep is a no-op; the index is still maintained                           |

## Security and trust

The share-read check authorises bytes to a share visitor, so it must never say yes to an image the diagram doesn't
place. A reference exists only from a body that placed the image; the add-only writers can leave one behind only when
a concurrent write or the backfill raced, and only for an id that tab's body carried. Before completion, a share
visitor's image read writes index rows from that diagram's own tabs, derived data only. No input reaches SQL unbound:
ids travel as one bound JSON array read by `json_each`. The modules above are held to 100% coverage
([Testing](../../003-system-architecture/testing.md)).

## Performance and limits

D1 bills rows read and written, not bytes; `json_each` rows count as read. Measured through the real functions on
workerd's local D1 with 5,000 tabs (42.6 MB of bodies, 10% placing 1 to 3 images) and 2,000 images, before (main at
`402d8019`) and after:

| Operation                        | Before: read / written        | After: read / written |
| -------------------------------- | ----------------------------- | --------------------- |
| Daily sweep, deciding            | 7,000 / 0, plus 4.6 MB parsed | 2,597 / 0, no body    |
| Usage map, one owner             | 61 / 0, plus 221 KB parsed    | 51 / 0                |
| Share-visitor image read         | 11 / 0, plus 42 KB parsed     | 4 / 0                 |
| Autosave, image tab, unchanged   | 3 / 5                         | 17 / 5                |
| Autosave, image-free tab         | 3 / 5                         | 4 / 5                 |
| Autosave, one image added        | 3 / 5                         | 19 / 7                |
| Backfill, once, whole store      | none                          | 37,266 / 2,143        |
| Usage map during backfill (lazy) | as above                      | 261 / 12              |

Asymptotically the sweep goes from `I + T` rows plus every image-mentioning body through one Worker to about
`I + R` rows and no body; the old sweep also held 200 bodies of up to 4 MiB per page. A backfill page parses at most 100
bodies inside D1; the run stops after 60 s of wall clock, inside the cron's limit. The sweep holds at most
`IMAGE_SWEEP_PAGE` ids.

## Observability

| Fingerprint                                                                 | Level | When                           |
| --------------------------------------------------------------------------- | ----- | ------------------------------ |
| `image-refs backfill: settling`                                             | info  | Run inside the settle hour     |
| `image-refs backfill: indexed tabs <from>..<to>`                            | info  | Budget spent, not yet complete |
| `image-refs backfill: corrupt tab <id> scanned as text (<n> ids)`           | warn  | Text scan used                 |
| `image-refs backfill: state row missing; restarting`                        | warn  | Row recreated                  |
| `image-refs backfill: complete at cursor <n>`                               | info  | Completion                     |
| `image-refs backfill failed`                                                | error | The run threw                  |
| `image sweep: paused, reference index backfill incomplete`                  | info  | Sweep gated                    |
| `image-sweep-tripwire: <u> of <o> old images unreferenced; nothing deleted` | error | Tripwire                       |
| `image sweep: R2 delete failed`                                             | error | R2 threw after the D1 delete   |
| `image sweep: deleted N images older than <cutoff>`                         | info  | End of every sweep             |
| `image sweep failed`                                                        | error | The sweep threw                |

## Testing

| Rule                                                        | Test                                            |
| ----------------------------------------------------------- | ----------------------------------------------- |
| What a reference is                                         | `src/image-refs/extract.test.ts`                |
| SQL extraction equals the JavaScript extractor              | `src/db/image-refs.test.ts` "the SQL extractor" |
| Migration on an empty and a populated database              | `src/db/image-refs.test.ts` "migration 0050"    |
| Each writer maintains the index (I1), routes included       | `src/db/image-refs-writers.test.ts`             |
| Deleting a tab / diagram / account prunes; shared tab keeps | `src/db/image-refs-writers.test.ts`             |
| No unknown writer of `tabs`, code or migration              | `src/image-refs/writer-census.test.ts`          |
| Backfill states, pages, chase, corrupt body, idempotence    | `src/image-refs/backfill.test.ts`               |
| Backfill before sweep; failures logged                      | `src/image-refs/retention.test.ts`              |
| Sweep gate, live vs dangling, tripwire, re-check (I2 to I4) | `src/db/image-retention.test.ts`                |
| Usage and share read from the index, lazy index             | `src/db/images.test.ts`                         |

All run against `src/test-sqlite-d1.ts` (real SQLite, every migration); shared arrangement in
`src/db/test-image-fixtures.ts`.

## Constants and configuration

| Constant                        | Value     | Provenance                          | Safe range    |
| ------------------------------- | --------- | ----------------------------------- | ------------- |
| `IMAGE_REF_ID_MAX_LENGTH`       | 128       | Spec; gallery ids are 36-char UUIDs | 36 to 512     |
| `IMAGE_REFS_BACKFILL_PAGE_ROWS` | 100       | Spec                                | 10 to 1000    |
| `IMAGE_REFS_BACKFILL_SETTLE_MS` | 3 600 000 | Spec (one hour)                     | ≥ one deploy  |
| `IMAGE_REFS_BACKFILL_BUDGET_MS` | 60 000    | Spec (one minute)                   | 1 s to 10 min |
| `UNUSED_IMAGE_RETENTION_MS`     | 30 days   | Spec                                | ≥ 7 days      |
| `IMAGE_SWEEP_PAGE`              | 1000      | Spec; R2 `delete()` key limit       | 1 to 1000     |
| `IMAGE_SWEEP_TRIPWIRE_RATIO`    | 0.5       | Spec (operator decision)            | 0 to 1        |
| `IMAGE_SWEEP_TRIPWIRE_MIN`      | 20        | Spec (operator decision)            | ≥ 0           |

## Defaults ledger

`D1` to `D3` in [DEFAULTS.md](DEFAULTS.md).
