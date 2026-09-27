# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Retention](../images.md#retention-unused-image-cleanup) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                            | Role                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/api/migrations/0050_image_refs.sql`       | `image_refs`, `image_refs_image_idx`, `image_refs_backfill` and its single row |
| `apps/api/src/image-refs/extract.ts`            | The JavaScript extractor: what a reference is                                  |
| `apps/api/src/db/image-refs.ts`                 | Every statement on `image_refs` / `image_refs_backfill`; the SQL extractor     |
| `apps/api/src/image-refs/backfill.ts`           | The backfill run the daily cron drives                                         |
| `apps/api/src/db/tabs.ts`                       | `upsertTab`, `seedTabs`, `swapTabData`, `deleteTabRow` carry index statements  |
| `apps/api/src/db/diagrams.ts`                   | `copyDiagram` carries index statements                                         |
| `apps/api/src/db/diagram-removal.ts`            | `diagramRemovalStatements` prunes the dropped tabs' references                 |
| `apps/api/src/db/images.ts`                     | The sweep, the usage map and the share-read check, all reading the index       |
| `apps/api/src/index.ts`                         | `scheduled()`: backfill, then the sweep, in one chain                          |
| `apps/api/src/image-refs/writer-census.test.ts` | Fails when SQL writing `tabs` appears outside the known writers                |

## Domain and naming

| Term               | Identifier                                  | Meaning                                                                     |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------- |
| Reference          | row of `image_refs` `(tab_id, image_id)`    | Tab `tab_id` places gallery image `image_id`                                |
| Gallery id         | `isGalleryImageId(value)`                   | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed |
| Reference ids      | `imageRefIds(elements)`                     | Distinct gallery ids of top-level `type: 'image'` elements, document order  |
| Text scan          | `imageRefIdsFromText(data)`                 | Gallery ids after every `"imageId"` key in a body that isn't valid JSON     |
| Body ids           | `imageRefIdsFromData(data)`                 | `imageRefIds` of the parsed body, or the text scan when it doesn't parse    |
| Live reference     | a reference whose `tab_id` is in `tabs`     | What the sweep counts                                                       |
| Dangling reference | a reference whose `tab_id` is not in `tabs` | Never counted; pruned by the delete paths and the sweep                     |
| Backfill           | `image_refs_backfill` row `id = 1`          | Progress of indexing tabs saved before 0050                                 |
| Complete           | `completed_at IS NOT NULL`                  | Every tab is indexed; readers trust the index alone                         |
| Tripwire           | `sweepTripped(old, unused)`                 | The sweep's refusal to delete a suspicious share                            |

Banned synonyms: "image usage table", "image links", "refcount". A reference is never counted, only present or absent.

## Behaviour and state

### Writers

Each writer appends statements to the D1 batch that writes the body. `ids` is a JSON array string of reference ids.

| Writer                     | Statements (in order, after the `tabs` write)                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `upsertTab`                | `imageRefReplaceStatements(env, tabId, imageRefIds(tab.elements))`                            |
| `seedTabs`                 | the same, per seeded tab                                                                      |
| `copyDiagram`              | `imageRefAddStatements(env, freshTabId, imageRefIdsFromData(data))` per copied tab            |
| `swapTabData`              | batch `[UPDATE tabs … WHERE data = ?, ...imageRefAddStatements(nextData ids)]`                |
| `deleteTabRow`             | batch `[DELETE image_refs WHERE tab_id, DELETE tabs, DELETE change_log]` when no link is left |
| `diagramRemovalStatements` | `DELETE image_refs` for the doomed-tab predicate, first, then the existing two statements     |

`imageRefReplaceStatements(env, tabId, ids)`:

1. `DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`
2. When `ids` is non-empty: `INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)`

`imageRefAddStatements` is statement 2 alone. A save whose image set is unchanged deletes nothing and inserts nothing.

`diagramRemovalStatements` keeps the `DELETE FROM diagrams` as its last statement (its `meta.changes` is the count
callers read).

### Extraction in SQL

`imageRefIndexStatement(env, tabWhere, binds)` builds one `INSERT OR IGNORE INTO image_refs (tab_id, image_id)` over
`tabs t` filtered by `tabWhere`, joined to
`json_each(CASE WHEN json_valid(t.data) THEN t.data ELSE '{}' END, '$.elements')`, keeping rows where
`json_extract(e.value, '$.type') = 'image'`, `json_type(e.value, '$.imageId') = 'text'`, the id's length is 1 to 128
and it does not start with `data:`. The `CASE` guard stops `json_each` erroring on a corrupt body, whatever order SQLite
evaluates the join in. Three scopes use it:

| Scope   | `tabWhere`                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| Page    | `t.rowid > ?1 AND t.rowid <= ?2`                                                                                |
| Owner   | `t.id IN (SELECT dt.tab_id FROM diagram_tabs dt JOIN diagrams d ON d.id = dt.diagram_id WHERE d.owner_id = ?1)` |
| Diagram | `t.id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id = ?1)`                                               |

### Backfill

States: `settling` (`now - created_at < IMAGE_REFS_BACKFILL_SETTLE_MS`), `running`, `complete`. One run,
`runImageRefsBackfill(env, now, clock)`:

1. Read the row. Missing row or `completed_at` set: return `{ state: 'complete' }`.
2. Settling: log, return `{ state: 'settling' }`.
3. Loop while `clock() - start < IMAGE_REFS_BACKFILL_BUDGET_MS`:
   1. `max = SELECT MAX(rowid) FROM tabs` (0 when empty).
   2. `cursor >= max`: set `completed_at = now`, log `complete`, return `{ state: 'complete' }`.
   3. `to = min(cursor + IMAGE_REFS_BACKFILL_PAGE_ROWS, max)`. Run the page statement for `(cursor, to]`.
   4. For each tab in `(cursor, to]` whose body is not valid JSON and contains `"imageId"`, read one at a time
      (keyset on `rowid`, `LIMIT 1`), insert `imageRefIdsFromText(data)` with `imageRefAddStatements`, log it.
   5. `UPDATE image_refs_backfill SET cursor = to`.
4. Budget spent: log the range indexed this run, return `{ state: 'running' }`.

The cursor only moves after its page is written, so a failed run resumes at the last good page. The loop re-reads
`MAX(rowid)` each page, so tabs created meanwhile are reached.

`isImageRefIndexComplete(env)` reads `completed_at`; once true it memoises in a module variable for the isolate's life
(`D2`). Tests reset it with `resetImageRefIndexMemo()`.

### Readers

**Sweep** `deleteOldUnusedImages(env, cutoff)`:

1. No `IMAGES` binding: return 0.
2. Not complete: log `image sweep: paused, reference index backfill incomplete`, return 0.
3. One pass: `SELECT COUNT(*) AS old, SUM(NOT EXISTS (live reference)) AS unused FROM images WHERE created_at < ?`.
4. `unused = 0`: return 0. `sweepTripped(old, unused)`: `console.error` the tripwire line, return 0.
5. Repeat until a page returns fewer than `IMAGE_SWEEP_PAGE` ids: select up to `IMAGE_SWEEP_PAGE` unreferenced old
   ids; `DELETE FROM images WHERE id IN (json_each(?)) AND NOT EXISTS (live reference) RETURNING id`;
   `DELETE FROM image_refs WHERE image_id IN (json_each(returned))`; `IMAGES.delete(returned)`. On an R2 failure,
   log `image sweep: R2 delete failed` with the ids and carry on with the next page.
6. Return the number of D1 rows deleted.

Live reference: `EXISTS (SELECT 1 FROM image_refs r JOIN tabs t ON t.id = r.tab_id WHERE r.image_id = images.id)`.

`sweepTripped(old, unused) = unused > IMAGE_SWEEP_TRIPWIRE_MIN && unused / old > IMAGE_SWEEP_TRIPWIRE_RATIO`.

**Usage** `imageUsageByOwner(env, ownerId)`: when not complete, run the Owner-scope index statement first. Then
`SELECT DISTINCT r.image_id, d.id, d.name FROM diagrams d JOIN diagram_tabs dt ON dt.diagram_id = d.id JOIN image_refs r ON r.tab_id = dt.tab_id WHERE d.owner_id = ? ORDER BY d.name, d.id`
(`D3`), folded into `Record<imageId, { id, name }[]>`.

**Share read** `diagramReferencesImage(env, diagramId, imageId, onlyTabId)`: when not complete, run the Diagram-scope
index statement first. Then
`SELECT 1 FROM diagram_tabs dt JOIN image_refs r ON r.tab_id = dt.tab_id WHERE dt.diagram_id = ? AND r.image_id = ? [AND dt.tab_id = ?] LIMIT 1`.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: no reader counts a dangling reference.
- I3: the sweep deletes nothing while the backfill is incomplete or the tripwire holds.
- I4: an image with a live reference at the instant of its `DELETE` statement is not deleted.

## Interfaces and contracts

```ts
// image-refs/extract.ts
export const IMAGE_REF_ID_MAX_LENGTH = 128;
export function isGalleryImageId(value: unknown): value is string;
export function imageRefIds(elements: unknown): string[];
export function imageRefIdsFromText(data: string): string[];
export function imageRefIdsFromData(data: string): string[];

// db/image-refs.ts
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
export function imageRefIndexOwnerStatement(env: Env, ownerId: string): D1PreparedStatement;
export function imageRefIndexDiagramStatement(env: Env, diagramId: string): D1PreparedStatement;
export function imageRefIndexPageStatement(
  env: Env,
  fromRowId: number,
  toRowId: number,
): D1PreparedStatement;
export async function isImageRefIndexComplete(env: Env): Promise<boolean>;
export function resetImageRefIndexMemo(): void;

// image-refs/backfill.ts
export type ImageRefsBackfillResult = { state: 'settling' | 'running' | 'complete' };
export async function runImageRefsBackfill(
  env: Env,
  now: number,
  clock?: () => number,
): Promise<ImageRefsBackfillResult>;

// db/images.ts
export function sweepTripped(old: number, unused: number): boolean;
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
INSERT INTO image_refs_backfill (id, created_at, cursor, completed_at)
SELECT 1, now_ms, 0, CASE WHEN EXISTS (SELECT 1 FROM tabs) THEN NULL ELSE now_ms END;
```

`now_ms` is `CAST(strftime('%s', 'now') AS INTEGER) * 1000` (`D1`). Both columns are derived data: rebuildable from
`tabs.data` by resetting the backfill row (`completed_at = NULL, cursor = 0`). Not owner-keyed, so neither account
deletion nor owner migration lists them in [Owner-keyed data](../../015-api/api.md#owner-keyed-data). A future
migration rebuilding `tabs` must keep tab ids (the index is keyed on them) and must not rely on a cascade here.

## Errors and edge cases

| Case                                                   | Handling                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `imageId` is a `data:` URI or longer than 128          | Not a reference                                                                   |
| Two elements place the same image                      | One row (primary key); `imageRefIds` is distinct                                  |
| Corrupt body at backfill                               | Text scan; every id after `"imageId"` counts, image or not (over-keeps)           |
| Corrupt body at the lazy owner / diagram index         | No references from it; the complete backfill still covers it                      |
| Swap loses its compare                                 | Add-only statements may add references the stored body lacks: over-keeps          |
| Backfill races a save                                  | `INSERT OR IGNORE` from an older body: an extra reference until the next save     |
| Worker from before 0050 still saving                   | The settle hour; its writes precede the backfill's reads                          |
| Backfill run fails mid-page                            | Cursor not advanced; the next run redoes the page (idempotent)                    |
| Tab deleted, references left behind                    | Dangling; never counted; pruned when its image is swept                           |
| Image deleted from the gallery, references left behind | Harmless; they go when the element does                                           |
| Image placed between count and delete                  | The `DELETE` re-checks; it survives                                               |
| R2 delete fails after D1 delete                        | Objects stay (bytes kept); ids logged                                             |
| Unreferenced share over the tripwire                   | Nothing deleted; error logged; repeats daily                                      |
| No `IMAGES` binding                                    | Sweep is a no-op; the index is still maintained (it costs nothing without images) |

## Security and trust

The share-read check authorises bytes to a share visitor, so it must never say yes to an image the diagram doesn't
place. A reference exists only from a body that placed the image; the add-only writers can leave one behind only when
a concurrent write or backfill raced, and only for an id the tab body carried. The lazy diagram index before
completion writes only from that diagram's own tabs. No new input reaches SQL unbound: ids travel as one bound JSON
array read by `json_each`.

## Performance and limits

Rows read / written are D1's billing units. `R` = references, `I` = images, `T` = tabs, `T_img` = tabs mentioning
`"imageId"`, `k` = a tab's image count, `D`/`L` = an owner's diagrams / links.

| Operation                   | Before                                                           | After                                              |
| --------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| Autosave, images unchanged  | 0 index rows                                                     | reads ≈ k, writes 0                                |
| Autosave, one image added   | 0                                                                | reads ≈ k, writes 2 (row + `image_refs_image_idx`) |
| Daily sweep, nothing unused | reads I + T (the `LIKE` scans every tab), bodies of T_img parsed | reads ≈ 2I (images + one index probe each)         |
| Usage endpoint              | reads D + L + L tab bodies parsed                                | reads ≈ D + L + R_owner, no body                   |
| Share-visitor image GET     | reads the diagram's links + every tab body parsed                | reads ≤ links + 1                                  |
| Backfill (once)             | none                                                             | reads ≈ T, writes 2R, D1-side JSON parse           |

Budgets: a backfill page parses at most 100 bodies of at most `MAX_TAB_BYTES` (4 MiB) inside D1, well under its
30-second statement limit for real tabs; the run stops after 60 s wall-clock, inside the cron's 15-minute limit. The
sweep holds at most `IMAGE_SWEEP_PAGE` ids in memory; the old sweep could hold 200 bodies of 4 MiB. Measured numbers
are in the plan's report and [Images, Retention](../images.md#retention-unused-image-cleanup) keeps the stance.

## Observability

| Fingerprint                                                                 | Level | When                                      |
| --------------------------------------------------------------------------- | ----- | ----------------------------------------- |
| `image-refs backfill: settling`                                             | info  | Run inside the settle hour                |
| `image-refs backfill: indexed tabs <from>..<to>`                            | info  | End of a run that did work but isn't done |
| `image-refs backfill: corrupt tab <id> scanned as text`                     | warn  | Text scan used                            |
| `image-refs backfill: complete at cursor <n>`                               | info  | Completion                                |
| `image-refs backfill failed`                                                | error | The run threw                             |
| `image sweep: paused, reference index backfill incomplete`                  | info  | Sweep gated                               |
| `image-sweep-tripwire: <u> of <o> old images unreferenced; nothing deleted` | error | Tripwire                                  |
| `image sweep: R2 delete failed`                                             | error | R2 threw after the D1 delete              |
| `image sweep: deleted N images older than <cutoff>`                         | info  | End of every sweep (existing)             |

## Testing

| Rule                                                        | Test                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| What a reference is                                         | `image-refs/extract.test.ts`                         |
| SQL extraction equals the JavaScript extractor              | `db/image-refs.test.ts` "parity" over one corpus     |
| Each writer maintains the index (I1)                        | `db/image-refs-writers.test.ts`, one case per writer |
| Deleting a tab / diagram / account prunes; shared tab keeps | `db/image-refs-writers.test.ts`                      |
| No unknown writer of `tabs`                                 | `image-refs/writer-census.test.ts`                   |
| Backfill states, pages, chase, corrupt body, idempotence    | `image-refs/backfill.test.ts`                        |
| Sweep gate, live vs dangling, tripwire, re-check (I2 to I4) | `db/images.test.ts`                                  |
| Usage and share read from the index, lazy index             | `db/images.test.ts`                                  |
| Migration on a populated database                           | `db/image-refs.test.ts` (seed before 0050, apply it) |

All run against `test-sqlite-d1.ts` (real SQLite, every migration).

## Constants and configuration

| Constant                        | Value     | Provenance                       | Safe range    |
| ------------------------------- | --------- | -------------------------------- | ------------- |
| `IMAGE_REF_ID_MAX_LENGTH`       | 128       | Spec; ids are 36-character UUIDs | 36 to 512     |
| `IMAGE_REFS_BACKFILL_PAGE_ROWS` | 100       | Spec                             | 10 to 1000    |
| `IMAGE_REFS_BACKFILL_SETTLE_MS` | 3 600 000 | Spec (one hour)                  | ≥ one deploy  |
| `IMAGE_REFS_BACKFILL_BUDGET_MS` | 60 000    | Spec (one minute)                | 1 s to 10 min |
| `IMAGE_SWEEP_PAGE`              | 1000      | Spec; R2 `delete()` key limit    | 1 to 1000     |
| `IMAGE_SWEEP_TRIPWIRE_RATIO`    | 0.5       | Spec (operator decision)         | 0 to 1        |
| `IMAGE_SWEEP_TRIPWIRE_MIN`      | 20        | Spec (operator decision)         | ≥ 0           |

## Defaults ledger

`D1` to `D3` in [DEFAULTS.md](DEFAULTS.md).
