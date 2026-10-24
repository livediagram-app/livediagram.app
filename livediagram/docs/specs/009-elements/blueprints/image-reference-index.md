# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Retention](../images.md#retention-unused-image-cleanup) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file (all under `apps/api/`):

| File                                    | Role                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/image-refs/extract.ts`             | The JavaScript extractor: what a reference is                                                 |
| `src/db/image-refs.ts`                  | The writers' statements, and the document's own reads (its set; whether it places an image)   |
| `src/routes/images.ts`                  | The usage map (`usageOf`): the media service's references, kept to canvases the index answers |
| `src/db/tabs.ts`                        | `upsertTab`, `seedTabs`, `swapTabData` carry index statements; `deleteTabRow` cascades        |
| `src/document-room/document-content.ts` | `importDocumentCopy` indexes a copy from its bodies                                           |
| `src/document-room/document-schema.ts`  | `image_refs`, and the outbox triggers that key a change to it                                 |
| `src/document-room/document-outbox.ts`  | The push: the placement grants, then the whole set to the media service                       |
| `src/db/image-grants.ts`                | Placement grants, in the document's own SQLite, through `@liveworkspace/index-app`            |
| `src/db/documents.ts`                   | `purgeDocumentRows` deletes a purged canvas's cached snapshots                                |
| `src/image-refs/writer-census.test.ts`  | Fails when SQL writing `tabs` appears outside the known writers                               |

## Domain and naming

| Term          | Identifier                               | Meaning                                                                     |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Reference     | row of `image_refs` `(tab_id, image_id)` | Tab `tab_id` places gallery image `image_id` (in the document's own SQLite) |
| Document set  | `documentImageIds(env, documentId)`      | Every image the document places, each once, from its `image_refs`           |
| Gallery id    | `isGalleryImageId(value)`                | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed |
| Reference ids | `imageRefIds(elements)`                  | Distinct gallery ids of top-level `type: 'image'` elements, document order  |
| Text scan     | `imageRefIdsFromText(data)`              | Gallery ids after every `"imageId"` key in a body that isn't valid JSON     |
| Body ids      | `imageRefIdsFromData(data)`              | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan |

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
(`documentImageIds`), then, in order:

1. `grantPlacedImages(env, documentId, ids, editorKeys, now)`: the placement grants below.
2. `media.syncRefs`: the whole set (at most `MEDIA_REFS_PER_DOCUMENT_MAX`) to the media service, replacing what it
   held, so its sweep sees every reference ([Images](images.md#retention)). A purged document sends an empty set.

### Readers

**Usage** `usageOf` (`routes/images.ts`): the media service's references for the owner (`media.usage`), kept to
this app's documents, at most `USAGE_DOCUMENTS_MAX`, each named by the index (`USAGE_LOOKUPS_IN_FLIGHT` at a time) and
dropped when the index does not answer it as the caller's, folded into `Record<imageId, { id, name }[]>`.

**Share read**: the byte route (`routes/images.ts`) resolves the caller's grant from the index, then asks the document
one RPC, `servesImage(imageId, onlyTabId)`, answered from its own SQLite:

- `documentPlacesImage(env, documentId, imageId, onlyTabId)` (`db/image-refs.ts`): the document places the image
  (`document_tabs` ⋈ `image_refs`, `[AND dt.tab_id = ?]`), so a placement serves before any push.
- `documentMayServeImage(env, documentId, imageId)` (`db/image-grants.ts`): `SERVES`, where the image's owner owns
  the document, is `ENTITLED` (the placement writer's condition below, at the current time), or the document holds
  an `image_grants` row for it. The owner is as the media service names it, asked once per image and kept in
  `image_owners` (`''` for an id the service does not know, which serves nowhere).

A refusal logs `[images] not servable by document` with the document and image ids.

**Render read** `servableImageIds(env, documentId, ids)`: of a tab's ids, those `SERVES` admits, one query over a
bound JSON array. `thumbnail.ts` `loadEmbeddedImages` reads the media service only for those; the rest keep the placeholder.

### Placement grants

`image_grants (image_id, created_at)` in the document's own SQLite, primary key `image_id`, `WITHOUT ROWID`
(`@liveworkspace/index-app` `image-grants.ts` holds the rules; `db/image-grants.ts` supplies the media service's
owner lookup, `mediaOwner` and a team's joined people from liveworkspace accounts).

- **Placement writer** `grantPlacedImages(env, documentId, ids, editorKeys, now)`, run by the push with the
  document's whole set: `INSERT OR IGNORE` one row per placed image whose owner is not the document's owner AND is
  `ENTITLED`: a joined member of the document's team, or a person who wrote to it since its last push (an edit key in
  its outbox, `editorKeys`). No row for an empty id list.
- **Copy writer** `importDocumentCopy` (`document-content.ts`): `INSERT OR IGNORE` the copy's grants for each image
  its source could serve and its own bodies place.
- A purged document's grants go with its object.
- I5: a document serves an image only if `SERVES` holds; a grant is written only by the writers above.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: after a push, the media service holds the document's set as the distinct ids of its references.
- I3: every change to a document's set keys a push, so the media service, whose sweep reads only what the apps
  report, hears of every reference (the spec's
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

-- the same SQLite (@liveworkspace/index-app image-grants.ts)
CREATE TABLE image_owners (image_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE image_grants (image_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL) WITHOUT ROWID;
```

`image_refs` is derived data, rebuilt from `tabs.data` by the writers; `image_owners` is a cache of the media
service's answer. None is owner-keyed, so neither account deletion nor an owner change lists them in
[Owner-keyed data](../../015-api/api.md#owner-keyed-data); each goes with its document's object.

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
| No `MEDIA_KEY`                                         | The index is still maintained; nothing is sent to the media service      |

## Security and trust

The share-read check authorises bytes to a share visitor, so it must never say yes to an image the document doesn't
place, nor to one it places but may not serve (an id written into a document its owner has no tie to; see
[Placement grants](#placement-grants)). The server renderer applies the same rule before reading the media service. A
reference exists only from a body that placed the image; the add-only writers can leave one behind only when a
concurrent write raced, and only for an id that tab's body carried. No input reaches SQL unbound: ids travel as one
bound JSON array read by `json_each`. The modules above are held to 100% coverage
([Testing](../../003-system-architecture/testing.md)).

## Performance and limits

The writers run in the document's own SQLite, inside the save's one transaction: no network call on a save. Measured
on a laptop (CPU time, node:sqlite standing in for the object's SQLite; `document-room-store.test.ts` keeps budgets on
them): a tab placing 500 images saves in about 7 ms, its push takes about 1.5 ms, and a save that keeps the set takes
about 3 ms and keys no push. The byte endpoint's share read is one index grant and one RPC to the document.

## Observability

| Fingerprint                                                   | Level | When                   |
| ------------------------------------------------------------- | ----- | ---------------------- |
| `[images] not servable by document`                           | warn  | The share read refuses |
| `[media] a document places more images than one sync carries` | error | Set over the sync cap  |

## Testing

| Rule                                                   | Test                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| What a reference is                                    | `src/image-refs/extract.test.ts`                |
| Each writer maintains the index (I1), routes included  | `src/db/image-refs-writers.test.ts`             |
| The push sends the set (I2) and grants (I3)            | `src/document-room/document-outbox.test.ts`     |
| Deleting a tab / document / account drops them         | `src/db/image-refs-writers.test.ts`             |
| No unknown writer of `tabs` anywhere in the apps       | `src/image-refs/writer-census.test.ts`          |
| Placement grants (I5)                                  | `src/db/image-grants.test.ts`                   |
| The media service hears of every change (I3)           | `src/media.test.ts`                             |
| The share read answered by the document, before a push | `src/document-room/document-room-store.test.ts` |

All run against `src/test-sqlite-d1.ts` (real in-memory SQLite with the document's schema); shared arrangement
in `src/db/test-image-fixtures.ts`.

## Constants and configuration

| Constant                  | Value | Provenance                          | Safe range |
| ------------------------- | ----- | ----------------------------------- | ---------- |
| `IMAGE_REF_ID_MAX_LENGTH` | 128   | Spec; gallery ids are 36-char UUIDs | 36 to 512  |

## Defaults ledger

`D1` to `D3` in [DEFAULTS.md](DEFAULTS.md).
