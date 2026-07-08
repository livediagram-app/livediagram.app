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
LR`, …) — nodes, edges, node shapes, edge labels, and the layout direction.
Other Mermaid diagram types (sequence, class, state, gantt, pie, …) are out of
scope; importing one reports a clear "only flowcharts are supported" error.
This maps cleanly onto livediagram's model: a flowchart **is** a node/edge
graph, which is exactly what `graphToElements` (packages/diagram, spec/62 §4.7)
turns into laid-out shapes + pinned arrows.

## The engine lives in `packages/diagram`

Pure, tested, reusable (import UI today; the MCP or public API could adopt it):

- **`parseMermaid(text)`** → `{ ok: true, graph: DiagramGraph, direction }` or
  `{ ok: false, error }`. Line-oriented parse of the flowchart body:
  - **Header**: `graph`/`flowchart` + a direction (`TD`/`TB` → top-to-bottom,
    `LR`/`RL` → left-to-right; `BT` folds to TB). Missing header still parses as
    a top-down graph.
  - **Nodes**: a bare id (`A`) is a box labelled with its id; a bracketed def
    sets the label + shape. Shape brackets map to the shape vocabulary:
    `["…"]` square · `(…)` / `([…])` stadium · `{…}` diamond · `((…))` circle ·
    `[(…)]` cylinder · `{{…}}` hexagon · `[/…/]` `[\…\]` parallelogram. An
    unknown bracket → square. A node seen only in an edge is created on sight.
  - **Edges**: `A --> B`, with an optional label (`A -->|yes| B` or `A --> |yes|
B`), chained (`A --> B --> C` = two edges), and the common operators
    (`-->` arrow · `---` line, no head · `-.->` dashed · `==>` thick). An edge
    to an id with no node still creates the node.
  - Lines it doesn't understand (`subgraph`, `classDef`, `style`, `click`,
    comments `%%`) are skipped, not fatal — a real-world paste imports its graph
    and ignores the decoration.
- **`mermaidFromTab(tab)`** → a `flowchart TD` string. Boxed nodes become
  `id["label"]` with the bracket for their shape; arrows become `from --> to`
  with `|label|`. Edgeless boxed content (titles, captions) and non-graph
  element kinds (tables, images, freehand) have no flowchart representation and
  are dropped with the graph preserved — the export is the connection graph,
  faithfully.

`parseMermaid` returns the graph only; the import composes it with
`graphToElements` + `autoLayoutElements({ direction })` so the imported diagram
respects the Mermaid layout direction.

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
