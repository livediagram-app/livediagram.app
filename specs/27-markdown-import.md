# Markdown import

Import a Markdown document and turn it into a real, themed diagram on a
new tab. The goal is to ingest outlines exported from other tools (XMind
mind-map → Markdown, Obsidian/Logseq outlines, any heading/bullet notes)
and produce a high-quality node-link diagram, **without assuming a fixed
shape** — the parser is tolerant of whatever structure the file has.

## Why a generic parser

Different tools emit different Markdown. XMind exports a central topic as
an `#` heading with nested `-` bullets; some tools emit all-heading
hierarchies; hand-written notes mix headings, ordered and unordered
lists, tables, and prose. We can't hard-code one layout, so the importer
extracts the **hierarchy** that's actually present and lays it out, rather
than pattern-matching a specific exporter.

## What it parses

Input is treated as a hierarchical outline:

- **ATX headings** (`#`..`######`) — depth = number of `#`. A deeper
  heading nests under the nearest shallower one.
- **List items** (`-`, `*`, `+`, `1.`, `1)`), nested by indentation
  (tabs normalised to spaces). Lists attach under the current heading;
  nested items attach under their parent item. Task-list checkboxes
  (`- [ ]` / `- [x]`) are stripped to their text.
- **GFM pipe tables** (a header row followed by a `---|---` delimiter)
  become a `table` element.
- **Prose lines** become leaf nodes under the current heading (so content
  isn't silently dropped), and end the current list.
- **Skipped:** fenced code blocks (``` / ~~~) and their contents,
horizontal rules, and blockquote markers (`>` is stripped).
- **Inline formatting** in labels is flattened to plain text: bold,
  italic, strikethrough, inline code, links (→ link text), images
  (→ alt text), and raw HTML tags are removed. Long labels are capped.

If the document has a single top-level node it becomes the diagram's
root; otherwise a synthetic root (named from the file) holds the
top-level nodes so the result is one connected diagram.

## What it produces

- A **tidy left-to-right tree**: the root on the left, each level a
  column, children stacked and vertically centred on their parent so
  nothing overlaps. Boxes are sized to their label; depth drives text
  size (root largest). Parent→child links are **curved pinned arrows**.
- Any **tables** are placed in a column below the tree.
- Everything is recoloured to a theme (the active tab's theme, falling
  back to Brand) and the new tab adopts that theme's background — so the
  import looks native, not pasted-in.

The diagram is fully editable afterwards — it's ordinary elements, not a
locked import.

## How it's triggered — the Import dialog

The per-tab **"Import…"** action (tab ellipsis menu) opens an **Import
dialog**, the mirror of the Export dialog. The user picks the format:

- **JSON** — a `.json` tab export, restored exactly.
- **Mermaid** — a flowchart, keeping every connection ([spec/73](73-mermaid.md)).
- **Markdown** — a `.md` outline, built into a themed tree as above.

Every format is text, so each card opens the **same two-step panel**
(`TextImportPanel`, [spec/73](73-mermaid.md)): **paste or write** the
content, or **import a file instead**. The chosen format drives the
placeholder, the file-picker's filter, and which parser runs (no content
auto-detection — the user said which it is). Both the paste and file
routes go through one `importTextIntoActiveTab(format, text)` so they
parse + replace identically.

**Import replaces the current tab's contents** — its elements, theme, and
background — keeping the tab's id and name. The dialog leads with a
warning that says so. The replace is a single `commitTabs` step, so
**Undo (⌘Z) restores** the previous content; the warning says that too.
Errors render inline in the dialog (e.g. "No headings, lists, or tables
found in this Markdown."); cancelling the file picker leaves the dialog
open. Importing is disabled (menu item greyed) while the tab is locked,
and the whole ellipsis menu is hidden for view-only visitors. Emits
`Tab / Imported / Markdown` (or `/ JSON`) telemetry (spec/22).

(This replaced the earlier behaviour where import always appended a new
tab — a format picker + an explicit "this overwrites the tab" warning is
clearer than silently growing the tab list, and Undo makes it safe.)

## Still useful after Mermaid? — yes, both, in distinct roles

Mermaid ([spec/73](73-mermaid.md)) landed as the connection-preserving
text format, which raised the question of whether Markdown import/export
still earns its place. Reviewed against the code, both do — they solve a
_different_ problem from Mermaid, so they stay:

- **Markdown import — keep.** It ingests an **outline** (headings + nested
  lists) from tools that emit exactly that (XMind, Obsidian/Logseq,
  hand-written notes) and lays out the **hierarchy** as a themed tree with
  parent→child connectors. That hierarchy _is_ preserved — the import is
  not connectionless. Mermaid doesn't replace it: someone holding a
  Markdown outline is not going to hand-author flowchart syntax, and a
  tree-from-indentation is a genuinely different input from a node/edge
  graph. Different source, different shape → distinct value.
- **Markdown export — keep, repositioned.** It emits a flat, human-
  readable **summary** (`## Elements` + `## Connections` bullet lists of
  the _labelled_ content), sorted for reading, to drop into a doc, PR, or
  notes. It is deliberately **lossy** — no nesting, unlabelled elements
  omitted — because it's a summary, not a reconstruction. Mermaid is now
  the **faithful** text export (rebuilds the graph); Markdown is the
  **readable** one. The two coexist with clear, non-overlapping jobs, and
  the export dialog + help copy say which is which.

## Boundaries / future

- **Round-trip:** the faithful, connection-preserving text round-trip is
  **Mermaid** ([spec/73](73-mermaid.md)) — serialise a tab to `flowchart`
  text and parse it back into the same graph by id. Markdown export
  stays the human _summary_ (see above), not a byte-for-byte
  reconstruction. (This role used to belong to the `.lvd` text DSL,
  spec/66, now removed in favour of Mermaid.)
- **Not in scope here:** an inline ` ```mermaid ` fenced block _inside_ a
  Markdown file → an edge graph (Mermaid import is its own format /
  dialog path today, not a Markdown code-fence pass), and Excalidraw
  `.excalidraw` JSON (that's JSON, not Markdown; a separate importer). The
  parser deliberately skips code fences, so a future "Mermaid blocks
  inside Markdown" pass could claim them.

Implementation: `apps/live/lib/markdown-import.ts` (pure parser + layout +
`buildTabFromMarkdown`, unit-tested), dynamically imported by
`useTabActions.importIntoActiveTab` (which replaces the active tab) so the
parser stays out of the initial editor bundle. The dialog is
`apps/live/components/dialogs/ImportTabDialog.tsx`. See also
[spec/05](05-diagram-structure.md) (element model) and
[spec/09](09-canvas-and-palette.md) (import/export menu).
