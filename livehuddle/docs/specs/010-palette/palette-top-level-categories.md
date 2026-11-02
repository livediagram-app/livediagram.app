# Palette top-level categories and bands

Status: shipped

## What

A flattening of the palette's category structure.

In Diagram and Workshop the strip now shows these categories as a **category bar**, each opening a
flyout of its tiles, with no Popular, one-word names, Write and Draw apart, and Workshop's session tools gathered
into Session ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)). The bands below are the bar's
dividers there.

This is the category catalogue and each category's **default** tiles. Which
categories a palette offers, under what names and holding which tiles, is now
per editor mode: see [Editor modes, "The palette per
mode"](../007-editor/editor-modes.md#the-palette-per-mode).

**There is no Tools tab.** Every tool group is a top-level palette category of its own.

The full set, in band order: **Popular**, then **Shapes / Write / Draw /
Devices**, then **Icons / Stickers / Technology / Media / Components**, then
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

| Band            | Categories                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _(no heading)_  | Popular, full width                                                                                                                                                                                                                                    |
| **Common**      | Shapes, My shapes (only with a [shape library](../013-workspace/shape-libraries.md) to place), Write, Draw                                                                                                                                             |
| **Structure**   | Diagrams (Diagram), Layout (Diagram, Workshop), Concepts ([Concept graphics](../009-elements/concept-graphics.md)), Event Storming (on an event-storming board only); Components and Devices are in the catalogue but on no mode's strip (Search only) |
| **Decorate**    | Icons, Stickers, Technology, Media                                                                                                                                                                                                                     |
| **Dynamic**     | Data (Workshop)                                                                                                                                                                                                                                        |
| **Collaborate** | Ask, Tools, Record, React, Selection Mode, Navigate ([Workshop](../012-collaboration/workshop-mode.md#the-palette) only)                                                                                                                               |

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

Write, Draw, Collaborate, Data, Components, Concepts, Media and Devices render as **rows
with a one-line blurb**, not as the icon-over-caption grid.

The rule is whether the picture explains the thing, and only four categories
pass it: **Shapes**, **Icons**, **Stickers** and **Technology**, where the
glyph IS the answer. A square tile explains a square. A cursor-on-a-target does not explain
a Picker, a donut does not explain "how far along something is", a wireframe
thumbnail shows a composite's arrangement but not its job, six device outlines
are six grey rectangles of slightly different proportions, and two picture
frames at 18px do not distinguish an image from an avatar.

`palette-tile-defs.test.tsx` requires a blurb on every tile in every
row-rendered section, so a new one can't ship as a bare row.

## No User element

There is no actor / stick-figure tile in the palette or the "Add to canvas" search catalogue: nothing creates one.

The `actor` **shape kind is kept** in the model, the renderer and the wire schema: removing it would coerce every
existing actor element to a square on next load (`coerceShape`'s fallback), silent data loss, and would break API
and MCP callers. So it renders wherever one exists, and nothing adds one.

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
Icons, Stickers and Technology tabs still search their own catalogues
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

**Collaborate is Workshop's, as six categories.** Only Workshop's layout ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)) offers the Collaborate elements, and it offers each group below as its
own category in a **Collaborate** band of its own (`collab-ask`, `collab-tools`, `collab-record`, `collab-react`,
`collab-mode`, `collab-navigate`), with no parent category; five of them sit behind the bar's Session category
([Toolbar layout](../007-editor/toolbar-layout.md)). Diagram
keeps only the Comment panel and the Action card, in its Write category. Search still finds every
Collaborate tile from any mode.

**Named Collaborate.** The category is what you open to run a session with the room, and "Collaborate" names that
job. The internal id is `behaviour` (persisted in the strip's state, palette layouts and telemetry types such as
`BehaviourSearch`), and the help article is at `/help/palette/behaviour/`. No group is called Collaborate, so the
name is not repeated one level down.

**One category, one test**: **does this element's content arrive at runtime rather than being drawn by the
author?** Pressing something that acts on your session and the canvas collecting an answer from everybody are
both what you reach for while running a session, so they are one category ([The Done check](../012-collaboration/done-check.md)
is filed with the estimate card, not apart from it).

| Group              | Holds                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Ask**            | the three estimate scales, Quiz, Temperature, Idea box, Dot vote, Poll                                                            |
| **Tools**          | Reveal, Done, Picker, Timer                                                                                                       |
| **Record**         | Comment panel, Agenda, Decision record, Roll call                                                                                 |
| **Reactions**      | the five pads                                                                                                                     |
| **Selection Mode** | one button per mode (8)                                                                                                           |
| **Navigate**       | Portal, Chair, Desk, Sofa, Fence, Avatar Pad, Link card, Room, Meeting Table, Plant, Bookshelf, Water Cooler, Coffee Machine, Rug |

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

Build, Components and Devices sit in their own band above Decorate.

All three are things you lay a canvas OUT with rather than draw on it: Build's
containers, the ready-made page composites, the device frames a wireframe sits
inside. Arranging a canvas comes before dressing it, which is the order the
bands now read in: Common, Structure, Decorate, Dynamic.

The category array must stay sorted by band: the category picker renders it
straight through and groups under the headings without sorting, so a
misplaced entry appears under the wrong one.

## Group counts are a badge

A collapsible group shows its tile count as a badge beside the title, not
folded into the blurb. "5 ways to celebrate on the board" made the reader
parse a sentence to learn a quantity, and left the blurb unable to simply say
what the group is for ("React on the canvas").
