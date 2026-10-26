# Palette top-level categories and bands

## What

A flattening of the palette's category structure.

In Pages the strip shows these categories as a **category bar**, each opening a flyout of its tiles, with
one-word names ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)). The bands below are
the bar's dividers.

This is the category catalogue and each category's **default** tiles. Which categories a palette offers, under what
names and holding which tiles, follows the page kind: see [Pages mode, "The palette's
kind"](../007-editor/pages-mode.md#the-palettes-kind).

**There is no Tools tab.** Each group of elements is a top-level palette category of its own: Shapes, Write,
Concepts, Components, Devices, Icons, Stickers, Media and Data. Code Block, Checklist and Timeline sit in
**Components**; Table in **Data**; Image and Avatar in **Media**. **Write** holds the wordy elements. There is no
User / actor tile (see below).

**The category bar has bands**, the way the canvas-tool dropdown got them
([Tile grids for the palette dropdowns](../004-interface-design/dropdown-tile-grid.md)):

| Band          | Categories                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| **Common**    | Shapes, Write; Media on a slide                                                         |
| **Structure** | Concepts ([Concept graphics](../009-elements/concept-graphics.md)), Components, Devices |
| **Decorate**  | Icons, Stickers, Media                                                                  |
| **Dynamic**   | Data                                                                                    |

## Why top-level

A group inside a Tools tab would mean two levels of navigation before you saw a tile: open Tools, then open the
category. That is the right cost for "which of the twenty tools is the polygon one" and the wrong cost for a set you
go to deliberately, the charts included.

## No Popular

There is no Popular category, a pick of tiles from across the others. There is none
([Toolbar layout](../007-editor/toolbar-layout.md#what-is-on-it) "No Popular"): with every category one press away
on the bar, a pick from across them adds nothing. Every tile sits in exactly one category of a layout.

## Rows, not tiles, for most categories

Write, Draw, Data, Components, Concepts, Media and Devices render as **rows with a one-line blurb**, not as the
icon-over-caption grid.

The rule is whether the picture explains the thing, and only three categories pass it: **Shapes**, **Icons** and
**Stickers**, where the glyph IS the answer. A square tile explains a square. A donut does not explain "how far along
something is", a miniature thumbnail shows a composite's arrangement but not its job, six device outlines are six grey
rectangles of slightly different proportions, and two picture frames at 18px do not distinguish an image from an
avatar.

`palette-tile-defs.test.tsx` requires a blurb on every tile in every row-rendered section, so a new one can't ship as
a bare row.

## No User element

There is no actor / stick-figure tile in the palette or the "Add to canvas" search catalogue, and no `actor` shape
kind in the model, the renderer or the wire schema, nor the other flowchart-only kinds.

## The body scrolls when it has to

A long category (Components runs to ten rows) must not run off the bottom of a short window. The panel body's height
is capped at the space between its top edge and the bottom chrome (the zoom dock and the tab bar, both measured
rather than assumed, since the dock hides in Zen mode), and only then does it scroll. A category that fits shows no scrollbar and still animates its height on switch.

## Searching across the categories

Every element is one click away but spread over ten categories, so "where does Checklist live" needs an answer that
isn't "open each one". The editor's **Search** panel answers it: it searches every tile by
caption, label, blurb and description, and picking a result arms the same placement the palette uses
([Canvas and palette](../008-canvas/canvas-and-palette.md)). The Icons and Stickers tabs still search their own
catalogues ([Browsing the palette by category](palette-category-browse.md)).

## The picker unfolds from its trigger

A palette dropdown's menu (`PaletteDropdown`, the selection mode) takes the corner its trigger sits at as its
`transform-origin`: top-left for a left-aligned menu, top-right for a right-aligned one, and the bottom corners when
a menu flips up. One direction-agnostic keyframe scales uniformly out of that origin, rather than a `scaleY`-only
pair: squashing the Y axis on top of a corner origin read as a blind coming down rather than a menu growing out of a
button.

## Help centre addresses

The data articles live under `/help/palette/tools/data-elements/`. Those are a documentation hierarchy, not a mirror
of the palette's, and moving them would break every existing link for a cosmetic match. The article copy names the
Data category.

## The Structure band

Concepts, Components and Devices sit in their own band above Decorate.

All three are things you lay a page OUT with rather than draw on it: the concept graphics, the ready-made page
composites, the device frames a screenshot sits inside. Arranging a page comes before dressing it, which is the order
the bands read in: Common, Structure, Decorate, Dynamic.

The category array must stay sorted by band: the category bar renders it straight through and groups under the
headings without sorting, so a misplaced entry appears under the wrong one.

## Group counts are a badge

A collapsible group shows its tile count as a badge beside the title, not folded into the blurb. Making the reader
parse a sentence to learn a quantity left the blurb unable to simply say what the group is for.
