# Source layout: `apps/editor` grouped by domain

`apps/editor`'s components and hooks are grouped by domain, not by type, so a reader finds "the sheet components"
or "the persistence hooks" in one folder. The persistence boundary is split the same way in `apps/editor/lib/api/*`
(`projects.ts`, `tabs.ts`, `items.ts`, `sheets.ts`, `share.ts`, ...). This complements the no-god-files rule in
`AGENTS.md` (cohesion over line count).

## The folders

`apps/editor/components/`

- `canvas/`: the canvas host (`Canvas.tsx`, `EditorCanvasHost.tsx`), element views (`BoxedElementView`,
  `ArrowView`, the chart views), overlays, selection chrome and remote cursors.
- `chrome/`: the header, toolbars, zoom controls and the tab bar.
- `colour/`: the colour picker and custom colour editor ([Colour picker](../004-interface-design/colour-picker.md)).
- `dialogs/`: modal surfaces (`ConfirmDialog`, `ImportTabDialog`, `ExportTabDialog`, `CanvasThemeDialog`, the
  settings dialog's panes).
- `forms/`: the Form tab's builder and its response views ([Forms](../030-forms/forms.md)).
- `notes/`: an element's rich-text note editor.
- `palette/`: the element menu (`EditorContextMenu`, its sections, tiles and rows) and the tile definitions
  Start Planning and the Dashboard slot pickers draw from.
- `panels/`: side and floating panels (the Collaborate panel, the action popover).
- `plan/`: boards, cards, the item panel, the card type editor, plan views, board widgets, Dashboards
  (`dashboard/`), Start Planning (`start/`), and the plan view and widget faces (`views/`, `widgets/`).
- `primitives/`: app-local leaves (icon glyphs, portal menus, chart leaves) not promoted to `@liveplanner/ui`
  or `@liveworkspace/ui`.
- `providers/`: React context providers the editor mounts once.
- `rich-text/`: the label editor's rich-text parts.
- `sheets/`: the Sheet element: grid, formula bar, toolbar, the rules editors (`rules/`)
  ([Sheet element](../029-sheets/blueprints/sheet-element.md)).
- `split/`: side by side tabs ([Split view](../007-editor/split-view.md)).
- `start/`: the start panel ([Start panel](../007-editor/start-panel.md)).
- `tour/`: the tours' stage and art ([Plan tour](../026-plan/plan-tour.md)).

The toast stack, the selection store and other editor parts every product shares live in
`@liveworkspace/workbench` (`../packages/workbench`), not here; `hooks/ui/useToast.tsx` wraps its `ToastStack`
([Toasts](../004-interface-design/toasts.md)).

`apps/editor/hooks/`

- `canvas/`: drag, marquee, element style setters, keyboard shortcuts.
- `collab/`: the room connection and presence.
- `editor/`: editor-wide hooks that belong to no one surface (the default tool, custom colours, tag colours, the tour square).
- `forms/`: the Form tab's state.
- `persistence/`: the project, its tabs, capabilities and share links.
- `plan/`: the item store client, boards, card types and Dashboards.
- `sheets/`: the sheet store client.
- `ui/`: confirm, toast, panel layout, escape and click-outside.

`apps/editor/lib/` holds pure modules and clients: `api/` (the api client by domain), `export-plan/`,
`offline/` ([Offline Mode](../006-project/offline-mode.md)), `workbench/` and `testing/`, beside flat modules.
`apps/editor/app/` holds the routes ([New project route](../007-editor/new-project-route.md)).

## Rules

- Import via the `@/components/<domain>/X` and `@/hooks/<domain>/X` paths; no per-directory barrels (keeps
  tree-shaking and direct-path imports).
- A file belongs to the domain of its concern, not the screen that happens to render it first.
- Code more than one app needs moves to a package: `@liveplanner/ui` for liveplanner's apps, `@liveworkspace/*` in
  the root `packages/` for every product ([docs/structure.md](../../../../docs/structure.md)). Domain folders are for
  app-local code.
- A folder moves whole, in one change, never half-organised.
