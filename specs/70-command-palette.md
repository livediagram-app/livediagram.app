# 70 — Command palette (⌘K)

Make every editor action reachable by typing its name. This is **not a new
surface**: the global Search panel (spec/09 "Search panel") already has a
grouped, keyboard-navigable results list with an **Actions** group backed by
the command registry (`lib/editor-commands.ts`). This spec promotes that
Actions group into a full command palette by (a) binding the conventional
**Cmd/Ctrl+K** shortcut alongside the existing Cmd/Ctrl+., and (b) widening
the registry from selection/diagram verbs to the whole app surface.

## Shortcut

- **Cmd/Ctrl+K opens the Search panel**, identically to Cmd/Ctrl+. (both
  stay; `K` is the convention users arrive with, `.` is grandfathered).
  Works in zen mode and read-only views, like the existing binding.

## Registry expansion

New commands join `buildEditorCommands`, each mapping 1:1 to an existing
editor handler (the non-negotiable rule of that registry — no behaviour
forks, no drifted telemetry):

- **History:** Undo, Redo — offered only when `canUndo` / `canRedo`.
- **View:** Toggle zen mode, Fit to screen.
- **Cleanup:** Auto Layout, Auto-align (the tab menu's Cleanup band,
  [spec/47](47-layout-cleanup.md)).
- **Dialogs:** Export…, Import…, Settings, Keyboard shortcuts, Browse
  templates.

## Read-only visitors

The registry previously returned nothing for read-only views. Now it returns
the **view-safe subset** (zen mode, fit to screen, export); mutating commands
stay editor-only. `CommandContext` carries `isReadOnly` so the gating lives
in the pure builder where it's unit-tested.

## Unchanged on purpose

- Commands still match only on a **non-empty query**: an empty palette lists
  navigation results, not a catalogue whose first entry Enter would blindly
  run (some commands are destructive).
- Ordering: command results stay after navigation groups, so picking a tab
  or element by name keeps the default Enter.
- Telemetry: opening the panel and running commands keep their existing
  events; the underlying handlers own their own tracking, so no new events.
