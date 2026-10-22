# Page lint

**Status: built**, with the [CLI](../015-api/cli.md)'s `tab lint`.
`@livedesign/page-lint` checks a tab; the api serves `?view=lint`, every changeset, dry run and revert carries
the verdict, and the MCP's write tools carry the summary line.

The **page lint** reports text that does not fit where it is drawn, as text an agent can act on without looking at
an image: about 100 tokens where a preview costs about 1,000, and usable by models that cannot see. An agent filling a
logo or a wireframe template replaces sample text with its own, and longer words wrap out of a button or run into the
heading under them; only a check or a look reveals it.

## Findings

Each **lint finding** has a code, a severity, the refs involved and a fix phrased as an edit operation.

| Code             | Severity | Finding                                                                                                                                                                                                    |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label-overflow` | warning  | A label needs more lines than its box holds (a wireframe's button, a sticky), or a card's title or subtitle is cut short with an ellipsis                                                                  |
| `text-overflow`  | warning  | Two texts print over each other; a text needs more lines than its box holds (text on a page is its content, not a caption); or a word is wider than its line. Turned text and text on a curve are left out |

- The lint judges text only. Shapes may overlap by design (a logo's marks, a wireframe's layers), so overlapping
  boxes are not findings.
- Whether the design reads well is not linted; that is what the preview is for.
- The severity scale keeps `error` and `info` for the wire contract; both codes are warnings today.

## Output

```text
1440×900 · 12 boxes · 30 texts → 2 warnings
W label-overflow  b3 needs 2 lines, holds 1   fix: set b3 text=sm
W text-overflow   t7 prints over t8           fix: move t8 below:t7
```

- One summary line, then one finding a line, refs first, each ending with its fix.
- `--json` returns the findings as an array.
- `tab lint` exits 1 when any finding is an error, else 0; with only warnings today, it exits 0.

## Where it runs

- One pure package, `@livedesign/page-lint`, using the measures `@livedesign/document` already has
  (`wrapLabel`, `labelRoom`, `estimatedLabelMeasure`, refs and layers), so it wraps text as every headless render
  wraps it.
- Every changeset result's last line carries the lint verdict, `lint clean` or `lint 2 warnings`
  ([Edit operations](edit-operations.md#results)); `tab lint` shows the findings. A changeset lints its whole result
  tab, not only what it touched.
- The api serves a stored tab's lint as a view, `GET /api/documents/:id/tabs/:tabId?view=lint`
  ([Document views](document-views.md)); the CLI's `tab lint` reads it.
- The MCP appends the summary line to the result of every tool that writes a tab's elements: `create_document`,
  `add_tab` and `update_document`. An `update_document` whose edit changed nothing records no changeset and so has
  no changeset lint: it reads the tab's lint view instead, so the answer still lists what is wrong with the tab.

## Properties

- **Deterministic**: the same tab gives the same findings in the same order, so one fixture pins each finding.
- **Bounded**: the overprint check sweeps the texts top to bottom, comparing only texts that share rows, so a page
  of many texts stays linear in practice.
- **Observable**: each run logs `[lint] run` with its counts, never content.
