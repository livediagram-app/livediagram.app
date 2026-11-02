# Diagram lint: blueprint

Derived from [Diagram lint](../diagram-lint.md), with the result footer of [Edit operations](../edit-operations.md#results),
the refs, containment and `?view=` route of [Document views](../document-views.md), the write path of
[Agent changesets](../agent-changesets.md), and the commands of the [CLI](../../015-api/cli.md). The spec decides; this file only adds engineering precision. Defaults
applied where the spec is silent or qualitative are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `LNn`.

Scope, by file:

| File                                                                              | Role                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/diagram-lint/{package.json,tsconfig.json,oxlint.config.ts}`             | The package `@livedocuments/diagram-lint`; depends on `@livedocuments/document` and `@livedocuments/api-schema` (tests also on `templates` and `edit-operations`)                                                      |
| `packages/diagram-lint/vitest.config.ts`                                          | `defineProject`, node environment, 100% coverage thresholds (as the former explorer-lens package did)                                                                                                                  |
| `packages/diagram-lint/src/index.ts`                                              | The barrel: `lintTab`, the formatters, the logger, the constants                                                                                                                                                       |
| `packages/diagram-lint/src/constants.ts`                                          | Every `LINT_*` constant (see Constants): the shared ones from `../packages/diagram-lint/src/constants.ts`                                                                                                              |
| `packages/diagram-lint/src/context.ts`                                            | `prepareLintContext`: visible elements, index, refs, boxes, containment, arrows, routes, the connected boxes, grid, labels                                                                                             |
| `packages/diagram-lint/src/boxes.ts`                                              | `isLintBox`, `centreOf`, `boxCorners`, `boxBounds`, `overlapDepth` (separating axes), `holdsWholly`                                                                                                                    |
| `packages/diagram-lint/src/arrow-names.ts`                                        | `pinnedEnds`, `arrowName` (`orders→bus`), `arrowSelector` (`orders->bus` or the arrow's ref)                                                                                                                           |
| `packages/diagram-lint/src/checks/<code>.ts` (+ test)                             | One file per finding code, each `(input: CheckInput) => RawFinding[]`; its test has a finding and a clean twin                                                                                                         |
| `packages/diagram-lint/src/checks/index.ts`, `types.ts`                           | `LINT_CHECKS`: the nine checks in code order; `RawFinding`, `CheckInput`, `Check`                                                                                                                                      |
| `packages/diagram-lint/src/measures.ts`                                           | `lintExtent`, `crossingPairs` (shared by the summary and `edge-crossings`)                                                                                                                                             |
| `packages/diagram-lint/src/flow.ts`                                               | `inferFlow`, `headOf`, `directedVector`, `directionOf`                                                                                                                                                                 |
| `packages/diagram-lint/src/fixes.ts`                                              | `fixes`: the fix catalogue, one function per code                                                                                                                                                                      |
| `../packages/diagram-lint/src/quote.ts`                                           | `quoteLabel` (shared, `@liveworkspace/diagram-lint`)                                                                                                                                                                   |
| `packages/diagram-lint/src/order.ts`                                              | `sortFindings`: `../packages/diagram-lint/src/order.ts`'s `createSortFindings` bound to this product's `LINT_CODES` and `LINT_SEVERITY`; the finding shapes it reads are in `../packages/diagram-lint/src/findings.ts` |
| `../packages/diagram-lint/src/format.ts`                                          | `lintSummaryLine`, `lintVerdict`, `lintFooterPart`, `formatLintReport` over any product's codes (shared, `@liveworkspace/diagram-lint`)                                                                                |
| `packages/diagram-lint/src/lint.ts`                                               | `lintTab`, `LintOptions`                                                                                                                                                                                               |
| `../packages/diagram-lint/src/log.ts`                                             | `LintLogger`, `consoleLintLogger`, the `[lint]` fingerprints (shared, `@liveworkspace/diagram-lint`)                                                                                                                   |
| `packages/diagram-lint/src/fixtures/build.ts`                                     | Fixture builders and a quiet lint                                                                                                                                                                                      |
| `packages/api-schema/src/lint.ts` (+ test), `index.ts`                            | Wire types: `LINT_CODES`, `LINT_SEVERITIES`, `LINT_SEVERITY`, `LintFinding`, `LintReport`, `LintMeasures`, `isLintCode`                                                                                                |
| `packages/api-schema/src/document-views.ts`                                       | `VIEW_NAMES` gains `lint`; `LINT_VIEW_NAME`                                                                                                                                                                            |
| `packages/api-schema/src/changesets.ts`                                           | `ChangesetResponse.lint` and `RevertResponse.lint`: `LintReport \| null`                                                                                                                                               |
| `packages/document/src/svg-render-primitives.ts`                                  | `LABEL_ESTIMATE_CHAR_EM`, `estimatedLabelMeasure`; `labelMeasure`'s fallback calls it                                                                                                                                  |
| `packages/document/src/svg-render-describe.ts`, `svg-render.ts`                   | `selfLabelled` (lifted from `svgBoxed`'s label condition), `drawsStandardLabel`, `labelRoom`                                                                                                                           |
| `packages/document/src/{element-refs,containment}.ts`                             | Shared homes, consumed here: `computeRefs`, `isContainer`, `deriveContainers`                                                                                                                                          |
| `apps/api/src/routes/document-views-route.ts`                                     | `parseViewQuery` reads `view=lint` (only `json`); `answerTabView` answers it with `lintTab`                                                                                                                            |
| `apps/api/src/changesets/lint.ts`                                                 | `lintResult`, `lintLog`: the result tab's lint for writes, dry runs and reverts; `[lint] failed`                                                                                                                       |
| `apps/api/src/changesets/{submit,revert}.ts`                                      | `lintFooterPart` fills the footer's lint slot; `lint` on the response                                                                                                                                                  |
| `apps/api/src/openapi/manifest.ts`                                                | The tab view parameter lists `lint`                                                                                                                                                                                    |
| `apps/mcp/src/lint-summary.ts`, `tools.ts`, `output-schema.ts`, `image-result.ts` | `create_document`, `add_tab`, `update_document` carry the summary line, also as a text block                                                                                                                           |
| `apps/cli/src/dispatch/route.ts` (CLI blueprint)                                  | `tab lint` reads the view; `--json`, exit codes                                                                                                                                                                        |
| `docs/development/architecture.md`, `README.md`                                   | The package in the layout and its one-paragraph description                                                                                                                                                            |

The root `AGENTS.md` repo layout lists packages; its line for `diagram-lint/` needs the operator's permission to add.

## Domain and naming

| Term             | Identifier                                                   | Meaning                                                                            |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Diagram lint     | `@livedocuments/diagram-lint`, `lintTab`                     | The check of how a tab is drawn                                                    |
| Lint finding     | `LintFinding`                                                | One problem: code, severity, refs, message, fix                                    |
| Code             | `LintCode`, `LINT_CODES`                                     | The ten kebab-case codes of the spec, in the spec's table order                    |
| Severity         | `LintSeverity` (`error`, `warning`, `info`), `LINT_SEVERITY` | Fixed per code by the spec                                                         |
| Fix              | `LintFinding.fix`                                            | Edit operations; every finding has one                                             |
| Lint report      | `LintReport`                                                 | Measures, findings in order, severity counts, what was skipped                     |
| Measures         | `LintMeasures`                                               | Crossings, behind, overlaps, extent: the summary line's numbers                    |
| Summary line     | `lintSummaryLine(report)`                                    | `5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warnings, 1 info`             |
| Verdict          | `lintVerdict(report)`                                        | The part after `→`: `clean`, or the severity counts                                |
| Footer part      | `lintFooterPart(report)`                                     | `lint {verdict}`: what a changeset result's last line carries                      |
| Box              | `isLintBox`                                                  | A boxed element that is not a container, text, margin note, freehand or path (LN2) |
| Shape            | `isLintBox(el) && el.type === 'shape'`                       | The boxes `node-isolated` judges                                                   |
| Container        | `isContainer` (`@livedocuments/document`)                    | A `shape` of kind `stack`                                                          |
| Drawable arrow   | `ctx.drawable`                                               | A visible arrow whose two ends resolve to a point                                  |
| Connecting arrow | `ctx.connecting`                                             | A drawable arrow pinned at both ends to two different boxes                        |
| Flow             | `LintFlow` (`down`, `up`, `right`, `left`)                   | The direction most connecting arrows point                                         |

Banned: "issue", "warning" or "lint error" for a finding (a warning is a severity), "problem" in copy, "edge" for an
arrow in tab-facing messages, "group" for a stack in tab-facing messages, "node" for
a box, "rule" for a code, "score" for measures.

## Behaviour and state

The lint is a pure function: no state, no clock, no randomness, no I/O but one log line.

`lintTab(tab, options)` runs in this sequence:

1. **Prepare** (`prepareLintContext`):
   - `visible` = `visibleLayerElements(tab.elements, tab.layers)`; only these are checked (LN1).
   - `index` = `buildElementIndex(tab.elements)` over every element, so a hidden end is not missing.
   - `refs` = `computeRefs(tab.elements ids)` (`@livedocuments/document`), the refs every view prints.
   - `boxes` = `visible.filter(isLintBox)` with finite `x`, `y`, `width`, `height`. An element with a non-finite
     rect is counted in `skipped` and checked by nothing.
   - `containers` = `deriveContainers(visible)`: each element's container, the smallest stack holding its centre.
   - `arrows` = visible arrows. `dangling` = those failing the `arrow-dangling` test. `drawable` = the rest.
   - `polylines` = `arrowRoutePoints(arrow, visible)` for each drawable arrow (the drawn route, shared-anchor ends
     fanned), with its bounds, computed once.
   - `grid` = `buildElementGrid(boxes)`; `rotationPad` = half the largest diagonal of any rotated box (0 if none),
     added to every grid query rect so a rotated box's corners are not missed (LN34).
   - `labels` = `arrowLabelPass(visible, { measureFor: (px) => estimatedLabelMeasure(px), fontEpoch: LINT_MEASURE_EPOCH })`
     (LN4, LN33).
2. **Measure**: `crossingPairs(ctx)` unless `drawable.length > LINT_MAX_ARROWS` (LN10); `lintExtent(ctx)` =
   `contentBounds(visible, labels)` rounded to whole px, arrow routes and label plates included, or null when
   nothing is visible. `behind` and `overlaps` are the counts of their findings.
3. **Check**: each entry of `LINT_CHECKS`, in code order, returns its findings (granularity LN8, LN9, LN36).
4. **Order** (`sortFindings`, LN18): severity (`error`, `warning`, `info`); then code order; then the primary
   subject's reading position (rounded top `y`, then `x`: a box's rect, an arrow's first polyline point); then the refs joined by a space. **Count** by severity, **log** `[lint] run`,
   return the report.

### The checks

"Overlap" means `overlapDepth(a, b) > LINT_OVERLAP_TOLERANCE_PX`: the smallest penetration of two oriented rects
over the four separating axes of their edges, so rotated boxes are exact and touching edges do not count (LN3).
`holdsWholly(a, b)` is true when every corner of `b` lies inside `a` (or the reverse), to within the same tolerance.

| Code               | Fires when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | One finding per         | Refs                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------- |
| `box-overlap`      | Boxes `a` and `b` (a earlier in paint order), both the pinned end of a drawable arrow, overlap and neither holds the other wholly. Candidates come from `queryElementGrid` over `a`'s bounds, so each pair is tested once                                                                                                                                                                                                                                                                                                                                                                               | Pair                    | `a`, `b`                              |
| `arrow-dangling`   | An end is `pinned` to an id absent from `index` or not boxed, or `on-arrow` to an id absent or not an arrow. A line with both ends free is a drawing and is never dangling                                                                                                                                                                                                                                                                                                                                                                                                                              | Arrow                   | Arrow                                 |
| `arrow-behind-box` | `pathPassesThrough(polyline, box)` for a box from the grid over the polyline's bounds that is neither end's `pinnedBoxedElement` (LN8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Arrow, every box listed | Arrow, boxes in paint order           |
| `edge-crossings`   | `crossingPairs > LINT_CROSSINGS_PER_ARROW × drawable.length`. A pair counts once when `pathsCross(p, q)`; pairs whose polyline bounds do not intersect are not tested. Skipped above `LINT_MAX_ARROWS`                                                                                                                                                                                                                                                                                                                                                                                                  | Tab                     | Arrows by crossings, most first       |
| `label-collision`  | An arrow's label plate (`labels.layouts`: `center` ± half `width`, `height`) overlaps a box, the arrow's own ends included, or a later arrow's plate (each pair once, on the earlier arrow, the other's arrow ref listed); else, struck: another arrow's segment passes through the plate drawn in by `LINT_OVERLAP_TOLERANCE_PX` (`pathPassesThrough`), a segment along the label's own run's axis through its centre aside (a bus the label cuts as its own line)                                                                                                                                     | Arrow, every box listed | Arrow, boxes                          |
| `label-overflow`   | A box with `drawsStandardLabel(el)`, a non-blank `label` and `textSize` not `scale` (LN6) wraps to more lines than it holds: `wrapLabel(label, room.width, estimatedLabelMeasure(px), true).length > max(1, floor(room.height / (px × LABEL_LINE_HEIGHT)))`, with `px = fontSizeFor(textSize, type === 'sticky')` and `room = labelRoom(el)` (LN5, LN7); or a card whose `pageTitle` / `pageSubtitle` is longer than `lineChars(slot.width, px)` of its `cardLayout` slot, as the render cuts it                                                                                                        | Box                     | Box                                   |
| `node-isolated`    | The tab is a graph (LN11) and a shape is no drawable arrow's pinned end                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Shape                   | Shape                                 |
| `duplicate-label`  | Two or more boxes whose labels match after trimming, collapsing whitespace and lower-casing, a card's `pageTitle` and `pageSubtitle` joined to its label; blank labels never match (LN14)                                                                                                                                                                                                                                                                                                                                                                                                               | Label                   | Boxes in paint order                  |
| `flow-backwards`   | A flow exists (`options.flow`, else `inferFlow`, LN15) and a directed connecting arrow's head-to-tail vector between box centres has a component against it larger than `LINT_FLOW_TOLERANCE_PX`. `arrowEnds` `from` reverses the arrow; `both` and `none` are undirected and skipped; a self-loop is skipped                                                                                                                                                                                                                                                                                           | Arrow                   | Arrow                                 |
| `text-overflow`    | Visible text elements with a label, neither on an arc (`textArc`) nor turned (`rotation` not a multiple of 360). `textOverflow` (`packages/diagram-lint/src/checks/text-overflow.ts`) runs two passes on every tab. `overprints`: two such texts whose drawn lines overlap by more than `LINT_OVERLAP_TOLERANCE_PX`, found by a sweep sorted by top edge. `linesOver`: one, not `textSize: scale`, whose label wrapped at `labelRoom` with `estimatedLabelMeasure` needs more lines than `floor((room.height + px/4) / (px * LABEL_LINE_HEIGHT))`. Every template lints with none (`templates.test.ts`) | Text element            | Text element (the first, for overlap) |

`inferFlow`: over connecting directed arrows, classify each head-to-tail vector by its larger axis (`right`/`left`
when `|dx| >= |dy|`, else `down`/`up`). The flow is the most frequent class when it holds at least
`LINT_FLOW_MIN_SHARE` of at least `LINT_FLOW_MIN_ARROWS` arrows; else null and the check returns nothing. A graph
source's `direction` (`down`, `right`) is used as given.

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

The MCP's other write tools (rename, share, comments, trash) change no drawing and carry no lint. A lint that throws
never fails the call that asked for it: the api and the MCP log `[lint] failed` and print `lint unavailable` where the
verdict or summary would go (LN23); the view answers 500 with that message.

`tab lint` exits 1 when `report.counts.error > 0`, else 0; a usage error exits 2 and a view request
the api refuses exits with the CLI's code for it.

## Interfaces and contracts

`packages/api-schema/src/lint.ts` (wire types live with every DTO the api emits, LN25):

```ts
export const LINT_CODES = [
  'box-overlap',
  'arrow-dangling',
  'arrow-behind-box',
  'edge-crossings',
  'label-collision',
  'label-overflow',
  'node-isolated',
  'duplicate-label',
  'flow-backwards',
  'text-overflow',
] as const;
export type LintCode = (typeof LINT_CODES)[number];
export type LintSeverity = 'error' | 'warning' | 'info';
export declare const LINT_SEVERITY: Record<LintCode, LintSeverity>; // the spec's table
export type LintFinding = {
  code: LintCode;
  severity: LintSeverity;
  refs: string[]; // every ref involved, primary first; never empty
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

`@livedocuments/diagram-lint`:

```ts
export type LintOptions = { flow?: 'down' | 'right'; log?: LintLogger };
export function lintTab(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  options?: LintOptions,
): LintReport;
export function lintSummaryLine(report: LintReport): string;
export function lintVerdict(report: LintReport): string;
export function lintFooterPart(report: LintReport | null): string; // 'lint clean', or 'lint unavailable' for null
export function formatLintReport(report: LintReport): string; // summary line, then finding lines
export type LintLogger = (
  fingerprint: string,
  fields: Record<string, number | string | boolean>,
) => void;
```

`@livedocuments/document` additions:

- `LABEL_ESTIMATE_CHAR_EM = 0.55`; `estimatedLabelMeasure(px) = (s) => s.length × px × LABEL_ESTIMATE_CHAR_EM`.
  `labelMeasure` returns it when no canvas context exists, so the headless renders and the lint agree.
- `drawsStandardLabel(el: BoxedElement): boolean`: true unless `svgBoxed` would print no centred label (self-drawing
  shapes except `legend`, collaborate panels, behaviour faces, web components). `svgBoxed` calls it.
- `labelRoom(el): { width: number; height: number }`: `width = labelMaxWidth(el, pad)`;
  `height = el.y + el.height − pad − (bodyTop + pad)`, with `pad` and `bodyTop` exactly as `describeBoxedExport`
  computes them.

Api: `VIEW_NAMES` gains `lint`. `answerTabView` with `view=lint` runs `lintTab(tab)` on the tab it already read and
answers `text/plain; charset=utf-8` with `formatLintReport`, or `application/json` with the `LintReport` for
`json=1`. `budget`, `only` and the other view parameters are refused for `lint` with `400 invalid_value`. The
manifest's view entry lists `lint`; it stays `tokenUsable`, read access.

MCP: `createDocumentOutput.lint: z.array(z.string())`, `addTabOutput.lint: z.string()`,
`updateDocumentOutput.lint: z.string()`, each described as "The diagram lint summary line of the tab as written."
`apps/mcp` depends on `@livedocuments/diagram-lint` for `lintSummaryLine` only.

CLI: `tab lint <doc> [--tab <t>] [--json]`. `--json` prints `LintFinding[]` (`JSON.stringify(findings, null, 2)`).

## Data and persistence

| Field                        | Class   | Notes                                                              |
| ---------------------------- | ------- | ------------------------------------------------------------------ |
| `LintReport`                 | derived | Recomputed on every call from the tab; never stored (LN32)         |
| `LintFinding.refs`           | derived | Refs of the tab linted; a later write can make a prefix ambiguous  |
| `LintFinding.message`, `fix` | derived | May quote a label (`quoteLabel`); the reader already holds the tab |

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
- **N11** A sticky with `textSize: 'scale'` fits its text by design and never overflows. A re-fitted shape's
  label, and a Shift-resized or re-fitted text, is measured at its `textScale` (`labelTextScale`).
- **N12** A box wholly inside another (an icon on a square, a table on a card) is not a `box-overlap`.
- **N18** Two arrows with the same ends: messages name both `orders→bus`; fixes and JSON use each arrow's ref, since
  `orders->bus` would be ambiguous.
- **N19** A label holding control characters, quotes or newlines: `quoteLabel` strips C0 and C1 controls, collapses
  whitespace, cuts at `LINT_LABEL_QUOTE_MAX` with `…` and JSON-escapes it.
- **N20** The lint throws: the caller logs `[lint] failed`; a changeset still lands with `lint unavailable`, the MCP
  prints `lint unavailable`, the view answers 500.
- **N21** A changeset's whole result tab is linted, so faults a person drew earlier appear in an agent's verdict too.

## Security and trust

- The lint reads only what the caller may already read: a changeset's own result, a tab behind the view route's read
  gate (read-only tokens included) It never writes.
- Text output is printed to terminals: every quoted label goes through `quoteLabel` (N19), so a label cannot inject
  terminal escapes. Refs are slugs or hex prefixes by construction.
- Abuse: a crafted tab of 10,000 elements (`MAX_ELEMENTS_PER_TAB`) cannot make the lint quadratic in arrows: the
  pair check is bounded by `LINT_MAX_ARROWS`, and the box and arrow-to-box checks ask the element grid.
- Logs carry counts and codes only: no ids, refs, labels or theme ids.

## Performance and limits

Worst cases, per run:

| Check                   | Cost                                                             | Bound                                            |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| `edge-crossings`        | `n(n−1)/2` bounds tests, then `pathsCross` (segments × segments) | `n ≤ 300`: 44,850 pairs; about 2 ms on one core  |
| `box-overlap`           | One grid query per box, separating-axes test per candidate       | Linear in boxes times neighbourhood              |
| `arrow-behind-box`      | One grid query per arrow, `pathPassesThrough` per candidate      | `PATH_MAX_SAMPLES_PER_SEGMENT` (512) per segment |
| `label-collision`       | `arrowLabelPass`: what every render of the tab already pays      | Labelled arrows × obstacles                      |
| `label-overflow`        | One `wrapLabel` per labelled box                                 | Linear in label characters                       |
| Flow, duplicate, colour | One pass over arrows or boxes; `deriveContainers` once           | Linear, containment `O(n × containers)`          |

- Budget: a tab of 300 boxes and 300 arrows lints within `LINT_BUDGET_CPU_MS` of CPU, the spec's "a few
  milliseconds" for the pair checks with room for the label pass (LN35): measured at about 10 ms (16 ms under
  coverage). The gate is growth: four times the tab costs under eight times as much, since coverage on a CI runner
  pushed the absolute figure past 50 ms.
- Changesets: one lint per changeset in the api worker, inside the request it already handles; no extra subrequest.
  The view lints the tab it read; MCP `create_document` adds one view request per created tab.
- Bundle: the api and MCP workers already bundle `@livedocuments/document`; `diagram-lint` adds only its own sources.
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

Messages, with `{a}` a box ref, `{x→y}` an arrow named by its ends (`arrowName`, the arrow's ref when an end is not a
box), `{label}` a `quoteLabel`:

| Code               | Message                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `box-overlap`      | `{a} overlaps {b}`                                                                                            |
| `arrow-dangling`   | `{arrow} points at a missing element`                                                                         |
| `arrow-behind-box` | `{x→y} passes behind {a}[, {b}…]`                                                                             |
| `edge-crossings`   | `{x→y}, {x→y}, {x→y} +{k}: {n} crossings among {m} arrows, limit {l}`                                         |
| `label-collision`  | `{x→y} label overlaps {a}[, {b}…]`; struck: `{x→y} label struck by {p→q}[, …]`                                |
| `label-overflow`   | `{a} needs {n} lines, holds {h}`; a card `{a} title[ and subtitle] cut short`                                 |
| `node-isolated`    | `{a} has no arrows`                                                                                           |
| `duplicate-label`  | `{a}, {b}[, …] share {label}`                                                                                 |
| `flow-backwards`   | `{x→y} points {dir}, against the flow {flow}`                                                                 |
| `text-overflow`    | `{a} needs {n} lines, holds {m}`, or `{a} prints over {b}`; fix `set {a} height={h}`, or `move {b} below:{a}` |

Fixes (LN29) are edit operations in line form: `; ` runs them in order, `, or ` separates alternatives, and `<ref>`
and `<text>` are placeholders an agent fills in. `{arrow}` is `arrowSelector`: `x->y` when exactly one arrow joins them
that way, else the arrow's ref (N18).

| Code               | Fix                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `box-overlap`      | `move {b} right-of:{a}`                                                                                                                                                                                                                                                                                                                             |
| `arrow-dangling`   | `rm {arrow}`                                                                                                                                                                                                                                                                                                                                        |
| `arrow-behind-box` | The first other line style (`angled`, `curved`, `straight`, `restyle.ts`) whose route passes behind no box but its ends: `set {arrow} line={style}`; none: `move {box} by={dx},{dy}`, the first box clear of the line by `LINT_MOVE_CLEAR` across its first run through it, the shorter way                                                         |
| `edge-crossings`   | `layout type:shape`; on a tab with stacks, of the most-crossed arrows (up to `LINT_REFS_PER_FINDING_MAX`), the first whose line style (`angled`, `curved`, `straight`) strictly lowers its own crossings, `set {arrow} line={style}`; none: `move a box so {arrow} crosses fewer lines` (advice: a suggested style that added crossings oscillated) |
| `label-collision`  | `set {arrow} label="<at most {n} characters>"`; struck, with a clear spot (the first of 0.25, 0.75, 0.33, 0.67, 0.5, 0.15, 0.85 along its own line whose plate meets no box and no line): `set {arrow} labelOffset={"t":{t},"offset":0}`                                                                                                            |
| `label-overflow`   | `set {a} text=sm` (when larger), else `set {a} label="<text>" note="<text>"`; a cut card `set {a} width={w}`, the width that holds it                                                                                                                                                                                                               |
| `node-isolated`    | `connect <ref> -> {a}`                                                                                                                                                                                                                                                                                                                              |
| `duplicate-label`  | `set {b} label="<text>"`                                                                                                                                                                                                                                                                                                                            |
| `flow-backwards`   | `rewire {arrow} from={y} to={x}`                                                                                                                                                                                                                                                                                                                    |

## Observability

| Fingerprint                      | Level | Where                            | Fields                                                                                                                                        |
| -------------------------------- | ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `[lint] run`                     | info  | `lintTab`                        | `source`, `elements`, `boxes`, `arrows`, `skipped`, `errors`, `warnings`, `infos`, one count per code with findings, `crossingsSkipped`, `ms` |
| `[lint] crossings skipped`       | warn  | `lintTab`                        | `arrows`, `max`                                                                                                                               |
| `[lint] failed`                  | error | changeset route, view route, MCP | `where` (`changeset`, `view`, `mcp`), the error's message and stack                                                                           |
| `[element-grid] skipped element` | debug | `buildElementGrid`               | Existing; fires for a box with an unusable rect                                                                                               |

`LintOptions.log` defaults to `consoleLintLogger` (`console.info` / `warn` / `debug` by fingerprint); the CLI passes
its debug logger, which writes to stderr only when debugging is on, so stdout stays data (LN30). No telemetry pair is
added: the front doors already count the verbs (`Cli·Used·TabLint`, `Mcp·Used`).

## Testing

| Spec rule                                                                                               | Test                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each code fires on its fixture and not on its clean twin (10 × 2)                                       | `packages/diagram-lint/src/checks/<code>.test.ts`                                                                                                       |
| Errors judge the graph: boxes no arrow connects may overlap; a free line never dangles                  | `packages/diagram-lint/src/checks/box-overlap.test.ts` › "leaves decoration alone", `packages/diagram-lint/src/checks/arrow-dangling.test.ts`           |
| A box wholly inside another is not an overlap                                                           | `packages/diagram-lint/src/checks/box-overlap.test.ts` › "one holds the other wholly"                                                                   |
| `node-isolated` judges shapes only, when most boxes are connected                                       | `packages/diagram-lint/src/checks/node-isolated.test.ts`                                                                                                |
| Severity per code is the spec's                                                                         | `packages/api-schema/src/lint.test.ts`                                                                                                                  |
| Refs are the views' refs                                                                                | `packages/diagram-lint/src/lint.test.ts` › "prints the refs the views print"                                                                            |
| Deterministic: same tab, same report, same order                                                        | `packages/diagram-lint/src/lint.test.ts` › "is deterministic", `../packages/diagram-lint/src/order.test.ts`                                             |
| Every tab fix parses and applies as edit operations (placeholders filled), and every code has a fixture | `packages/diagram-lint/src/fixes.test.ts` › "cover every code"                                                                                          |
| Bounded: above `LINT_MAX_ARROWS` only crossings skip, summary says so                                   | `packages/diagram-lint/src/checks/edge-crossings.test.ts` › "skips the pair check"                                                                      |
| Pair checks stay within budget                                                                          | `packages/diagram-lint/src/performance.test.ts`: 75 to 300 boxes and arrows under 8× the CPU (`cpuMsOf`)                                                |
| Logs `[lint] run` with counts, never content                                                            | `packages/diagram-lint/src/lint.test.ts` › "logs one run with counts, never content"                                                                    |
| Summary line, plurals, verdict, footer part, `empty`, `clean`                                           | `../packages/diagram-lint/src/format.test.ts`                                                                                                           |
| One finding a line, refs first, fix last, columns, elision; the spec's example byte for byte            | `../packages/diagram-lint/src/format.test.ts`                                                                                                           |
| `quoteLabel` strips controls and cuts                                                                   | `../packages/diagram-lint/src/format.test.ts` › "quoteLabel"                                                                                            |
| Graph-authored boxes never overflow their labels                                                        | `packages/diagram-lint/src/checks/label-overflow.test.ts` › "sized for its label"                                                                       |
| Templates draw without errors                                                                           | `packages/diagram-lint/src/templates.test.ts`: every `@livedocuments/templates` kind lints with 0 errors                                                |
| Headless renders and the lint measure alike; `drawsStandardLabel`, `labelRoom`                          | `packages/document/src/svg-render-label-room.test.ts`                                                                                                   |
| The api serves the lint as a view, text and `json=1`, read gate, failure                                | `apps/api/src/routes/document-views-route.test.ts` › "the lint over REST", `apps/api/src/routes/document-views-lint-failure.test.ts`                    |
| A changeset's footer carries the verdict; whole tab; dry run; revert; failure                           | `apps/api/src/routes/changesets.test.ts`, `apps/api/src/changesets/lint.test.ts`, `apps/api/src/changesets/lint-failure.test.ts`                        |
| MCP write results carry the summary line                                                                | `apps/mcp/src/create-document-placement.test.ts` › "create_document lint", `apps/mcp/src/changeset-client.test.ts`, `apps/mcp/src/image-result.test.ts` |
| `tab lint`, `--json`, exit 1 on errors                                                                  | `apps/cli/src/dispatch/dispatch.test.ts` (CLI blueprint)                                                                                                |

## Constants and configuration

| Constant                    | Value | Provenance                                                                                                                                                   | Safe range  |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `LINT_CROSSINGS_PER_ARROW`  | 0.25  | Spec                                                                                                                                                         | 0.1 to 1    |
| `LINT_MAX_ARROWS`           | 300   | Spec                                                                                                                                                         | 100 to 1000 |
| `LINT_OVERLAP_TOLERANCE_PX` | 2     | `PATH_INSIDE_INSET_PX`: touching is not overlapping (LN3)                                                                                                    | 0 to 8      |
| `LABEL_ESTIMATE_CHAR_EM`    | 0.55  | `labelMeasure`'s headless fallback, lifted into a name (LN4)                                                                                                 | 0.5 to 0.6  |
| `LINT_MEASURE_EPOCH`        | -1    | A `fontEpoch` no browser uses, so estimates never share cached widths (LN33)                                                                                 | any < 0     |
| `LINT_GRAPH_MIN_CONNECTED`  | 2     | A graph has at least one arrow between two boxes (LN11)                                                                                                      | 2 to 4      |
| `LINT_GRAPH_MIN_SHARE`      | 0.5   | "Otherwise a graph": most boxes are connected (LN11)                                                                                                         | 0.5 to 0.9  |
| `LINT_MOVE_CLEAR`           | 16    | A label plate's height and some: a moved box clears the line it sat on                                                                                       | 8 to 32     |
| `LINT_LABEL_RUN_PAD`        | 16    | Room a label keeps either end of its run, as graph input's `LABEL_RUN_MARGIN`; `{n}` = (longest run − 2 × pad) ÷ the plate's width per character, at least 3 | 8 to 24     |
| `LINT_FLOW_MIN_ARROWS`      | 3     | A direction needs a few arrows to be a flow (LN15)                                                                                                           | 2 to 6      |
| `LINT_FLOW_MIN_SHARE`       | 0.6   | A clear majority; a radial mind map has none (LN15)                                                                                                          | 0.5 to 0.8  |
| `LINT_FLOW_TOLERANCE_PX`    | 8     | Sideways arrows between neighbours in one rank are not backwards (LN15)                                                                                      | 0 to 24     |
| `LINT_MAX_LINES_PER_CODE`   | 10    | Keeps the report near 100 tokens on a hand-coloured tab (LN20)                                                                                               | 3 to 50     |
| `LINT_REFS_PER_FINDING_MAX` | 3     | Arrows named in the `edge-crossings` message; JSON lists all (LN9)                                                                                           | 1 to 10     |
| `LINT_LABEL_QUOTE_MAX`      | 40    | `GRAPH_LABEL_MAX`: a heading's length (LN21)                                                                                                                 | 20 to 80    |
| `LINT_MESSAGE_COLUMN_MAX`   | 48    | The fix column stays inside a 100-column terminal (LN19)                                                                                                     | 32 to 64    |
| `LINT_BUDGET_CPU_MS`        | 50    | 300 × 300 with the label pass; a measured aim, the gate is growth (LN35)                                                                                     | 20 to 200   |

No environment variable, binding or migration; a deploy needs nothing.

## Defaults ledger

LN1 to LN40 in [DEFAULTS.md](DEFAULTS.md).
