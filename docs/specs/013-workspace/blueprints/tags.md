# Tags blueprint

Derived from [Tags](../tags.md). Implementation detail only; design lives in the spec.

## Domain and naming

| Term          | Identifier                                               | Where                                   |
| ------------- | -------------------------------------------------------- | --------------------------------------- |
| Tag           | `Tag` `{ id, name, colour, createdAt }`                  | `packages/api-schema/src/tags.ts`       |
| Link          | `TagLink` `{ tagId, documentId }`; table `document_tags` | api-schema, migration `0094_tags.sql`   |
| Tag list      | `TagsList` `{ tags, links }`                             | `GET /api/tags`                         |
| Tag picker    | `TagPicker`, opened through `openPicker(target)`         | `apps/live/components/tags/`            |
| Chip / dots   | `TagChip`, `DocumentTagChips`, `DocumentTagDots`         | `apps/live/components/tags/TagChip.tsx` |
| Tags page     | `SelectedNode { kind: 'tags'; id?: string }`, `TagsPane` | `apps/live/app/explorer/tags/`          |
| Panel section | `PanelSection { kind: 'tags' }`, `PanelTagsSection`      | `apps/live/components/panels/`          |

No synonyms: never "label" or "category" in code.

## Data and persistence

- `tags (id PK, owner_id, name, colour, created_at, updated_at)`; `UNIQUE INDEX tags_owner_name (owner_id, name COLLATE NOCASE)`.
- `document_tags (tag_id, document_id, created_at)`, `PRIMARY KEY (tag_id, document_id)`, both FKs `ON DELETE CASCADE`; `INDEX document_tags_document_idx (document_id)`.
- `colour` holds a `StandardColourName` or a lower-cased `#rrggbb`.
- Offline record: `OfflineDocumentRecord.tagIds?: string[]` (`offlineSetDocumentTag`, `offlineListTagLinks`).
- Owner migration (`migrateTagStatements`, in `migrateOwnerId`'s one batch): `tagsMerge` (links of a same-named guest tag onto the account's, `INSERT OR IGNORE`), `tagsMergeDrop`, then `UPDATE tags SET owner_id`. Account deletion: `DELETE FROM tags WHERE owner_id = ?`.

## Interfaces and contracts

| Route                                        | Body                   | Answers                                                              |
| -------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `GET /api/tags`                              | none                   | 200 `TagsList` (links to trashed documents left out)                 |
| `POST /api/tags`                             | `{ id, name, colour }` | 201 `{ tag }`; 400 `invalid_tag`; 409 `tag_name_taken` / `tag_limit` |
| `PUT /api/tags/:id`                          | `{ name?, colour? }`   | 200 `{ tag }`; 400 `invalid_tag`; 404; 409 `tag_name_taken`          |
| `DELETE /api/tags/:id`                       | none                   | 204; 404                                                             |
| `PUT /api/tags/:id/documents/:documentId`    | none                   | 204; 404 (not the caller's tag, or no such document via the FK)      |
| `DELETE /api/tags/:id/documents/:documentId` | none                   | 204; 404 (not the caller's tag)                                      |

Validation (shared by both sides): `normaliseTagName` (trim, collapse whitespace, 1 to `TAG_NAME_MAX` code points), `isTagColour`, `isTagId`. A malformed tag id in the path is a 404.

## Behaviour and state

- `useDocumentTagsState(ownerId, enabled)`: `status` `idle | loading | ready | error`; `request()` lifts a lazy provider to loading. A new owner clears state during render.
- Writes are optimistic: `setDocumentTag`, `createTag` (client `crypto.randomUUID()`, colour `nextTagColour`), `updateTag`, `deleteTag`. Each failure reverts its own change and toasts `tagErrorCopy`.
- A link or update to a tag whose create is in flight awaits that create (`pendingCreates`); a failed create never links.
- `DocumentTagsProvider` (eager on the Explorer page, `lazy` in the editor) hosts the single `TagPicker`; `DocumentActionsMenu` closes and calls `openPicker({ documentId, documentName, anchor })`.
- The Tags page: `useTagsPage` supplies title, breadcrumb, header actions (New Tag, one tag's menu) and the New Tag dialog; `TagsPane` renders sections through the pane's own `ViewComponent` and falls back to the Tags page for an unknown id once loaded.

## Errors and edge cases

| Case                               | Handling                                                      |
| ---------------------------------- | ------------------------------------------------------------- |
| List fails                         | `status: 'error'`, `LoadFailed` / `PaneFailed` with Try Again |
| Name taken (another tab)           | 409, revert, "You already have a tag with that name."         |
| Limit (another tab)                | 409 from the counted insert, revert, the limit line           |
| Tag deleted while a document syncs | `Promise.allSettled`: that link is left off, the sync stands  |
| Deleted tag on an offline record   | Dropped from the list by `apiListTags`                        |
| Unknown or someone else's tag id   | 404 on every write; the page falls back to `/explorer/tags`   |
| Delete 404 (already gone)          | Treated as done                                               |

## Security and trust

Every write carries `owner_id` in its statement (the insert selects from the caller's own tag), so no lookup races. Links grant no access; the page intersects them with lists the reader can already open. `tags` is in the guest-signature allow-list (`guest-rest.ts`). Names never reach telemetry or logs (`[tags] refused op=… reason=…`).

## Performance and limits

- `TAG_LIMIT` 100 bounds every tag list; the list is two indexed reads in one batch (query plans locked in `db/tags.test.ts`).
- Client indexes (`tagsFor`, `documentsFor`) are rebuilt once per change in one memo, O(links); each row reads O(tags on it).
- The provider value is memoised so readers re-render only on tag changes.
- The editor loads nothing until a panel row, menu or the Tags section reads it; `TagPicker` is a dynamic import.

## Presentation and UX, Accessibility, Web Experience

- Chips: `ROW_CHIP_MAX` 2 then `+N` (hover card and accessible name list the rest); panel and phone list rows: `PANEL_DOT_MAX` 3 dots, `role="img"` named "Tags: …".
- Picker: `role="dialog"` named "Tags for <document>"; rows `role="checkbox"` with `aria-checked`; arrows move field ↔ rows; Escape closes and refocuses the anchor (AnchoredPopover).
- Colours through the one picker (`TagColourButton`, `TagColourPopover`, inline in `TagDialog`), the editor context held off (`TagColourIsolation`).
- Brand fills follow the palette guards (brand-700, dark brand-600). No layout shift: chips render with the row once tags load (Explorer loads them with the lists); nothing on the editor's first paint.

## Observability

`Explorer·Created·Tag`, `Added·Tag`, `Removed·Tag`, `Renamed·Tag`, `Changed·TagColour`, `Deleted·Tag`; dashboard charts `TAGS_CREATED`, `TAGS_APPLIED`, `TAGS_EDITED`. Failures log `[tags] list failed` / `[tags] save failed op=…`.

## Testing

| Rule                                                            | Test                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Names, colours, ids, next colour, order                         | `packages/api-schema/src/tags.test.ts`                                                           |
| Schema: uniqueness, limit, owner, cascades, trash, merge, plans | `apps/api/src/db/tags.test.ts`                                                                   |
| Routes and refusals                                             | `apps/api/src/routes/tags.test.ts`                                                               |
| Owner-keyed ledger                                              | `apps/api/src/db/account-owner-columns.test.ts`                                                  |
| Optimistic writes and reverts                                   | `apps/live/components/tags/useDocumentTagsState.test.tsx`                                        |
| Picker                                                          | `apps/live/components/tags/TagPicker.test.tsx`                                                   |
| Chips, dots, delete copy                                        | `apps/live/components/tags/TagChip.test.tsx`                                                     |
| Colour by appearance                                            | `apps/live/components/tags/tag-colour.test.ts`                                                   |
| Offline carry-over                                              | `apps/live/lib/offline/offline-convert.test.ts`                                                  |
| Routes, sidebar rows, panel sections                            | `routes.test.ts`, `sidebar-structure.test.ts`, `panel-sections.test.ts`, `ExplorerRail.test.tsx` |

## Constants and configuration

| Constant           | Value | Safe range | Provenance             |
| ------------------ | ----- | ---------- | ---------------------- |
| `TAG_LIMIT`        | 100   | 50 to 500  | Spec "A tag"           |
| `TAG_NAME_MAX`     | 32    | 24 to 48   | Spec "A tag"           |
| `TAG_ID_MAX`       | 64    | 36 to 128  | D155                   |
| `ROW_CHIP_MAX`     | 2     | 1 to 3     | Spec "Where tags show" |
| `PANEL_DOT_MAX`    | 3     | 2 to 5     | Spec "Where tags show" |
| `TAG_PICKER_WIDTH` | 288   | 276 to 320 | D157                   |

## Defaults ledger

D154 to D162 in [DEFAULTS.md](DEFAULTS.md).
