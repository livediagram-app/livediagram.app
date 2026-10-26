# Toolbar layout

Status: shipped

## What

The editor's one panel layout, on every device (see "One layout"). Plan shows **no palette**
([Plan mode](../026-plan/plan-mode.md#no-palette)), so the editor shows no palette strip and no category bar: the menu
button keeps the top-left corner, and Undo/Redo, the Plan strip and zoom sit in the bottom-right cluster.

- **Top left: the menu button**, in a card with the tab's name. No mode switch sits there: every tab is in Plan
  ([Editor mode](editor-modes.md)).

## The tab's name

- On a desktop, the menu box (the Explorer button, top left) ends with the open tab's name, after a
  hairline, as a board's name rides there
  ([The name rides in the menu box](../026-plan/plan-board.md)). It is the chrome's ink, 14 px at regular weight (never bold), cut short
  with an ellipsis past 16rem, and follows a rename at once. The box shows a name alone, never an icon beside it.
- While a board, Sheet or view filling the tab (or maximised) has its own name in the box, that name shows instead,
  so the box never shows two.
- A click (a tap) on it renames the tab in place, for someone who may change the
  project's tabs: Enter or leaving saves, Escape puts it back; up to 60 characters.
- Every name in the box renames on a single click, whichever it is (the tab's, a board's, a Sheet's, a chart's, a
  Dashboard's): in the box a click has nothing else to do. In an element's own header a press moves the element, so
  there a double-click renames, as before.

## The Explorer and the other panels

There is no Explorer **panel** floating in a corner. A **menu button** (☰) in
the top-left corner of the canvas toggles the real Explorer open as a
popover hanging under it, and closed again. It starts closed on every page and is never
reopened from a remembered state; pressing the button is the only thing that opens it. A press
outside, Esc, the button again or opening an item closes it. The status screens (deleted,
couldn't load, not found) have no menu button and no Explorer. The popover hangs from the
button's left edge (`computeDockAnchor(..., 'button')`).

Layers and Collaborate open as **popovers over their bottom-row
buttons** ([Editor app](editor-app.md)): they are not corner panels. Every
other panel (AI, the minimap and the tool panels) docks in its corner
([Panel docking](panel-docking.md)). Layers and Collaborate render outside
the corner layer, since a popover positions against the canvas and a corner stack would move it.
A popover opening up from a bottom-row button (Layers, the Vote) grows no higher than 8 px under a
toolbar across the canvas's top whose span meets its column (`usePopoverTopClearance`, which watches the shared
palette strip's box), and 12 px from the canvas's top otherwise. Plan has no strip, so in liveplanner it is 12 px.

## One menu at a time

The Explorer popover, Layers and Collaborate are menus: opening one closes whichever other is open, and a press
anywhere outside closes it, in the capture phase (`dismissOnOutside`), so a control that stops `pointerdown` cannot
keep one open ([Editor app](editor-app.md)).

## One layout

There is no layout choice and no Floating layout: no `panelLayout` preference and no Panel Layout row in Settings
([User preferences](user-preferences.md)). A stored `panelLayout` value is ignored. The Explorer and Layers are not
corner panels, so a stored panel placement that names them (or the Palette) is ignored
([Panel docking](panel-docking.md)).

## On a phone

A phone is a viewport below `sm`, **or a touch screen under 500px tall** (one held sideways:
844 × 390 would be laid out as a desktop, its panels covering the 286px canvas).
`PHONE_MEDIA_QUERY` (`../packages/workbench/src/lib/responsive.ts`) and the `phone:` CSS variant (`app/globals.css`) state
that one query, so JS and CSS flip together; phone-only classes use `phone:`, not `max-sm:`. A
popover hanging below its button is capped to the canvas below it and scrolls, as one above its
button is. It gets the same chrome as a desktop ([Editor app](editor-app.md)):
panels in their corners, Layers and Collaborate as popovers over
their bottom-row buttons. What changes to fit the width:

- **Toolbar items keep their size** (`PHONE_TOOLBAR_ITEMS`, on the menu card and the bottom-right cluster): 36px
  items get a 44px-tall tap area ([Touch targets](../004-interface-design/touch-targets.md)), and their pickers give
  up 4px of side padding. The bottom-right cluster's buttons share the width left once the gutters, gaps and Fit are
  taken off (`PHONE_CLUSTER_BUTTON_WIDTH`, between 36px and 44px), so the row stays one row down to 375px.
- **A sideways scroller fades the edge with more beyond it** over 20px (`scroll-edge-fade.css`, a scroll-driven
  animation, used by the tab bar), so an item cut by the edge reads as "swipe for more"; an edge with nothing
  beyond it stays sharp. Where the browser has no scroll-driven animations it is off.
- **Zoom drops − and +** (`pinchOnly`), as on every phone ([Editor app](editor-app.md)). Fit
  stays.
- **Held sideways there is no menu button and no Explorer**, for every role, and nothing brings them back while
  the phone is sideways: the screen is too short for the Explorer to be any use. Turning the phone upright brings
  the button back ([A phone held sideways](editor-app.md#a-phone-held-sideways)).
- The minimap stays off ([Minimap](../008-canvas/minimap.md)).

## Layout details

- The menu card sits at `top-3 left-3`, at `z-toolbar` (`ToolbarExplorerButton`).
- **Messages are top-centre pills.** The messages that tell you what the next press does (a mode banner, such as
  "Select the board column you want this card to appear in") and the modifier hint (Shift, Alt) float at the
  top centre of the canvas. The shared palette tray (`PaletteTray` in `@liveworkspace/workbench`) hangs them from a
  palette strip where one is shown; Plan shows none.
  - One row: a leading icon (or the modifier's key chip), the message, then its actions as small text buttons at
    the end (**Cancel**, **Done**). On a phone (below `sm`) a message too long for the row wraps to a second line.
  - It fades in (`fade-in`; still under reduced motion) and goes when its message does.
  - While a mode banner shows, the top-centre stack (timer, vote) starts below it.
- Zen hides the menu button along with the rest of the chrome. Read-only sessions keep the menu button.

## Look

- **Sharp at 1x.** The corner panels are not promoted to their own compositing layer, which would cost sub-pixel
  text anti-aliasing on a 1x display, and the editor's glyphs are even-sized, so they centre on whole pixels.
- Dropdown-style controls sit on a faint tint so they read as menus beside plain buttons. The tint is the brand
  ramp, which follows the active tab's theme (`useEditorAccent`).

## Decided in review

- **Undo / Redo stay where they are**, in the bottom-right dock.
- **The menu button opens the Explorer**, not a menu of its own.
- **The other panels dock in their corners** ([Panel docking](panel-docking.md)). Layers
  and Collaborate are the exception, popovers over their bottom-row
  buttons.

## Help

The help centre has no Palette category; the Plan category (`/help/plan/`) explains the editor Plan shows.
