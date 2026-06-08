# Zen mode

A distraction-free **focus mode** for the editor: hide every piece of
floating chrome so only the canvas content remains, for reading, sharing
a screen, or thinking without the toolbars in the way.

## What it does

When zen mode is on, the editor hides:

- the editor header (top bar),
- the tab bar,
- the command palette (tools + add-element), the context / inspector
  panel, the Explorer, the Activity panel, the comments panel, the AI
  panel, the mobile dock, and the owner / role status badge,
- the empty-canvas prompt and the undo/redo history dock.

What stays:

- the **canvas and its content** (elements, alignment guides, laser
  trails, remote cursors, selection — interaction is unaffected),
- the **zoom controls** (bottom-right), so the user can still zoom / fit,
- an **exit-zen control next to the zoom controls** so there's always a
  visible way out.

Zen mode is purely a view state. It changes nothing about the diagram,
never persists to the server, and is not synced to other participants —
each viewer focuses independently. It is available to everyone, including
view-only visitors (focusing is read-only).

## How it's toggled

- **Enter:** a button on the right of the Pan / Select / **Laser** tool
  row in the command palette, using a fullscreen / expand icon.
- **Exit:** the control next to the zoom controls (a compress icon),
  shown only while zen mode is active (the palette that holds the enter
  button is itself hidden in zen mode, so exit has to live somewhere that
  stays visible).
- **Keyboard:** `Z` toggles it on and off; `Escape` exits when active.
  The binding obeys the per-device keyboard-shortcuts toggle and the
  usual text-input / label-edit bailouts (so typing a `z` into a label
  never flips the mode). Listed in the shortcuts dialog under Tools.

## Telemetry

Flipping zen mode emits `UI / Toggled / ZenModeOn` and
`UI / Toggled / ZenModeOff` (spec/22), the same shape as the dark-mode
and minimal-panel toggles.

## Implementation notes

- State lives in `usePanelLayout` (`zenMode` / `setZenMode`) — it's pure
  UI chrome state with no diagram coupling, alongside the other panel
  visibility flags. `useEditorState` wraps it in `toggleZenMode` (adds
  the telemetry) and exposes that to the keyboard hook, the palette enter
  button, and the zoom-dock exit button.
- The chrome is hidden by the same gates that already hide it during the
  welcome flow — each `welcomeOpen ? null` / `welcomeOpen || readOnly`
  guard in `CanvasChrome` also checks `zenMode`. The header + tab bar are
  hidden in `EditorView`.
- Not a `CanvasTool` (Pan / Select / Laser are mutually-exclusive cursor
  modes); zen mode is an orthogonal visibility flag, so it sits beside
  the tool row rather than inside the tool group.

See also [spec/07](07-live-app.md) (editor chrome) and
[spec/09](09-canvas-and-command-palette.md) (palette tool row + shortcuts).
