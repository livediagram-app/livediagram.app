# Page lint: blueprint

Derived from [Page lint](../page-lint.md), with the result footer of [Edit operations](../edit-operations.md#results),
the refs and `?view=` route of [Design views](../design-views.md), the write path of
[Agent changesets](../agent-changesets.md) and the commands of the [CLI](../../015-api/cli.md). The spec decides; this
file only adds engineering precision. Defaults applied where the spec is silent or qualitative are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `LNn`.

Scope, by file:

| File                                                               | Role                                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/page-lint/{package.json,tsconfig.json,oxlint.config.ts}` | The package `@livedesign/page-lint`; depends on `@livedesign/design` and `@livedesign/api-schema` (tests also on `templates` and `edit-operations`) |
| `packages/page-lint/vitest.config.ts`                              | `defineProject`, node environment, 100% coverage thresholds                                                                                           |
| `packages/page-lint/src/index.ts`                                  | The barrel: `lintTab`, the formatters, the logger, the constants                                                                                      |
| `packages/page-lint/src/lint.ts`                                   | `lintTab`: prepare, measure, check, order, log                                                                                                        |
| `packages/page-lint/src/context.ts`, `boxes.ts`, `measures.ts`     | The visible elements, refs and boxes (LN1, LN2); the extent (LN16)                                                                                    |
| `packages/page-lint/src/checks/`                                   | `label-overflow`, `text-overflow`, in code order                                                                                                      |
| `packages/page-lint/src/order.ts`, `quote.ts`, `fixes.ts`          | Finding order (LN18), label quoting (LN21), the fix catalogue (LN29)                                                                                  |
| `packages/page-lint/src/format.ts`                                 | The summary line, the verdict, the footer part and the text report (LN19 to LN22)                                                                     |
| `packages/api-schema/src/lint.ts`                                  | The wire types: `LintCode`, `LintSeverity`, `LintFinding`, `LintMeasures`, `LintReport` (LN25)                                                        |
| `apps/api/src/changesets/lint.ts`                                  | `lintResult`: the api's call, logging where it ran, `null` when the lint throws (LN23)                                                                |

## Domain and naming

| Term    | Code                    | Meaning                                                                                            |
| ------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Box     | `isLintBox`             | A boxed element that is not a container, text, annotation, freehand or path (LN2)                  |
| Text    | `lintTexts`             | A visible text element with a non-blank label and a finite rect, neither on a curve nor turned     |
| Ink     | `inkOf` (text-overflow) | Where a text's wrapped lines are drawn, set by its alignment and padding, less the glyphs' leading |
| Finding | `LintFinding`           | Code, severity, refs, message, fix                                                                 |
| Report  | `LintReport`            | `{ measures: { extent, boxes, texts }, findings, counts }`                                         |

## Behaviour and state

`lintTab(tab, { log })` is pure apart from its one log line:

1. **Prepare** (`prepareLintContext`): `visible` = `visibleLayerElements(tab.elements, tab.layers)`; only these are
   checked (LN1). `refs` = `computeRefs` over every element, so refs match the views. `boxes` = the visible
   `isLintBox` elements; visible boxed elements with a non-finite rect are counted as `skipped` and checked by nothing.
2. **Measure**: `lintExtent(ctx)` = `contentBounds` of the visible drawn elements, rounded, or null (LN16);
   `boxes` and `texts` count what the checks read.
3. **Check**: each entry of `LINT_CHECKS`, in code order, returns its findings (LN36).
4. **Order** (`sortFindings`, LN18): severity (`error`, `warning`, `info`); then code order; then the primary
   subject's reading position (rounded top, then left); then the refs.
5. **Log** `[lint] run` with counts (Observability).

### The checks

Every measure is the headless one (`estimatedLabelMeasure`, LN4, LN33), so the lint agrees with the PNG an agent sees.

| Code             | Fires when                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Fix                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `label-overflow` | A box with `drawsStandardLabel(el)`, a non-blank `label` and `textSize` not `scale` (LN6) wraps to more lines than it holds: `wrapLabel(label, room.width, estimatedLabelMeasure(px), true).length > max(1, floor(room.height / (px × LABEL_LINE_HEIGHT)))`, with `px = fontSizeFor(textSize, type === 'sticky')` and `room = labelRoom(el)` (LN5, LN7); or a card whose `pageTitle` / `pageSubtitle` is longer than `lineChars(slot.width, px)` of its `cardLayout` slot | `set b text=sm` when larger than Small, else a shorter label with the rest in a note; a card widened to hold its line |
| `text-overflow`  | For each text: a word wider than its line (`breaks "…" across lines`); else its wrapped lines exceed what its room holds, a quarter line of slack allowed; and for each pair of texts whose inks overlap by more than `LINT_OVERLAP_TOLERANCE_PX` on both axes (`prints over`, LN3), found by a sweep down the page that compares only texts sharing rows                                                                                                                 | `set t width=…`, `set t height=…`, `move b below:a`                                                                   |

### Where it runs

| Caller                            | Input                                                     | Output                                                                                                   |
| --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Changeset (api), write or dry run | The whole compiled result tab                             | `lintFooterPart` in the footer's lint slot: `rev 41→42 · cs_… · lint clean · revert: …`; response `lint` |
| Changeset revert (api)            | The tab after the inverse (LN31)                          | As above: a revert is a changeset                                                                        |
| Rejected changeset                | nothing                                                   | No lint: nothing was applied                                                                             |
| `GET …/tabs/:tabId?view=lint`     | The stored tab, after the route's read gate and redaction | `formatLintReport` as `text/plain`; with `json=1` the `LintReport`                                       |
| MCP `update_design`, `add_tab`  | The changeset response's `lint`                           | `lint` (the summary line) in structured content and a second text block (LN24)                           |
| MCP `create_design`             | `?view=lint&json=1` for each created tab                  | `lint: string[]`, one summary line per tab in `tabIds` order (LN24)                                      |
| CLI `tab lint <doc> [--tab]`      | `?view=lint` (text), or `?view=lint&json=1` with `--json` | The text as served; `--json` prints `report.findings` (LN38)                                             |

The MCP's other write tools (rename, share, comments, trash) change no drawing and carry no lint. A lint that throws
never fails the call that asked for it: the api and the MCP log `[lint] failed` and print `lint unavailable` where the
verdict or summary would go (LN23); the view answers 500 with that message.

`tab lint` exits 1 when `report.counts.error > 0`, else 0; a usage error exits 2 and a view request the api refuses
exits with the CLI's code for it. Both codes are warnings, so a lint alone exits 0 today.

## Interfaces and contracts

`packages/api-schema/src/lint.ts` (LN25):

```ts
export const LINT_SEVERITIES = ['error', 'warning', 'info'] as const;
export const LINT_CODES = ['label-overflow', 'text-overflow'] as const;
export const LINT_SEVERITY: Readonly<Record<LintCode, LintSeverity>>; // both 'warning'
export type LintFinding = {
  code: LintCode;
  severity: LintSeverity;
  refs: string[];
  message: string;
  fix: string;
};
export type LintMeasures = {
  extent: { width: number; height: number } | null;
  boxes: number;
  texts: number;
};
export type LintReport = {
  measures: LintMeasures;
  findings: LintFinding[];
  counts: Record<LintSeverity, number>;
};
```

`@livedesign/page-lint` exports `lintTab`, `formatLintReport`, `lintSummaryLine`, `lintVerdict`, `lintFooterPart`,
`consoleLintLogger`, the `LintLogger` type and the constants.

## Data and persistence

| Item         | Kind    | Note                                                       |
| ------------ | ------- | ---------------------------------------------------------- |
| `LintReport` | derived | Recomputed on every call from the tab; never stored (LN32) |

## Errors and edge cases

- **N1** Nothing visible (empty tab, every layer hidden): no findings, extent null; the summary reads
  `empty · 0 boxes · 0 texts → clean`.
- **N6** Non-finite geometry: the element is skipped by every check and counted in `[lint] run` as `skipped`.
- **N9** The lint judges the estimate, not a browser's font: the same measure every headless render (the MCP's PNG,
  the api's `render.svg`) wraps with.
- **N10** Rich text is measured as its plain `label` at the element's base size (LN7).
- **N11** A box or text with `textSize: 'scale'` fits its text by design and never overflows (LN6); a Shift-resized
  text is measured at its `textScale`.
- **N12** Text on a curve (`textArc`) and turned text (a rotation that is not a whole turn) are left out.
- **N19** A quoted word holding control characters, quotes or newlines: `quoteLabel` strips C0 and C1 controls,
  collapses whitespace, cuts at `LINT_LABEL_QUOTE_MAX` with `…` and JSON-escapes it.
- **N20** The lint throws: the caller logs `[lint] failed`; a changeset still lands with `lint unavailable`, the MCP
  prints `lint unavailable`, the view answers 500.
- **N21** A changeset's whole result tab is linted, so text a person drew earlier appears in an agent's verdict too.

## Security and trust

- The lint reads only what the caller may already read: a changeset's own result, a tab behind the view route's read
  gate (read-only tokens included). It never writes.
- Text output is printed to terminals: every quoted word goes through `quoteLabel` (N19), so a label cannot inject
  terminal escapes. Refs are slugs or hex prefixes by construction.
- Logs carry counts and codes only: no ids, refs or labels.

## Performance and limits

| Check            | Cost                                                        | Bound                                     |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `label-overflow` | One `wrapLabel` per labelled box                            | Linear in label characters                |
| `text-overflow`  | One `wrapLabel` per text; a sorted sweep for the overprints | `n log n`, plus the pairs that share rows |

- Measured (a developer laptop, no coverage): 250 boxes and 250 texts lint in about 4.6 ms of CPU, 1,000 and 1,000 in
  about 7.2 ms. The gate is growth (LN35): four times the tab costs under eight times as much, since coverage on a CI
  runner makes an absolute budget flake.
- The worst case is many texts stacked on the same rows, where the sweep compares every pair that shares them; a tab
  holds at most `MAX_ELEMENTS_PER_TAB` elements, and pages lay text out in rows.
- Changesets: one lint per changeset in the api worker, inside the request it already handles; no extra subrequest.
  The view lints the tab it read; MCP `create_design` adds one view request per created tab.
- Output: about 100 tokens for a typical tab; at most `LINT_MAX_LINES_PER_CODE` lines per code, then one elision line.

## Presentation and UX

The lint has no web surface; its text output is its interface (CLI, MCP text, changeset footer).

- **Summary line**: `{extent} · {boxes} · {texts} → {verdict}`, the extent `W×H` or `empty` (LN22).
- **Verdict**: `clean`, or the non-zero counts joined by `, ` (`1 warning`, `2 warnings, 1 info`).
- **Finding line**: severity letter, code padded to 14, message padded to the longest printed (at most
  `LINT_MESSAGE_COLUMN_MAX`), then `fix: {fix}` (LN19). Each code prints at most `LINT_MAX_LINES_PER_CODE` lines, then
  `… {n} more {code}` (LN20).
- **Fixes** (LN29) are edit operations in the line form, so an agent pastes them into `livedesign edit`; `, or `
  offers alternatives and `<text>` is a placeholder. A ref that is an edit-operations keyword prints as the views
  print it (LN40).

## Observability

Each run logs `[lint] run` with `elements`, `boxes`, `texts`, `skipped`, the severity counts, a count per code and
`ms`. The pure package logs through an injected `LintLogger`, by default `console.info` (LN30); the api adds where it
ran (`designId`, `tabId`). A throw logs `[lint] failed` at the caller. No telemetry event is sent.

## Testing

- One fixture per finding, for each check (`checks/*.test.ts`), built with `packages/page-lint/src/fixtures/build.ts`.
- `order.test.ts` pins the order (LN18); `format.test.ts` the summary, verdict, footer and report lines;
  `fixes.test.ts` that every fix parses as edit operations.
- `templates.test.ts`: every template's text fits its box and prints over no other text, since agents start from them.
- `performance.test.ts`: the growth gate (LN35).
- 100% coverage thresholds in `vitest.config.ts`.

## Constants and configuration

| Constant                    | Value | Why                                                                          | Safe range |
| --------------------------- | ----- | ---------------------------------------------------------------------------- | ---------- |
| `LINT_OVERLAP_TOLERANCE_PX` | 2     | Texts that only touch are not printed over (LN3)                             | 0 to 8     |
| `LINT_MEASURE_EPOCH`        | -1    | A `fontEpoch` no browser uses, so estimates never share cached widths (LN33) | any < 0    |
| `LINT_MAX_LINES_PER_CODE`   | 10    | Keeps the report near 100 tokens (LN20)                                      | 3 to 50    |
| `LINT_LABEL_QUOTE_MAX`      | 40    | A heading's length (LN21)                                                    | 20 to 80   |
| `LINT_MESSAGE_COLUMN_MAX`   | 48    | The fix column stays inside a 100-column terminal (LN19)                     | 32 to 64   |

## Defaults ledger

The LN rows in [DEFAULTS.md](DEFAULTS.md).
