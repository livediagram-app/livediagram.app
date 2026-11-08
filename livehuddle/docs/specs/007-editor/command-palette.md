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
  Works in read-only views, like the existing binding.
- **The Explorer page binds the same two chords** to its own Search panel (`useSearchShortcut` in
  `@liveworkspace/explorer`), standing aside while the person is typing in a field and while a dialog
  is open, as the editor's chords do.

## Registry expansion

New commands join `buildEditorCommands`, each mapping 1:1 to an existing
editor handler (the non-negotiable rule of that registry: no behaviour
forks, no drifted telemetry):

- **History:** Undo, Redo, offered only when `canUndo` / `canRedo`, and not while walking ([Avatar mode](../008-canvas/avatar-mode.md#no-editing-chrome-while-walking)).
- **View:** Fit to screen.
- **Edit and Walk** (`tool:select`, `tool:avatar`): the two sides of the
  [Edit | Walk toggle](../008-canvas/avatar-mode.md#the-edit--walk-toggle), the one not in force. There are no other
  tool commands: Hand, Eraser and Format Painter left with the Selection Mode picker (owner, 2026-11-06); the Format
  Painter is the selection toolbar's.
- **Cleanup:** Auto-align (Auto Layout's commands left livehuddle in Work Tracker #423 part 4): its one home,
  as the tab menu has no Cleanup category and livehuddle has no Tidy Up button ([Layout cleanup](../008-canvas/layout-cleanup.md)); Renumber Steps, while the tab
  holds a step number ([The step number](../009-elements/step-number.md)).
- **Dialogs:** Export…, Import…, Settings, Keyboard shortcuts (opens
  Settings on its Keyboard category, [User preferences](user-preferences.md)), Browse templates.

## Read-only visitors

The registry previously returned nothing for read-only views. Now it returns
the **view-safe subset** (fit to screen, export, Collaborators, and
Edit and Walk); mutating commands stay editor-only. `CommandContext` carries `isReadOnly` so the gating lives
in the pure builder where it's unit-tested.

## Unchanged on purpose

- Commands still match only on a **non-empty query**: an empty palette lists
  navigation results, not a catalogue whose first entry Enter would blindly
  run (some commands are destructive).
- Ordering: command results stay after navigation groups, so picking a tab
  or element by name keeps the default Enter.
- Telemetry: opening the panel and running commands keep their existing
  events; the underlying handlers own their own tracking, so no new events.
