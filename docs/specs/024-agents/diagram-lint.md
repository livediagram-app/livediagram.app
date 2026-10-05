# Diagram lint

**Status: specified, not built.**

The **diagram lint** reports what is wrong with how a tab is drawn, as text an agent can act on without looking at
an image: about 100 tokens where a preview costs about 1,000, and usable by models that cannot see. On a measured
15-node architecture, grouping by tier gave 5 crossings and 2 arrows behind boxes, which only a check or a look could
reveal (`docs/research/agent-cli/authoring-from-scratch.md`).

## Findings

Each **lint finding** has a code, a severity, the refs involved and a fix phrased as a command or operation.

| Code                | Severity | Finding                                                                                                                             |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `box-overlap`       | error    | Two boxes that arrows connect partly overlap; one wholly inside another does not count                                              |
| `arrow-dangling`    | error    | An arrow pinned to a missing element                                                                                                |
| `arrow-behind-box`  | warning  | An arrow passes through a box it does not connect                                                                                   |
| `edge-crossings`    | warning  | More crossing arrow pairs than `LINT_CROSSINGS_PER_ARROW` × arrows                                                                  |
| `label-collision`   | warning  | An arrow label overlaps a box                                                                                                       |
| `label-overflow`    | warning  | A label needs more lines than its box holds                                                                                         |
| `node-isolated`     | warning  | A shape with no arrows on a tab that is otherwise a graph                                                                           |
| `group-escape`      | warning  | A member lies outside its frame                                                                                                     |
| `group-split-edges` | info     | Most of a frame's arrows cross its border                                                                                           |
| `duplicate-label`   | info     | Two boxes share a label                                                                                                             |
| `flow-backwards`    | info     | Arrows point against the flow direction                                                                                             |
| `aspect-extreme`    | info     | The drawing is more than `LINT_MAX_ASPECT` times wider than tall, or the reverse                                                    |
| `colour-on-themed`  | info     | A fill or stroke the tab's theme would not paint, on an element the theme colours, bound to no preset or swatch (stickies excepted) |

- The error codes judge the diagram's graph. Boxes no arrow connects are decoration (an icon on a card, a sticker,
  a Venn circle) and may overlap by design; a line with both ends free is a drawing, not a broken arrow. The
  editor's templates use both and lint without errors.
- The group codes judge frames, not lanes. An element belongs to the smallest frame or lane holding its centre,
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
- `--compare direction,groups,lines` lays a graph source out in each variant and prints one line of measures each,
  marking the best.
- `--json` returns the findings as an array.
- `tab lint` and `graph lint` exit 1 when any finding is an error, else 0.

## Where it runs

- One pure package, `@livediagram/diagram-lint`, using the geometry `@livediagram/document` already has
  (`arrowPolyline`, `pathsCross`, `pathPassesThrough`, the element grid, refs and containment).
- Every changeset result's last line carries the lint verdict, `lint clean` or `lint 2 warnings, 1 info`
  ([Edit operations](edit-operations.md#results)); `tab lint` shows the findings. A changeset lints its whole result
  tab, not only what it touched.
- The api serves a stored tab's lint as a view, `GET /api/documents/:id/tabs/:tabId?view=lint`
  ([Document views](document-views.md)); the CLI's `tab lint` reads it.
- The CLI lints a graph or Mermaid file locally, before anything is written (`graph lint`).
- The MCP appends the summary line to the result of every tool that writes a tab's elements: `create_document`,
  `add_tab` and `update_document`.

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
