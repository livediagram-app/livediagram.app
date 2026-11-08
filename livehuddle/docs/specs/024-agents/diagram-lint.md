# Diagram lint

> **No MCP server or CLI in livehuddle** ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)):
> the REST API is the only front door. Where this file names the MCP or the CLI, it records livediagram's front
> doors over the same engine, where this design came from; their wire values (`mcp`, `cli`) still parse.

**Status: built.**
`@livehuddle/diagram-lint` checks a tab; the api serves `?view=lint`, every changeset, dry run and revert carries
the verdict.

The **diagram lint** reports what is wrong with how a tab is drawn, as text an agent can act on without looking at
an image: about 100 tokens where a preview costs about 1,000, and usable by models that cannot see. On a measured
15-node architecture, grouping by tier gave 5 crossings and 2 arrows behind boxes, which only a check or a look could
reveal (`docs/research/agent-cli/authoring-from-scratch.md`).

## Findings

Each **lint finding** has a code, a severity, the refs involved and a fix phrased as a command or operation.

| Code               | Severity | Finding                                                                                                                                                                                                                                                                                                    |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `box-overlap`      | error    | Two boxes that arrows connect partly overlap; one wholly inside another does not count                                                                                                                                                                                                                     |
| `arrow-dangling`   | error    | An arrow pinned to a missing element                                                                                                                                                                                                                                                                       |
| `arrow-behind-box` | warning  | An arrow passes through a box it does not connect (not one drawn over boxes by choice, `routeBehind: false`)                                                                                                                                                                                               |
| `edge-crossings`   | warning  | More crossing arrow pairs than `LINT_CROSSINGS_PER_ARROW` × arrows (a line drawn over by choice, `routeBehind: false`, crosses by design and is not counted)                                                                                                                                               |
| `label-collision`  | warning  | An arrow label overlaps a box or another arrow's label, or another arrow's line strikes it through (a run along its own track aside); its fix says how many characters fit on the edge's longest run, or, with no box in the way (another label or a line), where along its own line it sits clear         |
| `label-overflow`   | warning  | A label needs more lines than its box holds                                                                                                                                                                                                                                                                |
| `node-isolated`    | warning  | A labelled shape with no arrows on a tab that is otherwise a graph (an unlabelled one is decoration: a key's sample)                                                                                                                                                                                       |
| `duplicate-label`  | info     | Two boxes share a label                                                                                                                                                                                                                                                                                    |
| `flow-backwards`   | info     | Arrows point against the flow direction (not one that closes a loop: a retry runs back by design)                                                                                                                                                                                                          |
| `aspect-extreme`   | info     | The drawing is more than `LINT_MAX_ASPECT` times wider than tall, or the reverse, on a tab with no stored backdrop whose boxes some line joins (a board of columns and stickies is shaped by its design)                                                                                                   |
| `colour-on-themed` | info     | A fill or stroke the tab's theme would not paint, on an element the theme colours, bound to no preset or swatch (stickies excepted). A changeset's lint names only the colours that write set, never a template's own (a replace landing a template, or a template's tabs at `create_document`, name none) |
| `text-overflow`    | warning  | Two texts print over each other, on any tab (a board's column heading wrapped onto its subtitle). Turned text and text on a curve are left out                                                                                                                                                             |

- A stored lane, stack, boundary or frame is a backdrop (docs/specs/002-project-scope/not-in-livehuddle.md "The element
  engine", part 3): it paints at the back with boxes drawn over it, so it is no box to the lint. Nothing overlaps it
  and no arrow runs behind it.
- A fix never lays out shapes on a tab with a stored backdrop: `layout` would scatter what sits on it, so there a
  crossing fix reroutes an arrow, and the drawing's shape is the backdrop's to set.
- The error codes judge the diagram's graph. Boxes no arrow connects are decoration (an icon on a square, a sticker,
  a Venn circle) and may overlap by design; a line with both ends free is a drawing, not a broken arrow. The
  editor's templates use both and lint without errors.
- There are no group codes. The group checks (`group-escape`, `group-split-edges`) judged boundaries and their
  members, and left with the containment rule in part 3 of the element engine.
- Whether the story reads is not linted; that is what the preview is for.

## Output

```text
5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warnings, 1 info
W arrow-behind-box   orders→bus passes behind pay   fix: set orders->bus line=angled
W arrow-behind-box   bus→notify passes behind pay   fix: move pay by=0,46
I duplicate-label    a, b share "Orders DB"         fix: set b label="<text>"
```

- One summary line, then one finding a line, refs first, each ending with its fix.
- `--json` returns the findings as an array.
- `tab lint` exits 1 when any finding is an error, else 0.
- Every fix is edit operations in the line form. There is no graph source to lint and no `--compare`: the graph input
  left in part 3 of the element engine (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").

## Where it runs

- One pure package, `@livehuddle/diagram-lint`, using the geometry `@livehuddle/document` already has
  (`arrowRoutePoints`, `pathsCross`, `pathPassesThrough`, the element grid and refs). It reads each line
  as drawn: ends sharing an anchor fanned apart as the renderers and the label pass place them, so a label sitting
  between two fanned lines is never called struck, and a spot it names for a struck label is clear on the drawing.
- Every changeset result's last line carries the lint verdict, `lint clean` or `lint 2 warnings, 1 info`
  ([Edit operations](edit-operations.md#results)); `tab lint` shows the findings. A changeset lints its whole result
  tab, not only what it touched.
- The api serves a stored tab's lint as a view, `GET /api/documents/:id/tabs/:tabId?view=lint`
  ([Document views](document-views.md)); the CLI's `tab lint` reads it.
- The MCP appends the summary line to the result of every tool that writes a tab's elements: `create_document`,
  `add_tab` and `update_document`. An `update_document` whose edit changed nothing records no changeset and so has
  no changeset lint: it reads the tab's lint view instead, so the answer still lists what is wrong with the tab.

## Properties

- **Deterministic**: the same tab gives the same findings in the same order, so one fixture pins each code.
- **Bounded**: above `LINT_MAX_ARROWS` arrows the pairwise crossing check (`edge-crossings`) is skipped and the
  summary says so; every other check runs.
- **Observable**: each run logs `[lint] run` with its counts, never content.

| Constant                   | Value | Why                                                       |
| -------------------------- | ----- | --------------------------------------------------------- |
| `LINT_CROSSINGS_PER_ARROW` | 0.25  | A few crossings in a dense graph are normal; many are not |
| `LINT_MAX_ASPECT`          | 3     | Beyond 3:1 a diagram reads badly on a screen and in a PNG |
| `LINT_MAX_ARROWS`          | 300   | Pairwise checks stay under a few milliseconds             |
