# Toolbar layout

Status: shipped

## What

One of the two panel layouts, next to **Floating** (the desktop default,
[Canvas and palette](../008-canvas/canvas-and-palette.md)). It is the only layout on a phone (see "On a phone"). The Palette becomes a single horizontal strip pinned
to the top centre of the canvas, the way Excalidraw's tool bar works:

```
 ☰ ⬡|✎   ┌──────────────────────────────────────────────────────┐
 │        │ [↖ ▾] │ [Shapes ▾] │ □ ◇ ○ → ─ ✎ A ▤ … │ [⋯ ▾] │
 ▼        └──────────────────────────────────────────────────────┘
 Explorer            (Undo/Redo, Layers, zoom: the Floating bottom row)
```

- **Top left, before the strip: the menu button and the editor mode
  switch** ([The mode switch](editor-modes.md#the-mode-switch)), in one card.
  On a phone that card sits at the far left of the strip's row, the strip beside it (below).
- **Left: the selection mode.** The canvas-tool picker (Select / Hand /
  Eraser / Format / Laser / Spotlight / Avatar / Isometric / Zen, [Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md))
  as a compact icon trigger. It opens the same banded tile grid the Palette's
  header opens.
- **Then the category picker.** The same banded category grid ([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)),
  as a compact trigger showing the current category's glyph and name. It
  sits directly before the tiles it chooses, so it reads as their label.
- **Then the current category's first twelve tiles** (fewer on a narrow window, see "Decided in review"), icon-only, each with its
  hover card, shortcut letter, drag-to-place, theme tint and pressed state. They
  are the same tiles as the Palette's (`palette-tile-defs`, arranged by the mode's palette layout, [Editor modes](editor-modes.md#the-palette-per-mode)),
  rendered by the same `PaletteTile`, so one change reaches both layouts.
- **Right: More (⋯ ▾)**, when the category has more than the strip shows.

## More: the rest of the category

A strip has room for about a dozen tiles. Shapes fits; Icons (~180),
Stickers, Technology and Collaborate do not. More opens the current
category's full Palette body in a popover hanging from the More button's own
right edge: search, group browser, everything. It
is the exact node the floating Palette renders, not a copy. The popover is
wide (26rem) rather than tall, so a body rarely has to scroll. Picking a tile
from it closes it, so the canvas is clear to draw on; switching category
closes it too, since it was showing the old one. Opening it focuses the body's
search field, when the category has one, so typing filters straight away (a category that loads
its catalogue a moment later focuses the field as soon as it appears); on a phone it does not,
because focusing would raise the keyboard over the popover.

More appears when the category has more than twelve tiles, and always for
Icons, Stickers, Technology and Collaborate, whose bodies carry
more than tiles (search, group browsing). It sits outside the
animated tile rail, so it rides the rail's width change.

For Icons / Stickers / Technology the strip's twelve are the first twelve of the
catalogue in its own order.

## The strip's order and dividers

The strip shows a category **in its own order**, always: the first tiles that fit, the rest behind
More. **Using a tile never reorders it** (an earlier version brought each used tile to the front,
which moved things under the pointer after every add; it is gone, its stored list with it).

**Fixed dividers** split a category into its groups of related tiles (a tile's `dividerAfter`):

- **Shapes**: the basics (Square, Circle, Diamond) | the flowchart shapes (Cylinder to Stadium) |
  the rest (Cloud to Bubble).
- **Write**: Page, Text | Note, Annotation.
- **Draw**: Freehand, Shape Pen | Polygon | Arrow, Line.
- **Build**: Mind node, Table | Lane, Frame, Timeline.
- **Components**: the cards (Code, Checklist, Entity) | the website blocks.
- **Devices**: desktop (Browser, Monitor, Laptop) | mobile (Phone, Tablet, Foldable, Watch).
- **Media**: Image | the embeds | Avatar.
- **Data**: the charts (Pie, Bar, Line, Legend) | the meters (Progress, Donut, Rating).
- **Behaviour**: the Selection Mode buttons | everything else.
- **Event Storming**: the notation | Hotspot.

Popular divides where its tiles' own groups do (after the Diamond), and the Icons / Stickers /
Technology catalogues have none. A category
has two at most. A divider shows only between two tiles both on the strip. They take room, about
a fifth of a tile each: a category that fits whole with them shows them; one whose tiles fit only
without them drops them before any tile; one that overflows shows as many tiles as fit with their
dividers between them, so a divider costs a tile only when the strip's spare part-tile can't hold
it (a 430px phone shows four of Diagram's Popular and the divider after the diamond, not three).

The chosen category lasts the page load: the strip is hidden rather than
unmounted while zen or the welcome flow hides the chrome. Nothing is stored,
so a new page load starts on the mode's Popular.

## The Explorer and the other panels

There is no Explorer **panel** floating in a corner. A **menu button** (☰) in
the top-left corner of the canvas toggles the real Explorer open as a
popover hanging under it, and closed again. The popover hangs from the
button's left edge (`computeDockAnchor(..., 'button')`).

Layers and Collaborate open as **popovers over their bottom-row
buttons** ([Live app](live-app.md)): they are not corner panels here. Every
other panel (AI, the minimap, Poll, Vote and the tool panels) behaves exactly
as in **Floating**, docking in its corner. Layers and Collaborate render outside
the corner layer in this layout, since a popover positions against the
canvas and a corner stack would move it.

## One menu at a time

The strip's menus (selection mode, category, More) and the Explorer popover
are menus: opening one closes whichever other is open, and a press anywhere
outside closes it. The strip stops `pointerdown` from reaching the canvas, so
their outside-press listeners run in the capture phase, before that. The
Explorer popover gets the same (`dismissOnOutside`), and so do the Layers and
Collaborate popovers ([Live app](live-app.md)). The strip's dropdown menus are kept
on screen sideways as well as vertically, whatever the trigger's position.

## The setting

`panelLayout?: 'floating' | 'toolbar'` ([User preferences](user-preferences.md)), shown in
Settings → Panels as a two-way **Panel Layout** choice. The editor tour's welcome card ([Interactive editor tour ("Show me around")](editor-tour.md))
offers the same choice, drawn with the same pictures, so a new user picks a
layout on their first document.

- Missing → Floating on desktop, Toolbar on a phone.
- A stored value the editor no longer knows (a legacy `'minimal'`) resolves
  exactly like a missing one; so does the retired `minimalPanels` flag, which
  is not part of the preferences and is ignored.
- Telemetry: `UI`/`Changed` with the layout picked in the type,
  `PanelLayoutFloating` / `PanelLayoutToolbar` (a
  choice row, [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), whether picked from the radios or the pictures.

## On a phone

**A phone always uses Toolbar** (`resolvePanelLayout(prefs, { mobile: true })`).
A phone is a viewport below `sm`, **or a touch screen under 500px tall** (one held sideways:
844 × 390 was laid out as a desktop, its floating panels covering the 286px canvas).
`PHONE_MEDIA_QUERY` (`lib/responsive.ts`) and the `phone:` CSS variant (`app/globals.css`) state
that one query, so JS and CSS flip together; phone-only classes use `phone:`, not `max-sm:`. A
popover hanging below its button is capped to the canvas below it and scrolls, as one above its
button always was, so the Explorer fits a landscape phone. It gets the same chrome as a desktop in Toolbar ([Live app](live-app.md)):
panels in their corners, Layers and Collaborate as popovers over
their bottom-row buttons. Floating is desktop only: a user who never chose, or
chose Floating, gets the strip on a phone and Floating back on a desktop,
since the stored value is untouched. The Settings row greys Floating
out and rings Toolbar ([User preferences](user-preferences.md)); the tour's welcome card shows no
layout picker there ([Interactive editor tour ("Show me around")](editor-tour.md)). What changes to fit the width:

- **The menu button and mode switch get their own card, left of the strip.**
  The card sits at the left gutter and the strip follows it 8px to the right,
  left-aligned rather than centred, so the two read as separate toolbars on
  one row. There is no room for a corner card above a strip that needs the
  whole top row.
- **The category picker is icon-only**, like the selection mode.
- **The tiles swipe.** The strip holds the whole current category and fills the row to the
  right gutter; only its tiles scroll sideways, under a finger, while the selection mode, the
  category picker and More stay put. The scrollbar is hidden ([Scrollbars](../004-interface-design/scrollbars.md)):
  a tile cut at the edge shows there is more. A new category starts scrolled to its first tile.
  More stays for the category's full body (search, the icon catalogues). It shows when the
  category holds more than fits in view (`phoneStripTileLimit` before the first measurement):
  two tiles on a 360px phone, three on a 390px one, four from about 410px.
- **More spans the screen** between the gutters instead of hanging from its
  button.
- **Zoom drops − and +** (`pinchOnly`), as on every phone ([Live app](live-app.md)). Fit
  stays.
- **The top corner stacks start below the strip** (68px down rather than
  the 16px inset), since the strip spans the width. A panel docked top-right,
  such as the Collaborate banner, otherwise rendered underneath the strip
  where it could not be reached. Without a strip (read-only, zen, the welcome
  flow) the corners keep their inset.
- Read-only visitors have no strip, so their menu button stays top-left.
- The minimap stays off ([Minimap](../008-canvas/minimap.md)).

## The setting's pictures

The Panel Layout row draws both layouts side by side, the current one
ringed, so the difference is visible before switching ([User preferences](user-preferences.md)).

## Layout details

- The strip sits at `top-3`, centred, at `z-toolbar`. The top-centre stack
  (follow-me pill, mode banners, timer, [Canvas and palette](../008-canvas/canvas-and-palette.md)) moves
  down to clear it.
- Event-storming boards ([Event storming](../021-event-storming/event-storming.md)) hide the Palette's header; the strip
  hides both its pickers the same way and shows the notation's tiles, led by
  the board's **Add from photo** (an icon button with a hover card, the
  floating palette's board row) where the deployment offers photo import.
- Read-only sessions have no palette, so no strip. The menu button still
  shows.
- Zen hides the strip and the menu button along with the rest of the chrome.
- The editor tour ([Interactive editor tour ("Show me around")](editor-tour.md)) follows the layout: its Palette step rings the
  strip's card, and its Explorer step opens the Explorer from the menu button
  and rings both, with copy that names the button.

## Motion

- **A change to the strip's tiles animates** (`ToolbarStripRail`, FLIP; a category switched, or the window letting more or fewer tiles on): tiles that moved slide
  from their old slot to their new one over 200ms (the `short` token of [Motion](../004-interface-design/motion.md)), a tile new to the strip
  pops in, and the one pushed off the end pops out where it stood. Reduced
  motion collapses it to instant.
- **Switching category animates.** The tile rail eases its width to the new
  set (the strip is centred, so it grows and shrinks evenly), the new tiles
  pop in a 10ms beat apart (a cascade, settling within 250ms), and the outgoing ones shrink away on a layer over
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

- **The strip opens on the mode's Popular every time**, like the floating Palette
  ([Editor modes](editor-modes.md#the-palette-per-mode)). It does not remember the last category across documents.
- **Twelve tiles is enough** on desktop (raised from ten, which cut Shapes and
  Popular short). Below that, the strip shows as many as fit, **measured**
  rather than estimated (`useStripTileLimit`): its own chrome (the pickers,
  More, dividers and padding, whatever they measure in the current category),
  one tile's pitch, and the room the centred strip may take (the window less
  the Explorer menu button on both sides; on a phone, less its gutters and the menu card). The
  rest is behind More. A longer category name or a new control keeps fitting
  with no constant to update; an estimate stands in only for the first paint.
- **The top corners give way to the strip.** When the strip reaches a panel
  docked in a top corner, measured against the real corner stack
  (`useStripCrowdsCorners`, re-checked as panels dock and the window
  resizes), the top corner stacks start below the strip, 68px down, exactly
  as they always do on a phone. Otherwise they keep their inset. Without it
  a docked panel (the Laser panel, say) sat under the strip's right end and
  could not be reached. A whiteboard's dock at the top gets the same
  treatment ([Where the dock sits](../023-draw-mode/draw-mode.md#where-the-dock-sits)),
  in every layout, its corners starting 76px down.
- **Undo / Redo stay where they are**, in the bottom-right dock.
- **A phone's toolbar items keep their size** (`PHONE_TOOLBAR_ITEMS`): 36px, the bottom-right
  cluster's 44px, each with a 44px-tall tap area ([Touch targets](../004-interface-design/touch-targets.md)).
  Only the pickers give up 4px of side padding, and the strip's dividers their margins down to
  1px, so more tiles show beside the menu card. The row keeps its 12px gutters and 8px gap.
- **The category picker stays on the bar**, left of the tiles. Folding it
  into More (a category list, then the category behind a BackBar) was tried
  and taken back out: it hid the current category and cost a click to
  switch.
- **The menu button opens the Explorer**, not a menu of its own (an earlier
  cut had New / Recent / Search / Settings entries).
- **The other panels follow Floating**: they dock in their corners. Layers
  and Collaborate are the exception, popovers over their bottom-row
  buttons.

## Help

The [Toolbar Layout](/help/palette/toolbar-layout/) article (Palette →
Palette Settings) explains the strip, More, the menu button and how it
fits a phone, with two figures. The Panel Layout settings row links to it.
