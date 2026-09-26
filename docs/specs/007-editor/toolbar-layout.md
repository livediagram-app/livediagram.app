# Toolbar layout

Status: shipped

## What

A third panel layout, next to **Floating** (the default) and **Minimal**
([Canvas and palette](../008-canvas/canvas-and-palette.md)). It works on a phone too (see "On a phone"). The Palette becomes a single horizontal strip pinned
to the top centre of the canvas, the way Excalidraw's tool bar works:

```
 ☰        ┌──────────────────────────────────────────────────────┐
 │        │ [↖ ▾] │ [Shapes ▾] │ □ ◇ ○ → ─ ✎ A ▤ … │ [⋯ ▾] │
 ▼        └──────────────────────────────────────────────────────┘
 Explorer            (Layers, Activity, zoom: the Floating bottom row)
```

- **Left: the selection mode.** The canvas-tool picker (Select / Hand /
  Eraser / Format / Laser / Spotlight / Avatar / Isometric / Zen, [Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md))
  as a compact icon trigger. It opens the same banded tile grid the Palette's
  header opens.
- **Then the category picker.** The same banded category grid ([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)),
  as a compact trigger showing the current category's glyph and name. It
  sits directly before the tiles it chooses, so it reads as their label.
- **Then the current category's first ten tiles**, icon-only, each with its
  tooltip, shortcut letter, drag-to-place, theme tint and pressed state. They
  are the same tiles as the Palette's (`palette-tile-defs`, [Palette Favourites](../010-palette/palette-favourites.md)),
  rendered by the same `PaletteTile`, so one change reaches both layouts.
- **Right: More (⋯ ▾)**, when the category has more than the strip shows.

## More: the rest of the category

A strip has room for about a dozen tiles. Shapes fits; Icons (~180),
Stickers, Technology and Behaviours do not. More opens the current
category's full Palette body in a popover hanging from the More button's own
right edge: search, group browser, Favourites Edit / Reorder, everything. It
is the exact node the floating Palette renders, not a copy. The popover is
wide (26rem) rather than tall, so a body rarely has to scroll. Picking a tile
from it closes it, so the canvas is clear to draw on; switching category
closes it too, since it was showing the old one.

More appears when the category has more than ten tiles, and always for
Favourites, Icons, Stickers, Technology and Behaviours, whose bodies carry
more than tiles (search, group browsing, Edit / Reorder). It sits outside the
animated tile rail, so it rides the rail's width change.

For Icons / Stickers / Technology the strip's ten are the first ten of the
catalogue in its own order, after any the user has used (below).

In the Favourites body, More shows no **Reorder / Edit** footer: the order
is by use (below), so a hand-made one would be overridden on the next use.
Its search results keep their favourite star, which is how a tile joins or
leaves Favourites from this layout. The Floating Palette's Favourites body is
unchanged.

## Tiles by use

Using a tile brings it to the **first slot** of the strip: it animates in
there, the others slide right one, and the tile pushed past the last slot
shrinks away and lives behind More until it is used again. Using a tile from
More that wasn't on the strip does the same.

- **One recently-used list** of tile ids, most recent first, across every
  category (`lib/toolbar-recent-tiles.ts`, capped at 40). Each category shows
  its used tiles first, in that order, then the rest in the category's own
  order. A tile used from another category, or not in this one, changes
  nothing here.
- **What counts as a use:** a click on a tile or a search-result row, Enter
  on a Favourites search, a drag that lands on the canvas (one dropped
  nowhere doesn't), and placing a glyph from the Icons / Stickers /
  Technology bodies. Keyboard shortcuts don't: they don't go through the
  strip.
- **Toolbar layout only.** It is not the Favourites list: the floating
  Palette and its Favourites order are untouched, and switching back finds
  them as they were.
- Per browser, in `localStorage` (`livediagram:v1:toolbar-recent-tiles`),
  like the palette's other UI state. Not synced.
- The More body for Favourites follows the same order, so the strip is
  always the first tiles of what More shows.

The chosen category lasts the page load: the strip is hidden rather than
unmounted while zen or the welcome flow hides the chrome. Nothing is stored,
so a new page load starts on Favourites.

## The Explorer and the other panels

There is no Explorer **panel** floating in a corner. A **menu button** (☰) in
the top-left corner of the canvas toggles the real Explorer open as a
popover hanging under it, and closed again. It goes through the dock's
popover path (`handleDockButtonClick` with the button passed as its own
anchor, `computeDockAnchor(..., 'button')`), so the popover hangs from the
button's left edge instead of tucking against the right like the dock's do.

Layers and Activity open as **popovers over their bottom-row buttons**, as
in Minimal ([Live app](live-app.md)): they are not corner panels here. Every other panel
(Collaborate, AI, the minimap, Poll, Vote and the tool panels) behaves exactly
as in **Floating**, docking in its corner. Layers and Activity render outside
the corner layer in this layout, since a popover positions against the
canvas and a corner stack would move it.

## One menu at a time

The strip's menus (selection mode, category, More) and the Explorer popover
are menus: opening one closes whichever other is open, and a press anywhere
outside closes it. The strip stops `pointerdown` from reaching the canvas, so
their outside-press listeners run in the capture phase, before that. The
Explorer popover gets the same (`dismissOnOutside`), and so do the Layers and
Activity popovers in every layout that has them ([Live app](live-app.md)). The Minimal dock's
top-right popovers on desktop deliberately don't. The strip's dropdown menus are kept
on screen sideways as well as vertically, whatever the trigger's position.

## The setting

`panelLayout?: 'floating' | 'minimal' | 'toolbar'` ([User preferences](user-preferences.md)), shown in
Settings → Appearance → Layout as a three-way **Panel Layout** choice. It
replaces the Minimal Panel Layout toggle.

- Missing → derived from the legacy `minimalPanels` flag, so nobody's layout
  changes when this ships.
- Writing it also writes `minimalPanels = layout === 'minimal'`, so any
  reader of the old flag (and an older client on another device) shows the
  toolbar layout as Floating, whose panels it keeps.
- Telemetry: `UI`/`Changed` with the layout picked in the type,
  `PanelLayoutFloating` / `PanelLayoutMinimal` / `PanelLayoutToolbar` (a
  choice row, [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), whether picked from the radios or the pictures.

## On a phone

Toolbar works below `sm` too, and a phone in Toolbar gets the desktop
chrome rather than the mobile dock ([Live app](live-app.md)): no top-right button bar, panels
in their corners, Layers and Activity as popovers over their bottom-row
buttons. Only
Floating is still desktop only; on a phone it falls back to the button bar,
and the Settings row greys it out ([User preferences](user-preferences.md)). What changes to fit the width:

- **The menu button moves into the strip**, at its far left, before the
  selection mode. There is no room for a corner button and a strip side by
  side, and the strip needs the whole top row.
- **The category picker is icon-only**, like the selection mode.
- **The tile count follows the width** (`phoneStripTileLimit`): whatever fits
  between 12px gutters once the menu button, the two pickers, More and the
  card's padding are paid for, at least three. Three on a 390px phone, four
  from about 410px. More holds the rest.
- **More spans the screen** between the gutters instead of hanging from its
  button.
- **Zoom drops − and +** (`pinchOnly`), as on every phone ([Live app](live-app.md)). Fit
  stays.
- Read-only visitors have no strip, so their menu button stays top-left.
- The minimap stays off, as in every phone layout ([Minimap](../008-canvas/minimap.md)).

## The setting's pictures

The Panel Layout row draws all three layouts side by side, the current one
ringed, so the difference is visible before switching ([User preferences](user-preferences.md)).

## Layout details

- The strip sits at `top-3`, centred, at `z-toolbar`. The top-centre stack
  (owner badge, mode banners, multi-select toolbar, timer, [Canvas and palette](../008-canvas/canvas-and-palette.md)) moves
  down to clear it.
- Event-storming boards ([Event storming](../021-event-storming/event-storming.md)) hide the Palette's header; the strip
  hides both its pickers the same way and shows the notation's tiles.
- Read-only sessions have no palette, so no strip. The menu button still
  shows.
- Zen hides the strip and the menu button along with the rest of the chrome.
- The editor tour ([Interactive editor tour ("Show me around")](editor-tour.md)) follows the layout: its Palette step rings the
  strip's card, and its Explorer step opens the Explorer from the menu button
  and rings both, with copy that names the button.

## Motion

- **A reorder animates** (`ToolbarStripRail`, FLIP): tiles that moved slide
  from their old slot to their new one over 200ms, a tile new to the strip
  pops in, and the one pushed off the end pops out where it stood. Reduced
  motion collapses it to instant.
- **Switching category animates.** The tile rail eases its width to the new
  set (the strip is centred, so it grows and shrinks evenly), the new tiles
  pop in a 22ms beat apart, and the outgoing ones shrink away on a layer over
  the top. Only a real switch animates; the first set is simply there.
  Reduced motion collapses it to instant (`ToolbarStripRail`).

## Look

- **Sharp at 1x.** Every tile glyph, in the strip and in the floating
  Palette, sits on a whole pixel. Three causes were found and removed:
  - The Palette's tile grid split its body into three fractional columns
    (76.67px), so every glyph straddled a pixel. It uses fixed, even 76px
    columns spread edge to edge instead.
  - The strip was centred with `-translate-x-1/2` and followed a
    text-width category label, both fractional. It is centred by flexbox,
    and `SnapWidth` rounds the label and the whole card to whole pixels (the
    card matching the canvas's parity so centring stays whole).
  - Thirteen-pixel glyphs (the Behaviour and mode icons) centred on a half
    pixel in an even tile. They are 14px.
    Separately, the floating panels were permanently promoted to their own
    compositing layer (a fix for isometric flicker), which costs sub-pixel text
    anti-aliasing on a 1x display. The promotion is now gated on an isometric
    scene being on the page. Tile captions went from 9px to 10px.

- The dropdown-style controls (selection mode, category, More) sit on a
  faint tint so
  they read as menus beside the plain tiles. The tint is the brand ramp,
  which follows the active tab's theme (`useEditorAccent`), so a Sunset tab
  tints them orange.

## Decided in review

- **The strip opens on Favourites every time**, like the floating Palette
  ([Palette Favourites](../010-palette/palette-favourites.md)). It does not remember the last category across diagrams.
- **Ten tiles is enough** on desktop: the strip does not adapt to the
  window width there. A phone's strip does (see "On a phone").
- **Undo / Redo stay where they are**, in the bottom-right dock.
- **The category picker stays on the bar**, left of the tiles. Folding it
  into More (a category list, then the category behind a BackBar) was tried
  and taken back out: it hid the current category and cost a click to
  switch.
- **The menu button opens the Explorer**, not a menu of its own (an earlier
  cut had New / Recent / Search / Settings entries).
- **The other panels follow Floating**, not Minimal: they dock in their
  corners rather than behind a top-right button bar. Layers and Activity are
  the exception, popovers over their bottom-row buttons as in Minimal.

## Help

The [Toolbar Layout](/help/palette/toolbar-layout/) article (Palette →
Palette Settings) explains the strip, More, the menu button and how it
fits a phone, with two figures. The Panel Layout settings row links to it, and it
links on to Minimal Panels.
