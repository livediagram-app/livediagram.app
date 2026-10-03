# Entity: blueprint

Derived from [The entity](../entity.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `packages/document/src/data-shapes.ts`                       | `EntityField`, `ENTITY_MAX_FIELDS`, `ENTITY_MAX_TEXT` |
| `packages/document/src/element-types.ts`                     | `ShapeElement.entityFields`                           |
| `packages/document/src/shape-factory.ts`                     | `createShape('entity', …)` defaults                   |
| `packages/document/src/validate.ts`                          | `SHAPE_KINDS` entry and the `entityFields` bounds     |
| `packages/document/src/entity-geometry.ts`                   | `entityHeaderHeight`, `entityHeight`, row metrics     |
| `packages/document/src/svg-render-data.ts`                   | `svgEntityRows`: rule and rows in the headless render |
| `packages/document/src/label-font.ts`                        | `LABEL_FONT_PX`, `labelFontPx`: the title's px table  |
| `packages/document/src/graph-authoring.ts`                   | `entityNode`: a graph node with fields is an entity   |
| `packages/document/src/element-normalise.ts`                 | `normaliseEntity`: an authored box fits its rows      |
| `apps/live/components/canvas/EntityView.tsx`                 | `EntityView`: the canvas rule and rows                |
| `apps/live/components/canvas/label-style.ts`                 | `FIXED_FONT_PX` (re-export of `LABEL_FONT_PX`)        |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`              | `setEntityFieldsSelected`                             |
| `apps/live/components/palette/context-menu-data-editors.tsx` | `EntityFieldsEditor`                                  |
| `apps/live/components/palette/ElementDataSections.tsx`       | The Fields menu section                               |
| `apps/live/components/palette/palette-tile-defs.tsx`         | Tile `tools:entity`, section `components`             |
| `packages/templates/src/template-builders-uml.ts`            | UML class template built from entities                |
| `packages/templates/src/template-builders-technical.ts`      | ER template built from entities                       |

## Domain and naming

| Term      | Identifier                       | Meaning                                        |
| --------- | -------------------------------- | ---------------------------------------------- |
| Entity    | `shape: 'entity'`                | The element kind                               |
| Title     | `label` (with `richText`)        | The element's ordinary label, in the title bar |
| Field     | `EntityField`                    | One row: `{ name: string; type?: string }`     |
| Fields    | `ShapeElement.entityFields`      | The ordered rows                               |
| Title bar | `entityHeaderHeight(element)` px | The band above the rule                        |
| Rule      | (render only)                    | The 1px line under the title bar               |

Banned synonyms: "record" in new code or copy (some comments use it), "class box", "attribute"
for a field, "column" for a field. "Entity" is the single user-facing and code term.

## Behaviour and state

1. **Create.** `createShape('entity', x, y)`: `label: 'Entity'`, `textAlignX: 'left'`,
   `textAlignY: 'top'`, `textSize: 'md'`, fields `id: string` and `name: string` (`D22`).
2. **Title edit.** The ordinary label editor; nothing entity-specific.
3. **Fields edit** (`EntityFieldsEditor`): a local draft of the rows. Typing changes the draft only;
   **blur** of an input commits the whole draft; **remove** (×) and **Add field** commit at once.
   Add appends `{ name: '' }`. An emptied type input sets `type: undefined` in the draft.
4. **Commit** (`setEntityFieldsSelected(fields)`): for each selected entity, write
   `fields.slice(0, ENTITY_MAX_FIELDS)`, each `name` sliced to `ENTITY_MAX_TEXT`, and `type` kept
   only when non-empty after trimming, sliced to `ENTITY_MAX_TEXT` [GA12]. One `commit`, tracks
   `Element·Changed·Entity`.
5. **Title bar height** (`entityHeaderHeight(textSize)`): `fontPx` is
   `labelFontPx(textSize ?? 'scale')`, the table `FIXED_FONT_PX` re-exports; height
   `max(30, round(fontPx * 1.25) + 10)`. One function in `packages/document/src/entity-geometry.ts`
   serves the canvas (`EntityView`) and the export (`svgEntityRows`), and reads the same
   absent-size default the label uses [GA11].
6. **Authored size** (`entityHeight(rows, textSize)`): the title bar, plus, with rows,
   `rows * ENTITY_ROW_TEXT_PX + (rows - 1) * ENTITY_ROW_GAP_PX + 2 * ENTITY_BODY_PAD_PX`, rounded
   up. MCP element writes (`normaliseEntity`) raise a shorter box to it; graph authoring
   (`entityNode`) builds a `textSize: 'sm'` entity that height, 200 to 360 wide by a glyph
   estimate. The editor never resizes an entity (`D141`) [QA12].

Invariants:

- **I1:** `entityFields.length <= ENTITY_MAX_FIELDS`; every `name` and `type` is at most
  `ENTITY_MAX_TEXT` characters.
- **I2:** a field without a type has no `type` key (never `''`).
- **I3:** the rule sits at `entityHeaderHeight`, identical on canvas and in export.

## Interfaces and contracts

```ts
// packages/document/src/data-shapes.ts
export const ENTITY_MAX_FIELDS = 40;
export const ENTITY_MAX_TEXT = 80;
export type EntityField = { name: string; type?: string };

// packages/document/src/element-types.ts (ShapeElement)
entityFields?: EntityField[];

// packages/document/src/entity-geometry.ts
export const ENTITY_ROW_TEXT_PX = 11 * 1.25;
export const ENTITY_ROW_GAP_PX = 3;
export const ENTITY_BODY_PAD_PX = 6;
export function entityHeaderHeight(textSize: TextSize | undefined): number;
export function entityHeight(rows: number, textSize: TextSize | undefined): number;

// apps/live/hooks/canvas/useDataShapeSetters.ts
setEntityFieldsSelected: (fields: EntityField[]) => void;

// apps/live/components/palette/EditorContextMenu.types.ts
onSetEntityFields: (fields: EntityField[]) => void;
```

Validation (`isValidElement`) rejects the element, and so the tab (`invalid tab`, 400), when
`entityFields` is not an array of at most 40 objects, a `name` is not a string of at most 80, or a
present `type` is not a string of at most 80.

## Data and persistence

| Field          | Class     | Notes                                           |
| -------------- | --------- | ----------------------------------------------- |
| `entityFields` | persisted | Order is meaning                                |
| `label`        | persisted | The title, shared with every shape              |
| Editor draft   | ephemeral | `EntityFieldsEditor` state, re-seeded on change |

No migration: absent `entityFields` renders as an empty list.

## Errors and edge cases

| #   | Case                               | Handling                                                          |
| --- | ---------------------------------- | ----------------------------------------------------------------- |
| E1  | No fields                          | "No fields yet" placeholder (`D23`)                               |
| E2  | More rows than the box holds       | Clipped on canvas; export skips rows below the box (`D24`) [QA12] |
| E3  | Long name or type                  | Truncated with an ellipsis on canvas; export draws it whole       |
| E4  | Paste of more than 40 rows         | Sliced to 40 on commit                                            |
| E5  | 41st row via Add field             | Button `disabled` at 40                                           |
| E6  | Whitespace-only type               | Dropped to `undefined` [GA12]                                     |
| E7  | `textSize` absent in a stored file | Band and label read the same default, canvas and export [GA11]    |
| E8  | Locked or read-only                | Nothing on the canvas is a control; rows edit only from the menu  |
| E9  | Authored via MCP or a graph        | Box raised to `entityHeight`, so no row is clipped (`D141`)       |

## Security and trust

The bounds above are enforced at the api by `isValidTab`. Field text is rendered as React text and
escaped with `xmlEscape` in export.

## Performance and limits

Worst case 40 rows of 80 + 80 characters, about 6.4 KB per entity; rendering is one flex column.

## Presentation and UX

- Palette: tile `tools:entity` in the Components tab, caption "Entity" [QA12].
- Canvas: the whole view is `pointer-events-none`; the title bar is an empty band with a 1px
  bottom rule in `strokeColor ?? '#cbd5e1'`; rows below at 11px, `name` left and truncated, `type`
  pushed right at 10px and 0.55 opacity (`D25`).
- Export: `svgEntityRows` draws the rule and rows; the generic label emitter draws the title.
- Menu: section "Fields" (Tools flyout) with a name input, a type input, a × per row and
  "Add field". No reorder [QA12].

## Accessibility

- Inputs are labelled "Field n name" / "Field n type"; the remove button is "Remove field".
- The canvas view is decorative; the title is the element's label.
- Row text inherits `textColor`; the type's 0.55 opacity can fall below 4.5:1 on light fills. Not
  covered.

## Observability

None in code today [GA1].

## Testing

| Rule                                         | Test                                                          | File                                               |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Band follows text size, 30 floor             | entityHeaderHeight (two cases)                                | `packages/document/src/entity-geometry.test.ts`    |
| Authored height shows every row              | entityHeight (two cases)                                      | `packages/document/src/entity-geometry.test.ts`    |
| MCP write grows the box to its rows          | aligns an entity title top-left and grows the box to its rows | `packages/document/src/element-normalise.test.ts`  |
| Export keeps the card box and draws a body   | still frames a record; every kind with a body                 | `packages/document/src/export-consistency.test.ts` |
| Class template uses entities, fields as rows | class diagram drops four entity classes                       | `apps/live/lib/templates.test.ts`                  |
| Bounds 40 / 80, `type` optional (I1)         | none [GA14]                                                   |                                                    |
| Cleared type stores `undefined` (I2)         | none [GA14]                                                   |                                                    |
| Editor commits on blur, add, remove          | none [GA14]                                                   |                                                    |
| Canvas and export band agree (I3)            | none [GA11]                                                   |                                                    |
| Graph authoring builds an entity             | none [GA14]                                                   |                                                    |

## Constants and configuration

| Name                 | Value       | Provenance / safe range                       |
| -------------------- | ----------- | --------------------------------------------- |
| `ENTITY_MAX_FIELDS`  | 40          | Readable in one box; 20 to 80                 |
| `ENTITY_MAX_TEXT`    | 80          | A signature fits; 40 to 200                   |
| Band floor           | 30          | The band at the 16px size; fixed              |
| Band line height     | 1.25        | Tailwind `leading-tight`                      |
| Band padding         | 10          | The label's vertical padding                  |
| Rule colour          | `'#cbd5e1'` | Tailwind slate-300 (`MUTED_RULE` in export)   |
| Row sizes            | 11 / 10 px  | Name / type                                   |
| `ENTITY_ROW_TEXT_PX` | 13.75       | An 11px name at `leading-tight`               |
| `ENTITY_ROW_GAP_PX`  | 3           | Between rows (`gap-[3px]` on canvas)          |
| `ENTITY_BODY_PAD_PX` | 6           | Above and below the list (`py-1.5` on canvas) |
