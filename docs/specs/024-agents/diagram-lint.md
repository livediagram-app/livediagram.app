# Diagram lint

**Status: specified, not built.**

The **diagram lint** reports what is wrong with how a tab is drawn, as text an agent can act on without looking at
an image: about 100 tokens where a preview costs about 1,000, and usable by models that cannot see. On a measured
15-node architecture, grouping by tier gave 5 crossings and 2 arrows behind boxes, which only a check or a look could
reveal (`docs/research/agent-cli/authoring-from-scratch.md`).

## Findings

Each **lint finding** has a code, a severity, the refs involved and a fix phrased as a command or operation.

| Code                | Severity | Finding                                                                          |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `box-overlap`       | error    | Two boxes that are not containers overlap                                        |
| `arrow-dangling`    | error    | An arrow pinned to a missing element, or free at both ends                       |
| `arrow-behind-box`  | warning  | An arrow passes through a box it does not connect                                |
| `edge-crossings`    | warning  | More crossing arrow pairs than `LINT_CROSSINGS_PER_ARROW` × arrows               |
| `label-collision`   | warning  | An arrow label overlaps a box                                                    |
| `label-overflow`    | warning  | A label needs more lines than its box holds                                      |
| `node-isolated`     | warning  | A box with no arrows on a tab that is otherwise a graph                          |
| `group-escape`      | warning  | A member lies outside its frame                                                  |
| `group-split-edges` | info     | Most of a frame's arrows cross its border                                        |
| `duplicate-label`   | info     | Two boxes share a label                                                          |
| `flow-backwards`    | info     | Arrows point against the flow direction                                          |
| `aspect-extreme`    | info     | The drawing is more than `LINT_MAX_ASPECT` times wider than tall, or the reverse |
| `colour-on-themed`  | info     | A fill or stroke set on a themed element (stickies excepted)                     |

Whether the story reads is not linted; that is what the preview is for.

## Output

```text
5 crossings · 2 behind · 0 overlaps · 1317×1196 → 2 warnings, 1 info
W arrow-behind-box   orders→bus passes behind pay        fix: drop the groups, or line=angled
W arrow-behind-box   bus→notify passes behind pay        fix: drop the groups, or line=angled
I group-split-edges  core: 12 of 13 arrows cross its border
```

- One summary line, then one finding a line, refs first.
- `--compare direction,groups,lines` lays a graph source out in each variant and prints one line of measures each,
  marking the best.
- `--json` returns the findings as an array.

## Where it runs

- One pure package, `@livediagram/diagram-lint`, using the geometry `@livediagram/document` already has
  (`arrowPolyline`, `pathsCross`, `pathPassesThrough`, the element grid).
- Every changeset result ends with the lint summary ([Edit operations](edit-operations.md#results)).
- The CLI lints a stored tab (`tab lint`) and a graph or Mermaid file before anything is written (`graph lint`).
- The MCP appends the summary line to every write result.

## Properties

- **Deterministic**: the same tab gives the same findings in the same order, so one fixture pins each code.
- **Bounded**: above `LINT_MAX_ARROWS` arrows the crossing checks are skipped and the summary says so.
- **Observable**: each run logs `[lint] run` with its counts, never content.

| Constant                   | Value | Why                                                       |
| -------------------------- | ----- | --------------------------------------------------------- |
| `LINT_CROSSINGS_PER_ARROW` | 0.25  | A few crossings in a dense graph are normal; many are not |
| `LINT_MAX_ASPECT`          | 3     | Beyond 3:1 a diagram reads badly on a screen and in a PNG |
| `LINT_MAX_ARROWS`          | 300   | Pairwise checks stay under a few milliseconds             |
