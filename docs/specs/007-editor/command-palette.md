# Command palette (⌘K)

Make every editor action reachable by typing its name. This is **not a new
surface**: the global Search panel ([Canvas and palette](../008-canvas/canvas-and-palette.md) "Search panel") already has a
grouped, keyboard-navigable results list with an **Actions** group backed by
the command registry (`lib/editor-commands.ts`). This spec promotes that
Actions group into a full command palette by (a) binding the conventional
**Cmd/Ctrl+K** shortcut alongside the existing Cmd/Ctrl+., and (b) widening
the registry from selection/document verbs to the whole app surface.

## Shortcut

- **Cmd/Ctrl+K opens the Search panel**, identically to Cmd/Ctrl+. (both
  stay; `K` is the convention users arrive with, `.` is grandfathered).
  Works in zen mode and read-only views, like the existing binding.
- **The Explorer page binds both too** (`useSearchShortcut`), opening the same panel as its
  Search button. As in the editor, the chords stand down when the Keyboard Shortcuts setting is
  off, while focus is in a text field (the Explorer's filter box included), and while a dialog is open.

## Registry expansion

New commands join `buildEditorCommands`, each mapping 1:1 to an existing
editor handler (the non-negotiable rule of that registry — no behaviour
forks, no drifted telemetry):

- **History:** Undo, Redo — offered only when `canUndo` / `canRedo`.
- **View:** Toggle zen mode, Fit to screen.
- **Cleanup:** Auto Layout (one per style), Auto-align: their only home since the tab menu's
  Cleanup category was removed ([Layout cleanup](../008-canvas/layout-cleanup.md)).
- **Dialogs:** Export…, Import…, Settings, Keyboard shortcuts (opens
  Settings on its Keyboard category, [User preferences](user-preferences.md)), Browse templates.

## Read-only visitors

The registry previously returned nothing for read-only views. Now it returns
the **view-safe subset** (zen mode, fit to screen, export, Collaborators, and
the canvas tool switches that do not write to the document); mutating
commands and the Eraser and Format painter tools stay editor-only. `CommandContext` carries `isReadOnly` so the gating lives
in the pure builder where it's unit-tested.

## Unchanged on purpose

- Commands still match only on a **non-empty query**: an empty palette lists
  navigation results, not a catalogue whose first entry Enter would blindly
  run (some commands are destructive).
- Ordering: command results stay after navigation groups, so picking a tab
  or element by name keeps the default Enter.
- Telemetry: opening the panel and running commands keep their existing
  events; the underlying handlers own their own tracking, so no new events.
