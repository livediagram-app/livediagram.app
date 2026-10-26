# Image reference index: blueprint

Derived from [Images](../images.md), sections [Reference index](../images.md#reference-index),
[Retention](../images.md#retention-unused-image-cleanup) and the `GET /api/images/:id` and `GET /api/images/usage`
rows of [API endpoints](../images.md#api-endpoints). Images themselves, their gallery and the sweep of unplaced ones
are liveworkspace's media service's ([media.md](../../../../../liveworkspace/docs/specs/006-media/media.md) "References",
"Retention"); this blueprint covers what livedesign keeps so the service knows which images each design places. The
spec decides; this file only adds engineering precision.

## Scope, by file

| File                                            | Role                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `../packages/api-kit/src/image-refs.ts`         | The extractor: what a reference is                                                                                     |
| `apps/api/src/design-room/design-schema.ts`     | `image_refs`, its index, and the outbox triggers that queue the design's `media` key                                   |
| `apps/api/src/db/image-refs.ts`                 | Every statement on `image_refs`                                                                                        |
| `apps/api/src/db/tabs.ts`                       | `tabWriteStatements` (`upsertTab`, `upsertTabAtRev`), `seedTabs`, `swapTabData`, `deleteTabRow` carry index statements |
| `apps/api/src/design-room/design-content.ts`    | `importDesignCopy` indexes the copy's tabs from their copied bodies                                                    |
| `apps/api/src/media.ts`                         | `designImageIds`, `pushDesignMediaRefs`, `announceMediaRefs`, `forgetDesignMediaRefs`                                  |
| `apps/api/src/design-room/design-outbox.ts`     | Drains the `media` key: pushes the design's set (and grants placed images)                                             |
| `apps/api/src/db/image-grants.ts`               | `designServesImage`, `servableImageIds`: share and render reads over the index                                         |
| `apps/api/src/index.ts`                         | `scheduled()` runs the daily `announceMediaRefs`                                                                       |
| `apps/api/src/image-refs/writer-census.test.ts` | Fails when SQL writing `tabs` appears outside the known writers                                                        |

## Domain and naming

| Term               | Identifier                                        | Meaning                                                                     |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Reference          | row of `image_refs` `(tab_id, image_id)`          | Tab `tab_id` places gallery image `image_id`                                |
| Gallery id         | `isGalleryImageId(value)`                         | A string of 1 to `IMAGE_REF_ID_MAX_LENGTH` characters, not `data:`-prefixed |
| Reference ids      | `imageRefIds(elements, pages?)`                   | Distinct gallery ids of top-level image elements, then of image page fills  |
| Text scan          | `imageRefIdsFromText(data)`                       | Gallery ids after every `"imageId"` key in a body that isn't valid JSON     |
| Body ids           | `imageRefIdsFromData(data)`                       | `[]` without `"imageId"` text, else `imageRefIds` of the parse or text scan |
| Dangling reference | a reference whose `tab_id` is in no `design_tabs` | Never counted: every reader joins `design_tabs`                             |
| The design's set   | `designImageIds(env, designId)`                   | Distinct image ids its linked tabs place                                    |

Banned synonyms: "image usage table", "image links", "refcount". A reference is never counted, only present or absent.

## Behaviour and state

### Writers

Each writer appends statements to the batch that writes the body, so the index lands in the same transaction.

| Writer                              | Statements                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `tabWriteStatements` (a save)       | `imageRefReplaceStatements(env, id, imageRefIds(tab.elements, tab.pages))`                       |
| `seedTabs`                          | the same, per seeded tab                                                                         |
| `importDesignCopy`                  | per copied tab: `imageRefAddStatements(env, tabId, imageRefIdsFromData(data))`                   |
| `swapTabData` (a participant write) | add only: `imageRefAddStatements` of the new body's ids, so a lost race never drops the winner's |
| `deleteTabRow`                      | when no link is left: `imageRefPruneTabStatement` before the tab's delete                        |

`imageRefReplaceStatements` deletes the tab's references the body no longer has, then `INSERT OR IGNORE`s the rest:
a save that changes no image writes no row. A writer that only touches `element_count` or a name (`stampTabElementCount`,
`renameTab`) writes no reference.

### To the media service

- A trigger on `image_refs` (insert and delete) and on `design_tabs` (a link made or dropped for a tab that places
  images) queues the design's `media` outbox key in the same transaction.
- The design's alarm drains the outbox: it reads the set (`designImageIds`), grants the images whose owners may
  place them right now (`grantPlacedImages`, [Images](../images.md)), then `pushDesignMediaRefs` sends the whole
  set, replacing what the service held, with `complete: true`. A refusal throws, so the key stays and is retried.
- A set over `MEDIA_REFS_PER_DOCUMENT_MAX` sends the first that many and logs an error.
- The daily run (`announceMediaRefs`) tells the service livedesign's set is complete, so a quiet day never holds its
  sweep up. Every design has sent its own set from its first change, so `complete` always holds.
- A purged design tells the service it places nothing (`forgetDesignMediaRefs`, best effort).

### Readers

- **Share read** `designServesImage(env, designId, imageId, onlyTabId)`: the design places the image (`design_tabs`
  joined to `image_refs`, narrowed to one tab for a tab-scoped visitor) and may serve it
  ([Images](../images.md) "Placement grants").
- **Render read** `servableImageIds(env, designId, ids)`: of a tab's ids, those the design may serve; the thumbnail
  reads bytes only for those, the rest keep the placeholder.
- **Usage** (`GET /api/images/usage`) is the media service's answer from the sets every design sent, with names from
  the index.

### Invariants

- I1: after any committed writer batch, the tab's references equal its body ids (replace writers) or include them
  (add-only writers).
- I2: no reader counts a dangling reference.
- I3: a change to a design's set always leaves its `media` key queued until the service has taken the new set.

## Errors and edge cases

- A body that is not JSON: `imageRefIdsFromData` falls back to the text scan, over-counting rather than losing bytes.
- A shared tab ([Tab ↔ design many-to-many](../../006-design/tab-design-many-to-many.md)): its references count in
  every design that links it; dropping one link prunes nothing while another remains.
- No media service (`MEDIA_KEY` unset): nothing is pushed or announced; images are off.

## Observability

| Fingerprint                                                 | Where                  |
| ----------------------------------------------------------- | ---------------------- |
| `[media] a design places more images than one sync carries` | api (error)            |
| `[media] refs announce failed`                              | api, daily run (error) |
| `media announce failed`                                     | api, daily run (error) |

## Testing

| Rule                                               | Test                                            |
| -------------------------------------------------- | ----------------------------------------------- |
| What a reference is                                | `../packages/api-kit/src/image-refs.test.ts`    |
| Each writer maintains the index (I1)               | `apps/api/src/db/image-refs-writers.test.ts`    |
| Deleting a tab prunes; a shared tab keeps its refs | `apps/api/src/db/image-refs-writers.test.ts`    |
| No unknown writer of `tabs`, schema included       | `apps/api/src/image-refs/writer-census.test.ts` |

## Constants and configuration

| Constant                      | Value       | Provenance                           |
| ----------------------------- | ----------- | ------------------------------------ |
| `IMAGE_REF_ID_MAX_LENGTH`     | 128         | Spec; gallery ids are 36-char UUIDs  |
| `MEDIA_REFS_PER_DOCUMENT_MAX` | 1000        | `@liveworkspace/media` (`limits.ts`) |
| Daily run                     | `0 3 * * *` | `apps/api/wrangler.toml`             |
