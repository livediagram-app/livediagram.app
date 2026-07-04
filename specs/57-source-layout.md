# 57 — Source layout: group `apps/live` components + hooks by domain

Status: **done** — both `apps/live/hooks/` and `apps/live/components/` have
been reorganised into the buckets below.

## Problem

`apps/live` has grown two flat grab-bag directories:

- `apps/live/components/` — ~157 files, alphabetical, mixing 3-line leaves
  (`ChartTooltip.tsx`, `CloseIcon.tsx`) with 1,000+ line screens
  (`Canvas.tsx`, `EditorContextMenu.tsx`, `BoxedElementView.tsx`).
- `apps/live/hooks/` — ~66 files, canvas state machines
  (`useEditorDrag.ts`, `useElementStyle.ts`) sitting next to UI-only hooks
  (`useConfirm.ts`, `useToast.ts`) and persistence hooks
  (`useFolders.ts`, `useTeams.ts`).

The blessed counter-example already in the tree is `apps/live/lib/api/*`,
which is split by domain (`diagrams.ts`, `tabs.ts`, `share.ts`, …). A new
contributor can find the persistence boundary instantly; finding "the
canvas components" means scrolling 157 alphabetised entries. This is the
flat-directory half of the consistency review (item #9); it complements
the no-god-files rule in `CLAUDE.md` (cohesion over line count).

## Proposed taxonomy

Group by domain, not by type. Target subdirectories (indicative, not
exhaustive — each file lands in the bucket that owns its concern):

`apps/live/components/`

- `canvas/` — `Canvas*`, element views (`BoxedElementView`, `ArrowView`,
  `LinkCardView`, …), overlays, marquee, layers.
- `dialogs/` — modal surfaces (`Dialog`, `ConfirmDialog`, `ShareDialog`,
  `ImportTabDialog`, `ExportTabDialog`, `SettingsDialog`, `TeamFormModal`).
- `panels/` — side/floating panels (`ActivityPanel`, `CollaboratePanel`,
  `AiPanel`, `GalleryPane`, Explorer surfaces).
- `palette/` — palette + context-menu tiles/rows.
- `chrome/` — header, toolbars, docks, tab bar.
- `primitives/` — local leaves (`CloseIcon`, `Portal`, chart leaves) not
  promoted to `@livediagram/ui`.

`apps/live/hooks/`

- `canvas/` — drag, eraser, marquee, element style, keyboard shortcuts.
- `persistence/` — folders, teams, capabilities, custom themes, share links.
- `ui/` — confirm, toast, panel layout, escape/click-outside.
- `collab/` — room connection, presence, change log.

Rules:

- Import via the `@/components/<domain>/X` / `@/hooks/<domain>/X` path; no
  per-directory barrels (keeps tree-shaking + matches today's direct-path
  imports).
- A file belongs to the domain of its concern, not the screen that happens
  to render it first.
- Cross-app primitives keep migrating to `@livediagram/ui` (see review #4/#5:
  `Button`, `TextInput`); domain folders are for app-local code.

## Execution

Each directory moves **atomically in its own pass** — never a partial move
within a directory, which would leave it half-organised (worse than
consistently-flat). Every move rewrites that directory's `@/<dir>/X` import
sites across hundreds of files, including hot files (`EditorView`,
`useEditorState`, `Canvas`) edited continuously by the repo's background
auto-committer, so each pass runs in an isolated `git worktree` off
`origin/main`: `git mv` each file into its bucket, a quote-anchored
project-wide import-path rewrite, then `typecheck && lint && test && format`
green before a single commit and push.

- **`hooks/` — done.** 66 files → canvas / persistence / ui / collab; ~410
  files had their `@/hooks/*` imports rewritten; full suite green.
- **`components/` — done.** 158 files → dialogs / panels / palette / chrome /
  primitives / canvas (`providers/` already existed, left as-is). Two passes:
  first every inter-component relative import (`./X`, `../X`, `./providers/X`)
  was resolved to a `@/components/...` alias, then the files moved and the
  aliases were rewritten to bucketed paths. Full suite green.
