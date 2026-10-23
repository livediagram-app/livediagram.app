# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Placement grants](../images.md#placement-grants) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/api/`):

| File                                   | Role                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `src/image-refs/extract.ts`            | The JavaScript extractor: what a reference is                                 |
| `src/db/images.ts`                     | The usage map and the share-read check, reading the index                     |
| `src/db/tabs.ts`                       | `upsertTab`, `seedTabs`, `swapTabData`, `deleteTabRow` carry index statements |
| `src/db/documents.ts`                  | `copyDocument` carries index statements                                       |
| `src/db/document-removal.ts`           | `documentRemovalStatements` prunes the dropped tabs' references               |
| `src/image-refs/writer-census.test.ts` | Fails when SQL writing `tabs` appears outside the known writers               |

## Domain and naming

| Term               | Identifier                                  | Meaning                                                                     |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------- |
| Reference          | row of `image_refs` `(tab_id, image_id)`    | Tab `tab_id` places gallery image `image_id`                                |
| Gallery id         | `isGalleryImageId(value)`                   | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed |
| Reference ids      | `imageRefIds(elements)`                     | Distinct gallery ids of top-level `type: 'image'` elements, document order  |
| Text scan          | `imageRefIdsFromText(data)`                 | Gallery ids after every `"imageId"` key in a body that isn't valid JSON     |
| Body ids           | `imageRefIdsFromData(data)`                 | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan |
| Live reference     | a reference whose `tab_id` is in `tabs`     | What the readers and the media service's reports count                      |
| Dangling reference | a reference whose `tab_id` is not in `tabs` | Never counted; pruned by the delete paths                                   |

Banned synonyms: "image usage table", "image links", "refcount". A reference is never counted, only present or absent.

## Behaviour and state

### Writers

Each writer appends statements to the D1 batch that writes the body.

| Writer                      | Statements, in the body's batch                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `upsertTab`                 | after the collab statements: `imageRefReplaceStatements(env, id, imageRefIds(tab.elements))`                 |
| `seedTabs`                  | the same, per seeded tab                                                                                     |
| `copyDocument`              | per copied tab: `imageRefAddStatements(env, freshTabId, imageRefIdsFromData(data))`                          |
| `swapTabData`               | batch `[UPDATE tabs … WHERE data = ?, ...imageRefAddStatements(nextData ids)]`; result 0's `changes` decides |
| `deleteTabRow`              | when no link is left: batch `[imageRefPruneTabStatement, DELETE tabs]`                                       |
| `documentRemovalStatements` | first: `DELETE FROM image_refs WHERE tab_id IN (doomed tabs)`; then the tabs and documents deletes           |

`imageRefReplaceStatements(env, tabId, ids)`, with `ids` bound as one JSON array:

0. `mediaRefQueueTabStatement(env, tabId, ids, false)`: queues the tab's documents for the media service when
   the set changes ([Images](images.md#retention)); `imageRefAddStatements` runs it add-only first too.
1. `DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))`
2. `imageRefAddStatements`: when `ids` is non-empty,
   `INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)`

A save whose image set is unchanged deletes nothing and inserts nothing. "Doomed tabs" in `documentRemovalStatements`
is the same predicate its `DELETE FROM tabs` uses (linked into a doomed document and into nothing else), evaluated first
while the links still exist; the `DELETE FROM documents` stays last, its `meta.changes` the count callers read.

### Readers

**Usage** `imageUsageByOwner(env, ownerId)`:
`SELECT DISTINCT r.image_id, d.id, d.name FROM documents d JOIN document_tabs dt ON dt.document_id = d.id JOIN image_refs r ON r.tab_id = dt.tab_id WHERE d.owner_id = ? ORDER BY d.name, d.id`
(`D3`), folded into `Record<imageId, { id, name }[]>`.

**Share read** `documentServesImage(env, documentId, imageId, onlyTabId)` (`db/image-grants.ts`): one query: the document places the image
(`document_tabs` ⋈ `image_refs`, `[AND dt.tab_id = ?]`) AND `SERVES`, where
`SERVES = i.owner_id = d.owner_id OR EXISTS (SELECT 1 FROM image_grants g WHERE g.document_id = d.id AND g.image_id = i.id)`,
`i` being the image's `media_images` row (whose it is, as this api names owners; [Images](images.md#data-and-persistence)).
An image with no row there serves nowhere and earns no grant until this api meets it (an upload, a gallery list, or
the first byte read, which fills the row).
A refusal logs `[images] not servable by document` with the document and image ids.

**Render read** `servableImageIds(env, documentId, ids)`: of a tab's ids, those `SERVES` admits, one query over a
bound JSON array. `thumbnail.ts` `loadEmbeddedImages` reads the media service only for those; the rest keep the placeholder.

### Placement grants

`image_grants (document_id, image_id, created_at)`, primary key `(document_id, image_id)`, `WITHOUT ROWID`, no
foreign keys (in `0001_livedocuments_baseline.sql`).

- **Placement writer** `imageGrantPlacementStatements(env, tabId, ids, now)`, appended after the index statements by
  `upsertTab`, `seedTabs` and `swapTabData`: `INSERT OR IGNORE` one row per (document holding the tab, placed image)
  where `i.owner_id <> d.owner_id` AND (a `team_members` row with `team_id = d.team_id`, `user_id = i.owner_id`,
  `status = 'joined'`, OR a `shared_with` row with `owner_id = i.owner_id`, `document_id = d.id`, `role = 'edit'`).
  No row for an empty id list.
- **Copy writer** `imageGrantCopyStatements(env, sourceId, targetId, ids, now)`, per copied tab in `copyDocument`:
  `INSERT OR IGNORE` the target for each id the source `SERVES`.
- **Link writer** `imageGrantLinkStatement(env, targetId, tabId, now)`, run by `linkTabToDocument` after the link:
  `INSERT OR IGNORE` the target for each image the tab places that another holder of the tab `SERVES`.
- **Removal** `imageGrantRemovalStatement`, in `documentRemovalStatements`, keyed on the doomed documents.
- I5: a document serves an image only if `SERVES` holds; a grant is written only by the writers above.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: no reader counts a dangling reference.
- I3: a writer batch that changes a tab's set queues every document holding the tab in `media_ref_outbox`, so the
  media service, whose sweep reads only what this api reports, hears of every reference (the spec's
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
```

The table is derived data, rebuilt from `tabs.data` by the writers. Not owner-keyed, so neither account
deletion nor owner migration lists them in [Owner-keyed data](../../015-api/api.md#owner-keyed-data). A migration that
rebuilds `tabs` must keep tab ids (the index is keyed on them); nothing cascades here.

## Errors and edge cases

| Case                                                   | Handling                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `imageId` is a `data:` URI or longer than 128          | Not a reference                                                          |
| Two elements place the same image                      | One row (primary key); `imageRefIds` is distinct                         |
| `elements` is an object, or missing                    | No references, on both extractors                                        |
| Corrupt body with no usable id                         | Warned with `(0 ids)`; nothing written                                   |
| Swap loses its compare                                 | Add-only statements may add references the stored body lacks: over-keeps |
| Tab deleted, references left behind                    | Dangling; never counted                                                  |
| Image deleted from the gallery, references left behind | Harmless; they go when the element does                                  |
| No `MEDIA_KEY`                                         | The index is still maintained; the queue is dropped each minute          |

## Security and trust

The share-read check authorises bytes to a share visitor, so it must never say yes to an image the document doesn't
place, nor to one it places but may not serve (an id written into a document its owner has no tie to; see
[Placement grants](#placement-grants)). The server renderer applies the same rule before reading the media service. A reference exists only from a body that placed the image; the add-only writers can leave one behind only when
a concurrent write raced, and only for an id that tab's body carried. No input reaches SQL unbound:
ids travel as one bound JSON array read by `json_each`. The modules above are held to 100% coverage
([Testing](../../003-system-architecture/testing.md)).

## Performance and limits

D1 bills rows read and written, not bytes; `json_each` rows count as read. Measured through the real functions on
workerd's local D1 with 5,000 tabs (42.6 MB of bodies, 10% placing 1 to 3 images) and 2,000 images, before (main at
`402d8019`) and after:

| Operation                      | Before: read / written     | After: read / written |
| ------------------------------ | -------------------------- | --------------------- |
| Usage map, one owner           | 61 / 0, plus 221 KB parsed | 51 / 0                |
| Share-visitor image read       | 11 / 0, plus 42 KB parsed  | 4 / 0                 |
| Autosave, image tab, unchanged | 3 / 5                      | 17 / 5                |
| Autosave, image-free tab       | 3 / 5                      | 4 / 5                 |
| Autosave, one image added      | 3 / 5                      | 19 / 7                |

A body write whose set changes adds one queue statement (`mediaRefQueueTabStatement`), indexed on `image_refs`; an
unchanged set queues nothing.

## Observability

The index logs nothing of its own. Its readers' refusal (`[images] not servable by document`) and the media service
reports (`[media] refs sync failed`) are in [Images](images.md#observability).

## Testing

| Rule                                                         | Test                                   |
| ------------------------------------------------------------ | -------------------------------------- |
| What a reference is                                          | `src/image-refs/extract.test.ts`       |
| Each writer maintains the index (I1), routes included        | `src/db/image-refs-writers.test.ts`    |
| Deleting a tab / document / account prunes; shared tab keeps | `src/db/image-refs-writers.test.ts`    |
| No unknown writer of `tabs`, code or migration               | `src/image-refs/writer-census.test.ts` |
| Live vs dangling, placement grants (I2, I5)                  | `src/db/image-grants.test.ts`          |
| Writers queue the media service (I3)                         | `src/media.test.ts`                    |

All run against `src/test-sqlite-d1.ts` (real SQLite, every migration); shared arrangement in
`src/db/test-image-fixtures.ts`.

## Constants and configuration

| Constant                  | Value | Provenance                          | Safe range |
| ------------------------- | ----- | ----------------------------------- | ---------- |
| `IMAGE_REF_ID_MAX_LENGTH` | 128   | Spec; gallery ids are 36-char UUIDs | 36 to 512  |

## Defaults ledger

`D1` to `D3` in [DEFAULTS.md](DEFAULTS.md); `D1` is retired there.
