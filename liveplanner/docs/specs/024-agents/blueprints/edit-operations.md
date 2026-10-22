# Edit operations: blueprint

Derived from [Edit operations](../edit-operations.md), with the changeset body and limits of
[Agent changesets](../agent-changesets.md), the refs of [Project views](../project-views.md), the `replace` inputs of
[MCP server](../../015-api/mcp-server.md) §4.4 and §4.7, and the token style of
[Explorer filters](../../013-workspace/explorer-filters.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`EOn`; the rows for livediagram's diagram verbs, placements, aliases, colours and make room are retired with them.

The engine is the Plan subset of livediagram's: four operations, five selector terms, and the six element kinds a
liveplanner tab holds. It has no placement, layout, arrow, container or colour logic.

Scope, by file:

| File                                                                       | Role                                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/edit-operations/src/index.ts`                                    | The public surface (listed under [Interfaces and contracts](#interfaces-and-contracts))                        |
| `packages/edit-operations/src/types.ts`                                    | `EditOperation` and one type per operation, `Selector`, `FieldValue`, `ApplyOptions`, outcomes                 |
| `packages/edit-operations/src/vocabulary.ts`                               | `EDIT_OPERATION_NAMES`, `OPERATION_MEMBERS`, `SELECTOR_KEYS`, `FLAG_MEMBERS`, `RESERVED_WORDS`, constants      |
| `packages/edit-operations/src/plan-elements.ts`                            | `PLAN_ELEMENT_KINDS`, `PLAN_ELEMENT_ABOUT`, `PLAN_COMMON_FIELDS`, `PLAN_KIND_FIELDS`, `planElementIssue`       |
| `packages/edit-operations/src/tokenise.ts`                                 | `tokeniseLine`: words, quotes, JSON escapes, columns                                                           |
| `packages/edit-operations/src/parse-line.ts`                               | `parseOperationWords`: one line form line's words into one raw operation; an `add` line is refused             |
| `packages/edit-operations/src/parse-json.ts`                               | `validateEditOperation(s)`: one JSON form object, checked member by member                                     |
| `packages/edit-operations/src/parse.ts`                                    | `parseEditOperations(text)`: lines, comments, form per line, the count cap, errors with line and caret         |
| `packages/edit-operations/src/format-operation.ts`                         | `formatOperation`: the canonical form of an operation (rejection headers, round trips)                         |
| `packages/edit-operations/src/selectors.ts`                                | `parseSelector`, `resolveSelector`, `resolveOne`, `resolveSome`                                                |
| `packages/edit-operations/src/nearest.ts`                                  | `nearestElements`, `nearestName`: banded edit distance over labels and refs                                    |
| `packages/edit-operations/src/fields.ts`                                   | `writeFieldsOnto`, `fieldValue`: the fields a kind takes, identity and live fields, closed vocabularies        |
| `packages/edit-operations/src/state.ts`                                    | `EditState` and its writers (`putElement`, `writeFields`, `removeElement`), memoised refs and element list     |
| `packages/edit-operations/src/locks.ts`                                    | `lockedIds(tab)`: locked elements and elements on locked layers                                                |
| `packages/edit-operations/src/operations/{add,set,rm,test-fields}.ts`      | One file per operation                                                                                         |
| `packages/edit-operations/src/finalise.ts`                                 | Normalise touched, validation with reasons                                                                     |
| `packages/edit-operations/src/apply.ts`                                    | `applyEditOperations`                                                                                          |
| `packages/edit-operations/src/replace.ts`, `dashboard-body.ts`             | `applyReplace`: the `replace` body through the same outcome shape; the Dashboard body check                    |
| `packages/edit-operations/src/element-format.ts`                           | `addableKinds`, `elementKindsText`, `elementFormatText`: what `GET /api/schema` and `liveplanner schema` print |
| `packages/edit-operations/src/results.ts`, `format-results.ts`             | `buildResultLines`, `formatResultLines`, `formatResultFooter`                                                  |
| `packages/edit-operations/src/rejections.ts`                               | `rejection` builders per code, `formatRejections`                                                              |
| `packages/edit-operations/src/fixtures/{sprint-dashboard,run,outcomes}.ts` | A Dashboard tab of six plan views and a bar chart; a line-form runner; outcome readers                         |
| `packages/edit-operations/src/invariants.test.ts`, `performance.test.ts`   | I1 to I5 over one changeset per operation; cost growth with the tab and the changeset                          |

## Domain and naming

| Term           | Identifier                                        | Meaning                                                                                |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Edit operation | `EditOperation` (union on `op`)                   | One step of a changeset, in its JSON form                                              |
| Operation name | `EditOperationName`, `EDIT_OPERATION_NAMES`       | `add set rm test`                                                                      |
| Line form      | `parseEditOperations`, `formatOperation`          | One operation a line, words and quoted values; `add` has none                          |
| JSON form      | `validateEditOperation`                           | One object a line                                                                      |
| Plan element   | `PLAN_ELEMENT_KINDS`, `planKindOf`                | A shape whose `shape` is `plan-board`, `plan-sheet`, `plan-view` or a sheet chart      |
| Selector       | `Selector` (a string), `parseSelector`            | A ref, a quoted label, or `key:value` terms, all of which must match                   |
| Ref            | `computeRefs`, `RefTable`, `resolveRef` (shared)  | An element's short name, as views print it                                             |
| Kind word      | `kindWordOf` (shared)                             | The shape for shapes, else the element type: what `type:` and results print            |
| Field          | `fields` member, `FieldValue`                     | A stored field of the element and its value; `null` unsets                             |
| Live field     | `LIVE_ELEMENT_FIELDS` (`@liveplanner/project`)    | A multi-writer field that travels as a delta; never written by an operation            |
| Lock           | `lockedIds(state)`, `element_locked`              | A locked tab, a locked element, or an element on a locked layer                        |
| Working state  | `EditState`                                       | The tab as the operations have left it so far                                          |
| Touched        | `EditState.touched`                               | Elements an operation created, changed or removed; only these are normalised           |
| Targets        | `targets: ElementId[]`                            | Existing elements the operations resolved; fingerprinted and checked for holds         |
| Created ids    | `createdIds: ElementId[]`                         | Elements the changeset created that are in the next tab                                |
| Outcome        | `ApplyOutcome` = `ApplySuccess \| ApplyRejection` | `{ tab, results, elementOps, inverse, warnings, targets, createdIds }` or `{ errors }` |
| Result line    | `ResultLine` (union on `mark`)                    | One line of a changeset's answer: `+ ~ - !`                                            |
| Warning        | `EditWarning`, `EDIT_WARNING_CODES`               | A named note that does not reject: `no_base`                                           |
| Rejection      | `EditRejection`, `EDIT_REJECTION_CODES`           | A named refusal; the spec's code table                                                 |
| Replace        | `ReplaceBody`, `applyReplace`                     | The other changeset body: a whole tab from a template, dashboard, form or elements     |

Banned: "op" for an edit operation (that is a room `ElementOp`), "action", "command" (a CLI command is a front door),
"batch", "patch", "query" or "filter" for a selector, "handle" or "alias" for a ref.

## Behaviour and state

### The pipeline

`applyEditOperations(tab, operations, options)` runs, in this order. A `target_not_found` is gathered and the
operations after it read on (up to `EDIT_MAX_ERRORS` gathered); any other rejection stops at once, and is answered
after the gathered misses when there are any. Nothing is written while any rejection remains; `[edit-ops] unmatched`
logs the count and the code that stopped the read:

1. **Count.** More than `CHANGESET_MAX_OPERATIONS` operations: `too_large`.
2. **Tab lock.** `tab.locked`: `element_locked` naming the tab, before any operation.
3. **Prepare.** `createState(tab, options, log)`: elements by id, their order, `origin = contentOrigin(tab)` and
   `locked = lockedIds(tab)`; refs and the element list are memoised and cleared by every write.
4. **Apply each operation in order** against the working state, so an element added earlier is addressable later.
   Each operation adds the pre-existing ids it resolved to `state.targets` and records what it touched and created.
   An operation that would change an id in `locked` is `element_locked`.
5. **Finalise** ([Finalise](#finalise)), then validate every touched element with `elementValidationIssue` and the
   whole tab with `isValidTab`; the first issue is `invalid_result`.
6. **Diff.** `elementOps = diffToElementOps(tab.elements, next.elements)`;
   `inverse = diffToElementOps(next.elements, tab.elements)`.
7. **Results.** `buildResultLines(before, after, state)`; `targets` and `createdIds` in first-resolution and
   creation order, each id once (EO46, EO48).

Invariants:

- **I1 Atomic.** An outcome with `errors` carries no tab; the input `tab` is never mutated.
- **I2 Untouched stays identical.** An element no operation touched is the same object in `next.elements` as in
  `tab.elements`, so `diffToElementOps` emits nothing for it.
- **I3 Round trip.** `applyElementOps(tab.elements, elementOps)` equals `next.elements`, and
  `applyElementOps(next.elements, inverse)` equals `tab.elements`.
- **I4 Deterministic.** The same tab, operations and options give the same outcome: no clock, no `Math.random`;
  ids not given come from `options.makeId` (EO8).
- **I5 Locks hold.** No element in `locked` differs between `tab` and `next`.

### Selectors

```text
selector := term ( " " term )*
term     := ref | label | "label~" value | "type:" value | "selected"
ref      := an unquoted word that is not a reserved word and has no ":", "=" or "~"
label    := a quoted value
```

| Term         | Matches                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------- |
| `ref`        | `resolveRef(word, refs)`: the element whose id equals it, else the one id it is a prefix of |
| `"Label"`    | Elements whose `label`, trimmed, equals it trimmed, compared after `toLowerCase()` (EO11)   |
| `label~text` | Elements whose `label` contains the text, compared after `toLowerCase()`                    |
| `type:<v>`   | `kindWordOf(el) === v` or `el.type === v`                                                   |
| `selected`   | The ids in `options.selected` that exist in the state                                       |

- All terms of one selector must match (intersection), listed in element order (EO12).
- `set`, `rm` and `test` need exactly one match; `set` and `rm` accept `all` for one or more. Zero matches is always
  `target_not_found`, `all` included.
- `selected` with `options.selected === null` (the room was not read) or an empty selection: `target_not_found`
  with the detail "nothing is selected" or "the selection could not be read" (EO16).
- The reserved words `selected` and `all` always read as keywords; an element whose id is one is reached by label or
  a longer prefix (EO10). One value a term: a comma in a `key:value` value is `parse_error`.

### Fields and values

- **The fields a kind takes** are `PLAN_COMMON_FIELDS` (`x y width height label locked`) and its
  `PLAN_KIND_FIELDS`: `planBoard`; `planSheet`; `planView`, `textSize`; on a chart `chartSource`, `sheetAnchor`,
  `chartVariant`, `chartLegend`, `chartValues`, `chartPalette`, and `chartAxis` on a bar or line chart. Any other key
  is `unknown_field`, listing those. There are no aliases.
- **Identity** (`id`, `type`, `shape`, `addedBy`) is `invalid_value` ("cannot be changed"). `__proto__`,
  `constructor` and `prototype` are always `unknown_field`.
- **Live fields.** A key in `LIVE_ELEMENT_FIELDS` is `invalid_value`, hinting at the comment commands.
- **Closed vocabularies.** `fieldValueIssue(key, value)` refuses a value off `ELEMENT_FIELD_VALUES[key]` as
  `invalid_value`, naming the values. A `label` must be a string.
- **Value parsing.** JSON form values are JSON. Line form values: a quoted value is a string; an unquoted value is
  read as JSON when the whole value is a JSON number, `true` or `false`, or it starts with `[` or `{`, else it is a
  string (EO19). `key=` is `null`: the field is removed.
- **Merge.** Fields merge with `mergeElementUpdate`: a nested object replaces the old one whole.
- **Geometry** named is stored, absolute coordinates (EO20).

### Operations

- **`add`** takes `{ op: "add", element }` only. `planElementIssue(element)` refuses anything but a Plan element as
  `invalid_value` (`shape "square" is not an element a liveplanner tab holds`, hint `PLAN_KINDS_HINT`), logged
  `[edit-ops] not-plan`; a chart without a `chartSource` object is refused the same way. A given `id` must be free
  (`id_taken`); without one the element takes `options.makeId()`. The element is kept where its `x` and `y` put it.
- **`set`** writes the fields with `writeFieldsOnto` on each target. A change that leaves every field as it was
  writes nothing (E1).
- **`rm`** removes each target after the lock check.
- **`test`** compares each named field with `sameValue`; any difference is `test_failed`, naming expected and actual.

### Finalise

`normaliseElement` on every touched element (never on the rest: I2), then validation with reasons. Nothing is laid
out, re-anchored or reordered.

### Replace

`applyReplace(tab | null, body, options)` builds the next tab and returns the same outcome shape (EO41). The api's
`POST /api/projects` compiles each `template` tab through it with `tab === null`, and a changeset with a `replace` body
on a tab id the project lacks creates that tab.

- `elements`: each must pass `planElementIssue` (else `invalid_value`, `elements: <issue>`), then
  `normaliseElements` and `buildTab(…, 'preserve', themeId)`: kept at the x and y given. The api refuses a
  `replace.layout` before the engine sees it.
- `template`: `buildTemplateTab(...).elements`; on a new tab the whole `buildTemplateTab` result.
- `dashboard`: `readDashboardBody` then `buildDashboardTab`.
- `form`: a new Form tab's form, read as the editor reads it.

## Interfaces and contracts

```ts
parseEditOperations(text: string, log?: EditLog): ParseOutcome;
validateEditOperations(raw: unknown[]): ParseOutcome;
applyEditOperations(tab: Tab, operations: readonly EditOperation[], options?: ApplyOptions): ApplyOutcome;
applyReplace(tab: Tab | null, body: ReplaceBody, options: ReplaceOptions): ApplyOutcome;
formatResultLines(results: readonly ResultLine[]): string[];
formatResultFooter(footer: ResultFooter): string;
formatRejections(errors: readonly EditRejection[]): string;
addableKinds(): readonly string[]; elementKindsText(): string; elementFormatText(kind: string): string | null;
planElementIssue(raw: Readonly<Record<string, unknown>>): string | null;

type EditOperation =
  | { op: 'add'; element: Record<string, unknown> }
  | { op: 'set'; target: Selector; fields: Fields; all?: true }
  | { op: 'rm'; target: Selector; all?: true }
  | { op: 'test'; target: Selector; fields: Fields };
type ReplaceBody = { template: string } | { dashboard: DashboardSpec } | { form: unknown } | { elements: unknown[] };
```

### Result lines

| Mark | Line                                                                    |
| ---- | ----------------------------------------------------------------------- |
| `+`  | `+ <ref>  <kind> "<label>" @x,y w×h` (from the origin)                  |
| `~`  | `~ <ref>  <key> <from>→<to> · …`; a structured value prints `(changed)` |
| `-`  | `- <ref>  <kind> "<label>"`                                             |
| `!`  | `! <code>  <message>`                                                   |

Labels print cut at `LABEL_CUT_CHARS` (60), other values at `VALUE_CUT_CHARS` (48). The footer is
`rev a→b · <changeset> · revert: liveplanner changeset revert <project> <changeset>`, with
`rebased over <n> writes` when it was, or `dry run · rev <n> · nothing written`.

## Data and persistence

| Datum                              | Class     | Notes                                                                               |
| ---------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `EditOperation`                    | transient | Parsed per request; the changeset record stores what the changesets blueprint names |
| `elementOps`, `inverse`            | derived   | JSON-serialisable `ElementOp[]`; stored and relayed by the changeset pipeline       |
| `results`, `targets`, `createdIds` | derived   | Recomputed on every apply; never stored by the engine                               |

The engine holds no state, no table and no migration.

## Errors and edge cases

| Code                | Detail lines                                                                    | Hint                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `parse_error`       | `line <n>, column <c>: expected <what>`, the line with a caret under the column | `quote values with spaces: label="Sprint board"`; on an add line, `liveplanner schema <kind> shows what an element holds` |
| `unknown_operation` | `"<word>" is not an operation`; `operations: add set rm test`                   | `did you mean <nearest>?` within distance 2                                                                               |
| `target_not_found`  | `"<selector>" matches nothing`; up to 5 nearest as `ref  kind "label"`          | `use a ref from the outline, or label~<word> for part of a label`                                                         |
| `target_ambiguous`  | `"<selector>" matches <n> elements:` and each as `ref  kind "label"`            | `use a ref, narrow with type:<kind of the first>, or add all`                                                             |
| `unknown_field`     | `<kind> has no field "<key>"`; `fields: <the kind's fields>`                    | `did you mean <nearest>?`                                                                                                 |
| `invalid_value`     | `<key>=<value>: <rule>`, or the element no tab holds                            | The values or the kinds                                                                                                   |
| `id_taken`          | `id "<id>" is taken by <kind> "<label>"`                                        | `use id <free>`                                                                                                           |
| `element_locked`    | `the tab is locked`, or `locked:` and each element and why                      | `unlock it in the editor, or leave it out of the changeset`                                                               |
| `test_failed`       | `<ref> <key>: expected <value>, actual <value>`                                 | `re-read <ref>: it changed since you read it`                                                                             |
| `invalid_result`    | `<ref> <field>: <rule>` from `elementValidationIssue`                           | `see the format: liveplanner schema <kind>`                                                                               |
| `too_large`         | `<n> operations; the cap is <CHANGESET_MAX_OPERATIONS>`                         | `split it into several changesets, or send a replace`                                                                     |

Every rejection prints `error <code> · op <n> · <formatOperation(op)>`, its detail and hint lines indented, and the
block ends with `nothing was applied`.

- **E1** An operation that changes nothing: no line, no element op; the changeset still succeeds.
- **E2** `rm` of an element an earlier operation added: both vanish from the diff; no line.
- **E3** A selector matching an element an earlier operation removed: `target_not_found`.
- **E4** An element on a hidden layer resolves and changes like any other; a locked one resolves but never changes.
- **E5** A tab at `MAX_ELEMENTS_PER_TAB`: an `add` makes it invalid; `invalid_result` names the cap.

## Security and trust

- Input is untrusted text from any edit-role caller. Every result passes `isValidTab` and then the api's caps
  (`MAX_TAB_BYTES`, per-field caps), the same gate as the editor's save. Role checks belong to the changeset route.
- Only Plan elements are written: an agent cannot store a kind the editor would not draw.
- No dynamic code, no regular expression built from input (`label~` is a substring test), no prototype keys.
- Bounded work per request: `CHANGESET_MAX_OPERATIONS`, `EDIT_LINE_MAX_CHARS`, `EDIT_MAX_ERRORS`, banded edit
  distance.
- `selected` reads only `options.selected`, which the api fills with the token owner's selection.
- Logs carry counts, codes and operation names, never labels or ids.

## Performance and limits

Worst case: `MAX_ELEMENTS_PER_TAB` (10,000) elements, `CHANGESET_MAX_OPERATIONS` (500) operations.

- **State.** One `Map` and one order array, copied once; building the next `elements` array is one pass at the end.
- **Selectors.** A ref is `resolveRef` over the `RefTable`, recomputed only after an add or remove; a filter selector
  is one pass, `O(n)`.
- **Targets.** `noteTarget` keeps a `Set` beside the ordered `targets`, so a `set … all` notes each element in `O(1)`.
- **Nearest candidates** run only on a miss: banded Levenshtein over labels cut to 60 characters, at most
  `EDIT_MAX_ERRORS` passes a request.
- The gate is `performance.test.ts`: four times the tab, or four times the changeset, costs under eight times as much
  (CPU time); `noteTarget` is timed alone at 2,400 and 9,600 elements.

## Observability

| Fingerprint                   | When                                         | Fields                                                  |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `[edit-ops] parsed`           | `parseEditOperations` succeeded              | `operations`, `lineForm`, `jsonForm`                    |
| `[edit-ops] parse-rejected`   | Parsing failed                               | `code`, `errors`, `line`, `column`                      |
| `[edit-ops] applied`          | An outcome with a tab                        | `operations`, `added`, `changed`, `removed`, `warnings` |
| `[edit-ops] rejected`         | An outcome with errors                       | `code`, `operation`, `op`                               |
| `[edit-ops] unmatched`        | Misses were gathered                         | `count`, `stoppedBy`                                    |
| `[edit-ops] not-plan`         | An `add` or replace held a non-Plan element  | `operation`                                             |
| `[edit-ops] selection-unread` | `selected` with `selected: null`             | `operation`                                             |
| `[edit-ops] locked`           | An operation refused for a lock              | `operation`, `op`, `scope` (tab, element, layer)        |
| `[edit-ops] theme-fallback`   | No theme passed and `tab.theme` not built in | (none)                                                  |
| `[edit-ops] replace`          | `applyReplace` ran                           | `source`, `elements`                                    |

## Testing

Every suite uses the sprint dashboard fixture and a fixed `makeId`; no test touches the network or the clock.

| Spec rule                                                                         | Test                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The vocabulary: four operations, each form parses; `add` in the line form refused | `parse.test.ts`, `parse-json.test.ts`                               |
| Values with spaces quoted; `#` comment lines                                      | `tokenise.test.ts`, `parse.test.ts`                                 |
| Each selector row; cardinality; `selected`                                        | `selectors.test.ts`                                                 |
| `add` takes only Plan elements; a chart needs its `chartSource`; `id_taken`       | `add.test.ts`, `replace.test.ts`                                    |
| `set`, `rm`, `test`                                                               | `{set,rm,test-fields}.test.ts` in `operations`                      |
| Fields a kind takes; identity, live and prototype fields; closed values           | `fields.test.ts`, `rejections.test.ts`                              |
| The kinds `schema` prints, each within its token budget                           | `element-format.test.ts`                                            |
| Locks                                                                             | `locks.test.ts`, `invariants.test.ts`                               |
| Results and rejections formatted character for character                          | `results.test.ts`, `rejections.test.ts`                             |
| I1 to I5                                                                          | `invariants.test.ts`, `apply.test.ts`                               |
| `replace` from template, dashboard, form, elements                                | `replace.test.ts`, `replace-form.test.ts`, `dashboard-body.test.ts` |
| Cost grows linearly with the tab and with the changeset                           | `performance.test.ts`                                               |

## Constants and configuration

| Constant                   | Value  | Provenance                                                                          | Safe range      |
| -------------------------- | ------ | ----------------------------------------------------------------------------------- | --------------- |
| `CHANGESET_MAX_OPERATIONS` | 500    | [Agent changesets](../agent-changesets.md), imported from `@liveplanner/api-schema` | owned there     |
| `REF_MIN_LENGTH`           | 4      | [Project views](../project-views.md), from `@liveplanner/project`                   | fixed           |
| `EDIT_LINE_MAX_CHARS`      | 16,384 | A long JSON `add` line fits (EO3)                                                   | 8,192 to 65,536 |
| `EDIT_MAX_ERRORS`          | 10     | Enough to fix a batch of typos in one round (EO7)                                   | 1 to 50         |
| `REJECTION_CANDIDATES_MAX` | 10     | A readable list; the rest counted (EO45)                                            | 5 to 25         |
| `NEAREST_CANDIDATES_MAX`   | 5      | The few worth trying (EO45)                                                         | 3 to 10         |
| `NEAREST_MAX_DISTANCE`     | 3      | Typos and short slips, not other words (EO45)                                       | 2 to 5          |
| `SCHEMA_KIND_MAX_TOKENS`   | 300    | One kind's format in `schema`                                                       | 150 to 600      |

No environment variable, binding or secret.

## Defaults ledger

EO rows in [DEFAULTS.md](DEFAULTS.md); those for diagram verbs, placements, aliases, colours and make room are
retired.
