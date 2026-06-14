# 42 — Canvas + Theme dialog

A focused modal for changing the active tab's **canvas style** and **theme**, reached from the canvas right-click menu. The same controls still live in the floating palette's Current Tab accordions ([spec/09](09-canvas-and-command-palette.md)); this dialog is a second, larger entry point that brings them front-and-centre when the user explicitly asks to change the canvas or theme.

## Why

The pattern grid, canvas/pattern colour pickers, opacity slider, and theme grid sit inside narrow side-panel accordions. They work, but they're cramped (a 3-wide theme grid, a flat list) and easy to miss. Right-clicking the canvas already offered **Change Canvas** / **Change Theme**, but those merely popped the matching accordion open in the side panel. This spec turns those two menu items into a proper modal so the controls get the room they deserve, and the theme picker can use the same category browse as the [New-diagram](14-new-diagram-route.md) "Pick a template" screen.

## Behaviour

- The empty-canvas right-click menu (`EditorContextMenu`, canvas mode) keeps its **Change Theme** and **Change Canvas** items. Picking either now opens **one** dialog (`CanvasThemeDialog`) on the matching tab:
  - **Change Canvas** → opens on the **Canvas** tab.
  - **Change Theme** → opens on the **Theme** tab.
- The dialog is titled **Tab Appearance** and has two tabs, **Canvas** and **Theme**, switchable from a tab strip below its header (a title + close row, consistent with the other editor dialogs). Opening on one tab does not prevent switching to the other.
- Every control applies **live** to the active tab (same setters as the accordions), so the canvas updates behind the dialog as the user clicks. There is no Apply/Cancel: the dialog is an editor, not a wizard. Closing (the X, Escape, or a backdrop click) just dismisses it; nothing is rolled back.
- The dialog is only reachable when the tab is editable. It is not offered on read-only / embed views (the right-click menu itself is suppressed there).

### Canvas tab

The canvas-style controls, identical to the palette's **Canvas** accordion (and sharing the exact component, `CanvasStyleControls`, so the two can never drift):

- **Pattern** — the pattern grid. The dialog has room to show **all fourteen** patterns at once (a 7-wide grid, no "Show more" toggle); the narrow palette accordion keeps the 4-wide grid with the toggle. ([spec/09](09-canvas-and-command-palette.md) lists the patterns.)
- **Colours** — Canvas colour + Pattern colour swatches.
- **Opacity** — the pattern-opacity slider with its percentage readout.

### Theme tab

The two-level **category browse** lifted from the New-diagram theme picker (`ThemeCategoryBrowser`, shared with [spec/14](14-new-diagram-route.md) so the two stay identical):

- Overview shows a **Basic** quick-pick plus a card per [`THEME_CATEGORIES`](14-new-diagram-route.md) bucket (Cool / Warm / Dark / Multi-colour). Clicking a category drills into its themes with an "All themes" back affordance.
- Clicking a theme applies it live; double-clicking applies and closes the dialog.
- A **Reset elements to theme** action (same as the accordion) recolours every element on the tab to the active theme's defaults.

## Telemetry

Opening the dialog fires `track('UI', 'Opened', 'CanvasStyle')` (Change Canvas) or `track('UI', 'Opened', 'ThemePicker')` (Change Theme). The underlying changes keep the existing `Canvas`/`Theme` events emitted by the tab-canvas setters ([spec/22](22-telemetry.md)); no new category/action is introduced.

## Reuse notes

- `CanvasStyleControls` — pattern grid + colour swatches + opacity slider. Rendered by both the palette's Canvas accordion and the dialog's Canvas tab.
- `ThemeCategoryBrowser` — the theme overview/drill-in. Rendered by both the New-diagram picker and the dialog's Theme tab.
- The dialog follows the existing modal contract (`Portal` + backdrop + `useEscape`, see `SettingsDialog`).
