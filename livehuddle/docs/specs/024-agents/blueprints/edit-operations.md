# Edit operations: blueprint

> **No MCP server or CLI in livehuddle** ([Not in livehuddle](../../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)):
> the REST API is the only front door, and agents reach it through the agent tools. Where this file names the MCP or
> the CLI, it records livediagram's front doors over the same engine, where this design came from; their wire values
> (`mcp`, `cli`) still parse.

> **No arrows, pens, paths or annotations** ([The element engine](../../002-project-scope/not-in-livehuddle.md#the-element-engine), part 4): `connect`, `rewire` and
> `insert` are gone (unknown vocabulary), with `rm … keep-arrows`, `again`, `between` and `layout`'s `style=` and
> `direction=`. `add arrow|line|freehand|path|annotation` is refused ("arrows are no longer supported in livehuddle",
> and the like). A stored one is a retired element: `rm` removes only what it names and leaves the arrows pinned to it
> as stored, a stored arrow does not move, and no operation reroutes or rebinds one. `layout` sweeps the boxes it
> names into rows (`sweepEdgelessNodes`, `LAYER_GAP` apart) at the selection's top-left, and an `after:` placement
> reads as `below:`. Result lines print a stored arrow as `? arrow` with no ends or place.

> **Nothing holds** ([not in livehuddle](../../002-project-scope/not-in-livehuddle.md) "The element engine", part 3): the Frame left first, then the lane, the stack and the boundary. A stored one is a retired element that holds nothing, paints at the back as a backdrop, and is an element like any other to every operation. So there is no `wrap`, no `unwrap`, no `in:` selector, no `inside:` placement, no carry, no growing to hold, no container result line and no `frame_captures`; and with the graph input gone, no `graph` replace body. The sections below describe the engine as it stands after that cut.

Derived from [Edit operations](../edit-operations.md), with the changeset body and limits of
[Agent changesets](../agent-changesets.md), the refs and containment of [Document views](../document-views.md),
the lint summary of [Diagram lint](../diagram-lint.md), the `replace` inputs and normalisation of
[MCP server](../../../../../livediagram/docs/specs/015-api/mcp-server.md) §4.4, §4.7 and §4.7a, and the token style of
[Explorer filters](../../013-workspace/explorer-filters.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`EOn`. Refs, slug ids, kind tokens, containment and the content origin are the shared modules the
[Document views](document-views.md) blueprint defines in `@livehuddle/document`; this file consumes them.

Scope, by file:

| File                                                                              | Role                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/edit-operations/{package.json,tsconfig.json,oxlint.config.ts,...}`      | Private workspace package `@livehuddle/edit-operations`, laid out like the former explorer-lens package (EO1)                                                                                                                                   |
| `packages/edit-operations/src/index.ts`                                           | The public surface (listed under [Interfaces and contracts](#interfaces-and-contracts))                                                                                                                                                         |
| `packages/edit-operations/src/types.ts`                                           | `EditOperation` and one type per operation, `Selector`, `Placement`, `FieldValue`, `ApplyOptions`, outcomes                                                                                                                                     |
| `packages/edit-operations/src/vocabulary.ts`                                      | `EDIT_OPERATION_NAMES`, `OPERATION_MEMBERS`, `PLACEMENT_RELATIONS`, `SELECTOR_KEYS`, `FLAG_MEMBERS`, `RESERVED_WORDS`, constants; the bounds (cuts, caps, distances, `PROTOTYPE_KEYS`) re-exported from `@liveworkspace/edit-operations/limits` |
| `packages/edit-operations/src/tokenise.ts`                                        | `tokeniseLine`: words, quotes, JSON escapes, columns; one copy for every product, re-exported from `@liveworkspace/edit-operations/tokenise`                                                                                                    |
| `packages/edit-operations/src/parse-line.ts`                                      | `parseOperationWords`: one line form line's words into one raw operation                                                                                                                                                                        |
| `packages/edit-operations/src/parse-json.ts`                                      | `validateEditOperation(s)`: one JSON form object, checked member by member                                                                                                                                                                      |
| `packages/edit-operations/src/parse.ts`                                           | `parseEditOperations(text)`: lines, comments, form per line, the count cap, errors with line and caret; the walk is `createParseEditOperations` in `@liveworkspace/edit-operations/parse`, bound here to this product's operations and refusals |
| `packages/edit-operations/src/format-operation.ts`                                | `formatOperation`: the canonical line form of an operation (rejection headers, round trips)                                                                                                                                                     |
| `packages/edit-operations/src/selectors.ts`                                       | `parseSelector`, `resolveSelector`, `resolveOne`, `resolveSome`, `resolveMembers` (`layout`), `isSingleWord`                                                                                                                                    |
| `packages/edit-operations/src/graph-walk.ts`                                      | `reachableFrom`: `downstream:` and `upstream:` along stored arrows' pinned ends; one copy, re-exported from `@liveworkspace/edit-operations/graph-walk`                                                                                         |
| `packages/edit-operations/src/nearest.ts`                                         | `nearestElements`, `nearestName`: banded edit distance over labels and refs; one copy, re-exported from `@liveworkspace/edit-operations/nearest`                                                                                                |
| `packages/edit-operations/src/fields.ts`                                          | `FIELD_ALIASES`, `ALIAS_FIELDS`, `aliasesOf`, `writeFieldsOnto`, `fieldValue`: keys, unknown fields, value writes                                                                                                                               |
| `packages/edit-operations/src/colours.ts`                                         | `resolveColourValue`, `fillSlotNames`, `fillValue`: theme slots, hex, sticky presets                                                                                                                                                            |
| `packages/edit-operations/src/labels.ts`                                          | `applyLabel` (cap into the note), `fitToLabel` (grow around the centre)                                                                                                                                                                         |
| `packages/edit-operations/src/placement.ts`                                       | `resolvePlacement`, `defaultSpot`, `nudgeUntilFree`, `firstOverlapIn`, `boxOf`, `shifted`                                                                                                                                                       |
| `packages/edit-operations/src/state.ts`                                           | `EditState` and its writers (`putElement`, `writeFields`, `moveElement`, `replaceElement`, `removeElement`, `reorder`), memoised refs and element list, `noteTarget`                                                                            |
| `packages/edit-operations/src/ids.ts`                                             | `newElementId` (`id=` checks), `mintId` (`slugIdFor` over `state.taken`)                                                                                                                                                                        |
| `packages/edit-operations/src/operations/*.ts`                                    | One file per operation: `add` (an element), `add-kind`, `set`, `rm`, `move`, `order`, `layout`, `test-fields`                                                                                                                                   |
| `packages/edit-operations/src/finalise.ts`                                        | Normalise touched (a stored kind the edit did not write kept, not coerced), validation with reasons                                                                                                                                             |
| `packages/edit-operations/src/apply.ts`                                           | `applyEditOperations`                                                                                                                                                                                                                           |
| `packages/edit-operations/src/replace.ts`                                         | `applyReplace`: the `replace` body through the same outcome shape                                                                                                                                                                               |
| `packages/edit-operations/src/results.ts`, `format-results.ts`                    | `buildResultLines`, `formatResultLines`, `formatResultFooter`                                                                                                                                                                                   |
| `packages/edit-operations/src/rejections.ts`                                      | `rejection` builders per code, `formatRejections`                                                                                                                                                                                               |
| `packages/edit-operations/src/fixtures/checkout-flow.ts`, `run.ts`, `outcomes.ts` | The research's checkout tab (`n1` to `n8`, `t1`, stored arrows `a1` to `a7`) plus a stored boundary `f2` that holds nothing; a line-form runner; outcome readers                                                                                |
| `packages/edit-operations/src/invariants.test.ts`, `performance.test.ts`          | I1 to I7 over one changeset per operation; cost growth with the tab and the changeset                                                                                                                                                           |
| `packages/document/src/element-normalise.ts` (+ test)                             | moved from `livediagram/apps/mcp/src/`: `normaliseElement(s)`, `mergeElementUpdate`; a retired element comes back as it was                                                                                                                     |
| `packages/document/src/label-cap.ts` (+ test)                                     | `LABEL_CAP_MAX`, `capLabel`, kept from the retired graph input                                                                                                                                                                                  |
| `packages/document/src/tab-builders.ts` (+ test)                                  | moved from `livediagram/apps/mcp/src/`: `buildTab`, whose `layout` argument arranges nothing since part 4                                                                                                                                       |
| `packages/templates/src/template-tab.ts` (+ test)                                 | `buildTemplateTab`, `resolveTemplate`, `validTemplateKinds`: the template builders, in `templates` because it imports `document` (EO1)                                                                                                          |
| `packages/document/src/element-fields.ts` (+ test)                                | `ELEMENT_FIELD_NAMES`: every stored field per element type, compile-time exhaustive                                                                                                                                                             |
| `packages/document/src/validate.ts` (+ test)                                      | `elementValidationIssue(el)` names the field and rule; `isValidElement` delegates to it                                                                                                                                                         |
| `packages/document/src/content-origin.ts`                                         | Shared: `contentOrigin`                                                                                                                                                                                                                         |
| `packages/document/src/element-refs.ts` (+ test)                                  | Shared: `SLUG_ID_PATTERN`, `isSlugId`, `slugIdFor`, `REF_MIN_LENGTH`, `computeRefs`, `RefTable`, `resolveRef`, `kindWordOf`                                                                                                                     |
| `packages/document/src/element-ops.ts` (+ test)                                   | `applyElementOps` writes runs of updates through an id index: exactly the sequential reduce, linear in the changeset                                                                                                                            |
| `packages/document/src/layout-sweep.ts`                                           | `LAYER_GAP`, `SIBLING_GAP` and `sweepEdgelessNodes`, exported through `index.ts`: `layout`'s rows and `PLACEMENT_GAP`                                                                                                                           |
| `packages/document/src/index.ts`, `packages/templates/src/index.ts`               | Re-export the moved and new modules                                                                                                                                                                                                             |
| `livediagram/apps/mcp/src/tools.ts`, `schema.ts`, `changeset-client.ts`           | Import the moved modules; `ops` mode resolves an `elementId` as an id or a ref and targets it by `id:"…"`                                                                                                                                       |
| `apps/api/src/changesets/request.ts`                                              | `operations` as a JSON array or the line form as a string, parsed with the engine's log                                                                                                                                                         |
| `apps/api/package.json`                                                           | Depends on `@livehuddle/edit-operations`; the changeset route is the [Agent changesets](agent-changesets.md) blueprint's                                                                                                                        |
| `docs/development/architecture.md`, `README.md`                                   | The package in the package list                                                                                                                                                                                                                 |

Gone (part 4): make room, `connect` (with `rewire`) and `insert`, which livediagram keeps
(`livediagram/packages/edit-operations/src/make-room.ts`,
`livediagram/packages/edit-operations/src/operations/connect.ts`,
`livediagram/packages/edit-operations/src/operations/insert.ts`), the gateway fixtures, and the use of
`flowDirectionOf` and `autoLayoutElements`.

## Domain and naming

| Term             | Identifier                                              | Meaning                                                                                                                      |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Edit operation   | `EditOperation` (union on `op`)                         | One step of a changeset, in its JSON form                                                                                    |
| Operation name   | `EditOperationName`, `EDIT_OPERATION_NAMES`             | `add set rm move order layout test`                                                                                          |
| Line form        | `parseEditOperations`, `formatOperation`                | One operation a line, words and quoted values                                                                                |
| JSON form        | `validateEditOperation`                                 | One object a line                                                                                                            |
| Operation number | `operation` (1-based) on rejections                     | Position among the operations, comments and blank lines not counted                                                          |
| Selector         | `Selector` (a string), `parseSelector`                  | A ref, a quoted label, or `key:value` terms, all of which must match                                                         |
| Selector term    | `SelectorTerm` (union on `kind`)                        | One word of a selector                                                                                                       |
| Ref              | `computeRefs`, `RefTable`, `resolveRef` (shared)        | An element's short name, as views print it                                                                                   |
| Slug id          | `isSlugId`, `SLUG_ID_PATTERN`, `slugIdFor` (shared)     | The id an agent names or the engine mints from a label or kind token                                                         |
| Kind word        | `kindWordOf` (shared)                                   | The shape for shapes, else the element type: what `type:` and results print                                                  |
| Placement        | `Placement` (union on `rel`)                            | Where `add` and `move` put an element                                                                                        |
| Content origin   | `contentOrigin(tab)` (shared)                           | The point coordinates shown and taken are relative to                                                                        |
| Field            | `fields` member, `FieldValue`                           | A key and its value; `null` unsets                                                                                           |
| Field alias      | `FIELD_ALIASES`                                         | A spec-named key (`label`, `note`, `shape`, `fill`, `text`, `line`) or a view's style key (`stroke`, `text-color`, `border`) |
| Live field       | `LIVE_ELEMENT_FIELDS` (`@livehuddle/document`)          | A multi-writer field that travels as a delta; never written by an operation                                                  |
| Theme slot       | `fillSlotNames`, `resolveColourValue`                   | `theme` or one of the theme's six quick-swatch hues, written as a binding                                                    |
| Stored arrow     | `RetiredArrowElement` (`@livehuddle/document`)          | A retired arrow kept as stored: selectors read its ends, `set` and `rm` can name it, nothing moves or reroutes it            |
| Working state    | `EditState`                                             | The tab as the operations have left it so far                                                                                |
| Touched          | `EditState.touched`                                     | Elements an operation created or changed; only these are normalised                                                          |
| Moved            | `Touch.moved` (`MoveReason`: `laid out`), `moveElement` | Elements `layout` laid out without an operation writing them                                                                 |
| Targets          | `targets: ElementId[]`                                  | Existing elements the operations resolved; fingerprinted and checked for holds                                               |
| Created ids      | `createdIds: ElementId[]`                               | Elements the changeset created that are in the next tab                                                                      |
| Outcome          | `ApplyOutcome` = `ApplySuccess \| ApplyRejection`       | `{ tab, results, elementOps, inverse, warnings, targets, createdIds }` or `{ errors }`                                       |
| Result line      | `ResultLine` (union on `mark`)                          | One line of a changeset's answer: `+ ~ - »`, `!`                                                                             |
| Warning          | `EditWarning`, `EDIT_WARNING_CODES`                     | A named note that does not reject                                                                                            |
| Rejection        | `EditRejection`, `EDIT_REJECTION_CODES`                 | A named refusal; the spec's code table                                                                                       |
| Replace          | `ReplaceBody`, `applyReplace`                           | The other changeset body: a whole tab from a template or elements                                                            |

Banned: "op" for an edit operation (that is a room `ElementOp`), "action", "command" (a CLI command is a front
door), "batch", "patch", "query" or "filter" for a selector, "handle" or "alias" for a ref, "group", "parent",
"container" or "member" (nothing holds).

## Behaviour and state

### The pipeline

`applyEditOperations(tab, operations, options)` runs, in this order. A `target_not_found` is gathered and the
operations after it read on (up to `EDIT_MAX_ERRORS` gathered); any other rejection stops at once, and is answered
after the gathered misses when there are any. A miss on an id a skipped operation would have made (its `id=`, or a
raw element's `id`) says so (`"<id>" was to be made by operation <n>, which was skipped above`, hint `fix operation
<n>; …`) in place of its nearest candidates. Nothing is written while any rejection remains; `[edit-ops] unmatched`
logs the count and the code that stopped the read (`none` when none did):

1. **Count.** More than `CHANGESET_MAX_OPERATIONS` operations: `too_large`.
2. **Prepare.** `createState(tab, options, log)`: elements by id, their order, `origin = contentOrigin(tab)`,
   `theme = options.theme ?? getBuiltInTheme(tab.theme)`, `taken` (the tab's ids and the reserved words);
   refs and the element list are memoised and cleared by every write.
3. **Apply each operation in order** against the working state. Every selector resolves against the state as the
   operations before it left it, so an `id=` given earlier is addressable later. Each operation adds the
   pre-existing ids it resolved to `state.targets`, records its named, touched and created ids, its moves and its
   annotations (widened, order, warnings).
4. **Finalise** ([Finalise](#finalise)).
5. **Validate** every touched element with `elementValidationIssue`, then the whole tab with `isValidTab`; the
   first issue is `invalid_result`.
6. **Diff.** `elementOps = diffToElementOps(tab.elements, next.elements)`;
   `inverse = diffToElementOps(next.elements, tab.elements)`.
7. **Results.** `buildResultLines(before, after, state)`; `targets` and `createdIds` in first-resolution and
   creation order, each id once (EO46, EO48).

Invariants:

- **I1 Atomic.** An outcome with `errors` carries no tab; the input `tab` is never mutated (the state copies on
  write).
- **I2 Untouched stays identical.** An element no operation touched or laid out is the same object in
  `next.elements` as in `tab.elements`, so `diffToElementOps` emits nothing for it.
- **I3 Geometry moves only where the spec says.** Boxes change position or size only through: `add`, `move` (its
  targets), named `x` / `y` / `width` / `height`, fit to label and `layout` (the selection). A stored arrow changes
  only through a `set` that names it, and goes only through an `rm` that names it; no operation moves, reroutes or
  rebinds one. Every such change is a result line.
- **I4 Round trip.** `applyElementOps(tab.elements, elementOps)` equals `next.elements`, and
  `applyElementOps(next.elements, inverse)` equals `tab.elements`.
- **I5 Deterministic.** The same tab, operations and options give the same outcome: no clock, no `Math.random`;
  ids not derived from text come from `options.makeId` (EO8).
- **I6 A stored kind stays as stored.** A stored lane, boundary, arrow or other retired element ([not in livehuddle](../../002-project-scope/not-in-livehuddle.md)
  "The element engine") is never reordered, settled or rewritten by finalising; an operation that names it changes
  only what it writes.
- **I7** (retired: livehuddle has no element or tab lock, ../../002-project-scope/not-in-livehuddle.md#element-and-tab-locking).

### Selectors

Grammar (line form; the JSON form carries the same text as a string):

```text
selector := term ( " " term )*
term     := ref | label | "label~" value | key ":" value | word "->" word | "selected"
key      := type | shape | from | to | downstream | upstream
ref      := an unquoted word that is not a reserved word and has no ":", "=", "~" or "->"
label    := a quoted value
word     := ref | label          (one element)
```

| Term                | Matches                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`               | `resolveRef(word, refs)`: the element whose id equals it, else the one id it is a prefix of; several: ambiguous                                          |
| `"Label"`           | Elements whose `label`, trimmed, equals it trimmed, compared after `toLowerCase()` (EO11)                                                                |
| `label~text`        | Elements whose `label` contains the text, compared after `toLowerCase()`                                                                                 |
| `type:<v>`          | `kindWordOf(el) === v` or `el.type === v`, so `type:square` and `type:shape` both match a square                                                         |
| `shape:<v>`         | Shapes whose `shape === v`                                                                                                                               |
| `from:<word>`       | Stored arrows whose `from` is pinned to that element                                                                                                     |
| `to:<word>`         | Stored arrows whose `to` is pinned to that element                                                                                                       |
| `<a>-><b>`          | Stored arrows whose `from` is pinned to `a` and `to` to `b`; split at the `->` outside quotes, so `"Sign in"->"Pay"` reads; a third end is a parse error |
| `downstream:<word>` | Boxed elements reachable from it along stored arrows' pinned ends from `from` to `to`, itself excluded (EO13)                                            |
| `upstream:<word>`   | The same against the arrows' direction                                                                                                                   |
| `selected`          | The ids in `options.selected` that exist in the state                                                                                                    |

- The arrow terms (`from:`, `to:`, `a->b`, `downstream:`, `upstream:`) still parse and read the pinned ends a stored
  arrow keeps, so an agent can find, relabel or remove what an older tab drew; nothing writes a new arrow.
- All terms of one selector must match (intersection). Matches are listed in element order (z-order, EO12).
- A `<word>` inside a term must resolve to exactly one element, else that word's own `target_not_found` or
  `target_ambiguous`. `in:` is no key: a `parse_error` naming the keys there are.
- `refs` is recomputed after an operation adds or removes elements, so a ref minted in the changeset resolves. A
  `stale` ambiguity from `resolveRef` adds the detail line "matches <n> elements now; one was added since your
  read?".
- **Cardinality.** `set`, `rm`, `move`, `order`, `test` and every placement reference need exactly one match; `set`,
  `rm` and `move` accept `all` for one or more. `layout` is plural by nature. Zero matches is always
  `target_not_found`, `all` included.
- `selected`: `options.selected === null` (the room was not read) or an empty selection: `target_not_found` with
  the detail "nothing is selected" or "the selection could not be read" (EO16).
- Reserved words (`selected all front back`) always read as keywords; an element whose id is one is reached by label
  or by a longer prefix (EO10).
- One value a term: a comma in a `key:value` value is `parse_error` ("one value a term; join terms with spaces").

### Fields and values

A field key is an alias or a stored field name of the element's type. The aliases include every style key the views
print (`STYLE_KEYS`; `font` is a stored name already), so a printed `key=value` writes back unchanged.

| Alias        | Element types                                                     | Writes                                             | Values                                                                                              |
| ------------ | ----------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `label`      | every type with a `label` field                                   | `label`                                            | text; on a shape over `LABEL_CAP_MAX`, capped into the note; on a stored arrow, cut (EO18)          |
| `icon`       | every type with an `iconId` field and no `icon` of its own        | `iconId`                                           | the MCP's name for the icon, read as `iconId` and checked as it is                                  |
| `note`       | every type with a `note` field                                    | `note`                                             | text                                                                                                |
| `shape`      | `shape`                                                           | `shape`                                            | a shape kind; off-vocabulary coerced by `coerceShapeKind`, warning `shape_coerced`                  |
| `fill`       | types whose `themeColourFields` include `fillColor`, and `sticky` | `fillColor` + `fillSwatch` (sticky: + `textColor`) | a theme slot, or `#rgb` / `#rrggbb`, or on a sticky a sticky preset name                            |
| `stroke`     | every type with a `strokeColor` field                             | `strokeColor`; clears `strokeSwatch`               | a colour: hex (warning `colour_overrides_theme` where the theme colours it) or a marker colour name |
| `text-color` | every type with a `textColor` field                               | `textColor`                                        | a colour, as `stroke`                                                                               |
| `border`     | every type with a `strokeStyle` field                             | `strokeStyle`                                      | `solid dashed dotted long-dash dash-dot dash-dot-dot`                                               |
| `text`       | every type with a `textSize` field                                | `textSize`                                         | `sm md lg scale`                                                                                    |
| `line`       | a stored `arrow`                                                  | `arrowStyle`                                       | `straight angled curved`                                                                            |

- **Stored field names** are `ELEMENT_FIELD_NAMES[el.type]`. `id` and `type` are refused (`invalid_value`,
  "cannot be changed"). `__proto__`, `constructor` and `prototype` are always `unknown_field`.
- **Live fields.** A key in `LIVE_ELEMENT_FIELDS` (the comment thread and the assigned actions; responses and ideas
  left with their elements in part 4 of Work Tracker #423) is `invalid_value` with the hint "comments go through the comment commands; assigned actions are people's".
- **Value parsing.** JSON form values are JSON. Line form values: a quoted value is a string; an unquoted value is
  read as JSON when the whole value is a JSON number, `true` or `false`, or it starts with `[` or `{`, else it is a
  string (EO19): `label=2FA`, `label=3D` and `label=1st` are strings, `width=200` is a number.
  `key=` is `null`: the field is removed (`unset`).
- **Geometry.** A named `x`, `y`, `width` or `height` is written as given: stored, absolute coordinates, not
  origin-relative.
- **Merge.** Stored fields merge with `mergeElementUpdate` semantics: a nested object or array replaces the old one
  wholesale.
- **A stored arrow's ends.** A `set` that writes a stored arrow's `from` or `to` writes them as given and keeps every
  route field it stored; nothing re-anchors or reroutes it.
- **Colours.** Slot names are `theme` and the six `quickSwatches(theme, 'fill')` names, lower-cased with spaces as
  `-` (`green`, `deep-blue`) (EO49). `fill=<slot>` writes `fillColor = quickSwatchColor(theme, 'fill', slot)` and
  `fillSwatch = slot`; `fill=theme` writes the slot 0 colour and removes `fillSwatch`. A hex value writes
  `fillColor`, removes `fillSwatch` and warns `colour_overrides_theme`, except on a sticky. On a sticky a
  `STICKY_PRESETS` name (`lemon`) writes its `fill` and `text` pair; a hex writes `fillColor` alone. A raw
  `fillColor`, `strokeColor` or `textColor` hex on a themed element warns the same way (EO21). Anything else is
  `invalid_value` listing the slot names (or, on a sticky, the preset names).
- **Labels.** `applyLabel(el, text)`: on a shape, `capLabel(text)`; when cut, `label` is the heading and the
  whole text, whitespace collapsed, is prepended to the note the element ends with (`"<full>\n\n<note>"`), as
  the retired graph input did; warning `label_capped`. On a stored arrow, `capLabel(text).label`, warning
  `label_capped`. Other types keep the text as given (EO18).
- **Fit to label.** After a `set` that changes a shape's `label` (or `text` / `shape`), when the shape has no
  `fixedSize`, its `textSize` is not `scale`, and `labelBoxSize(label, shape)` exceeds its box, the box grows to
  the larger of each side around its centre (`x -= dw / 2`, `y -= dh / 2`, rounded), annotated `widened w→w'` and
  `taller h→h'` (EO22). It never shrinks.

### Placement

`Placement` in line form is one word, plus an optional `gap:<n>`; a side or `after` word may take one `align:<x>`
(`alignTo`), in either order (`combinePlacements`). `inside:` is no placement: a `parse_error` naming the placements
there are.

| Word           | Puts the element                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `right-of:<x>` | `left = x.right + gap`, centred on x's centre y                                                                |
| `left-of:<x>`  | `right = x.left - gap`, centred on x's centre y                                                                |
| `below:<x>`    | `top = x.bottom + gap`, centred on x's centre x                                                                |
| `above:<x>`    | `bottom = x.top - gap`, centred on x's centre x                                                                |
| `after:<x>`    | As `below:<x>`: no arrow gives x a direction (EO24)                                                            |
| `align:<x>`    | Shares x's centre on the axis where the element's centre is already nearer x's; a tie aligns the column (EO50) |
| `at:x,y`       | Top-left at `origin + (x, y)`, exact, never nudged (EO25)                                                      |

- **`alignTo`.** The paired `align:<x>`: resolved by `resolveOne`; the box beside the reference is centred on x's
  centre across the side (x for `above` / `below`, y for `left-of` / `right-of`) before the nudge; a stored arrow →
  `invalid_value`. `alignTo` with `rel: 'align'` in the JSON form is refused, and so is a `within`. Two placements
  that are not a side with an `align:`, or any with `at:`, are a `parse_error` ("one placement (or align: with a
  side)").
- A reference that is a stored arrow has no box: `invalid_value` ("is an arrow; place against a box").
- `gap` defaults to `PLACEMENT_GAP` and is an integer in `[0, PLACEMENT_GAP_MAX]` (EO23); it applies to the four
  sides and `after`. `gap:` with no number, or one that is not a number, is a `parse_error` ("a number after
  gap:"), never 0.
- **No placement** on `add`: `right-of` the element the latest earlier `add` in this changeset created; else
  top-left at `(contentRight + PLACEMENT_GAP, contentTop)` of all boxed elements; on an empty tab at the origin
  (EO26). `align:` on `add` aligns that default spot.
- **Nudge.** For the four sides, `after` and the default, while the box overlaps an occupying element, it moves
  along the placement axis (outward; the default moves right) to the occupier's far edge plus the gap. Occupying
  elements are boxed, not a stored backdrop (`isRetiredBackdrop`: a lane, stack, boundary or frame, which paints
  behind what sat on it), not the moving set itself. The loop ends: each step passes one occupier.
- **Move.** `move <selector> <placement>` places the moving set's bounding box (its boxed elements) as one box and
  translates every boxed member by the same delta; `by=dx,dy` translates by exactly that. A stored arrow in the set
  stays where it is (`shifted` leaves it); a set with no box and a placement is `invalid_value` ("a stored arrow does
  not move"). A placement relative to an element in the moving set is `invalid_value`. Nothing is carried: a stored
  lane or boundary moves alone.
- Coordinates in results are `Math.round(value - origin)`; coordinates taken (`at:`) are added to the origin.

### Operations

Each operation's exact effect on the working state. "Paint" means `recolourElementForTheme(el, theme)`; "new id"
means `newElementId` ([Ids](#ids)).

- **`add <kind> [id=] key=value… [<placement>]`.** `kind` is a shape kind, an element type, or `shape` (a
  square). An unknown kind is coerced as a shape kind with `shape_coerced` (EO17). `image`, `video`, `table`,
  `arrow`, `line`, `freehand`, `path` and `annotation` are `invalid_value` naming why (`NOT_ADDED`: "arrows are no
  longer supported in livehuddle", and the like; EO15). A retired shape kind (`lane`, `boundary`, `stack`, `card`,
  `callout`, `badge`, `step`, `pointer-note`, `timeline-rail`, `diagram-key`, the Page, a chart) is an unknown kind:
  a square with `shape_coerced`. The element is the factory's (`createShape`, `createText`, `createSticky`,
  `createLinkCard`) with a new id; shapes and text take `textSize: 'sm'` and `labelBoxSize(label, kind)` (EO28), a
  shape measured at `labelFontPx` of its text size (`GraphLook.fontPx`); fields apply as `set` does; it is
  painted, placed, and appended to the element order (EO29). The JSON form may carry `element` (a whole raw
  element, as the MCP's `ops` mode sends) instead of `kind` and `fields`: it is taken as given, its geometry kept,
  its `id` kept when free (`id_taken` otherwise).
- **`set <selector> key=value… [all]`.** Each target gets the fields in order. No geometry changes except named
  geometry and fit to label. A target the fields leave as it was is not touched, so it is never normalised (E1, I2).
- **`rm <selector> [all]`.** Removes the targets and only them. A stored arrow pinned to a removed element is left as
  stored, its end naming an element no longer there; a stored arrow is removed only when the selector names it.
- **`move <selector> <placement> | by=dx,dy [all]`.** As [Placement](#placement). A stored arrow pinned to a moved
  box is not rewritten: its pinned end follows the box when it is drawn.
- **`order <selector> front|back|above=<x>|below=<x>`.** Moves the target in the element order: last, first,
  directly after x, directly before x; x the target itself is `invalid_value`. A stored lane or boundary goes where
  it is told, like any element (EO37).
- **`layout <selector>`.** The selection (each ref or quoted label one element, the other words together,
  `resolveMembers`, EO57): its boxed elements are swept into rows by `sweepEdgelessNodes` (`LAYER_GAP` apart),
  shifted to the selection's top-left (`laidOut`), every box keeping its size (EO38). A selection with no box lays
  out nothing. Nothing outside the selection moves. `style=` and `direction=` are refused (the JSON form's `style`
  and `direction` are unknown members).
- **`test <selector> key=value…`.** For each field, the value `set` would write (aliases resolved, no label cap,
  no coercion warning) is compared with the stored value by deep equality; strings exactly; `key=` holds when the
  field is absent; a colour alias compares the swatch slot, or the hex case-insensitively (EO39). Any difference:
  `test_failed`. It changes nothing.

Gone (part 4): `connect`, `rewire` and `insert` (each an `unknown_operation`), `rm`'s `keep-arrows` (the JSON form's
`keepArrows` is an unknown member), `connect`'s `again`, `insert`'s `between`, and `layout`'s `style=` and
`direction=`.

### Make room

Gone (part 4): only `insert` made room, and `insert` is gone.

### Ids

`newElementId(state, { given, label, kind })`:

- `id=` must satisfy `isSlugId` and not be a reserved word (`invalid_value`, EO9); if taken, `id_taken` with a
  free suggestion (`slugIdFor(given, kind, taken)`).
- Without `id=`: `slugIdFor(label, kindWordOf(el), state.taken)`, where `taken` is every id of the tab plus every id
  minted earlier in the changeset. An unlabelled element's base is its kind token (`sticky`, `sticky-2`, `square`).
  `options.makeId()` is used only when the result would not satisfy `isSlugId` (EO8).

### Finalise

On the working state, in order:

1. `normaliseElement` on every touched element whose write was more than geometry (never on the rest: I2), noting
   `codeLanguage` / `codeTheme` coercions as `value_coerced`.
2. Coerce every touched shape's `shape` with `coerceShapeKind`, unless it is the kind the element already stored
   (a stored retired kind an edit relabels stays what it was).
3. Gone (part 4): no arrow is re-anchored after a move.
4. Nothing is reordered or settled: lanes no longer go first, no container goes behind its members, and no diagram
   key's rows are settled (I6).

### Replace

`applyReplace(tab | null, body, options)` builds the next tab as the MCP does and returns the same outcome shape
(EO41). The api's `POST /api/documents` compiles each `template` or `elements` tab through it with
`tab === null`, and a changeset with a `replace` body on a tab id the document lacks creates that tab.

- A `graph` or `mermaid` body has no source: `invalid_value` ("replace takes exactly one of template, elements").
- `elements`: `normaliseElements`, shape kinds coerced, then `buildTab`, whose `layout` (`auto` or `preserve`)
  arranges nothing: every element keeps the place it was sent, and a stored arrow is kept exactly as sent.
- `template`: `buildTemplateTab(...).elements`; on a new tab the whole `buildTemplateTab` result.
- Existing tab: every tab field kept, `elements` replaced.
  New tab (`tab === null`): `buildTab` / `buildTemplateTab`
  with `options.tabId`, `options.name` and the theme, as `add_tab` does.
- Validation, `elementOps` and `inverse` as for operations; the results are one line per added and removed element
  and no `»` lines; `targets` is empty; `createdIds` lists every element of the new tab not in the old one.

## Interfaces and contracts

Public surface of `@livehuddle/edit-operations`:

```ts
export function parseEditOperations(text: string, log?: EditLog): ParseOutcome;
export function validateEditOperations(input: readonly unknown[]): ParseOutcome;
export function formatOperation(operation: EditOperation): string;
export function applyEditOperations(
  tab: Tab,
  operations: readonly EditOperation[],
  options?: ApplyOptions,
): ApplyOutcome;
export function applyReplace(
  tab: Tab | null,
  body: ReplaceBody,
  options: ReplaceOptions,
): ApplyOutcome;
export function formatResultLines(results: readonly ResultLine[]): string[];
export function formatResultFooter(footer: ResultFooter): string;
export function formatRejections(errors: readonly EditRejection[]): string[];
export function validateEditOperation(
  raw: unknown,
  operation: number,
): EditOperation | EditRejection;
export { EDIT_MAX_ERRORS, EDIT_OPERATION_NAMES };
// The rejection and warning codes and `ResultLine` are the wire's, in `@livehuddle/api-schema`.
```

```ts
type ParseOutcome = { operations: EditOperation[] } | { errors: EditRejection[] };

type ApplyOptions = {
  selected?: readonly ElementId[] | null; // the owner's selection; null: the room was not read
  theme?: ThemeDefinition; // the tab's theme resolved by the caller
  makeId?: () => string; // ids no slug can name; default crypto.randomUUID
  log?: (fingerprint: string, fields: Readonly<Record<string, string | number | boolean>>) => void;
};
// `themeId` names a created tab's theme by id; it wins over `theme`. `finish` only on a replace that creates the tab.
type ReplaceOptions = ApplyOptions & {
  tabId: string;
  name: string;
  themeId?: string;
  finish?: Finish;
};

type ReplaceBody = { template: string } | { elements: unknown[]; layout?: 'auto' | 'preserve' };

type ApplySuccess = {
  tab: Tab;
  results: ResultLine[];
  elementOps: ElementOp[];
  inverse: ElementOp[];
  warnings: EditWarning[];
  targets: ElementId[];
  createdIds: ElementId[];
};
type ApplyRejection = { errors: EditRejection[] };
type ApplyOutcome = ApplySuccess | ApplyRejection; // discriminated by 'errors' in outcome
```

`targets` holds every pre-existing element an operation resolved: selector matches, `from:` / `to:` /
`downstream:` / `upstream:` words and placement references (EO46). Elements only laid out are left out, as are ids in
`createdIds`. The changeset pipeline fingerprints exactly these (live fields left out) and asks the room whether any
is held.

JSON form, one object a line (`?` optional; `fields` values are JSON, `null` unsets):

| `op`     | Members                                                             |
| -------- | ------------------------------------------------------------------- |
| `add`    | `kind`, `id?`, `fields?`, `place?` ; or `element` (a whole element) |
| `set`    | `target`, `fields`, `all?`                                          |
| `rm`     | `target`, `all?`                                                    |
| `move`   | `target`, `place` or `by: [dx, dy]`, `all?`                         |
| `order`  | `target`, and one of `to: "front" \| "back"`, `above`, `below`      |
| `layout` | `target`                                                            |
| `test`   | `target`, `fields`                                                  |

The MCP's `ops` mode maps onto this form in its adapter: `add` with `element`, `update` as `set` on the
element's id with its fields as stored fields, `remove` as `rm` on the id. Removing an element removes only it, and
an `update` of an unknown id is `target_not_found`.

`place` is `{ "rel": "right-of" | "left-of" | "above" | "below" | "after" | "align", "ref": Selector,
"gap"?: n, "alignTo"?: Selector }` or `{ "rel": "at", "x": n, "y": n }`. Unknown members are `parse_error` naming the member; a wrong
type names the member and the expected type. Booleans are `true` only (`false` equals absent).

Line form, words separated by whitespace:

- **Quoting.** `"…"` with the escapes `\" \\ \n \t`; `'…'` literal. A quote may open mid-word (`label="Sign in"`,
  `right-of:"Orders service"`); the word records that its value was quoted. An unclosed quote is `parse_error` at
  its column (EO6).
- **Comments.** A line whose first non-space character is `#` is a comment; a `#` elsewhere is text, so
  `fill=#ff0000` reads (EO5). Blank lines are skipped. A line starting with `{` is JSON form (EO4).
- **Word classes.** `key=value` (key `[a-z][a-zA-Z-]*`) is a field, except `above=`, `below=`, `by=` and `id=` in
  the operations that define them; `key:value` with a placement key is a placement, `gap:` its gap; other
  `key:value` words, quoted words, `label~`, `->` words and other bare words are selector terms; flags are the
  operation's keywords (`all`, and `order`'s `front` / `back`). Keys read case-insensitively, as `tokenKeyOf` in the
  Explorer's lens (`packages/explorer/src/lens/dimensions.ts`) reads them (EO11).

`formatOperation` prints the canonical line form: operation, selector or kind, `id=`, fields in the given order
(strings quoted when they hold whitespace, `"`, `#` at the start, `=` or `:`), placement, flags. Parsing its output
gives the same operation. An `add` with a whole element has no line form and prints as its JSON form, which parses
back alike.

### Result lines

The wire type keeps every member, so a reader of the JSON keeps working; the members part 4 left without a writer
are never set:

```ts
type ResultLine =
  | {
      mark: '+';
      ref: string;
      kind: string;
      label?: string;
      at?: [number, number];
      size?: [number, number];
      ends?: [string, string]; // never set (part 4)
      styleOf?: string; // never set (part 4)
    }
  | { mark: '~'; ref: string; changes: FieldChange[] }
  | {
      mark: '-';
      ref: string;
      kind: string;
      label?: string;
      ends?: [string, string]; // never set (part 4)
      reason?: 'pinned'; // never set (part 4)
      pinnedTo?: string; // never set (part 4)
    }
  | {
      mark: '»';
      refs: string[];
      delta?: [number, number]; // never set (part 4)
      reason: 'make room' | 'laid out'; // always 'laid out'
      layout?: { style: 'flow' | 'tree'; direction?: 'down' | 'right' }; // never set (part 4)
    }
  | { mark: '!'; warning: EditWarning };
```

Text, two spaces after the ref, `·` between changes:

| Line             | Text                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| Added box        | `+ verify  square "Verify email" @0,300 140×60`                                   |
| Changed          | `~ n3  label "Login"→"Sign in" · shape square→stadium · widened 140→152`          |
| Changed position | `~ n3  @0,200→@0,300`                                                             |
| Changed end      | `~ a3  to n4→verify` (a `set` naming a stored arrow's end)                        |
| Removed          | `- n7  square "Pay"`; a stored arrow `- a4  ? arrow`                              |
| Laid out         | `» n5 n6 n7 t1  laid out`                                                         |
| Warning          | `! label_capped  n3 label kept as "Orders service"; the full text is in its note` |

- **Order** (EO42): `+ ~ -` lines in the order operations first touched the element; then the `»` line, refs in
  element order; then warnings in order.
- **Values** (EO43): strings JSON-quoted and cut on a word boundary with `…` (labels at 60, notes at 48, other
  strings at 48, the views' cuts); numbers and enum values bare; absent prints nothing (`fill →green`); objects
  and arrays print `(changed)`. A colour pair prints once under its alias, as the slot name or the hex.
- An element's ref is its ref in the next tab, a removed one's in the input tab. A stored arrow prints its kind as
  `? arrow` and no place.
- `order` prints as a change of its own, `~ t1  order front`, `~ n1  order above n3`.
- A laid-out element that ends where it began prints nothing (EO56).

Footer (`formatResultFooter`), composed by the api or the CLI from what only they know:

- Write: `rev 41→42 · cs_8k2m4q7d1x · <lint summary> · revert: livehuddle changeset revert <documentId> cs_8k2m4q7d1x`
  (the document's full id, so the command resolves without a search);
  rebased: `rev 41→44 · rebased over 3 writes · cs_… · …`. The lint summary is the summary line of the api's
  `?view=lint` for the next tab.
- Dry run: `dry run · rev 41 · <lint summary> · nothing written` (EO44).

## Data and persistence

| Datum                              | Class     | Notes                                                                                     |
| ---------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `EditOperation`                    | transient | Parsed per request; the changeset record stores what the changesets blueprint names       |
| `elementOps`, `inverse`            | derived   | JSON-serialisable `ElementOp[]`; stored and relayed by the changeset pipeline             |
| New elements                       | content   | Written in the current `DOCUMENT_FORMAT`                                                  |
| `fillSwatch` on a slot             | content   | The quick-style binding the editor re-derives on a theme change (`rederiveQuickSwatches`) |
| `results`, `targets`, `createdIds` | derived   | Recomputed on every apply; never stored by the engine                                     |

The engine holds no state, no table and no migration. Snapshot and restore are the tab itself; `inverse` restores
the before-images exactly (I4).

## Errors and edge cases

Rejections, in the spec's table; the engine raises all but `changeset_conflict` and `elements_held`, which the
changeset pipeline raises with the same shape and formatter, and `arrow_exists` and `not_connected`, which stay in
`EDIT_REJECTION_CODES` on the wire and nothing raises since part 4. `too_large` is raised here for the operation
count and by the api for the tab byte cap. The warning `arrows_freed` likewise stays in `EDIT_WARNING_CODES` and is
never given.

| Code                | Detail lines                                                                    | Hint                                                              |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `parse_error`       | `line <n>, column <c>: expected <what>`, the line with a caret under the column | `quote values with spaces: label="Sign in"`, or the expected word |
| `unknown_operation` | `"<word>" is not an operation`; `operations: add set rm move …`                 | `did you mean <nearest>?` when one is within distance 2           |
| `target_not_found`  | `"<selector>" matches nothing`; up to 5 nearest as `ref  kind "label"`          | `use a ref from the outline, or label~<word> for part of a label` |
| `target_ambiguous`  | `"<selector>" matches <n> elements:` and each as `ref  kind "label"`            | `use a ref, narrow with type:<kind of the first>, or add all`     |
| `unknown_field`     | `<kind> has no field "<key>"`; `fields: <aliases>, then <stored names>`         | `did you mean <nearest>?`                                         |
| `invalid_value`     | `<key>=<value>: <rule>`; `allowed: <values>` or the range                       | The nearest allowed value                                         |
| `id_taken`          | `id "<id>" is taken by <kind> "<label>"`                                        | `use id=<free>`                                                   |
| `test_failed`       | `<ref> <key>: expected <value>, actual <value>`                                 | `re-read <ref>: it changed since you read it`                     |
| `invalid_result`    | `<ref> <field>: <rule>` from `elementValidationIssue`                           | `see the format: livehuddle schema <kind>`                        |
| `too_large`         | `<n> operations; the cap is <CHANGESET_MAX_OPERATIONS>`                         | `split it into several changesets, or send a replace`             |

Every rejection prints `error <code> · op <n> · <formatOperation(op)>` (parse errors: `· line <n>`), its detail
and hint lines indented, and the block ends with `nothing was applied`. Parsing reports up to `EDIT_MAX_ERRORS`
malformed lines; applying gathers up to `EDIT_MAX_ERRORS` misses and stops at any other rejection (EO7). Candidate lists stop at
`REJECTION_CANDIDATES_MAX` with `… <n> more`.

Edge cases:

- **E1** An operation that changes nothing (`set n3 label="Login"` on `"Login"`): no line, no element op; the
  changeset still succeeds.
- **E2** `rm` of an element an earlier operation added: both vanish from the diff; no line.
- **E3** A selector matching an element an earlier operation removed: it is gone from the state, so
  `target_not_found`.
- **E4** `move` onto the same position: no line.
- **E5** `set` on a stored arrow's `label` over `LABEL_CAP_MAX`: cut, warning `label_capped`; an arrow has no note.
- **E7** Gone (part 4): no `insert`.
- **E9** `layout` of any selection: every box is swept into rows from the top-left.
- **E10** An element whose id is a reserved word: reached by label or a longer prefix (EO10).
- **E11** A theme id the caller did not resolve (no catalogue entry names it): the default scheme's slots; `log('[edit-ops] theme-fallback')`.
- **E13** A tab at `MAX_ELEMENTS_PER_TAB`: an `add` makes it invalid; `invalid_result` names the cap.
- **E14** Gone (part 4): no `keep-arrows`.
- **E16** Gone (part 4): no `connect`.
- **E17** Gone (part 4) for `connect`; the `<a>-><b>` selector term with a third end is still a `parse_error`.
- **E18** `move` of a stored arrow alone: by an offset, nothing moves and no line prints; with a placement,
  `invalid_value` ("a stored arrow does not move").
- **E19** `rm` of a box a stored arrow is pinned to: the arrow stays as stored, its end naming an element no longer
  there.

## Security and trust

- Input is untrusted text from any edit-role caller. The engine grants nothing a tab `PUT` does not: every
  result passes `isValidTab` and then the api's existing caps (`MAX_TAB_BYTES`, per-field caps), the same gate as
  the editor's save. Role checks belong to the changeset route.
- No dynamic code, no regular expression built from input (`label~` is a substring test), no prototype keys
  (`__proto__`, `constructor`, `prototype` refused), objects built with own keys only.
- Bounded work per request: `CHANGESET_MAX_OPERATIONS`, `EDIT_LINE_MAX_CHARS`, `EDIT_MAX_ERRORS`, banded edit
  distance; no loop without a bound (the nudge passes one occupier per step).
- `selected` reads only `options.selected`, which the api fills with the token owner's selection, never another
  person's.
- Logs carry counts, codes and operation names, never labels, notes or ids (an agent's id is a slug of its label).

## Performance and limits

Worst case: `MAX_ELEMENTS_PER_TAB` (10,000) elements, `CHANGESET_MAX_OPERATIONS` (500) operations.

- **State.** One `Map` and one order array, copied once; operations write in place on the copy. Building the next
  `elements` array is one pass at the end.
- **Selectors.** A ref is `resolveRef` over the `RefTable`, recomputed only after an add or remove; a filter selector is one pass, `O(n)`;
  `downstream` / `upstream` one breadth-first walk over an adjacency map of the stored arrows, built once per
  changeset and rebuilt only after a stored arrow changes, `O(n + arrows)`. 500 filter selectors over 10,000
  elements: 5,000,000 checks, about 20 ms in a Worker.
- **Overlap and occupancy.** Placement buckets the occupiers once per placement (`firstOverlapIn`, cells of
  `ELEMENT_GRID_CELL` 256, boxes over `ELEMENT_GRID_MAX_CELLS` cells on a list every query checks), so each nudge step
  costs the neighbourhood and a walk past a row of n boxes costs O(n).
- **No containment, no rebind.** With nothing holding and no arrow re-anchored, finalise makes no pass over the
  arrows or the containers: it normalises and validates the touched elements only.
- **Targets.** `noteTarget` keeps a `Set` beside the ordered `targets`, so a `set … all` notes each element in
  `O(1)`; the old `includes` was quadratic in the elements resolved.
- **Nearest candidates** run only on `target_not_found` / `unknown_field`: banded Levenshtein with band
  `NEAREST_MAX_DISTANCE` over labels cut to 60 characters, `O(n × 60 × band)`, about 6,000,000 cells a miss at
  worst; a request gathers at most `EDIT_MAX_ERRORS` (10) misses, so at most ten such passes.
- **Layout** costs one `sweepEdgelessNodes` over the selection's boxes.
- **Budget.** `EDIT_APPLY_BUDGET_MS` is the aim for a 500-operation changeset on a 2,000-element tab, measured, not
  a gate. Measured before part 4: 498 operations on 1,980 elements took 39 ms without inserts; the inserts that cost
  more are gone. The gate is `performance.test.ts`: four times the tab, or four times the changeset, costs under
  eight times as much; `noteTarget` is timed alone at 2,400 and 9,600 elements, and a walk past a row of boxes, under
  the same ratio.

## Observability

The engine logs through `options.log` (no logger, no logs); the api passes one that prefixes the document, tab
and changeset ids. Fields are counts, codes and names only.

| Fingerprint                   | When                                         | Fields                                                           |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `[edit-ops] parsed`           | `parseEditOperations` succeeded              | `operations`, `lineForm`, `jsonForm`                             |
| `[edit-ops] parse-rejected`   | Parsing failed                               | `code`, `errors`, `line`, `column`                               |
| `[edit-ops] applied`          | An outcome with a tab                        | `operations`, `added`, `changed`, `removed`, `moved`, `warnings` |
| `[edit-ops] rejected`         | An outcome with errors                       | `code`, `operation`, `op`                                        |
| `[edit-ops] unmatched`        | Misses were gathered                         | `count`, `stopped`                                               |
| `[edit-ops] widened`          | Fit to label grew a box                      | `operation`                                                      |
| `[edit-ops] coerced`          | A shape kind or code value was coerced       | `operation`, `field`                                             |
| `[edit-ops] label-capped`     | A label moved into the note                  | `operation`                                                      |
| `[edit-ops] selection-unread` | `selected` with `selected: null`             | `operation`                                                      |
| `[edit-ops] theme-fallback`   | No theme passed and `tab.theme` not built in | (none)                                                           |
| `[edit-ops] replace`          | `applyReplace` ran                           | `source` (template, elements), `elements`                        |
| `[edit-ops] laid-out`         | `layout` laid boxes out                      | `operation`, `boxes`                                             |
| `[edit-ops] test-failed`      | A `test` found other values                  | `operation`, `fields`                                            |

Gone (part 4): `[edit-ops] make-room`.

## Testing

Every suite uses `packages/edit-operations/src/fixtures/checkout-flow.ts` and a fixed `makeId`; no test touches the network or the clock.

| Spec rule                                                                                                                                                        | Test                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The vocabulary: seven operations, each line form parses to its JSON form; `connect`, `rewire`, `insert`, `wrap` and `unwrap` are unknown, `inside:` no placement | `parse.test.ts` › "parseEditOperations: the line form (the vocabulary)", "reads connect, rewire and insert as words that are not operations", "reads wrap and unwrap as words that are not operations, and inside: as no placement" |
| Values with spaces quoted; `#` starts a comment line, and is text inside a line                                                                                  | `../packages/edit-operations/src/tokenise.test.ts`, `parse.test.ts` › "skips comments and blank lines, mixes forms, and numbers operations among them"                                                                              |
| One parser turns the line form into the JSON form; both accepted                                                                                                 | `parse.test.ts` › "skips comments and blank lines, mixes forms, …", "formatOperation round trip"                                                                                                                                    |
| `parse_error` names the line, the column and what was expected                                                                                                   | `parse.test.ts` › "names the line, the column and what was expected, with a caret"                                                                                                                                                  |
| `unknown_operation` names the vocabulary                                                                                                                         | `rejections.test.ts` › "unknown_operation names the vocabulary and the nearest name"                                                                                                                                                |
| Each selector row (ref, prefix, id, `id:"…"`, label, `label~`, type, shape, stored arrows by their ends, downstream, upstream, selected); `in:` no key           | `selectors.test.ts` › "selector rows", one `it` per row, "selector refusals"                                                                                                                                                        |
| Exactly one match unless `all`; none with nearest labels; several with candidates                                                                                | `selectors.test.ts` › "cardinality"                                                                                                                                                                                                 |
| `selected` with nothing selected is refused                                                                                                                      | `selectors.test.ts` › "selected: the owner's selection"                                                                                                                                                                             |
| `add` sized for its label by the kind's factory, placed by a placement word; arrows, lines, strokes, paths and annotations refused                               | `packages/edit-operations/src/operations/add-kind.test.ts`                                                                                                                                                                          |
| `id=` names the new element for later operations; `id_taken`                                                                                                     | `packages/edit-operations/src/operations/add-kind.test.ts`, `ids.test.ts`                                                                                                                                                           |
| `set` changes the named fields; `key=` unsets; no geometry but widen-to-fit; a stored arrow's new ends keep its route                                            | `packages/edit-operations/src/operations/set.test.ts`, `labels.test.ts`                                                                                                                                                             |
| `rm` removes only what it names, a stored arrow pinned to it left as stored; `keepArrows` refused                                                                | `packages/edit-operations/src/operations/rm.test.ts`                                                                                                                                                                                |
| `move`: a stored boundary moves alone, carrying nothing; a stored arrow stays where it is                                                                        | `packages/edit-operations/src/operations/move.test.ts`                                                                                                                                                                              |
| Live fields are never written by `set`                                                                                                                           | `fields.test.ts` › "refuses identity, live and prototype fields, and keys the type lacks"                                                                                                                                           |
| One value a term; `layout` members: each ref or quoted label one element, the rest together                                                                      | `selectors.test.ts` › "selector refusals", `packages/edit-operations/src/operations/layout.test.ts`                                                                                                                                 |
| `targets` and `createdIds` list what the changeset resolved and created                                                                                          | `apply.test.ts` › "lists the existing elements it resolved", "lists the elements it created"                                                                                                                                        |
| `order`: an element goes where it is told, a stored boundary too                                                                                                 | `packages/edit-operations/src/operations/order.test.ts`                                                                                                                                                                             |
| `layout` sweeps only the selection into rows, keeping its top-left; `style=` and `direction=` refused                                                            | `packages/edit-operations/src/operations/layout.test.ts`                                                                                                                                                                            |
| `test` fails the changeset unless the values hold                                                                                                                | `packages/edit-operations/src/operations/test-fields.test.ts`                                                                                                                                                                       |
| Placement words (`after:` as `below:`, `align:` on the nearer axis), `gap:`, default placement, nudge until free                                                 | `placement.test.ts`, one `it` per word, `packages/edit-operations/src/operations/placement-combos.test.ts`                                                                                                                          |
| A stored lane, stack, boundary or frame is no occupier; a stored card is                                                                                         | `placement.test.ts` › "a stored backdrop"                                                                                                                                                                                           |
| An `add` of a retired kind draws a square; a relabelled stored lane stays a lane                                                                                 | `packages/edit-operations/src/operations/add-kind.test.ts` › "makes a square for a layout container", `packages/edit-operations/src/operations/set.test.ts` › "relabels a stored lane"                                              |
| Coordinates shown and taken are rounded and relative to the content origin                                                                                       | `placement.test.ts`, `results.test.ts`                                                                                                                                                                                              |
| `shape=` coerced as the MCP does                                                                                                                                 | `fields.test.ts` › "coerces an off-vocabulary shape with a warning"                                                                                                                                                                 |
| `fill=` theme slot; hex with `colour_overrides_theme`; stickies excepted                                                                                         | `colours.test.ts`                                                                                                                                                                                                                   |
| `text=`, `note=`, `line=` vocabulary                                                                                                                             | `fields.test.ts`                                                                                                                                                                                                                    |
| A label over 40 characters keeps the heading, full text into the note                                                                                            | `labels.test.ts` (the MCP spec's three examples)                                                                                                                                                                                    |
| Unknown field names the kind's fields; invalid value names the allowed values                                                                                    | `rejections.test.ts` › "unknown_field names the kind, its fields and the nearest one", "invalid_value names the key, value and rule"                                                                                                |
| Only `layout` and `replace` move many elements; untouched stays identical                                                                                        | `apply.test.ts` › "I2 passes untouched elements through as the same objects", `invariants.test.ts`                                                                                                                                  |
| Results: the spec's example lines, formatted character for character; a stored arrow's lines                                                                     | `results.test.ts` › "prints the spec example character for character", "result line builders"                                                                                                                                       |
| Rejections: the spec's example rejection, formatted character for character                                                                                      | `rejections.test.ts` › "prints the spec example character for character"                                                                                                                                                            |
| A rejected changeset applies nothing                                                                                                                             | `apply.test.ts` › "I1 applies all or nothing, and never mutates its input"                                                                                                                                                          |
| `elementOps` and `inverse` round trip                                                                                                                            | `apply.test.ts` › "I4 round trips through the element ops and their inverse"                                                                                                                                                        |
| Deterministic                                                                                                                                                    | `apply.test.ts` › "I5 is deterministic: no clock, no randomness, ids from makeId"                                                                                                                                                   |
| A stored arrow is left as stored when a box it is pinned to moves; an added lane is never sent to the back (I6)                                                  | `apply.test.ts` › "finalise"                                                                                                                                                                                                        |
| `too_large` over `CHANGESET_MAX_OPERATIONS`                                                                                                                      | `parse.test.ts` › "caps the line length, the operation count and the errors reported", `apply.test.ts`                                                                                                                              |
| Cost grows linearly with the tab and with the changeset                                                                                                          | `performance.test.ts`                                                                                                                                                                                                               |
| `replace` from a template or elements; a stored arrow kept as sent; a `graph` or Mermaid body has no source                                                      | `replace.test.ts`                                                                                                                                                                                                                   |
| Moved MCP modules behave as before                                                                                                                               | `packages/document/src/{element-normalise,label-cap,tab-builders}.test.ts`                                                                                                                                                          |
| Every stored field listed per type                                                                                                                               | `packages/document/src/element-fields.test.ts` (plus the compile-time `satisfies`)                                                                                                                                                  |
| Validation names the field and rule                                                                                                                              | `packages/document/src/validate.test.ts` › "elementValidationIssue"                                                                                                                                                                 |
| Refs, slugs, kind words, origin (the document-views blueprint's tests)                                                                                           | `packages/document/src/element-refs.test.ts`                                                                                                                                                                                        |
| Batched element ops equal the sequential reduce                                                                                                                  | `packages/document/src/element-ops.test.ts` › "applyElementOps, batched"                                                                                                                                                            |
| Observability: each fingerprint fires with its fields and no content                                                                                             | `apply.test.ts` › "logs" (a recording `log`), `parse.test.ts` › "logs what it parsed and what it refused"                                                                                                                           |

## Constants and configuration

| Constant                   | Value                     | Provenance                                                                            | Safe range      |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------- | --------------- |
| `CHANGESET_MAX_OPERATIONS` | 500                       | [Agent changesets](../agent-changesets.md), imported from `@livehuddle/api-schema`    | owned there     |
| `LABEL_CAP_MAX`            | 40                        | Spec; kept from the retired graph input                                               | 24 to 80        |
| `PLACEMENT_GAP`            | `LAYER_GAP` (90)          | The layout sweep's row gap (EO23)                                                     | 16 to 200       |
| `PLACEMENT_GAP_MAX`        | 2,000                     | Larger reads as a separate drawing (EO23)                                             | 500 to 10,000   |
| `SLUG_ID_PATTERN`          | `^[a-z][a-z0-9_-]{0,23}$` | [Document views](../document-views.md), from `@livehuddle/document`                   | fixed           |
| `REF_MIN_LENGTH`           | 4                         | [Document views](../document-views.md), from `@livehuddle/document`                   | fixed           |
| `EDIT_LINE_MAX_CHARS`      | 16,384                    | A 4,000-character code value with escapes and its other fields fits (EO3)             | 8,192 to 65,536 |
| `EDIT_MAX_ERRORS`          | 10                        | Enough to fix a batch of typos in one round (EO7)                                     | 1 to 50         |
| `REJECTION_CANDIDATES_MAX` | 10                        | A readable list; the rest counted (EO45)                                              | 5 to 25         |
| `NEAREST_CANDIDATES_MAX`   | 5                         | The few worth trying (EO45)                                                           | 3 to 10         |
| `NEAREST_MAX_DISTANCE`     | 3                         | Typos and short slips, not other words (EO45)                                         | 2 to 5          |
| `EDIT_APPLY_BUDGET_MS`     | 50                        | A tenth of a request's patience at the 500-operation cap; a measured aim, not in code | 20 to 200       |

`INSERT_MIN_GAP` (16) is still exported from `vocabulary.ts` and read by nothing since `insert` went (part 4).

No environment variable, binding or secret; deploying needs nothing new.

## Defaults ledger

EO1 to EO57 in [DEFAULTS.md](DEFAULTS.md); the rows for `connect`, `rewire`, `insert`, make room and arrow rebinding
are marked gone with part 4.
