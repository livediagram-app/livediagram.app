# Palette top-level categories and bands

Status: shipped

## What

A flattening of the palette's category structure.

In Pages the strip shows these categories as a **category bar**, each opening a flyout of its tiles, with no
Popular and one-word names ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)). The bands below are
the bar's dividers.

This is the category catalogue and each category's **default** tiles. Which categories a palette offers, under what
names and holding which tiles, follows the page kind: see [Pages mode, "The palette's
kind"](../007-editor/pages-mode.md#the-palettes-kind).

**The Tools tab is gone.** Every group it held became a top-level palette category of its own, and a tab with no
categories left is not a tab.

Where things landed, for anything that moved:

| Moved                           | To              |
| ------------------------------- | --------------- |
| Code Block, Checklist, Timeline | **Components**  |
| Table                           | **Data**        |
| Frame                           | **Draw**        |
| Image, Avatar                   | **Media** (new) |

The **Blocks** and **Structure** groups emptied out and were deleted; **Write & Draw** split into **Write** (the wordy
elements) and **Draw** (the gesture tools plus Frame). The **User / actor** tile was deleted outright — see below.

**The category bar has bands**, the way the canvas-tool dropdown got them
([Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md)):

| Band          | Categories                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Common**    | Shapes, Write, and Draw on a logo page ([logo pages](../007-editor/logo-pages.md#the-logo-palette))                            |
| **Structure** | Concepts ([Concept graphics](../009-elements/concept-graphics.md)), Components, Devices                                        |
| **Decorate**  | Icons, Stickers, Media                                                                                                         |
| **Dynamic**   | Data                                                                                                                           |
| **Screen**    | Components and Elements, first, on a wireframe page ([wireframe pages](../007-editor/wireframe-pages.md#the-elements-palette)) |

## Why flatten

Every one of these was a group inside Tools, which meant two levels of navigation before you saw a tile: open Tools,
then open the category. That is the right cost for "which of the twenty tools is the polygon one" and the wrong cost
for a set you go to deliberately.

Data had been standalone before and was folded into Tools when the drill-in landed; six charts sitting behind a
category tile turned out to be the same mistake in a smaller way.

## Why Popular has no band

Popular is not a _kind_ of thing: it draws from every category at once. Filing it under "Common" would claim a peer
relationship with Shapes and Write that it does not have, so where it shows (the More and Search surfaces) it sits
**full width above the first heading**, with no band of its own. The grid has a `fullWidth` option for this, and it
lays its glyph beside the label rather than above it.

## Rows, not tiles, for most categories

Write, Draw, Data, Components, Concepts, Media and Devices render as **rows with a one-line blurb**, not as the
icon-over-caption grid.

The rule is whether the picture explains the thing, and only three categories pass it: **Shapes**, **Icons** and
**Stickers**, where the glyph IS the answer. A square tile explains a square. A donut does not explain "how far along
something is", a wireframe thumbnail shows a composite's arrangement but not its job, six device outlines are six grey
rectangles of slightly different proportions, and two picture frames at 18px do not distinguish an image from an
avatar.

`palette-tile-defs.test.tsx` requires a blurb on every tile in every row-rendered section, so a new one can't ship as
a bare row.

## The User element was deleted

The actor / stick-figure tile is gone from the palette and from the "Add to canvas" search catalogue, and the AI
prompt no longer offers `actor` as a shape to emit. Nothing can create one any more.

The `actor` **shape kind** has since been removed from the model, the renderer and the wire schema as well, with
the other flowchart-only kinds: livedesign has no stored designs that could hold one.

## The body scrolls when it has to

A long category (Components runs to ten rows) never runs off the bottom of a short window. The panel body's height is capped at the space between its top edge and the bottom chrome — the zoom
dock and the tab bar, both measured rather than assumed, since the dock hides in Zen mode — and only then does it
scroll. A category that fits shows no scrollbar and still animates its height on switch.

## Searching across the categories

Flattening put every element one click away but spread them over ten categories, so "where does Checklist live now"
needed an answer that isn't "open each one". The editor's **Search** panel answers it: it searches every tile by
caption, label, blurb and description, and picking a result arms the same placement the palette uses
([Canvas and palette](../008-canvas/canvas-and-palette.md)). The Icons and Stickers tabs still search their own
catalogues ([Browsing the palette by category](palette-category-browse.md)).

## The pickers unfold from their trigger

Both palette dropdowns grew from their own centre-top, which made opening the canvas-tool picker and the category
picker look identical — the one thing the animation exists to distinguish.

The menu's `transform-origin` is now the corner its trigger sits at: top-left for the left-aligned canvas-tool picker,
top-right for the right-aligned category picker (and the bottom corners when a menu flips up). One direction-agnostic
keyframe scales uniformly out of that origin: a `scaleY`-only pair, squashing the Y axis on top of a
corner origin read as a blind coming down rather than a menu growing out of a button.

## What did not move

The help centre's URLs. The data articles still live under `/help/palette/tools/data-elements/`. Those are a
documentation hierarchy, not a mirror of the palette's, and moving them would break every existing link for a
cosmetic match. The article **copy** was updated, since a reader sent to the Tools tab looking for a chart would not
find one.

## The Structure band

Concepts, Components and Devices sit in their own band above Decorate.

All three are things you lay a page OUT with rather than draw on it: the concept graphics, the ready-made page
composites, the device frames a screenshot sits inside. Arranging a page comes before dressing it, which is the order
the bands read in — Common, Structure, Decorate, Dynamic.

The category array must stay sorted by band: the category bar renders it straight through and groups under the
headings without sorting, so a misplaced entry appears under the wrong one.

## Group counts are a badge

A collapsible group shows its tile count as a badge beside the title, not folded into the blurb. Making the reader
parse a sentence to learn a quantity left the blurb unable to simply say what the group is for.
