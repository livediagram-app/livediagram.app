# Command palette (⌘K)

Make every editor action reachable by typing its name. This is **not a new
surface**: the global Search panel ([Canvas and palette](../008-canvas/canvas-and-palette.md) "Search panel") already has a
grouped, keyboard-navigable results list with an **Actions** group backed by
the command registry (`lib/editor-commands.ts`). This spec promotes that
Actions group into a full command palette by (a) binding the conventional
**Cmd/Ctrl+K** shortcut alongside the existing Cmd/Ctrl+., and (b) widening
the registry from selection/project verbs to the whole app surface.

## Shortcut

- **Cmd/Ctrl+K opens the Search panel**, identically to Cmd/Ctrl+. (both
  stay; `K` is the convention users arrive with, `.` is grandfathered).
  Works in zen mode and read-only views, like the existing binding.
- **The Explorer page binds the same two chords** to its own Search panel (`useSearchShortcut` in
  `@liveworkspace/explorer`), standing aside while the person is typing in a field and while a dialog
  is open, as the editor's chords do.

## Registry expansion

New commands join `buildEditorCommands`, each mapping 1:1 to an existing
editor handler (the non-negotiable rule of that registry — no behaviour
forks, no drifted telemetry):

- **History:** Undo, Redo — offered only when `canUndo` / `canRedo`.
- **Project and tab:** Create New Tab, Rename Tab, Rename Project, Delete Project, Share Project, Open Theme.
- **View:** Toggle zen mode, Collaborators.
- **Dialogs:** Export…, Import…, Settings, Keyboard shortcuts (opens
  Settings on its Keyboard category, [User preferences](user-preferences.md)).

Every command does something on a Board, Sheet, Dashboard or Form tab. The diagram editor's canvas verbs (the
selection's Delete, Duplicate, Lock and the rest, the canvas tools, Fit to Screen, Open Canvas Options, Auto Layout,
Auto-align and Renumber Steps) are not offered: a Plan tab's content covers the canvas, so they would do nothing.
For the same reason the Search panel has no **Add to canvas** group in the editor.

## Read-only visitors

The registry previously returned nothing for read-only views. Now it returns
the **view-safe subset** (zen mode, export and Collaborators); mutating
commands stay editor-only. `CommandContext` carries `isReadOnly` so the gating lives
in the pure builder where it's unit-tested.

## Unchanged on purpose

- Commands still match only on a **non-empty query**: an empty palette lists
  navigation results, not a catalogue whose first entry Enter would blindly
  run (some commands are destructive).
- Ordering: command results stay after navigation groups, so picking a tab
  or element by name keeps the default Enter.
- Telemetry: opening the panel and running commands keep their existing
  events; the underlying handlers own their own tracking, so no new events.
