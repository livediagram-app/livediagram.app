# Markdown import

Import a Markdown document onto the current tab as an **article**, replacing the tab's contents (one undo step puts
them back), and export a tab as a Markdown summary. The goal is to bring in writing from anywhere (notes, READMEs,
outlines exported from other tools) as pages of formatted text, ready to edit.

livediagram built a mind-map tree from a Markdown outline. livedocuments has no tree diagram: the same file becomes an
article, the way an agent's Markdown does ([Pages for agents](../024-agents/pages-for-agents.md)).

## What it reads

The import reads Markdown the way pasting it into an article page does, so a file and a paste give the same blocks:

- **ATX headings** (`#`..`######`): `#` the largest heading, `##` the next, `###` and deeper the smallest.
- **Lists** (`-`, `*`, `+` bulleted; `1.` numbered; `- [ ]` / `- [x]` a to-do, ticked or not), nested by indentation.
- **Quotes** (`>`), **fenced code** (kept exactly as written) and **dividers** (`---`, `***`, `___`).
- **Inline marks**: bold, italic, strikethrough, inline code and links.

Every other line is a paragraph. The article flows onto as many pages as the writing needs, in the tab's theme.

## How it's triggered — the Import dialog

The per-tab **"Import…"** action (tab ellipsis menu) opens an **Import
dialog**, the mirror of the Export dialog. Above the format cards a warning says the import replaces the tab and Undo
brings it back (naming ⌘Z / Ctrl-Z only where there is a keyboard, a fine pointer). The user picks the format:

- **JSON** — a `.json` tab export, restored exactly.
- **Markdown** — a `.md` document, written into an article as above.

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
Errors render inline in the dialog; cancelling the file picker leaves the dialog
open. Importing is disabled (menu item greyed) while the tab is locked,
and the whole ellipsis menu is hidden for view-only visitors. Emits
`Tab / Imported / Markdown` (or `/ JSON`) telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

(This replaced the earlier behaviour where import always appended a new
tab — a format picker + an explicit "this overwrites the tab" warning is
clearer than silently growing the tab list, and Undo makes it safe.)

## Markdown export

The export side emits a flat, human-readable **summary** (`## Elements`, the _labelled_ elements, and
`## Connections`, every arrow that joins two elements: a labelled one as `- *label*: A → B`, an unlabelled one as
`- A → B`, since an unlabelled arrow is usually the main path; a free line with no label stays out),
sorted for reading, to drop into a doc, PR, or notes. It is deliberately **lossy** (no nesting, unlabelled
elements omitted) because it's a summary, not a reconstruction; the faithful round-trip is the JSON export.

## Implementation

The dialog is `apps/editor/components/dialogs/ImportTabDialog.tsx`, and `useTabActions.importIntoActiveTab` replaces
the active tab. The Markdown reader is `apps/editor/lib/markdown-import.ts`, dynamically imported so it stays out of the
initial editor bundle. See also [Document structure](../006-document/document-structure.md) (element model) and
[Canvas and palette](../008-canvas/canvas-and-palette.md) (import/export menu).
