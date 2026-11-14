# Palette top-level categories and bands

Status: shipped. **In livehuddle, the categories and bands are the meeting palette's** (Work Tracker #423,
[The meeting board](../012-collaboration/workshop-mode.md#the-palette)): Popular; Write; Rooms, Seats, Perks,
Play, Garden, Meet; Travel. Stickers is search-only ([Stickers in search only](#stickers-in-search-only)). The band holding the Space categories but Travel is named
**Meet**; Travel is a band of its own (**Travel**, band 7), so the strip sets it apart between two dividers
([The strip's order](#the-strips-order)). The Icons category is gone from livehuddle
([Icons](../002-project-scope/not-in-livehuddle.md#icons)): Stickers is the palette's decoration. So is the Media
category, with adding a Link card anywhere ([Media](../002-project-scope/not-in-livehuddle.md#media-image-and-link-card)); the
Image is in **Write** ([Images are back](../002-project-scope/not-in-livehuddle.md#images-are-back)). The Frame category (and then the Frame itself, [The Frame](../002-project-scope/not-in-livehuddle.md#the-frame)), Reaction Pads, and the Laser, Spotlight and Isometric mode buttons,
are gone from livehuddle ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)), so there is no React category.
The **Selection Mode** category (bar name "Modes") is gone too: its Select, Hand, Eraser and Format buttons left
livehuddle, and the Avatar one moved to Travel ([Selection Mode button](../009-elements/mode-button.md#only-avatar)).
See [The Space categories](#the-space-categories) for why one Navigate category became four. The Collaborate band's other categories, the Structure and Dynamic bands and the Session category below
are livediagram's Workshop layout, gone from livehuddle's palette since part 3; the mechanics (flat categories, rows,
search, the pickers, group count badges) stay.

## The Space categories

livehuddle's palette once held every piece a Space is built from in one **Navigate** category: sixteen tiles split by
a divider into "Around the Space" and "Office Pieces". The catalogue is growing, and one category of everything a
Space holds would only get longer. So the meeting palette offers them as **seven top-level categories**, each a
question somebody building a Space asks, in the Meet band (Travel in a band of its own, [The strip's order](#the-strips-order)):

| Category   | id                  | Holds                                                                                                                                                                                                                                                                                                                                                               | The question                     |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Seats**  | `collab-seating`    | Chair, Desk, Sofa, Meeting Table, Long Table, Bean Bag, Reading Nook, Hot Desk, Standing Desk ([Workday pieces](../009-elements/workday-pieces.md#where-they-live))                                                                                                                                                                                                 | Where do people sit?             |
| **Rooms**  | `collab-rooms`      | **Build**: Room, Room Builder, Door; **Floor**: Fence, Stage, Stage Curtains, Podium, Office Pod, Phone Booth, Nap Pod, Reception Desk, Rug, Pillar, Column ([Venue pieces](../009-elements/venue-pieces.md#where-they-live), [Workday pieces](../009-elements/workday-pieces.md#where-they-live))                                                                  | How is the floor laid out?       |
| **Perks**  | `collab-amenities`  | In three groups ([Office amenities](../009-elements/office-amenities.md#where-they-live)): Office (Plant, Bookshelf, Printer, Copier, Lockers, Coat Rack, Umbrella Stand), Kitchen (Water Cooler, Coffee Machine, Vending Machine, Kitchen Counter, Kitchen Sink, Fridge, Microwave, Kettle), Restroom (the Restroom preset, Toilet Cubicle, Washbasin, Hand Dryer) | What makes it feel like a place? |
| **Play**   | `collab-recreation` | **Bar**: Bar, Bar Stool, Drinks Cabinet, Drinks Fridge; **Games**: Ping-Pong Table, Pool Table, Foosball Table, Arcade Machine, Dartboard; **Gym**: Treadmill, Weight Bench; **Lounge**: Jukebox, Fireplace, Pet Bed                                                                                                                                                | Where do people unwind?          |
| **Garden** | `collab-garden`     | **Plants**: Outdoor Plant, Tree, Grass; **Paths and Fences**: Garden Path, Garden Fence; **Furniture**: Bench, Picnic Table, Hammock, Garden Umbrella; **Features**: Fountain, Pond, Swimming Pool, Campfire; **Parking**: Car Park, Bike Rack                                                                                                                      | Can we take it outside?          |
| **Meet**   | `collab-meeting`    | Screen, Room Sign, Notice Board, World Clock, Calendar Wall, Suggestion Box, Team Photo Wall, Timer, Stopwatch ([Team pieces](../009-elements/team-pieces.md#where-they-live))                                                                                                                                                                                      | What does a meeting room need?   |
| **Travel** | `collab-travel`     | Portal, Bring Focus, Avatar Pad, Directory, Signpost, Elevator, Stairs, Avatar Button                                                                                                                                                                                                                                                                               | How do people get somewhere?     |

- **Data, not special cases.** Each tile names its category through its `tileGroup` (`travel`, `seating`, `rooms`,
  `amenities`, `recreation`, `garden`, `meeting`), and `COLLABORATE_CATEGORY_GROUPS` maps each category id to its
  group. A new piece of furniture joins its category the day it lands by carrying the group; a new kind of piece gets
  a group, a category entry (label, blurb, glyph) and a line in the meeting layout. Nothing in the bar, the flyouts or
  the search names a tile.
- **Room to grow.** A category with no tiles is left off the palette, the bar and the search
  (`paletteCategoriesFor`), so a new category appears the day its first piece carries its group. An Office Pod is a
  room within the floor: `tileGroup: 'rooms'`.
- **Play holds the Bar.** The owner (2026-11-06): "Merge Bar and Recreation Categories into Recreation, then
  subcategorise". The bar pieces ([Office](../009-elements/office.md) "Bar, Bar Stool") carry `tileGroup:
'recreation'`, so there is no Bar category (`collab-bar`) and no `bar` tile group. Play is where people unwind:
  a drink at the bar, a game, a seat by the fire. Nothing stored names a category id (no pinned or last-opened
  category is saved), so the old id needs no mapping.
- **One word each**, so the category bar needs no short names for them.
- **Glyphs**: Travel keeps the arrow through a doorway Navigate wore; Seats an armchair, Rooms a floor plan of
  panels, Perks a coffee cup, Play a wine glass (the glyph Start a Space's Recreation templates wear, so the
  one word wears one picture), Garden a pine tree, Meet a wall screen
  ([Screen and Room Sign](../009-elements/screen-and-room-sign.md)).
- **Groups inside Rooms, Play and Garden.** Seats, Perks, Meet and Travel hold four to six tiles of one
  kind, so their flyout is one block. Rooms, Play and Garden mix kinds, so each flyout splits into named groups
  ([Groups in a flyout](#groups-in-a-flyout)).
- **Rooms opens on Build.** The owner (2026-11-05): "Room is hard to discover and a critical first piece". So the Rooms
  flyout leads with a **Build** group, in order **Room**, **Room Builder**, **Corridor**, **Door** and **Window** (what a room is
  made with, and what joins rooms),
  then **Floor**: the rest of Rooms (Fence, Stage, Stage Curtains, Podium, Office Pod, Phone Booth, Nap Pod, Reception Desk, Rug,
  Pillar, Column). Each tile
  shows once, and a new rooms piece joins Floor by its `tileGroup` alone ([Groups in a flyout](#groups-in-a-flyout)).
  The flyout opens at its top, so Build is the first thing seen. Popular, which also holds the Room, stays one block.
- **Defined once**, in `space-categories.tsx` (`SPACE_CATEGORIES`: id, tile group, label, blurb, flyout tagline,
  glyph); the category catalogue, the meeting layout, the flyout taglines and `COLLABORATE_CATEGORY_GROUPS` read it.
- Popular still picks the Space pieces a Space is most often furnished with (Room, Meeting Table, Chair, Bring Focus,
  Avatar Pad) from across them.

### Groups in a flyout

The owner (2026-11-06): "Sub categorise the garden elements in the palette popover" and "Merge Bar and Recreation
Categories into Recreation, then subcategorise". A flyout that mixes kinds of piece reads as a list of named groups,
each under its heading, in this order:

| Category   | Group                | Tiles                                                                  |
| ---------- | -------------------- | ---------------------------------------------------------------------- |
| **Rooms**  | **Build**            | Room, Room Builder, Door                                               |
|            | **Floor**            | Fence, Stage, Office Pod, Rug                                          |
| **Play**   | **Bar**              | Bar, Bar Stool, Drinks Cabinet, Drinks Fridge                          |
|            | **Games**            | Ping-Pong Table, Pool Table, Foosball Table, Arcade Machine, Dartboard |
|            | **Lounge**           | Jukebox, Fireplace                                                     |
| **Garden** | **Plants**           | Outdoor Plant, Tree, Grass                                             |
|            | **Paths and Fences** | Garden Path, Garden Fence                                              |
|            | **Furniture**        | Bench, Picnic Table, Hammock, Garden Umbrella                          |
|            | **Features**         | Fountain, Pond, Campfire                                               |

- **Names** are Title Case and short, as the other flyouts' groups (Basics, Flowchart, Code and Lists).
- **Play leads with the Bar**: its four pieces are the most furnished (a Rooftop Bar, a Cafe, a hotel lobby),
  then what people play, then what they sit by and listen to.
- **Garden reads ground up**: what grows, then what is walked on and round, then what is sat at, then the water and
  fire a garden is built around.
- **The mechanism.** The meeting layout lists each grouped category's groups in order (`SPACE_GROUPS` in
  `palette-layouts.ts`), a divider between two groups; a piece of the category that no group lists joins the last
  group, so a new piece still lands by its `tileGroup` alone and never drops out. Each group's name is a
  `GROUP_NAMES` entry (`category-flyout-groups.ts`) keyed by its first tile, the flyout's usual rule: a category shows
  its headings only when every group has one, and the card columns stay the category's (two for each), so the groups
  line up down the flyout.

## The strip's order

The owner (2026-11-05) set the category bar's order, a hairline divider between each band (Bar merged into
Play on 2026-11-06, [Play holds the Bar](#the-space-categories)):

```
Write | Rooms Seats Perks Play Garden Meet | Travel
```

- **Write** first: a note or a word is what anybody reaches for first, and a picture (a logo, a team photo) beside
  them.
- **Then building the Space**, floor first: Rooms (the floor plan), then what goes in it (Seats, Perks,
  Play, Garden) and the meeting room's own pieces (Meet).
- **Travel apart**: its pieces (Portal, Bring Focus, Avatar Pad, Directory, Elevator, Stairs, the Avatar Button) take people
  somewhere rather than furnish a place, so it stands alone between two dividers.
- **No Stickers on the strip**: the decoration is found through Search, not a category button
  ([Stickers in search only](#stickers-in-search-only)). No Media ([Media](../002-project-scope/not-in-livehuddle.md#media-image-and-link-card)): the Image is Write's.
- **The mechanism is the bands.** The bar draws its divider wherever two neighbours' bands differ (`CategoryBar`'s
  band change), so Travel's divider is its band: `SPACE_CATEGORIES` gives Travel `band: 7`, the rest of the Space
  categories take the Meet band (6). `SPACE_CATEGORIES` is in this order, so the meeting layout, the flyouts and the
  search read it as they always have.
- **On a phone** the bar is the strip's swipeable rail (`scrollable`), so the longer row swipes sideways and the
  Edit | Walk toggle and Search beside it (glyphs alone) stay in reach. The categories are **always named** there
  (owner, 2026-11-07: "On mobile, in the palette, always include labels for the buttons and categories, it scrolls so
  its not an issue that they don't all fit on screen"); between a phone and a wide window the names drop to glyphs when
  the named bar does not fit (`useBarLabels`), as before.

## No Selection Mode picker

The building strip starts with the [Edit | Walk toggle](../008-canvas/avatar-mode.md#the-edit--walk-toggle), not a
canvas-tool picker (owner, 2026-11-06: "change the selection mode dropdown so it just lets me toggle between Editor
and ... whatever using the board is without too long a name"). The picker's Build (Select, Hand) and Edit (Eraser,
Format) bands went with it: Edit is plain selecting; panning is Space-drag, the trackpad, the middle button or a touch
drag on empty canvas; Delete removes; the Format Painter is on the selection toolbar
([Format panel](../008-canvas/format-panel.md)). The one Selection Mode button left in livehuddle, the Avatar Button in
Travel, offers Avatar.

## What

A flattening of the palette's category structure.

The strip now shows these categories as a **category bar**, each opening a
flyout of its tiles, with no Popular, one-word names, Write and Draw apart, and Workshop's session tools gathered
into Session ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)). The bands below are the bar's
dividers there.

This is the category catalogue and each category's **default** tiles. Which
categories the palette offers, under what names and holding which tiles, is the
palette layout's: see [Editor modes, "The palette"](../007-editor/editor-modes.md#the-palette).

**There is no Tools tab.** Every tool group is a top-level palette category of its own.

The full set, in band order: **Popular**, then **Shapes / Write / Draw**, then
**Icons / Stickers / Media / Components**, then
**Data / Collaborate**. (Stickers joined the Decorate band later, in
[Stickers](stickers.md); a first Collaborate category was merged into Behaviours later
still, and Behaviours was then renamed Collaborate; see below.)

Where things landed, for anything that moved:

| Moved                           | To              |
| ------------------------------- | --------------- |
| Code Block, Checklist, Timeline | **Components**  |
| Table                           | **Data**        |
| Annotation                      | **Write**       |
| Frame                           | **Draw**        |
| Image, Avatar                   | **Media** (new) |

The **Blocks** and **Structure** groups emptied out and were deleted; **Write &
Draw** split into **Write** (the wordy elements) and **Draw** (the gesture
tools plus Frame). The **User / actor** tile was deleted outright; see below.

**The category dropdown gets bands**, the way the canvas-tool dropdown got them
([Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md)):

| Band            | Categories                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| _(no heading)_  | Popular, full width                                                                                                     |
| **Common**      | Shapes, Write, Draw (My shapes left with [shape libraries](../013-workspace/shape-libraries.md))                        |
| **Structure**   | Layout (with the [Timeline](../009-elements/timeline.md)); Components is in the catalogue but on no strip (Search only) |
| **Decorate**    | Icons, Stickers, Media                                                                                                  |
| **Dynamic**     | Data                                                                                                                    |
| **Collaborate** | Ask, Tools, Record, React, Selection Mode, Navigate ([Workshop](../012-collaboration/workshop-mode.md#the-palette))     |

## Why flatten

Every one of these was a group inside Tools, which meant two levels of
navigation before you saw a tile: open Tools, then open the category. That is
the right cost for "which of the twenty tools is the polygon one" and the wrong
cost for a set you go to deliberately.

It hurt Behaviour most. Selection Mode buttons, Portals, Session buttons,
Reveal zones and Pickers ([Selection Mode button](../009-elements/mode-button.md) to [Picker](../012-collaboration/picker.md)) are the palette's newest
elements and the ones a user is least likely to know exist. Burying them two
levels down is where a new feature goes to hide.

Data had been standalone before and was folded into Tools when the drill-in
landed; six charts sitting behind a category tile turned out to be the same
mistake in a smaller way.

## Why Popular has no band

Popular is not a _kind_ of thing: it draws from every category at once. Filing it under "Common" would
claim a peer relationship with Shapes and Write that it does not have.

So it sits **full width above the first heading**, with no band of its own. The
grid has a `fullWidth` option for this, and it lays its glyph beside the
label rather than above it.

## Rows, not tiles, for most categories

Write, Draw, Collaborate, Data, Components and Media render as **rows
with a one-line blurb**, not as the icon-over-caption grid.

The rule is whether the picture explains the thing, and only three categories
pass it: **Shapes**, **Icons** and **Stickers**, where the
glyph IS the answer. A square tile explains a square. A cursor-on-a-target does not explain
a Picker, a donut does not explain "how far along something is", a wireframe
thumbnail shows a composite's arrangement but not its job, and two picture
frames at 18px do not distinguish an image from an avatar.

`palette-tile-defs.test.tsx` requires a blurb on every tile in every
row-rendered section, so a new one can't ship as a bare row.

## No User element

There is no actor / stick-figure tile in the palette or the "Add to canvas" search catalogue: nothing creates one.

The `actor` shape kind left livehuddle with the other diagram shapes ([The element engine](../002-project-scope/not-in-livehuddle.md#the-element-engine), part 5). A stored
one is a [retired element](../002-project-scope/not-in-livehuddle.md#retired-elements): kept exactly as stored (no
coercion rewrites it, the fallback that once made it a square is gone) and drawn as its placeholder named **Actor**,
which an Editor can delete.

## The body scrolls when it has to

A long category (Components runs to ten rows) must not run off the bottom of a
short window. The panel body's height is
capped at the space between its top edge and the bottom chrome: the zoom dock
and the tab bar, both measured rather than assumed, since the dock hides in Zen
mode, and only then does it scroll. A category that fits shows no scrollbar
and still animates its height on switch.

## Searching across the categories

Flattening put every element one click away but spread them over ten
categories, so "where does Checklist live now" needed an answer that isn't
"open each one". The editor's **Search** panel answers it: it searches every tile by caption,
label, blurb and description, and picking a result arms the same placement the
palette uses ([Canvas and palette](../008-canvas/canvas-and-palette.md)). The
Icons and Stickers tabs still search their own catalogues
([Browsing the palette by category](palette-category-browse.md)).

## The pickers unfold from their trigger

Both palette dropdowns grew from their own centre-top, which made opening the
canvas-tool picker and the category picker look identical: the one thing the
animation exists to distinguish.

The menu's `transform-origin` is now the corner its trigger sits at: top-left
for the left-aligned canvas-tool picker, top-right for the right-aligned
category picker (and the bottom corners when a menu flips up). One
direction-agnostic keyframe scales uniformly out of that origin, replacing the
old `scaleY`-only pair: squashing the Y axis on top of a corner origin read as
a blind coming down rather than a menu growing out of a button.

## What did not move

The help centre's URLs. The data articles still live under
`/help/palette/tools/data-elements/`, and the Behaviour ones under
`/help/palette/tools/`. Those are a documentation hierarchy, not a mirror of
the palette's, and moving them would break every existing link for a cosmetic
match. The article **copy** was updated, since a reader sent to the Tools tab
looking for a chart would not find one.

The same call was made when **Collaborate merged into Behaviours**: its seven
articles keep their `/help/palette/collaborate/` URLs and their parent page,
and only the copy changed: it now says where the elements actually live and
which two groups they are. A rename that broke seven live links to say
"Behaviours" in a path would be a cosmetic match bought with real breakage.

## Collaborate: one category, fully grouped

**Collaborate, as six categories.** Workshop's layout ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)) offers the Collaborate elements, and it offers each group below as its
own category in a **Collaborate** band of its own (`collab-ask`, `collab-tools`, `collab-record`, `collab-react`,
`collab-mode`, `collab-navigate`), with no parent category; five of them sit behind the bar's Session category
([Toolbar layout](../007-editor/toolbar-layout.md)). The Comment panel and the Action card are in Write.

**Named Collaborate.** The category is what you open to run a session with the room, and "Collaborate" names that
job. The internal id is `behaviour` (persisted in the strip's state, palette layouts and telemetry types such as
`BehaviourSearch`), and the help article is at `/help/palette/behaviour/`. No group is called Collaborate, so the
name is not repeated one level down.

**One category, one test**: **does this element's content arrive at runtime rather than being drawn by the
author?** Pressing something that acts on your session and the canvas collecting an answer from everybody are
both what you reach for while running a session, so they are one category ([The Done check](../012-collaboration/done-check.md)
is filed with the estimate card, not apart from it).

| Group                           | Holds                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **Ask**                         | the three estimate scales, Quiz, Temperature, Idea box, Dot vote, Poll               |
| **Tools**                       | Reveal, Done, Picker, Timer                                                          |
| **Record**                      | Comment panel, Agenda, Decision record, Roll call                                    |
| **Travel, Seats, Rooms, Perks** | the Space pieces, as four categories ([The Space categories](#the-space-categories)) |

**There is no Session group**: a group named after the machinery rather than the job. A poll and a dot vote ARE
asking the room, so they sit with the estimate card and the temperature check, where somebody wanting to put a
question to everybody looks; a timer is facilitation, so it sits with the Reveal, the Done check and the Picker.

They remain one shape kind with a `session` config ([Session button](../012-collaboration/session-button.md)):
this is a palette grouping, not a model change.

The **Comment panel** is in **Record**: a comment thread is a thing you leave behind on the canvas for somebody to
find later, which is exactly what the agenda, the decision record and the roll call are. Every tile is in a group.

Order is **room-first**: the three groups a facilitator opens mid-session come
before the three you set up once and forget.

Data-side, the Collaborate tiles are `section: 'tools'` with `toolGroup: 'behaviour'`, so `tilesForCategory` and
the tab body need no special case.

The grouping is by **what the element does with the room**, not by what it
looks like. That is the same rule that produced the Build category ([The Build palette category](build-category.md)),
and it is why Portal sits with Chair and the Link card (all three take you
somewhere: another tab, a seat, the page itself) rather than with Reveal
(which the facilitator drives). The Link card came here from Components, which
groups by what a thing looks like: a ready-made composite you recolour and
retitle. A link card is neither composite nor decoration, so it read as filler
in that category and as an obvious member of this one.

Three kinds were split into a tile per variant at the same time, on the
[More than YouTube](../009-elements/embed-providers.md) pattern: selection modes, session tools, reactions, and estimate
scales. In every case the variant IS the decision: you know which mode, which
tool, which scale before you reach for the palette, so placing a default and
then reconfiguring it was two steps for something already settled. They remain
one shape kind each with a mode field; the choice rides the draw intent.

## The Structure band

Build and Components sit in their own band above Decorate.

Both are things you lay a canvas OUT with rather than draw on it: Build's
containers and the ready-made page composites. Arranging a canvas comes before dressing it, which is the order the
bands now read in: Common, Structure, Decorate, Dynamic.

The category array must stay sorted by band: the category picker renders it
straight through and groups under the headings without sorting, so a
misplaced entry appears under the wrong one.

## Group counts are a badge

A collapsible group shows its tile count as a badge beside the title, not
folded into the blurb. "5 ways to celebrate on the board" made the reader
parse a sentence to learn a quantity, and left the blurb unable to simply say
what the group is for ("React on the canvas").

## Stickers in search only

Stickers stays in the meeting layout as a **search-only** category (`searchOnly: true` on its layout entry): the
strip, the phone row and the category tabs leave it off (`paletteCategoriesFor`), while Search still finds every
sticker by name and places it here, as an offered category (`paletteCategoryOffered` reads the whole layout, search-only
entries included). Owner decision 2026-11-06: a long strip, and stickers are reached for by name, not by browsing.
