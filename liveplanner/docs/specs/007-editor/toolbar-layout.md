# Toolbar layout

Status: shipped

## What

The editor's one panel layout, on every device (see "One layout" for the retired Floating layout). Plan shows **no
palette** ([Plan mode](../026-plan/plan-mode.md#no-palette)), so the editor shows no strip: the menu button keeps the
top-left corner, and Undo/Redo, the Plan strip and zoom sit in the bottom-right cluster. The Palette strip this spec
describes from "Search" on (`ToolbarPalette`) is no longer mounted; its code stays until the palette itself is
removed. The category bar the other editor modes showed was removed with them. The sections from "Search" to "The
strip's order and dividers" and "Motion" specify that unmounted code, the categories of the retired modes included,
and go with it.

- **Top left: the menu button**, in a card with the tab's name. No mode switch sits there: every tab is in Plan
  ([Editor mode](editor-modes.md)).

## Search: every element type

A strip shows one category at a time, so finding an element means knowing which category holds it.
**Search** finds it by name instead, across every category, and across the other modes too.

- **Where:** the last control on the strip, after More (and after Plan's Edit Cards and
  Plan's Edit Cards), behind a divider, with a hover card ("Search Elements"). On a phone it
  stays put beside More while the tiles swipe.
- **Opening it clears the way**: a tile armed to place is let go (its "Tap to drop" banner goes), and the
  session timer's pill stands aside while the panel is open, since both sit where the panel hangs.
- **The popover** hangs from the button's right edge like More's, 26rem wide (spanning the screen between the gutters on a phone), and is capped to the window, scrolling when long. It is a strip menu: opening it closes any other (More, the pickers), and a press outside or Escape closes it; Escape hands the focus back to the button that opened it (a press leaves focus where it landed), where it had fallen to the page. **S** opens it too, wherever the strip is shown; everywhere else S keeps its old meaning, the legacy alias of Select. The field's clear button (×, once there is text) clears the query and returns to the tab's own types. Opening it focuses its search field (not on a phone, where focusing raises the keyboard over it).
- **What it searches:** the element **tiles** (`PALETTE_TILES`) of every mode's palette layout,
  each once however many categories hold it. **Icons, Stickers and Technology** are searched too,
  entry by entry, as their categories' own tiles (`palette-dynamic-tiles`, `palette-catalogue-search`):
  each catalogue at most **15** best matches (five rows; its category has the rest, with its browse),
  merged with the element tiles of the same section by how well the name matches (exact, prefix, substring, then keyword only; element tiles first among equals), so "chart" leads with the charts, not the flowchart shapes that only carry the word. A catalogue is this mode's when the mode's
  palette offers its category (Icons and Stickers in Diagram and Pages, Technology in Diagram)
  and another mode's otherwise. Before anything is typed, the entries already on the tab list with
  the element types (an icon or a technology mark is an icon shape carrying its id, a sticker a shape
  carrying its sticker id). The catalogues load as a chunk of their own; the popover asks for it on
  opening and fills in when it lands. A
  tile matches on its name, label, blurb, description and the same synonym line the global Search
  panel uses ("database" finds the cylinder, [Canvas and palette](../008-canvas/canvas-and-palette.md#search-panel)),
  ranked exact name, then name prefix, then name substring, then keyword only; ties keep palette
  order. The image-upload tiles are left out where the editor has none, as everywhere else.
- **Two sections:**
  - **Plan's elements** first, as the palette's tile grid, drawn from every tile Plan's layout offers (Plan's Cards
    follow the project's item types, as on the strip).
  - **More Elements**, below, as an accordion with a count: the matching tiles of every other category, and the
    markers. **Closed by default** each time the popover opens, so the rest is one deliberate click away, never
    hidden. Opened, it stays open while typing. It is absent when nothing outside Plan's palette matches.
- **Before anything is typed** it lists only the element types **already on the tab**, under a
  small "On This Tab" label, each once, in layout order (the others in their accordion, as
  ever): the popover stays short, and the tools a tab is actually built from are one click away.
  Listing the whole mode made a popover taller than the window. A tile and an element meet on a
  **signature**: the element type plus the creation-time choice the element records (a shape's
  kind and its session tool, reaction, selection mode, estimate scale or plan view; a sticky's
  workshop kind; an embed's provider; a line's missing ends). Where the element does not
  record the choice (a board's preset, a card's type) the first tile in layout order stands for
  them all. Tiles that place no one element type (the icon, sticker and tech catalogue tiles, the
  a board's header widget, the hero and avatar composites) never list here. An empty
  tab shows the shared empty state "No elements on this tab yet" ("Type to find any element."); one holding only
  other modes' types, "No Diagram elements on this tab yet" (the mode's name).
- **Nothing matches:** the mode's section shows the shared empty state
  ([Empty states](../004-interface-design/empty-states.md)), pointing at the accordion when that has matches ("No
  Diagram elements match “pie chart”", "Other modes have 3 below."); with neither, "No elements match “<words>”" with
  **Clear Search**.
- **Its heading** is "Search Elements", as More's is the category's name; the field reads "Search
  elements". The accordion's line under its title: "Elements other modes offer. Any of them works
  here too."
- **Using a tile** from this mode's section or Elements From Other Modes runs the tile's own handler (the same `PaletteTile`, so
  drag-to-place, the pressed state and tinting are the palette's), and closes the popover so the
  canvas is clear. **Enter** in the field uses the first result of this mode's section (Elements
  From Other Modes' first, when that section is empty and the accordion is open); never an
  unavailable tile.
- **Nothing is stored:** the query and the accordions reset each time it opens.
- **Telemetry:** `UI`/`Opened`/`ToolbarSearch` when it opens and `UI`/`Opened`/`ToolbarSearchOtherModes`
  and `UI`/`Opened`/`ToolbarSearchUnavailable` when each accordion opens. Placing an element reports as any palette add does.
- **Cost:** the candidate tiles are a few hundred static entries; the match is a linear filter and
  sort over them per keystroke, only while the popover is open, and the popover mounts only while
  open. The on-tab list is one pass over the tab's elements into a set of signatures, then one
  lookup per tile. The catalogues add a linear rank over their entries (123 icons, 225 stickers and
  70 technology marks today): measured at 0.4 ms for a query matching most of them, the element
  tiles 0.2 ms; tests hold both under a frame.

## More: the rest of the category

Plan's strip only: the category bar has no More, since every category's whole body is its flyout.

A strip has room for about a dozen tiles. Shapes fits; Icons (~180),
Stickers and Technology do not. More opens the current
category's full Palette body in a popover hanging from the More button's own
right edge: search, collapsed groups, everything. The popover is
wide (26rem) rather than tall, so a body rarely has to scroll. Picking a tile
from it closes it, so the canvas is clear to draw on; switching category
closes it too, since it was showing the old one. Opening it focuses the body's
search field, when the category has one, so typing filters straight away (a category that loads
its catalogue a moment later focuses the field as soon as it appears); on a phone it does not,
because focusing would raise the keyboard over the popover.

More appears when the category has more than twelve tiles, and always for
Icons, Stickers, Technology and Behaviour, whose bodies carry
more than tiles (search, group browsing). It sits outside the
animated tile rail, so it rides the rail's width change.

**Icons, Stickers and Technology show their groups** where a strip shows their tiles (no mode's strip does since
the category bar; their flyouts browse in two panes): the strip's tiles
for one of them are its browse groups (the Icons groups, the Sticker groups, the Technology providers),
each drawn as an opener rather than a tile (its first entry with a chevron, as the strip's pickers are, so it reads
as a group to open rather than an icon to drag) with the group's name on its hover card, in the browse's own order. Pressing one
opens a popover centred under that tile (on a phone it spans the screen, as More's does), showing **that group's
entries alone**, headed with the group's name: no search and no breadcrumb, since the strip is the way between
groups (More, on a desktop, keeps the whole browse with its search). Pressing the open group's tile again closes it. Picking an entry
closes it, as More's does. The groups and their entries are the browse's
([Palette category browse](../010-palette/palette-category-browse.md)), so the strip and the More body never
disagree.

**On a phone More never shows**: every category's strip already holds all of it (the whole category swipes, and
the three catalogues hold their groups).

## The strip's order and dividers

The strip shows a category **in its own order**, always: the first tiles that fit, the rest behind
More. **Using a tile never reorders it** (an earlier version brought each used tile to the front,
which moved things under the pointer after every add; it is gone, its stored list with it).

**Fixed dividers** split a category into its groups of related tiles (a tile's `dividerAfter`):

- **Shapes**: the basics (Square, Circle, Diamond) | the flowchart shapes (Cylinder to Stadium) |
  the rest (Cloud to Bubble).
- **Write**: Page, Text | Note, Annotation; Diagram's adds Pointer note and Callout to the notes, then Comment,
  Action as a third group, **Comments**.
- **Draw**: Polygon | Arrow, Line.
- **Build**: Mind node, Table | Lane, Frame, Timeline.
- **Diagrams** (Diagram): Mind node, Org chart, Flowchart, Sequence, Table | Entity.
- **Layout** (Diagram): Lane, Frame, Stack, Boundary, Timeline | Diagram key, Card, Badge, Step number, headed
  **Containers** and **Parts** in the flyout.
- **Components**: the cards (Code, Checklist, Entity) | the website blocks.
- **Devices**: desktop (Browser, Monitor, Laptop) | mobile (Phone, Tablet, Foldable, Watch).
- **Media**: Image | the embeds | Avatar.
- **Data**: the charts (Pie, Bar, Line, Legend) | the meters (Progress, Donut, Rating).

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
so a new page load starts on the mode's landing (Plan's Cards, or Boards while the tab has no board).

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
- Not on a phone: the top row is the strip's there.

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
toolbar across the canvas's top whose span meets its column, the strip (`usePopoverTopClearance`), and
12 px from the canvas's top otherwise: on a phone the strip spans the width, and a tall panel ran up under it with its
header hidden.

## One menu at a time

The strip's menus (selection mode, category, More, Search) and the Explorer popover
are menus: opening one closes whichever other is open, and a press anywhere
outside closes it. The strip stops `pointerdown` from reaching the canvas, so
their outside-press listeners run in the capture phase, before that. The
Explorer popover gets the same (`dismissOnOutside`), and so do the Layers and
Collaborate popovers ([Editor app](editor-app.md)). The strip's dropdown menus are kept
on screen sideways as well as vertically, whatever the trigger's position.

## One layout

There is no layout choice. An earlier version offered a second layout, **Floating**, as the
desktop default: the Palette as a draggable corner panel, the Explorer as a corner panel, Layers
minimising into its cluster button, and Draw mode's tools inside the Palette panel. It was retired
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
panels in their corners, Layers and Collaborate as popovers over
their bottom-row buttons. What changes to fit the width:

- **The menu button gets its own card, left of the strip.**
  The card sits at the left gutter and the strip follows it 8px to the right,
  left-aligned rather than centred, so the two read as separate toolbars on
  one row. There is no room for a corner card above a strip that needs the
  whole top row.
- **The category picker is icon-only**, like the selection mode, and the two sit together with no divider between
  them, each caret 4px from its glyph. The strip's tiles are 32px wide (36px elsewhere), so more fit in view.
- **The tiles swipe.** The strip holds the whole current category and fills the row to the
  right gutter; only its tiles scroll sideways, under a finger, while the selection mode, the
  category picker and More stay put. The scrollbar is hidden ([Scrollbars](../004-interface-design/scrollbars.md)):
  a tile cut at the edge shows there is more. A new category starts scrolled to its first tile.
  More never shows ([More](#more-the-rest-of-the-category)): the swiping strip reaches every
  category's tiles, and Icons, Stickers and Technology their groups.
- **More spans the screen** between the gutters instead of hanging from its
  button.
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
  (timer, vote, [Canvas and palette](../008-canvas/canvas-and-palette.md)) moves
  down to clear it.
- **Messages hang from the strip, as its tray.** The messages that tell you what the next press does (the
  mode banners: a tile in hand, "Select the board column you want this card to appear in") and the modifier hint (Shift, Alt) attach to the strip's bottom edge instead of floating
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
    Templates**, which opens the start again, until the first element lands. Start Planning has no ×
    ([Start panel](start-panel.md)), so in liveplanner this message does not arise.
  - While a mode banner sits in the tray, the top-centre stack starts below the tray instead.
  - While one of the strip's popovers is open (a category's flyout, More, a catalogue group, Search) the tray steps aside, as it does
    for the Explorer: it would cover the popover's top.
  - Without a strip (zen, read-only, the welcome flow) the messages stay the
    top-centre pills they are elsewhere.
- Read-only sessions have no palette, so no strip. The menu button still
  shows.
- Zen hides the strip and the menu button along with the rest of the chrome.

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

- **The strip opens on the mode's landing every time** (Plan's)
  ([Editor modes](editor-modes.md#the-palette-per-mode)). It does not remember the last category across projects.
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
  a docked panel (the Eraser panel, say) sat under the strip's right end and
  could not be reached.
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

The Palette category of the help centre went with the palette; the Plan
category (`/help/plan/`) explains the editor Plan shows.
