# Edit operations: blueprint

Derived from [Edit operations](../edit-operations.md), with the changeset body and limits of
[Agent changesets](../agent-changesets.md), the refs and containment of [Document views](../document-views.md),
the lint summary of [Diagram lint](../diagram-lint.md), the `replace` inputs and normalisation of
[MCP server](../../015-api/mcp-server.md) §4.4, §4.7 and §4.7a, and the token style of
[Explorer filters](../../013-workspace/explorer-filters.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`EOn`. Refs, slug ids, kind tokens, containment and the content origin are the shared modules the
[Document views](document-views.md) blueprint defines in `@livediagram/document`; this file consumes them.

Scope, by file:

| File                                                                              | Role                                                                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/edit-operations/{package.json,tsconfig.json,eslint.config.js,...}`      | Private workspace package `@livediagram/edit-operations`, laid out like `packages/explorer-lens` (EO1)                                                              |
| `packages/edit-operations/src/index.ts`                                           | The public surface (listed under [Interfaces and contracts](#interfaces-and-contracts))                                                                             |
| `packages/edit-operations/src/types.ts`                                           | `EditOperation` and one type per operation, `Selector`, `Placement`, `FieldValue`, `ApplyOptions`, outcomes                                                         |
| `packages/edit-operations/src/vocabulary.ts`                                      | `EDIT_OPERATION_NAMES`, `OPERATION_MEMBERS`, `PLACEMENT_RELATIONS`, `SELECTOR_KEYS`, `FLAG_MEMBERS`, `RESERVED_WORDS`, constants                                    |
| `packages/edit-operations/src/tokenise.ts`                                        | `tokeniseLine`: words, quotes, JSON escapes, columns                                                                                                                |
| `packages/edit-operations/src/parse-line.ts`                                      | `parseOperationWords`: one line form line's words into one raw operation                                                                                            |
| `packages/edit-operations/src/parse-json.ts`                                      | `validateEditOperation(s)`: one JSON form object, checked member by member                                                                                          |
| `packages/edit-operations/src/parse.ts`                                           | `parseEditOperations(text)`: lines, comments, form per line, the count cap, errors with line and caret                                                              |
| `packages/edit-operations/src/format-operation.ts`                                | `formatOperation`: the canonical line form of an operation (rejection headers, round trips)                                                                         |
| `packages/edit-operations/src/selectors.ts`                                       | `parseSelector`, `resolveSelector`, `resolveOne`, `resolveSome`, `resolveMembers` (`wrap`, `layout`), `isSingleWord`                                                |
| `packages/edit-operations/src/graph-walk.ts`                                      | `reachableFrom`: `downstream:` and `upstream:` along pinned arrows                                                                                                  |
| `packages/edit-operations/src/nearest.ts`                                         | `nearestElements`, `nearestName`: banded edit distance over labels and refs                                                                                         |
| `packages/edit-operations/src/fields.ts`                                          | `FIELD_ALIASES`, `ALIAS_FIELDS`, `aliasesOf`, `writeFieldsOnto`, `fieldValue`: keys, unknown fields, value writes                                                   |
| `packages/edit-operations/src/colours.ts`                                         | `resolveColourValue`, `fillSlotNames`, `fillValue`: theme slots, hex, sticky presets                                                                                |
| `packages/edit-operations/src/labels.ts`                                          | `applyLabel` (cap into the note), `fitToLabel` (grow around the centre)                                                                                             |
| `packages/edit-operations/src/placement.ts`                                       | `resolvePlacement`, `defaultSpot`, `nudgeUntilFree`, `firstOverlapIn`, `boxOf`, `shifted`                                                                           |
| `packages/edit-operations/src/make-room.ts`                                       | `makeRoom`: the insert shift, its scope, container growth outward                                                                                                   |
| `packages/edit-operations/src/state.ts`                                           | `EditState` and its writers (`putElement`, `moveElement`, `insertElement`, `removeElement`, `reorder`), memoised refs, holders and element list                     |
| `packages/edit-operations/src/locks.ts`                                           | `lockedIds(tab)`, `layerLockOf`: locked elements and elements on locked layers                                                                                      |
| `packages/edit-operations/src/ids.ts`                                             | `newElementId` (`id=` checks), `mintId` (`slugIdFor` over `state.taken`)                                                                                            |
| `packages/edit-operations/src/operations/*.ts`                                    | One file per operation: `add` (an element), `add-kind`, `set`, `rm`, `move`, `connect` (and `rewire`), `insert`, `wrap`, `unwrap`, `order`, `layout`, `test-fields` |
| `packages/edit-operations/src/finalise.ts`                                        | Normalise touched, landing, arrow rebind, lanes first, `containersBehindMembers`, validation with reasons                                                           |
| `packages/edit-operations/src/apply.ts`                                           | `applyEditOperations`                                                                                                                                               |
| `packages/edit-operations/src/replace.ts`                                         | `applyReplace`: the `replace` body through the same outcome shape                                                                                                   |
| `packages/edit-operations/src/results.ts`, `format-results.ts`                    | `buildResultLines` (membership by `deriveContainers` before and after), `formatResultLines`, `formatResultFooter`                                                   |
| `packages/edit-operations/src/rejections.ts`                                      | `rejection` builders per code, `formatRejections`                                                                                                                   |
| `packages/edit-operations/src/fixtures/checkout-flow.ts`, `run.ts`, `outcomes.ts` | The research's checkout tab (`n1` to `n8`, `t1`, `a1` to `a7`) plus a frame `f2`; a line-form runner; outcome readers                                               |
| `packages/edit-operations/src/invariants.test.ts`, `performance.test.ts`          | I1 to I7 over one changeset per operation; cost growth with the tab and the changeset                                                                               |
| `packages/document/src/element-normalise.ts` (+ test)                             | moved from `apps/mcp/src/`: `normaliseElement(s)`, `lanesToFront`, `mergeElementUpdate`                                                                             |
| `packages/document/src/graph-input.ts` (+ test)                                   | moved from `apps/mcp/src/`: `GRAPH_LABEL_MAX`, `capLabel`, `layoutGraph`, `resolveGraphInput`                                                                       |
| `packages/document/src/tab-builders.ts` (+ test)                                  | moved from `apps/mcp/src/`: `applyLayout`, `buildTab`, `buildGraphTab`, `landWorkshopArrivals` (EO2)                                                                |
| `packages/templates/src/template-tab.ts` (+ test)                                 | `buildTemplateTab`, `resolveTemplate`, `validTemplateKinds`: the template builders, in `templates` because it imports `document` (EO1)                              |
| `packages/document/src/element-fields.ts` (+ test)                                | `ELEMENT_FIELD_NAMES`: every stored field per element type, compile-time exhaustive                                                                                 |
| `packages/document/src/validate.ts` (+ test)                                      | `elementValidationIssue(el)` names the field and rule; `isValidElement` delegates to it                                                                             |
| `packages/document/src/containment.ts` (+ test)                                   | Shared: `boxCentre`, `boxHoldsPoint`, `smallestHolder`, `deriveContainers`, `contentOrigin`; this blueprint adds `isContainer` and `containerContents`              |
| `packages/document/src/element-refs.ts` (+ test)                                  | Shared: `SLUG_ID_PATTERN`, `isSlugId`, `slugIdFor`, `REF_MIN_LENGTH`, `computeRefs`, `RefTable`, `resolveRef`, `kindWordOf`                                         |
| `packages/document/src/auto-layout.ts` (+ test)                                   | `flowDirectionOf`: the direction `autoLayoutElements` detects, named by `layout`'s result line                                                                      |
| `packages/document/src/element-ops.ts` (+ test)                                   | `applyElementOps` writes runs of updates through an id index: exactly the sequential reduce, linear in the changeset                                                |
| `packages/document/src/auto-layout-shared.ts`, `auto-layout-clusters.ts`          | Export `LAYER_GAP`, `SIBLING_GAP`, `FRAME_PAD`, `FRAME_TOP` through `index.ts`                                                                                      |
| `packages/document/src/index.ts`, `packages/templates/src/index.ts`               | Re-export the moved and new modules                                                                                                                                 |
| `apps/mcp/src/tools.ts`, `schema.ts`, `changeset-client.ts`                       | Import the moved modules; `ops` mode resolves an `elementId` as an id or a ref and targets it by `id:"…"`                                                           |
| `apps/api/src/changesets/request.ts`                                              | `operations` as a JSON array or the line form as a string, parsed with the engine's log                                                                             |
| `apps/live/lib/canvas.ts`                                                         | `withFrameContents` and `isFrameEl` removed; `framesFirst` reads `isContainer`                                                                                      |
| `apps/live/hooks/canvas/useBoxedDragHandlers.ts`                                  | The drag's move set is `containerContents(elements, ids)`                                                                                                           |
| `apps/live/lib/canvas.test.ts`                                                    | The `withFrameContents` suite gives way to `containment.test.ts` and `useEditorDrag.frames.test.tsx`                                                                |
| `apps/api/package.json`                                                           | Depends on `@livediagram/edit-operations`; the changeset route is the [Agent changesets](agent-changesets.md) blueprint's                                           |
| `docs/development/architecture.md`, `README.md`                                   | The package in the package list                                                                                                                                     |

## Domain and naming

| Term               | Identifier                                          | Meaning                                                                                                                      |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Edit operation     | `EditOperation` (union on `op`)                     | One step of a changeset, in its JSON form                                                                                    |
| Operation name     | `EditOperationName`, `EDIT_OPERATION_NAMES`         | `add set rm move connect rewire insert wrap unwrap order layout test`                                                        |
| Line form          | `parseEditOperations`, `formatOperation`            | One operation a line, words and quoted values                                                                                |
| JSON form          | `validateEditOperation`                             | One object a line                                                                                                            |
| Operation number   | `operation` (1-based) on rejections                 | Position among the operations, comments and blank lines not counted                                                          |
| Selector           | `Selector` (a string), `parseSelector`              | A ref, a quoted label, or `key:value` terms, all of which must match                                                         |
| Selector term      | `SelectorTerm` (union on `kind`)                    | One word of a selector                                                                                                       |
| Ref                | `computeRefs`, `RefTable`, `resolveRef` (shared)    | An element's short name, as views print it                                                                                   |
| Slug id            | `isSlugId`, `SLUG_ID_PATTERN`, `slugIdFor` (shared) | The id an agent names or the engine mints from a label or kind token                                                         |
| Kind word          | `kindWordOf` (shared)                               | The shape for shapes, else the element type: what `type:` and results print                                                  |
| Placement          | `Placement` (union on `rel`)                        | Where `add` and `move` put an element                                                                                        |
| Content origin     | `contentOrigin(tab)` (shared)                       | The point coordinates shown and taken are relative to                                                                        |
| Field              | `fields` member, `FieldValue`                       | A key and its value; `null` unsets                                                                                           |
| Field alias        | `FIELD_ALIASES`                                     | A spec-named key (`label`, `note`, `shape`, `fill`, `text`, `line`) or a view's style key (`stroke`, `text-color`, `border`) |
| Live field         | `LIVE_ELEMENT_FIELDS` (`@livediagram/document`)     | A multi-writer field that travels as a delta; never written by an operation                                                  |
| Theme slot         | `fillSlotNames`, `resolveColourValue`               | `theme` or one of the theme's six quick-swatch hues, written as a binding                                                    |
| Container          | `isContainer` (frame or lane)                       | A shape whose box holds members                                                                                              |
| Member, membership | `deriveContainers` (shared) over `smallestHolder`   | An element and the smallest frame or lane holding its centre                                                                 |
| Carried            | `containerContents(elements, ids)`                  | What a moved container takes with it, in the editor's drag and in `move` alike                                               |
| Lock               | `lockedIds(state)`, `element_locked`                | A locked tab, a locked element, or an element on a locked layer                                                              |
| Make room          | `makeRoom`                                          | The insert's shift of what lies beyond the new node                                                                          |
| Capture            | `frame_captures`, `bystanders`                      | A non-member a new frame or lane would hold                                                                                  |
| Working state      | `EditState`                                         | The tab as the operations have left it so far                                                                                |
| Touched            | `EditState.touched`                                 | Elements an operation created or changed; only these are normalised                                                          |
| Moved              | `Touch.moved` (`MoveReason`), `moveElement`         | Elements shifted, carried, laid out or landed without an operation writing them                                              |
| Targets            | `targets: ElementId[]`                              | Existing elements the operations resolved; fingerprinted and checked for holds                                               |
| Created ids        | `createdIds: ElementId[]`                           | Elements the changeset created that are in the next tab                                                                      |
| Outcome            | `ApplyOutcome` = `ApplySuccess \| ApplyRejection`   | `{ tab, results, elementOps, inverse, warnings, targets, createdIds }` or `{ errors }`                                       |
| Result line        | `ResultLine` (union on `mark`)                      | One line of a changeset's answer: `+ ~ - »`, a container line, `!`                                                           |
| Warning            | `EditWarning`, `EDIT_WARNING_CODES`                 | A named note that does not reject                                                                                            |
| Rejection          | `EditRejection`, `EDIT_REJECTION_CODES`             | A named refusal; the spec's code table                                                                                       |
| Replace            | `ReplaceBody`, `applyReplace`                       | The other changeset body: a whole tab from graph, Mermaid, template, elements                                                |

Banned: "op" for an edit operation (that is a room `ElementOp`), "action", "command" (a CLI command is a front
door), "batch", "patch", "query" or "filter" for a selector, "handle" or "alias" for a ref, "group" for a frame
(groups were removed), "parent" for a container (only `mindParentId` is a parent), "section" in code (a frame),
"swimlane" in code (a lane).

## Behaviour and state

### The pipeline

`applyEditOperations(tab, operations, options)` runs, in this order, and stops at the first rejection:

1. **Count.** More than `CHANGESET_MAX_OPERATIONS` operations: `too_large`.
2. **Tab lock.** `tab.locked`: `element_locked` naming the tab, before any operation.
3. **Prepare.** `createState(tab, options, log)`: elements by id, their order, `origin = contentOrigin(tab)`,
   `theme = options.theme ?? getBuiltInTheme(tab.theme)`, `taken` (the tab's ids and the reserved words),
   `locked = lockedIds(tab)`; refs, holders and the element list are memoised and cleared by every write.
4. **Apply each operation in order** against the working state. Every selector resolves against the state as the
   operations before it left it, so an `id=` given earlier is addressable later. Each operation adds the
   pre-existing ids it resolved to `state.targets`, records its named, touched and created ids, its moves and its
   annotations (widened, make room, style of, warnings). An operation that would change an id in `locked` is
   `element_locked`.
5. **Finalise** ([Finalise](#finalise)).
6. **Validate** every touched element with `elementValidationIssue`, then the whole tab with `isValidTab`; the
   first issue is `invalid_result`.
7. **Diff.** `elementOps = diffToElementOps(tab.elements, next.elements)`;
   `inverse = diffToElementOps(next.elements, tab.elements)`.
8. **Results.** `buildResultLines(before, after, state)`; `targets` and `createdIds` in first-resolution and
   creation order, each id once (EO46, EO48).

Invariants:

- **I1 Atomic.** An outcome with `errors` carries no tab; the input `tab` is never mutated (the state copies on
  write).
- **I2 Untouched stays identical.** An element no operation touched, shifted, carried, landed or rebound is the
  same object in `next.elements` as in `tab.elements`, so `diffToElementOps` emits nothing for it.
- **I3 Geometry moves only where the spec says.** Boxes change position or size only through: `add`, `insert`,
  `wrap` (the new element), `move` (its targets and what a moved container carries), named `x` / `y` / `width` /
  `height`, make room and container growth, fit to label, `layout` and `tidy` (the selection), `wrap make-room`
  (bystanders), `inside:` growth (EO27), event-storming landing. Arrows change only through their own operations,
  the ends of removed elements, a carry and `rebindArrowAnchorsAfterMove`. Every such change is a result line,
  anchors excepted (EO40).
- **I4 Round trip.** `applyElementOps(tab.elements, elementOps)` equals `next.elements`, and
  `applyElementOps(next.elements, inverse)` equals `tab.elements`.
- **I5 Deterministic.** The same tab, operations and options give the same outcome: no clock, no `Math.random`;
  ids not derived from text come from `options.makeId` (EO8).
- **I6 Containers behind members.** After finalising, every lane precedes every non-lane (`lanesToFront`) and every
  container precedes each of its members in the element order.
- **I7 Locks hold.** No element in `locked` differs between `tab` and `next`.

### Selectors

Grammar (line form; the JSON form carries the same text as a string):

```text
selector := term ( " " term )*
term     := ref | label | "label~" value | key ":" value | word "->" word | "selected"
key      := type | shape | in | from | to | downstream | upstream
ref      := an unquoted word that is not a reserved word and has no ":", "=", "~" or "->"
label    := a quoted value
word     := ref | label          (one element)
```

| Term                | Matches                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`               | `resolveRef(word, refs)`: the element whose id equals it, else the one id it is a prefix of; several: ambiguous                                   |
| `"Label"`           | Elements whose `label`, trimmed, equals it trimmed, compared after `toLowerCase()` (EO11)                                                         |
| `label~text`        | Elements whose `label` contains the text, compared after `toLowerCase()`                                                                          |
| `type:<v>`          | `kindWordOf(el) === v` or `el.type === v`, so `type:square` and `type:shape` both match a square                                                  |
| `shape:<v>`         | Shapes whose `shape === v`                                                                                                                        |
| `in:<word>`         | Elements whose chain of holders includes the container `<word>` names; arrows are never members (EO14)                                            |
| `from:<word>`       | Arrows whose `from` is pinned to that element                                                                                                     |
| `to:<word>`         | Arrows whose `to` is pinned to that element                                                                                                       |
| `<a>-><b>`          | Arrows whose `from` is pinned to `a` and `to` to `b`; split at the `->` outside quotes, so `"Sign in"->"Pay"` reads; a third end is a parse error |
| `downstream:<word>` | Boxed elements reachable from it along pinned arrows from `from` to `to`, itself excluded (EO13)                                                  |
| `upstream:<word>`   | The same against the arrows' direction                                                                                                            |
| `selected`          | The ids in `options.selected` that exist in the state                                                                                             |

- All terms of one selector must match (intersection). Matches are listed in element order (z-order, EO12).
- A `<word>` inside a term must resolve to exactly one element, else that word's own `target_not_found` or
  `target_ambiguous`. `in:` requires a container: otherwise `invalid_value` naming the containers.
- `refs` is recomputed after an operation adds or removes elements, so a ref minted in the changeset resolves. A
  `stale` ambiguity from `resolveRef` adds the detail line "matches <n> elements now; one was added since your
  read?".
- **Cardinality.** `set`, `rm`, `move`, `order`, `test`, `rewire`, `unwrap` and the ends of `connect` and
  `insert` and every placement reference need exactly one match; `set`, `rm` and `move` accept `all` for one or
  more. `wrap` members and `layout` are plural by nature. Zero matches is always `target_not_found`,
  `all` included.
- `selected`: `options.selected === null` (the room was not read) or an empty selection: `target_not_found` with
  the detail "nothing is selected" or "the selection could not be read" (EO16).
- Reserved words (`selected all again tidy absorb make-room keep-arrows between in frame lane front back`) always
  read as keywords; an element whose id is one is reached by label or by a longer prefix (EO10).
- One value a term: a comma in a `key:value` value is `parse_error` ("one value a term; join terms with spaces").

### Fields and values

A field key is an alias or a stored field name of the element's type. The aliases include every style key the views
print (`STYLE_KEYS`; `font` is a stored name already), so a printed `key=value` writes back unchanged.

| Alias        | Element types                                                     | Writes                                             | Values                                                                                              |
| ------------ | ----------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `label`      | every type with a `label` field                                   | `label`                                            | text; on a shape over `GRAPH_LABEL_MAX`, capped into the note; on an arrow, cut (EO18)              |
| `note`       | every type with a `note` field                                    | `note`                                             | text                                                                                                |
| `shape`      | `shape`                                                           | `shape`                                            | a shape kind; off-vocabulary coerced by `coerceShapeKind`, warning `shape_coerced`                  |
| `fill`       | types whose `themeColourFields` include `fillColor`, and `sticky` | `fillColor` + `fillSwatch` (sticky: + `textColor`) | a theme slot, or `#rgb` / `#rrggbb`, or on a sticky a sticky preset name                            |
| `stroke`     | every type with a `strokeColor` field                             | `strokeColor`; clears `strokeSwatch`               | a colour: hex (warning `colour_overrides_theme` where the theme colours it) or a marker colour name |
| `text-color` | every type with a `textColor` field                               | `textColor`                                        | a colour, as `stroke`                                                                               |
| `border`     | every type with a `strokeStyle` field                             | `strokeStyle`                                      | `solid dashed dotted long-dash dash-dot dash-dot-dot`                                               |
| `text`       | every type with a `textSize` field                                | `textSize`                                         | `sm md lg scale`                                                                                    |
| `line`       | `arrow`                                                           | `arrowStyle`                                       | `straight angled curved`                                                                            |

- **Stored field names** are `ELEMENT_FIELD_NAMES[el.type]`. `id` and `type` are refused (`invalid_value`,
  "cannot be changed"). `__proto__`, `constructor` and `prototype` are always `unknown_field`.
- **Live fields.** A key in `LIVE_ELEMENT_FIELDS` (the comment thread, responses, ideas) is `invalid_value` with
  the hint "comments go through the comment commands; responses and ideas are people's".
- **Value parsing.** JSON form values are JSON. Line form values: a quoted value is a string; an unquoted value is
  read as JSON when the whole value is a JSON number, `true` or `false`, or it starts with `[` or `{`, else it is a
  string (EO19): `label=2FA`, `label=3D` and `label=1st` are strings, `width=200` is a number.
  `key=` is `null`: the field is removed (`unset`).
- **Geometry.** A named `x`, `y`, `width` or `height` is written as given: stored, absolute coordinates, not
  origin-relative (EO20). It counts as a move for arrow rebinding and membership lines.
- **Merge.** Stored fields merge with `mergeElementUpdate` semantics: a nested object or array replaces the old one
  wholesale; `points` drops `packedPoints`.
- **Colours.** Slot names are `theme` and the six `quickSwatches(theme, 'fill')` names, lower-cased with spaces as
  `-` (`green`, `deep-blue`) (EO49). `fill=<slot>` writes `fillColor = quickSwatchColor(theme, 'fill', slot)` and
  `fillSwatch = slot`; `fill=theme` writes the slot 0 colour and removes `fillSwatch`. A hex value writes
  `fillColor`, removes `fillSwatch` and warns `colour_overrides_theme`, except on a sticky. On a sticky a
  `STICKY_PRESETS` name (`lemon`) writes its `fill` and `text` pair; a hex writes `fillColor` alone. A raw
  `fillColor`, `strokeColor` or `textColor` hex on a themed element warns the same way (EO21). Anything else is
  `invalid_value` listing the slot names (or, on a sticky, the preset names).
- **Labels.** `applyLabel(el, text)`: on a shape, `capLabel(text)`; when cut, `label` is the heading and the
  whole text, whitespace collapsed, is prepended to the note the element ends with (`"<full>\n\n<note>"`), as
  `conciseGraph` does; warning `label_capped`. On an arrow, `capLabel(text).label`, warning `label_capped`. Other
  types keep the text as given (EO18).
- **Fit to label.** After a `set` that changes a shape's `label` (or `text` / `shape`), when the shape has no
  `fixedSize`, its `textSize` is not `scale`, and `labelBoxSize(label, shape)` exceeds its box, the box grows to
  the larger of each side around its centre (`x -= dw / 2`, `y -= dh / 2`, rounded), annotated `widened w→w'` and
  `taller h→h'` (EO22). It never shrinks.

### Placement

`Placement` in line form is one word, plus an optional `gap:<n>`:

| Word             | Puts the element                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `right-of:<x>`   | `left = x.right + gap`, centred on x's centre y                                                                                                                        |
| `left-of:<x>`    | `right = x.left - gap`, centred on x's centre y                                                                                                                        |
| `below:<x>`      | `top = x.bottom + gap`, centred on x's centre x                                                                                                                        |
| `above:<x>`      | `bottom = x.top - gap`, centred on x's centre x                                                                                                                        |
| `after:<x>`      | One of the four above: the dominant axis and sign of the mean vector from x's centre to the centres of the targets of x's outgoing pinned arrows; none: `below` (EO24) |
| `inside:<frame>` | The first free slot in the container's interior (EO27)                                                                                                                 |
| `align:<x>`      | Shares x's centre on the axis where the element's centre is already nearer x's; a tie aligns the column (EO50)                                                         |
| `at:x,y`         | Top-left at `origin + (x, y)`, exact, never nudged (EO25)                                                                                                              |

- `gap` defaults to `PLACEMENT_GAP` and is an integer in `[0, PLACEMENT_GAP_MAX]` (EO23); it applies to the four
  sides and `after`.
- **No placement** on `add`: `right-of` the element the latest earlier `add` or `insert` in this changeset created;
  else top-left at `(contentRight + PLACEMENT_GAP, contentTop)` of all boxed elements; on an empty tab at the
  origin (EO26). `align:` on `add` aligns that default spot.
- **Nudge.** For the four sides, `after` and the default, while the box overlaps an occupying element, it moves
  along the placement axis (outward; the default moves right) to the occupier's far edge plus the gap. Occupying
  elements are boxed, not containers, not the moving set itself, on any layer. The loop ends: each step passes one
  occupier.
- **Move.** `move <selector> <placement>` places the moving set's bounding box as one box and translates every
  member by the same delta; `by=dx,dy` translates by exactly that. A placement relative to an element in the
  moving set is `invalid_value`. A container in the moving set carries `containerContents` ([Carry](#carry)). Carried
  elements keep their membership, so they print as `»` lines `(carried)`, not as container lines.
- Coordinates in results are `Math.round(value - origin)`; coordinates taken (`at:`) are added to the origin.

### Operations

Each operation's exact effect on the working state. "Paint" means `recolourElementForTheme(el, theme)`; "new id"
means `newElementId` ([Ids](#ids)).

- **`add <kind> [id=] key=value… [<placement>]`.** `kind` is a shape kind, an element type, or `shape` (a
  square). An unknown kind is coerced as a shape kind with `shape_coerced` (EO17). `arrow` is `invalid_value`
  ("use connect"); `image`, `video`, `freehand` and `path` are `invalid_value` (EO15). The element is the
  factory's (`createShape`, `createText`, `createSticky`, `createTable`, `createAnnotation`, `createLinkCard`) with
  a new id; shapes and text take `textSize: 'sm'` and `labelBoxSize(label, kind)` (EO28); fields apply as `set`
  does; it is painted, placed, given the layer of the placement reference when that layer is not locked, else
  `resolveActiveLayerId(layers, null)` (EO29, EO47), and appended to the element order. The JSON form may carry
  `element` (a whole raw element, as the MCP's `ops` mode sends) instead of `kind` and `fields`: it is taken as
  given, its geometry kept, its `id` kept when free (`id_taken` otherwise).
- **`set <selector> key=value… [all]`.** Each target gets the fields in order. No geometry changes except named
  geometry and fit to label. A target the fields leave as it was is not touched, so it is never normalised (E1, I2).
- **`rm <selector> [all] [keep-arrows]`.** Removes the targets. Arrows with an end pinned to (or `on-arrow` to) a
  removed element (`arrowReferencesAny`, repeated until no more are found) are removed too; with `keep-arrows`
  those ends become `free` at their current `endpointPosition` instead, warning `arrows_freed`. A locked arrow in
  that cascade is `element_locked` (EO47). A `mindParentId` naming a removed element is removed (EO30).
- **`move <selector> <placement> | by=dx,dy [all]`.** As [Placement](#placement). Pinned arrows follow by
  construction; `rebindArrowAnchorsAfterMove` runs in finalise.
- **`connect <a> -> <b> [id=] [label=…] [line=…] [again]`.** `a` and `b` are words resolving to boxed elements.
  An existing arrow from a to b (pinned `from` a, pinned `to` b) without `again` is `arrow_exists`, naming it; an
  arrow from b to a does not count; `a` equal to `b` is `invalid_value`. Otherwise a new arrow
  `createPinnedArrow(a, bestAnchorTowards(a, centreOf(b)), b, bestAnchorTowards(b, centreOf(a)))`, new id, other
  fields as `set`, painted, on a's layer, inserted in the order directly after the later of a and b.
- **`rewire <arrow> from=<x> | to=<y>`.** The target must be an arrow; x or y a boxed element (`invalid_value`
  otherwise). The named end is pinned to it; both ends re-anchor with `bestAnchorTowards` facing each other; the
  arrow's `curveOffset`, `curvePoints` and `elbowOffset` are removed (EO31).
- **`insert <kind> [id=] key=value… between <a> <b>`.** The arrows pinned from a to b: none is `not_connected`,
  several is `target_ambiguous` naming them, with the hint "rewire one of them by its ref instead". The node is
  built as `add` builds it, then:
  1. **Axis.** From a's centre to b's centre, horizontal when `|dx| ≥ |dy|`, signed by the direction.
  2. **Gap.** The clearance between a's far edge and b's near edge on the axis; below `INSERT_MIN_GAP` it is
     `PLACEMENT_GAP` (EO32).
  3. **Place.** The node's near edge sits `gap` past a's far edge; on the cross axis it is centred on the midpoint
     of a's and b's centres. The node then sits at the midpoint between a and b as made room for.
  4. **Make room** ([Make room](#make-room)) by `extent + gap`, extent the node's size on the axis, always, whatever
     room there already was.
  5. **Rewire.** The arrow keeps its id, from end, label and style; its `to` is pinned to the node. A new arrow
     from the node to b copies every field of the old arrow except `id`, `from`, `to`, `label`, `labelOffset`,
     `labelMaxWidth`, `curveOffset`, `curvePoints`, `elbowOffset`, `commentThread` and `link`; both arrows drop
     their route fields and re-anchor facing (EO33). Annotation `(style of <arrow ref>)`. The new arrow goes directly
     after the node in the element order (the node is the newest element, EO55).
- **`wrap <selector…> in frame|lane [id=] key=value… [tidy] [absorb | make-room]`.** Members are the union of the
  member selectors: each ref or quoted label word is its own selector (exactly one match each), the remaining
  terms together form one more (one or more matches).
  1. `tidy` first runs the `layout` algorithm on the members.
  2. The box is the members' bounding box grown by `FRAME_PAD` on every side and `FRAME_TOP` at the top; a lane
     grows by `FRAME_PAD` and, on its gutter edge (`laneEdgeOfElement` of the factory lane: left),
     `laneSizeOfElement` (EO34).
  3. **Bystanders** are the boxed non-members, other than containers whose box holds the whole new box, whose
     `smallestHolder` the new container would become. Any: `frame_captures`, unless `absorb` (they become members:
     the box is recomputed over them, once) or `make-room` (each moves perpendicular to the nearest edge of the
     box until it sits `PLACEMENT_GAP` outside, EO35). A locked bystander under `make-room` is `element_locked`.
  4. The container is `createShape('frame' | 'lane')` with the box, a new id, fields as `set` (a frame's default
     label `Frame`, a lane's `Lane` unless `label=` is given), painted, on the lowest member's layer, inserted in
     the order directly before its earliest member.
- Members that are only arrows: `invalid_value` ("a frame or lane holds boxes").
- **`unwrap <frame>`.** The target must be a frame or lane (`invalid_value` otherwise). It is removed; its members
  stay where they are; arrows pinned to the container are removed as `rm` removes them (EO36).
- **`order <selector> front|back|above=<x>|below=<x>`.** Moves the target in the element order: last, first,
  directly after x, directly before x; x the target itself is `invalid_value`. Finalise then restores I6, so a container never ends above its members and
  a member never below its container (EO37).
- **`layout <selector> [style=flow|tree|mindmap] [direction=down|right]`.** The selection (its members taken as `wrap` takes them, `resolveMembers`, EO57): its boxed elements and the
  arrows with both ends among them are laid out by `autoLayoutElements(subset, { style, direction, originX,
originY, fixedSizeIds })`, origin the selection's bounding-box top-left, every selected box keeping its size;
  edgeless selected boxes are swept below with `sweepEdgelessNodes` (EO38). `direction` maps `down`→`TB`,
  `right`→`LR`; omitted, flow detects it (`flowDirectionOf`). Nothing outside the selection moves; a locked arrow
  between selected boxes keeps its ends. A locked element in the selection
  is `element_locked`.
- **`test <selector> key=value…`.** For each field, the value `set` would write (aliases resolved, no label cap,
  no coercion warning) is compared with the stored value by deep equality; strings exactly; `key=` holds when the
  field is absent; a colour alias compares the swatch slot, or the hex case-insensitively (EO39). Any difference:
  `test_failed`. It changes nothing, so a locked element may be tested.

### Carry

`containerContents(elements, ids) → Set<ElementId>` in `packages/document/src/containment.ts`, the one rule for
what travels with a moved frame or lane, called by the editor's drag (`useBoxedDragHandlers`) and by `move` and
make room here:

1. `ids` itself.
2. Every element whose chain of holders (`smallestHolder`, repeated) reaches a container in `ids`: a box
   straddling the edge travels when its centre lies inside; a frame or lane nested in a moved one (its centre
   inside, its area smaller) travels with all it holds; one that only overlaps or touches stays.
3. Every arrow with a free end whose free ends all have a holder chain, as points, reaching a container in `ids`
   (EO51). Pinned ends follow their elements.

Returns `ids` unchanged when no id is a container, so a plain drag pays one pass over `ids`. The editor's
full-containment and backmost-owner rules are gone: an element in overlapping containers belongs to the smallest,
the earlier in element order on a tie, as `smallestHolder` decides.

### Make room

`makeRoom(state, { node, b, axis, shift, gap })`. Membership (`deriveContainers`) is read once, over the elements
before the node, and every step uses it:

1. **Scope.** The scope is b's holder. With one, the units are its direct members. Without one, the units are the
   topmost containers of (or the elements themselves in) b's connected component along pinned arrows, either
   direction, built only when the shift reaches the top level.
2. **Beyond.** A unit is beyond when its centre on the axis lies past the midline (the node's near edge minus
   half the gap), in the axis' direction.
3. **Shift.** Each unit beyond, a container unit with its `containerContents` ([Carry](#carry)), moves by `shift` along the axis.
   Locked units stay where they are (EO47): a locked container, a unit itself or carried inside one, stays with
   everything it holds, so its members never leave it.
4. **Grow and go outward.** The scope container grows along the axis by `shift` on its far side, so every
   shifted element keeps its membership; then room is made in the scope's own holder, with the midline at the
   container's old far edge and the container itself left out, so an outer container grows in turn and what lay
   past it shifts. A locked container does not grow, and a mind node holds but has no room to grow; room is still
   made beyond either (EO47, EO52).
5. Annotation `make room`: each shifted element is marked moved with its summed shift (`moveElement`), never a
   target.

### Ids

`newElementId(state, { given, label, kind })`:

- `id=` must satisfy `isSlugId` and not be a reserved word (`invalid_value`, EO9); if taken, `id_taken` with a
  free suggestion (`slugIdFor(given, kind, taken)`).
- Without `id=`: `slugIdFor(label, kindWordOf(el), state.taken)`, where `taken` is every id of the tab plus every id
  minted earlier in the changeset. An unlabelled element's base is its kind token (`arrow`, `arrow-2`, `sticky`).
  `options.makeId()` is used only when the result would not satisfy `isSlugId` (EO8).

### Finalise

On the working state, in order:

1. `normaliseElement` on every touched element (never on the rest: I2), noting `codeLanguage` / `codeTheme`
   coercions as `value_coerced`.
2. Coerce every touched shape's `shape` with `coerceShapeKind`.
3. `landWorkshopArrivals(tab, elements, 'ops')`: on an event-storming tab, workshop notes added or moved land on
   lanes; a landed note joins `state.moved` with annotation `landed on a lane`.
4. `rebindArrowAnchorsAfterMove(elements, geometryChanged)` for every boxed element whose box changed.
5. `lanesToFront`, then each container moved to directly before its earliest member when it is after it (I6).
6. Membership before and after (`deriveContainers`) is read by the result lines' container lines.

### Replace

`applyReplace(tab | null, body, options)` builds the next tab as the MCP does and returns the same outcome shape
(EO41). The api's `POST /api/documents` compiles each `graph`, `mermaid` or `template` tab through it with
`tab === null`, and a changeset with a `replace` body on a tab id the document lacks creates that tab.

- `graph` / `mermaid`: `resolveGraphInput` then `layoutGraph` (the label cap included).
- `elements`: `normaliseElements`, shape kinds coerced, `applyLayout(body.layout, elements)`.
- `template`: `buildTemplateTab(...).elements`; on a new tab the whole `buildTemplateTab` result.
- Existing tab: every tab field kept, `elements` replaced, then `landWorkshopArrivals(tab, elements, 'replace')`.
  A locked tab is `element_locked`. New tab (`tab === null`): `buildTab` / `buildGraphTab` / `buildTemplateTab`
  with `options.tabId`, `options.name` and the theme, as `add_tab` does.
- Validation, `elementOps` and `inverse` as for operations; the results are one line per added and removed element
  and no `»` lines; `targets` is empty; `createdIds` lists every element of the new tab not in the old one.

## Interfaces and contracts

Public surface of `@livediagram/edit-operations`:

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
// The rejection and warning codes and `ResultLine` are the wire's, in `@livediagram/api-schema`.
```

```ts
type ParseOutcome = { operations: EditOperation[] } | { errors: EditRejection[] };

type ApplyOptions = {
  selected?: readonly ElementId[] | null; // the owner's selection; null: the room was not read
  theme?: ThemeDefinition; // the tab's theme resolved by the caller (custom themes included)
  makeId?: () => string; // ids no slug can name; default crypto.randomUUID
  log?: (fingerprint: string, fields: Readonly<Record<string, string | number | boolean>>) => void;
};
// `themeId` names a created tab's theme by id (custom themes included); it wins over `theme`.
type ReplaceOptions = ApplyOptions & { tabId: string; name: string; themeId?: string };

type ReplaceBody =
  | { graph: GraphInput }
  | { mermaid: string }
  | { template: string }
  | { elements: unknown[]; layout?: 'auto' | 'preserve' };

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

`targets` holds every pre-existing element an operation resolved: selector matches, the ends of `connect`,
`insert` and `rewire`, the arrow `insert` splits, `in:` / `from:` / `to:` / `downstream:` / `upstream:` words,
placement references and `wrap` members (EO46). Elements only shifted, carried, landed or rebound are left out, as
are ids in `createdIds`. The changeset pipeline fingerprints exactly these (live fields left out) and asks the room
whether any is held.

JSON form, one object a line (`?` optional; `fields` values are JSON, `null` unsets):

| `op`      | Members                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- |
| `add`     | `kind`, `id?`, `fields?`, `place?` ; or `element` (a whole element)                               |
| `set`     | `target`, `fields`, `all?`                                                                        |
| `rm`      | `target`, `all?`, `keepArrows?`                                                                   |
| `move`    | `target`, `place` or `by: [dx, dy]`, `all?`                                                       |
| `connect` | `from`, `to`, `id?`, `fields?`, `again?`                                                          |
| `rewire`  | `target`, `from` or `to`                                                                          |
| `insert`  | `kind`, `id?`, `fields?`, `between: [a, b]`                                                       |
| `wrap`    | `targets: Selector[]`, `in: "frame" \| "lane"`, `id?`, `fields?`, `tidy?`, `absorb?`, `makeRoom?` |
| `unwrap`  | `target`                                                                                          |
| `order`   | `target`, and one of `to: "front" \| "back"`, `above`, `below`                                    |
| `layout`  | `target`, `style?`, `direction?`                                                                  |
| `test`    | `target`, `fields`                                                                                |

In the JSON form `wrap`'s `targets` lists its selectors explicitly; the line form's word rule produces the same
list. The MCP's `ops` mode maps onto this form in its adapter: `add` with `element`, `update` as `set` on the
element's id with its fields as stored fields, `remove` as `rm` on the id. Removing a node therefore removes its
arrows, and an `update` of an unknown id is `target_not_found`.

`place` is `{ "rel": "right-of" | "left-of" | "above" | "below" | "after" | "inside" | "align", "ref": Selector,
"gap"?: n }` or `{ "rel": "at", "x": n, "y": n }`. Unknown members are `parse_error` naming the member; a wrong
type names the member and the expected type. Booleans are `true` only (`false` equals absent).

Line form, words separated by whitespace:

- **Quoting.** `"…"` with the escapes `\" \\ \n \t`; `'…'` literal. A quote may open mid-word (`label="Sign in"`,
  `right-of:"Orders service"`); the word records that its value was quoted. An unclosed quote is `parse_error` at
  its column (EO6).
- **Comments.** A line whose first non-space character is `#` is a comment; a `#` elsewhere is text, so
  `fill=#ff0000` reads (EO5). Blank lines are skipped. A line starting with `{` is JSON form (EO4).
- **Word classes.** `key=value` (key `[a-z][a-zA-Z-]*`) is a field, except `from=`, `to=`, `above=`, `below=`,
  `by=`, `style=`, `direction=`, `id=` in the operations that define them; `key:value` with a placement key is a
  placement, `gap:` its gap; other `key:value` words, quoted words, `label~`, `->` words and other bare words are
  selector terms; flags are the operation's keywords. Keys read case-insensitively, as `tokenKeyOf` in
  `@livediagram/explorer-lens` reads them (EO11).
- **Operation shapes.** `connect` splits its selectors at a standalone `->`, or at the `->` outside quotes of one
  word (`connect "Sign in"->"Pay"`); a second `->`, either way, is a `parse_error` ("one -> in connect"), never a
  dropped end (E17); `insert … between <a> <b>` takes one
  word each; `wrap` reads members up to the word `in`.

`formatOperation` prints the canonical line form: operation, selector or kind, `id=`, fields in the given order
(strings quoted when they hold whitespace, `"`, `#` at the start, `=` or `:`), placement, flags. Parsing its output
gives the same operation.

### Result lines

```ts
type ResultLine =
  | {
      mark: '+';
      ref: string;
      kind: string;
      label?: string;
      at?: [number, number];
      size?: [number, number];
      ends?: [string, string];
      styleOf?: string;
    }
  | { mark: '~'; ref: string; changes: FieldChange[] }
  | {
      mark: '-';
      ref: string;
      kind: string;
      label?: string;
      ends?: [string, string];
      reason?: 'pinned' | 'unwrapped';
      pinnedTo?: string;
    }
  | {
      mark: '»';
      refs: string[];
      delta?: [number, number];
      reason: 'make room' | 'carried' | 'laid out' | 'landed on a lane';
      layout?: { style: 'flow' | 'tree' | 'mindmap'; direction?: 'down' | 'right' };
    }
  | { mark: 'container'; ref: string; joined: string[]; left: string[] }
  | { mark: '!'; warning: EditWarning };
```

Text, two spaces after the ref, `·` between changes:

| Line             | Text                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| Added box        | `+ verify  square "Verify email" @0,300 140×60`                                   |
| Added arrow      | `+ arrow  verify→n4 (style of a3)`, a label as `verify→n4 "label"`                |
| Changed          | `~ n3  label "Login"→"Sign in" · shape square→stadium · widened 140→152`          |
| Changed position | `~ n3  @0,200→@0,300`                                                             |
| Changed end      | `~ a3  to n4→verify`, a freed end `to n7→@x,y`                                    |
| Removed          | `- n7  square "Pay"`, a cascaded arrow `- a4  arrow n3→n7 (pinned to n7)`         |
| Moved, not named | `» n4 n5 n6  +0,+100 (make room)`; `» n5 n6 n7 t1  laid out (flow, down)`         |
| Container        | `f2  +verify -n5`                                                                 |
| Warning          | `! label_capped  n3 label kept as "Orders service"; the full text is in its note` |

- **Order** (EO42): `+ ~ -` lines in the order operations first touched the element; then `»` lines, one per
  distinct delta and reason, refs in element order; then container lines in element order; then warnings in order.
- **Values** (EO43): strings JSON-quoted and cut on a word boundary with `…` (labels at 60, notes at 48, other
  strings at 48, the views' cuts); numbers and enum values bare; absent prints nothing (`fill →green`); objects
  and arrays print `(changed)`. A colour pair prints once under its alias, as the slot name or the hex.
- An element's ref is its ref in the next tab, a removed one's in the input tab.
- Anchor-only arrow changes print no line (EO40). Route fields a `rewire` or `insert` drops, and `straight` set on
  arrows `layout` lays out (the shared `reanchorArrow`, EO53), print as changes.
- `order` prints as a change of its own, `~ t1  order front`, `~ n1  order above n3`.
- A `»` line for `layout` names the style, and the flow's direction: `laid out (flow, right)`, `laid out (tree)`.
- A moved element whose shift sums to nothing, or that a lane landed back where it was, prints nothing (EO56).

Footer (`formatResultFooter`), composed by the api or the CLI from what only they know:

- Write: `rev 41→42 · cs_8k2m4q7d1x · <lint summary> · revert: livediagram changeset revert <documentId> cs_8k2m4q7d1x`
  (the document's full id, so the command resolves without a search);
  rebased: `rev 41→44 · rebased over 3 writes · cs_… · …`. The lint summary is the summary line of the api's
  `?view=lint` for the next tab.
- Dry run: `dry run · rev 41 · <lint summary> · nothing written` (EO44).

## Data and persistence

| Datum                              | Class     | Notes                                                                                     |
| ---------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `EditOperation`                    | transient | Parsed per request; the changeset record stores what the changesets blueprint names       |
| `elementOps`, `inverse`            | derived   | JSON-serialisable `ElementOp[]`; stored and relayed by the changeset pipeline             |
| New elements                       | content   | Written in the current `DOCUMENT_FORMAT` (`normaliseElement` packs stroke points)         |
| `fillSwatch` on a slot             | content   | The quick-style binding the editor re-derives on a theme change (`rederiveQuickSwatches`) |
| `results`, `targets`, `createdIds` | derived   | Recomputed on every apply; never stored by the engine                                     |

The engine holds no state, no table and no migration. Snapshot and restore are the tab itself; `inverse` restores
the before-images exactly (I4).

## Errors and edge cases

Rejections, in the spec's table; the engine raises all but `changeset_conflict` and `elements_held`, which the
changeset pipeline raises with the same shape and formatter. `too_large` is raised here for the operation count
and by the api for the tab byte cap.

| Code                | Detail lines                                                                                                | Hint                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `parse_error`       | `line <n>, column <c>: expected <what>`, the line with a caret under the column                             | `quote values with spaces: label="Sign in"`, or the expected word      |
| `unknown_operation` | `"<word>" is not an operation`; `operations: add set rm move …`                                             | `did you mean <nearest>?` when one is within distance 2                |
| `target_not_found`  | `"<selector>" matches nothing`; up to 5 nearest as `ref  kind "label" in f2`                                | `use a ref from the outline, or label~<word> for part of a label`      |
| `target_ambiguous`  | `"<selector>" matches <n> elements:` and each as `ref  kind "label" in f2`                                  | `use a ref, narrow with type:<kind of the first>, or add all`          |
| `unknown_field`     | `<kind> has no field "<key>"`; `fields: <aliases>, then <stored names>`                                     | `did you mean <nearest>?`                                              |
| `invalid_value`     | `<key>=<value>: <rule>`; `allowed: <values>` or the range                                                   | The nearest allowed value                                              |
| `id_taken`          | `id "<id>" is taken by <kind> "<label>"`                                                                    | `use id=<free>`                                                        |
| `arrow_exists`      | `<a>→<b> already has an arrow:` and it as `ref  from→to "label"`                                            | `add again for a second arrow, or set the existing one`                |
| `element_locked`    | `the tab is locked`, or `locked:` and each element as `ref  kind "label"` and why (element, layer "<name>") | `unlock it in the editor, or leave it out of the changeset`            |
| `not_connected`     | `no arrow <a>→<b>`; the arrows touching a and b as `ref  from→to "label"`                                   | `connect <a> -> <b> first, or insert between the ends of one of these` |
| `frame_captures`    | `the <frame> @x,y w×h would hold non-members:` and each bystander                                           | `add them to the members, or add absorb or make-room`                  |
| `test_failed`       | `<ref> <key>: expected <value>, actual <value>`                                                             | `re-read <ref>: it changed since you read it`                          |
| `invalid_result`    | `<ref> <field>: <rule>` from `elementValidationIssue`                                                       | `see the format: livediagram schema <kind>`                            |
| `too_large`         | `<n> operations; the cap is <CHANGESET_MAX_OPERATIONS>`                                                     | `split it into several changesets, or send a replace`                  |

Every rejection prints `error <code> · op <n> · <formatOperation(op)>` (parse errors: `· line <n>`), its detail
and hint lines indented, and the block ends with `nothing was applied`. Parsing reports up to `EDIT_MAX_ERRORS`
malformed lines; applying stops at the first rejection (EO7). Candidate lists stop at
`REJECTION_CANDIDATES_MAX` with `… <n> more`.

Edge cases:

- **E1** An operation that changes nothing (`set n3 label="Login"` on `"Login"`): no line, no element op; the
  changeset still succeeds.
- **E2** `rm` of an element an earlier operation added: both vanish from the diff; no line.
- **E3** A selector matching an element an earlier operation removed: it is gone from the state, so
  `target_not_found`.
- **E4** `move` onto the same position: no line.
- **E5** `set` on an arrow's `label` over `GRAPH_LABEL_MAX`: cut, warning `label_capped`; an arrow has no note.
- **E6** `insert` where a and b are in different containers: scope is b's container; a's stays put.
- **E7** `insert` where a and b overlap (zero centre distance): the axis is vertical, downwards.
- **E8** `wrap` with one member: allowed. `wrap` whose members span containers: the box is still their bounding
  box; their old containers report them leaving.
- **E9** `layout` of a selection without arrows: every box is edgeless, swept into rows from the top-left.
- **E10** An element whose id is a reserved word: reached by label or a longer prefix (EO10).
- **E11** A custom theme the caller did not resolve: the default scheme's slots; `log('[edit-ops] theme-fallback')`.
- **E12** Hidden layers: elements there resolve and change like any other. Locked elements and layers: they
  resolve (as placement references, `test` targets, ends of a new arrow) but never change (I7).
- **E17** Make room meeting a locked unit: the unit stays where it is and the rest shift; any overlap is the
  lint's to report (EO47).
- **E13** A tab at `MAX_ELEMENTS_PER_TAB`: an `add` makes it invalid; `invalid_result` names the cap.
- **E14** `keep-arrows` where both ends were removed: the arrow has two free ends and stays.
- **E15** A placement reference on a hidden layer: placement uses its box all the same.
- **E16** A `connect` whose `a` or `b` is an arrow: `invalid_value` ("arrows connect boxes").
- **E17** `connect a->b->c` or `connect a -> b -> c`: `parse_error` at the second `->` word, expected
  `one -> in connect: <a> -> <b>`; the `<a>-><b>` selector term with a third end is a parse error too.

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
- Locks set by people hold against agents: nothing in `lockedIds` changes (I7).
- Logs carry counts, codes and operation names, never labels, notes or ids (an agent's id is a slug of its label).

## Performance and limits

Worst case: `MAX_ELEMENTS_PER_TAB` (10,000) elements, `CHANGESET_MAX_OPERATIONS` (500) operations.

- **State.** One `Map` and one order array, copied once; operations write in place on the copy. Building the next
  `elements` array is one pass at the end.
- **Selectors.** A ref is `resolveRef` over the `RefTable`, recomputed only after an add or remove; a filter selector is one pass, `O(n)`;
  `downstream` / `upstream` one breadth-first walk over an adjacency map built once per changeset and rebuilt only
  after an arrow changes, `O(n + arrows)`. 500 filter selectors over 10,000 elements: 5,000,000 checks, about 20
  ms in a Worker.
- **Overlap and occupancy.** Placement buckets the occupiers once per placement (`firstOverlapIn`, cells of
  `ELEMENT_GRID_CELL` 256, boxes over `ELEMENT_GRID_MAX_CELLS` cells on a list every query checks), so each nudge step
  costs the neighbourhood and a walk past a row of n boxes costs O(n). Capture (`wrap`) reads holders once.
- **Containment.** `deriveContainers` is `O(n × containers)` through `smallestHolder`; computed twice per changeset (before and after) and for
  `in:` on demand.
- **Container order.** `containersBehindMembers` builds each container's member list once and keeps an index map
  of the order, updating only the range a moved container crosses: `O(n)` plus what moves. Before, a scan of the
  order per member made a one-field `set` cost 157 ms at 10,000 members of one frame; now 19 ms.
- **Targets.** `noteTarget` keeps a `Set` beside the ordered `targets`, so a `set … all` notes each element in
  `O(1)`; the old `includes` was quadratic in the elements resolved.
- **Nearest candidates** run only on `target_not_found` / `unknown_field`: banded Levenshtein with band
  `NEAREST_MAX_DISTANCE` over labels cut to 60 characters, `O(n × 60 × band)`, about 6,000,000 cells at worst.
- **Layout** costs `autoLayoutElements` on the selection only.
- **Budget.** `EDIT_APPLY_BUDGET_MS` is the aim for a 500-operation changeset on a 2,000-element tab, measured, not
  a gate. Measured: 498 operations on 1,980 elements take 39 ms without inserts, and 88 ms with 83 of them inserts
  (make room reads the tab's holders and the connected group once per insert). The gate is `performance.test.ts`:
  four times the tab, or four times the changeset, costs under eight times as much; the container order pass and
  `noteTarget` are timed alone at 2,400 and 9,600 elements, under the same ratio.

## Observability

The engine logs through `options.log` (no logger, no logs); the api passes one that prefixes the document, tab
and changeset ids. Fields are counts, codes and names only.

| Fingerprint                   | When                                         | Fields                                                               |
| ----------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `[edit-ops] parsed`           | `parseEditOperations` succeeded              | `operations`, `lineForm`, `jsonForm`                                 |
| `[edit-ops] parse-rejected`   | Parsing failed                               | `code`, `errors`, `line`, `column`                                   |
| `[edit-ops] applied`          | An outcome with a tab                        | `operations`, `added`, `changed`, `removed`, `moved`, `warnings`     |
| `[edit-ops] rejected`         | An outcome with errors                       | `code`, `operation`, `op`                                            |
| `[edit-ops] make-room`        | An insert shifted elements                   | `operation`, `shifted`, `axis`, `grown`                              |
| `[edit-ops] widened`          | Fit to label grew a box                      | `operation`                                                          |
| `[edit-ops] coerced`          | A shape kind or code value was coerced       | `operation`, `field`                                                 |
| `[edit-ops] label-capped`     | A label moved into the note                  | `operation`                                                          |
| `[edit-ops] frame-captures`   | `wrap` met bystanders                        | `operation`, `bystanders`, `resolution` (refused, absorb, make-room) |
| `[edit-ops] selection-unread` | `selected` with `selected: null`             | `operation`                                                          |
| `[edit-ops] locked`           | An operation refused for a lock              | `operation`, `op`, `scope` (tab, element, layer)                     |
| `[edit-ops] theme-fallback`   | No theme passed and `tab.theme` not built in | (none)                                                               |
| `[edit-ops] replace`          | `applyReplace` ran                           | `source` (graph, mermaid, template, elements), `elements`            |
| `[edit-ops] laid-out`         | `layout` or `wrap tidy` laid boxes out       | `operation`, `boxes`, `arrows`, `style`                              |
| `[edit-ops] test-failed`      | A `test` found other values                  | `operation`, `fields`                                                |

## Testing

Every suite uses `packages/edit-operations/src/fixtures/checkout-flow.ts` and a fixed `makeId`; no test touches the network or the clock.

| Spec rule                                                                                                                | Test                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| The vocabulary: twelve operations, each line form parses to its JSON form                                                | `parse.test.ts` › "parseEditOperations: the line form (the vocabulary)"                                                               |
| Values with spaces quoted; `#` starts a comment line, and is text inside a line                                          | `tokenise.test.ts` › "quotes", "escapes", "keeps # as text", `parse.test.ts` › "skips comments"                                       |
| One parser turns the line form into the JSON form; both accepted                                                         | `parse.test.ts` › "mixes forms", "formatOperation round trip"                                                                         |
| `parse_error` names the line, the column and what was expected                                                           | `parse.test.ts` › "names the line, the column and what was expected"                                                                  |
| `unknown_operation` names the vocabulary                                                                                 | `rejections.test.ts` › "unknown_operation"                                                                                            |
| Each selector row (ref, prefix, id, `id:"…"`, label, `label~`, type, shape, in, arrows, downstream, upstream, selected)  | `selectors.test.ts` › "selector rows", one `it` per row                                                                               |
| Exactly one match unless `all`; none with nearest labels; several with candidates                                        | `selectors.test.ts` › "cardinality"                                                                                                   |
| `selected` with nothing selected is refused                                                                              | `selectors.test.ts` › "selected"                                                                                                      |
| `add` sized for its label by the kind's factory, placed by a placement word                                              | `packages/edit-operations/src/operations/add-kind.test.ts`                                                                            |
| `id=` names the new element for later operations; `id_taken`                                                             | `packages/edit-operations/src/operations/add-kind.test.ts`, `ids.test.ts`                                                             |
| `set` changes the named fields; `key=` unsets; no geometry but widen-to-fit                                              | `packages/edit-operations/src/operations/set.test.ts`, `labels.test.ts`                                                               |
| `rm` removes pinned arrows and lists them; `keep-arrows` frees their ends                                                | `packages/edit-operations/src/operations/rm.test.ts`                                                                                  |
| `move`: pinned arrows follow; a frame or lane carries its members; membership changes reported                           | `packages/edit-operations/src/operations/move.test.ts`                                                                                |
| The centre rule decides what a moved container carries: straddling boxes, nested containers, free arrows, smallest owner | `packages/document/src/containment.test.ts` › "containerContents"                                                                     |
| A person dragging a frame or lane carries exactly what `move` carries                                                    | `apps/live/hooks/canvas/useEditorDrag.frames.test.tsx`                                                                                |
| `connect`: pinned, anchors facing; second arrow needs `again`, else `arrow_exists`; `rewire` moves one end               | `packages/edit-operations/src/operations/connect.test.ts`                                                                             |
| Locks: a locked tab, element or layer refuses with `element_locked`; make room passes locked units by                    | `locks.test.ts`, `invariants.test.ts` › "no locked element changes", `make-room.test.ts` › "passes a locked unit by"                  |
| Live fields are never written by `set`                                                                                   | `fields.test.ts` › "refuses identity, live and prototype fields"                                                                      |
| One value a term; `wrap` and `layout` members: each ref or quoted label one element, the rest together                   | `selectors.test.ts` › "reads what does not parse", `packages/edit-operations/src/operations/wrap.test.ts` › "takes members from refs" |
| `targets` and `createdIds` list what the changeset resolved and created                                                  | `apply.test.ts` › "lists the existing elements it resolved", "lists the elements it created"                                          |
| `insert`: midpoint, a→new keeps the arrow, new→b copies its style, make room in scope; `not_connected`                   | `packages/edit-operations/src/operations/insert.test.ts`, `make-room.test.ts`                                                         |
| `wrap`: frame or lane around members; `tidy`; `frame_captures`; `absorb`; `make-room`                                    | `packages/edit-operations/src/operations/wrap.test.ts`                                                                                |
| `unwrap` keeps members in place                                                                                          | `packages/edit-operations/src/operations/unwrap.test.ts`                                                                              |
| `order`: frames and lanes stay behind their contents                                                                     | `packages/edit-operations/src/operations/order.test.ts`, `finalise.test.ts` › "containersBehindMembers"                               |
| `layout` lays out only the selection, keeping its top-left                                                               | `packages/edit-operations/src/operations/layout.test.ts`                                                                              |
| `test` fails the changeset unless the values hold                                                                        | `packages/edit-operations/src/operations/test-fields.test.ts`                                                                         |
| Placement words (`align:` on the nearer axis), `gap:`, default placement, nudge until free                               | `placement.test.ts`, one `it` per word                                                                                                |
| Coordinates shown and taken are rounded and relative to the content origin                                               | `placement.test.ts`, `results.test.ts` › "prints a free end as a point from the origin"                                               |
| `shape=` coerced as the MCP does                                                                                         | `fields.test.ts` › "coerces an off-vocabulary shape"                                                                                  |
| `fill=` theme slot; hex with `colour_overrides_theme`; stickies excepted                                                 | `colours.test.ts`                                                                                                                     |
| `text=`, `note=`, `line=` vocabulary                                                                                     | `fields.test.ts`                                                                                                                      |
| A label over 40 characters keeps the heading, full text into the note                                                    | `labels.test.ts` (the MCP spec's three examples)                                                                                      |
| Unknown field names the kind's fields; invalid value names the allowed values                                            | `rejections.test.ts` › "unknown_field", "invalid_value"                                                                               |
| Only `layout` and `replace` lay out many elements; untouched stays identical                                             | `invariants.test.ts` › "what stayed is the same object" (I2, I3)                                                                      |
| Results: the spec's example lines, formatted character for character                                                     | `results.test.ts` › "prints the spec example character for character"                                                                 |
| Rejections: the spec's example rejection, formatted character for character                                              | `rejections.test.ts` › "spec example"                                                                                                 |
| A rejected changeset applies nothing                                                                                     | `invariants.test.ts` › "a rejected changeset carries no tab" (I1)                                                                     |
| `elementOps` and `inverse` round trip                                                                                    | `invariants.test.ts` › "element ops and their inverse round trip" (I4)                                                                |
| Deterministic                                                                                                            | `invariants.test.ts` › "the same input gives the same outcome" (I5)                                                                   |
| Containers behind members; lanes first                                                                                   | `invariants.test.ts` › "lanes first, and every container behind its members" (I6)                                                     |
| `too_large` over `CHANGESET_MAX_OPERATIONS`                                                                              | `parse.test.ts` › "caps the line length, the operation count"                                                                         |
| Cost grows linearly with the tab and with the changeset                                                                  | `performance.test.ts`                                                                                                                 |
| `replace` from graph, Mermaid, template, elements                                                                        | `replace.test.ts`                                                                                                                     |
| Moved MCP modules behave as before                                                                                       | `packages/document/src/{element-normalise,graph-input,tab-builders}.test.ts`                                                          |
| Every stored field listed per type                                                                                       | `packages/document/src/element-fields.test.ts` (plus the compile-time `satisfies`)                                                    |
| Validation names the field and rule                                                                                      | `packages/document/src/validate.test.ts` › "elementValidationIssue"                                                                   |
| Refs, slugs, kind words, containment, origin (the document-views blueprint's tests; `isContainer` here)                  | `packages/document/src/{element-refs,containment}.test.ts`                                                                            |
| Batched element ops equal the sequential reduce                                                                          | `packages/document/src/element-ops.test.ts` › "applyElementOps, batched"                                                              |
| Observability: each fingerprint fires with its fields and no content                                                     | `apply.test.ts` › "logs" (a recording `log`), `make-room.test.ts` › "logs what it shifted"                                            |

## Constants and configuration

| Constant                   | Value                     | Provenance                                                                            | Safe range      |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------- | --------------- |
| `CHANGESET_MAX_OPERATIONS` | 500                       | [Agent changesets](../agent-changesets.md), imported from `@livediagram/api-schema`   | owned there     |
| `GRAPH_LABEL_MAX`          | 40                        | Spec; the MCP's graph input                                                           | 24 to 80        |
| `PLACEMENT_GAP`            | `LAYER_GAP` (90)          | The layout engine's rank gap (EO23)                                                   | 16 to 200       |
| `PLACEMENT_GAP_MAX`        | 2,000                     | Larger reads as a separate drawing (EO23)                                             | 500 to 10,000   |
| `INSERT_MIN_GAP`           | 16                        | Below it boxes read as touching (EO32)                                                | 8 to 40         |
| `FRAME_PAD`, `FRAME_TOP`   | 32, 64                    | The clustered layout's frame padding and header band                                  | 16 to 96        |
| `SLUG_ID_PATTERN`          | `^[a-z][a-z0-9_-]{0,23}$` | [Document views](../document-views.md), from `@livediagram/document`                  | fixed           |
| `REF_MIN_LENGTH`           | 4                         | [Document views](../document-views.md), from `@livediagram/document`                  | fixed           |
| `EDIT_LINE_MAX_CHARS`      | 16,384                    | A 4,000-character code value with escapes and its other fields fits (EO3)             | 8,192 to 65,536 |
| `EDIT_MAX_ERRORS`          | 10                        | Enough to fix a batch of typos in one round (EO7)                                     | 1 to 50         |
| `REJECTION_CANDIDATES_MAX` | 10                        | A readable list; the rest counted (EO45)                                              | 5 to 25         |
| `NEAREST_CANDIDATES_MAX`   | 5                         | The few worth trying (EO45)                                                           | 3 to 10         |
| `NEAREST_MAX_DISTANCE`     | 3                         | Typos and short slips, not other words (EO45)                                         | 2 to 5          |
| `EDIT_APPLY_BUDGET_MS`     | 50                        | A tenth of a request's patience at the 500-operation cap; a measured aim, not in code | 20 to 200       |

No environment variable, binding or secret; self-hosting needs nothing new.

## Defaults ledger

EO1 to EO51 in [DEFAULTS.md](DEFAULTS.md).
