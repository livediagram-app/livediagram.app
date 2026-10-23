# Sankey diagram: blueprint

Derived from [Sankey diagram](../sankey.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                              | Role                                                                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/sankey-model.ts`                                           | Types, option lists, bounds, `SANKEY_DEFAULT_FLOWS`, `sankeyGraph`, name/number formatting, node-style edits    |
| `packages/document/src/sankey-layout.ts`                                          | `sankeyLayout`: columns, scale, relaxation, band stacking, `sankeyBandPath`, `sankeyCentrePath`                 |
| `packages/document/src/sankey-frame.ts`                                           | `sankeyFrame`: colours, band paint, labels and their collisions, summary, readouts                              |
| `packages/document/src/sankey-text.ts`                                            | `parseSankeyText`, `sankeyFlowsToText`, `readSankeyNumber`                                                      |
| `packages/document/src/svg-render-sankey.ts`                                      | `svgSankey`: the export                                                                                         |
| `packages/document/src/shape-kind.ts`, `validate.ts`                              | `'sankey'` in `ShapeKind` and `SHAPE_KINDS`                                                                     |
| `packages/document/src/validate-shape.ts`                                         | Field checks                                                                                                    |
| `packages/document/src/element-normalise.ts`                                      | `normaliseSankey`: agent input                                                                                  |
| `packages/document/src/shape-factory.ts`                                          | Default size and starter flows                                                                                  |
| `packages/document/src/data-shapes.ts`                                            | `isSelfDrawingShape` membership, `takesChartPalette`                                                            |
| `packages/document/src/animation-membership.ts`                                   | Sankey owns its animation set                                                                                   |
| `packages/document/src/colors.ts`                                                 | `SELF_PAINTING_SHAPES` member                                                                                   |
| `apps/editor/components/canvas/SankeyView.tsx`                                    | Canvas view (lazy chunk), hover, animations                                                                     |
| `apps/editor/components/palette/SankeyMenuSection.tsx`                            | The Sankey flyout: Flows, Bands, Layout, Labels, Leftovers, Text sections                                       |
| `apps/editor/components/dialogs/SankeyFlowsDialog.tsx`                            | Flows dialog shell, tabs, preview, import                                                                       |
| `apps/editor/components/dialogs/SankeyFlowsTable.tsx`                             | Table tab: steps, node groups, Add a Flow area, leftover switches                                               |
| `apps/editor/components/dialogs/SankeyFlowRow.tsx`                                | One row: → To, Amount, Send On, remove (a loose row adds its From)                                              |
| `apps/editor/lib/sankey-flow-levels.ts`                                           | `flowLevels` (rows into steps and node groups), `flowTotals`, `flowNodeColors`                                  |
| `apps/editor/components/palette/sankey-menu-glyphs.tsx`                           | The Display option glyphs (on the raw-SVG art allowlist)                                                        |
| `apps/editor/components/dialogs/SankeyNodeStrip.tsx`                              | Node chips and rename                                                                                           |
| `apps/editor/components/tour/SankeyFlowsTour.tsx`, `sankey-flows-tour-steps.ts`   | Show Me on the Flows dialog: button, stage, steps fixed at the press                                            |
| `apps/editor/components/tour/sankey-element-tour-steps.ts`, `ElementTourHost.tsx` | The Sankey element tour ([Element tours](../../007-editor/element-tours.md)): steps, the parts lifted, the host |
| `apps/editor/lib/sankey-tour-focus.ts`, `sankey-flows-dialog-handle.ts`           | The band or node a tour step lifts (`data-sankey-band` / `data-sankey-node`); the open dialog's tab switches    |
| `apps/editor/lib/sankey-flow-rows.ts`                                             | Draft rows, reasons copy, balance notes, paste, `rowFrom`, `withTrailingBlank`                                  |
| `apps/editor/lib/sankey-edit.ts`                                                  | `canEditSankey`                                                                                                 |
| `apps/editor/hooks/canvas/useSankeySetters.ts`                                    | `setSankeyFlows`, `setSankeyNodeColorSelected`, `setSankeyOptionSelected`                                       |
| `apps/editor/app/canvas-motion.css`                                               | `lvd-sankey-grow`, `-flow`, `-cascade`, `-pulse`, `-rise`                                                       |
| `apps/editor/components/palette/palette-tile-defs.tsx`                            | Tile `tools:sankey`, section `build`                                                                            |

## Domain and naming

| Term        | Identifier                                      | Meaning                                                              |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Sankey      | `shape: 'sankey'`, `isSankeyShape`              | The element kind; "Sankey Diagram" in `elementKindLabel`             |
| Flow        | `SankeyFlow = { from, to, value }`              | One stored row                                                       |
| Node        | `SankeyGraphNode`, `SankeyNodeBox`              | A distinct cleaned name; drawn as a bar                              |
| Band        | `SankeyLinkBand`                                | A drawn flow                                                         |
| Column      | `SankeyNodeBox.column`                          | A node's step                                                        |
| Set aside   | `SankeySkipReason`                              | A flow not drawn: `empty-name`, `self`, `value`, `loop`, `too-many`  |
| Node style  | `SankeyNodeStyle = { name, color?, leftover? }` | A recoloured node, or one whose leftover is switched off             |
| Leftover    | `sankeyDrawnFlows`, `frame.leftover(band)`      | A drawn, never stored, flow of what a middle node keeps              |
| Step        | `FlowLevel`, `sankeyColumns(graph, 'left')`     | A column of the Flows table, as By Step lays it out                  |
| Add a Flow  | `FlowLevels.loose`, `withTrailingBlank`         | The table's area of rows with no group yet, and its blank line       |
| Band colour | `SankeyLinkColor`                               | `gradient` (Blend), `source` (From), `target` (To), `neutral` (Grey) |
| Layout      | `SankeyAlign`                                   | `justify` (Ends Right), `left` (By Step)                             |
| Labels      | `SankeyValueLabel`                              | `value` (Amount), `percent`, `none` (Names Only)                     |
| Readout     | `sankeyBandReadout`, `sankeyNodeReadout`        | The hover box (not a "tooltip")                                      |

Banned synonyms: "link" in copy (say flow or band), "edge", "series".

## Behaviour and state

1. **Create.** `createShape('sankey')`: 560 × 300 (`D155`), `sankeyFlows` a copy of `SANKEY_DEFAULT_FLOWS` (`D154`).
2. **Graph** (`sankeyGraph`): for each flow in order: index ≥ 200 → `too-many`; cleaned name empty → `empty-name`;
   from = to → `self`; value not finite or ≤ 0 → `value`; adding its new names would pass 120 nodes →
   `too-many`; else a candidate. An iterative DFS from nodes in first-appearance order marks an edge into a node
   on the stack as `loop`. Nodes with no drawn flow are dropped and the rest renumbered.
3. **Columns.** Longest path from a source (Kahn order). `justify`: nodes with no outgoing go to the last column.
4. **Scale.** `pad = clamp(area.h * 0.3 / (fullest - 1), 4, 18)` (`D159`); `ky = min over columns of
(area.h - (n - 1) * pad) / Σ value`. Node height `max(1, value * ky)`; band width `max(1, value * ky)`.
5. **Relaxation** (`D160`): columns start in first-appearance order, centred; 6 sweeps, `alpha = 0.99^sweep`.
   Left to right, a node moves toward `Σ level * w / Σ w` with `level = y0[src] + offset(band in src's
outgoing) - offset(band in node's incoming)` and `w = value * column span`; right to left symmetrically.
   After each column, collisions resolve top-down then bottom-up, and the bands of the moved columns re-sort.
6. **Stacking.** A node's outgoing bands sort by target y0, incoming by source y0; each side's bands are
   centred against the node when shorter than it.
7. **Labels** (`sankeyFrame`): inward-facing (`x0` midpoint < w / 2 → right). Inline when node height
   < 2.4 × fontPx. Collisions: nodes by value desc; try as built, inline, name only; else `hidden`.
8. **Leftovers** (`sankeyDrawnFlows`): unless `sankeyLeftover === 'hide'`, for each node with inflow > 0,
   outflow > 0, `inflow - outflow > SANKEY_BALANCE_EPSILON`, not itself the leftover node and not switched off
   (`sankeyNodeLeftover`), append `{ from: node, to: leftoverName || 'Leftover', value: diff }` after the stored
   flows. `frame.leftover(b)` is `b.flow >= stored`; such bands, and a leftover node no stored flow names, paint
   `SANKEY_NEUTRAL_BAND`; `layout.skipped` keeps only stored rows.
9. **Table grouping** (`flowLevels(grouped, writing)`): rows with an empty cleaned From, or keyed in `writing`,
   are loose; the rest group by cleaned From in first-written order; a group's step is its node's
   `sankeyColumns(graph, 'left')` column (0 when not drawn). Only steps holding a group exist. `grouped` is
   replaced by the live rows when their key set changes (keeping the old loose keys in `writing`) and when focus
   leaves the table (clearing `writing`). The draft always ends in one blank row (`withTrailingBlank`, not past
   200 filled rows).
10. **Edits.** Dialog draft → `flowsToStore` (wholly blank rows dropped) → `setSankeyFlows(id, flows, nodes)`
    → `cleanSankeyFlows`, `pruneSankeyNodes` → one commit, `Element·Changed·SankeyFlows`. A store whose
    `[flows, nodes]` JSON equals the last is skipped.

Invariants: **I1** the same flows in the same box lay out identically; **I2** no node leaves the area;
**I3** nodes in a column never overlap; **I4** every band's width / value is the same `ky`.

## Interfaces and contracts

```ts
export function sankeyGraph(flows: readonly SankeyFlow[] | undefined): SankeyGraph;
export function sankeyLayout(flows, area: ChartRect, align?: SankeyAlign): SankeyLayout;
export function sankeyFrame(element: ShapeElement, palette?: readonly string[]): SankeyFrame;
export function parseSankeyText(text: string): { flows: SankeyFlow[]; unread: number[] };
export function svgSankey(el, textColor: string, palette?, fontFamily?): string;
export function canEditSankey(can: Pick<EditorCapabilities, 'level'>, el: Element): boolean;
```

Validation (`validate-shape.ts`) rejects the element, and so the tab, when `sankeyFlows` is not an array of at
most 200 `{ from, to, value }` (names strings ≤ 60, value finite with |value| ≤ 1e12); `sankeyNodes` not ≤ 120
`{ name ≤ 60, color? string ≤ 64 }`; an option not in its list; `sankeyUnit` > 8 characters; `sankeyAnimRepeat`
not a boolean. Agent input is normalised first (`source`/`target`, `amount`, text numbers, unknown options
dropped).

## Data and persistence

| Field                                                              | Class     | Notes                                                                          |
| ------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------ |
| `sankeyFlows`                                                      | persisted | Order is meaning (colours, tie-breaks, which loop flow hides)                  |
| `sankeyNodes`                                                      | persisted | Pruned to live names on every flows store                                      |
| `sankeyLinkColor`, `sankeyAlign`, `sankeyValueLabel`, `sankeyUnit` | persisted | Absent = default                                                               |
| `sankeyLeftover`, `sankeyLeftoverName`                             | persisted | Absent = show, `Leftover`; the setter stores the default name as absent        |
| `sankeyNodes[].leftover`                                           | persisted | Only `false` is stored; kept by colour edits and renames, pruned with the node |
| Leftover flows                                                     | derived   | Never stored; recomputed per frame                                             |
| `sankeyAnim`, `sankeyAnimSpeed`, `sankeyAnimRepeat`                | persisted | Absent = still                                                                 |
| Dialog draft, hover                                                | ephemeral |                                                                                |

No migration: a new kind.

## Errors and edge cases

| #   | Case                                                            | Handling                                                                                                                                          |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | No flows / all set aside                                        | Dashed outline, "No flows yet" (+ "Double-click to add flows" for an Editor) (`D168`)                                                             |
| E2  | Loop                                                            | The closing flow set aside, `loop` reason                                                                                                         |
| E3  | Value text not a number                                         | Stored as 0, `value` reason                                                                                                                       |
| E4  | Huge vs tiny flow                                               | Tiny band drawn 1px                                                                                                                               |
| E5  | Crowded labels                                                  | Collision pass hides; readout still names                                                                                                         |
| E6  | Paste past 200 rows                                             | Sliced to 200                                                                                                                                     |
| E7  | Text line unreadable                                            | Named in `unread`, nothing else lost                                                                                                              |
| E8  | Element deleted, locked or no longer editable while dialog open | The dialog closes (`useCloseVanishedDialogs`, with its own `canEditSankey` check), so an undo or an unlock that brings it back does not reopen it |
| E9  | Locked diagram                                                  | No menu sections, no dialog (`canEditSankey`)                                                                                                     |
| E10 | Leftover name equals a written node                             | Leftovers join that node, in its colour                                                                                                           |
| E11 | Leftover name equals the node keeping it                        | No leftover for that node (it would flow into itself)                                                                                             |
| E12 | 200 stored flows                                                | Leftovers fall past the cap and are set aside                                                                                                     |
| E13 | Overspending node (out > in)                                    | No leftover; listed in the balance notes                                                                                                          |
| E14 | A row's From typed in Add a Flow                                | Stays in Add a Flow until focus leaves the table                                                                                                  |

## Security and trust

Bounds above enforced at the api by `isValidTab`. Names are React text on canvas and `xmlEscape`d in export;
gradient ids are the element id with non-word characters replaced. A Participant's `applyParticipantOp` has no
`sankey*` field in its writable lists, and `addableOn` refuses a Sankey.

The text reader (`parseSankeyText`, `readSankeyNumber`) reads whatever is pasted, so it scans by index with no
backtracking pattern (CodeQL `js/polynomial-redos`), and a line past `SANKEY_LINE_MAX` (1,000 characters) is named
as unread without being scanned. A test bounds hostile 5,000-character lines at 50 ms in total.

## Performance and limits

Measured (Apple M-series, Node 22, vitest): `sankeyFrame` 0.07 ms for the starter budget, 0.58 ms for 200 flows
over 120 nodes; `svgSankey` 0.05 ms / 0.81 ms, 6.8 KB / 94 KB of markup; stored flows 314 B / 7.9 KB. The view
memoises the frame on its inputs, so a drag never re-lays it out. Worst-case Flow animation: 200 dashed strokes
animated on the compositor-unfriendly `stroke-dashoffset` (paint per frame), opt-in and off under reduced motion.
A regression test bounds the worst case at 16 ms per layout. Leftovers: `sankeyDrawnFlows` 0.04 ms at 200 flows;
`sankeyFrame` with them shown 1.34 ms vs 0.88 ms hidden (the 26 leftovers of that worst case sit past the cap).
The Flows table per keystroke at 200 rows: `flowLevels` 0.14 ms, `rowReasons` 0.06 ms, `balanceNotes` 0.08 ms;
`flowLevels` has a budget test. Cascade, Pulse and Rise animate opacity and transform only, staggered by a static
`--lvd-sk-col` (never an animated custom property).

## Presentation and UX

- Palette: tile `tools:sankey`, last in Concepts, blurb "Flows drawn as wide as the amount they carry".
- Band opacity 0.42 rest, 0.78 focus, 0.10 dim; unlit nodes 0.35; 150 ms ease-out (`D156`).
- Labels 10 / 12 / 15 px (`D158`), name semibold, detail at 0.92 size and 0.72 opacity; halo 3 px at 0.75.
- Dialog: size `3xl`; preview 300 px wide, 150–260 px tall (`D164`); final copy as in the spec.

## Accessibility

- The diagram's SVG is `role="img"` with `aria-label` = `sankeyFrame.summary`.
- Flows table cells carry `aria-label` "Flow n from / to / amount", `aria-invalid` and `aria-describedby` the
  reason; the tabs are a `tablist` with arrow keys; the Import control is a labelled file input.
- Node chips and rename input are labelled; Escape cancels a rename without closing the dialog.
- Every animation is `animation: none` under `prefers-reduced-motion`.
- The Table's steps are `section`s labelled by their `Step n` heading; each node group is a `group` named
  "Flows from <node>"; the leftover switch is a `role="switch"` named "Draw <amount> not sent on from <node> as
  <name>"; Send On is labelled "Send on from <node>" with a matching Tooltip; the Display pickers are radio groups
  (`OptionRows`, arrow keys move).

## Web Experience

`SankeyView` and the dialog are `next/dynamic` chunks loaded only when a Sankey is drawn or edited; nothing is
added to page load (LCP). Hover changes local state in one view (INP). The dialog is a modal and moves nothing
on the page (CLS).

## Observability

`track('Element', 'Added', 'Sankey')` on create; `Changed` with `SankeyFlows`, `SankeyStyle`, `SankeyAnim` on
edits; Show Me sends `UI` `Started` `SankeyFlowsTour` and `UI` `Ended` `SankeyFlowsTourCompleted` /
`SankeyFlowsTourSkipped` (all explained in `../liveworkspace/apps/site/app/telemetry/livedocuments/event-explanations.ts`). A refused write surfaces through the api's
generic `invalid tab` path.

## Testing

| Rule                                                              | Test                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Graph, set-aside reasons, caps, loops                             | `packages/document/src/sankey.test.ts`                                                                             |
| Columns, scale, stacking, no crossing, worst-case budget          | `sankey.test.ts`                                                                                                   |
| Text formats, round trip                                          | `sankey.test.ts`                                                                                                   |
| Labels, collisions, colours, readouts, summary                    | `packages/document/src/sankey-render.test.ts`                                                                      |
| Export, validation, agent input, node edits                       | `sankey-render.test.ts`                                                                                            |
| Every kind renders / validates / sizes                            | `svg-render-coverage`, `shape-factory`, `export-consistency` tests                                                 |
| Draft rows, reasons, balance, paste                               | `apps/editor/lib/sankey-flow-rows.test.ts`                                                                         |
| Steps, groups, `rowFrom`, colours, budget                         | `apps/editor/lib/sankey-flow-levels.test.ts`                                                                       |
| Table: steps, Send On, Add a Flow, Enter, paste, leftover switch  | `apps/editor/components/dialogs/SankeyFlowsTable.test.tsx`                                                         |
| Leftovers: drawn flows, paint, readout, merge, export, validation | `packages/document/src/sankey-render.test.ts`                                                                      |
| Staggered animations by column                                    | `apps/editor/components/canvas/SankeyView.test.tsx`                                                                |
| Editor gate                                                       | `apps/editor/lib/sankey-edit.test.ts`                                                                              |
| Show Me steps, frozen count, Escape, telemetry                    | `apps/editor/components/tour/SankeyFlowsTour.test.tsx`                                                             |
| Element tour: offer, steps, lift, dialog hand-off                 | `apps/editor/components/tour/ElementTourHost.test.tsx`, `sankey-element-tour-steps.test.ts`, `SankeyView.test.tsx` |

## Constants and configuration

| Constant                                        | Value                | Provenance / safe range                           |
| ----------------------------------------------- | -------------------- | ------------------------------------------------- |
| `SANKEY_MAX_FLOWS`                              | 200                  | Readability; 50–500 keeps layout < 5 ms           |
| `SANKEY_MAX_NODES`                              | 120                  | Column legibility; ≤ 200                          |
| `SANKEY_NAME_MAX`                               | 60                   | Label length; 30–120                              |
| `SANKEY_UNIT_MAX`                               | 8                    | "kWh/yr" fits; 4–12                               |
| `SANKEY_VALUE_MAX`                              | 1e12                 | Double precision over 200 sums                    |
| `SANKEY_NODE_WIDTH_PX`                          | 12 (min 6)           | `D159`                                            |
| `SANKEY_NODE_PAD_*_PX`                          | 4–18                 | `D159`                                            |
| `SANKEY_RELAX_SWEEPS`                           | 6                    | d3-sankey default; 4–10                           |
| `SANKEY_MIN_BAND_PX`                            | 1                    | Visibility floor                                  |
| `SANKEY_LABEL_PX`                               | 10/12/15             | `D158`                                            |
| `SANKEY_NAME_CHAR_EM` / `SANKEY_DETAIL_CHAR_EM` | 0.6 / 0.56           | `D162`                                            |
| Band opacities                                  | 0.42/0.78/0.10       | `D156`                                            |
| `SANKEY_BALANCE_EPSILON`                        | 1e-9                 | Amounts are typed to a few decimals               |
| `SANKEY_LINE_MAX`                               | 1000                 | Two names and an amount many times over; ≥ 200    |
| `SANKEY_LEFTOVER_NAME`                          | `Leftover`           | Spec                                              |
| Stagger per column                              | 0.28 / 0.35 / 0.30 s | Cascade / Pulse / Rise, times the speed; 0.15–0.5 |

## Defaults ledger

`D154`–`D168` in [DEFAULTS.md](DEFAULTS.md).
