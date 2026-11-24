# Magnifier

Status: **implemented** (Work Tracker 1403).

A selection mode that puts a **lens** on the cursor: a square (or round) window that moves with the pointer and
shows the live canvas under it enlarged. The whole tab stays on screen at its own zoom; only what is under the lens
grows. A view aid, like [Isometric view](isometric-view.md): it changes nothing in the document and nothing anyone
else sees.

## Why

On a big diagram, finding what is where means zooming in, looking, and zooming back out, losing the overview each
time. A lens over the cursor shows the detail in place while the whole map stays where it is: read a box's label,
check an arrow's end, peer into a dense cluster, without a single zoom.

## Where it lives

- **A selection mode** (`'magnifier'`, `SELECTION_MODES` in `packages/document`), in the mode picker's **Preview**
  group, just before Isometric: Preview is the group of ways to look at the tab without editing it.
  - Its row: a magnifying glass with a plus (`MODE_GLYPHS.magnifier`), the label **Magnifier**, the shortcut **`M`**.
  - Its tooltip (the Mode button's hover card and the help): "Enlarge what is under the cursor without zooming."
- **Greyed out on an empty canvas**, as every mode that acts on existing content is.
- **On a computer and a phone alike.** Touch has no hover, so a finger drag moves the lens (below).
- **In the command palette** as `tool:magnifier` ("Magnifier"), gated exactly as the dropdown.
- **On a Mode Button** ([Selection Mode button](../009-elements/mode-button.md)): a button can hand out Magnifier
  wherever it can hand out Isometric, and the palette's Behaviour group has a Magnifier button tile beside the
  Isometric one.
- **Escape**, or picking any other mode, leaves it: Escape lands on Select on a computer and Hand on a phone, as it
  does from Isometric.

## The lens

- **Centred on the pointer** and moving with it, one frame behind at most. It shows the canvas exactly as it is
  drawn under it (elements, arrows, labels, pictures), enlarged around the point under the pointer, so that point
  stays put and everything round it spreads out.
- **Square by default**, with gently rounded corners; or **round**, from the settings.
- **A clear edge**: a white ring (slate in dark mode), a hairline outline and a soft drop shadow, so the lens reads as
  a pane of glass over the canvas rather than part of the drawing. A small crosshair marks the exact point under the
  pointer, and the canvas cursor is hidden while the lens shows it.
- **The canvas background shows through**: the lens is painted in the tab's canvas colour, so a lens over empty
  space reads as canvas, not as a hole.
- **Hidden off the canvas**: when the pointer leaves the canvas, or moves over a panel, the palette, a menu or any
  other chrome, the lens hides, and the normal cursor comes back. It returns the moment the pointer is back over the
  canvas.
- **Live**: an edit made by anyone while the lens is up (a collaborator moving a box, a new arrow) shows in the lens
  within a quarter of a second.
- **Not drawn into anything else**: not into exports, thumbnails, the Map, presenting or a peer's view. It exists
  only on the screen of the person using it.

## Moving around in it

- **Mouse and trackpad: drag pans**, as with Hand. The lens keeps showing what is under the pointer while the
  canvas moves.
- **The scroll wheel changes the magnification** while the lens is up: scrolling up enlarges more, down less, within
  the range. **Shift+scroll changes the lens size.** A small badge in the lens shows the new value for a moment.
- **Pinch, or Ctrl/Cmd+scroll, still zooms the canvas** itself, so the whole map can be zoomed as ever.
- **Touch: the lens follows a finger drag.** A finger down on the canvas shows the lens and it follows the finger;
  lifting the finger hides it. On touch the lens sits **above the finger** (its bottom edge a little over the
  fingertip, flipping below when there is no room above), so the finger never covers what it is magnifying. The
  crosshair still marks the point under the fingertip. A finger drag does not pan in this mode: two fingers pinch and
  pan as always, and Hand is one tap away.
- **No presses act on elements.** Like Isometric, Spotlight and Laser, the elements layer ignores presses: nothing is
  selected, moved or edited, and entering Magnifier clears the selection, so no handles or toolbars sit under the
  lens. A Mode Button stays pressable, so a presenter's control bar still works. The canvas and tab menus are not
  offered (a right-click or a long press does nothing), and a double-tap does not zoom.

## Settings

Sensible settings, remembered for the person on this device:

- **Magnification**: 1.5x to 6x, **2x** by default, in half steps from the slider; the scroll wheel moves it in
  finer steps (one decimal).
- **Size**: **Small** (160px), **Medium** (240px, the default) or **Large** (360px); Shift+scroll sizes it freely
  between 120px and 480px, and the row then reads **Custom**, as Spotlight's does.
- **Shape**: **Square** (the default) or **Round**.

### The settings popover

- **The mode's control**: while Magnifier is on, a **Magnifier** button joins the bottom-right cluster (beside the
  zoom controls), showing the magnifier glyph and the current magnification ("2x"). Pressing it opens the settings
  as a small popover above it, the way Tidy Up's does; pressing it again, Escape, or a press outside closes it.
  Leaving Magnifier closes it and takes the button away.
- **In the popover**, under the title "Magnifier": the **Magnification** slider with its value, the **Size** choice
  (Small / Medium / Large, with Custom shown when Shift+scroll left it between), the **Shape** choice (Square /
  Round), and one quiet hint line: "Scroll to change magnification. Shift+scroll to change size." (on a phone: "Drag
  a finger to move the lens."). A help link opens the article.
- A change applies to the lens at once.

### Persistence

Device-local, in `localStorage` (`livediagram:v2:magnifier-config`), like the Spotlight and Laser settings
([Spotlight Panel](spotlight-panel.md) "Persistence"): how big a lens you want depends on your screen. Never sent to
the api, never in the synced preferences. A stored value out of range is clamped; a broken one reads as the defaults.

## Share roles

Magnifier changes nothing in the document, so it is everyone's ([Share roles](../013-workspace/share-roles.md)):

- **Editor**: picks it from the mode picker, `M`, the command palette or a Mode Button.
- **Participant**: the same; it is in the Participant's set of modes (`PARTICIPANT_CANVAS_TOOLS`).
- **Viewer**: no palette, so `M`, the command palette and a Mode Button reach it; it is a view-safe key and a
  non-mutating command.

## Performance

- **No canvas re-render per pointer move.** The lens holds a copy of the canvas's drawn layer, made once when the
  mode starts and again when the tab's elements change (at most four times a second, and only while the lens is
  up). A pointer move only moves two transforms, once per frame; React renders nothing for it.
- **Settings changes re-render only the lens and its button**, never the canvas: the wheel can fire dozens of times
  a second.
- Embedded frames and videos are left out of the copy (it would load them a second time); a still box stands in for
  each.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): entering the mode emits
`Canvas·Used·Magnifier` (any entry point: picker, key, command palette, Mode Button). Changing a setting emits
`UI·Changed·MagnifierZoom` / `MagnifierSize` / `MagnifierShape`, once per gesture: a scroll or a slider drag that
settles counts once (debounced about 800ms). The dashboard counts Magnifier among the Canvas Modes and its settings
among the Mode Options.

## Out of scope

- Magnifying the chrome (panels, the palette): the lens is for the canvas.
- Showing the lens to the room. Like Spotlight, it is a view aid for the person using it.
- Editing through the lens.
