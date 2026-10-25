# Flowchart: blueprint

**Status in liveplanner: editing removed (2026-10-24).** No Plan tab holds flowcharts ([Plan mode](../../026-plan/plan-mode.md)), so growth (Add Step / Add Branch), the step toolbar, the Flowchart menu, lanes and the re-layout on every commit are gone, with their wiring in `useEditorState`. The element kind stays in `packages/project` for the file format; this spec describes livediagram's behaviour.

Derived from [The flowchart](../flowchart.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                       | Role                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/project/src/flowchart.ts`                       | Step types, sizes, membership, edges, anchor, lanes, direction, `decisionExitLabel`, `createFlowchartStart`                    |
| `packages/project/src/flowchart-layout.ts`                | `layoutFlowchart`, `applyFlowchartLayout`: the unlaned and laned layouts                                                       |
| `packages/project/src/flowchart-spread.ts`                | `spreadDecisionExits`, `FLOWCHART_CORNER_CLEARANCE`: a Decision's steps beyond its corners                                     |
| `packages/project/src/flowchart-grow.ts`                  | `planFlowchartStep`, `retypeFlowchartStep`, `setFlowchartDirection`, `addFlowchartLane`, `moveStepToLane`, `relayoutFlowchart` |
| `packages/project/src/auto-layout.ts`                     | `autoLayoutElements` takes `fixedSizeIds` (the layered positioning with sizes kept); exports `layerComponent`                  |
| `packages/project/src/element-types.ts`                   | `flowchartId`, `flowDirection`, `flowLaneId` on `ShapeElement`                                                                 |
| `packages/project/src/element-fields.ts`                  | The three fields in the shape's field list                                                                                     |
| `packages/project/src/validate-shape.ts`                  | The three fields validated                                                                                                     |
| `packages/project/src/duplicate.ts`                       | Copies remap the three ids                                                                                                     |
| `packages/project/src/participant-content.ts`             | A Participant's growth may move the chart's steps, connectors and lanes                                                        |
| useFlowchartGrowth.ts        | Tab / Enter / toolbar / ring growth, Escape removal, one commit each                                                           |
| useGrowthLanding.ts          | Shared with mind growth: reveal, typed-ahead landing, Escape on an empty grown node                                            |
| useFlowchartSetters.ts            | Step type, direction, Add Lane, lane move, Tidy Flowchart from the menu and toolbar                                            |
| flowchart-dress.ts                         | `dressFlowchartStep`, `dressFlowchartConnector`: the look a new step and connector take                                        |
| `apps/editor/components/palette/palette-tile-defs.tsx`       | `tools:flowchart` tile (component action `flowchart`)                                                                          |
| `apps/editor/components/canvas/SelectionPopover.tsx`         | Add Step, Add Branch, Step Type, Lane                                                                                          |
| `apps/editor/components/canvas/quick-connect-options.tsx`    | The ring's Add Step and Add Branch                                                                                             |
| FlowchartMenuSections.tsx | The Flowchart flyout row: Chart, Step Type and Direction categories                                                            |

## Domain and naming

| Term       | Identifier                         | Meaning                                                                                                       |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Flowchart  | `flowchartId`                      | The chart; the id of its first step                                                                           |
| Step       | `FlowchartStep` (a `ShapeElement`) | A shape of a step-type kind carrying `flowchartId`                                                            |
| Step type  | `FlowchartStepType`                | `'terminator' \| 'process' \| 'decision' \| 'io' \| 'project' \| 'database' \| 'preparation' \| 'connector'` |
| First step | `flowchartAnchor`                  | The step that never moves                                                                                     |
| Connector  | an `ArrowElement`                  | A pinned arrow between two steps of one chart                                                                 |
| Exit       | an outgoing connector              | Of a Decision: labelled Yes / No                                                                              |
| Lane       | a `lane` shape with `flowchartId`  | A chart's swimlane                                                                                            |
| Direction  | `FlowchartDirection`               | `'down' \| 'right'`                                                                                           |

Banned synonyms: "node" for a step (a mind node is a different element), "swimlane" in code (it is a
lane), "orientation" for direction.

`FLOWCHART_STEP_KIND: Record<FlowchartStepType, ShapeKind>`: terminator `stadium`, process `square`,
decision `diamond`, io `parallelogram`, project `project`, database `cylinder`, preparation
`hexagon`, connector `circle`. `flowchartStepTypeOf(kind)` is its inverse; `undefined` for any other
kind.

## Behaviour and state

### Membership

- `isFlowchartStep(el)`: `el.type === 'shape'`, `flowchartId` is a non-empty string, and the kind is a
  step-type kind.
- `isFlowchartLane(el)`: shape of kind `lane` with a `flowchartId`.
- `flowchartSteps(elements, id)` and `flowchartLanes(elements, id)`: in array order.
- `flowchartConnectors(elements, id)`: arrows whose `from` and `to` are both pinned to steps of `id`,
  `from !== to`.

### Anchor

`flowchartAnchor(steps, id)`: the step whose id equals `id`, else the step with the smallest `(y, x)`
of its top-left. Never null for a non-empty chart.

### Direction

`flowchartDirectionOf(elements, id)`: the anchor's `flowDirection`, else the first step's that has
one, else `'right'` when the chart has a lane, else `'down'`. `'down'` maps to the layered layout's
`'TB'`, `'right'` to `'LR'`.

### Layout (`layoutFlowchart(elements, id, opts?)`)

Input: the elements, the chart id, optional `{ direction }` override. Output `FlowchartLayout`:
`{ steps: Map<ElementId, {x, y}>; lanes: Map<ElementId, {x, y, width, height, textAlignX, textAlignY}>;
connectors: ArrowElement[] }`, holding only what changes.

1. Gather steps, lanes and connectors. Locked steps (`locked`, or the caller's `lockedIds`) are not
   graph nodes and keep their place; connectors touching them are not edges.
2. Edges: `{from, to}` per connector, in array order, de-duplicated.
3. **Unlaned** (no lanes):
   - `autoLayoutElements(steps + forward connectors, { style: 'flow', direction, fixedSizeIds })` from
     auto-layout.ts: the layered layout of the connected steps with every size kept. Components side by side as Auto Layout does.
   - Translate so the anchor keeps its top-left. If the anchor has no connector, translate so the
     connected block's earliest step (smallest `(y, x)` before layout) keeps its top-left instead.
   - Unconnected steps other than the anchor: stacked after the block along the cross axis, starting
     `COMPONENT_GAP` past it, aligned to the block's main-axis start, gap `SIBLING_GAP`, in `(y, x)`
     order.
   - Spread (`spreadDecisionExits`, flowchart-spread.ts), on the connected block after the translate.
     Decisions in rank order (main-axis centre, then cross). For each `diamond` step with two or more
     forward exits to movable steps, the targets in cross-centre order: the first must have its cross
     centre at most `corner₁ − FLOWCHART_CORNER_CLEARANCE`, the last at least
     `corner₂ + FLOWCHART_CORNER_CLEARANCE`, where `corner₁ / corner₂` are the Decision's cross
     centre ∓ half its cross size. The moved set of a target: it and every step reachable from it
     along forward edges that is not reachable from the Decision's other exits. The set shifts along
     the cross axis by the shortfall; the shift is skipped when the set holds the reference step or
     a step not in the layout, or when any moved step would then overlap (or come within
     `SIBLING_GAP` of) a step outside the set. Later Decisions see earlier shifts.
4. **Laned**:
   - Lanes ordered by their current cross position (`y` for rows, `x` for columns; a lane is a row when
     `width >= height`).
   - Each step's lane: its `flowLaneId` if that lane is in the chart, else the first lane.
   - Ranks: `layerComponent(stepIds, edges)` (longest path, back edges ignored).
   - Rank main size: the largest step main size in the rank across all lanes. Rank `r` starts at
     `gutter + FLOWCHART_LANE_PAD + Σ (size(r') + LAYER_GAP)` for `r' < r`, where `gutter` is
     `LANE_GUTTER_PX` for rows and `LANE_BAND_PX` for columns.
   - Within lane `l` and rank `r`: the steps in current cross-centre order, packed with `SIBLING_GAP`.
   - Lane thickness: `max(FLOWCHART_LANE_MIN, max_r(stack(l, r)) + 2 × FLOWCHART_LANE_PAD)`. Lanes
     flush, each starting where the previous ends.
   - Step cross position: lane start + `(thickness − stack) / 2` + offset in the stack. Main
     position: rank start + `(rank size − step main size) / 2`.
   - Lane length: `gutter + 2 × FLOWCHART_LANE_PAD + Σ rank sizes + LAYER_GAP × (ranks − 1)`
     (at least `FLOWCHART_LANE_MIN_LENGTH`).
   - A lane whose title edge suits the direction (`laneEdgeOfElement`: `left` / `right` for rows,
     `top` / `bottom` for columns) keeps its alignment; any other is set to rows `left` / `middle`,
     columns `center` / `top`.
   - Translate steps and lanes together so the anchor keeps its top-left.
5. Connectors: `reanchorArrow` against the final centres with the layered direction. A Decision's
   exit whose step lies beyond a side corner (cross distance greater than half the Decision's cross
   size) leaves by that corner. When two exits of one Decision would leave by the same side corner,
   the one whose step is further along the flow (main-axis centre, ties kept by the earlier exit in drawing order) keeps the
   flow's face and is routed as any other connector (`orthogonalBends`, or its channel).

Positions are rounded to whole pixels (memory: fit lands on whole pixels).

### Growth (`planFlowchartStep(elements, fromId, kind, ids, type = 'process')`)

- `kind: 'next' | 'parallel'`. The source is `from` for `'next'`; for `'parallel'` it is the source of
  the first connector (array order) into `from`, else `from` itself (a step nothing leads to grows
  its next step instead).
- The new step: `createShape(FLOWCHART_STEP_KIND[type])`, sized `FLOWCHART_STEP_SIZE[type]`, id
  `ids.step`, `flowchartId` of `from`, `flowDirection` of `from` when set, `flowLaneId` of `from` when
  set, label empty.
- Seed position, which decides its order in its rank: one rank past the source on the main axis, and
  just past the source's furthest existing successor (by cross centre) on the cross axis, else
  aligned with the source.
- The connector: `createPinnedArrow(source, 's', step, 'n')` (faces are re-chosen by the layout),
  id `ids.connector`, `arrowStyle: 'angled'`, `label: decisionExitLabel(elements, source)` when
  defined.
- The plan: `{ step, connector, layout }`, `layout` computed on `elements + step + connector`.
- `decisionExitLabel(elements, sourceId)`: `undefined` unless the source is a `diamond` step; `'Yes'`
  if no exit's label equals `Yes` (trimmed, case-insensitive), else `'No'` if none equals `No`, else
  `undefined`.

### Other changes

- `retypeFlowchartStep(elements, stepId, type)`: the step with the type's kind and size, centred on
  its old centre, then the layout.
- `setFlowchartDirection(elements, id, direction)`: every step's `flowDirection`, then the layout in
  that direction.
- `addFlowchartLane(elements, id, laneIds)`: unlaned: two lanes `Lane 1`, `Lane 2` and every step's
  `flowLaneId` set to the first; laned: one lane `Lane <n+1>` at the end (cross position past the
  last). Then the layout.
- `moveStepToLane(elements, stepId, laneId)`: `flowLaneId`, then the layout.
- `relayoutFlowchart(elements, id)`: the layout as is (Tidy Flowchart, and after any structural change
  the editor detects).
- `applyFlowchartLayout(elements, layout)`: patches position on steps, geometry and title alignment on
  lanes, anchors on connectors; nothing else.

### When the editor lays out again

After any commit in which, for a chart present before or after: a step was added or removed, a step's
kind changed, a connector of the chart was added or removed, or a lane of the chart was added or
removed, `useFlowchartGrowth` / the setters already lay it out in the same commit. For changes made by
the generic paths (drawing an arrow, deleting, dragging into a lane), `flowchartStructureChanged(before,
after)` lists the affected chart ids and the commit path runs `relayoutFlowchart` for each, inside the
same commit (D171).

A drag that ends with a step's centre inside another lane of its chart sets `flowLaneId` to that lane
in the drag's commit, then lays out.

## Interfaces and contracts

```ts
flowchartId?: string;               // non-empty
flowDirection?: 'down' | 'right';
flowLaneId?: ElementId;             // non-empty
```

Validation rejects: `flowchartId` not a non-empty string (`'a flowchart id'`), `flowDirection` not one
of the two (`'a flowchart direction'`), `flowLaneId` not a non-empty string (`'an element id'`). A
`flowLaneId` naming a missing lane is legal: the step reads as in the first lane.

## Data and persistence

The three fields are project data, persisted and synced as ordinary element fields. No migration:
absent fields mean "not a step". Duplicating steps (D172) makes **a new chart**: each source
`flowchartId` maps to one fresh id, the copy of the source's anchor when it was copied, else the
first copied step's new id; `flowLaneId` is remapped when the lane was copied and removed otherwise.

## Errors and edge cases

- Cycle: ranks ignore back edges; the loop's connector runs back up the chart.
- Self-loop arrow: not an edge.
- Arrow between two charts: not an edge of either.
- Step with a kind that is no longer a step-type kind (changed outside the chart menu): not a step;
  it is laid out by nobody.
- Empty chart (every step deleted): lanes stay as they are; nothing to lay out.
- All steps locked: no moves.
- Anchor locked: it does not move by definition; the rest translate to it.

## Security and trust

No new trust boundary. A Participant's growth is a set of element changes the server applies one by
one; `participant-content.ts` admits moves of steps, lanes and connector re-anchors in a chart the
Participant grows, as it does for mind maps.

## Performance and limits

Layout is O(V + E) for ranking plus the layered layout's crossing reduction (bounded sweeps). Run on
each structural change, never per frame. Budget: a 200-step, 260-connector chart lays out in under
50 ms on CI (test guards it).

## Presentation and UX

- Toolbar buttons (Title Case): **Add Step** (Tab), **Add Branch** (Enter), **Step Type** (menu of
  the eight types), **Lane** (menu of lane titles; only on a laned chart).
- Flowchart menu: a `MenuFlyoutSection` row titled "Flowchart" (`flyoutProps('flowchart')`) holding
  three closed `MenuAccordionSection` categories: **Chart** (`flowchart-chart`: Add Lane, Tidy
  Flowchart), **Step Type** (`flowchart-step-type`, steps only: the eight types) and **Direction**
  (`flowchart-direction`: Down, Right), each an `OptionRows` list.
- Palette tile: caption "Flowchart", label "Add Flowchart", blurb "Tab adds the next step".

## Testing

Each rule above maps to a test in `flowchart.test.ts`, `flowchart-layout.test.ts`,
`flowchart-grow.test.ts`, the hook's test, and the templates' tests.

## Constants and configuration

| Constant                                    | Value       | Provenance                                            |
| ------------------------------------------- | ----------- | ----------------------------------------------------- |
| `FLOWCHART_STEP_SIZE`                       | spec        | The spec's step type table                            |
| `FLOWCHART_LANE_PAD`                        | 32          | Clear of the lane's border at every zoom (D169)       |
| `FLOWCHART_LANE_MIN`                        | 200         | The lane's default height (`SHAPE_DEFAULT_SIZE.lane`) |
| `FLOWCHART_LANE_MIN_LENGTH`                 | 600         | A lane shorter than this reads as a box (D170)        |
| `FLOWCHART_LOOP_GAP`                        | 40          | Clear of the steps a loop passes (D174)               |
| `FLOWCHART_CORNER_CLEARANCE`                | 32          | A corner exit's first leg stays visible (D175)        |
| `LAYER_GAP`, `SIBLING_GAP`, `COMPONENT_GAP` | 90, 56, 120 | Shared with Auto Layout                               |

## Defaults ledger

D169 to D175 in [DEFAULTS.md](DEFAULTS.md).
