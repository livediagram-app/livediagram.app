# 148 — Toolbar layout

Status: shipped

## What

A third desktop panel layout, next to **Floating** (the default) and
**Minimal** (spec/09). The Palette becomes a single horizontal strip pinned
to the top centre of the canvas, the way Excalidraw's tool bar works:

```
 ☰        ┌──────────────────────────────────────────────────────┐
 │        │ [↖ ▾] │ [Shapes ▾] │ □ ◇ ○ → ─ ✎ A ▤ … │ [⋯ ▾] │
 ▼        └──────────────────────────────────────────────────────┘
 Explorer            (Layers, Activity, zoom: the Floating bottom row)
```

- **Left: the selection mode.** The canvas-tool picker (Select / Hand /
  Eraser / Format / Laser / Spotlight / Avatar / Isometric / Zen, spec/108)
  as a compact icon trigger. It opens the same banded tile grid the Palette's
  header opens.
- **Then the category picker.** The same banded category grid (spec/110),
  as a compact trigger showing the current category's glyph and name. It
  sits directly before the tiles it chooses, so it reads as their label.
- **Then the current category's first ten tiles**, icon-only, each with its
  tooltip, shortcut letter, drag-to-place, theme tint and pressed state. They
  are the same tiles as the Palette's (`palette-tile-defs`, spec/78),
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
catalogue in its own order: a placeholder until usage says which ones people
reach for.

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

Every other panel (Layers, Activity, Collaborate, AI, the minimap, Poll,
Vote and the tool panels) behaves exactly as in **Floating**: they dock in
their corners, and Layers is a button in the bottom row that toggles its
panel open and minimised. Toolbar is Floating with the Palette and Explorer
swapped out, not a variant of Minimal.

## The setting

`panelLayout?: 'floating' | 'minimal' | 'toolbar'` (spec/20), shown in
Settings → Appearance → Layout as a three-way **Panel Layout** choice. It
replaces the Minimal Panel Layout toggle.

- Missing → derived from the legacy `minimalPanels` flag, so nobody's layout
  changes when this ships.
- Writing it also writes `minimalPanels = layout === 'minimal'`, so any
  reader of the old flag (and an older client on another device) shows the
  toolbar layout as Floating, whose panels it keeps.
- Telemetry: `UI`/`Changed`/`PanelLayout` (a choice row, spec/22).

## Desktop only

Below `sm` the toolbar layout falls back to the mobile dock, the same rule
as the other two: mobile is always docked. A strip of ten 36px tiles does not
fit a phone. So on a phone-sized viewport the Settings row greys out Floating
and Toolbar and says they are desktop only (spec/20).

## The setting's pictures

The Panel Layout row draws all three layouts side by side, the current one
ringed, so the difference is visible before switching (spec/20).

## Layout details

- The strip sits at `top-3`, centred, at `z-toolbar`. The top-centre stack
  (owner badge, mode banners, multi-select toolbar, timer, spec/09) moves
  down to clear it.
- Event-storming boards (spec/139) hide the Palette's header; the strip
  hides both its pickers the same way and shows the notation's tiles.
- Read-only sessions have no palette, so no strip. The menu button still
  shows.
- Zen hides the strip and the menu button along with the rest of the chrome.

## Motion

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
  (spec/78). It does not remember the last category across diagrams.
- **Ten tiles is enough.** The strip does not adapt to the window width.
- **Undo / Redo stay where they are**, in the bottom-right dock.
- **The category picker stays on the bar**, left of the tiles. Folding it
  into More (a category list, then the category behind a BackBar) was tried
  and taken back out: it hid the current category and cost a click to
  switch.
- **The menu button opens the Explorer**, not a menu of its own (an earlier
  cut had New / Recent / Search / Settings entries).
- **The other panels follow Floating**, not Minimal: Layers is a bottom-row
  button that toggles its panel, rather than a top-right dock popover.

## Help

The [Toolbar Layout](/help/palette/toolbar-layout/) article (Palette →
Palette Settings) explains the strip, More, the menu button and the phone
fallback, with two figures. The Panel Layout settings row links to it, and it
links on to Minimal Panels.
