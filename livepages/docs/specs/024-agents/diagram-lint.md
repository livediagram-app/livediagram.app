# Diagram lint

**Status: built**, with the [CLI](../015-api/cli.md)'s `tab lint`.
`@livepages/diagram-lint` checks a tab; the api serves `?view=lint`, every changeset, dry run and revert carries
the verdict, and the MCP's write tools carry the summary line.

The **diagram lint** reports what is wrong with how a tab is drawn, as text an agent can act on without looking at
an image: about 100 tokens where a preview costs about 1,000, and usable by models that cannot see. On a measured
15-node architecture, grouping by tier gave 5 crossings and 2 arrows behind boxes, which only a check or a look could
reveal (`docs/research/agent-cli/authoring-from-scratch.md`).

## Findings

Each **lint finding** has a code, a severity, the refs involved and a fix phrased as a command or operation.

| Code                | Severity | Finding                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `box-overlap`       | error    | Two boxes that arrows connect partly overlap; one wholly inside another does not count                                                                                                                                                                                                                               |
| `arrow-dangling`    | error    | An arrow pinned to a missing element                                                                                                                                                                                                                                                                                 |
| `arrow-behind-box`  | warning  | An arrow passes through a box it does not connect (not one drawn over boxes by choice, `routeBehind: false`)                                                                                                                                                                                                         |
| `edge-crossings`    | warning  | More crossing arrow pairs than `LINT_CROSSINGS_PER_ARROW` × arrows (a line drawn over by choice, `routeBehind: false`, crosses by design and is not counted)                                                                                                                                                         |
| `label-collision`   | warning  | An arrow label overlaps a box or another arrow's label, or another arrow's line strikes it through (a run along its own track aside); its fix says how many characters fit on the edge's longest run, or, with no box in the way (another label or a line), where along its own line it sits clear                   |
| `label-overflow`    | warning  | A label needs more lines than its box holds, or a card's title or subtitle is cut short with an ellipsis                                                                                                                                                                                                             |
| `node-isolated`     | warning  | A labelled shape with no arrows on a tab that is otherwise a graph (an unlabelled one is decoration: a key's sample, a card)                                                                                                                                                                                         |
| `group-escape`      | warning  | A member lies outside its frame                                                                                                                                                                                                                                                                                      |
| `group-split-edges` | info     | Most of a frame's arrows cross its border, when some run inside it (a frame none of whose arrows run inside is a role group, a services tier, split by design) and the flow does not pass through it (a pipeline stage: every arrow in from wholly before it and every arrow out to wholly after it, down or across) |
| `duplicate-label`   | info     | Two boxes share a label (a card's title and subtitle count too, so mirrored cards differ)                                                                                                                                                                                                                            |
| `flow-backwards`    | info     | Arrows point against the flow direction (not one that closes a loop: a retry runs back by design)                                                                                                                                                                                                                    |
| `text-overflow`     | warning  | Two texts print over each other, on any tab; and a page's text needs more lines than its box holds (text on a page is its content, not a caption). Turned text and text on a curve are left out                                                                                                                      |

- A fix never lays out shapes alone on a tab with frames: `layout` would leave the groups behind, so there a
  crossing fix reroutes an arrow, and the drawing's shape is the groups' to set.
- The error codes judge the diagram's graph. Boxes no arrow connects are decoration (an icon on a card, a sticker,
  a Venn circle) and may overlap by design; a line with both ends free is a drawing, not a broken arrow. The
  editor's templates use both and lint without errors.
- The group codes judge frames. An element belongs to the smallest frame holding its centre,
  the containment the views use.
- Whether the story reads is not linted; that is what the preview is for.

## Output

```text
5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warnings, 1 info
W arrow-behind-box   orders→bus passes behind pay            fix: drop the groups, or lines: angled
W arrow-behind-box   bus→notify passes behind pay            fix: drop the groups, or lines: angled
I group-split-edges  core: 12 of 13 arrows cross its border  fix: group by ownership, or drop the groups
```

- One summary line, then one finding a line, refs first, each ending with its fix.
- `--json` returns the findings as an array.
- `tab lint` exits 1 when any finding is an error, else 0.

## Where it runs

- One pure package, `@livepages/diagram-lint`, using the geometry `@livepages/document` already has
  (`arrowRoutePoints`, `pathsCross`, `pathPassesThrough`, the element grid, refs and containment). It reads each line
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
| `LINT_MAX_ARROWS`          | 300   | Pairwise checks stay under a few milliseconds             |
