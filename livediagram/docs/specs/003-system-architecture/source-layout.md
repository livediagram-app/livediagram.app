# Source layout: `apps/editor` components, hooks and the editor's state by domain

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

## The editor's state

`apps/editor/app/document/[id]/useEditorState.ts` is the editor's one state hook, and it holds no logic of its own:
it composes the slices in the folder beside it, `app/document/[id]/editor-state/`, one hook per file named `use<Concern>.ts`, and
returns their view-models spread into the one object `EditorContext` carries. Its return is the editor's contract
with every component that reads the context; splitting or regrouping slices never changes it.

- A slice is named for its concern from the vocabulary every product's editor shares: `useEditorDocument` (load,
  tabs, document meta), `useEditorSelection`, `useEditorUndoState` (undo, redo and the commit), `useEditorTools`,
  `useEditorViewport`, `useEditorCollaboration` (room state, presence, peers), `useEditorPersistence` (save, sync,
  offline), `useEditorComments` and `useEditorDialogs`. A concern only this product has gets a `useEditor<Name>` of
  its own.
- Dependencies flow one way: the composer calls the slices in order and hands each the slices before it; a slice
  never reaches a later one, and slices import each other's types only.
- The order is the order the editor's effects run in, so a new slice goes where its effects belong, and a value a
  slice needs from a later one reaches it through a ref the earlier slice owns.
- A test of a slice's own logic sits beside it as `use<Concern>.test.ts(x)`.

The [editor-state blueprint](blueprints/editor-state.md) lists the slices, what each owns and the order they run in.
