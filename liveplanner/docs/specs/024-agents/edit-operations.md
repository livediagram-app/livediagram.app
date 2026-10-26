# Edit operations

**Status: built.** `@liveplanner/edit-operations` reads both forms and applies every operation below, by ref or
selector, through the changeset route; the MCP's `ops` mode takes refs, and the [CLI](../015-api/cli.md)'s `element`
verbs and `changeset apply` send them.

**In liveplanner** an agent works a project through Plan's own tools first: cards with `change_items` and the
`item` verbs, boards, card types, sheets and forms with theirs ([Plan for agents](../026-plan/plan-agents.md),
[Sheet](../029-sheets/sheet.md), [Forms](../030-forms/forms.md#agents)). Edit operations are the layer under them,
for an element directly: a Board, a Sheet, a chart or a Dashboard's view is an element on its tab. What an agent can
make is what liveplanner draws: the vocabulary has no diagram verbs, no placements and no layout.

An **edit operation** is one step of a [changeset](agent-changesets.md): a small, closed vocabulary addressed by ref
or selector, compiled by the api into element ops. A full rebuild uses `replace`. The evidence behind the model is in
`docs/research/agent-cli/editing-models.md`.

## The vocabulary

| Operation | Line form                                       | Does                                                        |
| --------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `add`     | `{"op":"add","element":{…}}` (a JSON line only) | Puts a whole element on the tab, kept at the x and y it has |
| `set`     | `set <selector> key=value… [all]`               | Changes the named fields; `key=` unsets one                 |
| `rm`      | `rm <selector> [all]`                           | Removes                                                     |
| `test`    | `test <selector> key=value…`                    | Fails the changeset unless the element holds these values   |

- **`replace`** is the other changeset body: a whole tab from exactly one of `template`, `dashboard` (a new
  Plan Dashboard tab, or a Dashboard tab rebuilt whole, [Plan agents](../026-plan/plan-agents.md) "Making a
  dashboard"), `form` (a new Form tab) or `elements`, as the MCP takes them
  ([MCP server](../015-api/mcp-server.md) §4.7). Elements are kept where they are given: a `layout` is refused.
  It is still a changeset: previewed, based, attributed and revertable.
- **Element kinds.** A tab holds only Plan elements, each `{ "type": "shape", "shape": <kind>, x, y, width, height }`:

  | Kind                                   | Is                                                          | Its own fields                                                                                                                     |
  | -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
  | `plan-board`                           | A Board tab's board; its cards are items                    | `planBoard`                                                                                                                        |
  | `plan-sheet`                           | A Sheet tab's spreadsheet; its cells change by sheet writes | `planSheet`                                                                                                                        |
  | `plan-view`                            | A Dashboard's metric or chart of the cards                  | `planView`, `textSize`                                                                                                             |
  | `bar-chart`, `line-chart`, `pie-chart` | A chart of a Sheet's cells                                  | `chartSource` (required), `sheetAnchor`, `chartVariant`, `chartLegend`, `chartValues`, `chartPalette`; `chartAxis` on bar and line |

  Every kind also takes `x`, `y`, `width`, `height`, `label` and `locked`. An `add` or a replace holding any other
  element is refused as `invalid_value` ("shape "square" is not an element a liveplanner tab holds"), naming the
  kinds. `PLAN_ELEMENT_KINDS` and the field lists live in `plan-elements.ts`; `liveplanner schema` and
  `GET /api/schema` print them.

- **Ids.** An added element's `id` names it, so later operations in the same changeset can refer to it; without one it
  takes a fresh id.
- **Fields** are the stored fields the element's kind takes, by name (no aliases). A field it does not take is
  refused as `unknown_field`, listing only the fields it does take. Identity (`id`, `type`, `shape`, `addedBy`) is
  never changed, and fields that travel live between people (comment threads, responses) are not changed by edit
  operations; comments have their own endpoints. `set` replaces a field's value whole.
- **Closed vocabularies.** A stored field with a closed list of values (`textSize`, `chartVariant`, …;
  `ELEMENT_FIELD_VALUES` in `@liveplanner/project`) refuses a value off it as `invalid_value`, naming the values it
  takes, as the MCP's whole-element check does.
- **Locks.** A changeset on a locked tab is refused, and so is an operation that changes a locked element or an
  element on a locked layer (`element_locked`).

## Two forms, one model

- **Line form**, one operation a line, values with spaces quoted, `#` starting a comment line. What agents write in a
  heredoc.
- **JSON form**, one object a line (`{"op":"set","target":"w1","fields":{"label":"Team load"}}`). What scripts produce.
  An `add` has only this form.
- One parser turns the line form into the JSON form; the api accepts both.
- The MCP's `ops` mode compiles to these operations: its `add` is `add` with a whole element, `update` is `set`,
  `remove` is `rm`, so updating an unknown id is refused.

## Selectors

A selector is a ref, or `key:value` tokens joined by spaces (all must match), in the token style of the Explorer's
filters ([Explorer filters](../013-workspace/explorer-filters.md)), one value a token:

| Selector         | Matches                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `146b`, `w1`     | That element (ref, prefix or id)                                        |
| `"Workload"`     | The element with that label, ignoring case; `label~work` is a substring |
| `type:plan-view` | By kind as the outline prints it                                        |
| `selected`       | What the agent's owner has selected in an open editor                   |

A selector must match exactly one element unless the operation says `all`. No match is refused with the nearest
labels; several matches are refused with the candidates. `selected` with nothing selected is refused.

## Results

A changeset answers with what it did, one line per element, the same text for a dry run and a write:

```text
~ 0a78  planView (changed)
- 82d4  plan-view
+ g1  plan-view "Plan" @0,840 500×360
rev 41→42 · cs_8k2m4q7d1x · revert: liveplanner changeset revert 3f9c2a71-… cs_8k2m4q7d1x
```

`+` added, `~` changed (before→after), `-` removed, `!` a warning (`no_base`: sent without the revision read). The
last line carries the revision, the changeset and the revert command.

## Rejections

A rejected changeset applies nothing and names the operation, the code, the offending value and the way out:

```text
error target_ambiguous · op 2 · set type:plan-view textSize=lg
  "type:plan-view" matches 3 elements:
    76eb  plan-view
    8e10  plan-view
    82d4  plan-view
  hint: use a ref, narrow with type:plan-view, or add all
nothing was applied
```

| Code                 | When                                                                                                   | Names                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `parse_error`        | A line does not parse (an `add` in the line form among them)                                           | The column and what was expected |
| `unknown_operation`  | Not in the vocabulary                                                                                  | The vocabulary                   |
| `target_not_found`   | A selector matches nothing; up to 10 such operations are named in one answer, the rest read on past it | The nearest labels and refs      |
| `target_ambiguous`   | Several matches without `all`                                                                          | The matches                      |
| `unknown_field`      | A field the kind does not take                                                                         | The kind's fields                |
| `invalid_value`      | A value outside the vocabulary or range, or an element no tab holds                                    | The allowed values or kinds      |
| `id_taken`           | An added element's id collides                                                                         | A free id                        |
| `element_locked`     | The tab, a target or its layer is locked                                                               | Each locked element or the tab   |
| `test_failed`        | A `test` does not hold                                                                                 | Expected and actual              |
| `changeset_conflict` | A target changed since the base                                                                        | Each element as read and as now  |
| `elements_held`      | A target is selected by a person                                                                       | Each element and who holds it    |
| `invalid_result`     | The result fails validation (a chart's `chartSource` naming no sheet range, say)                       | The element, field and rule      |
| `not_expressible`    | A strict source's tab would hold residue (`422`)                                                       | Each element and field           |
| `too_large`          | Over `CHANGESET_MAX_OPERATIONS` or the tab cap                                                         | The cap                          |

## Where the engine lives

One pure engine, `@liveplanner/edit-operations`, on top of `@liveplanner/project`:

- `applyEditOperations(tab, operations, options) → { tab, results, elementOps, inverse, warnings, targets, createdIds } | { errors }`,
  and `applyReplace` beside it for a `replace` body, with the same answer. `targets` are the existing elements the
  operations resolved, which the changeset fingerprints and checks for holds; `createdIds` are the elements it
  created.
- Refs, slug ids, kind words and the content origin come from `@liveplanner/project`, shared with the views.
- The api runs it for every changeset; the CLI runs it only to parse and to print.
