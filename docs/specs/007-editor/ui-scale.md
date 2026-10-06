# UI scale

A user preference that makes the editor's working chrome (its panels, the
Palette toolbar and the bottom-right control cluster) bigger or smaller,
without touching anything else. It is for a reader who finds the dense
desktop chrome too small to read or hit (a large monitor far away, a
high-resolution laptop at 100%) or too large for the canvas they want to
see, and who does not want browser zoom, which also scales the canvas, the
dialogs and every other page.

## What scales

Exactly these surfaces, in every desktop layout, in three **parts** that can
each be sized on their own (see "The setting"):

**Panels** (`panels`):

- **Every panel**: each `MovablePanel`, floating, docked into a corner,
  dragged, or open as a popover (the Toolbar layout's Explorer, the Layers /
  Collaborate cluster popovers).
  That covers the Explorer, Palette, AI, Layers, Map, Collaborate
  and the session and tool panels.
- **The Quick Style panel** ([Quick style panel](../008-canvas/quick-style-panel.md)).

**Toolbar** (`toolbar`):

- **The Toolbar layout's strip** ([Toolbar layout](toolbar-layout.md)) and that layout's
  top-left Explorer menu button. The strip's More popover does not scale: it is a menu opened
  from the strip, so it stays at its design size like every other menu (see below).

**Corner buttons** (`cornerButtons`):

- **The bottom-right cluster**: Undo / Redo, the
  Layers and Collaborate buttons, the Theme & Canvas button, the Zoom
  controls and the off-screen content hint.

Nothing else scales: not the canvas or its elements (the canvas has its
own zoom), the tab bar and footer, the editor header, dialogs (Settings
included), context menus, tooltips and hover cards, toasts, the selection
toolbars that sit on elements. (The Toolbar layout's Draw-mode dock is the strip's twin and
draws at the **toolbar** scale, its flyouts at design size; the Floating layout's Draw tools sit in the Palette panel and
scale with the panels.) Menus and tooltips
opened FROM a scaled surface portal out of it, so they stay at their
design size too.

## The setting

- **Keys** in `UserPreferences` ([User preferences](user-preferences.md)),
  each a number, synced like every other preference:
  - `uiScale`, the **master**: the factor every part is drawn at.
  - `uiScalePanels`, `uiScaleToolbar`, `uiScaleCornerButtons`: a part's own
    factor, overriding the master for that part alone. Missing = the part
    follows the master.
- **Setting the master sets everything**: it writes `uiScale` and clears all
  three part keys, so the master slider always means "every part at this
  size". Setting a part writes only that part's key.
- **Range** 80% to 120% in 5% steps; **default** 100% (missing key). The
  range is symmetric so 100% sits in the middle of the slider: making the
  chrome smaller to give the canvas room is wanted as much as making it
  bigger. 80% is the floor below which the chrome's small labels stop being
  readable.
- **The toolbar runs further and starts bigger.** Its own slider (Toolbar
  Scale) goes up to 140%, and its 100% draws the strip at what was 115%: at
  its design size the strip read small, and it is the chrome people most
  want bigger. The base applies when drawing, after the master or the part
  value is resolved, so the sliders and the stored numbers still read 100%;
  every percentage on the toolbar is 1.15 times its old size, including a
  value saved before the change (kept as stored, not converted). The master
  slider stays 80% to 120% and still sets the toolbar with everything else.
- **Desktop only.** On a phone-sized viewport (below the `sm:` breakpoint)
  the chrome always draws at 100%: the phone layout is already sized to the
  screen, and a scaled panel would run off it. The stored value is left
  alone for the desktop.
- A stored value that is not a finite number reads as 100%; one outside its
  slider's range is clamped into it; one between steps snaps to the nearest step. A
  part key holding junk reads as 100%, not as the master.

## In Settings

Four `slider` rows in the **Appearance** category, after Theme: the master,
then one per part nested beneath it (`parent: 'uiScale'`), each showing its
value as a percentage ("110%"):

| Row                  | Footnote                                                                                                                                                                                   | Event                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| UI Scale             | "Makes the panels, the toolbar and the buttons in the bottom-right corner bigger or smaller. The canvas, dialogs and menus stay as they are. Sets all three; adjust one on its own below." | `UiScale`              |
| Panel Scale          | "Every panel, floating or opened from a button, and the Quick Style panel."                                                                                                                | `UiScalePanels`        |
| Toolbar Scale        | "The Toolbar layout's strip and its menu button."                                                                                                                                          | `UiScaleToolbar`       |
| Corner Buttons Scale | "The buttons in the bottom-right corner: Undo and Redo, Layers, theme and zoom."                                                                                                           | `UiScaleCornerButtons` |

- A part's slider shows its own value, or the master's while it has none.
- Desktop only (each row's `desktopOnly` note, shown on a phone): "UI Scale
  is desktop only, so a phone always uses 100%. Your choice still applies on a
  larger screen." On a phone the sliders are greyed and take no input.
- Search keywords cover "zoom size bigger smaller scale" plus each part's
  own words (undo, zoom controls, layers for corner buttons; strip, button
  bar for the toolbar).
- **Live while dragged**: the chrome resizes as the thumb moves, so you can
  see the size you are choosing. The value is only a preview until release,
  which commits it like Panel Opacity, so one drag is one write; closing
  Settings mid-drag drops the preview and keeps the stored value.
- Emits `UI` / `Changed` / the row's event on commit
  ([Telemetry](../017-telemetry/telemetry.md)).

## Behaviour

- **The whole surface scales as one**, text, icons, padding, borders and
  hit targets together, the way browser zoom scales a page, so a scaled
  panel looks exactly like the 100% one, larger. This is done with the CSS
  `zoom` property on each surface's root; a root-font-size change was
  rejected because much of the chrome is sized in fixed pixels and would not
  move.
- **A surface stays where it is anchored.** Corner insets (a panel docked in
  the top right, the cluster's 16px from the corner) stay the same distance
  from the edge at every scale; a free-dragged panel stays at the screen
  position it was dropped at, and panel positions are stored in screen
  pixels, so changing the scale never moves a panel's top-left corner. A
  panel that grows past the window edge is clamped back by the same rule
  that rescues a panel dropped off-screen.
- **Applies live**: committing the slider re-draws every scaled surface
  immediately, with the Settings dialog still open over the canvas.
- **Drag, docking and snap guides** work at every scale: a dragged panel
  follows the pointer exactly, and corner snapping measures the panel at its
  scaled size.
- **What makes room for a scaled surface moves with it**: the bottom-right
  corner's panel stack clears the zoom cluster at the corner buttons' scale,
  the top corners clear the Toolbar strip at the toolbar's scale, the strip fits fewer tiles before More, and a
  popover opened from a button stays inside the window at its scaled width.
