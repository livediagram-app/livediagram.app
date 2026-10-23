# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Placement grants](../images.md#placement-grants) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/api/`):

| File                                    | Role                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/image-refs/extract.ts`             | The JavaScript extractor: what a reference is                                               |
| `src/db/image-refs.ts`                  | The writers' statements, and the document's own reads (its set; whether it places an image) |
| `src/routes/images.ts`                  | The usage map (`usageOf`): the media service's references, named by the index               |
| `src/db/tabs.ts`                        | `upsertTab`, `seedTabs`, `swapTabData` carry index statements; `deleteTabRow` cascades      |
| `src/document-room/document-content.ts` | `importDocumentCopy` indexes a copy from its bodies                                         |
| `src/document-room/document-schema.ts`  | `image_refs`, and the outbox triggers that key a change to it                               |
| `src/document-room/document-outbox.ts`  | The push: the document's whole set to the media service, and the placement grants it earns  |
| `src/image-refs/writer-census.test.ts`  | Fails when SQL writing `tabs` appears outside the known writers                             |

## Domain and naming

| Term          | Identifier                               | Meaning                                                                                      |
| ------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Reference     | row of `image_refs` `(tab_id, image_id)` | Tab `tab_id` places gallery image `image_id` (in the document's own SQLite)                  |
| Document set  | `documentImageIds(env, documentId)`      | Every image the document places, read from its references; pushed whole to the media service |
| Gallery id    | `isGalleryImageId(value)`                | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed                  |
| Reference ids | `imageRefIds(elements)`                  | Distinct gallery ids of top-level `type: 'image'` elements, document order                   |
| Text scan     | `imageRefIdsFromText(data)`              | Gallery ids after every `"imageId"` key in a body that isn't valid JSON                      |
| Body ids      | `imageRefIdsFromData(data)`              | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan                  |

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
(`documentImageIds`) and, in `pushImageRefs`:

1. `grantPlacedImages(env, documentId, ids, editorKeys, now)`: the [placement grants](#placement-grants) the set
   earns.
2. `media.syncRefs({ documents: [{ document, images }], complete: true })`: the whole set to the media service
   ([Images](images.md#retention)).

### Readers

**Usage** `usageOf` (`routes/images.ts`): the media service's answer of which documents place each of the owner's
images, kept to this app's documents the index answers as the owner's and not in the Trash, folded into
`Record<imageId, { id, name }[]>` ordered by name (`D3`).

**Share read**, one `servesImage` RPC to the document from the byte route (`routes/images.ts`), answered from its own
SQLite in order:

- `documentPlacesImage(env, documentId, imageId, onlyTabId)` (`db/image-refs.ts`): the document places the image
  (`document_tabs` ⋈ `image_refs`, `[AND dt.tab_id = ?]`), so a placement serves before any push.
- `documentMayServeImage(env, documentId, imageId)` (`db/image-grants.ts`, the kit's placement grants): the image's
  owner (its `image_owners` row, else asked of the media service once and kept) owns the document, the document
  holds an `image_grants` row for it, or the owner is entitled right now (below).

A refusal logs `[images] not servable by document` with the document and image ids.

**Render read** `servableImageIds(env, documentId, ids)`: of a tab's ids, those the same rule admits.
`thumbnail.ts` `loadEmbeddedImages` reads the media service only for those; the rest keep the placeholder.

### Placement grants

`image_grants (image_id, created_at)`, primary key `image_id`, `WITHOUT ROWID`, in the document's own SQLite
(`document-schema.ts`), with `image_owners (image_id, owner_id)` beside it.

- **Placement writer** `grantPlacedImages(env, documentId, ids, editorKeys, now)`, run by the push with the
  document's whole set: one row per placed image whose owner is not the document's owner and is entitled now, a
  joined member of the document's team (liveworkspace's team people) or someone who wrote to the document since its
  last push (`editorKeys`, the outbox's edit keys). No row for an empty id list.
- **Copy writer** `grantImages`, in `importCopy` (the index's copy door): the target gets a grant for each id the
  source could serve, carried in the copy.
- **Removal**: the document's purge deletes its whole storage, grants and owners with it.
- I5: a document serves an image only if the rule holds; a grant is written only by the writers above.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: every change to a document's references keys its outbox, and its push sends the whole set, so the media
  service, whose sweep reads only what the apps report, hears of every reference within about a minute (the spec's
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
CREATE INDEX image_refs_image_idx ON image_refs (image_id);
```

Derived data, rebuilt from `tabs.data` by the writers. Not owner-keyed, so neither account deletion nor owner
migration lists it in [Owner-keyed data](../../015-api/api.md#owner-keyed-data).

## Errors and edge cases

| Case                                                   | Handling                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `imageId` is a `data:` URI or longer than 128          | Not a reference                                                          |
| Two elements place the same image                      | One row (primary key); `imageRefIds` is distinct                         |
| `elements` is an object, or missing                    | No references, on both extractors                                        |
| Corrupt body with no usable id                         | Warned with `(0 ids)`; nothing written                                   |
| Swap loses its compare                                 | Add-only statements may add references the stored body lacks: over-keeps |
| Tab deleted                                            | Its references go with it; the next push sends the smaller set           |
| Image deleted from the gallery, references left behind | Harmless; they go when the element does                                  |
| A push fails                                           | Its keys stay; the next drain, a minute later, sends the whole set again |
| No `MEDIA_KEY`                                         | The index is still maintained; the push sends nothing                    |

## Security and trust

The share-read check authorises bytes to a share visitor, so it must never say yes to an image the document doesn't
place, nor to one it places but may not serve (an id written into a document its owner has no tie to; see
[Placement grants](#placement-grants)). The server renderer applies the same rule before reading the media service. A
reference exists only from a body that placed the image; the add-only writers can leave one behind only when a
concurrent write raced, and only for an id that tab's body carried. No input reaches SQL unbound: ids travel as one
bound JSON array read by `json_each`. The modules above are held to 100% coverage
([Testing](../../003-system-architecture/testing.md)).

## Performance and limits

The writers run in the document's own SQLite, inside the save's one transaction: no network round trip on a save. Measured
on a laptop (CPU time, node:sqlite standing in for the object's SQLite; `document-room-store.test.ts` keeps budgets on
them): a tab placing 500 images saves in about 7 ms, its push takes about 1.5 ms, and a save that keeps the set takes
about 3 ms and keys no push. The byte endpoint's share read is one RPC to the document, answered from its own SQLite.

## Observability

The index logs nothing of its own. Its readers' refusal (`[images] not servable by document`) and the media service
reports (`[media] refs sync failed`) are in [Images](images.md#observability).

## Testing

| Rule                                                   | Test                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| What a reference is                                    | `src/image-refs/extract.test.ts`                |
| Each writer maintains the index (I1), routes included  | `src/db/image-refs-writers.test.ts`             |
| The push sends the whole set and grants (I2)           | `src/document-room/document-outbox.test.ts`     |
| Deleting a tab / document / account drops them         | `src/db/image-refs-writers.test.ts`             |
| No unknown writer of `tabs`, code or migration         | `src/image-refs/writer-census.test.ts`          |
| Placement grants (I5)                                  | `src/db/image-grants.test.ts`                   |
| The media service hears of every change (I3)           | `src/media.test.ts`                             |
| The share read answered by the document, before a push | `src/document-room/document-room-store.test.ts` |

All run against `src/test-sqlite-d1.ts` (real SQLite, every migration and the document's schema); shared arrangement
in `src/db/test-image-fixtures.ts`.

## Constants and configuration

| Constant                  | Value | Provenance                          | Safe range |
| ------------------------- | ----- | ----------------------------------- | ---------- |
| `IMAGE_REF_ID_MAX_LENGTH` | 128   | Spec; gallery ids are 36-char UUIDs | 36 to 512  |

## Defaults ledger

`D1` to `D3` in [DEFAULTS.md](DEFAULTS.md); `D1` is retired there.
