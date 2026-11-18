# BPMN import: blueprint

Derived from [BPMN import](../bpmn-import.md) and the BPMN stencils section of [draw.io import](../drawio-import.md).

| File                                                                 | Role                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/editor/lib/bpmn/limits.ts`                                     | Caps, the picker filter, the name box, the gutter              |
| `apps/editor/lib/bpmn/read.ts`                                       | `readBpmn`: inert parse, the walk, `BpmnRefused`, the messages |
| `apps/editor/lib/bpmn/convert.ts`                                    | `mapNode`, `convertBpmn`: shapes, names, flows, the tally      |
| `apps/editor/lib/bpmn/import.ts`                                     | `importBpmn`, `bpmnImportOutcome` (the report)                 |
| `apps/editor/hooks/persistence/useTabImport.ts`                      | The `bpmn` format: lazy import, one replace, telemetry         |
| `apps/editor/components/dialogs/ImportTabDialog.tsx`                 | The BPMN card and its file icon label                          |
| `apps/editor/lib/drawio/bpmn-stencils.ts`                            | `bpmnStencil`: draw.io's BPMN shapes to symbols                |
| `apps/editor/lib/drawio/shapes.ts`, `vertices.ts`, `convert-page.ts` | The classifier, the mark on the shape, the name caption        |

## Domain and naming

| Term     | Identifier                     | Meaning                                                          |
| -------- | ------------------------------ | ---------------------------------------------------------------- |
| Node     | `BpmnNode`                     | A semantic element: id, local name, name, definitions, refs      |
| DI shape | `DiShape`                      | A `BPMNShape`: its element, bounds, label bounds, flags, colours |
| DI edge  | `DiEdge`                       | A `BPMNEdge`: its element, waypoints, stroke                     |
| Tally    | `BpmnTally`                    | What the report counts                                           |
| Refusal  | `BpmnRefused`, `BPMN_REFUSALS` | A message shown in the dialog                                    |

## Behaviour and state

1. **Read** (`readBpmn`): refuse over `BPMN_MAX_FILE_BYTES` characters; strip a BOM; refuse text not starting `<`;
   `parseInert(text, 'application/xml')`; refuse on `parsererror` (not XML) or a root whose `localName` is not
   `definitions` (not BPMN); refuse when `getElementsByTagName('*').length > BPMN_MAX_XML_ELEMENTS`. One pass over
   every element: count `BPMNDiagram`s (keep the first), record `categoryValue` values, skip DI types, record every
   other element with an id as a `BpmnNode` (`textAnnotation` takes its `text` child; refs from the attribute, else
   the child element; the parent's id; `associationDirection`; `categoryValueRef`). Then one pass over the first
   diagram: `BPMNShape` (bounds, `BPMNLabel` bounds when positive, `isExpanded`, `isMarkerVisible`, `isHorizontal`,
   colours by attribute local name `background-color` / `fill` and `border-color` / `stroke`, hex only) and
   `BPMNEdge` (waypoints, stroke). No shape: refuse (no diagram).
2. **Map** (`mapNode`): the spec's table. Events take the first event definition; a marker whose `${base}-${marker}`
   is not a symbol falls back to the base, approximated. Collapsed `callActivity`, `adHocSubProcess`, `transaction`
   are the sub-process, approximated; any of them expanded is a frame, approximated. No node, or an unknown type:
   unmatched.
3. **Draw** (`convertBpmn`): shapes in DI order up to `BPMN_MAX_DRAWN`, then edges with the remaining budget; past it,
   `leftOut`. A symbol is `createShape(kind)` + `bpmnFields` + the bounds; a task's or sub-process's name is its label,
   any other symbol's name a text in the label bounds or a 120 × 20 box 4 px under it. Pools and lanes: lanes, upright
   with a 30 px gutter when horizontal, else titled across the top (counted). Groups: dashed frames titled by their
   category value. Annotations: text. Unmatched: a square labelled with the name or the type (counted by type).
   Paint order: lanes, frames, symbols (stable), then lines, then names.
4. **Flows**: ends from the refs (a data input association ends on its parent activity, a data output association
   starts there). A drawn end pins at `nearestAnchor` on the side its first or last segment leaves through, with
   `exactStart` / `exactEnd`; an undrawn end is free at its waypoint. `simplifyRoute`, `snapRouteEnds` (orthogonal when
   every segment is axis aligned) and `routeShape(points, false)` give the style and bend points. Looks: message flow
   `BPMN_FLOW_LOOKS.message`; association dotted, with a line head at the end (`One`) or both ends (`Both`); data
   associations dotted with a line head at the end. A sequence flow keeps its name as the label. Fewer than two
   waypoints: skipped, counted.
5. **Land**: `replaceActiveTabContent` with the active tab's id, name and theme; `track('Tab', 'Imported', 'Bpmn')`;
   `bpmnImportOutcome` returns `{ status: 'done' }` when nothing changed, else the shared report with the spec's
   subtitle.

## draw.io stencils

`bpmnStencil(name, style)` runs before the SHAPES table. `mxgraph.bpmn.event`: `outline` (standard, eventInt,
eventNonint: start; catching, throwing, boundInt, boundNonint: intermediate; end: end; anything else start,
approximated) and `symbol` (`general` plain; a symbol that is not a BPMN symbol for its base falls back, approximated).
`mxgraph.bpmn.task` / `task2`: `isLoopSub=1` the sub-process, else `taskMarker`. `mxgraph.bpmn.gateway2`: `gwType`.
`mxgraph.bpmn.shape`: a rhombus perimeter reads `symbol` as a gateway, an ellipse perimeter as an event, anything else
a task, approximated. `mxgraph.bpmn.data` / `data2`: the data object. `datastore`: the data store. The shape builder adds
`bpmn`; an event's, gateway's or data element's outside label (`labelSitsOutside`) leaves the shape unlabelled and
`convert-page` places it with `buildImageCaption`.

## Errors and edge cases

Every refusal is a `BpmnRefused` with its message, returned as `{ ok: false, error }`; any other error propagates. The
file picker refuses a file over 5 MB unread with the same message. Non-finite numbers read as 0.

## Security and trust

Untrusted XML goes only through `parseInert` (trusted types; no external entities resolved, nothing rendered). Only
named attributes and child text are read; names become element labels, rendered as text. Colours pass a hex check
(`/^#[0-9a-f]{3,8}$/i`, no nested repeats). Caps bound the parse and the walk.

## Performance and limits

Linear: one `getElementsByTagName('*')` pass, one pass over the diagram, maps by id for every lookup, one pass per
edge. The worst case the caps allow (2,000 drawn tasks plus their flows, about 8,000 XML elements) is pinned by a
CPU-time test (`cpuMsOf`, `cpuBudgetMs(1500)`). The module loads only when the BPMN card is used.

## Presentation and UX

The card's copy and placeholder as in the spec; the file icon label `bpmn`; the picker's filter `BPMN_FILE_ACCEPT`.

## Accessibility

The card is the shared format card; nothing new.

## Observability

`Tab·Imported·Bpmn`; `debugLog('[bpmn-import]', { shapes, lines, approximated, leftOut })`.

## Testing

`apps/editor/lib/bpmn/import.test.ts` (jsdom): the mapping, colours, names, lanes, approximations, frames, flows and
their ends, refusals, inert names, the report, and the CPU-time worst case. `apps/editor/lib/drawio/bpmn-stencils.test.ts`:
every stencil row, the approximations, and an event's name as a caption.

## Constants and configuration

`BPMN_MAX_FILE_BYTES` 5 MiB, `BPMN_MAX_XML_ELEMENTS` 100,000, `BPMN_MAX_DRAWN` 2,000, `BPMN_LANE_GUTTER_PX` 30,
`BPMN_NAME_WIDTH_PX` 120, `BPMN_NAME_HEIGHT_PX` 20, `BPMN_REPORT_NAMES_MAX` 5.

## Defaults ledger

None beyond the spec.
