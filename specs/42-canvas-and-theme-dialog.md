# 42 — Canvas + Theme dialog

A focused modal for changing the active tab's **canvas style** and **theme**, reached from the canvas right-click menu. The same controls still live in the floating palette's Current Tab accordions ([spec/09](09-canvas-and-palette.md)); this dialog is a second, larger entry point that brings them front-and-centre when the user explicitly asks to change the canvas or theme.

## Why

The pattern grid, canvas/pattern colour pickers, opacity slider, and theme grid sit inside narrow side-panel accordions. They work, but they're cramped (a 3-wide theme grid, a flat list) and easy to miss. Right-clicking the canvas already offered **Change Canvas** / **Change Theme**, but those merely popped the matching accordion open in the side panel. This spec turns those two menu items into a proper modal so the controls get the room they deserve, and the theme picker can use the same category browse as the [New-diagram](14-new-diagram-route.md) "Pick a template" screen.

## Behaviour

- The empty-canvas right-click menu (`EditorContextMenu`, canvas mode) keeps its **Change Theme** and **Change Canvas** items. Picking either now opens **one** dialog (`CanvasThemeDialog`) on the matching tab:
  - **Change Canvas** → opens on the **Canvas** tab.
  - **Change Theme** → opens on the **Theme** tab.
- A **paintbrush dock button** ("Theme & Canvas") sits in the bottom-right chrome cluster, to the right of the collapsed Layers dock, and opens the same dialog on the **Theme** tab — a one-click, always-visible entry beside right-click. Desktop editor sessions only: it is hidden on mobile (the canvas menu covers it there), in zen mode, and in read-only / embed views.
- The dialog is titled **Tab Appearance** and has two tabs, **Canvas** and **Theme**, switchable from a tab strip below its header (a title + close row, consistent with the other editor dialogs). Opening on one tab does not prevent switching to the other.
- Every control applies **live** to the active tab (same setters as the accordions), so the canvas updates behind the dialog as the user clicks. There is no Apply/Cancel: the dialog is an editor, not a wizard. Closing (the X, Escape, or a backdrop click) just dismisses it; nothing is rolled back.
- The dialog is only reachable when the tab is editable. It is not offered on read-only / embed views (the right-click menu itself is suppressed there).

### Canvas tab

The canvas-style controls, identical to the palette's **Canvas** accordion (and sharing the exact component, `CanvasStyleControls`, so the two can never drift):

- **Pattern** — the pattern grid. The dialog has room to show **all** patterns at once (a 7-wide grid, no "Show more" toggle); the narrow palette accordion keeps the 4-wide grid with the toggle. ([spec/09](09-canvas-and-palette.md) lists the patterns.)
- **Colours** — Canvas colour + Pattern colour swatches.
- **Opacity** — the pattern-opacity slider with its percentage readout.
- **Size** — the pattern-size slider (50%–200%, default 100%) with its percentage readout, directly under Opacity. Writes `backgroundPatternScale` on the tab; `tabBackgroundStyle` multiplies every tile's `background-size` by it (never the pan phase, so the pattern still tracks panning at any size). Blank has no tile, so the slider is a no-op there.

### Theme tab

The two-level **category browse** lifted from the New-diagram theme picker (`ThemeCategoryBrowser`, shared with [spec/14](14-new-diagram-route.md) so the two stay identical):

- Overview shows a **Basic** quick-pick plus a card per [`THEME_CATEGORIES`](14-new-diagram-route.md) bucket (Cool / Warm / Dark / Multi-colour / Formal), plus a **Custom** category for the owner's saved themes ([spec/44](44-custom-themes.md)). Clicking a category drills into its themes with an "All themes" back affordance.
- Clicking a theme applies it live; double-clicking applies and closes the dialog.
- A **Reset elements to theme** action (same as the accordion) recolours every element on the tab to the active theme's defaults.

**Arrows always track the theme.** Picking a theme keeps the per-field
preserve-customs rule for shapes / text (a colour the user hand-set survives the
switch), but **arrows are the one exception**: every arrow's stroke is always
reset to the new theme's stroke, even if it was custom-coloured. A theme switch
that left hand-coloured connectors on the old hue read as broken, so
`setTheme` runs `resetArrowsToTheme` on top of `switchThemeElements`. It's
palette-aware (each arrow snaps to its branch's stroke), reusing the same
per-element resolution every theme transform uses.

### Formal themes / per-shape colours

Most themes paint every shape the same fill / stroke / text. A **Formal** theme instead colours each shape **kind** by its conventional meaning, so a diagram reads as a standard notation at a glance.

- **UML** is the first Formal theme. Each `ShapeKind` carries its own colours: a decision **diamond** is amber, a datastore **cylinder** is purple, a start/end **stadium** is green, a process **square** is blue, and so on. Kinds without a specific colour fall back to the theme's crisp dark-on-light box. The canvas is plain white so the colour coding (not the backdrop) carries the meaning.
- Mechanically, a theme may define `shapeColors?: Partial<Record<ShapeKind, { fill?; stroke?; text? }>>`. These win over the single `elementFill` / `-Stroke` / `-Text` for that kind; unset fields fall through. Resolution flows through the same `elementThemeView` synthetic-theme path the multi-colour ([spec/29](29-multicolour-themes.md)) branch colours use, so every theme transform (apply to new shapes, recolour a scaffold, switch themes, reset to theme) is shape-aware through one code path. A theme can in principle combine `shapeColors` with a `palette`, but in practice per-shape (UML) and per-branch (rainbow) themes are distinct.
- The theme card preview (`ThemeSwatch`) stripes a per-shape theme's kind colours, like it does a multi-colour palette, so the card reads as colourful rather than as one neutral dot.

## Editor chrome follows the active theme

The editor chrome **follows the active tab's theme** so it matches the diagram you're editing, in two ways. Both the brand accent and the neutral slate surfaces are Tailwind v4 CSS variables (`--color-brand-50..950`, `--color-slate-*`), so `useEditorAccent` retargets those variables for the editor session by injecting one `<style>` element:

- **Accent (both modes).** The active theme's accent (its `elementStroke`) is spun into an 11-stop ramp anchored at `600` (a pale dark-theme stroke is darkened first so white-on-`600` keeps contrast) and emitted as `:root { --color-brand-* }`, so every `brand-*` utility — buttons, rings, focus outlines — takes the theme colour.
- **Dark mode (a darker version of the theme).** Plain dark mode was cold slate / near-black. The hook also emits `.dark { --color-slate-600..950 }`, a muted-then-shaded ramp of the theme hue (the accent pulled toward neutral slate so it's a tint, not a garish saturated dark), so dark-mode panels / borders / deep backgrounds read as a dark version of the chosen theme. Only the surface stops (600–950) are retargeted; the lighter stops stay neutral so dark-mode text keeps its readable greys. The override is `.dark`-scoped, so CSS handles the mode switch with no JS detection.
- The `<style>` lives in `<head>` so body-portaled UI (context menus, dialogs, popovers, toasts) inherits both. The default **Basic** (`brand`) theme and an unthemed tab have no `elementStroke`, so nothing is injected: the built-in light-blue brand + cold-slate dark stand. Switching tabs re-resolves it; leaving the editor removes the `<style>` so the rest of the app (Explorer, marketing) keeps the defaults.
- Only the chrome retargets — element colours come from the theme applied to the elements themselves ([spec/29](29-multicolour-themes.md)), unaffected.

## Telemetry

Opening the dialog fires `track('UI', 'Opened', 'CanvasStyle')` (Change Canvas) or `track('UI', 'Opened', 'ThemePicker')` (Change Theme). The underlying changes keep the existing `Canvas`/`Theme` events emitted by the tab-canvas setters ([spec/22](22-telemetry.md)); no new category/action is introduced.

## Reuse notes

- `CanvasStyleControls` — pattern grid + colour swatches + opacity slider. Rendered by both the palette's Canvas accordion and the dialog's Canvas tab.
- `ThemeCategoryBrowser` — the theme overview/drill-in. Rendered by both the New-diagram picker and the dialog's Theme tab.
- The dialog follows the existing modal contract (`Portal` + `useEscape` + a full-screen click-catcher, see `SettingsDialog`) — but with **no dimming / blur backdrop**: because every control applies live, the catcher is left transparent so the user can watch the canvas background + theme update behind the dialog as they click. The catcher still closes on an outside click and swallows pointer / right-click events so an edit doesn't leak to the canvas while it's open.
