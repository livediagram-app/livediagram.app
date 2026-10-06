# Item types blueprint

Derived from [Item types](../item-types.md). Contract for the type catalogue: its model and checks in
`@livediagram/items`, its column and route in the api, and the editor's panel, type editor and consumers.

## Domain and naming

| Spec term         | Identifier                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| item type         | `ItemTypeDef` (`item-types.ts`): `id`, `label`, `newTitle`, `glyph`, `color`, `fields`, `custom?` |
| type catalogue    | `ItemTypeCatalogue` `{ version: 1, types }` (`type-catalogue.ts`); null = built-ins               |
| custom field      | `CustomFieldDef` `{ id, label, kind, options?, onCard? }`; kinds `CUSTOM_FIELD_KINDS`             |
| glyph set         | `PLAN_GLYPHS` (`glyphs.ts`), ids `PlanGlyphId`; `planGlyphPath(id)`                               |
| card type (UI)    | the panel `CardTypesPanel`, its button `CardTypesClusterButton`, the editor `ItemTypeEditor`      |
| Restore Built-Ins | `ItemTypesSlice.restoreBuiltIns()` (saves null)                                                   |

## Package `@livediagram/items`

```
src/glyphs.ts          PLAN_GLYPHS, PLAN_GLYPH_IDS, planGlyphPath, isPlanGlyphId
src/type-catalogue.ts  ItemTypeCatalogue, limits, PLAN_TYPE_COLOURS, BUILT_IN_FIELD_IDS, REQUIRED_TYPE_FIELDS,
                       typesOf, typeIn, typeByNameIn, customFieldOf, isBuiltInFieldId, slugOf,
                       newItemTypeId, newCustomFieldId, defaultNewTitle, validateItemTypeCatalogue,
                       readItemTypeCatalogue, builtInCatalogue
src/slug.ts            slugText, cutSlug, uniqueSlug (accents folded, `-2`, `-3` on a clash; shared with
                       @livediagram/document's agent element ids)
```

- `validateItemTypeCatalogue(input)`: version 1; 1 to `ITEM_TYPES_MAX` types; each `id` matches
  `ITEM_TYPE_PATTERN` and is not `item`; `label` 1 to 32 characters, unique ignoring case; `color` `#rrggbb`;
  `glyph` in the set; `custom` up to 12, ids `CUSTOM_FIELD_ID_PATTERN` and unique, labels 1 to 32, kind known,
  Choice 1 to 20 unique options of up to 40 characters; `fields` only built-in or own custom ids, deduplicated,
  `title` and `status` put first, at most 24; `newTitle` defaults to "New <name>"; JSON at most
  `ITEM_TYPES_BYTES`. Answers `{ ok, catalogue }` (normalised) or `{ ok: false, reason }` naming the part.
- `readItemTypeCatalogue(raw)`: a stored value (string or object) that validates, else null (built-ins).
- `projectBoard(setup, items, quick?, types = ITEM_TYPES)`, `itemAccessibleName(item, types?)`,
  `parseQuickAdd(text, people?, types?)`: the catalogue where they name or order types. Quick add's prefix is
  `/^([A-Za-z][A-Za-z0-9 -]{0,31}):\s*/`, kept only when it names a type.

## Data and persistence

- Migration `0072_item_types.sql`: `documents.item_types TEXT NULL`.
- `db/documents.ts`: `DocumentDTO.itemTypes` read through `readItemTypeCatalogue`; written by the create's
  INSERT (copy, sync, Drive) and by `setDocumentItemTypes(env, id, catalogue | null)`; `copyDocument` copies the
  column. Never in a meta upsert's UPDATE.
- Offline: `OfflineDocumentRecord.itemTypes?`; `offlineSaveItemTypes(id, catalogue, now)`; `recordToDocument`
  reads it back. Duplicate (both paths), Sync to Cloud, Take Offline and the Drive envelope
  (`DocumentEnvelope.document.itemTypes?`, still version 1) carry it.

## Interfaces and contracts

| Method | Path                             | Gate                 | Body               | Answer              |
| ------ | -------------------------------- | -------------------- | ------------------ | ------------------- |
| PUT    | `/api/documents/{id}/item-types` | edit, whole document | `ItemTypesRequest` | `ItemTypesResponse` |

- 400 `{ error: 'item_types_invalid', reason }` for a catalogue that fails; 400 for no `itemTypes` key or bad
  JSON; 403 for a view grant or a tab-scoped one; 405 for any other method. The create accepts `itemTypes`
  under the same check.
- Room: `relayItemTypes` broadcasts `{ kind: 'item-types', itemTypes }` ordered; `item-types` is a system op
  kind and in `room-scope`'s tab-less delivered set.

## Editor

- `editor-persistence`: `documentItemTypes` state, seeded by `seed-fetched-document`.
- `hooks/plan/useItemTypes.ts` (`ItemTypesSlice`): `types`, `saveType`, `deleteType` (never the last),
  `reorder`, `restoreBuiltIns`, `receive`. A change is optimistic, saved whole through `lib/api/item-types.ts`
  (`saveItemTypes`, offline-aware), kept as answered, reverted with "Couldn’t save the card types" on failure,
  and pushed as one undo step (undo and redo replay a save without a step).
- `PlanContext`: `types`, `itemTypes`, `editType(id | 'new')`; `usePlanSlice` holds `editingTypeId`.
- Consumers: `PlanCardFace` (stripe, glyph, Show on card lines via `custom-field-text.ts`), `ItemPanel` (the
  type's field order, `CustomFieldEditor`), `AddCardPopover`, `PlanBoardView`
  (projection), `PlanBoardCells`/`PlanCardView` names, `newCardItemWrite`,
  the palette's Cards (`PalettePlanCardsTab`) and Popular (`PlanAwareTileGrid`, `withDocumentCardTiles`),
  SVG export and thumbnails (`itemTypes` render option), the MCP's previews.
- `CardTypesClusterButton` (on `ClusterPopoverButton`, shared with Slides) opens dock panel `card-types`;
  `CardTypesPanel` is a `MovablePanel` popover; `ItemTypeEditor` + `ItemTypeFieldList` the modal (`Dialog`,
  `size="lg"`, `phoneSheet`), rendered by `PlanSheetsHost`. Delete with items patches each to the chosen type
  first.

## Tabs

- `ItemTypeDef.tabs?: ItemTypeTab[]` (`{ id: /^t-[a-z0-9-]{1,30}$/, label ≤ ITEM_TYPE_TAB_LABEL_MAX (24), fields }`),
  at most `ITEM_TYPE_TABS_MAX` (6). `readTabs` rejects a bad id, an empty or repeated label (ignoring case), or
  non-array fields; it drops fields the type does not offer, `title`, `votes`, and any field an earlier tab holds.
- `tabsOf(type)`: the tabs with unoffered fields filtered; absent, one `OVERVIEW_TAB_ID` tab "Overview" of
  description, checklist and long-text custom fields. `detailFieldsOf(type)`: the type's fields in no tab, minus
  title and votes. `newTabId(label, taken)`.
- Editor: `ItemTypeTabsEditor` (rename, ↑↓ `moveTab`, ×, Add Tab "New Tab", a Shows In select per field via
  `fileField`); the type editor starts from `tabsOf(type)` and saves `tabs` explicitly. Problems: "Give every tab a
  name.", "Two tabs have the same name."

## Errors and edge cases

| Case                               | Handling                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| Stored catalogue unreadable        | Built-ins (`readItemTypeCatalogue` null)                     |
| Item of a type the catalogue lacks | Drawn as `FALLBACK_ITEM_TYPE` "Item"; card tile makes a Task |
| Custom value of the wrong kind     | Shown empty; replaced by the next edit                       |
| Field taken off a type             | Values kept in `fields`; shown again if it returns           |
| Deleting the last type             | Not offered (`canDelete`); `deleteType` refuses              |
| Save fails                         | Previous catalogue back, toast                               |

## Security and trust

- Only whole-document editors write the catalogue; it holds names and colours, no content, so tab-scoped
  sessions hear it. The api validates every write; the editor validates before saving (same function).

## Performance and limits

- 32 types × 24 fields × 12 custom fields fits `ITEM_TYPES_BYTES` (32 KB); the op carries the catalogue whole.

## Accessibility and UX

- Panel rows are focusable list items named "<Name>, N items"; Alt+Up/Down reorders, announced. Swatches and
  glyphs are radio groups with names ("Cyan", "Chat glyph"). The editor's problems are named in text beside
  Save. Copy: "Card Types", "+ Add Type", "Restore Built-In Types", "New Card Type", "Edit Card Type",
  "+ Add Field", "Built-In Fields", "New Custom Field", "Add Custom Field", "Show on card", "Delete Type",
  "Keep as Item".

## Observability

- `[item-types] item-types.saved` / `item-types.rejected` (api); `[item-types] saved` / `save failed`
  (editor debug log).

## Testing

| Rule                                                     | Test                                                      |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Catalogue checks, ids, read-back, glyphs                 | `packages/items/src/type-catalogue.test.ts`               |
| Quick add's type names                                   | `packages/items/src/quick-add.test.ts`                    |
| Route: store, relay, null, refusals, gates, copy, create | `apps/api/src/routes/item-routes.test.ts`                 |
| Scoped sessions hear the op                              | `apps/api/src/room-scope.test.ts`                         |
| Card tiles follow the catalogue                          | `apps/live/components/palette/palette-plan-tiles.test.ts` |
| Custom values on a card                                  | `apps/live/components/plan/custom-field-text.test.ts`     |
| Panel, editor, card face, palette in a browser           | checked by hand against the dev stack (screenshots)       |

## Constants and configuration

| Constant                    | Value  | Why                                                                  |
| --------------------------- | ------ | -------------------------------------------------------------------- |
| `ITEM_TYPES_MAX`            | 32     | Spec "An item type"                                                  |
| `ITEM_TYPE_FIELDS_MAX`      | 24     | Spec                                                                 |
| `ITEM_TYPE_CUSTOM_MAX`      | 12     | Spec                                                                 |
| `ITEM_TYPE_LABEL_MAX`       | 32     | Spec                                                                 |
| `CUSTOM_CHOICE_OPTIONS_MAX` | 20     | Spec                                                                 |
| `CUSTOM_CHOICE_OPTION_MAX`  | 40     | D11                                                                  |
| `ITEM_TYPES_BYTES`          | 32,768 | Spec "Limits and validation"                                         |
| `PLAN_TYPE_COLOURS`         | 12     | The built-ins' five (Black, Gray, Blue, Yellow, Red) then seven more |

## Built-in types

`ITEM_TYPES`: `project` (#18181b), `task` (#71717a), `note` (#2563eb), `idea` (#eab308), `action` (#dc2626).
Presets set the types a board adds (Sprint: Tasks and Actions, Bug triage: Tasks, Roadmap: Projects); the item panel's
Parent lists Projects. `CardTypesPanel` rows are cards (stripe, tinted glyph tile, "N fields", count pill,
pencil; the row opens the editor), with a dashed Add Type tile.
