# BPMN: blueprint

Derived from [BPMN](../bpmn.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                                                     | Role                                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/document/src/bpmn.ts`                                                          | Symbols, families, kinds, sizes, variants, flow looks, mark geometry |
| `packages/document/src/svg-render-bpmn.ts`                                               | `svgBpmnMarks`: the mark in an exported SVG / PNG                    |
| `packages/document/src/svg-render-boxed.ts`, `svg-render-shapes.ts`                      | Call the mark; the data object's folded page silhouette              |
| `packages/document/src/element-types.ts`, `element-fields.ts`                            | `bpmn?: BpmnSymbol` on `ShapeElement`, in the shape's field table    |
| `packages/document/src/element-field-values.ts`, `validate-shape.ts`                     | The closed vocabulary and its check                                  |
| `packages/document/src/shape-variants.ts`                                                | `applyBpmnVariant` in the variant chain (C4, then BPMN, then shared) |
| `apps/editor/components/canvas/BpmnMarkLayer.tsx`                                        | The canvas mark over the shape                                       |
| `apps/editor/components/canvas/ShapeContentRouter.tsx`, `shape-svg-overlay.tsx`          | Mounts the layer; the geometry override for the data object          |
| `apps/editor/components/palette/tile-defs/bpmn-tiles.tsx`                                | The 14 tiles, section `bpmn`                                         |
| `apps/editor/components/palette/palette-layouts.ts`, `category-flyout-groups.ts`         | Diagram's Shapes gains the group; its name and tagline               |
| `apps/editor/components/palette/BpmnMenuSection.tsx`                                     | Tools > BPMN                                                         |
| `apps/editor/lib/draw-mode.ts`, `draw-commit.ts`, `app/document/[id]/useArrowConnect.ts` | The arrow intent's `flow` and its look                               |
| `packages/templates/src/template-builders-bpmn.ts`                                       | The BPMN Process template                                            |
| `packages/agent-verbs/src/mcp/schema.ts`                                                 | The agents' element docs                                             |

## Domain and naming

| Term   | Identifier                                              | Meaning                                                      |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------ |
| Symbol | `BpmnSymbol`, `BPMN_SYMBOLS`                            | The 28 marks                                                 |
| Family | `BpmnFamily = 'event' \| 'task' \| 'gateway' \| 'data'` | `bpmnFamilyOf`, `BPMN_FAMILY_SYMBOLS`                        |
| Kind   | `bpmnKindOf`                                            | circle, square, diamond, document (object), cylinder (store) |
| Flow   | `BpmnFlow = 'message' \| 'association'`                 | `BPMN_FLOW_LOOKS`; the sequence flow is the default arrow    |
| Pool   | `BPMN_POOL_FIELDS` on a `lane`                          | 640 × 200, upright title, 40 px gutter                       |

Banned: "BPMN shape kind" (there is none), "swimlane" for a pool in code.

## Behaviour and state

- **Read.** `bpmnSymbolOf(el)` returns the symbol only when `isBpmnSymbol(el.bpmn)` and `bpmnKindOf(symbol) === el.shape`.
  Everything that draws or edits a mark reads it through this; a mark on the wrong kind is inert.
- **Place.** A tile's `{ type: 'shape', kind, variant }` runs `applyShapeVariant`; `applyBpmnVariant` maps `bpmn-start`,
  `-intermediate`, `-end`, `-task`, `-user-task`, `-subprocess`, `-exclusive`, `-parallel`, `-inclusive`,
  `-data-object`, `-data-store` to `bpmnFields(symbol)` (the mark, `bpmnSize`, `label: ''`, tasks `borderRadius: 'md'`)
  and `bpmn-pool` on a lane to `BPMN_POOL_FIELDS`; anything else (or another kind) returns null for the next variant
  table. `Object.hasOwn` guards the lookup.
- **Change.** `withBpmnSymbol(el, symbol)` changes only a BPMN element of the same family, setting the kind to
  `bpmnKindOf(symbol)` (object to store switches document and cylinder). The menu commits it through the generic
  element style ops (`ops.commit`, telemetry type `Bpmn`, one history step over the selection; hover previews with
  `ops.preview` / `ops.end`).
- **Flows.** The Message Flow and Association tiles' action is `{ type: 'arrow', flow }`. `addArrow(ends, flow)` either
  arms `beginDraw({ type: 'arrow', ends, flow })` or, with a shape selected, sets `connectFlow` so `connectArrowTo`
  spreads `BPMN_FLOW_LOOKS[flow]` onto the pinned arrow. `buildDrawnArrow` spreads the look after the remembered
  style. A tile is pressed when the armed intent's `flow` equals its own (`undefined` for Arrow and Line).
- **Mark.** `bpmnMarkParts(symbol, w, h)` returns `BpmnMarkPart[]` in element px: events centre their markers at half
  the smaller side, task markers in an 18 px cell at (6, 6), the sub-process's 14 px box centred on the bottom edge,
  gateway markers centred at about half the width. Paints: `line`, `solid` (the face), `ink` (the line colour as a
  fill), `knock` (a stroke in the face colour). The face is the fill, white when transparent (`bpmnMarkFace`).

## Interfaces and contracts

- `ShapeElement.bpmn?: BpmnSymbol`, validated by `SHAPE_FIELD_CHECKS` with `oneOfRule(BPMN_SYMBOLS)`; the OpenAPI schema
  is regenerated (`gen:openapi`).
- `PaletteTileSection` gains `'bpmn'`; the arrow tile action gains `flow?: BpmnFlow`; `PendingDraw`'s arrow intent and
  `onAddArrow` / `addArrow` gain the same optional argument.
- `ElementStyleOps` carries the menu's write; no new setter is threaded through the editor state.

## Data and persistence

One optional field on a shape, persisted as written; absent for every shape drawn before. No migration: an unknown
value is refused on write, and an old reader draws the plain kind.

## Errors and edge cases

- A mark on the wrong kind: not drawn, not offered in the menu (`bpmnSymbolOf` undefined).
- A transparent or `none` fill: the mark's face is white so a filled marker still reads.
- The Shapes category's divider budget: the BPMN group is one group (no inner dividers), named by its first tile
  (`'bpmn:start-event': 'BPMN'`), so every group stays titled.

## Security and trust

Nothing is parsed or rendered from user text beyond existing label paths. The SVG export escapes colours (`xmlEscape`);
path data is numbers this module writes.

## Performance and limits

The mark is a memoised layer of at most six paths per element, recomputed only when the symbol or size changes; no
per-frame work. The export adds the same paths per BPMN element. The data object's geometry is a constant.

## Presentation and UX

Tiles, captions and blurbs as in `bpmn-tiles.tsx`; the group heads "BPMN"; Diagram's Shapes tagline reads "The basics,
the flowchart vocabulary, BPMN and more." and Workshop keeps its own. The menu section is "BPMN", its grid titled by
family ("Event", "Task", "Gateway", "Data"), each tile's tooltip the symbol's `BPMN_SYMBOL_LABELS` name.

## Accessibility

Tiles and menu buttons carry their names (`label`); previews are `aria-hidden` Glyphs in `currentColor`, so they follow
the theme's contrast. Nothing animates.

## Observability

Placing a tile reports `Element·Added` with the kind's type; a symbol change `Element·Changed·Bpmn`.

## Testing

`packages/document/src/bpmn.test.ts`: vocabulary, kinds, sizes, the variant chain, the change rule, flows, mark
geometry finite for every symbol, export markup, validation. Template kind lists and preview bounds cover the template.

## Constants and configuration

Sizes (event 48, gateway 56, task 128 × 80, object 44 × 56, store 60 × 56), the pool (640 × 200, gutter 40) and the
task marker cell (18 px) live in `bpmn.ts`.

## Defaults ledger

None beyond the spec.
