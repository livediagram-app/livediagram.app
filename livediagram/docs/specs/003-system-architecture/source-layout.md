# Source layout: `apps/editor` components and hooks by domain

`apps/editor/components/` and `apps/editor/hooks/` are grouped by domain, not by type: each file sits in the folder
that owns its concern, so a file is found by what it is about rather than by scrolling a flat list that mixes
three-line leaves with thousand-line screens.

## The folders

`apps/editor/components/`

- `canvas/`: the canvas, element views and faces (`BoxedElementView`, `ArrowView`, `LinkCardView`, ...), overlays,
  marquee, layers.
- `chrome/`: header, toolbars, docks, tab bar, badges and bars.
- `colour/`: colour pickers and swatches.
- `dialogs/`: modal surfaces (`ImportTabDialog`, `ExportTabDialog`, Settings, the Community dialogs, ...).
- `flowchart/`: the flowchart builder's pieces.
- `notes/`: sticky-note pieces.
- `palette/`: palette and context-menu tiles and rows.
- `panels/`: side and floating panels (`CollaboratePanel`, `LayersPanel`, `SearchPanel`, the Explorer host).
- `placement/`: placing elements onto the canvas.
- `primitives/`: local leaves (`MovablePanel`, `ChipField`, `HelpArticleLink`, chart leaves) not promoted to `@livediagram/ui` or
  `@liveworkspace/ui` (which holds `Portal`).
- `providers/`: React context providers.
- `rich-text/`: the rich-text editor.
- `split/`: split view.
- `start/`: the start panels and template starts.
- `toast/`: the toast stack, card, queue, timer and floor ([Toasts](../004-interface-design/toasts.md));
  `useToast` is in `hooks/ui/`.
- `tour/`: the guided tours.

`apps/editor/hooks/`

- `canvas/`: drag, eraser, marquee, element style, keyboard shortcuts.
- `collab/`: room connection, presence.
- `editor/`: editor-wide state (modes, the default tool).
- `persistence/`: documents, capabilities, share links, the Community post.
- `ui/`: confirm, toast, panel layout, escape and click-outside.

## Rules

- Import through `@/components/<domain>/X` and `@/hooks/<domain>/X`; no per-directory barrels, which keeps
  tree-shaking and direct-path imports.
- A file belongs to the domain of its concern, not the screen that happens to render it first.
- Code more than one app needs goes to `@livediagram/ui` (or `@liveworkspace/*`, for every product); domain folders
  are for app-local code.
- A move between folders moves a whole directory's files in one change, with every import rewritten, so no folder is
  ever half-organised.
