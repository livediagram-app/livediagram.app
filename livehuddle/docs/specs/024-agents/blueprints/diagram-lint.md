# Diagram lint: blueprint

> **No MCP server or CLI in livehuddle** ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)):
> the REST API is the only front door, and agents reach it through the agent tools. Where this file names the MCP or
> the CLI, it records livediagram's front doors over the same engine, where this design came from; their wire values
> (`mcp`, `cli`) still parse.

> **No arrow is drawn as one** ([The element engine](../../002-project-scope/not-in-livehuddle.md#the-element-engine), part 4): a stored arrow is a retired element
> that joins nothing. The checks that read arrows went with them (`arrow-dangling`, `arrow-behind-box`,
> `edge-crossings`, `label-collision`, `node-isolated`, `flow-backwards`), and so did the two that judged the graph
> the arrows drew (`box-overlap` and `aspect-extreme` named only boxes an arrow joins, and none is joined now). What
> is left: `label-overflow`, `duplicate-label`, `colour-on-themed` and `text-overflow`, where `colour-on-themed`
> judges boxed elements only. The codes and the `crossings`, `behind`, `overlaps` and `arrows` measures stay on the
> wire, always nothing (`skipped.crossings` false), so a reader of the JSON keeps working. `LintOptions.flow` and the
> lint context's arrow, grid and graph fields are gone; a stored arrow's line and card still count toward the extent.

> **The layout containers left livehuddle** ([The element engine](../../002-project-scope/not-in-livehuddle.md#the-element-engine), part 3): a stored `frame`, `lane`, `stack` or `boundary` is a retired backdrop that holds nothing and paints at the back, so the lint counts it as no box, and the group codes (`group-escape`, `group-split-edges`), the graph source (`lintGraph`, `graph lint`, `--compare`) and the card checks went with the containment rule and the graph input.

Derived from [Diagram lint](../diagram-lint.md), with the result footer of [Edit operations](../edit-operations.md#results),
the refs and `?view=` route of [Document views](../document-views.md), the write path of
[Agent changesets](../agent-changesets.md), the commands of the [CLI](../../../../../livediagram/docs/specs/015-api/cli.md) and the graph input of the
[MCP server](../../../../../livediagram/docs/specs/015-api/mcp-server.md) §4.7. The spec decides; this file only adds engineering precision. Defaults
applied where the spec is silent or qualitative are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `LNn`.

Scope, by file:

| File                                                                  | Role                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/diagram-lint/{package.json,tsconfig.json,oxlint.config.ts}` | The package `@livehuddle/diagram-lint`; depends on `@livehuddle/document` and `@livehuddle/api-schema` (tests also on `templates` and `edit-operations`)                                                               |
| `packages/diagram-lint/vitest.config.ts`                              | `defineProject`, node environment, 100% coverage thresholds (as the former explorer-lens package did)                                                                                                                  |
| `packages/diagram-lint/src/index.ts`                                  | The barrel: `lintTab`, `coloursSet`, `withoutFindings`, the formatters, the constants                                                                                                                                  |
| `packages/diagram-lint/src/constants.ts`                              | Re-exports the shared `LINT_*` constants from `../packages/diagram-lint/src/constants.ts`; this product's checks add none of their own                                                                                 |
| `packages/diagram-lint/src/context.ts`                                | `prepareLintContext`: the theme, visible elements, refs, boxes and the count of skipped rects; `refOf`                                                                                                                 |
| `packages/diagram-lint/src/boxes.ts`                                  | `isLintBox`                                                                                                                                                                                                            |
| `packages/diagram-lint/src/checks/<code>.ts` (+ test)                 | One file per code that still fires, each `(input: CheckInput) => RawFinding[]`; its test has a finding and a clean twin                                                                                                |
| `packages/diagram-lint/src/checks/index.ts`, `types.ts`               | `LINT_CHECKS`: `label-overflow`, `duplicate-label`, `colour-on-themed` in code order (`text-overflow`'s `textOverprint` is added by `lintTab`); `RawFinding`, `CheckInput`, `Check`                                    |
| `packages/diagram-lint/src/measures.ts`                               | `lintExtent`: the summary line's extent                                                                                                                                                                                |
| `packages/diagram-lint/src/theme-colours.ts`                          | `themeColourSet(themeId, el, field)`: every fill or stroke a built-in theme paints on that element                                                                                                                     |
| `packages/diagram-lint/src/colours-set.ts`, `without-findings.ts`     | `coloursSet(before, after)`: the ids a write coloured; `withoutFindings(report, code)`: a report with one code taken out and recounted                                                                                 |
| `packages/diagram-lint/src/fixes.ts`                                  | `fixes`: the fix catalogue, one function per code that fires                                                                                                                                                           |
| `../packages/diagram-lint/src/quote.ts`                               | `quoteLabel` (shared, `@liveworkspace/diagram-lint`)                                                                                                                                                                   |
| `packages/diagram-lint/src/order.ts`                                  | `sortFindings`: `../packages/diagram-lint/src/order.ts`'s `createSortFindings` bound to this product's `LINT_CODES` and `LINT_SEVERITY`; the finding shapes it reads are in `../packages/diagram-lint/src/findings.ts` |
| `../packages/diagram-lint/src/format.ts`                              | `lintSummaryLine`, `lintVerdict`, `lintFooterPart`, `formatLintReport` over any product's codes (shared, `@liveworkspace/diagram-lint`)                                                                                |
| `packages/diagram-lint/src/lint.ts`                                   | `lintTab`                                                                                                                                                                                                              |
| `../packages/diagram-lint/src/log.ts`                                 | `LintLogger`, `consoleLintLogger`, the `[lint]` fingerprints (shared, `@liveworkspace/diagram-lint`)                                                                                                                   |
| `packages/diagram-lint/src/fixtures/build.ts`                         | Fixture builders (boxes, stored arrows) and a quiet lint                                                                                                                                                               |
| `packages/api-schema/src/lint.ts` (+ test), `index.ts`                | Wire types: `LINT_CODES`, `LINT_SEVERITIES`, `LINT_SEVERITY`, `LintFinding`, `LintReport`, `LintMeasures`, `isLintCode`                                                                                                |
| `packages/api-schema/src/document-views.ts`                           | `VIEW_NAMES` gains `lint`; `LINT_VIEW_NAME`                                                                                                                                                                            |
| `packages/api-schema/src/changesets.ts`                               | `ChangesetResponse.lint` and `RevertResponse.lint`: `LintReport \| null`                                                                                                                                               |
| `packages/document/src/svg-render-primitives.ts`                      | `LABEL_ESTIMATE_CHAR_EM`, `estimatedLabelMeasure`; `labelMeasure`'s fallback calls it                                                                                                                                  |
| `packages/document/src/svg-render-describe.ts`, `svg-render.ts`       | `selfLabelled` (lifted from `svgBoxed`'s label condition), `drawsStandardLabel`, `labelRoom`                                                                                                                           |
| `packages/document/src/{element-refs,retired-kinds}.ts`               | Shared homes, consumed here: `computeRefs`, `isRetiredBackdrop`                                                                                                                                                        |
| `apps/api/src/routes/document-views-route.ts`                         | `parseViewQuery` reads `view=lint` (only `json`); `answerTabView` answers it with `lintTab`                                                                                                                            |
| `apps/api/src/changesets/lint.ts`                                     | `lintResult`, `lintLog`: the result tab's lint for writes, dry runs and reverts; `[lint] failed`                                                                                                                       |
| `apps/api/src/changesets/{submit,revert}.ts`                          | `lintFooterPart` fills the footer's lint slot; `lint` on the response                                                                                                                                                  |
| `apps/api/src/openapi/manifest.ts`                                    | The tab view parameter lists `lint`                                                                                                                                                                                    |
| the CLI's `tab` command (CLI blueprint)                               | `tab lint` reads the view; `--json`, exit codes                                                                                                                                                                        |
| `docs/development/architecture.md`, `README.md`                       | The package in the layout and its one-paragraph description                                                                                                                                                            |

The root `AGENTS.md` repo layout lists packages; its line for `diagram-lint/` needs the operator's permission to add.

## Domain and naming

| Term         | Identifier                                                   | Meaning                                                                                                                                                  |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagram lint | `@livehuddle/diagram-lint`, `lintTab`                        | The check of how a tab is drawn                                                                                                                          |
| Lint finding | `LintFinding`                                                | One problem: code, severity, refs, message, fix                                                                                                          |
| Code         | `LintCode`, `LINT_CODES`                                     | The twelve kebab-case codes of the spec, in the spec's table order; four fire (`label-overflow`, `duplicate-label`, `colour-on-themed`, `text-overflow`) |
| Severity     | `LintSeverity` (`error`, `warning`, `info`), `LINT_SEVERITY` | Fixed per code by the spec                                                                                                                               |
| Fix          | `LintFinding.fix`                                            | Edit operations in the line form; every finding has one                                                                                                  |
| Lint report  | `LintReport`                                                 | Measures, findings in order, severity counts, what was skipped                                                                                           |
| Measures     | `LintMeasures`                                               | Crossings, behind, overlaps, extent: the summary line's numbers; all but the extent and the box count are always 0                                       |
| Summary line | `lintSummaryLine(report)`                                    | `0 crossings · 0 behind · 0 overlaps · 1317×1196 → 1 warning, 1 info`                                                                                    |
| Verdict      | `lintVerdict(report)`                                        | The part after `→`: `clean`, or the severity counts                                                                                                      |
| Footer part  | `lintFooterPart(report)`                                     | `lint {verdict}`: what a changeset result's last line carries                                                                                            |
| Box          | `isLintBox`                                                  | A boxed element with a finite rect that is not a stored backdrop (`isRetiredBackdrop`), text, annotation, freehand or path (LN2)                         |

Banned: "issue", "warning" or "lint error" for a finding (a warning is a severity), "problem" in copy, "node" for
a box, "rule" for a code, "score" for measures.

## Behaviour and state

The lint is a pure function: no state, no clock, no randomness, no I/O but one log line.

`lintTab(tab, options)` runs in this sequence:

1. **Prepare** (`prepareLintContext`):
   - `visible` = `tab.elements`; every element is checked.
   - `refs` = `computeRefs(tab.elements ids)` (`@livehuddle/document`), the refs every view prints.
   - `boxes` = `visible.filter(isLintBox)`. A boxed element with a non-finite rect is counted in `skipped` and
     checked by nothing.
   - A stored arrow is a retired element: nothing in the context reads its ends.
2. **Measure**: `lintExtent(ctx)` = `contentBounds` of the visible elements with a finite rect (a stored arrow's
   line and card included) rounded to whole px, or null when nothing is visible. `crossings`, `behind`, `overlaps`
   and `arrows` are 0, and `skipped.crossings` is false.
3. **Check**: each entry of `LINT_CHECKS`, in code order, then `textOverprint` (`text-overflow`), returns its
   findings (granularity LN36).
4. **Order** (`sortFindings`, LN18): severity (`error`, `warning`, `info`); then code order; then the primary
   subject's reading position (rounded top `y`, then `x` of its rect); then the refs joined by a space. **Count** by
   severity, **log** `[lint] run`, return the report.

There is no graph source: `lintGraph`, `graphEdgeIds` and `compareGraphLayouts` left with the graph input
(docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3). There is no `flow` option and no
flow inference: both read arrows (part 4).

### The checks

| Code               | Fires when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | One finding per | Refs                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------- |
| `label-overflow`   | A box with `drawsStandardLabel(el)`, a non-blank `label` and `textSize` not `scale` (LN6) wraps to more lines than it holds: `wrapLabel(label, room.width, estimatedLabelMeasure(px), true).length > max(1, floor(room.height / (px × LABEL_LINE_HEIGHT)))`, with `px = fontSizeFor(textSize, type === 'sticky')` and `room = labelRoom(el)` (LN5, LN7)                                                                                                                                                                                                                                                                             | Box             | Box                                 |
| `duplicate-label`  | Two or more boxes whose labels match after trimming, collapsing whitespace and lower-casing; blank labels never match (LN14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Label           | Boxes in paint order                |
| `colour-on-themed` | A boxed element's `fillColor` or `strokeColor`, among its `themeColourFields`, is a hex, bound to no preset or swatch (`colorPreset` on a shape; `fillSwatch` for fill, `strokeSwatch` for stroke) and not in `themeColourSet(tab.theme, field)`. A stored arrow is never reported (its colours are not the agent's to change); stickies, images, link cards and videos have no theme fields (LN17, LN39); a `themeLockFill` shape's fill is not among its theme fields. `LintOptions.coloured` (the api's changeset lint passes `coloursSet(before, after)`, an empty set for a replace landing a template) limits it to those ids | Element         | Element                             |
| `text-overflow`    | Visible text elements with a label, neither on an arc (`textArc`) nor turned (`rotation` not a multiple of 360). On any tab (`textOverprint`): two such texts whose drawn lines overlap by more than `LINT_OVERLAP_TOLERANCE_PX`, found by a sweep sorted by top edge. Every template lints with none (`templates.test.ts`)                                                                                                                                                                                                                                                                                                         | Text pair       | Text element (the first), the other |

Gone (part 4): `box-overlap`, `arrow-dangling`, `arrow-behind-box`, `edge-crossings`, `label-collision`,
`node-isolated`, `flow-backwards` and `aspect-extreme`, with `inferFlow`, `crossingPairs`, the arrow names
(`arrowName`, `arrowSelector`), the element grid and the arrow label pass. Their codes stay in `LINT_CODES` and
never fire.

`themeColourSet(themeId, el, field)`: undefined, `brand` and every `THEMES` id resolve to their definitions; the set
holds the theme's `elementFill` (or `elementStroke`), or where the theme leaves it null the element type's own default on
either surface (`defaultFillColor`, `defaultStrokeColor`), every `palette` entry's and `rootColor`'s `fill` (or `stroke`),
and every `shapeColors` entry's. For `brand` both `DEFAULT_SCHEME_LIGHT` and `DEFAULT_SCHEME_DARK` contribute, as
`backdropVariants` treats the backdrop. Any other id (one no catalogue entry names) returns null: the check is skipped and logged.

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
the api refuses exits with the CLI's code for it. No code that still fires is an error, so livehuddle's lint never
exits 1.

## Interfaces and contracts

`packages/api-schema/src/lint.ts` (wire types live with every DTO the api emits, LN25). Every code and measure stays
on the wire so a reader of the JSON keeps working:

```ts
export const LINT_CODES = [
  'box-overlap', // never fires (part 4)
  'arrow-dangling', // never fires (part 4)
  'arrow-behind-box', // never fires (part 4)
  'edge-crossings', // never fires (part 4)
  'label-collision', // never fires (part 4)
  'label-overflow',
  'node-isolated', // never fires (part 4)
  'duplicate-label',
  'flow-backwards', // never fires (part 4)
  'aspect-extreme', // never fires (part 4)
  'colour-on-themed',
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
  crossings: number | null; // always 0
  behind: number; // always 0
  overlaps: number; // always 0
  extent: { width: number; height: number } | null; // rounded px; null when nothing is visible
  arrows: number; // always 0
  boxes: number;
};
export type LintReport = {
  measures: LintMeasures;
  findings: LintFinding[];
  counts: Record<LintSeverity, number>;
  skipped: { crossings: boolean }; // always false
};
```

The changeset response's `lint` field (agent-changesets blueprint) is this `LintReport`, or null when the lint failed.

`@livehuddle/diagram-lint`:

```ts
export type LintOptions = {
  log?: LintLogger;
  coloured?: ReadonlySet<string>;
};
export function lintTab(
  tab: Pick<Tab, 'elements' | 'theme'> & Partial<Pick<Tab, 'opensIn' | 'kind'>>,
  options?: LintOptions,
): LintReport;
export function coloursSet(before: readonly Element[], after: readonly Element[]): Set<string>;
export function withoutFindings(report: LintReport, code: LintCode): LintReport;
export function lintSummaryLine(report: LintReport): string;
export function lintVerdict(report: LintReport): string;
export function lintFooterPart(report: LintReport | null): string; // 'lint clean', or 'lint unavailable' for null
export function formatLintReport(report: LintReport): string; // summary line, then finding lines
export type LintLogger = (
  fingerprint: string,
  fields: Record<string, number | string | boolean>,
) => void;
```

`@livehuddle/document` additions:

- `LABEL_ESTIMATE_CHAR_EM = 0.55`; `estimatedLabelMeasure(px) = (s) => s.length × px × LABEL_ESTIMATE_CHAR_EM`.
  `labelMeasure` returns it when no canvas context exists, so the headless renders and the lint agree.
- `drawsStandardLabel(el: BoxedElement): boolean`: true unless `svgBoxed` would print no centred label (self-drawing
  shapes except `legend`, collaborate panels, behaviour faces except `chair`, web components). `svgBoxed` calls it.
- `labelRoom(el): { width: number; height: number }`: `width = labelMaxWidth(el, pad)`;
  `height = el.y + el.height − pad − (bodyTop + pad)`, with `pad` and `bodyTop` exactly as `describeBoxedExport`
  computes them.

Api: `VIEW_NAMES` gains `lint`. `answerTabView` with `view=lint` runs `lintTab(tab)` on the tab it already read and
answers `text/plain; charset=utf-8` with `formatLintReport`, or `application/json` with the `LintReport` for
`json=1`. `budget`, `only` and the other view parameters are refused for `lint` with `400 invalid_value`. The
manifest's view entry lists `lint`; it stays `tokenUsable`, read access.

MCP: `createDocumentOutput.lint: z.array(z.string())`, `addTabOutput.lint: z.string()`,
`updateDocumentOutput.lint: z.string()`, each described as "The diagram lint summary line of the tab as written."
`apps/mcp` depends on `@livehuddle/diagram-lint` for `lintSummaryLine` only.

CLI: `tab lint <doc> [--tab <t>] [--json]`. `--json` prints `LintFinding[]` (`JSON.stringify(findings, null, 2)`)
(LN38).

## Data and persistence

| Field                        | Class   | Notes                                                              |
| ---------------------------- | ------- | ------------------------------------------------------------------ |
| `LintReport`                 | derived | Recomputed on every call from the tab; never stored (LN32)         |
| `LintFinding.refs`           | derived | Refs of the tab linted; a later write can make a prefix ambiguous  |
| `LintFinding.message`, `fix` | derived | May quote a label (`quoteLabel`); the reader already holds the tab |

Nothing stored: no column, no R2 object, no room op. `agent_changesets` rows do not carry the report; a reader
re-lints the tab through the view.

## Errors and edge cases

- **N1** Nothing to check (an empty tab): no findings, extent null; the summary reads
  `0 crossings · 0 behind · 0 overlaps · empty → clean`.
- **N2** Gone (part 4): no pair check, so nothing is skipped above `LINT_MAX_ARROWS`.
- **N3** Gone (part 4): no arrow is dangling; a stored arrow is a retired element.
- **N5** Gone (part 4): no `on-arrow` end is resolved.
- **N6** Non-finite geometry: the element is skipped by every check and counted in `[lint] run` as `skipped`.
- **N7** Gone (part 4): nothing crosses.
- **N8** Gone (part 4): no self-loop is judged.
- **N9** `label-overflow` judges the estimate, not a browser's font: the same measure every headless render (the
  MCP's PNG, the api's `render.svg`) wraps with, so the lint agrees with the preview an agent sees.
- **N10** Rich text is measured as its plain `label` at the element's base size (LN7).
- **N11** A sticky with `textSize: 'scale'` fits its text by design and never overflows.
- **N12** Gone (part 4): no box is judged for overlap.
- **N13** A stored lane, stack, boundary or frame is a backdrop (docs/specs/002-project-scope/not-in-livehuddle.md
  "The element engine", part 3): no box to any check.
- **N15** A tab theme no catalogue entry names: `colour-on-themed` is skipped and `[lint] theme unresolved` logs at debug.
- **N18** Gone (part 4): no message names an arrow.
- **N19** A label holding control characters, quotes or newlines: `quoteLabel` strips C0 and C1 controls, collapses
  whitespace, cuts at `LINT_LABEL_QUOTE_MAX` with `…` and JSON-escapes it.
- **N20** The lint throws: the caller logs `[lint] failed`; a changeset still lands with `lint unavailable`, the MCP
  prints `lint unavailable`, the view answers 500.
- **N21** A changeset's whole result tab is linted, so faults a person drew earlier appear in an agent's verdict too
  (`colour-on-themed` aside, which names only what the write coloured).
- **N22** A stored arrow, stroke, path or annotation: no check reads it; a stroke, path or annotation is no box, and
  an arrow's line and card count only toward the extent.

## Security and trust

- The lint reads only what the caller may already read: a changeset's own result, a tab behind the view route's read
  gate (read-only tokens included). It never writes.
- Text output is printed to terminals: every quoted label goes through `quoteLabel` (N19), so a label cannot inject
  terminal escapes. Refs are slugs or hex prefixes by construction.
- Abuse: a crafted tab of 10,000 elements (`MAX_ELEMENTS_PER_TAB`) cannot make the lint quadratic: every check is a
  pass over the boxes or the texts, `text-overflow` a sweep sorted by top edge, and stored arrows are read only for
  the extent.
- Logs carry counts and codes only: no ids, refs, labels or theme ids.

## Performance and limits

Worst cases, per run:

| Check              | Cost                                                     | Bound                      |
| ------------------ | -------------------------------------------------------- | -------------------------- |
| `label-overflow`   | One `wrapLabel` per labelled box                         | Linear in label characters |
| `duplicate-label`  | One pass over boxes into a map by normalised label       | Linear                     |
| `colour-on-themed` | One pass over boxed elements; theme sets built per field | Linear                     |
| `text-overflow`    | One wrap per text, then a sweep sorted by top edge       | `n log n` in texts         |
| Extent             | `contentBounds` over the visible elements                | Linear                     |

- Budget: a tab of 300 boxes and 300 stored arrows lints within `LINT_BUDGET_CPU_MS` of CPU (LN35): measured at about
  2 ms. The gate is growth: four times the tab costs under eight times as much, since coverage on a CI runner makes an
  absolute figure flake.
- Changesets: one lint per changeset in the api worker, inside the request it already handles; no extra subrequest.
  The view lints the tab it read; MCP `create_document` adds one view request per created tab.
- Bundle: the api and MCP workers already bundle `@livehuddle/document`; `diagram-lint` adds only its own sources.
- Output: about 100 tokens for a typical tab; at most `LINT_MAX_LINES_PER_CODE` lines per code, then one elision line.

## Presentation and UX

The lint has no web surface; its text output is its interface (CLI, MCP text, changeset footer).

- **Summary line**: `{crossings} · {behind} behind · {overlaps} · {extent} → {verdict}`, the shared format; in
  livehuddle the first three always read `0 crossings · 0 behind · 0 overlaps`.
  - extent: `{w}×{h}` (U+00D7, rounded px) or `empty`;
  - verdict: `clean`, or the non-zero of `1 error` / `{n} errors`, `1 warning` / `{n} warnings`, `{n} info`, joined
    by `, ` (LN22).
- **Finding line**: severity letter (`E`, `W`, `I`), a space, the code padded to 17 characters (the longest code),
  two spaces, the message padded to the longest message printed (at most `LINT_MESSAGE_COLUMN_MAX`), two spaces,
  `fix: {fix}`. Every finding prints its fix (LN19). Each code prints at most `LINT_MAX_LINES_PER_CODE` lines, then
  `… {n} more {code}` (LN20).
- **Changeset footer**: `lintFooterPart`: `lint clean`, `lint 2 warnings, 1 info`, or `lint unavailable`.

Messages, with `{a}` and `{b}` refs and `{label}` a `quoteLabel`:

| Code               | Message                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `label-overflow`   | `{a} needs {n} lines, holds {h}`                                   |
| `duplicate-label`  | `{a}, {b}[, …] share {label}`                                      |
| `colour-on-themed` | `{a} sets its {fill \| stroke \| fill and stroke} on a themed tab` |
| `text-overflow`    | `{a} prints over {b}`                                              |

Fixes (LN29). A fix is edit operations in line form: `; ` runs them in order, `, or ` separates alternatives, and
`<ref>` and `<text>` are placeholders an agent fills in.

| Code               | Fix                                                                          |
| ------------------ | ---------------------------------------------------------------------------- |
| `label-overflow`   | `set {a} text=sm` (when larger), else `set {a} label="<text>" note="<text>"` |
| `duplicate-label`  | `set {b} label="<text>"`                                                     |
| `colour-on-themed` | `set {a} fill= stroke=` (the fields set)                                     |
| `text-overflow`    | `move {b} below:{a}`                                                         |

## Observability

| Fingerprint               | Level | Where                            | Fields                                                                                                |
| ------------------------- | ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `[lint] run`              | info  | `lintTab`                        | `elements`, `boxes`, `skipped`, `errors`, `warnings`, `infos`, one count per code with findings, `ms` |
| `[lint] theme unresolved` | debug | `colour-on-themed`               | none (never the theme id)                                                                             |
| `[lint] failed`           | error | changeset route, view route, MCP | `where` (`changeset`, `view`, `mcp`), the error's message and stack                                   |

`LintOptions.log` defaults to `consoleLintLogger` (`console.info` / `warn` / `debug` by fingerprint); the CLI passes
its debug logger, which writes to stderr only when debugging is on, so stdout stays data (LN30). No telemetry pair is
added: the front doors already count the verbs (`Cli·Used·TabLint`, `Mcp·Used`).

## Testing

| Spec rule                                                                                                   | Test                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each code that fires does so on its fixture and not on its clean twin (four codes)                          | `packages/diagram-lint/src/checks/<code>.test.ts`                                                                                                                                           |
| A themed element: theme colours, presets, swatches and type defaults are not reported; a stored arrow never | `packages/diagram-lint/src/checks/colour-on-themed.test.ts` (every built-in theme, Default, an unknown id)                                                                                  |
| A write is judged on the colours it set                                                                     | `packages/diagram-lint/src/checks/colour-on-themed.test.ts` › "colour-on-themed, judged on what set the colour", `packages/diagram-lint/src/colours-set.test.ts`                            |
| Severity per code is the spec's                                                                             | `packages/api-schema/src/lint.test.ts`                                                                                                                                                      |
| Refs are the views' refs                                                                                    | `packages/diagram-lint/src/lint.test.ts` › "prints the refs the views print"                                                                                                                |
| Deterministic: same tab, same report, same order                                                            | `packages/diagram-lint/src/lint.test.ts` › "is deterministic", `../packages/diagram-lint/src/order.test.ts`                                                                                 |
| Measures: the arrow and overlap ones stay 0, extent and boxes counted                                       | `packages/diagram-lint/src/lint.test.ts` › "counts by severity and measures extent, with no arrow drawn as one"                                                                             |
| Non-finite rects are skipped (N6)                                                                           | `packages/diagram-lint/src/lint.test.ts` › "skips boxes without a usable rect (N6)"                                                                                                         |
| Every tab fix parses and applies as edit operations (placeholders filled), for every code that fires        | `packages/diagram-lint/src/fixes.test.ts` › "cover every code that still fires"                                                                                                             |
| Cost grows with the tab, not faster                                                                         | `packages/diagram-lint/src/performance.test.ts`: 75 to 300 boxes and stored arrows under 8× the CPU (`cpuMsOf`)                                                                             |
| Logs `[lint] run` with counts, never content                                                                | `packages/diagram-lint/src/lint.test.ts` › "logs one run with counts, never content"                                                                                                        |
| Summary line, plurals, verdict, footer part, `empty`, `clean`                                               | `../packages/diagram-lint/src/format.test.ts`                                                                                                                                               |
| One finding a line, refs first, fix last, columns, elision; the spec's example byte for byte                | `../packages/diagram-lint/src/format.test.ts`                                                                                                                                               |
| `quoteLabel` strips controls and cuts                                                                       | `../packages/diagram-lint/src/format.test.ts` › "quoteLabel"                                                                                                                                |
| Boxes sized for their label never overflow their labels                                                     | `packages/diagram-lint/src/checks/label-overflow.test.ts` › "never fires on a box sized for its label"                                                                                      |
| Templates draw without errors                                                                               | `packages/diagram-lint/src/templates.test.ts`: every `@livehuddle/templates` kind lints with 0 errors                                                                                       |
| Headless renders and the lint measure alike; `drawsStandardLabel`, `labelRoom`                              | `packages/document/src/svg-render-label-room.test.ts`                                                                                                                                       |
| The api serves the lint as a view, text and `json=1`, read gate, failure                                    | `apps/api/src/routes/document-views-route.test.ts` › "the lint over REST", `apps/api/src/routes/document-views-lint-failure.test.ts`                                                        |
| A changeset's footer carries the verdict; whole tab; dry run; revert; failure                               | `apps/api/src/routes/changesets.test.ts`, `apps/api/src/changesets/lint.test.ts`, `apps/api/src/changesets/lint-failure.test.ts`                                                            |
| MCP write results carry the summary line                                                                    | `livediagram/apps/mcp/src/create-document-placement.test.ts` › "create_document lint", `livediagram/apps/mcp/src/changeset-client.test.ts`, `livediagram/apps/mcp/src/image-result.test.ts` |
| `tab lint`, `--json`, exit 1 on errors                                                                      | the CLI's `tab` command tests (CLI blueprint)                                                                                                                                               |

## Constants and configuration

| Constant                    | Value | Provenance                                                                 | Safe range |
| --------------------------- | ----- | -------------------------------------------------------------------------- | ---------- |
| `LINT_OVERLAP_TOLERANCE_PX` | 2     | `PATH_INSIDE_INSET_PX`: touching is not overlapping (LN3); `text-overflow` | 0 to 8     |
| `LABEL_ESTIMATE_CHAR_EM`    | 0.55  | `labelMeasure`'s headless fallback, lifted into a name (LN4)               | 0.5 to 0.6 |
| `LINT_MAX_LINES_PER_CODE`   | 10    | Keeps the report near 100 tokens on a hand-coloured tab (LN20)             | 3 to 50    |
| `LINT_LABEL_QUOTE_MAX`      | 40    | `GRAPH_LABEL_MAX`: a heading's length (LN21)                               | 20 to 80   |
| `LINT_MESSAGE_COLUMN_MAX`   | 48    | The fix column stays inside a 100-column terminal (LN19)                   | 32 to 64   |
| `LINT_BUDGET_CPU_MS`        | 50    | 300 boxes and 300 stored arrows; a measured aim, the gate is growth (LN35) | 20 to 200  |

The shared constants file also exports the arrow and graph constants livediagram's checks use
(`LINT_CROSSINGS_PER_ARROW`, `LINT_MAX_ARROWS`, `LINT_MEASURE_EPOCH`, `LINT_GRAPH_MIN_CONNECTED`,
`LINT_GRAPH_MIN_SHARE`, `LINT_FLOW_*`, `LINT_REFS_PER_FINDING_MAX`, `LINT_RING_SPREAD`, `LINT_LABEL_RUN_PAD`,
`LINT_MOVE_CLEAR`); livehuddle re-exports them and no check of its own reads them. `LINT_MAX_ASPECT` and
`LINT_ASPECT_MIN_BOXES` went with `aspect-extreme` (part 4).

No environment variable, binding or migration; deploying needs nothing.

## Defaults ledger

LN2 to LN40 in [DEFAULTS.md](DEFAULTS.md); the rows that judged arrows or the graph they drew are marked gone with
part 4.
