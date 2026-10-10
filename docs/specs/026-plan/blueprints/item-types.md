# Item types blueprint

Derived from [Item types](../item-types.md). Contract for the type catalogue: its model and checks in
`@livediagram/items`, its column and route in the api, and the editor's panel, type editor and consumers.

## Domain and naming

| Spec term         | Identifier                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| item type         | `ItemTypeDef` (`item-types.ts`): `id`, `label`, `newTitle`, `glyph`, `color`, `fields`, `custom?`            |
| type catalogue    | `ItemTypeCatalogue` `{ version: 1, types }` (`type-catalogue.ts`); null = not chosen (defaults)              |
| custom field      | `CustomFieldDef` `{ id, label, kind, options?, linkType?, onCard? }`; kinds `CUSTOM_FIELD_KINDS`             |
| glyph set         | `PLAN_GLYPHS` (`glyphs.ts`), ids `PlanGlyphId`; `planGlyphPath(id)`; `PLAN_GLYPH_CATEGORIES`                 |
| card type (UI)    | the panel `CardTypesPanel`, its button `CardTypesClusterButton`, the editor `ItemTypeEditor`                 |
| Add Default Types | `ItemTypesSlice.addDefaultTypes()` (`defaultTypesToAdd`, appended; one undo step), behind a `ConfirmPopover` |
| default types     | `ITEM_TYPES` (`item-types.ts`); ready-made types `READY_MADE_CARD_TYPES` (`brought-types.ts`)                |

## Package `@livediagram/items`

```
src/glyphs.ts          PLAN_GLYPHS, PLAN_GLYPH_IDS, PLAN_GLYPH_CATEGORIES, PLAN_GLYPH_KEYWORDS, planGlyphLabel,
                       planGlyphPath, isPlanGlyphId, glyphMatches
src/type-catalogue.ts  ItemTypeCatalogue, limits, PLAN_TYPE_COLOURS, BUILT_IN_FIELD_IDS, REQUIRED_TYPE_FIELDS,
                       typesOf, typeIn, customFieldOf, isBuiltInFieldId, slugOf,
                       newItemTypeId, newCustomFieldId, defaultNewTitle, validateItemTypeCatalogue,
                       readItemTypeCatalogue, builtInCatalogue
src/slug.ts            slugText, cutSlug, uniqueSlug (accents folded, `-2`, `-3` on a clash; shared with
                       @livediagram/document's agent element ids)
```

- `validateItemTypeCatalogue(input)`: version 1; 1 to `ITEM_TYPES_MAX` types; each `id` matches
  `ITEM_TYPE_PATTERN` and is not `item`; `label` 1 to 32 characters, unique ignoring case; `color` `#rrggbb`;
  `glyph` in the set; `custom` up to 12 (`customFieldCount`, which never counts Parent), ids
  `CUSTOM_FIELD_ID_PATTERN` (`f-` and a slug, or the reserved `parent`) and unique, labels 1 to 32, kind known,
  Choice 1 to 20 unique options of up to 40 characters; Card a `linkType` matching `ITEM_TYPE_PATTERN` (a type the
  catalogue lacks is kept); `fields` only built-in or own custom ids, deduplicated (a stored type naming `parent` without defining it gains
  `PARENT_FIELD`),
  `title` and `status` put first, at most 24; `newTitle` defaults to "New <name>"; JSON at most
  `ITEM_TYPES_BYTES`. Answers `{ ok, catalogue }` (normalised) or `{ ok: false, reason }` naming the part.
- `readItemTypeCatalogue(raw)`: a stored value (string or object) that validates, else null (built-ins).
- `projectBoard(setup, items, quick?, types = ITEM_TYPES)`, `itemAccessibleName(item, types?)`,
  `boardAddTypes(setup, types)`: the catalogue where they name or order types.

## Data and persistence

- Migration `0072_item_types.sql`: `documents.item_types TEXT NULL`. Migration `0081_item_types_rev.sql`:
  `documents.item_types_rev INTEGER NOT NULL DEFAULT 0`.
- `db/documents.ts`: `DocumentDTO.itemTypes` read through `readItemTypeCatalogue`, `DocumentDTO.itemTypesRev`
  (0 when absent); written by the create's INSERT (copy, sync, Drive; the revision starts at 0) and by
  `setDocumentItemTypes(env, id, catalogue | null, expectedRev?)`, one guarded UPDATE raising `item_types_rev` and
  returning it, or null when `expectedRev` is given and no longer stored; `copyDocument` copies the column. Never in
  a meta upsert's UPDATE.
- Offline: `OfflineDocumentRecord.itemTypes?`; `offlineSaveItemTypes(id, catalogue, now)`; `recordToDocument`
  reads it back. Duplicate (both paths), Sync to Cloud, Take Offline and the Drive envelope
  (`DocumentEnvelope.document.itemTypes?`, still version 1) carry it.

## Interfaces and contracts

| Method | Path                             | Gate                 | Body               | Answer              |
| ------ | -------------------------------- | -------------------- | ------------------ | ------------------- |
| PUT    | `/api/documents/{id}/item-types` | edit, whole document | `ItemTypesRequest` | `ItemTypesResponse` |

- `ItemTypesRequest = { itemTypes, expectedRev? }`; `ItemTypesResponse = { itemTypes, itemTypesRev }`.
- 400 `{ error: 'item_types_invalid', reason }` for a catalogue that fails; 400 for no `itemTypes` key, bad JSON or
  an `expectedRev` that is not a whole number from 0; 403 for a view grant or a tab-scoped one; 405 for any other
  method; 409 `ItemTypesStale` `{ error: 'item_types_stale', itemTypes, itemTypesRev }` (what is stored) when
  `expectedRev` has moved on, nothing written or relayed. The create accepts `itemTypes` under the same check.
- `PlanResponse.itemTypesRev` (the plan route): what an agent's change names.
- Room: `relayItemTypes` broadcasts `{ kind: 'item-types', itemTypes, itemTypesRev }` ordered; `item-types` is a
  system op kind and in `room-scope`'s tab-less delivered set.

## Editor

- `editor-persistence`: `documentItemTypes` state, the catalogue as stored with its revision (`SavedItemTypes
{ itemTypes, itemTypesRev }`), seeded by `seed-fetched-document`.
- `packages/items/src/type-catalogue-change.ts`: `CatalogueChange { before, after }`, `rebaseCatalogueChange(current,
change)` (exactly `after` on `before`; otherwise deleted types removed, changed ones replaced, added ones placed after
  the type they follow in `after`, first when they lead, last when that type is gone; never empty) and
  `inverseCatalogueChange`.
- `hooks/plan/useItemTypes.ts` (`ItemTypesSlice`): `catalogue` (stored with the pending changes rebased over it),
  `types`, `saveType`, `deleteType` (never the last), `addTypes`, `addDefaultTypes`, `saveCatalogue` (a whole
  catalogue, one step), `receive` (a room op at a lower revision than held is ignored). A change is a
  `CatalogueChange` from the catalogue shown, pending at once, saved one at a time through `lib/api/item-types.ts`
  (`saveItemTypes(scope, catalogue, expectedRev)`, offline-aware) as `rebaseCatalogueChange(stored, change)` naming the
  stored revision; the answer becomes the stored catalogue. `ItemTypesStaleError` (the 409) takes the stored catalogue
  it carries and sends again, up to `ITEM_TYPES_SAVE_ATTEMPTS` (3); any other failure, or the last stale one, drops
  only that change with "Couldn’t save the card types". Each change is one undo step: undo makes
  `inverseCatalogueChange(change)`, redo the change, each as a new pending change without a step.
- Agents (`packages/agent-verbs`): `changeCardTypes` reads the plan, applies its changes and saves naming
  `plan.itemTypesRev`; `bringBoardCardTypes` names the document's `itemTypesRev`. A stale refusal reads again and
  applies again, up to `CARD_TYPES_SAVE_ATTEMPTS` (3), then answers the `item_types_stale` refusal.
- `PlanContext`: `types`, `itemTypes`, `editType(id | 'new')`; `usePlanSlice` holds `editingTypeId`.
- Parent: `PARENT_FIELD_ID` (`'parent'`) and `PARENT_FIELD` (`{ id: 'parent', label: 'Parent', kind: 'card',
linkType: 'project' }`) in item-types.ts; Task and the brought Bug and Story carry it in `custom`. The old grouping
  (`LEGACY_PARENT_GROUPING`, `swimlaneBy: 'parent'`) stays valid on boards, views and search filters and is read as
  the field: `normaliseBoardSetup`, and `legacy-parent.ts` (`readGrouping`, `readCardSearchFilter`: `e:{id}` keys to
  `f:"{id}"`, `readPlanViewSettings`, used by `PlanViewView` and `PlanViewMenuSection`).
- Card fields: `card-links.ts` (packages/items) is the one reading of links: `linkFieldsOfType(type)`, `linkCandidates(items, linkType, selfId)` (live, not archived, number
  order, never self), `linkText` ("Missing card"), and `linkedCardsOf(target, items, types)`: groups
  `{ fieldId, label, fromTypes, cards }`, one per Card field whose `linkType` is the target's type (Parent for a
  Project), trashed cards left out. `LinkedCardField` (apps/live) is the shared control for every Card field
  (`ItemFieldEditor`), an in-place listbox (inside the panel's focus trap) with a filter past
  `LINK_FILTER_FROM` (8), Escape taken in the capture phase. `PlanSheetsHost` passes the groups as `linkedGroups`
  (`LinkedCardGroup` in LinkedCards.tsx, `New {Type}` via `addItem` with the link
  set, first status the type uses, tracked `('Plan', 'Added', 'LinkedCard')`). `customFieldText(field, value, items)`
  names a Card value; `LaneFieldKind` gains `card` (rows named by the linked card with its `itemColourOf` dot, number
  order; the Swimlanes tile draws the linked type's glyph). `PlanCardFace` draws a Card field as a pill: the linked
  card's colour dot when it has one, else its type's glyph.
- Consumers: `PlanCardFace` (stripe, glyph, custom field chips via `custom-field-text.ts`), `ItemPanel` (the
  type's field order, `CustomFieldEditor`), `AddCardPopover`, `PlanBoardView`
  (projection), `PlanBoardCells`/`PlanCardView` names, `newCardItemWrite`,
  the palette's Cards (`PalettePlanCardsTab`) and Popular (`PlanAwareTileGrid`, `withDocumentCardTiles`),
  SVG export and thumbnails (`itemTypes` render option), the MCP's previews.
- `CardTypesClusterButton` (on `ClusterPopoverButton`, shared with Slides) opens dock panel `card-types`;
  `CardTypesPanel` is a `MovablePanel` popover; `ItemTypeEditor` + `ItemTypeLayoutEditor` (forms in `ItemTypeFieldForms`) the modal (`Dialog`,
  `size="lg"`, `phoneSheet`), rendered by `PlanSheetsHost`. Delete with items patches each to the chosen type
  first.
- Editor tabs (`ItemTypeEditorTabs`): `TYPE_EDITOR_TABS = ['configuration', 'statuses', 'display']`, labelled by
  `TYPE_EDITOR_TAB_LABELS` ("Configuration", "States", "Display"); the editor's `tab` state starts at
  `'configuration'` for a new and an edited type alike. The Configuration panel is `ItemTypeConfiguration` (its own
  file): two `<section>`s, each `aria-labelledby` its `<h3>` heading (`text-[13px] font-semibold`, above the
  `SheetRow` labels; General's heading is `sr-only` through `hideTitle`, Fields' visible), **General** (`data-tour-id="card-type-general"`: Name with the inline `GlyphPicker`, Colour;
  at `md` a two-column grid, `grid-cols-[minmax(0,20rem)_max-content]`, each `SheetRow` spanning two `subgrid` rows so
  the labels share row 1 and the controls row 2, `items-start`; the swatches sit in a `min-h-[2.375rem]` (the name field's height) flex column, `justify-center`, so the in-place custom colour picker grows down without moving Name; below `md` the rows stack as blocks)
  then **Fields** (`data-tour-id="card-type-fields"`, set off by a top border: the lead line, then
  `ItemTypeLayoutEditor`). The tab's one panel scrolls (`overflow-y-auto`). Red-dot flags: a clashing name, a tab
  problem or a custom field problem flag `configuration`; a left-out status problem flags `statuses`.
- Show Me steps (`card-type-tour-steps.ts`): `general` shows `configuration` and focuses the Name input (focus
  scrolls it into view); `fields` shows `configuration` and scrolls `card-type-fields` to the panel's top
  (`scrollIntoView({ block: 'start' })`, instant under reduced motion); `states` and `display` show their tabs.

## Tabs

- `ItemTypeDef.tabs?: ItemTypeTab[]` (`{ id: /^t-[a-z0-9-]{1,30}$/, label ≤ ITEM_TYPE_TAB_LABEL_MAX (24), fields }`),
  at most `ITEM_TYPE_TABS_MAX` (6). `readTabs` rejects a bad id, an empty or repeated label (ignoring case), or
  non-array fields; it drops fields the type does not offer, `title`, `votes`, and any field an earlier tab holds.
- `tabsOf(type)`: the tabs with unoffered fields filtered; absent, one `OVERVIEW_TAB_ID` tab "Overview" of
  description, checklist and long-text custom fields. `detailFieldsOf(type)`: the type's fields in no tab, minus
  title and votes. `newTabId(label, taken)`.
- Editor: one `LayoutDraft` (`{ fields, custom, tabs }`, `item-type-layout.ts`) edited by `ItemTypeLayoutEditor`,
  grouped by `cardFields` (title, votes), `detailFields` (Details) and each tab. Pure edits: `moveField` (within a
  group, past movable neighbours only), `fileField` (Move To), `addField` (into the group it was added in; votes
  never into a tab), `removeField` (out of fields, custom and every tab), `moveTab`, `addTab` (unnamed, id
  `newTabId('tab', ...)`), `withoutEmptyTabs`. The type editor starts from `tabsOf(type)` and saves `tabs`
  explicitly. Problems: "Give every tab a name.", "Two tabs have the same name."

## Statuses a type leaves out

- `ItemTypeDef.excludedStatuses?: string[]`, read by `readExcludedStatuses` in `readType` (strings, non-blank, at most
  `ITEM_STATUS_MAX` long, de-duplicated in order, at most `ITEM_TYPE_EXCLUDED_STATUSES_MAX`; an empty list is
  dropped). `typeAllowsStatus(type, status)` (no status is always allowed) and `statusRefusal(typeLabel,
statusName)` ("{Type} cards can't be {Status}") live beside it.
- Editor: `ItemTypeStatuses` (its own file) lists `plan.statusNames` as `aria-pressed` chips; every one may go
  off; at `ITEM_TYPE_EXCLUDED_STATUSES_MAX` off, the chips still on are disabled and a `role="note"` says so. The
  draft carries `excludedStatuses` only when non-empty. `ItemTypeEditor` names a catalogue check failing on
  `.excludedStatuses` "Too many statuses turned off: a type can turn off at most 64." and flags the States tab.
- Enforcement (`hooks/plan/status-refusal.ts`): `typeStatusRefusal(types, typeId, status, name)`;
  `moveStatusRefusal(types, item, { status, type? }, name)`, null for the card's own status and checked with the
  lane's type when given; `cardsMovingRefused` / `cardsStayedMessage` for a removed column's cards.
  `PlanBoardTarget.refuseAt(item, slot)` (board drop hook: `cellStatus`, plus `laneMove(lane).type` on a board with
  swimlanes, through `moveStatusRefusal`) feeds `usePlanCardDrag` (its `item` option; the drag state's `refused`
  moves the slot to the column's foot and `DropGap` draws it red; a refused drop calls `onRefused`). The palette
  (`planCardHoverAt` / `dropPlanCardAt`) never calls it. The board's Shift+Arrow moves use `moveStatusRefusal`; the
  card menu's Move To and the tray's Move To filter their columns with `typeStatusRefusal`; a column's removal
  (`onMoveCards`) skips `cardsMovingRefused` and announces once. A canvas Plan card dropped on a board
  (`useEditorDrag` passes the cell's `data-plan-board`) goes through `usePlanSlice.dropPlanCardOnBoard`, which
  checks `planBoardTarget(boardId).accepts` then `moveStatusRefusal`, shows a refusal with `notify` (a toast) and
  `announce`, and removes the canvas card only when the write resolves true. The cell's Add Card gets only the
  types `typeAllowsStatus` lets in; none hides it. The panel's Status select filters its options the same way,
  keeping a current left-out status as a disabled option.
- The api's `writeItem` refuses a status change into a left-out status (`excludedStatus`: a change only, so a type
  change keeping the status passes) with `status_excluded` / field `status`; the agent verbs map it to a plain
  message and a hint. Let through: a trashed item whose new status is its `trashedFrom` (a restore), and a patch or
  move body with `undo: true` (`writeItem`'s `{ undo }` option). The editor marks both sides of every undo step with
  `asUndoWrite` (`ItemWrite.undo`), which `lib/api/items.ts` sends as `undo: true`.

## Errors and edge cases

| Case                               | Handling                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| Stored catalogue unreadable        | Built-ins (`readItemTypeCatalogue` null)                     |
| Item of a type the catalogue lacks | Drawn as `FALLBACK_ITEM_TYPE` "Item"; card tile makes a Task |
| Custom value of the wrong kind     | Shown empty; replaced by the next edit                       |
| Field taken off a type             | Values kept in `fields`; shown again if it returns           |
| Deleting the last type             | Not offered (`canDelete`); `deleteType` refuses              |
| Save fails                         | That change dropped (later ones kept), toast                 |
| Another change landed first (409)  | Change made again to the stored catalogue, sent again (3×)   |

## Security and trust

- Only whole-document editors write the catalogue; it holds names and colours, no content, so tab-scoped
  sessions hear it. The api validates every write; the editor validates before saving (same function).

## Performance and limits

- 32 types × 24 fields × 12 custom fields fits `ITEM_TYPES_BYTES` (32 KB); the op carries the catalogue whole.

## Accessibility and UX

- Panel rows are focusable list items named "<Name>, N items"; Enter or Space opens the editor. Swatches and
  glyphs are radio groups with names ("Cyan", "Chat glyph"). The editor's problems are named in text beside
  Save. Copy: "Card Types", "+ Add Type", "Add Default Types", its confirm "Add {list} to this document’s card types? They go after the ones you have, and nothing you have changes." with "Add Types", "New Card Type", "Edit Card Type",
  "+ Add Field", "Built-In Fields", "New Custom Field", "Add Custom Field", "Show on card", "Delete",
  "Keep as Item".

## Observability

- `[item-types] item-types.saved` / `item-types.rejected` / `item-types.stale` (api); `[item-types] saved` /
  `save stale` / `save failed` (editor debug log).

## Testing

| Rule                                                      | Test                                                      |
| --------------------------------------------------------- | --------------------------------------------------------- |
| Catalogue checks, ids, read-back, glyphs                  | `packages/items/src/type-catalogue.test.ts`               |
| Glyph categories, keywords, old ids kept, search          | `packages/items/src/glyphs.test.ts`                       |
| Glyph picker filters, empty state, picks                  | `apps/live/components/plan/GlyphPicker.test.tsx`          |
| Route: store, relay, null, refusals, gates, copy, create  | `apps/api/src/routes/item-routes.test.ts`                 |
| Route: a stale revision refused with what is stored       | `apps/api/src/routes/item-routes.test.ts`                 |
| A change rebased onto another editor's catalogue          | `packages/items/src/type-catalogue-change.test.ts`        |
| Editor: stale resend, failure drops one, undo keeps later | `apps/live/hooks/plan/useItemTypes.test.ts`               |
| Agents: a stale save read again and applied again         | `packages/agent-verbs/src/plan/plan-engine.test.ts`       |
| Scoped sessions hear the op                               | `apps/api/src/room-scope.test.ts`                         |
| Card tiles follow the catalogue                           | `apps/live/components/palette/palette-plan-tiles.test.ts` |
| Custom values on a card                                   | `apps/live/components/plan/custom-field-text.test.ts`     |
| Left-out statuses: read, refuse, allow                    | `packages/items/src/type-catalogue.test.ts`               |
| Left-out statuses: api refuses moves, patches, makes      | `apps/api/src/routes/item-routes.test.ts`                 |
| Left-out statuses: agent refusal message                  | `packages/agent-verbs/src/verbs/item.test.ts`             |
| Statuses chips, panel Status options                      | `apps/live/components/plan/ItemTypeStatuses.test.tsx`     |
| Editor tabs, Configuration sections, flags, arrow keys    | `apps/live/components/plan/ItemTypeEditor.tabs.test.tsx`  |
| Show Me steps open Configuration, scroll to Fields        | `apps/live/components/tour/CardTypeTour.test.tsx`         |
| Palette card refused in a left-out column                 | `apps/live/hooks/plan/plan-card-drop.test.ts`             |
| Panel, editor, card face, palette in a browser            | checked by hand against the dev stack (screenshots)       |

## Constants and configuration

| Constant                                               | Value  | Why                                                                            |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| `ITEM_TYPES_MAX`                                       | 32     | Spec "An item type"                                                            |
| `ITEM_TYPE_FIELDS_MAX`                                 | 24     | Spec                                                                           |
| `ITEM_TYPE_CUSTOM_MAX`                                 | 12     | Spec                                                                           |
| `ITEM_TYPE_LABEL_MAX`                                  | 32     | Spec                                                                           |
| `CUSTOM_CHOICE_OPTIONS_MAX`                            | 20     | Spec                                                                           |
| `CUSTOM_CHOICE_OPTION_MAX`                             | 40     | D11                                                                            |
| `ITEM_TYPES_BYTES`                                     | 32,768 | Spec "Limits and validation"                                                   |
| `ITEM_TYPES_SAVE_ATTEMPTS`, `CARD_TYPES_SAVE_ATTEMPTS` | 3      | Spec "Storage and sync": a change made again a few times, then refused; 1 to 5 |
| `ITEM_TYPE_EXCLUDED_STATUSES_MAX`                      | 64     | Far more than a board's columns; keeps the catalogue small                     |
| `PLAN_TYPE_COLOURS`                                    | 12     | The default types' five (Black, Gray, Blue, Yellow, Red) then seven more       |

## Default and ready-made types

`ITEM_TYPES` (the default types): `project` (#18181b), `task` (#71717a), `note` (#2563eb), `idea` (#eab308),
`action` (#dc2626). `READY_MADE_CARD_TYPES` (`packages/items/src/brought-types.ts`, pure data, the table in
[Plan templates](../plan-templates.md#ready-made-card-types)) is those five then the ten more. Presets set the types
a board takes (Kanban: Tasks and Actions, Sprint: Stories, Tasks and Bugs, Bug Triage: Bugs, Roadmap: Projects).

- `boardTypeIdsOf(elements)`: each `plan-board`'s `addTypes`, or `ITEM_TYPES`' ids for one that names none (Blank);
  nothing for Archive or All Cards.
- `broughtTypesToAdd(named, types)`: the ready-made types named that `types` lacks, each once, in order;
  `boardTypesToAdd(elements, types)` the same off the elements; `defaultTypesToAdd(types)` the missing defaults.
- `catalogueWithBoardTypes(stored, elements, hasCards = false)`: with `stored` null and no cards, exactly the types
  the boards bring (null when none, or when they are the five defaults in order: already what it reads as);
  otherwise `typesOf(stored)` with the missing ones after, capped at `ITEM_TYPES_MAX`; null when nothing changes.
- `READY_MADE_DEFAULT_STATE_NAMES` / `readyMadeDefaultStatus` name a Default State for every ready-made type.
- The editor: `usePresetCardTypes({ catalogue, hasCards, itemsReady, saveCatalogue, ... })` applies it to boards
  that appear on the open tab once the items are read, and `bring(elements)` (Quick Start) at once, or held until
  they are. Nothing in the interface sets a type apart: `CardTypesPanel` is one list (`aria-label` "Card Types").

`CardTypesPanel` rows are cards (stripe, tinted glyph tile, "N fields", count pill, pencil; the row opens the
editor), with a dashed Add Type tile and Add Default Types under it while `defaultTypesToAdd(types)` is not empty.
The item panel's Parent lists Projects.

## Glyph set

- `PLAN_GLYPHS` is one flat catalogue of single stroked paths on the 16-unit grid (`PlanTypeGlyph` strokes them at
  1.6 with round caps and joins), drawn in the house style, not copied from a third-party set, so no licence
  applies. Its key order is the categories' order, so `PLAN_GLYPH_IDS` (validation's list) reads category by
  category. Ids are permanent: the sixteen first ids (task, story, bug, project, note, idea, action, risk, star,
  flag, heart, bookmark, person, calendar, chat, cube) and every later one are never renamed or removed.
- `PLAN_GLYPH_CATEGORIES`: `{ id, label, glyphs }[]`, eight categories, every glyph in exactly one.
  `PLAN_GLYPH_KEYWORDS`: a few lower-case words per glyph. `planGlyphLabel(id)` title-cases the id, hyphens to
  spaces ("user-plus" is "User Plus"). `glyphMatches(id, query)` is true when every word of the trimmed,
  lower-cased query starts a word of the label or keywords.
- `GlyphPicker` (apps/live/components/plan/GlyphPicker.tsx) draws the search (`aria-label` "Search glyphs") over
  one `role="radiogroup"` named "Glyph", a heading per non-empty category, tiles named "{label} glyph".
