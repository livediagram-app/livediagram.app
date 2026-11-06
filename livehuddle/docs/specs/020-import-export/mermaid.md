# Mermaid import & export

> **Gone from livehuddle** (imports from other tools, [Not in livehuddle](../002-project-scope/not-in-livehuddle.md#imports-from-other-tools)): livediagram keeps it, and [its spec there](../../../../livediagram/docs/specs/020-import-export/mermaid.md) is the one to read and change. livehuddle offers no Mermaid import or export anywhere: not in the editor, not as the api's, MCP's or CLI's `mermaid` input, not as the CLI's `export --format mermaid`; the parser and serialiser in `packages/document` are deleted. What a Mermaid import already drew stays and draws as before. The rest of this page records what livehuddle had.

Import and export [Mermaid](https://mermaid.js.org/) **flowchart** text: the
lingua franca of diagram-as-code, sitting in countless READMEs, issues, and AI
outputs. Unlike the Markdown outline import ([Markdown import](markdown-import.md)), Mermaid carries the full
**connection graph** (which node points at what), so a round-trip preserves the
diagram's structure, not just its labels. Mermaid is livehuddle's text form for a diagram: human-editable, connection-preserving and round-trip, in a
standard people already have, so there is no bespoke text DSL.

## Scope: flowcharts and state diagrams

We support the diagram types that are **node/edge graphs at heart**, because
they map onto livehuddle's model losslessly: `graphToElements`
(packages/document, [MCP server](../../../../livediagram/docs/specs/015-api/mcp-server.md) §4.7) turns a graph into laid-out shapes + pinned
arrows.

- **Flowcharts** (`graph TD`, `flowchart LR`, …): full import **and**
  export. The richest dialect: nodes, edges, node shapes, edge styles,
  labels, subgraphs, click links, layout direction.
- **State diagrams** (`stateDiagram` / `stateDiagram-v2`): **import only**.
  States and transitions are nodes and edges; composite states reuse the
  cluster/boundary machinery.

Import is per-dialect; **export always emits flowchart text**. The canvas has
no semantic layer (a state and a flowchart node are both just shapes once
imported), so exporting back to `stateDiagram` would mean
guessing meaning from geometry: the flowchart export preserves the
connection graph, which is the part that's real.

**Refused with the cut elements** ([Editor modes](../007-editor/editor-modes.md)): livehuddle has no entity, sequence
diagram or mind node, so `erDiagram`, `sequenceDiagram`, `mindmap` and `classDiagram` are refused, by the editor's
import and by the agents' `mermaid` input alike, with the error naming the supported types. Other non-graph Mermaid
types (gantt, pie, journey, timeline, quadrant, git graph, C4, requirement, ZenUML and the
`-beta` types: xychart, sankey, block, packet, architecture, radar, treemap, plus kanban) remain
out of scope; importing one reports a clear error naming the supported types, never a graph of its header words.

Also deliberately out of scope: `classDef` / `style` / `linkStyle` (the tab
theme owns colours; Mermaid styling is skipped, never an error) and true
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
  - `~~~` (invisible link) is parsed and **dropped**: it exists for Mermaid
    layout spacing and would be an invisible-arrow trap on a real canvas.

  An edge to an id with no node still creates the node.

- **Labels**: `<br/>` (any spelling) becomes a newline in the element label
  and newlines export back as `<br/>`; `&quot;` / `&amp;` are decoded on
  import and `"` re-escapes as `&quot;` on export, so quoted labels
  round-trip. Mermaid's numeric entity codes (`#124;` is `|`, `#37;` is `%`)
  decode on import. On export a `|` in an edge label is written `#124;`, a
  `%%` is written `#37;#37;` (an unquoted edge label would otherwise read it
  as a comment), a `#` that would read as an entity code is written
  `#35;`, a backtick `#96;` (a label wrapped in backticks would read back as a
  markdown string, its marks stripped) and the `<` of a `<br>` typed as text
  `#60;` (it would read back as a line break), so every label round-trips losslessly.
- **Subgraphs → boundaries**: a top-level `subgraph id[Title] … end` block imports
  as a **boundary** shape in Inset style ([The boundary](../009-elements/boundary.md); livehuddle has no Frame, [The Frame](../002-project-scope/not-in-livehuddle.md#the-frame)) drawn around its member nodes, laid out as a
  cluster: members are laid out among themselves, the cluster participates in
  the top-level flow as one block, and the boundary is sized around the result.
  A node belongs to the **first subgraph that mentions it** (matching
  Mermaid), wherever it was first written: `A --> C` above a `subgraph Kitchen` whose block uses `C` still puts
  `C` in Kitchen; mentions outside every subgraph claim nothing. Edges may reference a subgraph id: the arrow pins to the boundary.
  An empty subgraph draws no boundary; an edge to it keeps a box of its own, labelled with the subgraph's title.
  A subgraph opened again by the same id carries on the first one (one boundary, the members of both). A node written
  out with a subgraph's id (`a[Real node]` beside `subgraph a`) keeps the id, so edges naming it reach the node, and
  the boundary takes a fresh one (`a_subgraph`): neither is lost under the other's element id.
  Nested subgraphs fold into their top-level ancestor (boundaries import one
  level deep); through the MCP the reply says so (`notes`: "2 nested subgraphs folded into their outer group:
  groups draw one level deep"), rather than dropping the nesting silently. An edge naming a folded subgraph's id
  points at the boundary it folded into, rather than a stray box of the id (a node written out under that id stays a
  node, as does the box when the outer subgraph holds nothing else). On export, each boundary becomes a `subgraph` block containing
  the boxed nodes whose centre sits inside it (a node inside several boundaries
  belongs to the smallest).
- **Click links**: `click A "https://…"` (and the `click A href "https://…"`
  form) imports as the node's element link (`{ kind: 'url' }`), and a node
  whose element carries a URL link exports a matching `click` line. Callback
  forms (`click A someJsFunction`) are skipped: there's no code to call. Only a web or mail address (`http:`,
  `https:`, `mailto:`) becomes a link, as the link picker allows; `click A "javascript:…"` is dropped (the graph
  input's node `link` follows the same rule).
- Lines it doesn't understand (`classDef`, `style`, `linkStyle`,
  `direction`, comments `%%`) are skipped, not fatal: a real-world paste
  imports its graph and ignores the decoration. So is a class written on a node (`a:::hot --> b`, `a[Label]:::hot`):
  the edge after it still lands.
- **Statements** end at a newline or a `;`, as in Mermaid: `graph TD; A-->B; B-->C;` is three statements. A `;`
  inside a label (quoted, in a node's brackets or an edge's `|…|`) is label text.
- **Markdown strings** (``A["`**Bold** text`"]``) keep their words: the backticks and the `**` / `__` / `*` / `_`
  emphasis marks are dropped. A `%%` inside a
  double-quoted label is label text, not a comment.

## State diagram coverage (import)

- **Header**: `stateDiagram` / `stateDiagram-v2`; a top-level `direction
LR` line sets the layout direction (TB default).
- **States**: rounded boxes (stadium). Declared via transitions, bare ids,
  `state "Long description" as s1`, or `s1 : description` (the description
  becomes the label). `<<choice>>` states render as diamonds; `<<fork>>` /
  `<<join>>` as squares.
- **Start / end**: each `[*]` becomes an empty-label node ("Node boxes and text" below): a start node when it's a
  transition source, a small solid dot (a circle); an end node when it's a target, a bullseye (`final-state`, a ring
  round the dot, one element), as UML draws them (one of each per diagram, matching Mermaid's semantics).
- **Transitions**: `A --> B` with an optional `: label`.
- **Composite states**: `state Name { … }` becomes a cluster → boundary, same
  as a flowchart subgraph; nested composites fold into their top-level
  ancestor. Transitions may reference a composite's id (pins to the boundary); one naming a folded composite points at
  the boundary it folded into, rather than a stray box of the id (a state written out under that id stays a state, and
  so does the box when the outer composite holds nothing else, since no boundary is drawn). Flowcharts share the rule
  (`foldedEdgeEnds` in `mermaid-shared.ts`).
- Notes, concurrency separators (`--`), and history states are skipped.

## Layout

The editor's import lays a graph out exactly as an agent's Mermaid is laid out ([MCP server](../../../../livediagram/docs/specs/015-api/mcp-server.md)
§4.7, `graphFromMermaid` then `layoutGraph`): the flowchart direction, subgraphs as boundaries, the template look, and
lines that bend round the boxes, a line back to an earlier step going round the outside rather than straight behind
the boxes between. One difference: an import keeps every label **as written** (`layoutGraph`'s `wholeLabels`),
where an agent's long label is cut to a heading with its full text in the node's note. A front-matter `title:`
heads the drawing, as it does for an agent.

A loop through a group starts where the Mermaid starts it: the contracted layout takes its blocks in the order the
graph wrote them (a group where its first member was), so the first-written node leads, not whichever group came
first.

## The engine lives in `packages/document`

Pure, tested, reusable (import UI today; the MCP or public API could adopt it):

- **`parseMermaid(text)`** → `{ ok: true, graph: DiagramGraph, direction }` or
  `{ ok: false, error }`. Detects the diagram type from the header and
  dispatches: flowcharts parse in `mermaid.ts`, state diagrams in
  `mermaid-state.ts` (shared line/label
  helpers in `mermaid-shared.ts`; every dialect returns the same
  `DiagramGraph`, so the import path doesn't care which it was).
  `DiagramGraph` carries subgraphs / composite states as optional
  `clusters: { id, label, members }[]`; `GraphEdge` carries the edge style
  (`line: solid|dashed|thick`, `ends: to|none|both|from`, `head:
triangle|circle|cross`); `GraphNode` carries an optional `link` URL:
  all additive, so every existing `graphToElements` caller (the MCP) is
  untouched.
- **`layoutGraph(graph, { wholeLabels: true })`** (graph-input.ts), over **`graphFromMermaid(text)`**: the
  import's entry, shared with the MCP ("Layout" above).
- **`layoutClusteredGraph(graph, { direction })`** (auto-layout-clusters.ts):
  the layered composition point `layoutGraph` builds on. Without clusters it's exactly
  `graphToElements` + `autoLayoutElements({ direction })`. With clusters it
  lays out each cluster's members, contracts each cluster to one
  block-sized node, lays out the contracted graph (via a new
  `autoLayoutElements` option `fixedSizeIds` that exempts the block nodes
  from peer-size normalisation), then expands: members shift into place and
  the boundary element is emitted around them. Edgeless nodes (in a cluster or
  at top level) are swept into rows below the laid-out graph instead of
  piling at the origin.
- **`mermaidFromTab(tab)`** → a `flowchart TD` string. Boxed nodes become
  `id["label"]` with the bracket for their shape; a document or a triangle, which have no bracket, is written in the
  attribute form the import reads (`id@{ shape: doc, label: "…" }`, `tri`), a `}` in its label as `#125;`, so the
  shape survives a round trip; boundaries become `subgraph`
  blocks; arrows become `from --> to` with `|label|`, choosing the operator
  from the arrow's real stroke/ends/head fields (dashed → `-.->`, thick →
  `==>`, no head → `---`, both heads → `<-->`, head-at-from exports with the
  endpoints swapped, circle heads → `o`). Edgeless boxed content (titles,
  captions) and non-graph element kinds (tables, images, freehand) have no
  flowchart representation and are dropped with the graph preserved: the
  export is the connection graph, faithfully.
  - **Every connection is kept.** Stickies are nodes like shapes (a board of
    them exports as nodes, not an empty flowchart its own import refuses),
    and any other boxed element an arrow is pinned at both ends to (a text,
    a table, an image) becomes a node for that arrow's sake, so the line is
    never dropped. Each is a square box, labelled with its label or text.
  - **No label stays no label.** An unlabelled node or boundary is written with
    a blank quoted label (`n1[" "]`, `subgraph s1[" "]`), never its id: the id
    came back as a label on import, so a 28 px dot returned as a 96 px circle
    reading "n18". On import a blank label (only spaces) is no label.

## Limits

A graph is laid out only within `GRAPH_LAYOUT_MAX_NODES` (500 nodes) and `GRAPH_LAYOUT_MAX_EDGES`
(1 000 connections), `packages/document/src/graph-limits.ts`. The layered layout's crossing
reduction grows faster than linearly with the connections: a random 1 000-node / 1 000-edge graph
took 2.5 s, and the 14 400 connections of one line `a0&...&a119 --> b0&...&b119` took 21 s. So:

- `parseMermaid` refuses a graph over either cap with "The diagram is too large to lay out (<n>
  nodes, <m> connections): up to 500 nodes and 1000 connections are supported. Split it into
  several diagrams." A fan-out line is checked before its pairs are built, so the refusal costs no
  more than reading the line.
- The refusal comes after the parse, so the parse itself is linear in the text: subgraphs and composite states are
  kept by id and their members filtered once (20 000 composite states each named by a transition took 20 s while
  every cluster was scanned for each one; `mermaid-clusters-linear.test.ts` holds it under a CPU budget).
- The MCP's `graph` input carries the same caps in its schema and in `resolveGraphInput`
  ([MCP server](../../../../livediagram/docs/specs/015-api/mcp-server.md) §4.7).
- draw.io's graph-only JSON export is truncated to the caps rather than refused
  ([draw.io import](drawio-import.md#the-json-export)).

## Import & export UX: file **or** text

Mermaid introduced a **two-step** panel (pasting/copying text is as common as a
file for a text format), and that panel is now the shared pattern for **every
text format** in both dialogs, not just Mermaid:

- **Import → JSON / Excalidraw** (JSON, Mermaid and Markdown before Work Tracker #423 part 4) → a panel with a textarea to
  **paste or write** the content (Import button) **and** an **Import a file
  instead** button (the format's file picker). Either path runs the format's
  parser and replaces the active tab (same single-undo-step replace as every
  import). Shared component: `TextImportPanel`, driven by
  `importTextIntoActiveTab(format, text)` which both the paste and file routes
  call, so they can't diverge.
- **Export → JSON / Mermaid / Markdown** → a panel with a textarea pre-filled
  with the tab serialised to that format (`tabToJsonText` / `mermaidFromTab` /
  `tabToMarkdownText`), editable, with **Copy** and **Download** buttons.
  **Edits in the textarea never touch the tab**: it's a scratch view for
  copying, not a round-trip editor. Shared component: `TextExportPanel`.

The **image formats** (PNG / SVG / PDF) get their own second screen too
(`ImageExportPanel`): the **Background pattern** toggle
lives behind the format card, not on the export grid, since it only affects image output, so the main grid is just the six
format cards, nothing format-specific bleeding onto it.

Naming: the JSON export/import card is titled **"JSON"** (was "File" /
"livehuddle file"); the underlying format key stays `file`.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

`Tab`/`Imported`/`Mermaid` and `Document`/`Exported`/`Mermaid`, in the
import/export type lists (there is no `Text` type).

## Markdown ([Markdown import](markdown-import.md))

Markdown import and export sit beside Mermaid because they solve a different problem.
Markdown import ingests an _outline_ (headings + nested lists, from XMind /
Obsidian / notes) and lays out that hierarchy as a themed tree; Markdown export
is a flat, human-readable _summary_ to paste into a doc. Mermaid is the
connection-faithful text round-trip; Markdown is the outline-in / readable
summary-out. Full reasoning in [Markdown import](markdown-import.md) ("Beside Mermaid").

## Node boxes and text

A graph's nodes (a Mermaid import, the MCP's graph input) are sized to their
labels and set in one text size for the whole graph (`md`, the templates' size, up to `LOOK_MD_MAX_NODES` nodes;
`sm` past it, so a large system still fits), not the shape default that
scales text to fill each box: fitted boxes with scaling text made a short
heading huge beside a long one set small (`labelBoxSize` in `graph-authoring.ts`).
The clustered layout **keeps those sizes** rather than stretching each box to
its widest peer, so one long label does not inflate every box.

An **unlabelled circle is a dot**: 28 px, solid in the theme's accent through
the `solid` colour preset (resolved when the import applies the tab's theme).
That is what a state diagram's `[*]` start becomes; drawn at the default
circle size it read as a large empty box waiting for text. An unlabelled `final-state` is the end's bullseye, 34 px,
in the same accent.

Inside a subgraph, members that no arrow **inside** the subgraph touches (a
"Core services" group of peers wired only to things outside it) are **lined up
across the flow** in one row or column, not wrapped into a grid, and every
group's members that share a rank are then ordered by where their neighbours
outside the group ended up, so arrows from outside reach each member without
crossing another. A node outside every group that members link to then sits by
those members rather than by the middle of the whole group (a database under the
service that owns it), its rank kept in order with its gaps; an edge to or from a
subgraph itself leaves the boundary facing its other end; and a boundary whose first
member a line enters from above, down the page, is padded both sides so that line
clears the header ([MCP server](../../../../livediagram/docs/specs/015-api/mcp-server.md) §4.7 "Groups keep their
lines clear", the same layout).

A subgraph's boundary carries its title as a **header**: top-left, bold, at the
nodes' size, in the band the clustered layout reserves above the members (never centred and scaled to fill the boundary, a giant word across the nodes
inside).
