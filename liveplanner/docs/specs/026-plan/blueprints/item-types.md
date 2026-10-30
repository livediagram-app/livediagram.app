# Item types blueprint

Derived from [Item types](../item-types.md). Contract for the type catalogue: its model and checks in
`@liveplanner/items`, its column and route in the api, and the editor's panel, type editor and consumers.

## Domain and naming

| Spec term         | Identifier                                                                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| item type         | `ItemTypeDef` (`item-types.ts`): `id`, `label`, `newTitle`, `glyph`, `color`, `fields`, `custom?`                                                                                                                                                          |
| type catalogue    | `ItemTypeCatalogue` `{ version: 1, types }` (`type-catalogue.ts`); null = not chosen (defaults)                                                                                                                                                            |
| custom field      | `CustomFieldDef` `{ id, label, kind, options?, linkType?, linkTypes?, calculation?, onCard?, required? }`; kinds `CUSTOM_FIELD_KINDS` (person, labels, colour, checklist and image among them, reading as their built-in fields do: `customFieldValue.ts`) |
| required field    | `required: true` on a `CustomFieldDef`; `canBeRequired(kind)`, `missingRequiredFields`, `requiredCleared` (`required-fields.ts`)                                                                                                                           |
| glyph set         | `PLAN_GLYPHS` (`glyphs.ts`), ids `PlanGlyphId`; `planGlyphPath(id)`; `PLAN_GLYPH_CATEGORIES`                                                                                                                                                               |
| card type (UI)    | the panel `CardTypesPanel`, its button in `PlanCardsClusterStrip`, the editor `ItemTypeEditor`                                                                                                                                                             |
| Add Default Types | `ItemTypesSlice.addDefaultTypes()` (`defaultTypesToAdd`, appended; one undo step), behind a `ConfirmPopover`                                                                                                                                               |
| default types     | `ITEM_TYPES` (`item-types.ts`); ready-made types `READY_MADE_CARD_TYPES` (`brought-types.ts`)                                                                                                                                                              |

## Package `@liveplanner/items`

```
src/glyphs.ts          PLAN_GLYPHS, PLAN_GLYPH_IDS, PLAN_GLYPH_CATEGORIES, PLAN_GLYPH_KEYWORDS, planGlyphLabel,
                       planGlyphPath, isPlanGlyphId, glyphMatches
src/type-catalogue.ts  ItemTypeCatalogue, limits, PLAN_TYPE_COLOURS, BUILT_IN_FIELD_IDS, REQUIRED_TYPE_FIELDS,
                       typesOf, typeIn, customFieldOf, isBuiltInFieldId, slugOf,
                       newItemTypeId, newCustomFieldId, defaultNewTitle, validateItemTypeCatalogue,
                       readItemTypeCatalogue, builtInCatalogue
src/required-fields.ts canBeRequired, requiredCustomFieldsOf (a type's required custom fields it still offers),
                       isEmptyFieldValue, missingRequiredFields(type, fields), requiredCleared(type, before, after),
                       requiredFieldsMessage(type, fields)
src/slug.ts            slugText, cutSlug, uniqueSlug (accents folded, `-2`, `-3` on a clash; shared with
                       @liveplanner/project's agent element ids)
```

- `validateItemTypeCatalogue(input)`: version 1; 1 to `ITEM_TYPES_MAX` types; each `id` matches
  `ITEM_TYPE_PATTERN` and is not `item`; `label` 1 to 32 characters, unique ignoring case; `color` `#rrggbb`;
  `glyph` in the set; `custom` up to 12 (`customFieldCount`, which never counts Parent), ids
  `CUSTOM_FIELD_ID_PATTERN` (`f-` and a slug, or the reserved `parent`) and unique, labels 1 to 32, kind known,
  Choice 1 to 20 unique options of up to 100 characters; Card a `linkType` matching `ITEM_TYPE_PATTERN` (a type the
  catalogue lacks is kept) and optional `linkTypes`, 1 to `CARD_LINK_TYPES_MAX` (32) such ids, normalised by
  `withLinkTypes` (deduplicated; kept only when longer than one; `linkType` set to its first) after `linkTypesOf`
  reads the pair (`linkTypes` when it holds `linkType`, else `[linkType]`); `fields` only built-in or own custom ids, deduplicated (a stored type naming `parent` without defining it gains
  `PARENT_FIELD`),
  `title` and `status` put first, at most 24; `newTitle` defaults to "New <name>"; JSON at most
  `ITEM_TYPES_BYTES`. Answers `{ ok, catalogue }` (normalised) or `{ ok: false, reason }` naming the part.
- `readCustom` keeps `required` only as `true` on a kind `canBeRequired` allows (every kind but `checkbox` and `calculated`); any
  other value, or `required` on a Checkbox, is dropped, never refused, so an older catalogue reads as before.
- Required fields (spec "Required fields"): `requiredCustomFieldsOf(type)` lists the custom fields with `required` whose
  ids are in `type.fields` (a field taken off the type is not enforced). `isEmptyFieldValue(v)`: `undefined`, `null`,
  a string that trims empty, or an empty array. `missingRequiredFields(type, fields)` the required fields `fields`
  leaves empty, in the type's order. `requiredCleared(type, before, after)` the first required field `before` holds a
  value for and `after` leaves empty (so a card already empty is never refused). `requiredFieldsMessage(type, missing)`
  "{Type} cards need {A}, {B} and {C}".
- `readItemTypeCatalogue(raw)`: a stored value (string or object) that validates, else null (built-ins).
- `projectBoard(setup, items, quick?, types = ITEM_TYPES)`, `itemAccessibleName(item, types?)`,
  `boardAddTypes(setup, types)`: the catalogue where they name or order types.

## Data and persistence

- `plan.item_types TEXT NULL` and `plan.item_types_rev INTEGER NOT NULL DEFAULT 0`, on the plan's own row
  (`plan-schema.ts`).
- `db/projects.ts`: `ProjectDTO.itemTypes` read through `readItemTypeCatalogue`, `ProjectDTO.itemTypesRev`
  (0 when absent); written by the create's INSERT (copy, sync, Drive; the revision starts at 0) and by
  `setProjectItemTypes(env, id, catalogue | null, expectedRev?)`, one guarded UPDATE raising `item_types_rev` and
  returning it, or null when `expectedRev` is given and no longer stored; `copyProject` copies the column. Never in
  a meta upsert's UPDATE.
- Offline: `OfflineProjectRecord.itemTypes?`; `offlineSaveItemTypes(id, catalogue, now)`; `recordToProject`
  reads it back. Duplicate (both paths), Sync to Cloud, Take Offline and the Drive envelope
  (`ProjectEnvelope.project.itemTypes?`, still version 1) carry it.

## Interfaces and contracts

| Method | Path                            | Gate                | Body               | Answer              |
| ------ | ------------------------------- | ------------------- | ------------------ | ------------------- |
| PUT    | `/api/projects/{id}/item-types` | edit, whole project | `ItemTypesRequest` | `ItemTypesResponse` |

- `ItemTypesRequest = { itemTypes, expectedRev? }`; `ItemTypesResponse = { itemTypes, itemTypesRev }`.
- 400 `{ error: 'item_types_invalid', reason }` for a catalogue that fails; 400 for no `itemTypes` key, bad JSON or
  an `expectedRev` that is not a whole number from 0; 403 for a view grant or a tab-scoped one; 405 for any other
  method; 409 `ItemTypesStale` `{ error: 'item_types_stale', itemTypes, itemTypesRev }` (what is stored) when
  `expectedRev` has moved on, nothing written or relayed. The create accepts `itemTypes` under the same check.
- `PlanResponse.itemTypesRev` (the plan route): what an agent's change names.
- Room: `relayItemTypes` broadcasts `{ kind: 'item-types', itemTypes, itemTypesRev }` ordered; `item-types` is a
  system op kind and in `room-scope`'s tab-less delivered set.

## Editor

- `editor-persistence`: `projectItemTypes` state, the catalogue as stored with its revision (`SavedItemTypes
{ itemTypes, itemTypesRev }`), seeded by `seed-fetched-project`.
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
  `plan.itemTypesRev`; `bringBoardCardTypes` names the project's `itemTypesRev`. A stale refusal reads again and
  applies again, up to `CARD_TYPES_SAVE_ATTEMPTS` (3), then answers the `item_types_stale` refusal.
- `PlanContext`: `types`, `itemTypes`, `editType(id | 'new')`; `usePlanSlice` holds `editingTypeId`.
- Parent: `PARENT_FIELD_ID` (`'parent'`) and `PARENT_FIELD` (`{ id: 'parent', label: 'Parent', kind: 'card',
linkType: 'project' }`) in item-types.ts; Task and the brought Bug and Story carry it in `custom`. The old grouping
  (`LEGACY_PARENT_GROUPING`, `swimlaneBy: 'parent'`) stays valid on boards, views and search filters and is read as
  the field: `normaliseBoardSetup`, and `legacy-parent.ts` (`readGrouping`, `readCardSearchFilter`: `e:{id}` keys to
  `f:"{id}"`, `readPlanViewSettings`, used by `PlanViewView` and `PlanViewMenuSection`).
- Card fields: `card-links.ts` (packages/items) is the one reading of links: `linkTypesOf(field)` (the field's card
  types, read-compatible as above), `withLinkTypes(field, ids)` (the stored pair), `linkFieldsOfType(type)` (each
  `{ id, label, linkTypes }`), `linkCandidates(items, linkTypes, selfId)` (live, not archived, of any of the types,
  number order, never self), `linkText` ("Missing card"), and `linkedCardsOf(target, items, types)`: groups
  `{ fieldId, label, fromTypes, cards }`, one per Card field whose types include the target's type (Parent for a
  Project), trashed cards left out. `LinksToPicker` (apps/editor `LinksToPicker.tsx`, used by `ItemTypeFieldForms`) is the type editor's
  multi-select: a `Select`-styled button (`linksToLabel`) opening an `AnchoredPopover` of `OptionRows`
  `kind="multiple"`, a gone ticked type a row after the catalogue's, the last ticked row disabled. `LinkedCardField` (apps/editor) is the shared control for every Card field
  (`ItemFieldEditor`), a listbox in an `AnchoredPopover` (portalled over the page, so the
  side column never clips it; it takes Escape before the panel and closes on a press outside) of width
  `max(LINK_LIST_MIN_PX (320), the field's width)`, capped by the window, with a filter past `LINK_FILTER_FROM` (8);
  each title `line-clamp-2` in a `Tooltip` of the whole title. `PlanSheetsHost` passes the groups as `linkedGroups`
  (`LinkedCardGroup` in LinkedCards.tsx, `New {Type}` via `addItem` with the link
  set, first status the type uses, tracked `('Plan', 'Added', 'LinkedCard')`). **Link Existing** (`LinkedCardGroup`'s last button, `aria-label`
  "Link an existing card as {Field}", shown with `canAdd` (the session's `can.planCards`) and a `target`) opens
  `LinkExistingCardDialog`: rows from `linkableCards(target, group, items)` (card-links.ts: the group's `fromTypes`,
  not trashed or archived, never the target nor a card whose field already holds it, each with `elsewhere`, the
  other card id its field holds) through `linkExistingRows` (newest change first, note "Linked to #3 Website" or
  "Linked to a missing card"), drawn by the shared `CardPickerDialog` (apps/editor `CardPickerDialog.tsx` +
  `card-picker.ts`: `pickCardOf`, `matchesPick`, `useCardPickerSearch`, `PICK_CARDS_SHOWN` 50; Add Thread to Card
  draws it too) with `showType` when the field is on several types. A row with `elsewhere` opens the workbench
  `ConfirmDialog` ("Move #12 {Title}?", Move Here / Cancel; the picker's Escape is off while it shows). The write is
  `linkExistingCard(ctx, target, group, cardId, moved)` (`link-existing.ts`): `patchItem(cardId, { set: { [fieldId]:
target.id } })`, announced "Linked #12 as {Field}" and tracked `('Plan', 'Linked', 'LinkedCard' |
'LinkedCardMoved')`; false (gone card, the target itself, a refused write) keeps the dialog open. `customFieldText(field, value, items)`
  names a Card value; `LaneFieldKind` gains `card` (rows named by the linked card with its `itemColourOf` dot, number
  order; the Swimlanes tile draws the linked type's glyph for a one-type field, else the card glyph; `LaneField`
  carries `linkTypes`). `PlanCardFace` draws a Card field as a pill: the linked
  card's colour dot when it has one, else the linked card's own type's glyph (the field's first type when the card
  is missing).
- Calculated fields: `calculated-fields.ts` (packages/items) is the one reading: `CALCULATIONS` (`childCount`,
  `childrenDone`) and `CALCULATION_LABELS`, `calculationOf(field)`, `childIndexOf(items, types)` (one pass over the
  cards: every live card's Card-field links by the card linked to, trashed cards left out), `childrenOf(item, index)`
  (the links whose field names the item's type, each card once), `doneStatusesOf(boards)` (from a plan outline, the
  first board naming a status deciding) and `donePhase(phases)` (from the editor's `statusPhases`),
  `calculatedValue`, `calculatedValuesOf(item, type, index, isDone)` and `calculatedText` ("40%").
  `readCustom` keeps a `calculated` field only with a known `calculation`. `write-checks.ts`
  `calculatedWritten(types, next, before)` refuses a write giving one a value (`field_calculated`), shared by the api
  and `offline-items.ts`. The api's `GET /items?include=calculated` reads the plan's boards (`planOutline`, as
  `GET /plan`) only then, and answers `calculated`. The agents (`plan-listing.ts`) work the values out from the
  `PlanState` they already read. `childIndexFor(items, types)` caches the index once per items map (a
  WeakMap), so the editor's `calculated-values.ts` (`calculatedFieldValue`, read by `PlanCardFace` and
  `ItemFieldEditor`) and the SVG export (`svg-render-plan-card.ts`, Children Done only with a board's done columns)
  cost one pass per store; `CalculatedFieldValue` draws one read-only.
- Consumers: `PlanCardFace` (stripe, glyph, custom field chips via `custom-field-text.ts`), `ItemPanel` (the
  type's field order, `CustomFieldEditor`), `AddCardPopover`, `PlanBoardView`
  (projection), `PlanBoardCells`/`PlanCardView` names,
  the palette's Cards tiles (`planCardTile`, in `PalettePlanCardsTab`, `ToolbarPalette`'s strip and `BoardCardsStrip`),
  SVG export and thumbnails (`itemTypes` render option), the MCP's previews.
- Built-in kinds: `builtInFieldOfKind` (`packages/items/src/item-types.ts`) maps Person, Labels, Colour and
  Checklist to `assignee`, `labels`, `color` and `checklist`; the store (`normaliseUnknown`), `customFieldText`
  (`personName`, `checklistRowsProgress`), the CSV (`board-csv.ts`) and the agents (`plan-names.ts`, refusals named
  by the field) read the custom field through it. The editor's `ItemFieldEditor` draws the built-in control for it
  (`PersonPicker` takes the field's name as `label`), `CustomKindPill.tsx` (`isBuiltInKindPill`, `customKindPill`)
  draws it on `PlanCardFace`, and `BuiltInKindField.tsx` asks it in `RequiredFieldsDialog`.
- Image fields: `ImageField.tsx` (`ImageFieldControl` in the card panel, `ImageThumb` on the card face, lazy through
  an `IntersectionObserver`), reading through `apps/editor/lib/api/images.ts` (`apiUploadImage`, `apiImageUrl`,
  `releaseImageUrl`, `ImageUploadError`) with the plan's `itemsScope` (`PlanContext`, from `usePlanItems`). The api's
  `routes/images.ts` and the room's `plan-room/image-grants.ts` (api.md "Images"). An upload tracks
  `Plan · Added · CardImage`.
- The Card Types segment of `PlanCardsClusterStrip` (a `ClusterPopoverSegment`, from `ClusterPopoverButton.tsx`,
  shared with Slides) opens dock panel `card-types` (`useCardTypesOpener` opens it from Edit Cards);
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
  problem or a custom field problem flag `configuration`; a status list problem flags `statuses`.
- **Add Field** (spec "Fields and Tabs": Add Field). `ItemTypeLayoutEditor` opens it in an `AnchoredPopover`
  (`ADD_FIELD_POPOVER_PX` 384, `name="Add Field"`, `initialFocus` `'panel'` under `(pointer: coarse)` else
  `'first'`, `onEscape` handed to the form), holding `NewFieldForm` (`NewFieldForm.tsx`), which keeps the step
  (`{ step: 'pick' } | { step: 'shape', kind }`), the search text (kept across the steps) and the open group, and
  answers Escape (`escape()`: shape → pick, then a typed search cleared, then false so the popover closes).
  - Pure data and matching in `add-field-kinds.ts`. A **pick kind** (`PickKind`) is a `CustomFieldKind` or one of
    the built-in-only kinds `'comments' | 'votes'` (one to a type until they can repeat). `KIND_GROUPS`
    (`{ id, label, kinds: PickKind[] }[]`: `text` "Text & links" text, longtext, link, email; `numbers` "Numbers &
    dates" number, currency, rating, date; `choices` "Choices" choice, multichoice, checkbox, labels; `people`
    "People & teamwork" person, checklist, comments, votes; `look` "Colour & images" colour, image; `cards` "Linked
    cards" card, calculated; every `CUSTOM_FIELD_KINDS` member once, test-locked), `KIND_DESCRIPTIONS` and
    `KIND_ALIASES` (`Record<PickKind, …>`, the spec's words), `BUILT_INS_OF_KIND` (`Record<PickKind, ItemFieldId[]>`:
    longtext description; choice priority; number estimate; date start, due; person assignee; labels labels; colour
    color; checklist checklist; comments comments; votes votes), `BUILT_IN_ROLES` (`Partial<Record<ItemFieldId,
string>>`, the Ready to use lines), `readyBuiltIns(kind, missing)` (the kind's built-ins the type lacks, in
    `BUILT_INS_OF_KIND` order), `searchKey(q)` (trimmed, lower-cased, runs of spaces one), `kindMatches(kind, label,
q)` (the whole query a substring of the label, the description, an alias or the name of a built-in of the kind,
    else every word of it a substring of one of them), `isOneToAType(kind)` (comments, votes) and
    `kindReadiness(field)` (`null` when ready, else `'name' | 'options' | 'links'`, in that order) with
    `READINESS_HINT`.
  - Step 1 is `AddFieldPicker.tsx`: a `sticky top-0` header (search `type="search"`, `aria-label="Search fields"`, a
    close `IconButton` "Close" calling `onCancel`), then one list (no Ready-made section, no "Your own field"
    heading): `CUSTOM_MAX_NOTE` first when `canAddCustom` is false, then the groups. Each group is an `h4` holding the
    header button (`aria-expanded`, `aria-controls` its list's id, its name, a count pill of the kinds it lists, a
    chevron rotating 180° when open, `motion-safe:transition`), and the list a `ul` of kind buttons (`aria-label`
    the kind's name, `aria-describedby` its description, `data-kind`; a **Ready to use** tag after the name when
    `readyBuiltIns(kind, missing)` is not empty). A one-to-a-type kind (`isOneToAType`) is listed only while the
    type lacks it, and pressing it calls `onAddBuiltIn(id)`; every other kind calls `onPick(kind)`. With
    `canAddCustom` false a kind with nothing ready is `aria-disabled`, dimmed and not `data-pick`. Searching
    (`searchKey(q)` non-empty), every group with a match renders open and the headers are not toggles
    (`aria-expanded` true, `aria-disabled`); a group with none is not rendered. No match at all: the empty state,
    `role="status"`. A visually hidden `aria-live="polite"` line says "N fields match" while searching. Arrow keys:
    the root's `onKeyDown` takes ↑ ↓ Home End over its `[data-nav]` elements in DOM order (the search, the headers,
    the kinds), `preventDefault`, focusing the next; Enter in the search with a query presses the first
    `[data-pick]`.
  - Step 2 is `AddFieldShape.tsx`, a `<form>` (`aria-label` "New {Kind} field"; `onSubmit` adds when ready, so Enter
    in Name submits; option rows and selects take their own Enter): a header with the back button (`ChevronLeft`,
    "All kinds") and the pill (`<span><span class="sr-only">Kind: </span>{label}</span>` with its icon); when
    `readyBuiltIns(kind, missing)` is not empty, a `section` headed **Ready to use** (`aria-labelledby`) of one
    button per built-in (`fieldIconOf(id)`, its `BUILT_IN_FIELD_LABELS` name, its `BUILT_IN_ROLES` line, a plus;
    `onAddBuiltIn(id)`), then a rule labelled **Or make your own**, and only that section when `canAddCustom` is
    false; `TextInput`
    labelled "Name" (`autoFocus`, `maxLength={CUSTOM_FIELD_LABEL_MAX}`); the kind's controls (`ChoiceOptionsEditor`,
    `RatingScaleSelect`, `CurrencySelect`, `LinksToPicker`, `CalculationSelect`, each with a visible label);
    `RequiredSwitch`; `CustomFieldPreview`; then a `sticky bottom-0` footer: the submit `Button` (full width,
    `PlusIcon`, "Add {name}" truncated, else "Add {Kind} Field", `disabled` until `kindReadiness` is null,
    `aria-describedby` the hint line under it). What it hands `onAddCustom` is today's: the trimmed label, and the
    kind's own settings only (options, scale, link types, currency, calculation, required where `canBeRequired`).
    Back focuses `[data-kind="<kind>"]` once step 1 renders (its group opened when not searching).
  - `ChoiceOptionsEditor.tsx`: rows held as strings (one `''` to start), handed up cleaned by `optionsFrom(rows)`
    (trimmed to `CUSTOM_CHOICE_OPTION_MAX`, blanks and case-insensitive repeats dropped, at most
    `CUSTOM_CHOICE_OPTIONS_MAX`). Row inputs `aria-label="Option {n}"`; remove `IconButton` "Remove option {n}"
    (the last row is cleared, not removed); Enter inserts a row after and focuses it (`preventDefault`); Backspace
    in an empty row (not the only one) removes it and focuses the one before; a paste whose text holds a line break
    is taken (`preventDefault`) and split into lines (blank ones dropped): an empty row takes the first, the rest
    are inserted after, capped at `CUSTOM_CHOICE_OPTIONS_MAX` rows. **Add an option** is disabled at the cap.
    `CustomFieldForm` (editing an existing field) keeps its textarea.
  - `CustomFieldPreview` (`CustomFieldKindParts.tsx`) draws a card: `figure` "Preview" (caption), over a white
    rounded bordered card ("Example card", `text-[13px] font-medium`) holding the `ItemDetailsRow` (its `required`
    mark when Required).
  - `CustomFieldKindTiles` is removed (nothing else used it).
  - Touch: every button and field in it carries `pointer-coarse:min-h-11`. Steps enter with `motion-safe:animate-card-rise`.
  - `AnchoredPopover` (`@liveworkspace/workbench`) gains `initialFocus?: 'first' | 'panel'` (default `'first'`, as
    before): `'panel'` focuses the panel itself (`tabIndex={-1}`, no ring), so a touch screen opens it without a
    keyboard while focus is still inside the dialog.
- Show Me steps (`card-type-tour-steps.ts`): `general` shows `configuration` and focuses the Name input (focus
  scrolls it into view); `fields` shows `configuration` and asks for `card-type-fields` at the panel's top
  (`revealAt: 'start'`: the tour engine's `revealInScrollers` from `tour-reveal.ts` scrolls it there, instant under
  reduced motion); `states` and `display` show their tabs. The button and the running tour are the shared `ShowMeButton` /
  `ShowMeStage` (`ShowMe.tsx`, [Show Me](../../007-editor/show-me.md)); `CardTypeTour.tsx` keeps the literal telemetry.

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

## The statuses a type uses

- `ItemTypeDef.statuses?: string[]`, the ordered inclusion list, read by `readStatusList` in `readType` (strings,
  non-blank, at most `ITEM_STATUS_MAX` long, de-duplicated in order, at most `ITEM_TYPE_STATUSES_MAX`; an empty
  list is kept: the type uses none). A type stored before it keeps `excludedStatuses` (read by the same reader, at
  most `ITEM_TYPE_EXCLUDED_STATUSES_MAX`, an empty list dropped) and is called **legacy**; a type with `statuses`
  drops any `excludedStatuses` on read. Nothing writes `excludedStatuses` any more.
- `packages/items/src/type-statuses.ts`: `typeStatusesOf(type, planStatuses)` (the list, or for a legacy type
  `planStatuses` less its exclusions); `planStatusOrder(setups)` (every status the boards name, in the order
  given, All Cards and Archive aside); `boardTypeStatuses(setups, typeIds)` (per type id, the statuses of the boards
  that take it, in board order: a board naming no types, or only deleted ones, takes every type);
  `boardStatusJoins(before, after, typeIds)` (per type, the statuses `after` gives it that `before` did not);
  `withTypeStatuses(catalogue, { joins?, planStatuses? })` (legacy types written as `typeStatusesOf(type,
planStatuses)` when `planStatuses` is given, then each type's joins appended where missing; null when nothing
  changes or the result fails `validateItemTypeCatalogue`, so a join never makes a catalogue unsaveable).
  `typeAllowsStatus(type, status)` (no status is always allowed; a list type by membership, a legacy type by its
  exclusions) and `statusRefusal(typeLabel, statusName)` ("{Type} cards can't be {Status}") live in
  `type-catalogue.ts`. `catalogueWithBoardTypes` gives each brought type `statuses` from `boardTypeStatuses` of
  the elements.
- Editor joins (`hooks/plan/useTypeStatusJoins.ts`, wired in `useEditorState` with `enabled` = hydrated, not
  structure read-only, catalogue chosen): per loaded tab, `boardTypeStatuses` of its boards. A tab first seen
  (loaded) that was in the project when the hook started only seeds the session's `seen` sets; a tab that appears
  later counts from empty. Each type's `seen` set gains what its compatible boards give it; what is new (not
  `seen`) is its join. A type first seen is seeded, never joined. Legacy types are written with `planStatusOrder` of
  every tab (no tab first) once every tab is loaded. Both go through `useItemTypes.quietChange(remake)`: a pending
  change kept as a function, made to the stored catalogue at each send (so it is made again over a stale write),
  with no undo step and no toast on failure, and skipped when it changes nothing.
- Editor: `ItemTypeStatuses` (its own file) takes `used` (the ordered list) and `onChange(used)`: `ItemTypeStatusOrder`
  (its own file) draws Order, an `ol` of rows (grip through `useHandleReorder`, Alt+Up / Alt+Down on the grip,
  the name, a Turn Off cross), then the board groups (`statusGroups`) as `OptionRows` checkbox rows: ticking
  appends, unticking removes; `selectAllStates` appends the listed ones missing, `deselectAllStates` removes the
  listed ones. At `ITEM_TYPE_STATUSES_MAX` on, the rows still off are disabled and a `role="note"` says so.
  `ItemTypeEditor` starts `used` from `typeStatusesOf(start, statusIds)` and always saves `statuses`; a catalogue
  check failing on `.statuses` reads "Too many states on: a type can use at most 128." and flags the States tab.
  `newTypeForBoard` starts a type with `statuses` = the board's.
- Order readers: the card panel's Status (`ItemFieldEditor`) lists `typeStatusesOf(type, names)` with a name,
  then a current left-out status as a disabled option; the Default State menu and `newCardStatus` (the first
  status the type uses that the tab's boards name) read the same list.
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

- Required fields: `write-checks.ts` `createRefusal(types, create)` answers `{ error: 'field_required', field }`
  for a create missing one unless it restores (carries `key`, `votes` or `comments`); `writtenItemsRefusal` also
  refuses `field_required` for a patch, patches or move whose item `requiredCleared` unless `undo`. The api's single
  create and bulk create run `createRefusal` per create (after the Default State), `writeItem` and the patches route
  run `requiredCleared` beside `excludedStatus`; the refusal is 400 `{ error: 'field_required', field: <id> }`. The
  offline store runs the same checks. The editor's `usePlanSlice.addItem` goes through `useRequiredFieldsGate`:
  a create missing a required field opens `RequiredFieldsDialog` (PlanSheetsHost draws it first) and is written,
  filled, only on Create; Cancel answers false. `refusalMessage('field_required')` reads "That field is required on
  this card type". `boardCsvImport` counts a row missing one in `missingRequired` (also in `skipped`).
  `publishProblems` adds `{ kind: 'required_unasked', fieldId, field, type }` per required field no required
  question in an always-shown section maps to; `publishProblemText(p)` words every problem. Agents:
  `listedType.custom[].required`, `CustomFieldInput.required` / `CustomFieldEdit.required` in `applyCardTypeChanges`
  (a Checkbox refused), and `applyItemChanges` stops an `add` (`missingRequiredFields`) or a `set`
  (`requiredCleared`) with `field_required` and `requiredFieldsMessage` before any write.

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

- Only whole-project editors write the catalogue; it holds names and colours, no content, so tab-scoped
  sessions hear it. The api validates every write; the editor validates before saving (same function).

## Performance and limits

- 32 types × 24 fields × 12 custom fields fits `ITEM_TYPES_BYTES` (32 KB); the op carries the catalogue whole.

## Accessibility and UX

- Panel rows are focusable list items named "<Name>, N items"; Enter or Space opens the editor. Swatches and
  glyphs are radio groups with names ("Cyan", "Chat glyph"). The editor's problems are named in text beside
  Save. Copy: "Card Types", "+ Add Type", "Add Default Types", its confirm "Add {list} to this project’s card types? They go after the ones you have, and nothing you have changes." with "Add Types", "New Card Type", "Edit Card Type",
  "+ Add Field", "Search fields", "Search fields, like money or date", "Ready to use", "Or make your own", the six
  group names, the twenty descriptions, the nine Ready to use lines, "No matches for “…”", "Try a word like money, date or parent.",
  "This type holds the most custom fields it can (12). Remove one to add another.", "All kinds", "Kind: {Kind}",
  "Name", "Field name", "Options", "Add an option", "or paste a list", "Option {n}", "Remove option {n}", "Scale",
  "Currency", "Calculation", "Required", "Preview", "Example card", "Add {Name}", "Add {Kind} Field", "Name the
  field to add it.", "Add at least one option.", "Pick a card type it links to.", "Show on card", "Delete",
  "Keep as Item".

## Observability

- `[item-types] item-types.saved` / `item-types.rejected` / `item-types.stale` (api); `[item-types] saved` /
  `save stale` / `save failed` (editor debug log).

## Testing

| Rule                                                      | Test                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue checks, ids, read-back, glyphs                  | `packages/items/src/type-catalogue.test.ts`                                                                                              |
| Glyph categories, keywords, old ids kept, search          | `packages/items/src/glyphs.test.ts`                                                                                                      |
| Card fields of several types: read, stored, linked, lanes | `packages/items/src/card-links.test.ts`, `packages/items/src/type-catalogue.test.ts`, `packages/items/src/type-changes.test.ts`          |
| Links To multi-select                                     | `apps/editor/components/plan/LinksToPicker.test.tsx`                                                                                     |
| Glyph picker filters, empty state, picks                  | `apps/editor/components/plan/GlyphPicker.test.tsx`                                                                                       |
| Route: store, relay, null, refusals, gates, copy, create  | `apps/api/src/routes/item-routes.test.ts`                                                                                                |
| Route: a stale revision refused with what is stored       | `apps/api/src/routes/item-routes.test.ts`                                                                                                |
| A change rebased onto another editor's catalogue          | `packages/items/src/type-catalogue-change.test.ts`                                                                                       |
| Editor: stale resend, failure drops one, undo keeps later | `apps/editor/hooks/plan/useItemTypes.test.ts`                                                                                            |
| Agents: a stale save read again and applied again         | `packages/agent-verbs/src/plan/plan-engine.test.ts`                                                                                      |
| Scoped sessions hear the op                               | `apps/api/src/room-scope.test.ts`                                                                                                        |
| Card tiles follow the catalogue                           | `apps/editor/components/palette/palette-plan-tiles.test.ts`                                                                              |
| Custom values on a card                                   | `apps/editor/components/plan/custom-field-text.test.ts`                                                                                  |
| Calculated fields: children, done, values, refusals       | `packages/items/src/calculated-fields.test.ts`, `apps/api/src/routes/item-routes.test.ts`, `packages/agent-verbs/src/verbs/item.test.ts` |
| Left-out statuses: read, refuse, allow                    | `packages/items/src/type-catalogue.test.ts`                                                                                              |
| Left-out statuses: api refuses moves, patches, makes      | `apps/api/src/routes/item-routes.test.ts`                                                                                                |
| Left-out statuses: agent refusal message                  | `packages/agent-verbs/src/verbs/item.test.ts`                                                                                            |
| Required fields: read, missing, cleared, message          | `packages/items/src/required-fields.test.ts`                                                                                             |
| Required fields: api refuses a create or a clear          | `apps/api/src/routes/item-routes.test.ts`                                                                                                |
| Required fields: agents list, set, refuse                 | `packages/agent-verbs/src/verbs/plan-verbs.test.ts`, `packages/items/src/type-changes.test.ts`                                           |
| Required fields: New {Type} dialog, type editor switch    | `apps/editor/components/plan/RequiredFieldsDialog.test.tsx`, `apps/editor/components/plan/NewFieldForm.test.tsx`                         |
| Add Field: groups, descriptions, aliases, readiness       | `apps/editor/components/plan/add-field-kinds.test.ts`                                                                                    |
| Add Field: search, accordion, Ready to use, keys, shape   | `apps/editor/components/plan/NewFieldForm.test.tsx`                                                                                      |
| Built-in kinds: store, text, CSV, agents                  | `packages/items/src/built-in-field-kinds.test.ts`                                                                                        |
| Built-in kinds and Image: panel, card face, required      | `apps/editor/components/plan/ItemFieldEditor.kinds.test.tsx`                                                                             |
| Image fields: upload, read, roles, grants                 | `apps/api/src/routes/images.test.ts`, `apps/api/src/plan-room/image-grants.test.ts`, `apps/editor/lib/api/images.test.ts`                |
| Add Field: option rows, Enter, Backspace, paste           | `apps/editor/components/plan/ChoiceOptionsEditor.test.tsx`                                                                               |
| Add Field: opened from a group, lands there               | `apps/editor/components/plan/ItemTypeLayoutEditor.rows.test.tsx`                                                                         |
| Statuses chips, panel Status options                      | `apps/editor/components/plan/ItemTypeStatuses.test.tsx`                                                                                  |
| Editor tabs, Configuration sections, flags, arrow keys    | `apps/editor/components/plan/ItemTypeEditor.tabs.test.tsx`                                                                               |
| Show Me steps open Configuration, scroll to Fields        | `apps/editor/components/tour/CardTypeTour.test.tsx`                                                                                      |
| Panel, editor, card face, palette in a browser            | checked by hand against the dev stack (screenshots)                                                                                      |

## Constants and configuration

| Constant                                               | Value  | Why                                                                            |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| `ITEM_TYPES_MAX`                                       | 32     | Spec "An item type"                                                            |
| `ITEM_TYPE_FIELDS_MAX`                                 | 24     | Spec                                                                           |
| `ITEM_TYPE_CUSTOM_MAX`                                 | 12     | Spec                                                                           |
| `ITEM_TYPE_LABEL_MAX`                                  | 32     | Spec                                                                           |
| `CUSTOM_CHOICE_OPTIONS_MAX`                            | 20     | Spec                                                                           |
| `CUSTOM_CHOICE_OPTION_MAX`                             | 100    | Spec "Custom field kinds" (was D11)                                            |
| `ITEM_TYPES_BYTES`                                     | 32,768 | Spec "Limits and validation"                                                   |
| `ITEM_TYPES_SAVE_ATTEMPTS`, `CARD_TYPES_SAVE_ATTEMPTS` | 3      | Spec "Storage and sync": a change made again a few times, then refused; 1 to 5 |
| `ITEM_TYPE_STATUSES_MAX`                               | 128    | Spec "An item type": ten boards of twelve columns; keeps the catalogue small   |
| `ITEM_TYPE_EXCLUDED_STATUSES_MAX`                      | 64     | Legacy types only: what an old type could leave out                            |
| `PLAN_TYPE_COLOURS`                                    | 12     | The default types' five (Black, Gray, Blue, Yellow, Red) then seven more       |
| `ADD_FIELD_POPOVER_PX`                                 | 384    | Spec "Fields and Tabs" (24 rem): a kind's name and line, and step 2's controls |

## Default and ready-made types

`ITEM_TYPES` (the default types): `project` (#18181b), `task` (#71717a), `note` (#2563eb), `idea` (#eab308),
`action` (#dc2626). `READY_MADE_CARD_TYPES` (`packages/items/src/brought-types.ts`, pure data, the table in
[Plan templates](../plan-templates.md#ready-made-card-types)) is those five then the ten more. Presets set the types
a board takes (Kanban: Tasks and Actions, Sprint: Stories, Tasks and Bugs, Bug Triage: Bugs, Roadmap: Projects).

- `boardTypeIdsOf(elements)`: each `plan-board`'s `addTypes`; nothing for one that names none (Blank), Archive or
  All Cards.
- `broughtTypesToAdd(named, types)`: the ready-made types named that `types` lacks, each once, in order;
  `boardTypesToAdd(elements, types)` the same off the elements; `defaultTypesToAdd(types)` the missing defaults.
- `catalogueWithBoardTypes(stored, elements)`: `typesOf(stored)` (empty for null) with the missing ones after,
  each with `statuses` from the boards among `elements` that take it, capped at `ITEM_TYPES_MAX`; null when
  nothing changes.
- `typesOf(null)` is `[]`; `validateItemTypeCatalogue` takes 0 to `ITEM_TYPES_MAX` types. `legacyCatalogue(stored,
hasCards)` answers `defaultCatalogue()` for a null catalogue with cards (offline records in `recordToProject` and
  `offline-items`, exported tabs in `parseImportedTab`, and the api's create with carried items).
- `READY_MADE_DEFAULT_STATE_NAMES` / `readyMadeDefaultStatus` name a Default State for every ready-made type.
- The editor: `usePresetCardTypes({ catalogue, itemsReady, saveCatalogue, ... })` applies it to boards
  that appear on the open tab once the items are read, and `bring(elements)` (a template picked on a start) at once, or held until
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
- `GlyphPicker` (apps/editor/components/plan/GlyphPicker.tsx) draws the search (`aria-label` "Search glyphs") over
  one `role="radiogroup"` named "Glyph", a heading per non-empty category, tiles named "{label} glyph".
