# UI scale

A user preference that makes the editor's working chrome (its panels, the
Palette toolbar and the bottom-right control cluster) bigger or smaller,
without touching anything else. It is for a reader who finds the dense
desktop chrome too small to read or hit (a large monitor far away, a
high-resolution laptop at 100%) or too large for the canvas they want to
see, and who does not want browser zoom, which also scales the canvas, the
dialogs and every other page.

## What scales

Exactly these surfaces, in every desktop layout:

- **Every panel**: each `MovablePanel`, floating, docked into a corner,
  dragged, or open as a popover (the Minimal layout's popovers, the Toolbar
  layout's Explorer, the Layers / Activity / Collaborate cluster popovers).
  That covers the Explorer, Palette, AI, Layers, Activity, Map, Collaborate
  and the session and tool panels.
- **The Quick Style panel** ([Quick style panel](../008-canvas/quick-style-panel.md)).
- **The Toolbar layout's strip** and its More popover ([Toolbar layout](toolbar-layout.md)),
  and that layout's top-left Explorer menu button.
- **The Minimal layout's button bar** in the top right.
- **The bottom-right cluster**: the Activity strip with Undo / Redo, the
  Layers and Collaborate buttons, the Theme & Canvas button, the Zoom
  controls and the off-screen content hint.

Nothing else scales: not the canvas or its elements (the canvas has its
own zoom), the tab bar and footer, the editor header, dialogs (Settings
included), context menus, tooltips and hover cards, toasts, the selection
toolbars that sit on elements, or the whiteboard dock. Menus and tooltips
opened FROM a scaled surface portal out of it, so they stay at their
design size too.

## The setting

- **Key** `uiScale` in `UserPreferences` ([User preferences](user-preferences.md)),
  a number: the factor every scaled surface is drawn at. Synced like every
  other preference.
- **Range** 80% to 150% in 5% steps; **default** 100% (missing key). Below
  80% the chrome's 10px labels drop under 8px and stop being readable; above
  150% the Palette and a corner stack of panels no longer fit a laptop
  screen.
- **Desktop only.** On a phone-sized viewport (below the `sm:` breakpoint)
  the chrome always draws at 100%: the phone layout is already sized to the
  screen, and a scaled panel would run off it. The stored value is left
  alone for the desktop.
- A stored value that is not a finite number reads as 100%; one outside the
  range is clamped into it; one between steps snaps to the nearest step.

## In Settings

A `slider` row in the **Appearance** category, after Theme:

- Label **UI Scale**, value shown as a percentage ("110%").
- Footnote: "Makes the panels, the Palette toolbar and the buttons in the
  bottom-right corner bigger or smaller. The canvas, dialogs and menus stay
  as they are."
- Desktop only (the row-level `desktopOnly` note, shown on a phone): "UI Scale
  is desktop only, so a phone always uses 100%. Your choice still applies on a
  larger screen." On a phone the slider is greyed and takes no input.
- Search keywords: "zoom size bigger smaller larger text font scale
  magnify chrome interface ui accessibility".
- Commits on release like Panel Opacity, so one drag is one write.
- Emits `UI` / `Changed` / `UiScale` on commit
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
  corner's panel stack clears the taller zoom cluster, the top corners clear
  the taller Toolbar strip, the strip fits fewer tiles before More, and a
  popover opened from a button stays inside the window at its scaled width.
