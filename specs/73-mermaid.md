# Mermaid import & export

Import and export [Mermaid](https://mermaid.js.org/) **flowchart** text — the
lingua franca of diagram-as-code, sitting in countless READMEs, issues, and AI
outputs. Unlike the Markdown outline import (spec/27), Mermaid carries the full
**connection graph** (which node points at what), so a round-trip preserves the
diagram's structure, not just its labels. This is the format the old `.lvd`
text DSL (spec/66, now removed) was trying to be, except Mermaid is a real
standard people already have.

## Scope: flowcharts

We support the **flowchart** / **graph** diagram type (`graph TD`, `flowchart
LR`, …) — nodes, edges, node shapes, edge styles, edge labels, subgraphs, and
the layout direction. Other Mermaid diagram types (sequence, class, state,
gantt, pie, …) are out of scope; importing one reports a clear "only flowcharts
are supported" error. This maps cleanly onto livediagram's model: a flowchart
**is** a node/edge graph, which is exactly what `graphToElements`
(packages/diagram, spec/62 §4.7) turns into laid-out shapes + pinned arrows.

Also deliberately out of scope **within** flowcharts: `classDef` / `style` /
`linkStyle` (the tab theme owns colours — Mermaid styling is skipped, never an
error), `click` interactions, and true `RL` / `BT` layouts (`RL` folds to LR,
`BT` to TB; the graph is identical, only the sweep direction differs).

## Flowchart syntax coverage

- **Header**: `graph`/`flowchart` + a direction (`TD`/`TB` → top-to-bottom,
  `LR`/`RL` → left-to-right; `BT` folds to TB). Missing header still parses as
  a top-down graph.
- **Nodes**: a bare id (`A`) is a box labelled with its id; a bracketed def
  sets the label + shape. Shape brackets map to the shape vocabulary:
  `["…"]` square · `(…)` / `([…])` stadium · `{…}` diamond · `((…))` /
  `(((…)))` circle · `[(…)]` cylinder · `{{…}}` hexagon · `[/…/]` `[\…\]`
  parallelogram · `[/…\]` `[\…/]` trapezoid · `[[…]]` subroutine → square ·
  `>…]` flag → square. An unknown bracket → square. A node seen only in an
  edge is created on sight. The v11.3 attribute form `id@{ shape: …, label:
"…" }` is read too, with a name map onto the same vocabulary (`rect`,
  `rounded`, `stadium`, `circle`, `dbl-circ`, `diam`/`decision`,
  `hex`/`prepare`, `cyl`/`database`, `lean-r`/`lean-l`, `trap-b`/`trap-t`,
  `doc`/`document`, `tri`/`triangle`; unknown names → square).
- **Edges**: `A --> B`, with an optional label (`A -->|yes| B` or the inline
  form `A -- yes --> B`), chained (`A --> B --> C` = two edges), and fanned
  (`A & B --> C & D` = the cartesian product). Operators map onto the arrow
  element's real style fields, not just "an arrow":
  - stroke: `-->` solid · `-.->` dashed (`strokeStyle: 'dashed'`) · `==>`
    thick (`strokeWidth`: the thick preset);
  - heads: `---` no head (`arrowEnds: 'none'`) · `<-->` both ends
    (`arrowEnds: 'both'`) · trailing/leading `o` → hollow-circle arrowhead ·
    `x` → open-V arrowhead (closest marker we have to Mermaid's cross);
  - `~~~` (invisible link) is parsed and **dropped** — it exists for Mermaid
    layout spacing and would be an invisible-arrow trap on a real canvas.

  An edge to an id with no node still creates the node.

- **Labels**: `<br/>` (any spelling) becomes a newline in the element label
  and newlines export back as `<br/>`; `&quot;` / `&amp;` are decoded on
  import and `"` re-escapes as `&quot;` on export, so quoted labels
  round-trip.
- **Subgraphs → frames**: a top-level `subgraph id[Title] … end` block imports
  as a **frame** shape (spec/09) drawn around its member nodes, laid out as a
  cluster: members are laid out among themselves, the cluster participates in
  the top-level flow as one block, and the frame is sized around the result.
  A node belongs to the subgraph where it was **first defined** (matching
  Mermaid). Edges may reference a subgraph id — the arrow pins to the frame.
  Nested subgraphs fold into their top-level ancestor (frames import one
  level deep). On export, each frame becomes a `subgraph` block containing
  the boxed nodes whose centre sits inside it (a node inside several frames
  belongs to the smallest).
- Lines it doesn't understand (`classDef`, `style`, `click`, `linkStyle`,
  `direction`, comments `%%`) are skipped, not fatal — a real-world paste
  imports its graph and ignores the decoration.

## The engine lives in `packages/diagram`

Pure, tested, reusable (import UI today; the MCP or public API could adopt it):

- **`parseMermaid(text)`** → `{ ok: true, graph: DiagramGraph, direction }` or
  `{ ok: false, error }`. Line-oriented parse of the flowchart body per the
  coverage above. `DiagramGraph` carries the subgraphs as optional
  `clusters: { id, label, members }[]`, and `GraphEdge` carries the edge
  style (`line: solid|dashed|thick`, `ends: to|none|both|from`,
  `head: triangle|circle|cross`) — both additive, so every existing
  `graphToElements` caller (the MCP) is untouched.
- **`layoutClusteredGraph(graph, { direction })`** (auto-layout-clusters.ts) —
  the import's composition point. Without clusters it's exactly
  `graphToElements` + `autoLayoutElements({ direction })`. With clusters it
  lays out each cluster's members, contracts each cluster to one
  block-sized node, lays out the contracted graph (via a new
  `autoLayoutElements` option `fixedSizeIds` that exempts the block nodes
  from peer-size normalisation), then expands: members shift into place and
  the frame element is emitted around them. Edgeless nodes (in a cluster or
  at top level) are swept into rows below the laid-out graph instead of
  piling at the origin.
- **`mermaidFromTab(tab)`** → a `flowchart TD` string. Boxed nodes become
  `id["label"]` with the bracket for their shape; frames become `subgraph`
  blocks; arrows become `from --> to` with `|label|`, choosing the operator
  from the arrow's real stroke/ends/head fields (dashed → `-.->`, thick →
  `==>`, no head → `---`, both heads → `<-->`, head-at-from exports with the
  endpoints swapped, circle heads → `o`). Edgeless boxed content (titles,
  captions) and non-graph element kinds (tables, images, freehand) have no
  flowchart representation and are dropped with the graph preserved — the
  export is the connection graph, faithfully.

## Import & export UX — file **or** text

Mermaid introduced a **two-step** panel (pasting/copying text is as common as a
file for a text format), and that panel is now the shared pattern for **every
text format** in both dialogs (JSON, Mermaid, Markdown), not just Mermaid:

- **Import → JSON / Mermaid / Markdown** → a panel with a textarea to
  **paste or write** the content (Import button) **and** an **Import a file
  instead** button (the format's file picker). Either path runs the format's
  parser and replaces the active tab (same single-undo-step replace as every
  import, spec/27). Shared component: `TextImportPanel`, driven by
  `importTextIntoActiveTab(format, text)` which both the paste and file routes
  call, so they can't diverge.
- **Export → JSON / Mermaid / Markdown** → a panel with a textarea pre-filled
  with the tab serialised to that format (`tabToJsonText` / `mermaidFromTab` /
  `tabToMarkdownText`), editable, with **Copy** and **Download** buttons.
  **Edits in the textarea never touch the tab** — it's a scratch view for
  copying, not a round-trip editor. Shared component: `TextExportPanel`.

The **image formats** (PNG / SVG / PDF) get their own second screen too
(`ImageExportPanel`): the **Isometric view** and **Background pattern** toggles
that used to sit permanently on the export grid now live behind the format
card, since they only affect image output — so the main grid is just the six
format cards, nothing format-specific bleeding onto it.

Naming: the JSON export/import card is titled **"JSON"** (was "File" /
"livediagram file"); the underlying format key stays `file`.

## Telemetry (spec/22)

`Tab`/`Imported`/`Mermaid` and `Diagram`/`Exported`/`Mermaid`, added to the
existing import/export type lists, replacing the removed `Text` type.

## Removed: the `.lvd` text DSL (spec/66)

The text DSL is deleted — `packages/diagram/src/text-dsl/`, its
`@livediagram/diagram/text-dsl` subpath export, `export-tab-text`'s DSL branch,
the Text cards in both dialogs, and spec/66. It was a bespoke format nobody
outside livediagram speaks; Mermaid does the same job (human-editable,
connection-preserving, round-trip) with a format the world already uses.

## Markdown (spec/27) — reassessed

After Mermaid landed, the Markdown import/export was re-evaluated against the
code. **Decision: keep both** — they solve a different problem from Mermaid.
Markdown import ingests an _outline_ (headings + nested lists, from XMind /
Obsidian / notes) and lays out that hierarchy as a themed tree; Markdown export
is a flat, human-readable _summary_ to paste into a doc. Mermaid is the
connection-faithful text round-trip; Markdown is the outline-in / readable
summary-out. Full reasoning in [spec/27](27-markdown-import.md) ("Still useful
after Mermaid?").
