# Diagram lint: blueprint

Derived from [Diagram lint](../diagram-lint.md), with the result footer of [Edit operations](../edit-operations.md#results),
the refs, containment and `?view=` route of [Document views](../document-views.md), the write path of
[Agent changesets](../agent-changesets.md), the commands of the [CLI](../../015-api/cli.md) and the graph input of the
[MCP server](../../015-api/mcp-server.md) §4.7. The spec decides; this file only adds engineering precision. Defaults
applied where the spec is silent or qualitative are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `LNn`.

Scope, by file:

| File                                                                  | Role                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/diagram-lint/{package.json,tsconfig.json,eslint.config.js}` | The package `@livediagram/diagram-lint`; depends on `@livediagram/document` and `@livediagram/api-schema` |
| `packages/diagram-lint/vitest.config.ts` (planned)                    | `defineProject`, node environment, 100% coverage thresholds (as `explorer-lens`)                          |
| `packages/diagram-lint/src/index.ts` (planned)                        | The barrel: `lintTab`, `lintGraph`, `compareGraphLayouts`, the formatters, the constants                  |
| `packages/diagram-lint/src/constants.ts` (planned)                    | Every `LINT_*` constant (see Constants)                                                                   |
| `packages/diagram-lint/src/context.ts` (planned)                      | `prepareLintContext`: visible elements, index, refs, boxes, arrows, polylines, grid, labels, containers   |
| `packages/diagram-lint/src/boxes.ts` (planned)                        | `isLintBox`, `boxCorners`, `boxBounds`, `overlapDepth` (separating axes), `holdsWholly`                   |
| `packages/diagram-lint/src/arrow-names.ts` (planned)                  | `arrowName` (`orders→bus`), `arrowSelector` (`orders->bus` or the arrow's ref)                            |
| `packages/diagram-lint/src/checks/<code>.ts`                          | One file per finding code, each `(ctx: LintContext) => LintFinding[]`                                     |
| `packages/diagram-lint/src/checks/index.ts` (planned)                 | `LINT_CHECKS`: the thirteen checks in code order                                                          |
| `packages/diagram-lint/src/measures.ts` (planned)                     | `lintExtent`, `crossingPairs` (shared by the summary and `edge-crossings`)                                |
| `packages/diagram-lint/src/flow.ts` (planned)                         | `inferFlow`: the flow direction of a tab, or null                                                         |
| `packages/diagram-lint/src/theme-colours.ts` (planned)                | `themeColourSet`: every fill or stroke a built-in theme can paint                                         |
| `packages/diagram-lint/src/fixes.ts` (planned)                        | `fixFor(code, source, subject)`: the fix catalogue                                                        |
| `packages/diagram-lint/src/order.ts` (planned)                        | `sortFindings`                                                                                            |
| `packages/diagram-lint/src/format.ts` (planned)                       | `lintSummaryLine`, `lintVerdict`, `lintFooterPart`, `formatLintReport`, `quoteLabel`                      |
| `packages/diagram-lint/src/lint.ts` (planned)                         | `lintTab`, `lintGraph`                                                                                    |
| `packages/diagram-lint/src/compare.ts` (planned)                      | `compareGraphLayouts`, `formatCompareTable`, `parseCompareDimensions`                                     |
| `packages/diagram-lint/src/log.ts` (planned)                          | `LintLogger`, `consoleLintLogger`, the `[lint]` fingerprints                                              |
| `packages/diagram-lint/src/fixtures/*.ts`                             | One fixture tab per code (finding and clean twin), the 15-node architecture graph                         |
| `packages/api-schema/src/lint.ts` (planned), `index.ts`               | Wire types: `LINT_CODES`, `LINT_SEVERITY`, `LintFinding`, `LintReport`, `LintMeasures`                    |
| `packages/api-schema/src/document-views.ts` (planned)                 | `VIEW_NAMES` gains `lint`                                                                                 |
| `packages/document/src/svg-render-primitives.ts`                      | `LABEL_ESTIMATE_CHAR_EM`, `estimatedLabelMeasure`; `labelMeasure`'s fallback calls it                     |
| `packages/document/src/svg-render-describe.ts`, `svg-render.ts`       | `drawsStandardLabel` (lifted from `svgBoxed`'s label condition) and `labelRoom`                           |
| `packages/document/src/graph-input.ts` (planned)                      | The moved MCP graph input: `layoutGraph(input, { makeEdgeId })` passes the id option through              |
| `packages/document/src/{element-refs,containment}.ts`                 | Shared homes, consumed here: `elementRefs`, `isContainer`, `containerMap`                                 |
| `apps/api/src/routes/document-views-route.ts` (planned)               | `answerTabView` answers `view=lint` with `lintTab`                                                        |
| `apps/api/src` changeset route (agent-changesets blueprint)           | Lints the result tab; `lintFooterPart` fills the footer's lint slot; `lint` on the response               |
| `apps/mcp/src/tools.ts`, `output-schema.ts`, `package.json`           | `create_document`, `add_tab`, `update_document` append the summary line                                   |
| `apps/cli/src/commands/{tab,graph}.ts` (CLI blueprint)                | `tab lint` reads the view; `graph lint` lints locally; `--json`, `--compare`, exit codes                  |
| `docs/development/architecture.md`, `README.md`                       | The new package in the layout and its one-paragraph description                                           |

The root `AGENTS.md` repo layout lists packages; its line for `diagram-lint/` needs the operator's permission to add.

## Domain and naming

| Term             | Identifier                                                   | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Diagram lint     | `@livediagram/diagram-lint`, `lintTab`, `lintGraph`          | The check of how a tab is drawn                                                             |
| Lint finding     | `LintFinding`                                                | One problem: code, severity, refs, message, fix                                             |
| Code             | `LintCode`, `LINT_CODES`                                     | The thirteen kebab-case codes of the spec, in the spec's table order                        |
| Severity         | `LintSeverity` (`error`, `warning`, `info`), `LINT_SEVERITY` | Fixed per code by the spec                                                                  |
| Fix              | `LintFinding.fix`                                            | Edit operations (tab source) or a graph-source change (graph source); every finding has one |
| Lint report      | `LintReport`                                                 | Measures, findings in order, severity counts, what was skipped                              |
| Measures         | `LintMeasures`                                               | Crossings, behind, overlaps, extent: the summary line's numbers                             |
| Summary line     | `lintSummaryLine(report)`                                    | `5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warnings, 1 info`                      |
| Verdict          | `lintVerdict(report)`                                        | The part after `→`: `clean`, or the severity counts                                         |
| Footer part      | `lintFooterPart(report)`                                     | `lint {verdict}`: what a changeset result's last line carries                               |
| Source           | `LintSource` (`tab`, `graph`)                                | What was linted: a stored or changed tab, or a graph or Mermaid file laid out               |
| Box              | `isLintBox`                                                  | A boxed element that is not a container, text, annotation, freehand or path (LN2)           |
| Shape            | `isLintBox(el) && el.type === 'shape'`                       | The boxes `node-isolated` judges                                                            |
| Container        | `isContainer` (`@livediagram/document`)                      | A `shape` of kind `frame` or `lane`                                                         |
| Frame            | `shape: 'frame'`                                             | The container the group codes judge; a graph group is laid out as one                       |
| Member           | `membersOf(frame)`                                           | A box with the frame on its container chain (`containerMap`)                                |
| Drawable arrow   | `ctx.drawable`                                               | A visible arrow whose two ends resolve to a point                                           |
| Connecting arrow | `ctx.connecting`                                             | A drawable arrow pinned at both ends to two different boxes                                 |
| Flow             | `LintFlow` (`down`, `up`, `right`, `left`)                   | The direction most connecting arrows point                                                  |
| Variant          | `CompareVariant`, `CompareRow`                               | One layout of a graph source under `--compare`                                              |
| Dimension        | `CompareDimension` (`direction`, `groups`, `lines`)          | What `--compare` varies                                                                     |

Banned: "issue", "warning" or "lint error" for a finding (a warning is a severity), "problem" in copy, "edge" for an
arrow in tab-facing messages (graph-source fixes may say edge), "group" for a frame in tab-facing messages, "node" for
a box, "rule" for a code, "score" for measures.

## Behaviour and state

The lint is a pure function: no state, no clock, no randomness, no I/O but one log line.

`lintTab(tab, options)` runs in this sequence:

1. **Prepare** (`prepareLintContext`):
   - `visible` = `visibleLayerElements(tab.elements, tab.layers)`; only these are checked (LN1).
   - `index` = `buildElementIndex(tab.elements)` over every element, so a hidden end is not missing.
   - `refs` = `elementRefs(tab.elements)` (`@livediagram/document`), the refs every view prints.
   - `boxes` = `visible.filter(isLintBox)` with finite `x`, `y`, `width`, `height`. An element with a non-finite
     rect is counted in `skipped` and checked by nothing.
   - `containers` = `containerMap(visible)`: each element's container, the smallest frame or lane holding its centre.
     `frameOf(box)` walks that chain to its first frame (LN13).
   - `arrows` = visible arrows. `dangling` = those failing the `arrow-dangling` test. `drawable` = the rest.
   - `polylines` = `arrowPolyline(arrow, index)` for each drawable arrow, with its bounds, computed once.
   - `grid` = `buildElementGrid(boxes)`; `rotationPad` = half the largest diagonal of any rotated box (0 if none),
     added to every grid query rect so a rotated box's corners are not missed (LN34).
   - `labels` = `arrowLabelPass(visible, { measureFor: (px) => estimatedLabelMeasure(px), fontEpoch: LINT_MEASURE_EPOCH })`
     (LN4, LN33).
2. **Measure**: `crossingPairs(ctx)` unless `drawable.length > LINT_MAX_ARROWS` (LN10); `lintExtent(ctx)` =
   `contentBounds(visible, labels)` rounded to whole px, arrow routes and label plates included, or null when
   nothing is visible. `behind` and `overlaps` are the counts of their findings.
3. **Check**: each entry of `LINT_CHECKS`, in code order, returns its findings (granularity LN8, LN9, LN36).
4. **Order** (`sortFindings`, LN18): severity (`error`, `warning`, `info`); then code order; then the primary
   subject's reading position (rounded top `y`, then `x`: a box's rect, an arrow's first polyline point, a frame's
   rect; `aspect-extreme` first); then the refs joined by a space. **Count** by severity, **log** `[lint] run`,
   return the report.

`lintGraph(input, options)` lays the graph out with `layoutGraph(input, { makeEdgeId: graphEdgeIds(input) })` (LN28),
then calls `lintTab({ elements }, { source: 'graph', flow: input.direction })`, and returns `{ report, elements }`.

### The checks

"Overlap" means `overlapDepth(a, b) > LINT_OVERLAP_TOLERANCE_PX`: the smallest penetration of two oriented rects
over the four separating axes of their edges, so rotated boxes are exact and touching edges do not count (LN3).
`holdsWholly(a, b)` is true when every corner of `b` lies inside `a` (or the reverse), to within the same tolerance.

| Code                | Fires when                                                                                                                                                                                                                                                                                                                                              | One finding per         | Refs                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| `box-overlap`       | Boxes `a` and `b` (a earlier in paint order) overlap and neither holds the other wholly. Candidates come from `queryElementGrid` over `a`'s bounds, so each pair is tested once                                                                                                                                                                         | Pair                    | `a`, `b`                        |
| `arrow-dangling`    | An end is `pinned` to an id absent from `index` or not boxed, or `on-arrow` to an id absent or not an arrow; or both ends are `free`                                                                                                                                                                                                                    | Arrow                   | Arrow                           |
| `arrow-behind-box`  | `pathPassesThrough(polyline, box)` for a box from the grid over the polyline's bounds that is neither end's `pinnedBoxedElement` (LN8)                                                                                                                                                                                                                  | Arrow, every box listed | Arrow, boxes in paint order     |
| `edge-crossings`    | `crossingPairs > LINT_CROSSINGS_PER_ARROW × drawable.length`. A pair counts once when `pathsCross(p, q)`; pairs whose polyline bounds do not intersect are not tested. Skipped above `LINT_MAX_ARROWS`                                                                                                                                                  | Tab                     | Arrows by crossings, most first |
| `label-collision`   | An arrow's label plate (`labels.layouts`: `center` ± half `width`, `height`) overlaps a box, the arrow's own ends included                                                                                                                                                                                                                              | Arrow, every box listed | Arrow, boxes                    |
| `label-overflow`    | A box with `drawsStandardLabel(el)`, a non-blank `label` and `textSize` not `scale` (LN6) wraps to more lines than it holds: `wrapLabel(label, room.width, estimatedLabelMeasure(px), true).length > max(1, floor(room.height / (px × LABEL_LINE_HEIGHT)))`, with `px = fontSizeFor(textSize, type === 'sticky')` and `room = labelRoom(el)` (LN5, LN7) | Box                     | Box                             |
| `node-isolated`     | The tab is a graph (LN11) and a shape is no drawable arrow's pinned end                                                                                                                                                                                                                                                                                 | Shape                   | Shape                           |
| `group-escape`      | A box with a frame (`frameOf`) reaches past that frame's rect by more than `LINT_CONTAIN_TOLERANCE_PX` on any side, measured on `boxBounds` (rotation included) (LN13)                                                                                                                                                                                  | Box                     | Box, frame                      |
| `group-split-edges` | For a frame with members: of the drawable arrows with at least one end on a member, those with exactly one end on a member are `crossing`; fires when `total >= LINT_GROUP_SPLIT_MIN_ARROWS` and `crossing > LINT_GROUP_SPLIT_SHARE × total` (LN12)                                                                                                     | Frame                   | Frame                           |
| `duplicate-label`   | Two or more boxes whose labels match after trimming, collapsing whitespace and lower-casing; blank labels never match (LN14)                                                                                                                                                                                                                            | Label                   | Boxes in paint order            |
| `flow-backwards`    | A flow exists (`options.flow`, else `inferFlow`, LN15) and a directed connecting arrow's head-to-tail vector between box centres has a component against it larger than `LINT_FLOW_TOLERANCE_PX`. `arrowEnds` `from` reverses the arrow; `both` and `none` are undirected and skipped; a self-loop is skipped                                           | Arrow                   | Arrow                           |
| `aspect-extreme`    | At least `LINT_ASPECT_MIN_BOXES` boxes and the extent's `max(w/h, h/w) > LINT_MAX_ASPECT`, both sides at least 1 px (LN16)                                                                                                                                                                                                                              | Tab                     | none                            |
| `colour-on-themed`  | A visible element's `fillColor` or `strokeColor`, among its `themeColourFields`, is set, bound to no preset or swatch (`colorPreset` on a shape; `fillSwatch` for fill, `strokeSwatch` for stroke) and not in `themeColourSet(tab.theme, field)`. Stickies, images, link cards and videos have no theme fields and are never reported (LN17)            | Element                 | Element                         |

`inferFlow`: over connecting directed arrows, classify each head-to-tail vector by its larger axis (`right`/`left`
when `|dx| >= |dy|`, else `down`/`up`). The flow is the most frequent class when it holds at least
`LINT_FLOW_MIN_SHARE` of at least `LINT_FLOW_MIN_ARROWS` arrows; else null and the check returns nothing. A graph
source's `direction` (`down`, `right`) is used as given.

`themeColourSet(themeId, field)`: undefined, `brand` and every `THEMES` id resolve with `getBuiltInTheme`; the set
holds the theme's `elementFill` (or `elementStroke`), every `palette` entry's and `rootColor`'s `fill` (or `stroke`),
and every `shapeColors` entry's. For `brand` both `DEFAULT_SCHEME_LIGHT` and `DEFAULT_SCHEME_DARK` contribute, as
`backdropVariants` treats the backdrop. Any other id (a custom theme) returns null: the check is skipped and logged.

### Where it runs

| Caller                            | Input                                                     | Output                                                                                                   |
| --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Changeset (api), write or dry run | The whole compiled result tab                             | `lintFooterPart` in the footer's lint slot: `rev 41→42 · cs_… · lint clean · revert: …`; response `lint` |
| Changeset revert (api)            | The tab after the inverse (LN31)                          | As above: a revert is a changeset                                                                        |
| Rejected changeset                | nothing                                                   | No lint: nothing was applied                                                                             |
| `GET …/tabs/:tabId?view=lint`     | The stored tab, after the route's read gate and redaction | `formatLintReport` as `text/plain`; with `json=1` the `LintReport`                                       |
| MCP `update_document`, `add_tab`  | The changeset response's `lint`                           | `lint` (the summary line) in structured content and a second text block (LN24)                           |
| MCP `create_document`             | `?view=lint&json=1` for each created tab                  | `lint: string[]`, one summary line per tab in `tabIds` order (LN24)                                      |
| CLI `tab lint <doc> [--tab]`      | `?view=lint` (text), or `?view=lint&json=1` with `--json` | The text as served; `--json` prints `report.findings`                                                    |
| CLI `graph lint <file>`           | The graph or Mermaid file, parsed by the CLI              | `lintGraph` locally, nothing sent; `--compare` the variant table                                         |

The MCP's other write tools (rename, share, comments, trash) change no drawing and carry no lint. A lint that throws
never fails the call that asked for it: the api and the MCP log `[lint] failed` and print `lint unavailable` where the
verdict or summary would go (LN23); the view answers 500 with that message.

`tab lint` and `graph lint` exit 1 when `report.counts.error > 0`, else 0; a usage error exits 2 and a view request
the api refuses exits with the CLI's code for it.

### Compare

`compareGraphLayouts(input, dimensions)` enumerates variants as nested loops over the dimensions in the order given,
each in its fixed value order (LN26):

| Dimension   | Values, in order               | Applied as                                                |
| ----------- | ------------------------------ | --------------------------------------------------------- |
| `direction` | `down`, `right`                | `input.direction`                                         |
| `groups`    | `groups`, `no-groups`          | `no-groups` drops `input.groups` and every node's `group` |
| `lines`     | `straight`, `angled`, `curved` | `input.lines`                                             |

A source without groups collapses `groups` to `no-groups` alone. Each variant is `lintGraph`'d. The best row is the
lowest by: errors; crossings plus behind (crossings counted as 0 when skipped in every row); warnings; `|ln(w/h)|`;
area; enumeration index (LN27). At most 2 × 2 × 3 = 12 variants. `tab lint --compare` is refused: a stored tab is
not a graph source (LN37).

## Interfaces and contracts

`packages/api-schema/src/lint.ts` (planned) (wire types live with every DTO the api emits, LN25):

```ts
export const LINT_CODES = [
  'box-overlap',
  'arrow-dangling',
  'arrow-behind-box',
  'edge-crossings',
  'label-collision',
  'label-overflow',
  'node-isolated',
  'group-escape',
  'group-split-edges',
  'duplicate-label',
  'flow-backwards',
  'aspect-extreme',
  'colour-on-themed',
] as const;
export type LintCode = (typeof LINT_CODES)[number];
export type LintSeverity = 'error' | 'warning' | 'info';
export declare const LINT_SEVERITY: Record<LintCode, LintSeverity>; // the spec's table
export type LintFinding = {
  code: LintCode;
  severity: LintSeverity;
  refs: string[]; // every ref involved, primary first; never empty except aspect-extreme
  message: string; // refs first, as printed
  fix: string;
};
export type LintMeasures = {
  crossings: number | null; // null when skipped
  behind: number; // arrow-behind-box findings
  overlaps: number; // box-overlap findings
  extent: { width: number; height: number } | null; // rounded px; null when nothing is visible
  arrows: number; // drawable arrows
  boxes: number;
};
export type LintReport = {
  measures: LintMeasures;
  findings: LintFinding[];
  counts: Record<LintSeverity, number>;
  skipped: { crossings: boolean };
};
```

The changeset response's `lint` field (agent-changesets blueprint) is this `LintReport`, or null when the lint failed.

`@livediagram/diagram-lint`:

```ts
export type LintSource = 'tab' | 'graph';
export type LintOptions = { source?: LintSource; flow?: 'down' | 'right'; log?: LintLogger };
export function lintTab(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  options?: LintOptions,
): LintReport;
export function lintGraph(
  input: GraphInput,
  options?: Omit<LintOptions, 'source' | 'flow'>,
): { report: LintReport; elements: Element[] };
export function lintSummaryLine(report: LintReport): string;
export function lintVerdict(report: LintReport): string;
export function lintFooterPart(report: LintReport | null): string; // 'lint clean', or 'lint unavailable' for null
export function formatLintReport(report: LintReport): string; // summary line, then finding lines
export type CompareDimension = 'direction' | 'groups' | 'lines';
export function parseCompareDimensions(text: string): CompareDimension[] | { error: string };
export type CompareRow = {
  label: string; // "right no-groups straight"
  variant: { direction: 'down' | 'right'; groups: boolean; lines: ArrowStyle };
  measures: LintMeasures;
  counts: Record<LintSeverity, number>;
  ratio: number | null; // width / height
  best: boolean;
};
export function compareGraphLayouts(
  input: GraphInput,
  dims: CompareDimension[],
  options?: { log?: LintLogger },
): CompareRow[];
export function formatCompareTable(rows: CompareRow[]): string;
export type LintLogger = (
  fingerprint: string,
  fields: Record<string, number | string | boolean>,
) => void;
```

`parseCompareDimensions`: comma-separated, trimmed, each a `CompareDimension`, no repeats, at least one. An unknown
or repeated name returns `{ error: 'unknown dimension "<x>"; use direction, groups, lines' }`, which the CLI prints as
a usage error.

`@livediagram/document` additions:

- `LABEL_ESTIMATE_CHAR_EM = 0.55`; `estimatedLabelMeasure(px) = (s) => s.length × px × LABEL_ESTIMATE_CHAR_EM`.
  `labelMeasure` returns it when no canvas context exists, so the headless renders and the lint agree.
- `drawsStandardLabel(el: BoxedElement): boolean`: true unless `svgBoxed` would print no centred label (self-drawing
  shapes except `legend`, collaborate panels, behaviour faces except `chair`, web components). `svgBoxed` calls it.
- `labelRoom(el): { width: number; height: number }`: `width = labelMaxWidth(el, pad)`;
  `height = el.y + el.height − pad − (bodyTop + pad)`, with `pad` and `bodyTop` exactly as `describeBoxedExport`
  computes them.
- `layoutGraph(input, { makeEdgeId? })` passes `makeEdgeId` to `layoutClusteredGraph` and `graphToElements`.

Api: `VIEW_NAMES` gains `lint`. `answerTabView` with `view=lint` runs `lintTab(tab)` on the tab it already read and
answers `text/plain; charset=utf-8` with `formatLintReport`, or `application/json` with the `LintReport` for
`json=1`. `budget`, `only` and the other view parameters are refused for `lint` with `400 invalid_value`. The
manifest's view entry lists `lint`; it stays `tokenUsable`, read access.

MCP: `createDocumentOutput.lint: z.array(z.string())`, `addTabOutput.lint: z.string()`,
`updateDocumentOutput.lint: z.string()`, each described as "The diagram lint summary line of the tab as written."
`apps/mcp` depends on `@livediagram/diagram-lint` for `lintSummaryLine` only.

CLI: `tab lint <doc> [--tab <t>] [--json]`; `graph lint <file> [--json] [--compare <dims>]`. `--json` prints
`LintFinding[]` (`JSON.stringify(findings, null, 2)`), or `CompareRow[]` with `--compare` (LN38). `tab lint --compare`
is a usage error (exit 2).

## Data and persistence

| Field                        | Class   | Notes                                                              |
| ---------------------------- | ------- | ------------------------------------------------------------------ |
| `LintReport`                 | derived | Recomputed on every call from the tab; never stored (LN32)         |
| `LintFinding.refs`           | derived | Refs of the tab linted; a later write can make a prefix ambiguous  |
| `LintFinding.message`, `fix` | derived | May quote a label (`quoteLabel`); the reader already holds the tab |
| Compare rows                 | derived | Local to the CLI; nothing leaves the machine                       |

No migration, no D1 column, no R2 object, no room op. `agent_changesets` rows do not carry the report; a reader
re-lints the tab through the view.

## Errors and edge cases

- **N1** Nothing visible (empty tab, every layer hidden): no findings, extent null; the summary reads
  `0 crossings · 0 behind · 0 overlaps · empty → clean`.
- **N2** More than `LINT_MAX_ARROWS` drawable arrows: `edge-crossings` and the crossing count are skipped,
  `skipped.crossings` is true, the summary's first part reads `crossings skipped (412 arrows)`, and
  `[lint] crossings skipped` logs. Every other check runs.
- **N3** A dangling arrow gets its `arrow-dangling` finding and takes part in nothing else: its resolved points are
  `{0,0}` placeholders (`endpointPosition`).
- **N4** An end pinned to an element on a hidden layer is not dangling (`index` holds every element); the arrow is
  checked only if it is itself visible.
- **N5** An `on-arrow` end resolves through `endpointPosition`; a chain deeper than its guard resolves to `{0,0}`
  and the arrow counts as dangling.
- **N6** Non-finite geometry: the element is skipped by every check and counted in `[lint] run` as `skipped`.
- **N7** Two arrows meeting at one anchor do not cross (`CROSSING_ENDPOINT_TOLERANCE_PX`); collinear overlap is not a
  crossing; two paths crossing twice count once.
- **N8** A self-loop (both ends on one box) takes part in crossings and `arrow-behind-box`, never in
  `flow-backwards`.
- **N9** `label-overflow` judges the estimate, not a browser's font: the same measure every headless render (the
  MCP's PNG, the api's `render.svg`) wraps with, so the lint agrees with the preview an agent sees.
- **N10** Rich text is measured as its plain `label` at the element's base size (LN7).
- **N11** A sticky with `textSize: 'scale'` fits its text by design and never overflows.
- **N12** A box wholly inside another (an icon on a square, a table on a `page` shape) is not a `box-overlap`.
- **N13** Nested containers: `frameOf` takes the first frame on the chain, so a box in a lane inside a frame is that
  frame's member; membership for `group-split-edges` is transitive, so an outer frame counts an inner frame's members.
  Lanes alone are never judged by the group codes.
- **N14** A frame with no members, or with fewer than `LINT_GROUP_SPLIT_MIN_ARROWS` arrows, is never reported.
- **N15** A custom tab theme: `colour-on-themed` is skipped and `[lint] theme unresolved` logs at debug.
- **N16** A graph edge to an unknown node is dropped by `graphToElements`, so a graph source never yields
  `arrow-dangling`; an empty graph lints as N1.
- **N17** A Mermaid dialect `parseMermaid` cannot read: `resolveGraphInput`'s error, printed by the CLI; no lint.
- **N18** Two arrows with the same ends: messages name both `orders→bus`; fixes and JSON use each arrow's ref, since
  `orders->bus` would be ambiguous.
- **N19** A label holding control characters, quotes or newlines: `quoteLabel` strips C0 and C1 controls, collapses
  whitespace, cuts at `LINT_LABEL_QUOTE_MAX` with `…` and JSON-escapes it.
- **N20** The lint throws: the caller logs `[lint] failed`; a changeset still lands with `lint unavailable`, the MCP
  prints `lint unavailable`, the view answers 500.
- **N21** A changeset's whole result tab is linted, so faults a person drew earlier appear in an agent's verdict too.
- **N22** `--compare` on a source of 300 nodes: twelve layouts locally; the CLI prints rows as they finish, in order.

## Security and trust

- The lint reads only what the caller may already read: a changeset's own result, a tab behind the view route's read
  gate (read-only tokens included), or a local file. It never writes.
- Text output is printed to terminals: every quoted label goes through `quoteLabel` (N19), so a label cannot inject
  terminal escapes. Refs are slugs or hex prefixes by construction.
- Abuse: a crafted tab of 10,000 elements (`MAX_ELEMENTS_PER_TAB`) cannot make the lint quadratic in arrows: the
  pair check is bounded by `LINT_MAX_ARROWS`, and the box and arrow-to-box checks ask the element grid.
- Logs carry counts and codes only: no ids, refs, labels or theme ids.
- `graph lint` never sends the file anywhere; telemetry stays the CLI's `Cli·Used·GraphLint` with no arguments.

## Performance and limits

Worst cases, per run:

| Check                          | Cost                                                             | Bound                                            |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------ |
| `edge-crossings`               | `n(n−1)/2` bounds tests, then `pathsCross` (segments × segments) | `n ≤ 300`: 44,850 pairs; about 2 ms on one core  |
| `box-overlap`                  | One grid query per box, separating-axes test per candidate       | Linear in boxes times neighbourhood              |
| `arrow-behind-box`             | One grid query per arrow, `pathPassesThrough` per candidate      | `PATH_MAX_SAMPLES_PER_SEGMENT` (512) per segment |
| `label-collision`              | `arrowLabelPass`: what every render of the tab already pays      | Labelled arrows × obstacles                      |
| `label-overflow`               | One `wrapLabel` per labelled box                                 | Linear in label characters                       |
| Group, flow, duplicate, colour | One pass over arrows or boxes; `containerMap` once               | Linear, containment `O(n × containers)`          |

- Budget: a tab of 300 boxes and 300 arrows lints within `LINT_BUDGET_CPU_MS` of CPU (`cpuMsOf`), the spec's "a few
  milliseconds" for the pair checks with room for the label pass (LN35).
- Changesets: one lint per changeset in the api worker, inside the request it already handles; no extra subrequest.
  The view lints the tab it read; MCP `create_document` adds one view request per created tab.
- Bundle: the api and MCP workers already bundle `@livediagram/document`; `diagram-lint` adds only its own sources.
- Output: about 100 tokens for a typical tab; at most `LINT_MAX_LINES_PER_CODE` lines per code, then one elision line.

## Presentation and UX

The lint has no web surface; its text output is its interface (CLI, MCP text, changeset footer).

- **Summary line**: `{crossings} · {behind} behind · {overlaps} · {extent} → {verdict}`.
  - crossings: `1 crossing`, `{n} crossings`, or `crossings skipped ({n} arrows)`;
  - overlaps: `1 overlap`, `{n} overlaps`;
  - extent: `{w}×{h}` (U+00D7, rounded px) or `empty`;
  - verdict: `clean`, or the non-zero of `1 error` / `{n} errors`, `1 warning` / `{n} warnings`, `{n} info`, joined
    by `, ` (LN22).
- **Finding line**: severity letter (`E`, `W`, `I`), a space, the code padded to 17 characters (the longest code),
  two spaces, the message padded to the longest message printed (at most `LINT_MESSAGE_COLUMN_MAX`), two spaces,
  `fix: {fix}`. Every finding prints its fix (LN19). Each code prints at most `LINT_MAX_LINES_PER_CODE` lines, then
  `… {n} more {code}` (LN20).
- **Changeset footer**: `lintFooterPart`: `lint clean`, `lint 2 warnings, 1 info`, or `lint unavailable`.
- **Compare table**: a header `variant  crossings  behind  overlaps  extent  ratio  verdict`, then one row a variant,
  columns padded to their widest cell, ratio to one decimal, `← best` after the best row's verdict.

Messages, with `{a}` a box ref, `{x→y}` an arrow named by its ends (`arrowName`, the arrow's ref when an end is not a
box), `{label}` a `quoteLabel`:

| Code                | Message                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `box-overlap`       | `{a} overlaps {b}`                                                     |
| `arrow-dangling`    | `{arrow} points at a missing element` / `{arrow} is free at both ends` |
| `arrow-behind-box`  | `{x→y} passes behind {a}[, {b}…]`                                      |
| `edge-crossings`    | `{x→y}, {x→y}, {x→y} +{k}: {n} crossings among {m} arrows, limit {l}`  |
| `label-collision`   | `{x→y} label overlaps {a}[, {b}…]`                                     |
| `label-overflow`    | `{a} needs {n} lines, holds {h}`                                       |
| `node-isolated`     | `{a} has no arrows`                                                    |
| `group-escape`      | `{a} sticks out of {frame}`                                            |
| `group-split-edges` | `{frame}: {c} of {t} arrows cross its border`                          |
| `duplicate-label`   | `{a}, {b}[, …] share {label}`                                          |
| `flow-backwards`    | `{x→y} points {dir}, against the flow {flow}`                          |
| `aspect-extreme`    | `drawing: {w}×{h}, {r} times {wider than tall \| taller than wide}`    |
| `colour-on-themed`  | `{a} sets its {fill \| stroke \| fill and stroke} on a themed tab`     |

Fixes (LN29), tab source first, graph source second. A tab fix is edit operations in line form: `; ` runs them in
order, `, or ` separates alternatives, and `<ref>` and `<text>` are placeholders an agent fills in. A graph fix is a
change to the source in words, or a command. `{arrow}` is `arrowSelector`: `x->y` when exactly one arrow joins them
that way, else the arrow's ref (N18).

| Code                | Tab source                                                                   | Graph source                                  |
| ------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `box-overlap`       | `move {b} right-of:{a}`                                                      | `graph lint --compare direction,groups`       |
| `arrow-dangling`    | `rm {arrow}`                                                                 | `remove the edge`                             |
| `arrow-behind-box`  | `set {arrow} line=angled` (`line=curved` when already angled)                | `drop the groups, or lines: angled`           |
| `edge-crossings`    | `layout type:shape`                                                          | `graph lint --compare direction,groups,lines` |
| `label-collision`   | `set {arrow} label="<text>"`                                                 | `shorten the edge label`                      |
| `label-overflow`    | `set {a} text=sm` (when larger), else `set {a} label="<text>" note="<text>"` | `shorten the label; detail goes in note`      |
| `node-isolated`     | `connect <ref> -> {a}`                                                       | `add an edge to {a}, or drop it`              |
| `group-escape`      | `move {a} inside:{frame}`                                                    | `drop the group`                              |
| `group-split-edges` | `unwrap {frame}`                                                             | `group by ownership, or drop the groups`      |
| `duplicate-label`   | `set {b} label="<text>"`                                                     | `rename one, or merge the nodes`              |
| `flow-backwards`    | `rewire {arrow} from={y}; rewire {arrow} to={x}`                             | `reverse the edge, unless it is a loop`       |
| `aspect-extreme`    | `layout type:shape direction={down \| right}`                                | `direction: {down \| right}`                  |
| `colour-on-themed`  | `set {a} fill= stroke=` (the fields set)                                     | `drop the colour`                             |

## Observability

| Fingerprint                      | Level | Where                            | Fields                                                                                                                                        |
| -------------------------------- | ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `[lint] run`                     | info  | `lintTab`                        | `source`, `elements`, `boxes`, `arrows`, `skipped`, `errors`, `warnings`, `infos`, one count per code with findings, `crossingsSkipped`, `ms` |
| `[lint] crossings skipped`       | warn  | `lintTab`                        | `arrows`, `max`                                                                                                                               |
| `[lint] theme unresolved`        | debug | `colour-on-themed`               | none (never the theme id)                                                                                                                     |
| `[lint] compare`                 | info  | `compareGraphLayouts`            | `variants`, `bestIndex`, `ms`                                                                                                                 |
| `[lint] failed`                  | error | changeset route, view route, MCP | `where` (`changeset`, `view`, `mcp`), the error's message and stack                                                                           |
| `[element-grid] skipped element` | debug | `buildElementGrid`               | Existing; fires for a box with an unusable rect                                                                                               |

`LintOptions.log` defaults to `consoleLintLogger` (`console.info` / `warn` / `debug` by fingerprint); the CLI passes
its debug logger, which writes to stderr only when debugging is on, so stdout stays data (LN30). No telemetry pair is
added: the front doors already count the verbs (`Cli·Used·TabLint`, `Cli·Used·GraphLint`, `Mcp·Used`).

## Testing

| Spec rule                                                              | Test                                                                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Each code fires on its fixture and not on its clean twin (13 × 2)      | `packages/diagram-lint/src/checks/<code>.test.ts`                                                          |
| A box wholly inside another is not an overlap                          | `checks/box-overlap.test.ts` (planned)                                                                     |
| `node-isolated` judges shapes only; stickies, tables, images never     | `checks/node-isolated.test.ts` (planned)                                                                   |
| Group codes judge frames, not lanes; centre containment                | `checks/group-escape.test.ts` (planned), `checks/group-split-edges.test.ts` (planned)                      |
| A themed element: theme colours, presets and swatches are not reported | `checks/colour-on-themed.test.ts` (planned) (single-colour, multicolour, UML, Default, custom)             |
| Severity per code is the spec's                                        | `packages/api-schema/src/lint.test.ts` (planned)                                                           |
| Refs, message and fix of every code; every finding has a fix           | `checks/<code>.test.ts`; `fixes.test.ts`                                                                   |
| Refs are the views' refs                                               | `lint.test.ts`: every ref is `elementRefs(tab.elements)`'s for its element                                 |
| Deterministic: same tab, same report, same order                       | `lint.test.ts`: two runs deep-equal; `order.test.ts`: severity, code, position, refs                       |
| One fixture pins each code                                             | `fixtures/index.test.ts` (planned): every `LINT_CODES` entry has a fixture                                 |
| Bounded: above `LINT_MAX_ARROWS` only crossings skip, summary says so  | `lint.test.ts`: 301 arrows → `skipped.crossings`, `crossings skipped (301 arrows)`, other codes still fire |
| Pair checks stay within budget                                         | `lint.perf.test.ts`: 300 boxes, 300 arrows under `LINT_BUDGET_CPU_MS` via `cpuMsOf`                        |
| Logs `[lint] run` with counts, never content                           | `log.test.ts`: fields hold only numbers, booleans and the source; no id, ref or label                      |
| Summary line, plurals, verdict, footer part, `empty`, `clean`          | `format.test.ts`                                                                                           |
| One finding a line, refs first, fix last, columns, elision             | `format.test.ts`, including the spec's example output byte for byte                                        |
| `quoteLabel` strips controls and cuts                                  | `format.test.ts`                                                                                           |
| `--compare` enumerates, measures, marks the best                       | `compare.test.ts`; `parseCompareDimensions` rejections                                                     |
| Measured architecture: tier groups cross, no groups ranks best         | `compare.test.ts` over `fixtures/shop-architecture.ts` (planned) (the research's 15 nodes)                 |
| Graph-authored boxes never overflow their labels                       | `checks/label-overflow.test.ts` (planned): `labelBoxSize` boxes over a label corpus lint clean             |
| Every tab fix parses as edit operations (placeholders filled)          | `fixes.test.ts` with the edit-operations parser                                                            |
| Templates draw without errors                                          | `templates.test.ts`: every `@livediagram/templates` kind lints with 0 errors                               |
| Headless renders and the lint measure alike                            | `packages/document/src/svg-render-primitives.test.ts` (planned): fallback is `estimatedLabelMeasure`       |
| `drawsStandardLabel`, `labelRoom`, `makeEdgeId`                        | Their `packages/document` tests; the `svg-render` suites unchanged                                         |
| The api serves the lint as a view, text and `json=1`, read gate        | `apps/api/src/routes/document-views-route.test.ts` (planned) (real SQLite)                                 |
| A changeset's footer carries the verdict; whole tab; dry run; failure  | The changeset route tests (agent-changesets blueprint)                                                     |
| MCP write results carry the summary line; other writes do not          | `apps/mcp/src/tools.test.ts`; `output-schema.test.ts`                                                      |
| `tab lint`, `graph lint`, `--json`, `--compare`, exit 1 on errors      | `apps/cli/src/commands/{tab,graph}.test.ts` (CLI blueprint)                                                |

## Constants and configuration

| Constant                      | Value | Provenance                                                                   | Safe range  |
| ----------------------------- | ----- | ---------------------------------------------------------------------------- | ----------- |
| `LINT_CROSSINGS_PER_ARROW`    | 0.25  | Spec                                                                         | 0.1 to 1    |
| `LINT_MAX_ASPECT`             | 3     | Spec                                                                         | 2 to 5      |
| `LINT_MAX_ARROWS`             | 300   | Spec                                                                         | 100 to 1000 |
| `LINT_OVERLAP_TOLERANCE_PX`   | 2     | `PATH_INSIDE_INSET_PX`: touching is not overlapping (LN3)                    | 0 to 8      |
| `LINT_CONTAIN_TOLERANCE_PX`   | 2     | As above, for a member reaching a frame's border (LN13)                      | 0 to 8      |
| `LABEL_ESTIMATE_CHAR_EM`      | 0.55  | `labelMeasure`'s headless fallback, lifted into a name (LN4)                 | 0.5 to 0.6  |
| `LINT_MEASURE_EPOCH`          | -1    | A `fontEpoch` no browser uses, so estimates never share cached widths (LN33) | any < 0     |
| `LINT_GRAPH_MIN_CONNECTED`    | 2     | A graph has at least one arrow between two boxes (LN11)                      | 2 to 4      |
| `LINT_GRAPH_MIN_SHARE`        | 0.5   | "Otherwise a graph": most boxes are connected (LN11)                         | 0.5 to 0.9  |
| `LINT_GROUP_SPLIT_SHARE`      | 0.5   | "Most" read as more than half (LN12)                                         | 0.5 to 0.9  |
| `LINT_GROUP_SPLIT_MIN_ARROWS` | 3     | One or two arrows are too few to call a frame split (LN12)                   | 2 to 6      |
| `LINT_FLOW_MIN_ARROWS`        | 3     | A direction needs a few arrows to be a flow (LN15)                           | 2 to 6      |
| `LINT_FLOW_MIN_SHARE`         | 0.6   | A clear majority; a radial mind map has none (LN15)                          | 0.5 to 0.8  |
| `LINT_FLOW_TOLERANCE_PX`      | 8     | Sideways arrows between neighbours in one rank are not backwards (LN15)      | 0 to 24     |
| `LINT_ASPECT_MIN_BOXES`       | 3     | One or two boxes have a shape, not a layout (LN16)                           | 2 to 5      |
| `LINT_MAX_LINES_PER_CODE`     | 10    | Keeps the report near 100 tokens on a hand-coloured tab (LN20)               | 3 to 50     |
| `LINT_REFS_PER_FINDING_MAX`   | 3     | Arrows named in the `edge-crossings` message; JSON lists all (LN9)           | 1 to 10     |
| `LINT_LABEL_QUOTE_MAX`        | 40    | `GRAPH_LABEL_MAX`: a heading's length (LN21)                                 | 20 to 80    |
| `LINT_MESSAGE_COLUMN_MAX`     | 48    | The fix column stays inside a 100-column terminal (LN19)                     | 32 to 64    |
| `LINT_BUDGET_CPU_MS`          | 50    | 300 × 300 with the label pass; catches a quadratic regression (LN35)         | 20 to 200   |

No environment variable, binding or migration; self-hosting needs nothing.

## Defaults ledger

LN1 to LN38 in [DEFAULTS.md](DEFAULTS.md).
