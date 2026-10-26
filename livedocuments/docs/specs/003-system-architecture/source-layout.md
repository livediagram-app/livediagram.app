# Source layout: `apps/editor` components and hooks by domain

`apps/editor`'s components and hooks are grouped by domain, not by type: a file lives in the folder of the concern it
owns, not the screen that happens to render it first. It complements the no-god-files rule in `AGENTS.md` (cohesion
over line count). The canvas engine every product's editor shares is `@liveworkspace/workbench`
(`../packages/workbench/src/`, with the same `components/`, `hooks/` and `lib/` split); `apps/editor` holds
livedocuments's own code beside it.

## `apps/editor/components/`

- `canvas/`: `Canvas*`, element views (`BoxedElementView`, `ArrowView`, `LinkCardView`, ...), web component faces
  (`web/`), article pages (`article/`), overlays, marquee.
- `chrome/`: header, toolbars, docks, tab bar, the workbench chrome.
- `colour/`: the colour picker's surfaces.
- `dialogs/`: modal surfaces (`ShareDialog`, `ImportTabDialog`, `ExportTabDialog`, `SettingsDialog`,
  `CanvasThemeDialog`, and `settings/` rows).
- `notes/`, `tags/`, `tour/`, `split/`, `placement/`, `rich-text/`: one feature each.
- `palette/`: palette and context-menu tiles, rows and menu sections.
- `panels/`: side and floating panels (the Explorer panel, Layers, the gallery).
- `primitives/`: local leaves not promoted to `@livedocuments/ui` or `@liveworkspace/ui`.
- `providers/`: context providers (auth, the workbench session).
- `start/`: the start panel and its template cards ([Start diagramming](../007-editor/start-diagramming.md)).
- `toast/`: the toast stack, card, queue, timer and floor ([Toasts](../004-interface-design/toasts.md));
  `useToast` is in `hooks/ui/`.

## `apps/editor/hooks/`

- `canvas/`: drag, marquee, element style, keyboard shortcuts, editor commands.
- `collab/`: room connection, presence, mentions.
- `editor/`: the editor's own state slices (the mode, page edits, document visibility).
- `persistence/`: the account bootstrap, capabilities, preferences, workbench pairings.
- `ui/`: confirm, toast, panel layout, escape and click-outside.

## Rules

- Import by the `@/components/<domain>/X` / `@/hooks/<domain>/X` path; no per-directory barrels (keeps tree-shaking
  and direct-path imports).
- A file belongs to the domain of its concern, not the screen that happens to render it first.
- Code more than one app needs is a package: cross-app primitives in `@livedocuments/ui` or `@liveworkspace/ui`,
  editor code every product shares in `@liveworkspace/workbench`. Domain folders are for app-local code.
- `apps/editor/lib/api/*` is split by domain (`documents.ts`, `tabs.ts`, `share.ts`, ...), behind the one persistence
  boundary `apps/editor/lib/api-client.ts`.
