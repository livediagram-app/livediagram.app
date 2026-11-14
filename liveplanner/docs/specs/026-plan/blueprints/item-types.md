# Item types blueprint

Derived from [Item types](../item-types.md). Contract for the type catalogue: its model and checks in
`@liveplanner/items`, its column and route in the api, and the editor's panel, type editor and consumers.

## Domain and naming

| Spec term         | Identifier                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| item type         | `ItemTypeDef` (`item-types.ts`): `id`, `label`, `newTitle`, `glyph`, `color`, `fields`, `custom?`                                                                                                                                                                                                                                           |
| type catalogue    | `ItemTypeCatalogue` `{ version: 1, types }` (`type-catalogue.ts`); null = not chosen (defaults)                                                                                                                                                                                                                                             |
| custom field      | `CustomFieldDef` `{ id, label, kind, options?, linkType?, linkTypes?, calculation?, formula?, result?, currency?, through?, aggregate?, source?, showAs?, onCard?, required?, notifies? }`; kinds `CUSTOM_FIELD_KINDS` (person, labels, colour, checklist and image among them, reading as their built-in fields do: `customFieldValue.ts`) |
| required field    | `required: true` on a `CustomFieldDef`; `canBeRequired(kind)`, `missingRequiredFields`, `requiredCleared` (`required-fields.ts`)                                                                                                                                                                                                            |
| notifying field   | a Person field that tells its person (spec "Notifies"): `notifies: true` on a person `CustomFieldDef`, the Assignee unless `assigneeNotifies: false` on the `ItemTypeDef`; `notifyingFieldsOf`, `notifiedPeople`, `isNotified` (`notify-fields.ts`)                                                                                         |
| glyph set         | `PLAN_GLYPHS` (`glyphs.ts`), ids `PlanGlyphId`; `planGlyphPath(id)`; `PLAN_GLYPH_CATEGORIES`                                                                                                                                                                                                                                                |
| card type (UI)    | the panel `CardTypesPanel`, its button in `PlanCardsClusterStrip`, the editor `ItemTypeEditor`                                                                                                                                                                                                                                              |
| Add Default Types | `ItemTypesSlice.addDefaultTypes()` (`defaultTypesToAdd`, appended; one undo step), behind a `ConfirmPopover`                                                                                                                                                                                                                                |
| default types     | `ITEM_TYPES` (`item-types.ts`); ready-made types `READY_MADE_CARD_TYPES` (`brought-types.ts`)                                                                                                                                                                                                                                               |
| base type         | an `ItemTypeDef` another names in `inherits`; `inheritingTypesOf(baseId, types)`, `basesFor(typeId, types)` (`type-inheritance.ts`)                                                                                                                                                                                                         |
| inherited type    | an `ItemTypeDef` with `inherits` (its base id) and `ownFields`; `baseOf`, `inheritedFieldIds`, `withInheritance`, `inheritFrom`, `detachType` (`type-inheritance.ts`)                                                                                                                                                                       |

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
src/notify-fields.ts   notifyingFieldsOf(type): string[], notifiedPeople(type, item): NotifiedPerson[]
                       ({ fieldId, person }), isNotified(type, item, personId): boolean
src/several-values.ts  holdsSeveralKind(kind), holdsSeveral(field), storedPeople(value), storedCardIds(value),
                       fieldPeople(field, value), fieldCardIds(field, value), linkedCardIds(item, field),
                       severalValue(field, values), toggledValues(values, v, keyOf), swappedValues(values, from,
                       to, keyOf), personKey, cardKey (FIELD_VALUES_MAX = 20 in limits.ts)
src/image-values.ts    holdsSeveralImages(field), storedImageIds(value), fieldImageIds(field, value),
                       imageFieldValue(field, ids), withImagesAdded(ids, added), withoutImages(ids, removed),
                       movedImage(ids, from, to) (IMAGE_FIELD_PICTURES_MAX = FIELD_VALUES_MAX)
src/card-retype-fields.ts typeChangeFields(fields, from, to): ItemFields (the new type's custom fields mapped
                       by name from the old type's: same kind, Text/Long Text, Choice/Multiple Choice; Choice
                       values only as options; a Long Text's Rich runs with it; never a clear),
                       withTypeChangeFields(item, write, types, map?) (a patch or move with them added to `set`,
                       never over its own keys; spec "Changing a card's type"); explicit `map` entries
                       (`TypeFieldMap { from, to }`, a source custom field of any type, a target custom field of
                       the new type or `description`, read as Long Text through DESCRIPTION_AS_LONG_TEXT) are
                       applied after name matching, over it and over the target's value; canTakeValue(from, to)
                       and valueInto(from, to, value) (the one compatibility and conversion rule, shared with the
                       Hidden tab's Copy To Field)
src/hidden-values.ts   hiddenValuesOf(item, type, types): HiddenGroup[] ({ type: ItemTypeDef | null, values:
                       { field, def, value }[] }, groups in catalogue order, Removed Fields last, `type: null`),
                       hiddenValueCount(groups), hiddenValueText(value) (plain text of a removed field's value),
                       hiddenCopyTargets(type, def, value) (the card type's fields that take it: custom then
                       Description), hiddenCopyPatch(item, def, value, target), hiddenRemovePatch(item, field)
                       (spec "The Hidden tab"); only keys matching CUSTOM_FIELD_ID_PATTERN are read, never a
                       Calculated, Comments, Votes or Time Spent field's
src/newer-fields.ts    isNewerField(field), readNewerField(input, id, label), NEWER_FIELD_MAX_BYTES (spec "Fields
                       from a newer version")
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
- Newer fields (spec "Fields from a newer version"; `newer-fields.ts`): `readCustom` checks `id` and `label` first,
  then a `kind` outside `CUSTOM_FIELD_KINDS`, or a `calculated` field whose `calculation` is outside `CALCULATIONS`,
  goes to `readNewerField`, which keeps a JSON copy of the stored object (its `id` and trimmed `label` written back,
  everything else as stored; refused when its JSON passes `NEWER_FIELD_MAX_BYTES`, 4 KB). `kind` must still be a
  non-empty string. `validateItemTypeCatalogue(input, { newerFields: 'refuse' })` refuses it instead (`…custom[i].kind`
  or `…calculation`): the api's two write routes (`PUT …/item-types`, a project create's `itemTypes`) pass it; every
  reader keeps the default `'keep'`. `isNewerField(field)` is the one test every surface uses: `requiredCustomFieldsOf`
  skips one, `ItemFieldEditor` draws it as `NewerFieldValue`, `labelsItsControl` is false for it, `fieldIconOf` gives
  it `NEWER_FIELD_ICON` named "Newer Field", and `ItemTypeLayoutEditor` gives its row no Edit, no Remove and the
  "Reload to change it" lock. Every `switch` on a kind already falls through for it (no chip, no sort, no shape, no
  form mapping).
- `readCustom` keeps `required` only as `true` on a kind `canBeRequired` allows (every kind but `checkbox` and `calculated`); any
  other value, or `required` on a Checkbox, is dropped, never refused, so an older catalogue reads as before.
- Required fields (spec "Required fields"): `requiredCustomFieldsOf(type)` lists the custom fields with `required` whose
  ids are in `type.fields` (a field taken off the type is not enforced). `isEmptyFieldValue(v)`: `undefined`, `null`,
  a string that trims empty, or an empty array. `missingRequiredFields(type, fields)` the required fields `fields`
  leaves empty, in the type's order. `requiredCleared(type, before, after)` the first required field `before` holds a
  value for and `after` leaves empty (so a card already empty is never refused). `requiredFieldsMessage(type, missing)`
  "{Type} cards need {A}, {B} and {C}".
- Card colour (spec "Fields by role"): `readType` keeps `colourField` only when it names a custom `colour` field of
  the type; `colourFieldOf(type)` reads it while `type.fields` holds it, else `color`, and `itemColourOf(item, type)`
  reads that field (boards, linked cards, Gantt bars and their picture). The editor's `ItemTypeCardColour`
  (Display tab, shown while the type has a Colour field of its own) sets it on the draft, the built-in as absent,
  and tracks `Plan · Changed · CardColourField`.
- Notifies (spec "Notifies"): `readCustom` keeps `notifies` only as `true` on a `person` field; `readType` keeps
  `assigneeNotifies` only as `false`; anything else is dropped, never refused. `notifyingFieldsOf(type)` walks
  `type.fields` in order and keeps `assignee` unless `assigneeNotifies === false`, and each custom field of kind
  `person` with `notifies` (a field the type no longer offers never notifies). `notifiedPeople(type, item)` reads each
  of those fields' values in that order and keeps an `ItemPerson` (`isItemPerson`) that is not a custom person
  (`isNamedPerson`, an `n-` id) and not told already by an earlier field: `[{ fieldId, person }]`.
  `isNotified(type, item, personId)` whether that list holds the person. Readers: Only Mine
  (`quickFilterMatches(quick, item, types = ITEM_TYPES)`, `quick.mine` matched by `isNotified(typeIn(types,
item.type), ...)`; `projectBoard` passes its catalogue), the Inbox push (below) and the agents.
- Holds Several (spec "Holds Several"): `readCustom` keeps `multiple` only as `true` on a `person` or `card` field
  (`holdsSeveralKind`); anything else is dropped, never refused. Every reader goes through `several-values.ts`:
  `storedPeople` / `storedCardIds` read a list or a single value as a list (each once; anything else dropped), and
  `fieldPeople(field, value)` / `fieldCardIds(field, value)` keep all of it when `holdsSeveral(field)`, else the first
  (a def-less built-in, the Assignee or Parent, holds one). `severalValue` stores a list (cut to `FIELD_VALUES_MAX`)
  or the first, `undefined` (clear) for none. Writes: `validateFields`' `normaliseUnknown` takes a non-empty list of
  objects that each carry `id` as people (each `normaliseKnown('person')`, at most `FIELD_VALUES_MAX`, else
  `field_value_invalid`); a card id list is a scalar list as before. Readers changed: `notifiedPeople` (each person of
  each notifying field), `laneGroups` (`lanesOfItem: Map<itemId, laneKey[]>`, `inLane(groups, id, key)`;
  `personLanes` / `cardLanes` return a head per value, `LaneField.several` and `LaneHead.several` mark them),
  `laneDropPatch(lane, item, from?)` (a `several` lane sets `swappedValues` of the card's values, `from` the head it
  left), `projectBoard`, `ganttLanes`, `searchCards` / `searchValues` and `breakdownModel` (a card in each of its
  lanes; the chart's total counts it once), `linkFieldsOfType` (`several`), `linkedCardsOf` (`LinkedGroup.several`,
  the list holding the target), `linkableCards` (`elsewhere` null for several), `linkedValue(card, group, targetId)`
  (Link Existing and New {Type} append to a list), `childIndexOf` (through `linkedCardIds`, the reader a rollup will
  use), `customFieldText` (names and titles joined by ", "), `resolveFields` (`severalNamed`: a comma list or array of
  names or numbers, each once, refusing none, over `FIELD_VALUES_MAX`, a non-name or an unknown card),
  `boardCsvRows` (joined by ", ") and `boardCsvImport` (a Person field holding several splits at commas). Agents:
  `CustomFieldInput.multiple` / `CustomFieldEdit.multiple` (a field of another kind refused: "only a person or card
  field holds several"), `listedType` lists `custom[].multiple`, `namedFields` reads a list as a comma list
  (`listedValue`), and a set line names stored people and cards (`storedText`). The editor: no switch; Add
  Field's Several People and Several Cards tiles preset `multiple` (`KIND_VARIANTS`; `addedField` keeps it only on a
  Person or Card field); `FieldChips.tsx` (the chip field, its Add button and remove buttons) used
  by `PersonPicker` and `LinkedCardField` with `multiple` (their lists toggle, `aria-multiselectable`, no No one /
  None row, staying open); `SeveralValuesPills.tsx` (`PeopleStack`, `LinkedNumbersPill`, `SEVERAL_ON_CARD = 3`,
  `severalNames`) drawn by `customKindPill` and `PlanCardFace`; `usePlanCardDrag` carries the press's
  `data-plan-lane` as `fromLane` to `boardMoveFor(setup, projection, item, itemId, slot, fromLane)`.
- Several Images (spec "Image fields"; `image-values.ts`): `readCustom` keeps `multiple` only as `true` on a
  `person`, `card` or `image` field (`holdsSeveralKind` for the first two, `kind === 'image'` for the last), so a
  stored Several Images field reads back as one; `holdsSeveral` stays the Person and Card reading (lanes, notifying,
  linked cards and names never meet a picture list). `holdsSeveralImages(field)` is `kind === 'image' && multiple ===
true`. `storedImageIds(value)`: a non-empty string as `[id]`, a list's non-empty strings each once in order (at
  most `IMAGE_FIELD_PICTURES_MAX`), anything else `[]`. `fieldImageIds(field, value)`: all of them when
  `holdsSeveralImages(field)`, else the first. `imageFieldValue(field, ids)`: `undefined` (clear) for none, the list
  (deduplicated, cut to the cap) for Several Images, else the first id. `withImagesAdded(ids, added)` appends the ids
  not held, up to the cap, answering `{ ids, skipped }` (how many did not fit); `withoutImages(ids, removed)` and
  `movedImage(ids, from, to)` (an index move, clamped; the same list when either index is outside it) are the panel's
  and agents' edits. Storage needs nothing new: `validateFields`' `normaliseUnknown` already takes a list of scalars
  (at most `ITEM_UNKNOWN_ARRAY_MAX`). Readers taught the list (part 1, no door): the editor's `ImageFieldControl` and
  `customKindPill`'s Image thumbnail read `fieldImageIds(def, value)[0]`; agents' `listedValue` lists an Image field as
  its first id and Several Images as its list of ids; the room's `planServesImage` matches an id inside a stored list
  (`json_each` of an array field's value, read through `CASE WHEN f.type = 'array'` so a scalar is never parsed as
  JSON) and `PLACED_IMAGES_SQL` reports each granted id inside a list. Left as they were, each tested with a list:
  `customFieldText` (null), `boardCsvRows` / `customColumns` (the field left out), `boardCsvImport` (skipped),
  `canBeRequired` (never), the form mappings (never asked), `fieldKindChange` (no change to or from an Image but
  Image and Several Images). The editor (part 2): Add Field's Several Images tile (`KIND_VARIANTS`
  `images: { kind: 'image', preset: { multiple: true } }`, `pickOf` answering `images` for an Image with `multiple`,
  in Links and Images after Image, its line, words, `PICK_KIND_LABELS` "Several Images", `PICK_KIND_ICONS`
  `lucideImages` (also the Display's Available Fields chip: `ItemTypeDisplayParts`' `fieldIcon` draws `fieldIconOf`), `AddFieldTileArt` three thumbnails and "+2", `SampleValue` three picture tiles and "+2");
  `addedField` keeps `multiple` on an Image; Edit Field's Image and Several Images change (`kindChangeRefusal` lets
  one kind change to itself; `fieldKindChange`: kept one way, the first the other). The panel's
  `ImageGalleryField.tsx` (routed by `ItemFieldEditor` on `holdsSeveralImages`): a `@container` grid,
  `grid-cols-3 @xs:not-pointer-coarse:grid-cols-4` (3 on a touch screen, where the corners always show), each `Thumbnail` a square `<li data-reorder-id>` lazy through `useSeen` and
  `useImageUrl(scope, id, IMAGE_THUMB_EDGE)` (the card face's size, so the first picture's copy is shared), its
  button named "{Field}: image i of n" opening `openImageWhole` (`image-open.ts`, shared with Attachments' Open),
  Alt+←/→ `movedImage` (focus kept on the moved tile, "Moved to i of n" announced), a Remove cross and a grip
  (touch, `HANDLE_TOUCH`) in its corners; dragging through `apps/editor/components/primitives/useGridReorder.ts`
  (`gridSlot`: the nearest middle; `slotAfterMove`; `GRID_DRAG_THRESHOLD_PX` 4 before a press becomes a drag, the
  click after a drag swallowed). Uploads through `use-image-field-upload.ts` (`useImageFieldUpload`): each file
  `checkImageFile`d first (refused ones said "{name}: {why}"), the room (`IMAGE_FIELD_PICTURES_MAX` less held and
  pending) said once as "{Field} holds up to 20."; a landed id the field already holds (`withImagesAdded` adds nothing and
  skips nothing: the same bytes, the same media id) said "{name} is already in {Field}." (`imagesDuplicateMessage`); one queue, one upload at a time, each `PendingImage` a tile
  (`waiting`, then `uploading`, its `PendingTile`'s ring a Cancel Upload button calling `cancel(key)`: a waiting key
  is skipped by the queue, an uploading one aborted), and one `patchItem` of `imageFieldValue(def, withImagesAdded(storedImageIds(card
now), [id]).ids)` per landed file; "N images added" announced at the end. The card face: `customKindPill` hands
  `ImageThumb` `more` (held less one), drawing "+N" after the first picture and naming it "{Field}: N images". Every
  remove and move tracks `Plan · Removed · CardImage` and `Plan · Moved · CardImage`. Still to come: the agents'
  writes (plan-agents blueprint "Pictures").
- Blocked By (spec "Blocked By"; `blocked-by.ts`): `CustomFieldDef.blocks` (kept by `readCustomField` only as true on a
  `card` field); `isBlocksField(f)`; `blocksFieldsOf(type)` (the type's offered Blocks fields, in field order);
  `blockerIdsOf(item, type)` (every id its Blocks fields hold, each once, through `linkedCardIds`, never itself);
  `blocksValueChanged(types, before | undefined, next)` (the first Blocks field, of either card's type, whose stored
  value differs by JSON; the api's Editor gate). `blockingIndexOf(items, types, isDone)` makes a `BlockingIndex` in
  one pass: `blockers` (a card's live blockers by id: present, not itself, not trashed or archived), `blocks` (the
  live, unarchived cards each card blocks, in number order) and `open` (a card's count of live blockers whose status
  `isDone` does not count as done); a trashed card is never read as blocked. `openBlockersOf(index, id)` reads it.
  Loops: `blockingLoop(items, types, itemId, blockerId)` answers the chain (blocker first, `itemId` last) when
  `blockerId` already waits on `itemId` through Blocks fields (an iterative depth-first walk over `blockerIdsOf` of
  every card, trashed and archived included, a visited set so an old loop ends it), else null;
  `blockingCycleOf(items, types, changes)` checks each change's new edges (blockers its next state holds that its
  before state, under its own type, did not; a create's all), and answers the first loop as `{ itemId, chain }`;
  `blockingLoopMessage(chain)` is "#5 Launch already waits on #3 Website, so it can't block it." (with
  "through #7 Copy" when the chain is longer). `ItemRejection` gains `blocks_cycle`; `writtenItemsRefusal` runs
  `blockingCycleOf` over `before` with the upserts (create, patch, patches, move), so an offline plan refuses what the
  api refuses. `waitingOn(items, types, itemId)` answers every card that already waits on a card (one pass inverting the links,
  one walk down), what the panel's picker marks. Gantt: `ganttArrows(entries, index, phases)` (plan-view-gantt-arrows.ts) answers an arrow per blocker
  and blocked pair that are both row entries with a mark (`from`, `to` rows and tops, `done`), and
  `ganttArrowPath(from, to, rowH)` the elbow path (`GANTT_ARROW_STEP = 8`, the head `GANTT_ARROW_HEAD = 5`). Linked as:
  `LinkField.blocks` and `LinkedGroup.blocks`; `blocksHeading(label)` is "Blocks" for a field named Blocked By
  (ignoring case), else "Blocks ({label})". The api (`item-route-kit.ts` `blockersRefused`): when
  `blocksValueChanged` names a field, a caller without edit gets 403 (`[items] items.blocks.refused`), then the
  project's items are read once and `blockingCycleOf` refuses a loop with 400
  `{ error: 'blocks_cycle', field, message }` (`[items] items.blocks.cycle`); a write that touches no Blocks field pays
  for nothing. Create, bulk, patch, patches and move all run it. Agents: `CustomFieldInput.blocks` /
  `CustomFieldEdit.blocks` (another kind refused: "only a card field blocks"; true sets `multiple` too, false
  clears `blocks` alone), `listedType` lists `custom[].blocks`, `planListing` adds `blocked` (open count, when > 0)
  and `blocks` (refs, when any) to each item from one `blockingIndexOf`, and `applyItemChanges` stops an add or set
  whose next state `blockingCycleOf` refuses (`blocks_cycle`, its message) before the write. The editor:
  no switch; Add Field's Blocked By tile presets `{ blocks, multiple }` (`KIND_VARIANTS`; `addedField` keeps `blocks`
  only on a card field);
  `planBlocking(plan)` (`components/plan/blocking.ts`) memoises `blockingIndexOf` in a `WeakMap` by the items map,
  reused while the catalogue and status phases keep their identity; `BlockedMark` (`plan-card-parts.tsx`, the Lucide
  link glyph at 12 px in `BLOCKED_COLOUR` `#dc2626` with its count, `role="img"` and a Tooltip, "Blocked by N open
  card(s)") before `FlagMark` in every `PlanCardFace` size, never on the Display's example card; `BlockedBySections`
  (`BlockedBy.tsx`, from `blockedByGroups`) sits on `ItemPanel`'s first tab before its Comments (the Linked as sections
  are on the Linked Cards tab, below), and `LinkedCardGroup` draws a
  `group.blocks` group as the Blocks mirror (no add buttons, not drawn when empty); `LinkedCardField` with `blocksFor`
  (the card's id) checks `blockingLoop` before a pick adds a card (refused: announce and toast the message, the field
  unchanged) and marks the rows `waitingOn` names "Waits on this card" (worked out once while the list is open); a
  Blocks field's control is read-only unless the plan's `canEdit` (an Editor), whatever `canEditCards`; `refusalMessage('blocks_cycle')` "Those cards would block each other in a loop";
  `GanttArrows` (`apps/editor/components/plan/views/gantt-arrows.tsx`) an `aria-hidden`, `pointer-events-none` SVG over the track in px. The SVG
  face (`svg-render-plan-card.ts`, its bits in `svg-render-plan-card-bits.ts`) draws a `blocked` bit (the link glyph path and count in red) after the title row's
  flag (Detailed) or at the end of the trail (Minimal), from `CardFaceContext.blocking`, made once per board or card
  by `svg-render-plan.ts` from the render's `itemsDone` (the plan-wide done statuses the editor's image exports and tab
  thumbnails pass), else the board's own done columns (the api thumbnail and the MCP images, where a lone Plan card
  shows no badge); `planArtResolver`'s Gantt (`plan-view-time-art.ts`) draws the arrows.
- `readItemTypeCatalogue(raw)`: a stored value (string or object) that validates, else null (built-ins).
- Card Age (spec "Card display"): `age` is a built-in card field (`CARD_FIELDS`, both sizes' `CARD_SIZE_FIELDS`),
  labelled "Age", in no `DRAWN` slot and so in no default; `typeOffersCardField` offers it on every type. The editor's
  `AgePill` (`components/plan/card-age.tsx`) reads `cardAgeDays(itemStatusSince(item), today)` with `today` from
  `useToday()` (one module timeout re-armed at local midnight, shared by every reader), and `cardAgeTone(days)`:
  `quiet` under `CARD_AGE_WARN_DAYS`, `warn` (amber, semibold) to `CARD_AGE_ALERT_DAYS`, `alert` (red, bold) from
  there. `PlanCardFace` draws it only when the card is not `muted` (a done column) and has a status. The SVG face
  (`svg-render-plan-card.ts`) draws the same pill from `Date.now()` at render time, only with the board's `isDone`
  in hand, and ignores the board's old `cardFields` for it (the spec says a board has no say).
- Created and Last Edited (spec items.md "Created and Last Edited"; `card-stamps.ts`): `STAMP_FIELDS`
  (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) are built-in card fields after `age` in `CARD_FIELDS` (Detailed
  only), labelled in `CARD_FIELD_LABELS`, in no `DRAWN` slot, offered on every type by `typeOffersCardField`
  (`AUTOMATIC_CARD_FIELDS`, Age and the four, which the Display's Available Fields lists under Filled In
  Automatically). They read the item's own properties: `itemStampTime(item, field)` (a finite moment > 0, else
  undefined) and `itemStampPerson(item, field)` (an `ItemPerson` with a non-empty id, else undefined: the api's
  unknown person), `stampDay(ms)` the local `YYYY-MM-DD`. Sort: `BOARD_SORT_BUILT_INS` gains `createdAt` and
  `updatedAt` (kind `date`, read as the ms number, offered whenever a board shows any type). Lanes: `STAMP_LANE_FIELDS` (two `date`, two
  `person`, `readOnly`) are in `laneFieldsOf` whenever it is given any type, so Card Search and the card finder filter by them too;
  `laneOf` reads them from the item (`stampDay`, `itemStampPerson`), `laneDropPatch` sets nothing for them and
  `boardLanes` adds no empty row. `normaliseBoardSetup` keeps them as a `swimlaneField`. The editor's `StampBit`
  (`components/plan/card-stamps.tsx`) draws the dates (clock, pencil) and `PersonDisc` the people; the SVG face
  draws the date as a muted pill and the person as its disc. The panel's `ItemMeta` reads the same helpers.
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
- Formula fields (item-types.md "Formula fields"): `calculation: 'formula'` (`CALCULATIONS`' third) with `formula`
  (stored text, ids in braces) and `result` (`FORMULA_RESULTS`, `number` stored as absent; `currency` beside a
  Currency result). `readCustom` keeps `formula` as any string up to `FORMULA_MAX` (a broken one is kept: the field
  shows the problem), refuses an unknown `result` or a bad `currency`.
  - The language, `packages/items/src/formula/`: `limits.ts` (`FORMULA_MAX` 1,000, `FORMULA_DEPTH_MAX` 32,
    `FORMULA_STEPS_MAX` 10,000, `FORMULA_ROUND_PLACES_MAX` 10, `FORMULA_CACHE_MAX` 512, `FORMULA_QUOTE_MAX` 32 (`CUSTOM_FIELD_LABEL_MAX`, so a
    real field name is quoted whole), the results and their labels), `tokens.ts` (`quoted(text)`: what a problem quotes, cut to
    `FORMULA_QUOTE_MAX` with an ellipsis; `tokenize`: one character loop, no regex over the text; names as runs of words or
    braces, `\}` and `\\` the escapes inside braces (any other `\` kept as it is), `""` in text, `==`/`<>` aliases), `parse.ts` (`parseFormula`: recursive descent, comparison < sum <
    product < unary < primary, depth counted on brackets, calls and signs; arity checked from `FUNCTIONS`;
    `refsOf`), `functions.ts` (`FUNCTIONS` with min/max arity and lazy arguments, `functionNamed` by own key only,
    `arityText`), `values.ts` (`FormulaValue`: number, text, boolean, null, `{ day }`, `{ list, field }`;
    `FormulaFail`, `toNumber`, `toText`, `truthy`, `dateOf` without a regex), `evaluate.ts` (`evaluateTree` with a
    shared `budget`, reading fields only through `read(id)`, the value source a rollup will add to),
    `references.ts` (`formulaScopeOf(type)` WeakMap-cached: the readable fields in type order with Number and
    Type last, names to ids with custom names first, the unreadable kinds' reasons; `storedFormula(text, scope,
selfId)` names to ids by token spans, `shownFormula` ids to names (`nameAsWritten`, `{deleted field}` for a
    lost id), `missingFieldProblem`), `compile.ts` (`compileFormula(stored)`: tree, ids, `usesToday`, cached by
    text in a bounded Map).
  - `formula-fields.ts`: `isFormulaField`, `formulaResultOf`, `formulaOutcome(field, item, type, ctx)` (never
    throws; `{ ok, value } | { ok: false, error }`), `formulaValue` (null on a problem), `formulaText` (by result:
    locale number, `currencyText`, "40%", `dayLabel`, Yes/No), `formulaProblem(field, type)` and
    `FORMULA_ERROR_TEXT`. Per run: the step budget, a `visiting` set (circular reads), a `done` map (each nested
    Formula once per card), blank tracking (every read field empty: null), today read once (`ctx.today` or the
    runtime's local day). Card fields read through `fieldCardIds`/`fieldPeople` (lists when `holdsSeveral`), Child
    Count and Children Done through `ctx.calculated`.
  - `calculated-fields.ts`: `CalculatedValue` (`FormulaScalar`), `calculatedValue(..., formula?)` and
    `calculatedOutcome(..., formula)` pass the type and items, `calculatedValuesOf(..., items?)`, `calculatedText`
    by result. `board-sort.ts` offers a Formula with a Number, Currency, Percent (as number) or Date result and
    reads it through `formulaValue`; `boardSortComparator(sortBy, types, items?)`. `board-csv.ts` writes a
    Formula's column (`cellOf(formulaValue)`); Import skips it. `card-source.ts` answers a Formula by name.
    `type-change-fields.ts` takes `formula` (names) and `result` on `custom`, `addCustom` and `editCustom`
    (`withFormula`, resolved after the change's fields with `resolveFormulas`; "The formula for "Left" doesn't
    work: ..."). `plan-listing.ts` lists `formula` (shown), `result` and `formulaError`; the api answers the
    widened `calculated`; the SVG export draws a Formula with or without the cards.
  - Editor: `FormulaEditor.tsx` (Result and Currency, the Formula box, the check line `role="status"` (its text
    `line-clamp-2`, read whole by a screen reader), `CalculatedPreview` (right under the check
    line, above the chips, so it clears Add Field's sticky footer on a 390 px phone with a two-line problem:
    measured in the e2e stack at 390x844, Work Tracker #510) on the type's first live card
    through `calculatedFieldOutcome`, then Fields and Functions chips inserting at the caret), made from Add Field's Formula tile (`KIND_VARIANTS.formula`; `CalculationSelect` offers only
    `COUNT_CALCULATIONS` and shows only while `pickOf(field)` is `calculated`), `CustomFieldForm` (keeps the last working formula) and `AddFieldShape`
    (`kindReadiness` 'formula', "Write a formula that works.", kept `sr-only` for that one readiness: the check line says the problem). `PlanCardFace` draws a problem as a red "Error"
    pill with the problem in its spoken label; `CalculatedFieldValue` shows the problem in red,
    "No value" for none, and a Percent result shown as a Percent (`showAs`) through `percentShown`, as Children Done.
    `FormulaEditor`'s Result menu drops `showAs` when the result leaves Percent (`calculationPatch` too); `readCustom`
    reads `result` before `showAs`, so `canShowAsPercent` sees it.
- Rollup and Lookup fields (item-types.md "Rollup and Lookup fields"): `calculation: 'rollup' | 'lookup'` with
  `through` (a Card field id; a Rollup without one reads every child), `aggregate` (`AGGREGATES`, Rollup only, Sum
  when absent) and `source` (a field id, `#key` or `#type`), plus `result` and `currency` taken from the source when
  written (`inferredResult`), so every surface reads the kind without the walk. `readCustom` keeps them by
  `READ_FIELD_PATTERN`.
  - `calculated-result.ts`: `hasResult` (Formula, Rollup, Lookup), `isRollupField`, `isLookupField`,
    `calculatedResultOf`. `rollup-fields.ts`: `AGGREGATE_LABELS`, `aggregateOf`, `aggregateReads` (number, date,
    any or none), `aggregateFits`, `aggregateNeeds`, `readableFieldsOf` (through `formulaScopeOf`),
    `rollupThroughOptions`, `rollupChildTypes`, `lookupThroughOptions`, `rollupSourceOptions`,
    `lookupSourceOptions`, `rollupSettings` (the settings and the result they give), `rollupProblem` and
    `GONE_PROBLEM`.
  - `calculated-fields.ts` is the one walk: a top-level read memoises each (card, field), keeps a `visiting` set
    ("Circular: X reads itself"), stops at `CALCULATED_DEPTH_MAX` (8) and shares `CALCULATED_STEPS_MAX`
    (100,000) with the Formulas it reads (`ctx.steps`, each Formula still at most `FORMULA_STEPS_MAX`). A stopped
    walk makes the whole value a problem; a child's own problem is skipped as a blank. The child index
    (`childIndexFor`, WeakMap per items map) records the Card field each link came through, so `childrenOf(item,
index, through?)` filters without a second pass. A Lookup reads the first live linked card (missing and
    trashed skipped, archived read); lists read as text. `calculatedReaderOf(items, types, isDone?)` gives the
    surfaces one reader (`CalculatedRead`) per items map.
  - Surfaces: `board-sort.ts` sorts any `hasResult` field by its result; `board.ts` adds read-only `calculated`
    swimlane fields (`CALCULATED_LANE_KINDS`, `laneDropPatch` answers `{}`), and `projectBoard` builds `isDone`
    from the board's done columns; `board-csv.ts` and `card-source.ts` read through `calculatedReaderOf`;
    `type-change-rollups.ts` resolves `through`, `aggregate` and `source` by name on `custom`/`editCustom`
    (`resolveRollups`, after `resolveFormulas`) with refusals in `type-change-refused.ts`; `plan-listing.ts` lists
    `through`, `aggregate`, `source`, `result`, `currency` and `error`; the api passes the plan's types to
    `calculatedValuesOf`; the SVG export passes `isDone` and the types.
  - Editor: `RollupEditor.tsx` (Through, Calculate, Field, `CalculatedPreview`, then the `role="status"` line, so a longer line never pushes Preview under Add Field's footer on a phone; `rollupPatch`) in
    `CustomFieldForm` and `AddFieldShape` (`kindReadiness` 'through' and 'source'); `CalculatedPreview.tsx` is
    shared with `FormulaEditor` (a Rollup's prefers the first card with a value other than 0). While it waits (`field` null)
    its row does not wrap: the card's title truncates and the waiting words keep one line (Work Tracker #510), except in
    a box under 19rem (`@container`, a 320 px phone), where they wrap to a line of their own; the card's number never
    shrinks and the title keeps 1.5em for its ellipsis. A `textarea` or `select` change before Preview in its form
    scrolls it into view (`block: 'nearest'`, one animation frame later) with `scroll-mb-24` clearing Add Field's
    sticky footer (Work Tracker 693).
- Percent fields (spec "Percent"): `percent-fields.ts` (packages/items) is the one reading, shared by every surface:
  `PERCENT_MIN` 0 and `PERCENT_MAX` 100; `percentValue(v)` (a finite number, or numeric text with an optional "%",
  rounded and held to 0..100 by `clampPercent` from `@liveworkspace/model-core/progress-label`, else undefined; the
  readers' clamp, so a stray 140 draws 100); `parsePercent(v)` (the writers': the same reading, but undefined outside
  0..100 rather than held, so agents and CSV refuse or skip it); `percentText(n)` ("40%");
  `PERCENT_SHOWABLE_KINDS` (`['calculated']`: the worked-out kinds that may show as a Percent; Rollup
  joins it), `canShowAsPercent(field)` (a showable kind whose result is a share: Calculated with `childrenDone`, or a
  Formula, Rollup or Lookup with `result: 'percent'`),
  `showsAsPercent(field)` (`kind: 'percent'`, or `showAs: 'percent'` on a field `canShowAsPercent` allows) and
  `percentShown(field, value)` (the share a field shows, from its stored value or the worked-out one, or undefined).
  `clampPercent` moves to model-core; every product's `data-shapes.ts` re-exports it, so the canvas's progress
  elements and the Percent field round the same way.
  - `item-types.ts`: `percent` in `CUSTOM_FIELD_KINDS` after `currency`; `showAs?: 'percent'` on `CustomFieldDef`.
    `readCustom` keeps `showAs` only as `'percent'` on a field `canShowAsPercent` allows; `type-change-fields.ts` takes
    `showAs` on `add` and `editCustom` (`'percent'` or `'number'`, `'number'` deleting it; a field that can't show as
    a Percent is refused: "{Field} can't show as a percent: only a share, like Children Done or a Percent formula, can."), and a
    calculation edited to `childCount` drops it.
  - Values: `plan-names.ts` reads a Percent by `parsePercent`, refusing `value_invalid` "{Field} is a percent: give a
    number from 0 to 100."; `board-csv.ts` writes the number and imports by `parsePercent` (a cell it can't read is
    skipped); `card-text.ts` `customFieldText` gives `percentText(percentValue(v))`; `board-sort.ts` sorts it as a
    number; `board-lane-fields.ts` lanes it as a Number (`LaneFieldKind` `'percent'`, its row named "40%"); `required-fields.ts`
    lets it be required (0 is a value). `plan-view-charts.ts` leaves it out of Cards by Field's sums. Forms'
    `MAPPABLE_KINDS` never name it.
  - Editor: `PercentBar.tsx` is the shared drawing: `PercentBar` (`value`, optional `inks` `{ fill, track }`, else the
    app's slate track and brand fill), `PercentChip` (the card face's `MetaPill`: the bar at `PLAN_PERCENT_BAR` in
    `planPercentInks(palette)` from `@liveplanner/project`'s `plan-palette.ts`, the export's own, and "40%", spoken
    "{Field}: 40%") and `PercentReading` (the panel's read-only bar across the row and the number: a Viewer's Percent
    field, `CalculatedFieldValue` when it shows as a Percent, and Add Field's preview).
    `PercentSlider.tsx` is the panel's control (a `role="slider"` with `aria-valuemin` 0, `aria-valuemax` 100,
    `aria-valuenow`, `aria-valuetext` "40%" or "No value", `aria-label` the field's name; pointer capture on the
    track, `shareAt(clientX, rect)` drawn live in local state and committed once on pointer up, a cancel putting it
    back; keys step and commit; the number box, the row label's target, `typedShare(raw)` committing on Enter or
    blur, Escape restoring; a Viewer gets `PercentReading`, or "None"). `CustomFieldEditor` routes `percent` to it; `PlanCardFace` and
    `svg-render-plan-card-bits.ts` draw every field `showsAsPercent` allows through the chip (a `percent` bit: the field's
    name, a `PLAN_PERCENT_BAR` track and its fill in `planPercentInks`, then "40%"; a narrow pill shortens the name
    and keeps the bar and the share). `ItemTypeFieldForms` shows the `ShowAsPercentSwitch` (a `FieldSettingRow`,
    below, tracking `Plan` · `Changed` · `FieldShowAsPercent`) on a Calculated field `canShowAsPercent` allows, in Add
    Field's Shape and in the field's form; `calculationPatch(calculation)` drops `showAs` with a Child Count, and
    `addedField` keeps it only where allowed.
  - Agents: `plan-schema.ts` adds `percent` to the kind enum and `showAs` to `add`/`editCustom`; `plan-listing.ts`
    lists `showAs` on a field that shows as a Percent; the OpenAPI schema is regenerated (`gen:openapi`) from
    `CUSTOM_FIELD_KINDS` and `CustomFieldDef`.
- Pull Request fields (kind `pullrequest`, after `link` in `CUSTOM_FIELD_KINDS`): the reading module, every consumer
  and the tests are in [github-pull-requests.md](github-pull-requests.md#part-1-the-pull-request-field).
- Date and Time, Date Range and Phone fields (spec "Date and Time", "Date Range", "Phone"; kinds `datetime`,
  `daterange`, `phone` in `CUSTOM_FIELD_KINDS`). Each kind has one reading module in packages/items, shared by every
  surface:
  - `date-time-fields.ts`: `readInstant(v)` (`{ ms, zone? }` from any ISO 8601 date-time with `Z` or `±HH:MM`,
    optional seconds and fraction, optional `[Area/City]` suffix; else undefined); `instantValue(ms, zone?)` (the
    stored form, `YYYY-MM-DDTHH:MM:00Z` plus `[zone]`, the minute floored); `isInstantValue(v)`;
    `parseDateTime(text, { local? })` (the stored form, or undefined; `local` reads a time with no offset in the
    runtime's own zone, "2026-10-31 17:00" too, and stamps the runtime's zone; without `local` an offset is
    required); `instantIso(v)` (`YYYY-MM-DDTHH:MM:SSZ`, the zone dropped; agents and CSV); `zonedParts(ms, tz?)`
    (year, month, date, hour, minute in `tz`, else the runtime's zone through the Date getters; one cached
    `Intl.DateTimeFormat` per zone), `zonedDay(ms, tz?)` (that day as a day number), `zonedInstant(day, hour, minute,
tz?)` (the inverse, a clock change resolved as the platform does: a skipped time moves forward, a repeated one
    takes the first); `shiftInstant(v, days, tz?)` (whole days keeping the wall-clock time and the zone);
    `instantOnDay(v | undefined, day, tz?)` (an instant moved to `day` keeping its time, or a new one at
    `TIMED_DEFAULT_HOUR` 9:00); `dateTimeText(v, style 'short' | 'medium', { tz?, now? })` (weekday, day, short
    month, the year in `medium` or when not `now`'s, and the time, in the viewer's locale and clock; one cached
    formatter per style, zone and year shape); `dateTimeZones(v, tz?)` (the panel's zone line: "Your time,
    Europe/London", then "· Set as Fri 31 Oct, 13:00 in America/New_York" when its zone differs); `localInputValue(v, tz?)`
    and `fromLocalInput(text, tz?)` (a `datetime-local` box's `YYYY-MM-DDTHH:MM`); `viewerZone()`.
  - `date-range-fields.ts`: `readRange(v)` (`{ start, end }` from a two-item list whose ends are both days or both
    instants, in order; else undefined); `rangeValue(a, b)` (the two ends in order); `parseDateRange(input,
withTime, { local? })` (a list of two, or text split at `/` or " to ", each end read as a day, `cardDateOf`, or a
    `parseDateTime`; a range of days refuses an instant and the other way round); `rangeIso(v)` ("start/end", each
    end `instantIso` when timed); `dateRangeText(v, style, { tz?, now? })`; `rangeEndOf(v, role)` (`start` the first
    end, `due` the last); `rangeWithEnd(v, role, end)` (one end replaced, the other moved along when crossed, or both
    set from `end` when there was none); `isTimedRange(field)` (`withTime === true`).
  - `phone-fields.ts`: `PHONE_MAX` 32, `PHONE_DIGITS_MIN` 3, `isPhoneNumber(v)` (trimmed, at most `PHONE_MAX`,
    `/^\+?[\d ()-]+$/` with at least `PHONE_DIGITS_MIN` digits), `phoneHref(v)` (`tel:` and the `+` and digits), and
    `PHONE_HINT`.
  - `readCustom` keeps `withTime` only as `true` on a `daterange` field (dropped elsewhere, never refused);
    `type-change-fields.ts` takes `withTime` only on an added `daterange` field (refused on another kind); `editCustom`
    takes no `withTime`, since Include Time is chosen when the field is made. `canBeRequired` allows all three; `isEmptyFieldValue` reads an empty
    list as empty.
  - Readers: `customFieldText` (a Date and Time `dateTimeText` short, a Date Range `dateRangeText` short, a Phone as
    typed); `board-sort.ts` (`datetime` sorts by its ms and `daterange` by its start's, as kind `date` keyed by
    number); `plan-names.ts` `resolveFields` (`parseDateTime` without `local`, `parseDateRange`, `isPhoneNumber`,
    each refused with its hint); `board-csv.ts` (out: `instantIso`, `rangeIso`, the phone as typed; in:
    `parseDateTime(..., { local: true })`, `parseDateRange(..., { local: true })`, `isPhoneNumber` after dropping a
    leading `'`); `view-fields.ts` (`viewDateOptions` and `viewDatesOf` take the three date kinds; `ViewDates` gains
    `shapes`, each role's field shape, absent for the built-ins); `plan-view-dates.ts` `dayNumber(v, tz?)` reads an
    instant's day in `tz` (the runtime zone without one); `view-dates-write.ts` `roleValue(item, dates, role)` (a
    range's end for its role) and `roleDays(item, dates, changes, tz?)` (the `set` that writes whole days to each
    role: `dayKey` for a date, `instantOnDay` for an instant, `rangeWithEnd` for a range, both roles of one range
    in one value), used by `calendarMove`, `ganttDrag`, `ganttDrawn(a, b, dates, item)` and `ganttNewCardDates`;
    `ganttModel` marks a timed Due overdue by `now`'s ms; `calendarModel` gives each card `at` (the ms of a timed
    date) and lists a day's untimed cards first, then timed by `at`.
  - Agents: `plan-schema.ts` adds the kinds and `withTime` (add only); `plan-listing.ts` lists `withTime` and reads a
    value as `instantIso` / `rangeIso`; the OpenAPI schema is regenerated (`gen:openapi`).
  - Editor: `DateTimeInput` (`components/plan/DateTimeInput.tsx`, a `datetime-local` box with `DateInput`'s whole-
    value rules), `DateRangeField` (`components/plan/DateRangeField.tsx`, From and To), `PhoneField`
    (`components/plan/PhoneField.tsx`, a `tel` box and its `tel:` link), each from `CustomFieldEditor`; samples in
    `CustomFieldKindParts` and `item-type-display-sample.ts`; Add Field's Date and Time Range tile presets `withTime` (no switch);
    `add-field-kinds.ts` places Phone in Links and Images and Date and Time and Date Range in Dates, with the
    spec's words; the card face draws a past Date and Time or Date Range in red (`pastDue(field, value, now?, tz?)`
    in `date-range-fields.ts`), never on a done card; `CustomFieldEditor`'s `ZoneLine` (`dateTimeZones`) sits under
    a moment's box and a timed range's boxes. `formula-fields.ts` reads a Date and Time as `instantIso` text and a
    Date Range as a list of its ends; `card-source.ts` (sheet card functions, card tables) as `instantIso` and
    `rangeIso`. Forms: `QuestionControl` (a `tel` box; a `datetime-local` box sending `fromLocalInput`; `RangeAnswer`,
    From and To, sending the two ends or nothing), `QuestionSettings` (Include Time), `PlaceholderField` (Phone).
- Risk fields (spec "Risk"; kind `risk`, after `multichoice` in `CUSTOM_FIELD_KINDS`), built in parts (Work Item 700),
  each leaving main whole; until the last, `KINDS_IN_PROGRESS` (`item-types.ts`, `['risk']`) keeps the kind out of
  `OFFERED_FIELD_KINDS`, the kinds Add Field and agents offer, so no one can add a field a surface cannot yet draw:
  - Part 1, the model: `risk-fields.ts` (packages/items) is the one reading: `RISKS` (`critical`, `high`, `medium`,
    `low`, most pressing first), `Risk`, `RISK_LABELS`, `isRisk(v)`, `riskOf(text)` (a level from its id or name,
    trimmed, any case; undefined otherwise), `riskLabel(v)` (its name, or null), `riskRank(v)` (Low 0 to Critical 3,
    undefined for no level, so a higher rank sorts as more pressing) and `RISK_HINT` ("Pick Critical, High, Medium
    or Low"). `RISK_COLOURS` sits beside `PRIORITY_COLOURS` in packages/project `plan-palette.ts`. `readCustom` reads
    a `risk` field with no settings (options and any other kind's settings dropped, never refused). Readers:
    `customFieldText` (its name); `board-csv.ts` (out: its name; in: `riskOf`); `field-kind-change.ts` (`textOf` and
    `partsOf` read it as its name; to `risk` through `customValueOfText`, so "high", "High" and a Choice's "High"
    keep their level; `optionsFromValues` from a Risk starts with the four names, in order). The editor's
    exhaustive kind maps take it (`CUSTOM_KIND_LABELS` "Risk", `CUSTOM_KIND_ICONS` the `risk` glyph, Add Field's
    `KIND_DESCRIPTIONS` and `KIND_ALIASES`, a sample chip "High" in `RISK_COLOURS.high`; `CustomFieldEditor` draws
    nothing for it yet), but no category places its tile. The OpenAPI schema is regenerated (`gen:openapi`), as it
    lists the stored `CustomFieldKind`; the agents' kind enum is `OFFERED_FIELD_KINDS`, so it does not change. `PROJECT_FORMAT` (packages/api-schema `project-format.ts`) is bumped to 5 with `risk` in format 5's kinds (`project-format.test.ts`), so an editor on 4 reads a Risk field as a newer field and is offered Reload.
  - Part 2, board behaviours (packages), every reading by the level's id and named by `riskLabel`:
    - Sorts, `board-sort.ts`: `risk` is in `BOARD_SORT_KINDS` and is its own `BoardSortKind` (`'risk'`), read by
      `riskRank` (no level `undefined`, so last either way), named Lowest First and Highest First, and
      `defaultBoardSortDir('risk')` is `desc`, Critical first, as Priority's is.
    - Swimlanes, filters, saved filters, Card Search and Cards by Field (all read `laneGroups`):
      `board-lane-fields.ts` takes `risk` into `GROUPING_KINDS` and `LaneFieldKind`; `laneValue` reads a stored
      level (`isRisk`) and anything else as the No row; `fieldLane` names a level's row by `riskLabel` ("High", its
      key `f:"high"`), the empty row "No {Field}"; `board-lanes.ts` orders the rows by `RISKS` (Critical first, No
      {Field} last) and `boardLanes` lays a row per level, cards or not, as it does a Choice's options, so a drop
      sets the level's id; `card-search.ts` `keyLabel` names a level no card has any more by `riskLabel`.
    - Widgets: `field-widgets.ts` `fieldShapeOf` reads a Risk as `{ kind: 'category', from: 'risk' }` (Breakdown,
      Donut); plan-art `field-widget-stats.ts` counts only stored levels, each named by `riskLabel` and coloured
      `RISK_COLOURS[level]`, in the levels' order (Critical first), never commonest first; the editor's
      `FieldWidgetView` colours a segment by that colour.
    - Sheets: `card-source.ts` reads a Risk as its name ("High") for card tables and card functions; a card table
      writes one back through `resolveFields` (`plan-names.ts`): `riskOf` reads a name or id in any case, and any
      other text is refused (`choice_unknown`, `"Severe" is not a Risk level. Pick Critical, High, Medium or Low.`).
      The same reading serves `change_items` once part 4 offers the kind.
    - Formulas: `formula-fields.ts` reads a Risk as its name, as text (`null` for none).
    - Forms (packages/forms): `TYPE_QUESTION_KINDS.risk` is `single`, its question's options the four names in
      order (`RISK_OPTIONS`); `MAPPABLE_KINDS.single` gains `risk` (after `text`, so `[1]` stays the text kind
      Other falls back to); `fieldTakes` takes a single question with no Other whose every option names a level;
      `card.ts` keeps the answer as its level's id (`riskOf`). Set Automatically: `FixedKind` gains `risk`
      (`fixedFieldsOf` gives it the four names as options), `fixedValueOf` keeps a value that names a level as its
      id; agent-verbs `form-fixed.ts` reads a name or id and names it in a refusal (`a risk level: "Critical", "High",
"Medium", "Low"`), and the builder's `SetAutomatically` offers the four levels as Priority's are (its hint
      Risk), starting on Medium.
    - Tracker import (`tracker-type.ts`, `tracker-plan.ts`): a plan's Risk field takes an import's Choice or Text
      extra of the same name, each value through `riskOf`, and a value naming no level is left off the card.
    - Automations' Set Value (`packages/items/src/automation/set-value.ts`): a `risk` field takes text naming a level (`riskOf`), any
      other is refused `{Field} has no "{text}"`, as a Priority's is.
    - `canBeRequired('risk')` is true, and an empty Risk is no level.
    - The editor's exhaustive kind maps take the new kinds: `BoardSortOptions` `SORT_KIND_GLYPHS.risk` and
      `plan-menu-parts` `LANE_KIND_GLYPHS.risk`, both the `risk` glyph.
  - Part 3, the editor: the card panel's Risk control (the Choice control with the fixed levels and colours), the
    card face pill, the selection bar's Set Risk menu, Add Field's Risk tile (sample, line, search words), Edit
    Field's kind changes, filters, swimlanes and widgets on screen, and the sheet's card field options.
  - Part 4, agents and help: `risk` leaves `KINDS_IN_PROGRESS` (so `plan-schema.ts`'s kind enum and
    `type-change-fields.ts` take it), `plan-listing.ts` lists the levels, `change_card_types`' description names the
    kind, the OpenAPI schema is regenerated (`gen:openapi`), and the help centre's card fields article gains Risk.
- Duration fields (spec "Duration"): `duration-fields.ts` (packages/items) is the one reading, shared by every
  surface: `DURATION_HOURS_MAX` 99,999 and `DURATION_MINUTES_MAX`; `parseDuration(v)` (a number is minutes; text
  "2h 30m", "2h30m", "1.5h", "90m", "2:30" or a bare number of minutes, every character but spaces and commas
  belonging to a part, rounded to a whole minute, else undefined); `durationText(m)` ("2h 30m", "45m", "3h", "0m");
  `durationSpoken(m)`; `DURATION_HINT`; `isTimeSpent(field)`; `durationMinutes(field, raw)` (whole minutes, a Time
  Spent field its entries' total) and `runningOnCard(item, type)` (the card face's runners, earliest first).
  - `item-types.ts`: `duration` in `CUSTOM_FIELD_KINDS` after `percent`; `timeSpent?: true` on `CustomFieldDef`,
    kept by `readCustom` only on a Duration; `type-change-fields.ts` takes `timeSpent` on `add` only (a field of another
    kind is refused), and a Time Spent field can't be required (`required-fields.ts` and `requirable` skip it).
  - Values: `plan-names.ts` parses by `parseDuration` ("{Field} is a duration: write a duration like 2h 30m, 90m or
    1.5h.") and refuses writing a Time Spent field ("{Field} is tracked: people add time in the card panel.");
    `board-csv.ts` writes `durationText` and imports by `parseDuration` (a Time Spent column is skipped);
    `card-text.ts`, `card-source.ts` (minutes for Formulas), `board-sort.ts` (`'duration'`, a number);
    `formula-fields.ts` reads minutes and gains a `duration` result (`limits.ts`, rounded to a whole minute, shown
    by `durationText`); `rollup-fields.ts` `readsOf`/`aggregateFits` take it, the result staying a Duration.
  - Time Spent (`time-tracking.ts`): the value `{ people, entries, running }` (`TimeValue`, people by id so 100
    entries fit the 16KB fields), `TIME_ENTRIES_MAX` 100 (entries plus running), `readTimeValue` (lenient),
    `carriedTimeValue` (strict, a restore's create), `timeTotal`, `timePerson`, `runningTimerOf`, `elapsedClock`,
    `readTimeOp` (`start`, `stop`, `add`, `remove`, `put`), `timeOpOwner`, `applyTimeOp` (rev + 1, Last Edited
    untouched, a stop under 30 seconds recording nothing, `time_full`) and `inverseTimeOp` (only `add` and an
    entry's `remove` undo). `store.ts` `ItemWrite` `{ kind: 'time', id, field, op }`; `write-checks.ts`
    `timeWriteRefusal` and `field_time_tracked` for any other write naming the field (create carries it only on a
    restore). Duplicate (`duplicate-item.ts`) drops it.
  - Api: `item-time-route.ts` (`POST /items/:id/time`, participate access, `writeItemsWithRetry`, 403
    `time_not_yours` when a Participant touches another person's timer or entry, no history); OpenAPI
    `ItemTimeRequest`.
  - Editor: `apps/editor/components/plan/time/use-now-seconds.ts` (one shared one-second clock through `useSyncExternalStore`, running only
    while a readout is mounted), `components/plan/time/TimerReadouts.tsx` (`Elapsed`, the only subscriber; `RunningDot`;
    `RunningTimerPill` on `PlanCardFace` at every size), `components/plan/time/DurationInput.tsx` (the panel's box),
    `components/plan/time/TimeSpentField.tsx` (total, Start Timer, Stop, Discard, others' timers, entries newest first, Show All,
    Add Time), routed from `ItemFieldEditor`; `usePlanItemWrites.trackTime` (through `usePlanSlice`) posts the write and sends the telemetry.
    Add Field's Time Tracking tile presets `timeSpent` (no switch in any form).
  - Exports: `svg-render-plan-card-bits.ts` draws the total and a green running pill (`TIMER_RUNNING_GREEN`).
  - Agents: `plan-schema.ts` adds `duration` and `timeSpent`; `plan-listing.ts` lists a card's `time` (total,
    running people) and a Time Spent field as read-only; agents never start, stop or add time.
- The Linked Cards tab ([spec](../item-types.md#linked-cards-tab)): `ItemPanelTabs.tsx` `LINKED_TAB = 'card-linked'`
  (a type's own tab ids start `t-`, so it never clashes) and `LINKED_TAB_LABEL`; `panelTabs(tabs, details, linked)`
  adds it after the type's tabs and before Activity when `linked` (the count) is not null, or puts the count on the
  type's own tab `namedLinkedTab(tabs)` finds (label trimmed, ignoring case). `ItemPanel` passes
  `linkedGroups.length > 0 ? linkedCardCount(linkedGroups) : null`, so the tab follows `linkedCardsOf` (a group for
  every Card field whose types include the card's, cards or none). `LinkedCardsTab.tsx` draws the groups:
  `linkedCardCount` (distinct card ids across groups); at none a `CompactEmptyState` (small, the Lucide link glyph,
  dashed border, "No Linked Cards Yet", the line with or without the adding half), then for `canAdd` the groups with
  `emptyNote={false}`; a Viewer gets the empty state alone. The tab is never in the type: the type editor, its
  6-tab limit and `readTabs` never see it. A card picked onto it keeps it while `shownTabs` holds it, and the panel
  falls back to the first tab when it goes (`current` is `shownTabs[0]` when `picked` is not found). Tab pill: 11px
  medium, slate-100/600 (brand-50/700 when selected, dark brand-500/15 and brand-300), `aria-hidden`, the tab named
  "{Label}, N card(s)" through `aria-label`. Tests: `apps/editor/components/plan/ItemPanel.linked.test.tsx`.
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
- Comments fields (spec "Comments and Votes fields"): `builtInFieldOfKind('comments')` is `comments`, so
  `ItemFieldEditor` draws `CardThreads` for each, with `type` and `field` (only that field's threads, `threadsInField`;
  New Thread starts in it). A thread carries its field (`CardThread.field`, absent for the built-in); the thread start
  route refuses a field the card's type does not offer as `400 field_invalid`, and the agents name it (list_threads'
  `field`, change_threads' `start { field? }`, `thread start --field`). On the face, `PlanCardFace` draws a placed
  custom Comments field as `CommentsPill` with its `field` and name (not through `customKindPill`); the built-in's
  chip counts only the threads it lists. Never required (`canBeRequired`), never a value (`resolveFields`,
  `customFieldText` null, no CSV value).
- Votes fields (spec "Comments and Votes fields"): `builtInFieldOfKind('votes')` is `votes`; the value is `{ voter:
dots }` under the field's id. `votesFieldsOf(type)` lists the type's Votes fields; `itemVotes(item, field?)` and
  `itemVoteTotal(item, field?)` read one (the built-in by default); `voteTotalOf(value)` (card-text.ts) totals a
  value. On the face, `customKindPill` draws a placed one as `VotesPill` (plan-card-parts.tsx, the built-in's ▲ chip,
  named "{Field}: N votes"); `svg-render-plan-card` as "{Field} ▲ N"; the Display sample (`sampleCustom`) is
  `{ 'sample-person': 2 }`; the Shape preview "▲ 3". It lives On the Card: `item-type-layout.ts`' `onCardOnly`
  (with title and votes) keeps it out of Details and every tab, and `tabsOf` / `detailFieldsOf` leave it out of the
  panel, as the built-in Votes. Written only by the tally: `resolveFields` refuses it ("votes come from a session
  vote"), `validateFields` refuses it in a patch (an object that is not a person); a create carries a non-empty
  voter map across (`carriedVotes`, an undo of a delete, a sync), as `votes` is carried. Never required.
- Count In (session-tools.md): `vote-count-in.ts`. `voteCountInChoices(boardSetups, types)` is the Votes fields the
  types the tab's boards take offer (`cardTypesTakenOnTab`, then `votesFieldsAcross`: the built-in first, deduped),
  as `{ id, label }`, empty when there is only the built-in. `voteTallyWrites(tallies, field, typeOf)` splits a
  tally: cards whose type offers `field` (`tallyFieldOn`) in one `{ kind: 'tally', field }` write, the rest in one
  write to the built-in. The editor's `useVoteCountIn` reads the active tab's boards and the plan's types;
  `VoteSetupBody` shows **Count In** (`StudioSegmented`, as Votable layer) when it has choices and starts the vote
  with `voteField` (absent for the built-in); `endVoteAndTally` sends `voteTallyWritesOf(vote, items, types)`.
- Image fields: `ImageField.tsx` (`ImageFieldControl` in the card panel, `ImageThumb` on the card face, lazy through
  an `IntersectionObserver`), reading through `apps/editor/lib/api/images.ts` (`apiUploadImage`, `apiImageUrl`,
  `releaseImageUrl`, `ImageUploadError`) with the plan's `itemsScope` (`PlanContext`, from `usePlanItems`). The api's
  `routes/images.ts` and the room's `plan-room/image-grants.ts` (api.md "Images"). A read passes the grant's
  `tabScope` to the room's `servesImage(planId, imageId, tabScope)`, which reads that tab with `getTab` and, unless
  `tabShowsEveryCard`, confines `planServesImage`'s match to `itemIdsShownOnTab`'s Plan card ids (`onlyCards`, one
  JSON parameter) (items.md "Who sees the bytes"). An upload with `onProgress` (every control's: `ImageField`,
  `use-image-field-upload`, `use-attachment-upload`) passes `uploadProgress` to `apiFetch`, which sends it by
  XMLHttpRequest (`@liveworkspace/workbench/lib/api/xhr-fetch`, the shared core's funnel, so the grant, the
  confinement, the network-failure report and the release signal are the fetch path's), and the controls draw
  `UploadRing` filling by the share sent, kept to whole percents so a fast line renders at most 100 times. An
  upload stopped by its `signal` rejects with the signal's reason, unworded: every control's Cancel aborts an
  `AbortController` it holds per upload (`ImageField`'s `cancelUpload`, `useImageFieldUpload`'s `cancel(key)`,
  `useAttachmentUpload`'s `cancel()`) and checks it again before its `patchItem`/`onSave`, so a cancel racing a
  finished upload writes nothing. A landed upload primes `images.ts`' `localOriginals` (the `File` itself, the last
  `LOCAL_ORIGINALS_MAX` (8), keyed as `apiImageUrl`'s cache is), which `apiImageUrl` reads before any fetch, so a
  new tile's copy is made from the browser's own bytes (Work Tracker 795: on a 400 KB/s line each fetch-back held
  the tile on its placeholder 5 to 7 s). An upload tracks
  `Plan · Added · CardImage`. A copy's grants (item-types.md "Image fields", Copies): `exportPlanCopy` fills
  `PlanCopy.imageGrants` from `copiedImageGrants(env, planId, itemIds)` (`image-grants.ts`, over
  `placedImagesSql(scoped)` from `image-refs.ts`: the copied cards' placed pictures, kept to the source's grants;
  `itemIds` null for a whole-plan copy, the tab's cards for a tab-scoped one), and `importPlanCopy` writes them with
  `copiedGrantsStatement` before the cards (ids over `IMAGE_ID_MAX` dropped, at most `IMAGE_GRANTS_MAX`), so the
  cards' insert queues the copy's `images` report. `importProjectFile` drops any `imageGrants` a file names.
- Attachments (items.md "Attachments"): the pure value and edits in `packages/items/src/attachments.ts`
  (`normaliseAttachments`, `itemAttachments`, `attachmentCover`, `withAttachmentsAdded`, `withCover`,
  `withoutAttachment`, `attachmentSizeText`; caps in `limits.ts`), checked by `validateFields`' `attachments` kind. The
  panel's `AttachmentsField.tsx` (rows, ⋯ menu from `PortalMenu`, the Add Images zone, the page's paste listener);
  uploads through `use-attachment-upload.ts` (`useAttachmentUpload`: one upload at a time, one `patchItem` of the
  whole list read from the card as it is then; `cancel()` aborts the batch going now); a board card's drop through
  `card-file-drop.ts` (`useCardFileDrop`, in `PlanBoardCard`, handing the card's pill `progress` for its
  `UploadRing onBrand`: the state lives in that card's own hook, so only the uploading card re-renders); the cover and the count chip in `CardCover.tsx`, drawn by `PlanCardFace` when the type's
  Detailed Header holds `cover`. Both pictures' URLs come from `use-image-url.ts` (`useImageUrl`, `useSeen`, shared
  with `ImageField.tsx`), at `IMAGE_COVER_EDGE` (640) and `IMAGE_ROW_EDGE` (160). The card fields `attachments` and
  `cover` are in `CARD_FIELDS`; `cardSlotFits` keeps `cover` to Detailed's `head`, and `typeOffersCardField` offers it
  while the type has `attachments`. Add Field's Ready to use lists Attachments under Image (`BUILT_INS_OF_KIND`). The
  api's reporting is `plan-room/image-refs.ts` (schema step V11: `media_refs` and the `outbox_images_*` triggers;
  `pushImageRefs` from the outbox's drain, never `complete` and nothing past `MEDIA_REFS_SYNC_MAX`; `forgetImageRefs`
  from the room's purge). `routes/images.ts` names the plan as the upload's `document`, so the media service claims
  the picture for it (none for a This Browser upload).
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
- **Add Field** (spec "Fields and Tabs": Add Field). `ItemTypeLayoutEditor` keeps `adding: { group, opener }` (the
  Add Field button pressed) and opens `AddFieldDialog` (`apps/editor/components/plan/AddFieldDialog.tsx`): the
  workbench `Dialog` (`size="3xl"`, `sm:w-[min(60rem,calc(100vw-2rem))]` so the gallery's illustrations keep their room on a desktop, `h-[min(40rem,calc(100dvh-2rem))]`, `phoneSheet` at
  `max-sm:h-[80dvh]`, `titleId` the gallery's `h2`, `closeOnEscape={false}`), a second panel portalled after the type
  editor's, so its dim layer covers the editor and the Dialog's top-panel rule keeps the editor from hearing Escape or
  a press on the dim layer. Its own `useEscape` asks the form's `escapeRef` first and closes only while its panel is
  the page's last `[data-dialog-panel]`. The focus trap is the Dialog's (the search first under a fine pointer, the
  panel under a coarse one); every close (`closeAdding`: an add, the cross, the dim layer, the sheet dragged down,
  Escape) focuses `opener` before unmounting. It holds `NewFieldForm` (`NewFieldForm.tsx`, with `dialogTitleId`),
  which keeps the step (`field: NewField | null`), the search text (kept across the steps), the field left by going
  back (`left`), the tile to focus on return (`focusKind: PickKind`, `pickOf(field)`, set only by All Kinds or
  Escape, never by typing) and the category to scroll to on return (`arriveAt`, a rail entry pressed while shaping),
  and answers Escape (`escape()`: shape →
  pick, then a typed search cleared, then false so the modal closes). It renders the galleries' shared frame
  (below) with the rail (`AddFieldRail`) and, beside it, either `AddFieldPicker` or `AddFieldShape` in a bare
  `GalleryList`.
  - The galleries' shared pieces, in `components/plan/gallery/`, used by Add Field and Add a Widget alike
    (board-widgets blueprint): `GalleryFrame` (an `@container` box, `max-h-[min(76vh,40rem)]`; with `dialogTitleId`
    the modal's look instead: no box of its own, `flex-1` in the panel, an `h2` at `text-lg` with that id, the
    header `px-5 pt-5`, the dialogs' `DialogCloseButton compact` after the search, and under 600 px the search
    `order-last` below the title and close; otherwise header `h3` title,
    its line, the search `input type="search"` with `aria-label` the search's label and a `Tooltip`-wrapped close
    `button` "Close" when `onClose` is given; the rail slot and the list slot in a row, a column under 600 px; a
    visually hidden `aria-live="polite"` line `said`), `GalleryList` (the scrolling list, `data-gallery-list`, padded
    unless `bare`), `GallerySectionHeading` (`h4` with an optional brand icon, then its line, `data-group-line`),
    `use-gallery-spy.ts` (`useGallerySpy(list, first, resetOn)` → `{ current, spy, goTo }`: `goTo(key, instant?)`
    scrolls the list to `[data-gallery-section=key]` by `sectionTop` (smooth unless reduced motion or `instant`) and
    marks it; `spy`, the list's `onScroll`, sets `current` to `sectionInView(list)`, the last section whose top has
    reached the list's top (+8 px), or at the list's end the last whose top shows; an equal value re-renders nothing,
    and the browser sends scroll events at most once a frame; a change of `resetOn` (the search key) marks `first`
    and scrolls to the top; Add a Widget's `BoardWidgetPicker` and Add Field's `NewFieldForm` both use it),
    `GalleryRail` (`nav` with `aria-label`; groups of entries `{ key, title, icon, count }`, a later group under a
    small heading; an entry is a `button` with `data-rail-entry`, `aria-current="true"` when current, `CountBadge`
    when its count is above 0, `opacity-55` at 0; `@min-[601px]:w-56`, chips under 600 px; at least 44 px under a
    coarse pointer), `GalleryTile` (the strip, `aria-hidden` and `inert`, `FitWidth` scaling what is too wide;
    glyph, name, line with an optional id; a badge at `TILE_BADGE_SPOT`; one overlay `button` with `aria-label`,
    `aria-describedby`, `aria-pressed`, `aria-disabled`, wrapped in a `Tooltip` when disabled) and `gallery-keys.ts`
    (`stepFrom(cards, at, key)`: ←/→ one, ↑/↓ the nearest tile in the next row by layout, two in reading order
    with no layout, -1 for ↑ from the top row; `moveAmongTiles(e, tiles, search)`: arrows, Home and End, ↑ off the
    top row to `search`).
  - Pure data and matching in `add-field-kinds.ts`. A **pick kind** (`PickKind`) is a `CustomFieldKind` (Comments
    and Votes among them) or a `KindVariant`: each opens Shape, Ready to use offering its built-in while the type
    lacks it. `KIND_VARIANTS` (`{ [variant]: { kind, preset } }`: `people` person `{ multiple }`; `time-tracking`
    duration `{ timeSpent }`; `datetime-range` daterange `{ withTime }`; `cards` card `{ multiple }`; `blocked-by`
    card `{ blocks, multiple }`; `formula`, `rollup`, `lookup` calculated `{ calculation }`), `storedKindOf(pick)`,
    `presetOf(pick)` and `pickOf(field)` (the variant while its option is on, `blocked-by` before `cards`, else the
    kind; round-trips every variant, test-locked). `PICK_KIND_LABELS` (`ItemTypeFieldForms`) and `PICK_KIND_ICONS`
    (`CustomFieldKindParts`: Users, Timer, CalendarCheck, Layers, Lock, Braces, Merge, ScanEye) name and draw every
    pick; `fieldIconOf` goes through `pickOf`, so a type editor row wears its variant's icon and name.
    `KIND_CATEGORIES` (`{ id: KindCategoryId, label, line, kinds: PickKind[] }[]`, the spec's table in its order:
    `text` Text; `numbers` Numbers; `dates` Dates; `time` Time; `choices` Choices; `people` People; `links` Links and
    Images; `cards` Cards; `calculated` Calculated; every `CUSTOM_FIELD_KINDS` member and variant once,
    a variant after its kind, test-locked), `categoryOfKind`,
    `shownCategories(key, labelOf, builtInNamesOf)` (each category with `shown`, its kinds that `kindMatches`; all of
    them for an empty key), `KIND_DESCRIPTIONS` and `KIND_ALIASES` (`Record<PickKind, …>`, the spec's words),
    `BUILT_INS_OF_KIND` (`Record<PickKind, ItemFieldId[]>`: longtext description; choice priority; number estimate;
    date start, due; person assignee; labels labels; colour color; checklist checklist; comments comments; votes
    votes; image attachments), `BUILT_IN_ROLES` (`Partial<Record<ItemFieldId, string>>`, the Ready to use lines),
    `readyBuiltIns(kind, missing)` (the kind's built-ins the type lacks, in `BUILT_INS_OF_KIND` order),
    `searchKey(q)` (trimmed, lower-cased, runs of spaces one), `kindMatches(kind, label, q)` (the whole query a
    substring of the label, the description, an alias or the name of a built-in of the kind, else every word of it a
    substring of one of them; a category's name is never a haystack) and `kindReadiness(field)` (`null` when ready,
    else `'name' | 'options' | 'links'`, in that order) with `READINESS_HINT`.
  - `NewFieldForm` works out `shownCategories(searchKey(query), …)` in a `useMemo` keyed on the search key only, so a
    re-render (the type editor's draft changing under it) never re-matches; the rail's counts and the said line ("N
    fields match", "1 field matches") come from it, and `useGallerySpy(list, first category with a match, key)` keeps
    the rail in step. Typing while shaping goes back to Pick (`back(false)`). A tile picked starts its field with
    `freshField(pick, left)`: `left` again when `pickOf(left)` is the same pick, else the name and Required kept,
    `storedKindOf(pick)`, `CALCULATIONS[0]` for a Calculated, then `presetOf(pick)`. The search's ↓ calls `focusFirstKind`; its Enter, with a key, presses
    the first `[data-pick]` (`pickFirstKind`); both do nothing while shaping. The rail is not rendered when a search
    matches nothing; while shaping its current entry is `categoryOfKind(pickOf(field)).id` and it is
    `@max-[600px]:hidden`. Pressing an entry on Pick calls `goTo`; while shaping it goes back to Pick
    (`back(false, category)`) and, once the list is back, `goTo(category, true)`.
  - Step 1 is `AddFieldPicker.tsx`: `AddFieldRail` (`GalleryRail` "Field categories": each category with its first
    everyday kind's icon, `CATEGORY_ICONS`, and its `shown` count; `current` from the spy) and `AddFieldPicker`, a
    `GalleryList` (`onScroll` the spy's; `onKeyDown` `moveAmongTiles` over
    `button[data-kind]`, ↑ off the top row to the search) holding `CUSTOM_MAX_NOTE` first (`role="note"`) when
    `canAddCustom` is false, then a `section` (`data-gallery-section` its id, `aria-labelledby` its
    `GallerySectionHeading`) per category that has a kind shown, its kinds in a two-column grid
    (`@max-[460px]:grid-cols-1`); none: `NoMatches` (`things` "fields",
    hint "Try a word like money, date or parent."). A kind is a `GalleryTile`: the strip `KindSample` (the Preview's
    `SampleValue` at its defaults, `CustomFieldKindParts.tsx`) in `FitWidth` at 13 px; root `data-kind-tile`; button
    `data-kind`, `aria-label` the kind's name, `aria-describedby` its line's id and, when `readyBuiltIns` is not empty,
    the **Ready to use** badge's id; `data-pick` unless dimmed. With `canAddCustom` false a kind with nothing ready is
    `aria-disabled`, dimmed, its label "{Kind}: Remove a custom field to add another" and its tooltip
    `AT_CAP_HINT`. On mount the `focusKind` tile takes focus (scrolling it into view), then `onArrive` (the form's
    `goTo(arriveAt)` or `spy`) brings the rail in step.
  - Step 2 is `AddFieldShape.tsx`, a `<form>` (`aria-label` "New {Kind} field"; `onSubmit` adds when ready, so Enter
    in Name submits; option rows and selects take their own Enter): a header with the back button (`ChevronLeft`,
    "All kinds") and the pill (`<span><span class="sr-only">Kind: </span>{label}</span>` with its icon); when
    `readyBuiltIns(kind, missing)` is not empty, a `section` headed **Ready to use** (`aria-labelledby`) of one
    button per built-in (`fieldIconOf(id)`, its `BUILT_IN_FIELD_LABELS` name, its `BUILT_IN_ROLES` line, a plus;
    `onAddBuiltIn(id)`), then a rule labelled **Or make your own**, and only that section when `canAddCustom` is
    false; `TextInput`
    labelled "Name" (`autoFocus`, `maxLength={CUSTOM_FIELD_LABEL_MAX}`); the kind's controls (`ChoiceOptionsEditor`,
    `RatingScaleSelect`, `CurrencySelect`, `LinksToPicker`, `CalculationSelect`, each with a visible label);
    `FieldSwitches` (below); `AddFieldTryIt` (none for a Formula, Rollup or Lookup); then a `sticky bottom-0` footer: the submit `Button` (full width,
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
  - `CustomFieldPreview` (`CustomFieldKindParts.tsx`) draws a still card: `figure` "Preview" (caption, and its
    optional `note` beside it), over a white rounded bordered card ("Example card", `text-[13px] font-medium`)
    holding the `ItemDetailsRow` (its `required` mark when Required) with `SampleValue` (`multiple`, `blocks` passed
    through).
  - `AddFieldTryIt.tsx` (props `field: NewField`, `linkLabel?`, `required`): for `card`, `calculated`, `image`,
    `comments`, `votes` and an `isTimeSpent` Duration it renders `CustomFieldPreview` with `note={STILL_NOTE}`
    ("Shows on a real card"). Every other kind renders `figure` `aria-label="Try It"` (caption "Try It", and
    "Nothing here is saved") holding `Sandbox`, keyed on `shapeKey(field)` (the field as JSON less `label`,
    `required`, `notifies`) so a change of kind or shaping setting remounts it empty. `Sandbox` builds a pretend
    `ItemTypeDef` (`id` 'try-it', one custom field: the field with id 'try-it-field' and its trimmed label or
    "Field name") and `Item` (fields from `useState`), and renders the panel's own `ItemFieldEditor` in an
    `ItemDetailsRow` (`htmlFor` per `labelsItsControl`). Its `ItemFieldContext`: `people` and, for Labels only,
    `labelUsage(plan.items)` (memoised on the items) read from `usePlan()`; `canEdit` true; `onSave` / `onPatch`
    write the local fields only (resolving true); `onOpenItem` does nothing. No plan write, store or fetch is
    reached. Its wrapper `onKeyDown` calls `preventDefault` on Enter from an `<input>` (no implicit submit of the
    Shape form); `onBlurCapture` on the field's own input, for `phone` / `email` / `link`, checks the trimmed text
    (`isPhoneNumber` + `PHONE_HINT`, `isEmailAddress`, `isLinkText` exported from `CustomFieldEditor`) before the
    box's own blur puts it back, and shows `role="alert"` "{Name}: {hint}." until a later blur passes. Escape needs
    nothing of its own: the real lists (`AnchoredPopover` through the popover stack, `PersonPicker`) take it on
    `window` in the capture phase and stop it, so AddFieldDialog's page-wide listener never steps back.
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

- **Edit Field** (spec "Fields and Tabs": Edit Field). `ItemTypeFieldRow`'s pencil (`Tooltip` "Edit Field",
  `aria-label` "Edit {Name}", `aria-haspopup="dialog"`) calls `onEdit(opener)`; `ItemTypeLayoutEditor` keeps
  `editing: { id, opener }` (only a custom field neither inherited nor newer has a pencil; the inline
  `CustomFieldForm` is no longer rendered in a row, the component stays for its own tests and settings) and renders
  `EditFieldDialog` (`EditFieldDialog.tsx`), which is `AddFieldDialog` with `edit: { field, plan, onSave }` passed
  down to `NewFieldForm`: the form starts on Shape with the draft's field (`useState(edit.field)`), titles itself
  "Edit Field", passes `missing=[]` and `canAddCustom` true, and gives `AddFieldPicker` `refusalOf` (dimmed tile,
  `GalleryTile` tooltip and name) and `current` (the field's own tile, tagged Current). `picked(kind)` gives the
  field back as drafted for its own tile, else `freshField` with `plan.optionsFor(kind)` for a Choice or Multiple
  Choice. `AddFieldShape` takes `edit: { loss }`: the `role="status"` line over the footer, Save (`CheckIcon`), and
  a first Save on a loss that cuts down or clears values sets `confirming` to its message (Keep Editing, Change
  Values); a changed message asks again. Save calls `onSave(addedField(field))` with the field's id put back, which
  replaces the def in `draft.custom`; focus returns to the pencil.
  - `edit-field-values.ts` `useEditFieldPlan({ typeId, stored, types, items, people })`, memoised on those: `stored`
    is the field as the catalogue holds it (undefined for a field new in the draft: no refusals, no loss);
    `refusalOf` is `kindChangeRefusal(stored, shapeOf(pick))`; `optionsFor` is `optionsFromValues` over
    `fieldValues` (once per plan); `lossOf(field)` is `fieldKindChange` counted once per `shapeKey` (kind and the
    shaping settings) in a Map, `lossMessage` wording it.
  - `packages/items/src/field-kind-change.ts`, pure: `kindChangeRefusal`, `changedValue(from, to, value, ctx)` →
    `kept | rewritten { value, trimmed } | cleared` (same kind: several to one keeps the first; Date Range with or
    without times; the date kinds among themselves by `dateChange`; else by target: text written by `textOf`, Choice
    and Multiple Choice by option name, Labels and Person by name, the rest by `customValueOfText`, the CSV
    import's own reading, exported from `board-csv.ts`), `optionsFromValues`, `fieldCardsOf(typeId, field, types)`
    (the type and its heirs holding the field), `fieldKindChange(from, to, items, on, ctx)` (one pass: `held`,
    `trimmed`, `cleared`, `patches`, a value rewritten to itself kept, a string value worked out once a pass, a
    Long Text's `<id>Rich` cleared) and `retypedValuePatches(before, after, types, items, ctx)` (every changed field,
    one patch per card).
  - Saving: `PlanSheetsHost`'s `onSave` works out `retypedValuePatches(editing, next, …)`; with any, it calls
    `ctx.reshapeValues(patches)` (`usePlanItemWrites`: one `patches` write marked `undo: true`, past the Required rule,
    `usePlanItems.write(input, { onUndo })` handing its undo step back instead of pushing it) and passes that promise
    to `itemTypes.saveType(next, along)`, whose `change` pushes `combinedStep([typeStep, itemsStep])`
    (`item-undo-journal.ts`) once the write settles (the type's step alone when it made none).

  - **Gap: filters on a retyped field** (spec "Filters on the field"). `packages/items/src/field-filter-removal.ts`,
    pure: `FieldRetypeTarget = { field, builtIn, typesAfter }`; `clauseNamesField(clause, field)` (a
    `CardSearchFilter` with `by: 'field'` and that field, or for a built-in `by: 'assignee'` / `'priority'`);
    `boardWithoutFieldFilters(setup, target)` → `{ setup, removed }` takes the clauses off every
    `savedFilters[].filters` (and a saved filter's `person` for Assignee, `priority` for Priority, `due` for Due
    Date), dropping a saved filter left with nothing to narrow by; `viewWithoutFieldFilters(settings, target)`
    the same for `PlanViewRef.filters` (absent when none is left). A built-in's clause comes off only where the
    place's types after the change (`boardAddTypes(setup, typesAfter)`, or the view's `types`, every type when
    absent) hold the built-in on none. The setup or settings object is returned as is when nothing comes off.
    `apps/editor/components/plan/field-retype-tabs.ts` walks `Tab[]` (boards `shape: 'plan-board'`, views
    `shape: 'plan-view'`): `countFieldFilters(tabs, target)` and `tabsWithoutFieldFilters(tabs, target)` (a tab
    and an element replaced only when one changed; the array returned as is when none did).
  - **Gap: all or none** (spec "Saving the type"). `usePlanItemWrites.reshapeValues(patches)` resolves
    `{ ok, step }` (`ValuesWrite`, `item-undo-journal.ts`): `ok` is the write's own answer, `step` the undo of
    whatever landed (`usePlanItems.write`'s `onUndo`, called for a partial write too). `useItemTypes.saveType(type,
along?)` takes `along: SaveAlong = { values?: Promise<ValuesWrite>, settle?: () => boolean, name }`;
    `make(change)` now resolves `true` once the change is stored (`send` resolves `false` when it gives up). With
    `along`, `change` waits for both (`settleRetype`, `retype-settle.ts`, pure): both landed: `settle()` runs
    (commits the filter removal to the tabs, one canvas step, answering whether it changed any) and one undo step
    is pushed, `combinedStep([typeStep, valuesStep])` with `canvas: true` when `settle` committed; the values
    failed: `step.undo()` puts back what landed and, when the type did land, `make(inverseCatalogueChange(made))`
    puts it back; the type failed: `step.undo()`; either failure pushes no step and calls `onError("Couldn’t
change {name}'s type, so nothing was changed.")` (the type's own "Couldn’t save the card types" toast is not
    shown for a change made with `along`).
  - **One undo step over a canvas step**: `ItemUndoStep.canvas?: true` marks an item step pushed right after a
    canvas commit it belongs with. `useItemUndo.undo` runs `step.undo()` then `history.undo()`; the journal's redo
    entry keeps the future length from before the canvas undo, and `journalRedoTarget` matches a canvas step at
    `futureLength + 1`; `redo` runs `history.redo()` then `step.redo()`, and `journalAfterRedo` files it at
    `depth + 1`. Pure in `item-undo-journal.ts`.

- **Built-in Full edit** (spec "Edit Field": Built-in fields).
  - `packages/items/src/built-in-field-labels.ts`, pure: `BUILT_IN_FIELD_NAMES` (the type editor's names, moved
    from the editor; `BUILT_IN_FIELD_LABELS` in `ItemTypeFieldForms.tsx` re-exports it), `RENAMABLE_BUILT_INS` (every
    built-in but Title, Archived, Flagged and Example), `fieldLabelsWith(labels, id, name)` (trimmed; blank or the
    built-in's own name in any case drops the key; absent when none is left), `readFieldLabels(input, fields)` (an
    object of renamable ids to 1 to `CUSTOM_FIELD_LABEL_MAX` characters; a key the type lacks or the built-in's own
    name dropped; `null` for anything else, refused as `types[i].fieldLabels`),
    `typeFieldLabel(type, id, fallback = BUILT_IN_FIELD_NAMES[id])` (O(1)), `builtInFieldLabel(id, types,
fallback)` (the name every type in scope holding the field agrees on, else `fallback`; memoised per `types`
    array in a `WeakMap<readonly ItemTypeDef[], Map<id, string | null>>`, O(types) once) and `builtInIdOfName(name,
types)` (the built-in a lower-cased name names on any type, for the CSV import).
  - `ItemTypeDef.fieldLabels?: Partial<Record<ItemFieldId, string>>`; `readType` reads it with `readFieldLabels`;
    `INHERITED_PARTS` gains `'fieldLabels'`. Regenerate the api's `schemas.generated.ts` (`gen:openapi`).
  - Readers: one type: `ItemFieldEditor` (the panel's names: its short names as the fallback), `ItemTypeLayoutEditor`
    (`labelOf`), `PlanCardFace` chip names, `formulaScopeOf` (name, with the built-in's names kept as aliases).
    Several: `boardSortFieldsOf` / `boardSortFieldOf`, `laneFieldsOf` (`everyLaneField`), `searchFields` (Assignee,
    Priority groupings), `breakdownTitle`, `viewFieldsOf` / `viewFieldLabel`, `boardCsvRows` headers (`Start`, `Due`
    the fallbacks), `boardCsvImport` (`builtInIdOfName` over the board's types after `builtInFieldOf`),
    `plan-view-settings.ts` and `BoardSelectionBar` names.
  - `packages/items/src/built-in-field-retype.ts`, pure: `BUILT_IN_KIND_SHAPES` (id → `KindShape`: description
    `longtext`, estimate `number`, start and due `date`, priority `choice` with options `PRIORITY_LABELS` in order,
    labels `labels`, assignee `person`, color `colour`, checklist `checklist`, comments `comments`, votes `votes`,
    attachments `image`, status `choice`), `STATUS_KEEPS_TYPE` (the spec's line), `builtInRetypeRefusal(id, to)`
    (Status always, Title always, Attachments for every other tile, each with its own line; else
    `kindChangeRefusal(shape, to)`), `builtInValueOf(id, raw)` (a Priority's label, the rest
    as stored), `builtInCardsOf(typeId, id, types)` (the type and heirs taking the field from it),
    `retypeBuiltInIn(type, id, def)` (the def's id in the built-in's place in `fields`, `ownFields`, every tab and
    every card size's display; `fieldLabels[id]` dropped; `assigneeNotifies` dropped for Assignee; Colour's
    `colourField` set to the new id) and `builtInRetypePatches(id, to, newId, items, on, ctx)` =
    `fieldKindChange(shape, to, items, on, ctx, { into: newId, read })`.
  - `fieldKindChange` gains `move?: { into, read? }`: a kept or rewritten value is set under `into` and the old key
    cleared; a cleared value clears the old key; `fieldValues(items, on, read?)` reads the same way.
  - `packages/items/src/field-retype-impact.ts`, pure: `fieldRetypeImpact({ field, builtIn, typeId, name, boards,
views, forms, types })` → `string[]`, one pass over the given boards, views, forms and the catalogue's custom
    fields: sorts (`sortBy`), lanes (`swimlaneBy` `field` + `swimlaneField`, or `assignee` / `priority`), widgets
    (`field:*:{id}`, and the kinds reading a built-in: `BUILT_IN_WIDGET_READS`), views (`startField`, `dueField`,
    `measure`, `swimlaneField`, or the built-ins a view reads: `VIEW_READS`), forms (a question `{ to: 'field',
fieldId }` on a form whose destination is the type), formulas (`{id}` in a Formula's stored text), rollups and
    lookups (`source`), and one CSV row when any board shows the type. Only places covering the type count.
    `IMPACT_ROWS_SHOWN` 6, then "and N more".
  - `fieldRetypeTargets(before, after, retyped, typesAfter)` (`field-filter-removal.ts`): the targets a save takes
    filters off, a custom field whose `kind` changed and each built-in in `retyped`. `typeSavePatches(before, after,
retyped, types, items, ctx)` (`built-in-field-retype.ts`): `retypedValuePatches` and each built-in's
    `builtInRetypePatches`, merged to one patch per card.
  - Editor: `ItemTypeLayoutEditor` gives a built-in row (in `RENAMABLE_BUILT_INS`, on a type that inherits nothing,
    so an heir reads its base's names) the pencil; `editing` holds its id. `BuiltInEditDialog.tsx` is
    `AddFieldDialog` with `edit: { field, plan, onSave, builtIn: { placeholder, role, notifies } }`: `field` is
    `builtInStartField(id, name, notifies)`, `plan` is `useBuiltInEditPlan` (`built-in-edit-plan.ts`: refusals from
    `builtInRetypeRefusal`, the custom field cap's note on the other tiles at the cap, Priority's options, the values
    counted by `builtInRetypePatches` once per shape, and the filter count and `fieldRetypeImpact` from one scan of
    `planTabs()` on the first other tile picked; another tile always asks). `NewFieldForm` passes `builtIn` to
    `AddFieldShape` only on the built-in's own tile, where `BuiltInShape` (Name with the built-in's name as
    placeholder, its role line or Status's "Its states are set in States.", Notifies for the Assignee through
    `FieldSwitches`) stands in for `ShapeOwn`, and Save needs only a name. `ValueLoss` gains `reads` (the impact
    rows, or "Nothing else in the plan reads it.") and `asks`; the confirm is keyed on the message and the rows.
  - The draft (`LayoutDraft`, `item-type-layout.ts`) gains `fieldLabels` (`renameBuiltIn`) and `retyped`
    (`retypeInDraft`: built-in id to the custom field it becomes, `draftCustomOf` and `draftCustomFields` reading
    it as the type's own; the row then edits as a new custom field). `addField` and `removeField` keep the rest of
    the draft (they used to drop `assigneeNotifies`). `ItemTypeEditor`'s draft folds each still-held entry through
    `retypeBuiltInIn`, and Save calls `onSave(type, { [newId]: builtInId })`. `PlanSheetsHost` hands it to
    `typeSaveAlong` (`type-save-along.ts`): `typeSavePatches` for `ctx.reshapeValues`, `fieldRetypeTargets` for
    `ctx.removeFieldFilters`, the toast's name, and `undefined` when nothing changes type or value.
  - `edit-field-values.ts` gains the filter count for a custom field (`countFieldFilters` over `planTabs()`, once,
    only for a new kind) and `valueLoss`/`filtersMessage` ("N filters on it will be removed."). The Plan context
    gains `planTabs()` (the editor's `tabsRef`, read when called, so no render reads them) and
    `removeFieldFilters(targets)` (`tabsWithoutFieldFilters` through `commitTabs`, only when one comes off).

## Tabs

- `ItemTypeDef.tabs?: ItemTypeTab[]` (`{ id: /^t-[a-z0-9-]{1,30}$/, label ≤ ITEM_TYPE_TAB_LABEL_MAX (24), fields }`),
  at most `ITEM_TYPE_TABS_MAX` (6). `readTabs` rejects a bad id, an empty or repeated label (ignoring case), or
  non-array fields; it drops fields the type does not offer, `title`, `votes`, and any field an earlier tab holds.
- `tabsOf(type)`: the tabs with unoffered fields filtered; absent, one `OVERVIEW_TAB_ID` tab "Overview" of
  description, checklist and long-text custom fields, then every Comments field (the built-in and custom
  `comments` ones) in the type's order. `detailFieldsOf(type)`: the type's fields in no tab, minus
  title and votes. `newTabId(label, taken)`.
- Editor: one `LayoutDraft` (`{ fields, custom, tabs }`, `item-type-layout.ts`) edited by `ItemTypeLayoutEditor`,
  grouped by `cardFields` (title, votes), `detailFields` (Details) and each tab. Pure edits: `moveField` (within a
  group, past movable neighbours only), `fileField` (Move To), `addField` (into the group it was added in; votes
  never into a tab), `removeField` (out of fields, custom and every tab), `moveTab`, `addTab` (unnamed, id
  `newTabId('tab', ...)`), `withoutEmptyTabs`. The type editor starts from `tabsOf(type)` and saves `tabs`
  explicitly. Problems: "Give every tab a name.", "Two tabs have the same name."

## The Hidden tab

- `ItemPanelTabs.tsx`: `HIDDEN_TAB = 'card-hidden'`, label "Hidden"; `panelTabs(tabs, details, linked, hidden)` puts it
  after Activity (before the phone's Details) when `hidden > 0`, its `count` the values and `unit: 'value'`, so its
  accessible name reads "Hidden, 2 values".
- `ItemPanel.tsx` works the groups out once per item and catalogue (`useMemo` on `item.fields`, `type`, `types`), so
  typing in another field of the card (a new `fields` object) is the only redo, one pass over the card's keys.
  Picking the tab tracks `Plan · Opened · HiddenValues`. Its panel is `HiddenValuesTab.tsx`.
- `HiddenValuesTab.tsx` (tested in `ItemPanel.hidden.test.tsx`): the line, then a `section` per group (`aria-labelledby` its heading "From {Type}" with
  `PlanTypeGlyph`, or "Removed Fields"), each value a row: its label (the source type's `fieldLabel`, or "Removed
  Field"), its control (`ItemFieldEditor` with `ctx.type` the source type and `canEdit: false`; a removed field's
  `hiddenValueText`), and for an Editor (`canRetire`) **Copy To Field** (the shared `PortalMenu`: one `menuitem` a target, "(replaces its value)" after one that holds a value; disabled with
  the tooltip "No field on {Type} can take this value." when none can) and **Remove** (an icon button "Remove {Field}"). Each is one
  `onPatch`, so one undo step through the panel's writes; `Plan · Copied · HiddenValue`, `Plan · Removed ·
HiddenValue`.
- When the groups empty, `panelTabs` drops the tab and `current` falls back to the first tab (the panel's own rule).

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
  offline store runs the same checks. The editor's `usePlanItemWrites.addItem` goes through `useRequiredFieldsGate`:
  a create missing a required field opens `RequiredFieldsDialog` (PlanSheetsHost draws it first) and is written,
  filled, only on Create; Cancel answers false. `refusalMessage('field_required')` reads "That field is required on
  this card type". `boardCsvImport` counts a row missing one in `missingRequired` (also in `skipped`).
  `publishProblems` adds `{ kind: 'required_unasked', fieldId, field, type }` per required field no required
  question in an always-shown section maps to; `publishProblemText(p)` words every problem. Agents:
  `listedType.custom[].required`, `CustomFieldInput.required` / `CustomFieldEdit.required` in `applyCardTypeChanges`
  (a Checkbox refused), and `applyItemChanges` stops an `add` (`missingRequiredFields`) or a `set`
  (`requiredCleared`) with `field_required` and `requiredFieldsMessage` before any write.
- Notifies: the api's `cardsPushOf` (`plan-room/plan-cards-push.ts`) reads each card's type from the catalogue (the
  fallback type, Assignee only, when it has none) and, while the card is listed (open, not linked, not done), sends
  `assignees: notifiedPeople(type, item)` as `InboxCardAssignee { hash, name, actionId }`: `actionId` the card's id for
  `assignee`, `{card id}~{field id}` for another field. `@liveworkspace/index-app` `cardsCollabPush` pushes one action
  per assignee it can name (each unnamed one counts in `unmatched`), a person once per card. Agents:
  `CustomFieldInput.notifies` / `CustomFieldEdit.notifies` (a field that is no Person field refused: "only a person
  field notifies") and `assigneeNotifies` on `add` and `set` (`true` drops the stored false) in
  `applyCardTypeChanges`; `listedType` lists `custom[].notifies` and `assigneeNotifies: false`. The editor:
  `NotifiesSwitch` (`ItemTypeFieldForms.tsx`, a `FieldSettingRow` "Notifies" described by `NOTIFIES_LINE`) in a
  Person field's `CustomFieldForm` and Add Field's `ShapeOwn` (both through `FieldSwitches`: `ShowAsPercentSwitch`,
  `RequiredSwitch` with `REQUIRED_LINE`, `NotifiesSwitch` in a `flex-col gap-2` stack, `data-field-switches`, nothing
  when none applies; each a `FieldSettingRow`, the `@liveworkspace/settings-ui` `SettingsToggleRowView` keyed
  `field-setting-{useId}`, its `Switch` `coversRow` so the whole bordered cell is the press target; tested in
  `FieldSwitches.test.tsx`) (`addedField` keeps `notifies` only on a Person field); the
  Assignee's `FieldMenu` (`ItemTypeFieldMenu.tsx`) opens with `MenuNotifiesRow`, a `menuitemcheckbox` drawing the
  house `Switch`, that sets `LayoutDraft.assigneeNotifies` (kept only as `false`; `ItemTypeEditor` reads and saves
  it). Each flip tracks `Plan` · `Changed` · `FieldNotifies`.

## Inherited types

Derived from [Item types](../item-types.md#inherited-types).

- **Shape** (`item-types.ts`): `ItemTypeDef.inherits?: string` (the base type's id, `ITEM_TYPE_PATTERN`) and
  `ItemTypeDef.ownFields?: readonly string[]` (field ids, built-in or custom, in order). Every other part is stored
  resolved. Read by `readType` (an `inherits` that is not a type id: `types[i].inherits`; an `ownFields` that is not
  an array of strings: `types[i].ownFields`; at most `ITEM_TYPE_FIELDS_MAX`).
- **`type-inheritance.ts`** (pure):
  - `INHERITED_PARTS`: `tabs`, `detailsLabel`, `statuses`, `excludedStatuses`, `defaultStatus`,
    `assigneeNotifies`, `colourField`: copied whole from the base (absent when the base lacks one). `display` is
    inherited as the base shows it (`inheritedDisplay`): each size the base leaves to its default written out from
    `defaultCardLayout(base.id)`, and a size equal to the inherited type's own default left out, as `readCardDisplay`
    stores it.
  - `resolveChild(child, base)`: `own` = `child.ownFields` when stored, else the child's fields the base lacks; then
    the ids the base has dropped (its copy wins), and ids that are neither built-in nor one of the child's own
    custom fields dropped. `fields` = the base's then `own` (deduplicated), plus any `requiredFieldsOf(child.id)`
    still missing (appended to `own`); `custom` = the base's (whole, every setting, `blocks` included) then the
    child's custom fields in `own`; `ownFields` always written beside `inherits` (empty too), so a stored type's own
    fields are exact; absent means not yet worked out (a type just given its base).
  - `withInheritance(types)`: each type with `inherits` resolved against its base, in place; a type whose base the
    list lacks is detached (`detachType`). Returns the same array when nothing changed. Memoised on the input array
    (a `WeakMap`), so a list resolved once is never resolved again.
  - `inheritanceProblem(types)`: the first chain (`types[i].inherits`: the base itself inherits, the type is a base
    of another, or it names itself), or null.
  - `baseOf(type, types)`, `inheritingTypesOf(id, types)`, `basesFor(typeId, types)` (every type inheriting from
    none but the type itself; none while the type is a base), `inheritedFieldIds(type, types)` (a Set: the base's fields and custom
    ids; empty for a type with no base), `inheritFrom(type, base)` (sets `inherits`, own = the type's fields the
    base lacks, resolved), `detachType(type)` (drops `inherits` and `ownFields`, keeps the rest).
- **Validation** (`validateItemTypeCatalogue`): every type read, then `inheritanceProblem` (refused by its reason),
  then `withInheritance`, then each resolved inherited type's caps (`fields` over `ITEM_TYPE_FIELDS_MAX`:
  `types[i].fields`; `customFieldCount(custom)` over `ITEM_TYPE_CUSTOM_MAX`: `types[i].custom`), then the 32 KB
  size on the resolved catalogue. So the api's PUT, the editor's read-back and every agent change store resolved
  types.
- **Rebase** (`rebaseCatalogueChange`): the merged list passed through `withInheritance`, so a change to a base made
  over someone's change to its child reaches the child.
- **Editor** (`useItemTypes`): `withTypes` passes each edit's types through `withInheritance`, so a base saved,
  or deleted, reaches its children in the shown catalogue at once (one undo step with the base's change).
- **Type editor** (`ItemTypeEditor`): `inherits` draft state; `ItemTypeInheritance.tsx` renders the **Inherits From**
  row (the house `Select`: None and each of `basesFor`) beside Name (a wrapping flex row in `ItemTypeConfiguration`),
  drawn only while there is a base chosen or a base to pick (`showsInheritsFrom`); the note under the row
  (`InheritsFromNote`: "{names} inherit from this type." for a base, which has no menu) and **Detach** (`lucideScissors` through `lucideGlyph`, tooltip "Stop following {Base} and keep a copy of its
  settings", its accessible name "Detach: " and the tooltip). Choosing a base
  re-seeds layout, statuses, Default State, display, Details name and Card Colour from `inheritFrom(draft, base)`;
  Moving from one base to another first drops the old base's fields. Detach and None drop `inherits` only. `check`
  validates the whole catalogue with the draft in place (about 0.5 ms), so the saved type comes back resolved and a
  base change that takes a type inheriting from it past a cap is named beside Save ("{Type} inherits from this type and
  can’t hold any more fields.").
  Save tracks `Plan` · `Linked` · `CardTypeBase` when `inherits` was set and was not before, `Plan` · `Unlinked` ·
  `CardTypeBase` when it was and is not.
  - `ItemTypeLayoutEditor` takes `inherited?: { from: string; ids: ReadonlySet<string> }`: an inherited row is not
    removable, has no Edit, no handle and no moves, its lock reads "Inherited from {Base}" (`FieldRow.lockLabel`);
    tab names, the Details name, tab moves and removal and Add Tab are disabled; Add Field shows under Details only.
  - States and Display: `InheritedPartNotice` ("{Type} takes its states from {Base}. Change them on {Base}, or Detach
    to give {Type} its own.") over `ItemTypeStatuses` or `ItemTypeDisplay` drawn inside an `inert` group named "{Base}’s states" or
    "{Base}’s display"; the Card Colour picker is left out.
- **Card Types panel**: a row whose type has `inherits` adds "Inherits {Base}" to its caption; `deleteMessage(label,
cards, children)` adds "{names} will keep a copy of its settings."
- **Agents** (`type-changes.ts`, helpers in `type-change-inherit.ts`: `withBase`, `refuseInheritedEdits`,
  `withOwnFields`): `add` and `set` take `inherits?: string | null`, resolved by `resolveType`; a base
  that inherits, or a type with children given a base, refused with `type_change_invalid`. On an inherited type,
  `removeFields`/`removeCustom`/`editCustom` naming an inherited id, and any of `statuses`, `defaultStatus`, `display`,
  `tabs`, `detailsLabel`, `assigneeNotifies`, refused naming the base. Fields added to an inherited type join
  `ownFields`. `types` goes through `withInheritance` after each change, so later changes in the call see children
  resolved. `listedType` adds `inherits` (base name) and `ownFields` (names) for an inherited type; the MCP output
  schema and `change_card_types`' description name them.
- **Performance**: `withInheritance` is O(types × fields) with Set lookups: at the caps (32 types, 24 fields, 12
  custom) one pass, run only where a catalogue is validated, rebased or edited; readers (`typeIn`, cards, panels)
  read the stored, resolved types and never resolve. Measured in `type-inheritance.perf.test.ts` (CPU time): 20
  resolutions of a full catalogue (32 types, 28 inheriting, 20 fields each) about 10 ms, 10,000 memo hits about 1 ms,
  and 50 validations of a 16-type catalogue about 24 ms with inheritance against 10 ms without.

## Errors and edge cases

| Case                                   | Handling                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Stored catalogue unreadable            | Built-ins (`readItemTypeCatalogue` null)                                                         |
| Item of a type the catalogue lacks     | Drawn as `FALLBACK_ITEM_TYPE` "Item"; card tile makes a Task                                     |
| Custom value of the wrong kind         | Shown empty; replaced by the next edit                                                           |
| Field of a kind this build lacks       | Kept as stored, read-only (`isNewerField`); the api refuses it on a write                        |
| Field taken off a type                 | Values kept in `fields`; shown again if it returns                                               |
| Deleting the last type                 | Not offered (`canDelete`); `deleteType` refuses                                                  |
| Save fails                             | That change dropped (later ones kept), toast                                                     |
| Another change landed first (409)      | Change made again to the stored catalogue, sent again (3×)                                       |
| 409 naming a lower revision (synced)   | Taken as stored anyway (`keepStored(next, true)`): the server's count restarted after Sync Plan  |
| Hidden value of a deleted field/type   | Listed under Removed Fields as plain text; Remove only                                           |
| Hidden value no field can take         | Copy To Field's menu says so; nothing written                                                    |
| Blocks turned on over links that loop  | Cards never rewritten; both show blocked; a write adding to the loop is refused, removing is not |
| A blocker trashed, archived or missing | Ignored by the badge, the Blocked By list and the arrows; kept on the card                       |
| Two writes race to close a loop        | Each passes its own read; the loop shows (both blocked) until a link is removed                  |

## Security and trust

- Only whole-project editors write the catalogue; it holds names and colours, no content, so tab-scoped
  sessions hear it. The api validates every write; the editor validates before saving (same function).

## Performance and limits

- 32 types × 24 fields × 12 custom fields fits `ITEM_TYPES_BYTES` (32 KB); the op carries the catalogue whole.
- Blocked By: `blockingIndexOf` is one pass over the cards and their links (at most `ITEMS_MAX` cards × 20 links a
  field), made once per items change (`planBlocking`, the SVG render once per board); a card face reads a Map. The loop
  check walks each new edge's upstream once (cards plus links), so a write of k new links costs k walks; it runs only
  when a Blocks field's value changed; the picker's `waitingOn` is one inversion and one walk per open list. Measured
  in `blocked-by.perf.test.ts`.

- Edit Field's count: one pass over the plan's cards per type picked, memoised per shape until the cards change,
  each string value worked out once a pass. Measured on 2,000 cards (`ITEMS_MAX`): Text to Number 0.5 ms, Several
  People to Person 1.1 ms, to Text 1.5 ms, Date to Date and Time 1.4 ms over 100 distinct days and 24 ms when every
  card holds a different day (time-zone math per day). The options a Choice starts with: one pass, under 0.1 ms.
  The save's writes go in `ITEM_BULK_MAX` chunks (`postInChunks`), so a 2,000-card change is ten requests.
- Built-in names: `typeFieldLabel` is a property read; `builtInFieldLabel` walks the types in scope once per
  `types` array and field (at most 32 types), memoised in a `WeakMap`, so menus, search fields and CSV headers pay
  it once per catalogue change and a card face never does. Budget test: 10,000 lookups over 32 types inside a CPU
  budget (`built-in-field-labels.test.ts`).
- The retype scan (`fieldRetypeImpact`, `countFieldFilters`) walks the tabs' elements once per dialog, on the first
  other tile picked, no card read; the values pass is `fieldKindChange`'s, once per shape. Measured on a 2,000-card,
  10-tab plan (40 boards, 40 views): the scan about 0.75 ms, the values pass about 1.6 ms, held under CPU budgets of
  50 ms and 100 ms (`field-retype.perf.test.ts`). The save adds one more scan (`removeFieldFilters`) and one more
  values pass (`typeSavePatches`), once.
- Add Field's gallery: 33 tiles (25 kinds and 8 variants), each a static sample (no data read), drawn on opening; the search's matching is
  memoised on the search key (`shownCategories`, 33 tiles × a few dozen short strings, well under a millisecond);
  measured in the browser at about 22 ms from the press to the second frame with every tile drawn. Each tile's
  `FitWidth` holds one `ResizeObserver` (33 while open, disconnected on close). The rail's scroll spy measures the
  seven section headings on each scroll event (the browser sends one a frame at most) and re-renders only when the
  category in view changes.

## Accessibility and UX

- Panel rows are focusable list items named "<Name>, N items"; Enter or Space opens the editor. Swatches and
  glyphs are radio groups with names ("Cyan", "Chat glyph"). The editor's problems are named in text beside
  Save. Copy: "Card Types", "+ Add Type", "Add Default Types", its confirm "Add {list} to this project’s card types? They go after the ones you have, and nothing you have changes." with "Add Types", "New Card Type", "Edit Card Type",
  "+ Add Field", "Search fields", "Search fields, like money or date", "Ready to use", "Or make your own", "Add Field",
  "Pick what the new field holds.", "Close", the nine category names and lines, the thirty-three tile names
  (the variants: "Several People", "Time Tracking", "Date and Time Range", "Several Cards", "Blocked By",
  "Formula", "Rollup", "Lookup") and descriptions, the Ready to use lines, "No fields match “…”", "No {Category} fields match “…”", "Try a word like
  money, date or parent.", "N fields match", "Remove a custom field to add another",
  "This type holds the most custom fields it can (12). Remove one to add another.", "All kinds", "Kind: {Kind}",
  "Name", "Field name", "Options", "Add an option", "or paste a list", "Option {n}", "Remove option {n}", "Scale",
  "Currency", "Calculation", "Required", "Try It", "Nothing here is saved", "Preview", "Shows on a real card",
  "Example card", "Write an email address like sam@example.com", "Write a link that starts https://", "Add {Name}", "Add {Kind} Field", "Name the
  field to add it.", "Add at least one option.", "Pick a card type it links to.", "Show on card", "Delete",
  "Keep as Item".

## Observability

- `[item-types] item-types.saved` / `item-types.rejected` / `item-types.stale` (api); `[item-types] saved` /
  `save stale` / `save failed` (editor debug log).

## Testing

| Rule                                                                                                             | Test                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue checks, ids, read-back, glyphs                                                                         | `packages/items/src/type-catalogue.test.ts`                                                                                                                                                                                                                                                                                                        |
| Newer fields: kept untouched through read and save, read-only in the panel and type editor, api refuses on write | `packages/items/src/newer-fields.test.ts`, `apps/editor/components/plan/NewerFieldValue.test.tsx`, `apps/editor/components/plan/ItemTypeLayoutEditor.newer.test.tsx`, `apps/api/src/routes/item-routes.test.ts`, `apps/api/src/routes/project-create-seeded.test.ts`                                                                               |
| Glyph categories, keywords, old ids kept, search                                                                 | `packages/items/src/glyphs.test.ts`                                                                                                                                                                                                                                                                                                                |
| Inherited types: resolve, base change flows, detach, base deleted, older-editor save, caps, chains, perf         | `packages/items/src/type-inheritance.test.ts`, `packages/items/src/type-inheritance.perf.test.ts`                                                                                                                                                                                                                                                  |
| Inherited types by agents: inherits, detach, refusals on inherited parts, listing                                | `packages/items/src/type-changes-inherit.test.ts`, `packages/agent-verbs/src/plan/plan-listing.test.ts`                                                                                                                                                                                                                                            |
| Inherited types through the api: stored resolved, base change, detach on delete, whole-plan Editor only          | `apps/api/src/routes/item-types-inherited.test.ts`                                                                                                                                                                                                                                                                                                 |
| Type editor: Inherits From beside Name, hidden with nothing to pick, locked inherited fields, Detach, notices    | `apps/editor/components/plan/ItemTypeEditor.inherit.test.tsx`                                                                                                                                                                                                                                                                                      |
| Card fields of several types: read, stored, linked, lanes                                                        | `packages/items/src/card-links.test.ts`, `packages/items/src/type-catalogue.test.ts`, `packages/items/src/type-changes.test.ts`                                                                                                                                                                                                                    |
| Links To multi-select                                                                                            | `apps/editor/components/plan/LinksToPicker.test.tsx`                                                                                                                                                                                                                                                                                               |
| Glyph picker filters, empty state, picks                                                                         | `apps/editor/components/plan/GlyphPicker.test.tsx`                                                                                                                                                                                                                                                                                                 |
| Route: store, relay, null, refusals, gates, copy, create                                                         | `apps/api/src/routes/item-routes.test.ts`                                                                                                                                                                                                                                                                                                          |
| Route: a stale revision refused with what is stored                                                              | `apps/api/src/routes/item-routes.test.ts`                                                                                                                                                                                                                                                                                                          |
| A change rebased onto another editor's catalogue                                                                 | `packages/items/src/type-catalogue-change.test.ts`                                                                                                                                                                                                                                                                                                 |
| Editor: stale resend, failure drops one, undo keeps later                                                        | `apps/editor/hooks/plan/useItemTypes.test.ts`                                                                                                                                                                                                                                                                                                      |
| Agents: a stale save read again and applied again                                                                | `packages/agent-verbs/src/plan/plan-engine.test.ts`                                                                                                                                                                                                                                                                                                |
| Scoped sessions hear the op                                                                                      | `apps/api/src/room-scope.test.ts`                                                                                                                                                                                                                                                                                                                  |
| Card tiles follow the catalogue                                                                                  | `apps/editor/components/palette/palette-plan-tiles.test.ts`                                                                                                                                                                                                                                                                                        |
| Custom values on a card                                                                                          | `apps/editor/components/plan/custom-field-text.test.ts`                                                                                                                                                                                                                                                                                            |
| Calculated fields: children, done, values, refusals                                                              | `packages/items/src/calculated-fields.test.ts`, `apps/api/src/routes/item-routes.test.ts`, `packages/agent-verbs/src/verbs/item.test.ts`                                                                                                                                                                                                           |
| Rollup and Lookup: every aggregate, archived, trashed, missing links, limits, surfaces, 2,000 cards              | `packages/items/src/rollup-fields.test.ts`, `packages/agent-verbs/src/verbs/item.test.ts`, `packages/project/src/svg-render-plan-card.test.ts`, `apps/editor/components/plan/RollupEditor.test.tsx`                                                                                                                                                |
| Formula fields: language, limits, fuzz, values, results, sort, CSV, sheets, agents, 2,000 cards                  | `packages/items/src/formula/formula.test.ts`, `packages/items/src/formula-fields.test.ts`, `packages/agent-verbs/src/verbs/item.test.ts`, `packages/project/src/svg-render-plan-card.test.ts`, `apps/editor/components/plan/FormulaEditor.test.tsx`, `apps/editor/components/plan/CalculatedFieldValue.test.tsx`                                   |
| Date and Time: read, parse, store, zones, DST, text, zone line, CSV, agents                                      | `packages/items/src/date-time-fields.test.ts`, `packages/items/src/board-csv.test.ts`, `packages/agent-verbs/src/verbs/item.test.ts`                                                                                                                                                                                                               |
| Date Range: read, parse, order, ends, text, CSV, agents                                                          | `packages/items/src/date-range-fields.test.ts`, `packages/items/src/board-csv.test.ts`, `packages/agent-verbs/src/verbs/item.test.ts`                                                                                                                                                                                                              |
| Times and ranges on calendars and the Gantt chart, across zones and clock changes                                | `packages/items/src/view-dates-write.test.ts`                                                                                                                                                                                                                                                                                                      |
| Phone: check, tel link, CSV as text                                                                              | `packages/items/src/phone-fields.test.ts`, `packages/sheets/src/fill-csv.test.ts`                                                                                                                                                                                                                                                                  |
| Risk: levels, names, ranks, the in-progress gate, catalogue read, card text, CSV, kind changes                   | `packages/items/src/risk-fields.test.ts`, `packages/project/src/plan-palette.test.ts`                                                                                                                                                                                                                                                              |
| Risk on boards: sorts, lanes, filters, search, widgets, formulas, card tables, Set Field, imports, forms         | `packages/items/src/risk-board.test.ts`, `packages/forms/src/risk-questions.test.ts`, plan-art `field-widget-stats.test.ts`, agent-verbs `form-fixed.test.ts`                                                                                                                                                                                      |
| Date and Time, Date Range, Phone in the card panel and its roles                                                 | `apps/editor/components/plan/DateTimeFields.test.tsx`                                                                                                                                                                                                                                                                                              |
| Percent: read, parse, clamp, show as, sort, lanes, CSV                                                           | `packages/items/src/percent-fields.test.ts`                                                                                                                                                                                                                                                                                                        |
| Percent: agents write, refuse, list showAs                                                                       | `packages/agent-verbs/src/verbs/item.test.ts`, `packages/items/src/type-changes.test.ts`                                                                                                                                                                                                                                                           |
| Percent: slider, chip, panel, switch                                                                             | `apps/editor/components/plan/PercentSlider.test.tsx`, `apps/editor/components/plan/NewFieldForm.test.tsx`                                                                                                                                                                                                                                          |
| Percent: exports draw the bar                                                                                    | `packages/project/src/svg-render-plan-card.test.ts`                                                                                                                                                                                                                                                                                                |
| Left-out statuses: read, refuse, allow                                                                           | `packages/items/src/type-catalogue.test.ts`                                                                                                                                                                                                                                                                                                        |
| Left-out statuses: api refuses moves, patches, makes                                                             | `apps/api/src/routes/item-routes.test.ts`                                                                                                                                                                                                                                                                                                          |
| Left-out statuses: agent refusal message                                                                         | `packages/agent-verbs/src/verbs/item.test.ts`                                                                                                                                                                                                                                                                                                      |
| Required fields: read, missing, cleared, message                                                                 | `packages/items/src/required-fields.test.ts`                                                                                                                                                                                                                                                                                                       |
| Required fields: api refuses a create or a clear                                                                 | `apps/api/src/routes/item-routes.test.ts`                                                                                                                                                                                                                                                                                                          |
| Required fields: agents list, set, refuse                                                                        | `packages/agent-verbs/src/verbs/plan-verbs.test.ts`, `packages/items/src/type-changes.test.ts`                                                                                                                                                                                                                                                     |
| Required fields: New {Type} dialog, type editor switch                                                           | `apps/editor/components/plan/RequiredFieldsDialog.test.tsx`, `apps/editor/components/plan/NewFieldForm.test.tsx`                                                                                                                                                                                                                                   |
| Notifies: fields, people told, Only Mine, agent changes                                                          | `packages/items/src/notify-fields.test.ts`                                                                                                                                                                                                                                                                                                         |
| Notifies: the Inbox push, one action a person                                                                    | `packages/index-app/src/cards.test.ts`, `apps/api/src/plan-room/plan-outbox.test.ts`                                                                                                                                                                                                                                                               |
| Notifies: agents list it                                                                                         | `packages/agent-verbs/src/plan/plan-listing.test.ts`                                                                                                                                                                                                                                                                                               |
| Notifies: Person field switch, Assignee menu, save                                                               | `apps/editor/components/plan/FieldNotifies.test.tsx`, `apps/editor/components/plan/NewFieldForm.test.tsx`                                                                                                                                                                                                                                          |
| Holds Several: read, store, notify, lanes, links, agents                                                         | `packages/items/src/several-values.test.ts`, `packages/agent-verbs/src/plan/plan-engine.test.ts`                                                                                                                                                                                                                                                   |
| Holds Several: chips, card face, switch, drag, Link Existing                                                     | `apps/editor/components/plan/HoldsSeveral.test.tsx`                                                                                                                                                                                                                                                                                                |
| Choice and Multiple Choice: chips, colours, list, keys, find, stale, Viewer                                      | `apps/editor/components/plan/ChoiceField.test.tsx`                                                                                                                                                                                                                                                                                                 |
| Card Type picker: the boards' types, one type a label, live                                                      | `apps/editor/components/plan/ItemTypePill.test.tsx`                                                                                                                                                                                                                                                                                                |
| Add Field: categories, descriptions, aliases, readiness                                                          | `apps/editor/components/plan/add-field-kinds.test.ts`                                                                                                                                                                                                                                                                                              |
| Add Field: gallery, rail, search, Ready to use, keys, shape                                                      | `apps/editor/components/plan/NewFieldForm.test.tsx`                                                                                                                                                                                                                                                                                                |
| Add Field: Try It (live editor, no writes, Escape, Enter, refusals, reset)                                       | `apps/editor/components/plan/AddFieldTryIt.test.tsx`                                                                                                                                                                                                                                                                                               |
| Built-in kinds: store, text, CSV, agents                                                                         | `packages/items/src/built-in-field-kinds.test.ts`                                                                                                                                                                                                                                                                                                  |
| Built-in kinds and Image: panel, card face, required                                                             | `apps/editor/components/plan/ItemFieldEditor.kinds.test.tsx`                                                                                                                                                                                                                                                                                       |
| Image fields: upload, read, roles, grants                                                                        | `apps/api/src/routes/images.test.ts`, `apps/api/src/plan-room/image-grants.test.ts`, `apps/editor/lib/api/images.test.ts`                                                                                                                                                                                                                          |
| Several Images: the stored list and every reader                                                                 | `packages/items/src/image-values.test.ts`, `apps/api/src/plan-room/image-grants.test.ts`, `apps/api/src/plan-room/image-refs.test.ts`                                                                                                                                                                                                              |
| Several Images: the panel's grid, uploads, reorder and roles, the card face count, Add Field and Edit Field      | `apps/editor/components/plan/ImageGalleryField.test.tsx`, `apps/editor/components/primitives/useGridReorder.test.tsx`, `apps/editor/components/plan/add-field-kinds.test.ts`                                                                                                                                                                       |
| Attachments: value, cap, cover, agents                                                                           | `packages/items/src/attachments.test.ts`, `packages/items/src/card-display.test.ts`                                                                                                                                                                                                                                                                |
| Attachments: panel, roles, drop, paste, cover on the card                                                        | `apps/editor/components/plan/AttachmentsField.test.tsx`                                                                                                                                                                                                                                                                                            |
| Images in use: triggers, report, purge, serving                                                                  | `apps/api/src/plan-room/image-refs.test.ts`                                                                                                                                                                                                                                                                                                        |
| Copies keep pictures: grants, serving, refs both ways, purge, Drive files                                        | `apps/api/src/plan-room/image-copy.test.ts`                                                                                                                                                                                                                                                                                                        |
| Add Field: option rows, Enter, Backspace, paste                                                                  | `apps/editor/components/plan/ChoiceOptionsEditor.test.tsx`                                                                                                                                                                                                                                                                                         |
| Edit Field: value conversions, refusals, counts, options, 2,000-card budget                                      | `packages/items/src/field-kind-change.test.ts`                                                                                                                                                                                                                                                                                                     |
| Hidden tab: hidden values, removed fields, allow-list, copy rules, roles, undo, live                             | `packages/items/src/hidden-values.test.ts`, `apps/editor/components/plan/ItemPanel.hidden.test.tsx` , `apps/editor/e2e/hidden-values.spec.ts`                                                                                                                                                                                                      |
| Card types save after Sync Plan (409 with a lower revision)                                                      | `apps/editor/hooks/plan/useItemTypes.test.ts`                                                                                                                                                                                                                                                                                                      |
| REST type patch maps fields (patch, move, patches; undo not mapped)                                              | `apps/api/src/routes/item-routes.test.ts`                                                                                                                                                                                                                                                                                                          |
| Changing a card's type: mapped by name, kinds, options, hidden values kept, every path                           | `packages/items/src/card-retype-fields.test.ts`, `packages/items/src/automation/plan-card-actions.test.ts`, `packages/items/src/automation/ai-steps.test.ts`, `packages/agent-verbs/src/plan/plan-engine.test.ts`, `apps/editor/hooks/plan/usePlanItemWrites.retype.test.ts`, `apps/api/src/plan-room/automations/automations-type-change.test.ts` |
| Edit Field: pencil, rename, reshape, type change, loss count and confirm, disabled tiles, Editor only            | `apps/editor/components/plan/EditFieldDialog.test.tsx`                                                                                                                                                                                                                                                                                             |
| Built-in names: stored, read, inherited, one type and several, CSV both names, budget                            | `packages/items/src/built-in-field-labels.test.ts`                                                                                                                                                                                                                                                                                                 |
| Built-in retype: shapes, refusals, Status, values moved, type rewritten, impact rows, filters removed, perf      | `packages/items/src/built-in-field-retype.test.ts`, `packages/items/src/field-retype-impact.test.ts`, `packages/items/src/field-filter-removal.test.ts`, `packages/items/src/field-retype.perf.test.ts`                                                                                                                                            |
| Built-in Edit Field: pencil on built-ins (Editor only), rename, Notifies, Status tiles dimmed, retype confirm    | `apps/editor/components/plan/BuiltInEditDialog.test.tsx`                                                                                                                                                                                                                                                                                           |
| All or none: values write fails, type fails, filters in the same undo step over a canvas step                    | `apps/editor/hooks/plan/retype-settle.test.ts`, `apps/editor/hooks/plan/item-undo-journal.test.ts`, `apps/editor/components/plan/field-retype-tabs.test.ts`                                                                                                                                                                                        |
| Edit Field: the type and its values as one undo step                                                             | `apps/editor/hooks/plan/item-undo-journal.test.ts`, `apps/editor/hooks/plan/useItemTypes.test.ts`                                                                                                                                                                                                                                                  |
| Add Field: opened from a group, lands there                                                                      | `apps/editor/components/plan/ItemTypeLayoutEditor.rows.test.tsx`                                                                                                                                                                                                                                                                                   |
| Statuses chips, panel Status options                                                                             | `apps/editor/components/plan/ItemTypeStatuses.test.tsx`                                                                                                                                                                                                                                                                                            |
| Editor tabs, Configuration sections, flags, arrow keys                                                           | `apps/editor/components/plan/ItemTypeEditor.tabs.test.tsx`                                                                                                                                                                                                                                                                                         |
| Show Me steps open Configuration, scroll to Fields                                                               | `apps/editor/components/tour/CardTypeTour.test.tsx`                                                                                                                                                                                                                                                                                                |
| Blocked By: index, open count, ignored blockers, loops, messages, changed-value gate                             | `packages/items/src/blocked-by.test.ts`, `blocked-by.perf.test.ts`                                                                                                                                                                                                                                                                                 |
| Blocked By: offline write checks refuse a loop                                                                   | `packages/items/src/write-checks.test.ts`                                                                                                                                                                                                                                                                                                          |
| Blocked By: the api's Editor gate and loop refusal (create, patch, patches, move)                                | `apps/api/src/routes/item-blocks.test.ts`                                                                                                                                                                                                                                                                                                          |
| Blocked By: switch, badge sizes, panel lists, picker refusal, roles                                              | `apps/editor/components/plan/BlockedBy.test.tsx`                                                                                                                                                                                                                                                                                                   |
| Blocked By: SVG badge                                                                                            | `packages/project/src/svg-render-plan-card.test.ts`                                                                                                                                                                                                                                                                                                |
| Blocked By: agents list, set, loop stop, switch                                                                  | `packages/agent-verbs/src/plan/plan-engine.test.ts`                                                                                                                                                                                                                                                                                                |
| Panel, editor, card face, palette in a browser                                                                   | checked by hand against the dev stack (screenshots)                                                                                                                                                                                                                                                                                                |

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
| `CARD_AGE_WARN_DAYS`                                   | 7      | Spec "Card display": Age turns amber                                           |
| `CARD_AGE_ALERT_DAYS`                                  | 14     | Spec "Card display": Age turns red, Stale Cards' `STALE_DAYS`                  |
| `IMAGE_FIELD_PICTURES_MAX`                             | 20     | Spec "Image fields": `FIELD_VALUES_MAX`, as Holds Several and Attachments      |

## Default and ready-made types

`ITEM_TYPES` (the default types): `project` (#18181b), `task` (#71717a), `note` (#2563eb), `idea` (#eab308),
`action` (#dc2626). `READY_MADE_CARD_TYPES` (`packages/items/src/brought-types.ts`, pure data, the table in
[Plan templates](../plan-templates.md#ready-made-card-types)) is those five then the thirteen more. Presets set the types
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
