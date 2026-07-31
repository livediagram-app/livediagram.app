# 110 — Palette top-level categories and bands

Status: shipped

## What

A flattening of the palette's category structure.

**The Tools tab is gone.** Every group it held became a top-level palette
category of its own, and a tab with no categories left is not a tab.

The full set, in band order: **Favourites**, then **Shapes / Write / Draw /
Devices**, then **Icons / Stickers / Technology / Media / Components**, then
**Data / Behaviour**. (Stickers joined the Decorate band later, in
[spec/116](116-stickers.md).)

Where things landed, for anything that moved:

| Moved                                      | To              |
| ------------------------------------------ | --------------- |
| Code Block, Checklist, Link Card, Timeline | **Components**  |
| Table                                      | **Data**        |
| Annotation                                 | **Write**       |
| Frame                                      | **Draw**        |
| Image, Avatar                              | **Media** (new) |

The **Blocks** and **Structure** groups emptied out and were deleted; **Write &
Draw** split into **Write** (the wordy elements) and **Draw** (the gesture
tools plus Frame). The **User / actor** tile was deleted outright — see below.

**The category dropdown gets bands**, the way the canvas-tool dropdown got them
(spec/108):

| Band           | Categories                                     |
| -------------- | ---------------------------------------------- |
| _(no heading)_ | Favourites, full width                         |
| **Common**     | Shapes, Write, Draw, Devices                   |
| **Decorate**   | Icons, Stickers, Technology, Media, Components |
| **Dynamic**    | Data, Behaviour                                |

## Why flatten

Every one of these was a group inside Tools, which meant two levels of
navigation before you saw a tile: open Tools, then open the category. That is
the right cost for "which of the twenty tools is the polygon one" and the wrong
cost for a set you go to deliberately.

It hurt Behaviour most. Selection Mode buttons, Portals, Session buttons,
Reveal zones and Pickers (spec/103 to spec/107) are the palette's newest
elements and the ones a user is least likely to know exist. Burying them two
levels down is where a new feature goes to hide.

Data had been standalone before and was folded into Tools when the drill-in
landed; six charts sitting behind a category tile turned out to be the same
mistake in a smaller way.

## Why Favourites has no band

Favourites is not a _kind_ of thing — it is every category at once, whatever
the user put in it. Filing it under "Common" would claim a peer relationship
with Shapes and Write that it does not have.

So it sits **full width above the first heading**, with no band of its own. The
grid gained a `fullWidth` option for this, and it lays its glyph beside the
label rather than above it — a one-column card stretched sideways reads as a
mistake.

## Rows, not tiles, for most categories

Write, Draw, Behaviour, Data, Components, Media and Devices render as **rows
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

## The User element was deleted

The actor / stick-figure tile is gone from the palette and from the "Add to
canvas" search catalogue, and the AI prompt no longer offers `actor` as a shape
to emit. Nothing can create one any more.

The `actor` **shape kind itself is kept** in the model, the renderer and the
wire schema. Removing it would coerce every existing actor element to a square
on next load (`coerceShape`'s fallback) — silent data loss for anyone who used
it — and would be a breaking change for API and MCP callers. So: gone from
everywhere you can add one, still renders wherever one already exists. Ripping
the kind out for real needs a migration and a wire-schema version, which is a
separate piece of work.

## The body scrolls when it has to

A long category (Components runs to ten rows) used to run off the bottom of a
short window with no way to reach the last few. The panel body's height is now
capped at the space between its top edge and the bottom chrome — the zoom dock
and the tab bar, both measured rather than assumed, since the dock hides in Zen
mode — and only then does it scroll. A category that fits shows no scrollbar
and still animates its height on switch.

## Searching across the categories

Flattening put every element one click away but spread them over ten
categories, so "where does Checklist live now" needed an answer that isn't
"open each one".

A **search box sits at the top of Favourites**, the default landing. Typing
searches the whole fixed tile catalogue by caption, label, blurb and
description, and replaces the favourites grid with the matches as rows.

The **Icons and Technology catalogues are deliberately not searched here**:
183 glyphs would bury the twenty-odd element types under near-duplicate icon
names, and each of those tabs already searches its own catalogue (spec/109).

It is keyboard-driven, in the combobox pattern — focus never leaves the input,
so you can keep typing to refine with a row highlighted:

| Key            | Does                                                       |
| -------------- | ---------------------------------------------------------- |
| `ArrowDown/Up` | walks the results, wrapping at each end                    |
| `Enter`        | adds the walked result, or the first one if none is walked |
| `Escape`       | clears the query                                           |

## The pickers unfold from their trigger

Both palette dropdowns grew from their own centre-top, which made opening the
canvas-tool picker and the category picker look identical — the one thing the
animation exists to distinguish.

The menu's `transform-origin` is now the corner its trigger sits at: top-left
for the left-aligned canvas-tool picker, top-right for the right-aligned
category picker (and the bottom corners when a menu flips up). One
direction-agnostic keyframe scales uniformly out of that origin, replacing the
old `scaleY`-only pair — squashing the Y axis on top of a corner origin read as
a blind coming down rather than a menu growing out of a button.

## What did not move

The help centre's URLs. The data articles still live under
`/help/palette/tools/data-elements/`, and the Behaviour ones under
`/help/palette/tools/`. Those are a documentation hierarchy, not a mirror of
the palette's, and moving them would break every existing link for a cosmetic
match. The article **copy** was updated, since a reader sent to the Tools tab
looking for a chart would not find one.
