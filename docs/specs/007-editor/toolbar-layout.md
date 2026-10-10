# Toolbar layout

Status: shipped

## What

The editor's one panel layout, on every device (see "One layout" for the retired Floating
layout). The Palette is a single horizontal strip pinned to the top centre of the canvas, the way
Excalidraw's tool bar works:

```
 ☰ ⬡|✎   ┌──────────────────────────────────────────────────────┐
 │        │ [↖ ▾] │ [Shapes ▾] │ □ ◇ ○ → ─ ✎ A ▤ … │ [⋯ ▾] │
 ▼        └──────────────────────────────────────────────────────┘
 Explorer            (Undo/Redo, Layers, zoom: the bottom-right cluster)
```

- **Top left, before the strip: the menu button and the editor mode
  switch** ([The mode switch](editor-modes.md#the-mode-switch)), in one card. On a phone the card
  holds the menu button alone.
  On a phone that card sits at the far left of the strip's row, the strip beside it (below).
- **Left: the selection mode.** The canvas-tool picker (Select / Hand /
  Eraser / Format / Laser / Spotlight / Avatar / Isometric / Zen, [Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md))
  as a compact icon trigger, opening the banded tile grid.
- **Then the category picker.** The same banded category grid ([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)),
  as a compact trigger showing the current category's glyph and name. It
  sits directly before the tiles it chooses, so it reads as their label.
- **Then the current category's first twelve tiles** (fewer on a narrow window, see "Decided in review"), icon-only, each with its
  hover card, shortcut letter, drag-to-place, theme tint and pressed state. They
  are the Palette's tiles (`palette-tile-defs`, arranged by the mode's palette layout, [Editor modes](editor-modes.md#the-palette-per-mode)),
  rendered by the shared `PaletteTile`, so the strip and its popovers stay alike.
- **Right: More (⋯ ▾)**, when the category has more than the strip shows.
- **Far right: Search** (a magnifier), in every mode's strip but an event-storming board's (see
  "Search: every element type"). Draw mode shows its dock instead of the strip, so it has none.

## Search: every element type

A strip shows one category at a time, so finding an element means knowing which category holds it.
**Search** finds it by name instead, across every category, and across the other modes too.

- **Where:** the last control on the strip, after More (and after Plan's Edit Cards and
  Illustrate's add-page +), behind a divider, with a hover card ("Search Elements"). On a phone it
  stays put beside More while the tiles swipe.
- **Not on an event-storming board:** the notation is the palette there, as the board hides the
  pickers. Draw mode has no strip, so no Search.
- **Opening it clears the way**: a tile armed to place is let go (its "Tap to drop" banner goes), and the
  session timer's pill stands aside while the panel is open, since both sit where the panel hangs.
- **The popover** hangs from the button's right edge like More's, 26rem wide (spanning the
  screen between the gutters on a phone), and is capped to the window, scrolling when long. It is a
  strip menu: opening it closes any other (More, the pickers), and a press outside or Escape closes
  it. **S** opens it too, wherever the strip is shown (an editor, not an
  event-storming board, the chrome not hidden); everywhere else S keeps its old meaning, the legacy
  alias of Select. The field's clear button (×, once there is text) clears the query and returns to
  the tab's own types. Opening it focuses its search field (not on a phone, where focusing raises the keyboard over
  it).
- **What it searches:** the element **tiles** (`PALETTE_TILES`) of every mode's palette layout,
  each once however many categories hold it. **Icons, Stickers and Technology** are searched too,
  entry by entry, as their categories' own tiles (`palette-dynamic-tiles`, `palette-catalogue-search`):
  each catalogue at most **15** best matches (five rows; its category has the rest, with its browse),
  merged with the element tiles of the same section by how well the name matches (exact, prefix, substring, then keyword only; element tiles first among equals), so "chart" leads with the charts, not the flowchart shapes that only carry the word. A catalogue is this mode's when the mode's
  palette offers its category (Icons and Stickers in Diagram and Illustrate, Technology in Diagram)
  and another mode's otherwise. Before anything is typed, the entries already on the tab list with
  the element types (an icon or a technology mark is an icon shape carrying its id, a sticker a shape
  carrying its sticker id). The catalogues load as a chunk of their own; the popover asks for it on
  opening and fills in when it lands. My shapes stays in its own category: it is the person's
  libraries, not a catalogue of the product.
  **Draw mode's markers** join them: Draw has no palette layout (its pens are the dock's), so its
  Marker 1, 2 and 3 are built as tiles when the popover opens, from this browser's pens, each in
  its colour and width (`palette-marker-tiles`). They are always another mode's, since the strip is
  never shown in Draw. Picking one picks the pen up as the dock does, held until another tool,
  Escape or a mode switch ([Draw mode](../023-draw-mode/draw-mode.md#pens)). The dock's other
  tools are the palette's own already (Text, the shapes, the eraser), all but the Path tool, which
  the search does not offer. A
  tile matches on its name, label, blurb, description and the same synonym line the global Search
  panel uses ("database" finds the cylinder, [Canvas and palette](../008-canvas/canvas-and-palette.md#search-panel)),
  ranked exact name, then name prefix, then name substring, then keyword only; ties keep palette
  order. The image-upload tiles are left out where the editor has none, as everywhere else.
- **Two sections:**
  - **This mode's elements** first, as the palette's tile grid, drawn from every tile the current
    mode's layout offers (Plan's Cards follow the document's item types, as on the strip).
  - **Other modes**, below, as an accordion titled **"Not in Diagram Mode"** (the current mode's
    name), with a count: the matching tiles no category of this mode offers, from the other modes'
    layouts and the event-storming notation. **Closed by default** each time the popover opens:
    modes are tailored on purpose, so the rest is one deliberate click away, never hidden. Opened,
    it stays open while typing. It is absent when nothing outside the mode matches.
- **Before anything is typed** it lists only the element types **already on the tab**, under a
  small "On This Tab" label, each once, in layout order (other modes' ones in the accordion, as
  ever): the popover stays short, and the tools a tab is actually built from are one click away.
  Listing the whole mode made a popover taller than the window. A tile and an element meet on a
  **signature**: the element type plus the creation-time choice the element records (a shape's
  kind and its session tool, reaction, selection mode, estimate scale or plan view; a sticky's
  workshop kind; a pen; an embed's provider; a line's missing ends). Where the element does not
  record the choice (a board's preset, a card's type) the first tile in layout order stands for
  them all. Tiles that place no one element type (the icon, sticker and tech catalogue tiles, the
  shape pen, a board's header widget, the hero and avatar composites) never list here. An empty
  tab says "Nothing on this tab yet. Type to find any element."; one holding only other modes'
  types says "Only elements from other modes are on this tab so far. Type to find any element."
- **Nothing matches:** the mode's section says so in one line, pointing at the accordion when that
  has matches ("No Diagram elements match. Other modes have 3 below."); with neither, "No elements
  match".
- **Its heading** is "Search Elements", as More's is the category's name; the field reads "Search
  elements". The accordion's line under its title: "Elements other modes offer. Any of them works
  here too."
- **Using a tile** from either section runs the tile's own handler (the same `PaletteTile`, so
  drag-to-place, the pressed state and tinting are the palette's), and closes the popover so the
  canvas is clear. **Enter** in the field uses the first result of this mode's section (the
  accordion's first, when that section is empty and the accordion is open).
- **Nothing is stored:** the query and the accordion reset each time it opens.
- **Telemetry:** `UI`/`Opened`/`ToolbarSearch` when it opens and `UI`/`Opened`/`ToolbarSearchOtherModes`
  when the accordion opens. Placing an element reports as any palette add does.
- **Cost:** the candidate tiles are a few hundred static entries; the match is a linear filter and
  sort over them per keystroke, only while the popover is open, and the popover mounts only while
  open. The on-tab list is one pass over the tab's elements into a set of signatures, then one
  lookup per tile. The catalogues add a linear rank over their entries (123 icons, 225 stickers and
  70 technology marks today): measured at 0.4 ms for a query matching most of them, the element
  tiles 0.2 ms; tests hold both under a frame.

## More: the rest of the category

A strip has room for about a dozen tiles. Shapes fits; Icons (~180),
Stickers, Technology and Collaborate do not. More opens the current
category's full Palette body in a popover hanging from the More button's own
right edge: search, group browser, everything. The popover is
wide (26rem) rather than tall, so a body rarely has to scroll. Picking a tile
from it closes it, so the canvas is clear to draw on; switching category
closes it too, since it was showing the old one. Opening it focuses the body's
search field, when the category has one, so typing filters straight away (a category that loads
its catalogue a moment later focuses the field as soon as it appears); on a phone it does not,
because focusing would raise the keyboard over the popover.

More appears when the category has more than twelve tiles, and always for
Icons, Stickers, Technology, Behaviour and My shapes, whose bodies carry
more than tiles (search, group browsing, the person's libraries; My shapes has no strip tiles
of its own, so More is its only way in). It sits outside the
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
has two at most. A divider shows only between two tiles both on the strip, and on a phone's
swiping strip only while a tile on each side of it is at least partly in view: scrolled to where
the tiles after it are out of sight, it is hidden, never left standing at the strip's edge beside
More's own divider (`useEdgeDividers`, re-checked as the strip scrolls or resizes). They take room, about
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
buttons** ([Live app](live-app.md)): they are not corner panels. Every
other panel (AI, the minimap, Poll, Vote and the tool panels) docks in its corner
([Panel docking](panel-docking.md)). Layers and Collaborate render outside
the corner layer, since a popover positions against the canvas and a corner stack would move it.

## One menu at a time

The strip's menus (selection mode, category, More, Search) and the Explorer popover
are menus: opening one closes whichever other is open, and a press anywhere
outside closes it. The strip stops `pointerdown` from reaching the canvas, so
their outside-press listeners run in the capture phase, before that. The
Explorer popover gets the same (`dismissOnOutside`), and so do the Layers and
Collaborate popovers ([Live app](live-app.md)). The strip's dropdown menus are kept
on screen sideways as well as vertically, whatever the trigger's position.

## One layout

There is no layout choice. An earlier version offered a second layout, **Floating**, as the
desktop default: the Palette as a draggable corner panel, the Explorer as a corner panel, Layers
minimising into its cluster button, and Draw mode's tools inside the Palette panel. It was retired
because every new feature had to be built and kept working twice, and the strip had become the
better layout. Its parts went with it:

- The `panelLayout` preference is gone ([User preferences](user-preferences.md)). A stored value
  (`'floating'`, `'toolbar'`, a legacy `'minimal'`) is ignored and left as it is.
- Settings has no Panel Layout row, and the editor tour's welcome card no layout picker
  ([Interactive editor tour ("Show me around")](editor-tour.md)).
- The Palette, the Explorer and Layers are no longer corner panels, so a stored panel placement
  that names them is ignored ([Panel docking](panel-docking.md)).
- Telemetry's `PanelLayoutFloating` / `PanelLayoutToolbar` stay in the catalogue as retired
  types, so the history still reads ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## On a phone

A phone is a viewport below `sm`, **or a touch screen under 500px tall** (one held sideways:
844 × 390 was laid out as a desktop, its panels covering the 286px canvas).
`PHONE_MEDIA_QUERY` (`lib/responsive.ts`) and the `phone:` CSS variant (`app/globals.css`) state
that one query, so JS and CSS flip together; phone-only classes use `phone:`, not `max-sm:`. A
popover hanging below its button is capped to the canvas below it and scrolls, as one above its
button always was, so the Explorer fits a landscape phone. It gets the same chrome as a desktop ([Live app](live-app.md)):
panels in their corners, Layers and Collaborate as popovers over
their bottom-row buttons. What changes to fit the width:

- **The menu button gets its own card, left of the strip,** without the mode switch: the tab
  menu's Opens in switches mode on a phone ([The mode switch](editor-modes.md#the-mode-switch)).
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

## Layout details

- The strip sits at `top-3`, centred, at `z-toolbar`. The top-centre stack
  (follow-me pill, timer, vote, [Canvas and palette](../008-canvas/canvas-and-palette.md)) moves
  down to clear it.
- **Messages hang from the strip, as its tray.** The messages that tell you what the next press does (the
  mode banners: a tile in hand, "Select the board column you want this card to appear in"; the Format tool and
  the format painter) and the modifier hint (Shift, Alt) attach to the strip's bottom edge instead of floating
  under it as pills:
  - One shared look, the **palette tray**: the strip's own surface (white, hairline border, dark in dark mode),
    no top border, so it joins the strip's bottom edge with no gap; its bottom corners round as the strip's do,
    and a soft shadow falls below it.
  - Centred under the strip's card and never wider than it, on a phone too (where the card sits beside the
    menu button).
  - One row at the strip's type size (13 px): a leading icon (or the modifier's key chip), the message, then
    its actions as small text buttons at the end (**Cancel**, **Done**) and any toggles the message carries.
  - It fades in (`fade-in`; still under reduced motion) and goes when its message does.
  - While a mode banner sits in the tray, the top-centre stack starts below the tray instead.
  - Without a strip (Draw mode's dock, zen, read-only, the welcome flow) the messages stay the
    top-centre pills they are elsewhere.
- Event-storming boards ([Event storming](../021-event-storming/event-storming.md)) hide the strip's pickers, and the strip shows the notation's tiles, led by
  the board's **Add from photo** (an icon button with a hover card) where the deployment offers
  photo import.
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
- **The rail is always as wide as its tiles.** Its width follows the tiles as laid out, whenever they change
  (a category switch, a tile added or gone, such as a card type), never a tile caught mid-slide: no empty gap
  after the last tile once they settle.

## Look

- **Sharp at 1x.** Every tile glyph, on the strip and in its popovers,
  sits on a whole pixel. Three causes were found and removed:
  - The Palette's tile grid split its body into three fractional columns
    (76.67px), so every glyph straddled a pixel. It uses fixed, even 76px
    columns spread edge to edge instead.
  - The strip was centred with `-translate-x-1/2` and followed a
    text-width category label, both fractional. It is centred by flexbox,
    and `SnapWidth` rounds the label and the whole card to whole pixels (the
    card matching the canvas's parity so centring stays whole).
  - Thirteen-pixel glyphs (the Behaviour and mode icons) centred on a half
    pixel in an even tile. They are 14px.
    Separately, the corner panels were permanently promoted to their own
    compositing layer (a fix for isometric flicker), which costs sub-pixel text
    anti-aliasing on a 1x display. The promotion is now gated on an isometric
    scene being on the page. Tile captions went from 9px to 10px.

- The dropdown-style controls (selection mode, category, More) sit on a
  faint tint so
  they read as menus beside the plain tiles. The tint is the brand ramp,
  which follows the active tab's theme (`useEditorAccent`), so a Sunset tab
  tints them orange.

## Decided in review

- **The strip opens on the mode's Popular every time**
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
  its corners starting 76px down.
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
- **The other panels dock in their corners** ([Panel docking](panel-docking.md)). Layers
  and Collaborate are the exception, popovers over their bottom-row
  buttons.

## Help

The [Toolbar Layout](/help/palette/toolbar-layout/) article (Palette →
Palette Settings) explains the strip, More, the menu button and how it
fits a phone, with three figures.
