# Mermaid import & export

Import and export [Mermaid](https://mermaid.js.org/) **flowchart** text — the
lingua franca of diagram-as-code, sitting in countless READMEs, issues, and AI
outputs. Unlike the Markdown outline import ([Markdown import](markdown-import.md)), Mermaid carries the full
**connection graph** (which node points at what), so a round-trip preserves the
diagram's structure, not just its labels. This is the format the old `.lvd`
text DSL (the removed text-DSL spec, now removed) was trying to be, except Mermaid is a real
standard people already have.

## Scope: flowcharts, state diagrams, ER diagrams

We support the diagram types that are **node/edge graphs at heart**, because
they map onto livediagram's model losslessly: `graphToElements`
(packages/diagram, [MCP server](../015-api/mcp-server.md) §4.7) turns a graph into laid-out shapes + pinned
arrows.

- **Flowcharts** (`graph TD`, `flowchart LR`, …) — full import **and**
  export. The richest dialect: nodes, edges, node shapes, edge styles,
  labels, subgraphs, click links, layout direction.
- **State diagrams** (`stateDiagram` / `stateDiagram-v2`) — **import only**.
  States and transitions are nodes and edges; composite states reuse the
  cluster/frame machinery.
- **ER diagrams** (`erDiagram`) — **import only**. Entities and
  relationships are nodes and edges; attributes fold into the entity label.

Import is per-dialect; **export always emits flowchart text**. The canvas has
no semantic layer (a state and a flowchart node are both just shapes once
imported), so exporting back to `stateDiagram` / `erDiagram` would mean
guessing meaning from geometry — the flowchart export preserves the
connection graph, which is the part that's real.

Non-graph Mermaid types (sequence, gantt, pie, journey, timeline, quadrant)
and class diagrams remain out of scope; importing one reports a clear error
naming the supported types.

Also deliberately out of scope: `classDef` / `style` / `linkStyle` (the tab
theme owns colours — Mermaid styling is skipped, never an error) and true
`RL` / `BT` layouts (`RL` folds to LR, `BT` to TB; the graph is identical,
only the sweep direction differs).

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
  as a **frame** shape ([Canvas and palette](../008-canvas/canvas-and-palette.md)) drawn around its member nodes, laid out as a
  cluster: members are laid out among themselves, the cluster participates in
  the top-level flow as one block, and the frame is sized around the result.
  A node belongs to the subgraph where it was **first defined** (matching
  Mermaid). Edges may reference a subgraph id — the arrow pins to the frame.
  Nested subgraphs fold into their top-level ancestor (frames import one
  level deep). On export, each frame becomes a `subgraph` block containing
  the boxed nodes whose centre sits inside it (a node inside several frames
  belongs to the smallest).
- **Click links**: `click A "https://…"` (and the `click A href "https://…"`
  form) imports as the node's element link (`{ kind: 'url' }`), and a node
  whose element carries a URL link exports a matching `click` line. Callback
  forms (`click A someJsFunction`) are skipped — there's no code to call.
- Lines it doesn't understand (`classDef`, `style`, `linkStyle`,
  `direction`, comments `%%`) are skipped, not fatal — a real-world paste
  imports its graph and ignores the decoration.

## State diagram coverage (import)

- **Header**: `stateDiagram` / `stateDiagram-v2`; a top-level `direction
LR` line sets the layout direction (TB default).
- **States**: rounded boxes (stadium). Declared via transitions, bare ids,
  `state "Long description" as s1`, or `s1 : description` (the description
  becomes the label). `<<choice>>` states render as diamonds; `<<fork>>` /
  `<<join>>` as squares.
- **Start / end**: each `[*]` becomes a circle — an empty-label start node
  when it's a transition source, an end node when it's a target (one of
  each per diagram, matching Mermaid's semantics).
- **Transitions**: `A --> B` with an optional `: label`.
- **Composite states**: `state Name { … }` becomes a cluster → frame, same
  as a flowchart subgraph; nested composites fold into their top-level
  ancestor. Transitions may reference a composite's id (pins to the frame).
- Notes, concurrency separators (`--`), and history states are skipped.

## ER diagram coverage (import)

- **Header**: `erDiagram` (no direction syntax; lays out TB).
- **Entities**: square boxes. An attribute block (`CUSTOMER { string name
… }`) folds into the label — entity name first line, one `type name`
  attribute per line. Key/comment columns (PK / FK / UK, "comment") are
  dropped from the label.
- **Relationships**: `A ||--o{ B : label` becomes an edge labelled `label`.
  Cardinality maps onto arrow ends: a "many" side (crow's foot, `{` / `}`)
  gets an open-V arrowhead on that end (`ends`: the many side(s), `head:
'cross'`); one-to-one relationships render headless. Non-identifying
  (dotted `..`) relationships render dashed.

## The engine lives in `packages/diagram`

Pure, tested, reusable (import UI today; the MCP or public API could adopt it):

- **`parseMermaid(text)`** → `{ ok: true, graph: DiagramGraph, direction }` or
  `{ ok: false, error }`. Detects the diagram type from the header and
  dispatches: flowcharts parse in `mermaid.ts`, state diagrams in
  `mermaid-state.ts`, ER diagrams in `mermaid-er.ts` (shared line/label
  helpers in `mermaid-shared.ts`; every dialect returns the same
  `DiagramGraph`, so the import path doesn't care which it was).
  `DiagramGraph` carries subgraphs / composite states as optional
  `clusters: { id, label, members }[]`; `GraphEdge` carries the edge style
  (`line: solid|dashed|thick`, `ends: to|none|both|from`, `head:
triangle|circle|cross`); `GraphNode` carries an optional `link` URL —
  all additive, so every existing `graphToElements` caller (the MCP) is
  untouched.
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
  import, [Markdown import](markdown-import.md)). Shared component: `TextImportPanel`, driven by
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

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Tab`/`Imported`/`Mermaid` and `Diagram`/`Exported`/`Mermaid`, added to the
existing import/export type lists, replacing the removed `Text` type.

## Removed: the `.lvd` text DSL (the removed text-DSL spec)

The text DSL is deleted — `packages/diagram/src/text-dsl/`, its
`@livediagram/diagram/text-dsl` subpath export, `export-tab-text`'s DSL branch,
the Text cards in both dialogs, and the removed text-DSL spec. It was a bespoke format nobody
outside livediagram speaks; Mermaid does the same job (human-editable,
connection-preserving, round-trip) with a format the world already uses.

## Markdown ([Markdown import](markdown-import.md)) — reassessed

After Mermaid landed, the Markdown import/export was re-evaluated against the
code. **Decision: keep both** — they solve a different problem from Mermaid.
Markdown import ingests an _outline_ (headings + nested lists, from XMind /
Obsidian / notes) and lays out that hierarchy as a themed tree; Markdown export
is a flat, human-readable _summary_ to paste into a doc. Mermaid is the
connection-faithful text round-trip; Markdown is the outline-in / readable
summary-out. Full reasoning in [Markdown import](markdown-import.md) ("Still useful
after Mermaid?").
