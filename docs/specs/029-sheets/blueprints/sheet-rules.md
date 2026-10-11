# Sheet rules blueprint

Derived from [Data validation](../data-validation.md), [Conditional formatting](../conditional-formatting.md) and the
[Sheet](../sheet.md) spec's **Paint Format** and **Custom** number format. Engine parts live in
`packages/sheets/src/rules/`; editor parts in `apps/live/components/sheets/rules/`.

## Domain and naming

| Spec term            | Identifier                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| validation rule      | `ValidationRule`, `layout.rules`                                                |
| dropdown option      | `DropdownOption` (`v` text, `c` colour)                                         |
| rule kind            | `ValidationKind`: `list`, `range`, `check`, `num`, `date`, `text`               |
| Display              | `show`: absent (Chip), `arrow`, `plain`                                         |
| Reject / Warn        | `warn` absent (Reject) / `warn: true`                                           |
| Help Text            | `help`                                                                          |
| invalid value        | `ruleInvalid(...)` true                                                         |
| format rule          | `FormatRule`, `layout.formatRules` (list order)                                 |
| Single Colour        | `is: 'when'`, with `op` (a `ConditionOp` or `formula`), `a`, `b`, `fx`, `style` |
| Colour Scale         | `is: 'scale'`, with `min`, `mid`, `max` (`ScalePoint`)                          |
| style                | `FormatStyle` (`b`, `i`, `u`, `st`, `fc`, `bg`)                                 |
| Paint Format         | `PaintFormat` state on the controller (`paint`)                                 |
| Custom number format | `nf: 'custom'` and `nc` (the code) on `CellFormat`                              |

## Types (`packages/sheets/src/sheet.ts`)

```ts
export type DropdownOption = { v: string; c?: string };
export type ValidationKind = 'list' | 'range' | 'check' | 'num' | 'date' | 'text';
export type NumOp = 'between' | 'notBetween' | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
export type DateOp =
  'valid' | 'before' | 'onOrBefore' | 'after' | 'onOrAfter' | 'on' | 'between' | 'notBetween';
export type TextOp = 'contains' | 'notContains' | 'exactly' | 'email' | 'url';
export type ValidationRule = IdRange & {
  id: string;
  is: ValidationKind;
  opts?: DropdownOption[]; // list only, 1..500
  src?: IdRange; // range only, on this sheet
  show?: 'arrow' | 'plain'; // list and range only
  op?: NumOp | DateOp | TextOp; // num, date, text only
  a?: number | string; // num/date: a number (a date's day number); text: a string
  b?: number; // between and notBetween only
  warn?: true;
  help?: string;
};
export type FormatStyle = Pick<CellFormat, 'b' | 'i' | 'u' | 'st' | 'fc' | 'bg'>;
export type ScalePoint = { c: string; at: 'min' | 'max' | 'num' | 'pct' | 'pctile'; v?: number };
export type FormatRule = IdRange & {
  id: string;
  is: 'when' | 'scale';
  op?: ConditionOp | 'formula';
  a?: string;
  b?: string;
  fx?: StoredFormula; // op 'formula': written for the range's top-left cell
  style?: FormatStyle;
  min?: ScalePoint;
  mid?: ScalePoint;
  max?: ScalePoint;
};
// SheetLayout gains: rules?: ValidationRule[]; formatRules?: FormatRule[];
// CellFormat gains: nc?: string (with nf 'custom'); NumberFormatKind gains 'custom'.
```

- Rule ids: `newAxisId` form (6 base-36 characters), made by the client; unique per list.
- Text operands are stored as typed; Number and Date operands as numbers (the editor reads a typed date with the
  person's locale, an agent's with `en-GB`).

## Layout changes (`store-layout.ts`)

| Change                                                      | Does                                                                                                            | Inverse (`store.ts`)                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `{ k: 'vrule', id, rule: ValidationRule \| null }`          | Sets (replacing the same id in place, else appended) or removes a validation rule                               | The rule as it was, or `null`              |
| `{ k: 'frule', id, rule: FormatRule \| null, at?: number }` | Sets (in place, else inserted at `at`, else appended) or removes a format rule                                  | The rule as it was at its index, or `null` |
| `{ k: 'fruleOrder', ids: string[] }`                        | Puts the named format rules in that order (ids gone are skipped, unnamed ones keep their slots, `reorderSlots`) | The order before                           |

- Deleting rows or columns shrinks every rule's range, and a `range` rule's `src`, with `shrinkRange`; a rule whose
  range (or `src`) is gone is dropped. `store-inverse-delete.ts` puts back the rules a deletion shrank or dropped, as it
  does named ranges.
- `resetSheetWrite` (Clear Sheet) removes both lists.
- Making a validation rule over a range is one layout write: `subtractRange` (`rules/validation-edit.ts`) gives, for
  each rule the range touches, its removal and its leftover pieces (up to four new rules: the bands above, below, left
  and right of the overlap, in position order, each with a new id), then the new rule. **Remove Validation** is the
  same without the new rule.

## Validation (`validate.ts`)

- `layoutChangeProblem` validates `vrule`, `frule` and `fruleOrder`: ids, ranges on the sheet (`r1..c2` and `src` in
  the layout), kinds and ops from the closed lists, operand types per kind, options (1..500, each 1..255 characters,
  distinct case aside, colours `isColour`), `help` up to 255, styles through `validFormatValue`, scale points (colour,
  `at` from the list, `v` finite where `num`/`pct`/`pctile`, `min` only at the Minpoint and `max` only at the
  Maxpoint, `pct` and `pctile` 0..100), and `fx` through `inputProblem` (as a formula input) and up to
  `FORMAT_RULE_FORMULA_MAX`. `sheetProblem` refuses more than `VALIDATION_RULES_MAX` or `FORMAT_RULES_MAX`
  (`rules_full`). `validateSheetCreate` checks a seed's rules the same way.
- `validFormatValue('nc', v)`: a string 1..`FORMAT_CODE_MAX` that `formatCodeReads` accepts; `nf: 'custom'` is valid.
- `validateWrite(sheet, write, opts?: { checkRules?: boolean; rangeValues?: RangeValues })`: after its own checks,
  when `checkRules !== false` and the write is a `cells` write or carries cells, each cell change with a non-null,
  non-formula input is looked up (`validationRuleAt`) and checked (`inputAllowed`); the first refused one answers
  `{ ok: false, error: 'value_invalid', at: cellKey, line }`. A `range` rule is checked only when `rangeValues` is
  given (the editor); without it (the api) it is skipped.
- `SheetRejection` gains `value_invalid` and `rules_full`; `Validation` gains `line?: string`.

## Engine (`packages/sheets/src/rules/`)

- `rule-index.ts`: `ruleIndex<T extends IdRange>(layout, list)` buckets each rule by its column positions (a
  `Map<colPos, { rule, r1, r2 }[]>`), cached per `(layout, list)` in a `WeakMap`; `ruleAtPos(index, r, c)` scans the
  column's bucket (validation: the one rule; format: every rule in list order).
- `validation.ts`: `validationRuleAt(layout, r, c)`, `inputAllowed(rule, input, ctx)` (`ctx`: `locale`, `options?` for a
  range rule), `valueAllowed(rule, value, shown, ctx)` (for drawing: a formula's value, an existing value),
  `ruleLine(rule, ctx)` (the spec's lines, a date in the locale, options "and N more" after 5), `optionFor(rule, text)`
  (an option matching case aside, for saving the option's own spelling), `rangeOptions(wb, sheetId, rule)` (the src
  range's distinct shown values, empty aside, up to 500), `isEmail`, `isUrl`, and `checkboxValue(input)` (`true` /
  `false` / `null` for empty / `undefined` for anything else).
- `validation-edit.ts`: `subtractRange(layout, range, rand)`, `setValidationRule(layout, rule, rand)` and
  `removeValidation(layout, ranges, rand)` returning a layout `SheetWrite` or `null`; `toggleCheckboxes(wb, sheetId,
ranges)` (the Space and press write; `null` when no checkbox cell is selected).
- `format-rules.ts`: `formatRuleStyle(wb, sheetId, r, c, value, shown)` returns the first met rule's `FormatStyle` or
  `null`, through a per-workbook cache (`WeakMap<Workbook, { version, scales, moved }>`, reset when `wb.version`
  moves): `scales` holds each scale rule's sorted numbers (min, max, percentiles); `moved` each `(rule id, dr, dc)`
  formula moved by `shiftForCopy`. A `formula` rule is worked out with `Workbook.evaluateAt(sheetId, r, c, stored)`,
  a scalar read through the engine's frame with no dependency or value kept. `mixColour(a, b, t)` blends sRGB.
  `formatRuleLine(rule, locale)` gives the list row's line.
- `Workbook.evaluateAt(sheetId, r, c, stored)`: evaluates a stored formula as if in that cell, under the read budget,
  returning a scalar (`#ERROR!` when it cannot be read, `#REF!` for a cycle through itself never arises as it is not a
  cell).
- Static render (`engine/render.ts`): a checkbox cell's text is `☑` / `☐` (centred), a chip's fill is its option's
  colour, and a met format rule's style is merged over the cell's own format before drawing.
- Custom number format: `displayValue` with `nf: 'custom'` and `nc` draws `formatCodeText(value, nc)` (numbers right,
  text left); `formatCodeReads(code)` reports whether a code reads (balanced quotes and brackets, at most four `;`
  sections, at most `FORMAT_CODE_MAX` characters).

## Editor (`apps/live/components/sheets/`)

- `rules/SheetRuleCells.tsx`: draws, per visible cell of a rule, the chip, the arrow, the checkbox box and the invalid
  triangle (in the cell layer's regions, via `SheetCells` passing each cell's rule) and takes a press on a chip, an
  arrow or a box; `SheetCells` asks `validationRuleAt` per visible cell only when `layout.rules` is set.
- `rules/SheetDropdownList.tsx`: the option list popover (AnchoredPopover, `OptionRows`, the search field over 8
  options, **Clear**).
- `rules/SheetValidationEditor.tsx`: the rule editor popover; `rules/SheetFormatRules.tsx`: the Conditional
  Formatting popover (list and form); `rules/SheetRuleSettings.tsx`: the two Sheet Settings sections.
- `rules/SheetCustomFormat.tsx`: the Custom Number Format popover.
- `useSheetActions`: `commitEdit` checks the active cell's rule first (`inputAllowed`, normalising a dropdown option's
  spelling) and answers `{ ok: false, message: line }`; `toggleCheckboxes`, `pickOption`, `setValidation`,
  `removeValidation`, `setFormatRule`, `removeFormatRule`, `moveFormatRule`, `customFormat(code)`, `paintFormat`
  (`start(keep)`, `apply(range)`, `stop()`).
- `sheet-store-client.ts`: `WriteOpts` gains `unchecked`; `writeAll` passes `{ checkRules: !undo && !unchecked,
rangeValues }` to `validateWrite` and toasts `value_invalid` as `<A1>: <line>`; `send` adds `unchecked: true` to the
  request body. Imports, card-table sync and template starts write with `unchecked`.
- Keys (`sheet-keys.ts`): Alt+Down opens the active cell's dropdown; Space on a selection with a checkbox cell
  toggles; Escape ends Paint Format first.
- Paint Format: `paint: { clip: SheetClip; keep: boolean } | null` on the controller; the pointer's selection end
  (`useSheetPointer`) calls `paintFormat.apply` with the new range; the grid's cursor is `copy` while it is set.

## Api (`apps/api/src/routes/sheet-write-route.ts`)

- `readWrite` keeps `unchecked: true`; `validateWrite(light, write, { checkRules: !body.undo && !body.unchecked })`.
  A `value_invalid` refusal answers 400 with `at` and `line`. The light sheet holds the layout, so rules are known
  without reading cells.

## Agents (`packages/agent-verbs/src/sheets/`)

- `SheetChange` gains `validate`, `clear_validation`, `conditional_format` and `clear_conditional_formats`, built by
  the engine's `setValidationRule`, `removeValidation` and the `frule` change; `read_sheet` adds `validation` and
  `conditionalFormats` lists, and marks invalid values (`invalid: true`). The MCP schema (`mcp/sheet-schema.ts`)
  describes them.

## Errors and edge cases

| Case                                   | Handling                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| A typed value a Reject rule refuses    | Stays in edit; line under the editor (`sheet.rule.refused` debug log)          |
| A paste or fill with any refused value | Nothing written; toast `<A1>: <line>`                                          |
| A rule over a merged range             | The merge's top-left cell holds the value; the rule's drawing shows there      |
| A checkbox cell holding text           | Drawn as text with the invalid triangle                                        |
| A `range` rule whose src is empty      | No options; every value refused (Reject) with its line                         |
| A format rule formula that errors      | Meets nothing                                                                  |
| A scale over a range with one number   | That number takes the Minpoint's colour                                        |
| A rule split past the limit            | `rules_full`, "This sheet holds the most validation rules it can"              |
| An unknown `nc` code read from storage | `validFormat` refuses it on write; drawn as Automatic if it ever fails to read |

## Security and trust

- Rules are layout: the api's existing role check keeps them an Editor's. `unchecked` skips only the rule check; it
  never widens a role or a limit, and the writer could clear the rule anyway.
- Every stored rule is validated (closed lists, bounded text, bounded counts) since every viewer draws it; a custom
  formula is a stored formula under the engine's read budget, and `nc` is read by the bounded format-code reader.
- Option and help text are drawn as text, never HTML.

## Performance and limits

- `VALIDATION_RULES_MAX = 200`, `FORMAT_RULES_MAX = 100`, `DROPDOWN_OPTIONS_MAX = 500`, `DROPDOWN_OPTION_MAX = 255`,
  `VALIDATION_HELP_MAX = 255`, `FORMAT_RULE_FORMULA_MAX = 1000`, `FORMAT_CODE_MAX = 64`.
- Per visible cell: one bucket scan of the column's rules (at most 200, typically 0 to 3). Each rule's condition is
  read once (`conditionMatcher`, its operands parsed) and kept per rule, never parsed per cell. Measured (October
  2026, a laptop): a 60 × 26 window with 100 format rules covering every cell, none met (156,000 checks, the worst
  case) costs 22 ms of rule work (276 ms before conditions were read once); a test holds it under 150 ms for a loaded
  machine. A sheet with a few rules a column costs well under 1 ms.
- Scale statistics: one pass over the range per workbook version (at most `RANGE_CELLS_MAX` reads, the engine's).
- Write check: per written cell, one bucket scan; a range rule's options once per write.

## Observability

- `Sheet · Changed · Validation` and `Sheet · Changed · ConditionalFormat` (the closed `SHEET_CHANGE_KINDS`).
- The api logs `[sheets] sheets.write.refused` with `value_invalid` and the cell key (never the value).
- The editor's debug log `[sheets] sheet.rule.refused` with the rule kind.

## Testing

- Engine: each rule kind's allowed and refused values and lines; option spelling; checkbox values; subtractRange's
  pieces (inside, partial, corner, covering); layout changes and inverses; delete shrink and inverse; validateWrite with
  and without `checkRules`, and with `rangeValues`; scales (two and three points, each `at`), conditions, list order,
  formula offsets; render model checkbox, chip and styles; custom code reads and draws; the perf budget.
- Api: a Participant's cell write refused by a Reject rule; `undo` and `unchecked` writes stored; a Participant's rule
  change refused.
- Editor: chip and checkbox drawing; press toggles; Space; option list pick; Alt+Down; rule editor Done; format rules
  popover; Paint Format once and kept; Custom format apply; role tests (Participant toggles and picks, sees no rule
  menus; Viewer changes nothing).
- Agents: `validate`, `clear_validation`, `conditional_format`, `clear_conditional_formats`, a refused `set`, and
  `read_sheet`'s lists.

## Constants and configuration

| Constant                  | Value | Provenance                                    | Safe range                 |
| ------------------------- | ----- | --------------------------------------------- | -------------------------- |
| `VALIDATION_RULES_MAX`    | 200   | Spec                                          | 50..1,000                  |
| `FORMAT_RULES_MAX`        | 100   | Spec                                          | 20..500                    |
| `DROPDOWN_OPTIONS_MAX`    | 500   | Spec (Google Sheets allows 500 in its editor) | 50..1,000                  |
| `DROPDOWN_OPTION_MAX`     | 255   | Spec                                          | 64..1,000                  |
| `VALIDATION_HELP_MAX`     | 255   | Spec                                          | 64..1,000                  |
| `FORMAT_RULE_FORMULA_MAX` | 1,000 | Spec                                          | 256..8,000 (`FORMULA_MAX`) |
| `FORMAT_CODE_MAX`         | 64    | Spec                                          | 16..255                    |
| `DROPDOWN_SEARCH_FROM`    | 8     | Spec ("over 8 options")                       | 5..20                      |
| `CHECKBOX_PX`             | 14    | Spec                                          | 12..18                     |
| `INVALID_MARK_PX`         | 6     | Spec                                          | 4..10                      |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D24 to D27.
