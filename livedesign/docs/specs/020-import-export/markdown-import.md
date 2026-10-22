# Markdown import

Import a Markdown document and turn it into a real, themed diagram on the
current tab, replacing its contents (one undo step puts them back). The goal is to ingest outlines exported from other tools (XMind
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

**Limits.** A list nests at most `MAX_LIST_DEPTH` (24) levels; a deeper item becomes a sibling of
the deepest, so every item is kept and the layout's recursion stays shallow (12 000 ever-deeper
lines used to overflow the stack). A table larger than a table element holds (`MAX_TABLE_ROWS`,
`MAX_TABLE_COLS`, `MAX_TABLE_CELLS`, `packages/document`) keeps its first columns, then as many of
its first rows as fit; the rest is left out. One import keeps at most `MAX_MARKDOWN_IMPORT_NODES`
(2 000) nodes, headings, list items, prose lines and tables together, the first in document order;
the rest are counted, never kept, and the Import dialog shows its import report with one line,
"Markdown · 500 headings, list items, lines and tables beyond the first 2,000 were left out.", with
the count. Each node lands as a box and an arrow, so 2 000 nodes at the 120-character
label cap make a tab of about 1.3 MB and 4 000 elements, inside the tab's row and element caps
(measured; the constant's comment has the numbers).

If the document has a single top-level node it becomes the diagram's
root; otherwise a synthetic root (named from the file) holds the
top-level nodes so the result is one connected diagram.

## What it produces

- A **tidy left-to-right tree**: the root on the left, each level a
  column, children stacked and vertically centred on their parent so
  nothing overlaps. Depth drives text size (root largest), and boxes are
  sized to their label measured at that size: wider up to a cap (240, 320
  and 400 px for small, medium and large text), then a line taller for each
  wrap. Each column is as wide as its widest box. Parent→child links are
  **curved pinned arrows**.
- Any **tables** are placed in a column below the tree.
- Everything is recoloured to a theme (the active tab's theme, falling
  back to Brand) and the new tab adopts that theme's background — so the
  import looks native, not pasted-in.

The diagram is fully editable afterwards — it's ordinary elements, not a
locked import.

## How it's triggered — the Import dialog

The per-tab **"Import…"** action (tab ellipsis menu) opens an **Import
dialog**, the mirror of the Export dialog. Its two format cards sit two across. Above the cards a warning says the import replaces the tab and Undo
brings it back (naming ⌘Z / Ctrl-Z only where there is a keyboard, a fine pointer). The user picks the format:

- **JSON** — a `.json` tab export, restored exactly.
- **Markdown** — a `.md` outline, built into a themed tree as above.

Every format is text, so each card opens the **same two-step panel**
(`TextImportPanel`): **paste or write** the
content, or **import a file instead**. The way back to the format grid is the
shared **`BackBar`** across the top of that step (the same control the placement
browser uses), carrying the chosen format as its chip -
not a small text link in the footer, which put the way back beside the way
forward. The export dialog's two second screens (`TextExportPanel`,
`ImageExportPanel`) use the same bar, so every second screen in both dialogs
returns the same way. The chosen format drives the
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
`Tab / Imported / Markdown` (or `/ JSON`) telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

(This replaced the earlier behaviour where import always appended a new
tab — a format picker + an explicit "this overwrites the tab" warning is
clearer than silently growing the tab list, and Undo makes it safe.)

## Markdown export

The export side emits a flat, human-readable **summary** (`## Elements`, the _labelled_ elements, and
`## Connections`, every arrow that joins two elements: a labelled one as `- *label*: A → B`, an unlabelled one as
`- A → B`, since on a flowchart the unlabelled arrows are the main path; a free line with no label stays out),
sorted for reading, to drop into a doc, PR, or notes. It is deliberately **lossy** (no nesting, unlabelled
elements omitted) because it's a summary, not a reconstruction; the faithful round-trip is the JSON export.

## Boundaries / future

- **Not in scope here:** an inline ` ```mermaid ` fenced block _inside_ a Markdown file → an edge graph. The
  parser deliberately skips code fences.

Implementation: `apps/live/lib/markdown-import.ts` (pure parser + layout +
`buildTabFromMarkdown`, unit-tested), dynamically imported by
`useTabActions.importIntoActiveTab` (which replaces the active tab) so the
parser stays out of the initial editor bundle. The dialog is
`apps/live/components/dialogs/ImportTabDialog.tsx`. See also
[Document structure](../006-document/document-structure.md) (element model) and
[Canvas and palette](../008-canvas/canvas-and-palette.md) (import/export menu).
