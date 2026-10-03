# Edit operations

**Status: specified, not built.**

An **edit operation** is one step of a [changeset](agent-changesets.md): a small, closed vocabulary of
intent-level verbs addressed by ref or selector, compiled by the api into element ops. Building from scratch and
editing an existing tab use the same operations; a full rebuild uses `replace`. The evidence behind the model is in
`docs/research/agent-cli/editing-models.md`.

## The vocabulary

| Operation | Line form                                                                         | Does                                                                                              |
| --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `add`     | `add <kind> [id=<id>] key=value… [<placement>]`                                   | Creates an element, sized for its label by the kind's factory                                     |
| `set`     | `set <selector> key=value… [all]`                                                 | Changes the named fields; `key=` unsets one                                                       |
| `rm`      | `rm <selector> [all] [keep-arrows]`                                               | Removes; arrows pinned to it go too and are listed, or stay with free ends with `keep-arrows`     |
| `move`    | `move <selector> <placement> \| by=dx,dy [all]`                                   | Moves; pinned arrows follow; a frame or lane carries its members; membership changes are reported |
| `connect` | `connect <a> -> <b> [id=<id>] [label=…] [line=…] [again]`                         | A pinned arrow, anchors chosen facing each other; a second arrow a→b needs `again`                |
| `rewire`  | `rewire <arrow> from=<x> \| to=<y>`                                               | Moves one end of an arrow to another element                                                      |
| `insert`  | `insert <kind> [id=<id>] key=value… between <a> <b>`                              | Puts a node on the a→b arrow: that arrow becomes a→new, a new arrow new→b copies its style        |
| `wrap`    | `wrap <selector…> in frame\|lane [id=<id>] key=value… [tidy] [absorb\|make-room]` | Draws a frame or lane around the members; `tidy` lays them out compactly first                    |
| `unwrap`  | `unwrap <frame>`                                                                  | Removes the frame or lane and keeps its members where they are                                    |
| `order`   | `order <selector> front\|back\|above=<x>\|below=<x>`                              | Changes stacking; frames and lanes stay behind their contents                                     |
| `layout`  | `layout <selector> [style=flow\|tree\|mindmap] [direction=down\|right]`           | Lays out only the selection, keeping its top-left corner                                          |
| `test`    | `test <selector> key=value…`                                                      | Fails the changeset unless the element holds these values                                         |

- **`replace`** is the other changeset body: a whole tab from `graph`, `mermaid`, `template` or `elements`, exactly
  as the MCP takes them ([MCP server](../015-api/mcp-server.md) §4.7). It is still a changeset: previewed, based,
  attributed and revertable.
- **Ids** given with `id=` name the new element, so later operations in the same changeset can refer to it. An id is
  a slug id (`^[a-z][a-z0-9_-]{0,23}$`, as [Document views](document-views.md#refs) defines it). Without one, a new
  element takes the slug of its label, or of its kind when it has none (`arrow`, `arrow-2`).
- **Fields** are named by the aliases below or by any stored field of the element's type, as the
  [element format](../015-api/mcp-server.md) names it. Fields that travel live between people (comment threads,
  responses, ideas) are not changed by edit operations; comments have their own endpoints. A named `x`, `y`,
  `width` or `height` is a stored, absolute coordinate.
- **Values** use the document's vocabulary: `shape=stadium` (off-vocabulary shapes coerced as the MCP does),
  `fill=green` (a theme slot: `theme`, the theme's own colour, or one of the six hues the quick style panel offers
  for that theme, which follow a theme change; a hex value is accepted with the warning `colour_overrides_theme`,
  a sticky's colours excepted, which take the sticky palette's names), `text=sm`, `note="…"`, `line=angled`. A shape's
  label over 40 characters keeps the heading and moves the full text into the note, as graph input does; an arrow's
  label is cut; a sticky's or a text's label is its content and is kept whole.
- **Locks.** A changeset on a locked tab is refused, and so is an operation that changes a locked element or an
  element on a locked layer (`element_locked`).

## Two forms, one model

- **Line form**, one operation a line, values with spaces quoted, `#` starting a comment line. What agents write in a
  heredoc.
- **JSON form**, one object a line (`{"op":"set","target":"n3","fields":{"label":"Sign in"}}`). What scripts produce.
- One parser turns the line form into the JSON form; the api accepts both.
- The MCP's `ops` mode compiles to these operations: its `add` is `add` with a whole element, `update` is `set`,
  `remove` is `rm`, so removing a node removes its arrows and updating an unknown id is refused.

## Selectors

A selector is a ref, or `key:value` tokens joined by spaces (all must match), in the token style of the Explorer's
filters ([Explorer filters](../013-workspace/explorer-filters.md)), one value a token:

| Selector                       | Matches                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| `146b`, `orders`               | That element (ref, prefix or id)                                          |
| `"Orders service"`             | The element with that label, ignoring case; `label~orders` is a substring |
| `type:sticky`, `shape:diamond` | By kind as the outline prints it or element type, or by shape             |
| `in:c991`                      | Members of a frame or lane                                                |
| `n3->n4`, `from:n3`, `to:n4`   | Arrows by their ends                                                      |
| `downstream:n3`, `upstream:n4` | Elements reachable along arrows                                           |
| `selected`                     | What the agent's owner has selected in an open editor                     |

A selector must match exactly one element unless the operation says `all`. No match is refused with the nearest
labels; several matches are refused with the candidates. `selected` with nothing selected is refused. `wrap` and
`layout` act on many by nature: `wrap`'s members are each ref or quoted label given, plus whatever its other tokens
match together.

**Membership** is the smallest frame or lane holding an element's centre, the rule [views](document-views.md) nest
by; it decides `in:`, what `wrap` would capture, what a moved frame carries and the membership lines of a result.
The editor's drag carries by the same rule ([Canvas and palette](../008-canvas/canvas-and-palette.md)), so an
agent's `move` and a person's drag take the same elements along.

## Placement

`add` and `move` take one of: `right-of:<x>`, `left-of:<x>`, `above:<x>`, `below:<x>` (with `gap:<n>`),
`after:<x>` (along the flow of x's outgoing arrows), `inside:<frame>` (the next free slot), `align:<x>` (sharing x's
centre on the axis the element is already nearer it), `at:x,y`. Without one, a new element goes beside the last one
added, or right of the content. An occupied spot moves along the placement axis until free. Coordinates shown and
taken are rounded and relative to the tab's content origin.

## Layout on edit

The layout an agent did not ask to change stays put:

- `set` changes no geometry it is not given, except a box growing around its centre to fit a longer label
  (reported).
- `insert` places the node at the midpoint and **makes room**: everything beyond it along the flow, within the same
  frame or lane, or outside them within b's connected group along arrows, shifts by the node's size and the gap
  (reported as moves), whatever room there already was. A frame or lane holding shifted members grows with them.
  Several a→b arrows are refused as `target_ambiguous`.
- `wrap` refuses to capture an element that is not a member (`frame_captures`) unless told `absorb` or `make-room`.
- Only `layout` and `replace` lay out many elements, and only those they name.

## Results

A changeset answers with what it did, one line per element, the same text for a dry run and a write:

```text
~ n3  label "Login"→"Sign in" · shape square→stadium · widened 140→152
+ verify  square "Verify email" @0,300 140×60
~ a3  to n4→verify
+ arrow  verify→n4 (style of a3)
» n4 n5 n6  +0,+100 (make room)
f2  +verify
rev 41→42 · cs_8k2m4q7d1x · lint clean · revert: livediagram changeset revert cs_8k2m4q7d1x
```

`+` added, `~` changed (before→after), `-` removed, `»` moved without being named, a container ref followed by its
membership changes, `!` a warning. The last line carries the revision, the changeset, the
[lint](diagram-lint.md) summary and the revert command.

## Rejections

A rejected changeset applies nothing and names the operation, the code, the offending value and the way out:

```text
error target_ambiguous · op 2 · set "Pay" fill=green
  "Pay" matches 3 elements:
    n7  square "Pay" in f2
    n9  sticky "Pay"
    a4  arrow n3→n7 "Pay"
  hint: use a ref, narrow with type:square, or add all
nothing was applied
```

| Code                 | When                                                       | Names                            |
| -------------------- | ---------------------------------------------------------- | -------------------------------- |
| `parse_error`        | A line does not parse                                      | The column and what was expected |
| `unknown_operation`  | Not in the vocabulary                                      | The vocabulary                   |
| `target_not_found`   | A selector matches nothing                                 | The nearest labels and refs      |
| `target_ambiguous`   | Several matches without `all`                              | The matches                      |
| `unknown_field`      | A field the kind does not have                             | The kind's fields                |
| `invalid_value`      | A value outside the vocabulary or range                    | The allowed values               |
| `id_taken`           | `id=` collides                                             | A free id                        |
| `arrow_exists`       | `connect a -> b` when an a→b arrow exists, without `again` | The existing arrow               |
| `not_connected`      | `insert between a b` with no a→b arrow                     | The arrows touching a and b      |
| `frame_captures`     | `wrap` would capture a non-member                          | The bystanders                   |
| `element_locked`     | The tab, a target or its layer is locked                   | Each locked element or the tab   |
| `test_failed`        | A `test` does not hold                                     | Expected and actual              |
| `changeset_conflict` | A target changed since the base                            | Each element as read and as now  |
| `elements_held`      | A target is selected by a person                           | Each element and who holds it    |
| `invalid_result`     | The result fails validation                                | The element, field and rule      |
| `too_large`          | Over `CHANGESET_MAX_OPERATIONS` or the tab cap             | The cap                          |

## Where the engine lives

One pure engine, `@livediagram/edit-operations`, on top of `@livediagram/document`:

- `applyEditOperations(tab, operations, options) → { tab, results, elementOps, inverse, warnings, targets, createdIds } | { errors }`,
  and `applyReplace` beside it for a `replace` body, with the same answer. `targets` are the existing elements the
  operations resolved, which the changeset fingerprints and checks for holds; `createdIds` are the elements it
  created.
- Refs, slug ids, kind words, membership and the content origin come from `@livediagram/document`, shared with the
  views and the lint, as do graph input's label cap and the MCP's normalisation.
- The api runs it for every changeset; the CLI runs it only to parse and to print.
