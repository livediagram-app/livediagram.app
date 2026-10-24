# Toolbar layout

Status: shipped

## What

The editor's one panel layout, on every device (see "One layout" for the retired Floating
layout). The Palette is a single horizontal strip pinned to the top centre of the canvas, the way
Excalidraw's tool bar works. The strip is the **category bar** (below): the palette's categories for the page
someone is on, each opening a flyout of its tiles:

```
 ☰ ⬡|✎   ┌────────────────────────────────────────────────────────────────────────┐
 │        │ [↖ ▾] │ Shapes Write │ Concepts Components Devices │ Icons … │ [🔍] │
 ▼        └────────────────────────────────────────────────────────────────────────┘
 Explorer            (Undo/Redo, Slides, Contents, zoom: the bottom-right cluster)
```

- **Top left, before the strip: the menu button**, in a card with the tab's name. On a phone that card sits at the far left of the strip's row, the strip beside it (below). In a workspace
  workbench frame, which has no Explorer button, the card holds **Back** instead
  ([Workbench embeds](../013-workspace/workbench-embeds.md#what-renders)).
- **Left: the selection mode.** The canvas-tool picker (Select / Hand /
  Format / Laser / Spotlight / Slide Deck / Isometric / Zen, [Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md))
  as a compact icon trigger, opening the banded tile grid.
- **Then the category bar** ("The category bar"). Its tiles are the Palette's tiles (`palette-tile-defs`, arranged
  by the page kind's palette layout, [Pages](pages-mode.md) "The palette's kind"), rendered by the shared
  `PaletteTile`, so the strip and its popovers stay alike. On an article page the strip holds the article's
  formatting instead ([Article pages](article-pages.md) "The page toolbar").
- **Far right: Search** (a magnifier) (see "Search: every element type").

## The category bar

The strip shows the palette's **categories** rather than one category's tiles, the way the Icons category always
showed its groups: the strip is a short row of named places, and each holds its tiles in
a flyout. Finding a tile is one look along the bar, not a trip through a picker, and the strip never changes width
under the pointer as a category is switched.

### What is on it

- **One button per category**, its glyph and its name (13 px, medium), in the page kind's layout order
  (`palette-layouts.ts`), a hairline divider between the bands (Common, Structure,
  Decorate, Dynamic, Collaborate). No hover card: resting on a button opens its flyout, which names it.
- **Names are one word**, never more: a layout's longer name gives way on the bar (`barLabel`).
- **No Popular.** With every category one press away, a pick from across them adds nothing, so no layout has one
  (the category and its glyph are gone).
- **No Build.** The bar has no Build category: the
  Stack sits in Components and the Timeline and Table in Data and Concepts.
- **The bars**, by page kind (`palette-layouts.ts`):

  | Page kind            | Bar                                                                           |
  | -------------------- | ----------------------------------------------------------------------------- |
  | Infographic (Design) | Shapes, Write · Concepts, Components, Devices · Icons, Stickers, Media · Data |
  | Slide                | Write, Shapes, Media · Data, Concepts, Components, Devices · Icons, Stickers  |

- **Names fit or go.** The bar shows its names while the strip, named, fits the room the centred strip may take
  (the editor's width less the top-left menu card, measured, on both sides); otherwise the glyphs alone
  (`useBarLabels`). Measured, not estimated: the menu card is wider with a long tab name, and an
  estimate let the bar run under it. **Too wide even bare**, as on a tablet (768px) where the glyphs can need more
  than the centring leaves, the strip sits at the right instead, 12px from the edge, clear of
  the card (`useStripCrowded`, measured the same way); it centres again once there is room. A phone always shows the glyphs, 44 px apart, and the bar swipes
  sideways while the selection mode and Search stay put ("On a phone"). A swiping rail (the bar, an article's dock)
  fades the edge with more beyond it over 20px (`scroll-edge-fade`, a scroll-driven
  mask where the browser has them), so a glyph cut by the edge reads as more to swipe to, not a stray sliver of an
  icon; an edge with nothing beyond it stays sharp.
- **The open category** is pressed (the brand tint) with a short brand bar under it.

### Opening a flyout

- **A mouse resting on a button for 120 ms opens it**; sweeping across the bar on the way to the canvas opens
  nothing. While one is open, pointing at another category moves the flyout there at once, sliding to the new
  button over 200 ms (the `short` motion token), as a menu bar does.
- **Leaving both the bar and the flyout closes it after 300 ms**, so a diagonal path from a button into the flyout,
  across the gap or a corner of the canvas, keeps it. It stays open while a tile is being dragged out of it
  (closing would unmount the tile mid-drag; it closes on the drop), faded to 30% and letting a drop over it land on
  the canvas it covers (`data-drop-through`, read by the canvas's drop guard; not `pointer-events: none`, which on a
  drag's own source stalls the drag), and while its search field holds a query.
- **A click or a tap opens it too, and pins it.** A category opened by a press (a click, a tap, the keyboard) is a
  deliberate open: moving the pointer away doesn't close it; an outside press, Escape or using a tile does, and
  pointing at another category still moves it there, pinned as it was. A click on a category the hover already opened
  pins it; a second tap (a touch or a pen, as on a phone) or a second press from the keyboard closes it, while a second
  mouse click keeps it, since the hover opened it.
- **The keyboard:** Left and Right walk the bar (wrapping), and an open flyout follows the focus. Down, Enter or
  Space opens a category with its first tile focused. In a flyout the arrows walk the tiles by position across its
  groups, Home and End jump to the ends, Escape closes it and hands the focus back to its button.
- **One menu at a time:** a flyout is a strip menu ("One menu at a time"); opening Search or the selection mode
  closes it. Using a tile closes it, so the canvas is clear.
- **Above the canvas chrome:** while a flyout (or Search) is open the strip rises to the popover layer
  (`--z-popover`), so what hangs from it sits over an element's toolbar, the style panel and the start panels.

### The flyout

Hung centred under its button (spanning the screen between the gutters on a phone), capped to the window and
scrolling when long:

- **A header:** the category's glyph on a soft brand plate, its name, one line on what it is for, and its tile count
  as a `CountBadge` ([Counts are badges](../004-interface-design/counts.md)).
- **Its tiles in named groups**, each a small heading with a hairline, the groups where the category's fixed
  dividers fall ("A flyout's order and groups"), named by the tile that starts each (`Basics`, `More Shapes`;
  `Charts`, `Meters`; `Desktop`, `Mobile`; `Pictures`, `Embeds`, `People`; ...). A category shows its groups only when every one is named, else one
  block, so a layout whose dividers fall elsewhere never shows half its groups headed and half bare.
- **Pictures or cards**, by the palette's own rule ([Rows, not tiles](../010-palette/palette-top-level-categories.md#rows-not-tiles-for-most-categories)):
  Shapes as a five-column grid of 72 px picture tiles with their names under them; every other category as cards,
  the glyph on a plate beside the name and its one-line blurb, two to a row (one, in a narrower flyout, for a
  category of three tiles or fewer, such as Media). A shortcut shows as a key cap beside the name.
- **A footer** saying what the pointed-at tile does and its key, without the hover card's wait; before anything is
  pointed at, "Click to add one, or drag it onto the canvas." ("Tap to add one, …" on a touch screen). A tile's blurb or description that names a click says it the touch screen's way there too ("Double-click to
  look underneath" reads "Double-tap to look underneath"; `PointerWords`), each wording shown for its own pointer. It is **one
  fixed height** whatever it says, room for the name and two lines of description (`FLYOUT_FOOTER_HEIGHT`, 69 px),
  a longer description clamped to two lines: a footer that grew and shrank with each tile moved the flyout's edge
  under the pointer as it travelled.
- Under Minimal Chrome ([Power user mode](power-user-mode.md)) a picture tile shows its icon alone, named by a
  Tooltip; a card keeps its name, which is its content.
- Every tile places, arms, drags onto the canvas (with the canvas ghost), shows its armed and refused states and
  draws in the tab theme's tint and finish, as the strip's own tile does (`useTileGlyph`, shared with `IconButton`).
- **Widths:** 26rem for a picture grid, 36rem for two columns of cards, 19rem for one, 37.5rem for a catalogue's
  two-pane browse.

### A tile's side panel

A tile with presets (Card, Badge: [Card presets](../009-elements/card.md)) opens a **side panel**: a
second popover beside the flyout, lined up with the tile, so the flyout stays open behind it as a submenu's parent
does. It opens on the side of the tile's own column (a right-column tile to the flyout's right, a left-column one
to its left), against the tile itself over the other column where the window has no room, and rises to stay inside
the window. Resting on the tile for 150 ms opens it, a press opens it at once, a second press closes it, and
resting on another tile closes it. On a phone it lies over the flyout. Its header names the tile and says what can
change after a preset is placed; its presets are one column of cards, placing and dragging as any tile.

### Icons and Stickers: two panes

A catalogue's flyout browses as **two panes** ([Browsing the palette by category](../010-palette/palette-category-browse.md)):
the groups down a 188 px rail on the left, each its glyph, name and count badge, the open one raised with a brand
edge; the open group's entries on the right under a sticky heading with its count badge; one search across the
top that cuts across every group ("Results for “…”"). Nothing to drill into or back out of. The panes keep one
height, so switching group never moves the flyout. Each reopens on the group it was left on, for the page load
(`BrowseMemory`); a query is not kept.

## Search: every element type

A strip shows one category at a time, so finding an element means knowing which category holds it.
**Search** finds it by name instead, across every category.

- **Where:** the last control on the strip, behind a divider, with a hover card ("Search Elements"). On a phone it
  stays put while the bar swipes.
- **Opening it clears the way**: a tile armed to place is let go (its "Click to drop" banner goes), since it sits
  where the panel hangs.
- **The popover** hangs from the button's right edge, 26rem wide (spanning the screen between the gutters on a phone), and is capped to the window, scrolling when long. It is a strip menu: opening it closes any other (a flyout, the selection mode), and a press outside or Escape closes it; Escape hands the focus back to the button that opened it (a press leaves focus where it landed), where it had fallen to the page. **S** opens it too, wherever the strip is shown; everywhere else S keeps its old meaning, the legacy alias of Select. The field's clear button (×, once there is text) clears the query and returns to the tab's own types. Opening it focuses its search field (not on a phone, where focusing raises the keyboard over it).
- **What it searches:** the element **tiles** (`PALETTE_TILES`) of the Pages palette, each once however many
  categories hold it. **Icons and Stickers** are searched too, entry by entry, as their categories' own tiles
  (`palette-dynamic-tiles`, `palette-catalogue-search`): each catalogue at most **15** best matches (five rows; its
  category has the rest, with its browse), merged with the element tiles by how well the name matches (exact,
  prefix, substring, then keyword only; element tiles first among equals), so "chart" leads with the charts, not the
  shapes that only carry the word. The catalogues load as a chunk of their own; the popover asks for it on opening
  and fills in when it lands. A tile matches on its name, label, blurb, description and the same synonym line the
  global Search panel uses ([Canvas and palette](../008-canvas/canvas-and-palette.md#search-panel)), ranked exact
  name, then name prefix, then name substring, then keyword only; ties keep palette order. The image-upload tiles
  are left out where the editor has none, as everywhere else.
- **Before anything is typed** it lists only the element types **already on the tab**, under a
  small "On This Tab" label, each once, in layout order: the popover stays short, and the tools a tab is actually
  built from are one click away. A tile and an element meet on a **signature**: the element type plus the
  creation-time choice the element records (a shape's kind; an embed's provider; a line's missing ends). Where the
  element does not record the choice the first tile in layout order stands for them all. Tiles that place no one
  element type (the icon and sticker catalogue tiles, the hero and avatar composites) never list here. An empty tab
  shows the shared empty state "No elements on this tab yet" ("Type to find any element.").
- **Nothing matches:** the shared empty state ([Empty states](../004-interface-design/empty-states.md)), "No
  elements match “<words>”" with **Clear Search**.
- **Its heading** is "Search Elements"; the field reads "Search elements".
- **Using a tile** runs the tile's own handler (the same `PaletteTile`, so drag-to-place, the pressed state and
  tinting are the palette's), and closes the popover so the canvas is clear. **Enter** in the field uses the first
  result.
- **Nothing is stored:** the query resets each time it opens.
- **Telemetry:** `UI`/`Opened`/`ToolbarSearch` when it opens. Placing an element reports as any palette add does.
- **Cost:** the candidate tiles are a few hundred static entries; the match is a linear filter and
  sort over them per keystroke, only while the popover is open, and the popover mounts only while
  open. The on-tab list is one pass over the tab's elements into a set of signatures, then one
  lookup per tile. The catalogues add a linear rank over their entries (123 icons and 225 stickers today): measured at 0.4 ms for a query matching most of them, the element
  tiles 0.2 ms; tests hold both under a frame.

## A flyout's order and groups

A flyout shows its category **in its own order**, always. **Using a tile never reorders it** (an earlier version brought each used tile to the front,
which moved things under the pointer after every add; it is gone, its stored list with it).

**Fixed dividers** split a category into its groups of related tiles (a tile's `dividerAfter`, or a layout's own
`DIVIDE`), which the flyout heads by name ("The flyout"):

- **Shapes**: the basics (Square, Circle, Diamond) | the rest.
- **Write**: Text | Note, Callout.
- **Components**: the layout blocks (Hero, Header, Banner, Stack) | the web blocks | Code, Checklist.
- **Devices**: desktop (Browser, Monitor, Laptop) | mobile (Phone, Tablet, Foldable, Watch).
- **Media**: Image | the embeds | Avatar.
- **Data**: the charts (Pie, Bar, Line, Legend) | the meters (Progress, Donut, Rating) | Table.

The Icons and Stickers catalogues have none: they browse by their own groups ("Icons and Stickers: two panes").

The strip is hidden rather than unmounted while zen or the welcome flow hides the chrome, so a catalogue's flyout
still reopens on the group it was left on. Nothing about the bar is stored across page loads.

## The tab's name

- On a desktop, the menu box (the Explorer button, top left) ends with the open tab's name, after a
  hairline. It is the chrome's ink, 14 px at regular weight (never bold), cut short
  with an ellipsis past 16rem, and follows a rename at once. The box shows a name alone, never an icon beside it.
- A click (a tap) on it renames the tab in place, for someone who may change the
  document's tabs: Enter or leaving saves, Escape puts it back; up to 60 characters.
- Not on a phone: the top row is the strip's there.

## The Explorer and the other panels

There is no Explorer **panel** floating in a corner. A **menu button** (☰) in
the top-left corner of the canvas toggles the real Explorer open as a
popover hanging under it, and closed again. It starts closed on every page and is never
reopened from a remembered state; pressing the button is the only thing that opens it. A press
outside, Esc, the button again or opening an item closes it. The status screens (deleted,
couldn't load, not found) have no menu button and no Explorer. The popover hangs from the
button's left edge (`computeDockAnchor(..., 'button')`).

Collaborate, Slides and Contents open as **popovers over their bottom-row
buttons** ([Editor app](editor-app.md)): they are not corner panels. Every
other panel (AI, the minimap and the tool panels) docks in its corner
([Panel docking](panel-docking.md)). The popovers render outside
the corner layer, since a popover positions against the canvas and a corner stack would move it.
A popover opening up from a bottom-row button grows no higher than 8 px under a
toolbar across the canvas's top whose span meets its column (`usePopoverTopClearance`), and
12 px from the canvas's top otherwise: on a phone the strip spans the width, and a tall panel ran up under it with its
header hidden.

## One menu at a time

The strip's menus (selection mode, a category's flyout, Search) and the Explorer popover
are menus: opening one closes whichever other is open, and a press anywhere
outside closes it. The strip stops `pointerdown` from reaching the canvas, so
their outside-press listeners run in the capture phase, before that. The
Explorer popover gets the same (`dismissOnOutside`), and so do the bottom-row
popovers ([Editor app](editor-app.md)). The strip's dropdown menus are kept
on screen sideways as well as vertically, whatever the trigger's position.

## One layout

There is no layout choice. An earlier version offered a second layout, **Floating**, as the
desktop default: the Palette as a draggable corner panel, the Explorer as a corner panel, Layers
minimising into its cluster button. It was retired
because every new feature had to be built and kept working twice, and the strip had become the
better layout. Its parts went with it:

- The `panelLayout` preference is gone ([User preferences](user-preferences.md)). A stored value
  (`'floating'`, `'toolbar'`, a legacy `'minimal'`) is ignored and left as it is.
- Settings has no Panel Layout row.
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
button always was. It gets the same chrome as a desktop ([Editor app](editor-app.md)):
panels in their corners, the bottom-row popovers over their buttons. What changes to fit the width:

- **The menu button gets its own card, left of the strip.**
  The card sits at the left gutter and the strip follows it 8px to the right,
  left-aligned rather than centred, so the two read as separate toolbars on
  one row. There is no room for a corner card above a strip that needs the
  whole top row.
- **The bar shows its glyphs alone**, 44 px apart, and fills the row to the right gutter; only the bar scrolls
  sideways, under a finger, while the selection mode and Search stay put. The scrollbar is hidden
  ([Scrollbars](../004-interface-design/scrollbars.md)): a glyph cut at the edge shows there is more.
- **A flyout spans the screen** between the gutters instead of hanging from its button.
- **Zoom drops − and +** (`pinchOnly`), as on every phone ([Editor app](editor-app.md)). Fit
  stays.
- **The top corner stacks start below the strip** (68px down rather than
  the 16px inset), since the strip spans the width. A panel docked top-right,
  such as the Collaborate banner, otherwise rendered underneath the strip
  where it could not be reached. Without a strip (read-only, zen, the welcome
  flow) the corners keep their inset.
- Read-only visitors have no strip, so their menu button stays top-left.
- **Held sideways there is no menu button and no Explorer**, in the strip's row or the corner,
  for every role, and nothing brings them back while the phone is sideways: the screen is too
  short for the Explorer to be any use. The strip starts at the left gutter in the menu card's
  place, still swiping. Turning the phone upright brings the button back ([A phone held
  sideways](editor-app.md#a-phone-held-sideways)).
- The minimap stays off ([Minimap](../008-canvas/minimap.md)).

## Layout details

- The strip sits at `top-3`, centred, at `z-toolbar`. The top-centre stack
  (follow-me pill, [Canvas and palette](../008-canvas/canvas-and-palette.md)) moves
  down to clear it.
- **Messages hang from the strip, as its tray.** The messages that tell you what the next press does (the
  mode banners: a tile in hand; the Format tool and the format painter) and the modifier hint (Shift, Alt) attach to the strip's bottom edge instead of floating
  under it as pills:
  - One shared look, the **palette tray**: the strip's own surface (white, hairline border, dark in dark mode),
    no top border, so it joins the strip's bottom edge with no gap; its bottom corners round as the strip's do,
    and a soft shadow falls below it.
  - Centred under the strip's card and never wider than it, on a phone too (where the card sits beside the
    menu button). It follows the card as it moves, including when the card's whole-pixel box re-centres it a beat
    after a resize (the category bar dropping its names left the tray off-centre until it watched that box).
  - One row at the strip's type size (13 px): a leading icon (or the modifier's key chip), the message, then
    its actions as small text buttons at the end (**Cancel**, **Done**) and any toggles the message carries. On a
    phone (below `sm`) a message too long for the row wraps to a second line instead of cutting off, so "Tap to
    drop or drag to draw Square" keeps the name it gives.
  - It fades in (`fade-in`; still under reduced motion) and goes when its message does.
  - It also carries an empty tab's **Show Templates**: once a start's × has closed it, "Tab 1 is empty" with **Show
    Templates**, which opens the start again, until the first element lands
    ([Template starts](start-diagramming.md) "Bringing it back").
  - While a mode banner sits in the tray, the top-centre stack starts below the tray instead.
  - While one of the strip's popovers is open (a category's flyout, Search) the tray steps aside, as it does
    for the Explorer: it would cover the popover's top.
  - Without a strip (zen, read-only, the welcome flow) the messages stay the
    top-centre pills they are elsewhere.
- Read-only sessions have no palette, so no strip. The menu button still
  shows.
- Zen hides the strip and the menu button along with the rest of the chrome.
- The [Pages tour](pages-tour.md) follows the layout: its palette step rings the strip's card.

## Motion

- **A flyout glides between buttons.** Pointing at another category while one is open slides the flyout to the new
  button over 200 ms (the `short` token of [Motion](../004-interface-design/motion.md)) rather than jumping
  ("Opening a flyout").
- **A change of kind cascades in.** When the palette's kind changes (someone moves onto a page of another kind), the
  new bar's buttons, or an article's docked formatting, rise and fade in a moment apart, settling within 250 ms
  (`usePaletteKindMotion`). Nothing moves on the first render or under reduced motion.

## Look

- **Sharp at 1x.** Every tile glyph, on the strip and in its popovers,
  sits on a whole pixel. Three causes were found and removed:
  - The Palette's tile grid split its body into three fractional columns
    (76.67px), so every glyph straddled a pixel. It uses fixed, even 76px
    columns spread edge to edge instead.
  - The strip was centred with `-translate-x-1/2`, a fractional offset. It is centred by flexbox, and `SnapWidth`
    rounds the whole card to whole pixels (matching the canvas's parity so centring stays whole).
  - Thirteen-pixel glyphs (the selection mode icons) centred on a half
    pixel in an even tile. They are 14px.
    Separately, the corner panels were permanently promoted to their own
    compositing layer (a fix for isometric flicker), which costs sub-pixel text
    anti-aliasing on a 1x display. The promotion is now gated on an isometric
    scene being on the page. Tile captions went from 9px to 10px.

- The dropdown-style control (the selection mode) sits on a
  faint tint so
  they read as menus beside the plain tiles. The tint is the brand ramp,
  which follows the active tab's theme (`useEditorAccent`), so a Sunset tab
  tints them orange.

## Decided in review

- **The bar has no current category.** Each flyout opens from its own button, and nothing remembers the last
  category used, across documents or page loads.
- **The top corners give way to the strip.** When the strip reaches a panel
  docked in a top corner, measured against the real corner stack
  (`useStripCrowdsCorners`, re-checked as panels dock and the window
  resizes), the top corner stacks start below the strip, 68px down, exactly
  as they always do on a phone. Otherwise they keep their inset. Without it
  a docked panel (the Laser panel, say) sat under the strip's right end and
  could not be reached.
- **Undo / Redo stay where they are**, in the bottom-right dock.
- **A phone's toolbar items keep their size** (`PHONE_TOOLBAR_ITEMS`): 36px, the bottom-right
  cluster's 44px, each with a 44px-tall tap area ([Touch targets](../004-interface-design/touch-targets.md)).
  Only the selection mode gives up 4px of side padding, and the strip's dividers their margins down to
  1px, so more of the bar shows beside the menu card. The row keeps its 12px gutters and 8px gap.
- **The menu button opens the Explorer**, not a menu of its own (an earlier
  cut had New / Recent / Search / Settings entries).
- **The other panels dock in their corners** ([Panel docking](panel-docking.md)). The bottom-row popovers are
  the exception.

## Help

The [Toolbar Layout](/help/palette/toolbar-layout/) article (Palette →
Palette Settings) explains the strip, the menu button and how it
fits a phone, with three figures.
