# Entity: blueprint

Derived from [The entity](../entity.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                                   | Role                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/document/src/data-shapes.ts`                                 | `EntityField`, `EntityKey`, `ENTITY_KEYS`, `ENTITY_MAX_FIELDS`, `_TEXT` |
| `packages/document/src/element-types.ts`                               | `ShapeElement.entityFields`                                             |
| `packages/document/src/arrow-types.ts`                                 | `Endpoint` pinned `field?: number`                                      |
| `packages/document/src/shape-factory.ts`                               | `createShape('entity', …)` defaults                                     |
| `packages/document/src/validate-shape.ts`                              | The `entityFields` bounds and `key` check                               |
| `packages/document/src/validate.ts`                                    | A pinned end's `field` check                                            |
| `packages/document/src/entity-geometry.ts`                             | Band, rows, gutter metrics; `entityFieldPoint`, `entityPartAt`, snap    |
| `packages/document/src/entity-fields.ts`                               | Keys, legacy reading, clean / fit / remap, relationship heads, presets  |
| `packages/document/src/entity-related.ts`                              | `buildRelatedEntity`: Add Related Entity's entity and relationship      |
| `packages/document/src/entity-look.ts`                                 | Tints, type face, key glyph paths and inks                              |
| `packages/document/src/geometry.ts`                                    | `endpointPosition` / `fieldEndPosition`: a field end's point            |
| `packages/document/src/arrow-rebind.ts`, `arrow-rebind-swap.ts`        | A field end keeps its field on a move                                   |
| `packages/document/src/svg-render-entity.ts`                           | `svgEntityRows`: the export body                                        |
| `packages/document/src/label-font.ts`                                  | `LABEL_FONT_PX`, `labelFontPx`: the title's px table                    |
| `packages/document/src/graph-authoring.ts`                             | `entityNode`: a graph node with fields is an entity                     |
| `packages/document/src/mermaid-er.ts`                                  | Attribute markers become the field's key                                |
| `packages/document/src/element-normalise.ts`                           | `normaliseEntity`: an authored box fits its rows                        |
| `apps/live/components/canvas/entity/EntityView.tsx`                    | `EntityView`: band, stripes, gutter, rows                               |
| `apps/live/components/canvas/entity/EntityFieldControls.tsx`           | Double-click to edit, field ports, hover light                          |
| `apps/live/components/canvas/entity/EntityFieldEditor.tsx`             | One field edited in place                                               |
| `apps/live/components/canvas/entity/EntityKeyGlyph.tsx`                | The key glyphs on canvas and in the menu                                |
| `apps/live/components/canvas/entity/CardinalityButton.tsx`             | The arrow toolbar's Cardinality group                                   |
| `apps/live/components/canvas/entity/entity-actions.ts`                 | `EntityCanvasActions`: what a selected entity's view may call           |
| `apps/live/lib/entity-field-edit.ts`                                   | The field being edited in place (module store)                          |
| `apps/live/hooks/canvas/useEntityActions.ts`                           | The editor verbs                                                        |
| `apps/live/hooks/canvas/arrow-endpoint-resolve.ts`                     | A dragged end snaps to a field row                                      |
| `apps/live/hooks/canvas/useEditorDrag.ts`                              | Relationship heads on release                                           |
| `apps/live/hooks/canvas/useBoxedDragHandlers.ts`                       | `beginAnchorDrag(…, { field })`                                         |
| `apps/live/components/canvas/QuickConnectRing.tsx` (+ options, pluses) | Add Related Entity, Add Field                                           |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`                        | `setEntityFieldsSelected` (the menu)                                    |
| `apps/live/components/palette/EntityFieldsEditor.tsx`                  | The Fields menu section                                                 |
| `apps/live/components/palette/palette-tile-defs.tsx`                   | Tile `tools:entity`, section `components`                               |
| `packages/document-views/src/content-summary.ts`                       | A field's key in the text views                                         |

## Domain and naming

| Term         | Identifier                        | Meaning                                                     |
| ------------ | --------------------------------- | ----------------------------------------------------------- |
| Entity       | `shape: 'entity'`                 | The element kind                                            |
| Title        | `label` (with `richText`)         | The element's ordinary label, in the title bar              |
| Field        | `EntityField`                     | One row: `{ name: string; type?: string; key?: EntityKey }` |
| Fields       | `ShapeElement.entityFields`       | The ordered rows                                            |
| Key          | `EntityKey`                       | `'pk' \| 'fk' \| 'pk-fk' \| 'uk'`                           |
| Title bar    | `entityHeaderHeight(textSize)` px | The band above the rule                                     |
| Key gutter   | `entityKeyGutterPx(fields)` px    | The column of key glyphs left of the names                  |
| Field end    | pinned `Endpoint` with `field`    | An arrow end on one field                                   |
| Relationship | an arrow joining two entities     | Ordinary arrow; its ER ends are its cardinality             |
| Cardinality  | `CardinalityPreset`               | A named pair of ER ends                                     |
| Field port   | (render only)                     | The dot each side of a hovered field                        |

Banned synonyms: "record", "class box", "attribute" or "column" for a field, "row" in identifiers for
a field (geometry's "row" is the field's drawn band), "PK flag". "Entity" is the single user-facing and
code term.

## Behaviour and state

1. **Create.** `createShape('entity', x, y)`: `label: 'Entity'`, `textAlignX: 'left'`,
   `textAlignY: 'top'`, `textSize: 'md'`, fields `id: string` (PK) and `name: string` (`D22`).
2. **Title edit.** The ordinary label editor; a double-click on the title bar reaches it, as before.
3. **Reading a field** (`entityFieldView`): a field with `key` or without key words is itself; a field
   with no `key` whose `type` holds `PK`, `FK` or `UK` as whole upper-case words reads with
   `key = entityKeyOf(words)` and the type with the words, doubled commas and edge commas removed. Every
   surface (canvas, export, editors, gutter) reads through it; nothing is migrated.
4. **Key cycle** (`nextEntityKey`): `undefined → pk → fk → pk-fk → uk → undefined`.
5. **Commit** (`withEntityFields(elements, id, fields, remap?)`): `cleanEntityFields` (slice to 40,
   name to 80, type trimmed and dropped when empty, key kept only when valid), then the entity's height
   becomes `fittedEntityHeight(n) + max(0, oldHeight - fittedEntityHeight(oldN))` where
   `fittedEntityHeight(n) = entityHeight(max(1, n), textSize)`; with `remap`, every pinned end on that
   entity with a `field` takes `remap(field)`, a `null` dropping the `field` key. Removal passes
   `removedFieldRemap(i)`; insertion would pass `insertedFieldRemap(i)`.
6. **In-place edit** (`EntityFieldControls`, `EntityFieldEditor`): offered when the view gets
   `actions` (selected, not read-only, not locked, not held by a peer, rotation 0). A double-click on the
   layer resolves `entityPartAt`: `field i` sets the store to `{ entityId, index: i }`; `below` sets it to
   `index = fields.length` (the new field, not yet written) when under 40; `title` is left to the label.
   The editor seeds from the read field (or `{ name: '' }`). Exits: Enter or Tab on the type → `next`;
   Shift+Tab on the name → `prev`; Escape → cancel; blur outside the editor or the page leaving → `close`.
   Save: a new field that is blank writes nothing; a blank existing field is removed with
   `removedFieldRemap`; a changed field is replaced; an unchanged one writes nothing. Then `next` opens
   `index` (after a removal) or `index + 1`, `prev` opens `index - 1`, each only while `<= count` and
   `< 40`; otherwise the store clears. Unmounting the controls clears an edit on that entity.
7. **Field ports.** While the pointer is over field `i` and nothing is being edited, a port shows on
   each side; a press calls `startFieldArrow(id, side, i, e)` → `beginAnchorDrag(id, side, e, { field: i })`,
   the new arrow's `from` carrying `field`.
8. **Field snap** (`snapToEntityField` in `resolveArrowEndpointDrag`, before the anchor snap): without
   Cmd / Ctrl and with another end, the topmost entity under the cursor (cursor un-rotated about its
   centre) decides: over a field row it returns `{ elementId, anchor: 'w' | 'e', field, point }`, the side
   being the one the other end is on (un-rotated x against the centre); over its title or body, nothing.
   The entity holding the other end is skipped. The snap target shown is `point`, active.
9. **Field end position** (`fieldEndPosition`): on an entity with the anchor on side `w` or `e`, and a
   field `0 <= f < count` whose row shows, `(x | x + width, rowTop(f) + 13.75 / 2)` rotated about the
   centre; otherwise the plain `anchorPosition`.
10. **Rebind.** A field end whose facing side changes to `e` or `w` takes that side as its anchor and
    keeps `field`; facing `n` / `s` it is left alone. Field ends take no part in the same-side swap.
11. **Relationship heads** (`withRelationshipHeads` at the release of any arrow-endpoint drag, press or
    placing click): when both ends are pinned to entities and the arrow has none of `arrowEnds`,
    `arrowheadShape`, `arrowheadStartShape`: `arrowEnds: 'both'`, the start `many` and end `one` when only
    the start is on an FK field (`fk` or `pk-fk`), else start `one`, end `many`.
12. **Cardinality.** `CardinalityButton` shows for an Editor's unlocked selected arrow with
    `joinsEntities`; its label is `cardinalityLabel` (`N : M` for many to many; `1 : N` when not ER ends,
    `D220`); a preset writes `cardinalityPatch` in one commit and tracks `Element·Changed·Cardinality`.
13. **Add Field** (ring, bottom side): opens the new field (`index = count`) in place, nothing written;
    tracks `Element·Added·EntityField`.
14. **Add Related Entity** (ring, any side): `buildRelatedEntity(source, side, elements)` (`D217`): the
    source's look keys copied; fields `relatedEntityFields` (`id` PK and `foreignKeyName(title)` FK typed
    as the source PK's read type or `uuid`); the arrow from the source (`out[side]`, with `field: pk` when
    beside and the source has a PK) to the new entity (`into[side]`, with `field: 1` when beside), One to
    Many. Committed together; the new entity is selected and its title opened. Tracks `Added·Entity`,
    `Added·Arrow`, `Created·RelatedEntity`.
15. **Title bar height** (`entityHeaderHeight(textSize)`): `max(30, round(labelFontPx(textSize ?? 'scale')
    - 1.25) + 10)`, canvas and export alike [GA11].
16. **Authored size** (`entityHeight(rows, textSize)`): unchanged; MCP writes (`normaliseEntity`) raise
    a shorter box to it and graph authoring builds `sm` entities 200 to 360 wide, a keyed field's name
    counting three glyphs more (`D141`).

Invariants:

- **I1:** `entityFields.length <= 40`; every `name` and `type` is at most 80 characters; `key` is one of
  `ENTITY_KEYS`.
- **I2:** a field without a type has no `type` key, without a key no `key` key (never `''`).
- **I3:** the rule sits at `entityHeaderHeight`, identical on canvas and in export.
- **I4:** a pinned end's `field` is an integer `0..39`; an end whose field does not resolve draws at its
  anchor.
- **I5:** every editor write of an entity's fields goes through `withEntityFields`, so the box fits and
  field ends follow.

## Interfaces and contracts

```ts
// packages/document/src/data-shapes.ts
export const ENTITY_KEYS = ['pk', 'fk', 'pk-fk', 'uk'] as const;
export type EntityKey = (typeof ENTITY_KEYS)[number];
export type EntityField = { name: string; type?: string; key?: EntityKey };

// packages/document/src/arrow-types.ts
| { kind: 'pinned'; elementId: ElementId; anchor: Anchor; field?: number }

// packages/document/src/entity-fields.ts
entityFieldView(field): EntityField;  nextEntityKey(key): EntityKey | undefined;
entityKeyOf(markers): EntityKey | undefined;  entityKeyGutterPx(fields): number;
cleanEntityFields(fields): EntityField[];  fittedEntityHeight(count, el): number;
withEntityFields(elements, entityId, fields, remap?): Element[];
removedFieldRemap(i): FieldRemap;  insertedFieldRemap(i): FieldRemap;
relationshipHeads(arrow, elements) | null;  withRelationshipHeads(elements, arrowId): Element[];
joinsEntities(arrow, elements): boolean;  CARDINALITY_PRESETS;  cardinalityLabel(arrow) | null;
cardinalityPatch(preset);  foreignKeyName(title): string;  relatedEntityFields(source): EntityField[];

// packages/document/src/entity-geometry.ts
entityRowTop(el, i); entityRowShows(el, i); entityFieldPoint(el, side, i, count) | null;
entityPartAt(el, count, point): EntityPart | null; snapToEntityField(cursor, elements, toward, skipId) | null;

// packages/document/src/entity-related.ts
buildRelatedEntity(source, side: RelatedSide, elements): { entity; arrow };

// apps/live/hooks/canvas/useEntityActions.ts
{ setFields, startFieldArrow, addFieldSelected, addRelatedSelected, setCardinalitySelected }
```

Validation (`elementValidationIssue`) refuses the element, and so the tab (`invalid tab`, 400), when
`entityFields` is not an array of at most 40 `{ name, type?, key? }` with names and types at most 80
and `key` one of the four; and an arrow whose pinned end has a `field` that is not an integer `0..39`.

## Data and persistence

| Field          | Class     | Notes                                            |
| -------------- | --------- | ------------------------------------------------ |
| `entityFields` | persisted | Order is meaning; `key` optional                 |
| pinned `field` | persisted | On arrow ends; index into the target's fields    |
| `label`        | persisted | The title, shared with every shape               |
| Menu draft     | ephemeral | `EntityFieldsEditor` state, re-seeded on change  |
| In-place edit  | ephemeral | `entity-field-edit` store and the editor's draft |

No migration: absent `entityFields` renders as an empty list; legacy key words read as keys (B3) and
are rewritten on the next save; an end without `field` is the plain anchor it always was.

## Errors and edge cases

| #   | Case                                     | Handling                                                           |
| --- | ---------------------------------------- | ------------------------------------------------------------------ |
| E1  | No fields                                | "No fields yet" placeholder (`D23`); fitted to one row's room      |
| E2  | More rows than the box holds             | Clipped on canvas; export skips them (`D24`); field ends fall back |
| E3  | Long name or type                        | Truncated with an ellipsis on canvas; export draws it whole        |
| E4  | Paste of more than 40 rows               | Sliced to 40 on commit                                             |
| E5  | 41st field                               | Add Field, double-click below and Enter stop at 40                 |
| E6  | Whitespace-only type                     | Dropped to `undefined` [GA12]                                      |
| E7  | `textSize` absent in a stored file       | Band and label read the same default, canvas and export [GA11]     |
| E8  | Locked, rotated, read-only, peer-held    | No in-place editing or ports; the menu still edits (not read-only) |
| E9  | Authored via MCP or a graph              | Box raised to `entityHeight`, so no row is clipped (`D141`)        |
| E10 | Field removed under a field end          | The end drops `field` (stays on the entity); later ones move up    |
| E11 | Agent rewrites the fields wholesale      | Ends keep their index; one past the end falls back to the anchor   |
| E12 | Field end facing up or down after a move | Stays on its field side (B10)                                      |
| E13 | Arrow with style-memory heads            | Not turned into a relationship (B11); Cardinality still applies    |
| E14 | Escape on a new field                    | Nothing written, no undo step                                      |
| E15 | Deselected mid-edit                      | Blur saves first; the store clears on unmount                      |

## Security and trust

The bounds above are enforced at the api by `isValidTab`. Field text is rendered as React text and
escaped with `xmlEscape` in export; a key is one of four literals. A Participant's element writes
(`applyParticipantOp`) do not take `entityFields`; the canvas controls render only for an Editor.

## Performance and limits

Worst case 40 rows of 80 + 80 characters, about 7 KB per entity. Rendering: one stripe div per odd row
and one glyph svg per keyed field (at most 60 nodes more than before). `entityFieldView` is a regex test
per field per render. The controls layer (one per selected entity) re-renders on hover only when the
field under the pointer changes. `snapToEntityField` is O(elements) per drag frame, one rect test each,
the same order as `snapToAnchor`, and returns at the topmost entity under the cursor.
`joinsEntities` is two finds, run only for a selected arrow's toolbar.

## Presentation and UX

- Palette: tile `tools:entity` in the Components tab, caption "Entity" [QA12].
- Canvas: band `headerFill` at 1, else the drawn stroke at 0.12 (`D214`); 1px rule in
  `strokeColor ?? '#cbd5e1'`; odd-row stripes (`D215`); gutter and glyphs (`D216`); names 11px, PK
  semibold; types 10px monospace at 0.6 (`D25`).
- Selected (Editor): the hovered field lit `brand-500/10`, ports (`D218`), the in-place editor (`D219`).
- Ring: Add Related Entity first, Add Field (bottom only), Arrow, Duplicate.
- Toolbar: Cardinality between the growth group and Duplicate, presets drawn as their two ends.
- Export: `svgEntityRows` draws band, stripes (clipped to the border), rule, glyphs, names and types; the
  generic label emitter draws the title over the band.
- Menu: section "Fields" (Tools flyout): key button (dashed "key" when none), name, type (monospace),
  ×, "Add Field". No reorder [QA12].

## Accessibility

- Menu inputs are labelled "Field n name" / "Field n type"; the key button "Field n key: PK. Change key";
  remove "Remove field".
- In place: "Field name", "Field type", "Key: … Change key"; ports "Draw a relationship from <name>".
- The canvas view is decorative; the title is the element's label.
- Row text inherits `textColor`; the type's 0.6 opacity can fall below 4.5:1 on light fills, and the
  amber key glyph is about 2:1 on white (a glyph, with the key also in the menu and the text views).
  Not covered.

## Observability

None in code today [GA1]; telemetry: `Element·Changed·Entity`, `Added·EntityField`,
`Created·RelatedEntity`, `Changed·Cardinality`.

## Testing

| Rule                                               | Test                                              | File                                                              |
| -------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| Band follows text size, 30 floor                   | entityHeaderHeight (two cases)                    | `packages/document/src/entity-geometry.test.ts`                   |
| Authored height shows every row                    | entityHeight (two cases)                          | `packages/document/src/entity-geometry.test.ts`                   |
| Key cycle, markers, legacy reading (B3, B4)        | keys                                              | `packages/document/src/entity-fields.test.ts`                     |
| Bounds 40 / 80, blank type and key absent (I1, I2) | cleanEntityFields                                 | `packages/document/src/entity-fields.test.ts`                     |
| Fit, slack, remap (B5, I5, E10)                    | withEntityFields                                  | `packages/document/src/entity-fields.test.ts`                     |
| Field end point and fallbacks (B9, I4)             | field-to-field geometry                           | `packages/document/src/entity-fields.test.ts`                     |
| Rebind keeps the field (B10)                       | keeps a field end on its field when a move swaps… | `packages/document/src/entity-fields.test.ts`                     |
| Relationship heads (B11)                           | relationships                                     | `packages/document/src/entity-fields.test.ts`                     |
| Cardinality labels (B12)                           | labels the pair each preset sets                  | `packages/document/src/entity-fields.test.ts`                     |
| Related entity names and types (B14)               | Add Related Entity                                | `packages/document/src/entity-fields.test.ts`                     |
| Related entity layout and wiring (B14)             | buildRelatedEntity                                | `packages/document/src/entity-related.test.ts`                    |
| Field snap (B8)                                    | snapToEntityField                                 | `packages/document/src/entity-related.test.ts`                    |
| Validation of key and field                        | validation                                        | `packages/document/src/entity-fields.test.ts`                     |
| Export band, stripe, glyphs (I3)                   | export                                            | `packages/document/src/entity-fields.test.ts`                     |
| In-place edit, ports (B6, B7)                      | EntityFieldControls                               | `apps/live/components/canvas/entity/EntityFieldControls.test.tsx` |
| Menu key button and remove remap                   | EntityFieldsEditor                                | `apps/live/components/palette/EntityFieldsEditor.test.tsx`        |
| Mermaid keys                                       | parseMermaid: ER diagrams                         | `packages/document/src/mermaid-er.test.ts`                        |
| Class template uses entities, fields as rows       | class diagram drops four entity classes           | `apps/live/lib/templates.test.ts`                                 |

## Constants and configuration

| Name                        | Value       | Provenance / safe range                          |
| --------------------------- | ----------- | ------------------------------------------------ |
| `ENTITY_MAX_FIELDS`         | 40          | Readable in one box; 20 to 80                    |
| `ENTITY_MAX_TEXT`           | 80          | A signature fits; 40 to 200                      |
| Band floor                  | 30          | The band at the 16px size; fixed                 |
| Band line height            | 1.25        | Tailwind `leading-tight`                         |
| Band padding                | 10          | The label's vertical padding                     |
| Rule colour                 | `'#cbd5e1'` | Tailwind slate-300 (`MUTED_RULE` in export)      |
| `ENTITY_ROW_TEXT_PX`        | 13.75       | An 11px name at `leading-tight`                  |
| `ENTITY_ROW_GAP_PX`         | 3           | Between rows                                     |
| `ENTITY_BODY_PAD_PX`        | 6           | Above and below the list                         |
| `ENTITY_SIDE_PAD_PX`        | 8           | `px-2`                                           |
| `ENTITY_KEY_GUTTER_PX`      | 15          | One glyph and a gap; 12 to 20                    |
| `ENTITY_KEY_PAIR_GUTTER_PX` | 25          | Two glyphs and a gap; 22 to 30                   |
| `ENTITY_KEY_GLYPH_INSET_PX` | 8           | The side padding                                 |
| `ENTITY_KEY_GLYPH_PX`       | 10          | Under the 11px text; 8 to 12                     |
| `ENTITY_PRIMARY_KEY_INK`    | `#f59e0b`   | Tailwind amber-500, the database-tool convention |
| `ENTITY_BAND_TINT`          | 0.12        | Reads as a header on light and dark; 0.08 to 0.2 |
| `ENTITY_STRIPE_TINT`        | 0.045       | Visible, never loud; 0.03 to 0.08                |
| `ENTITY_TYPE_OPACITY`       | 0.6         | Muted, legible; 0.5 to 0.75                      |
| `RELATED_ENTITY_GAP_PX`     | 120         | Room for two crow's feet and a label; 80 to 200  |
| Port size                   | 9 px        | A dot on the edge; 7 to 12                       |
