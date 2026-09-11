# 110 — Palette top-level categories and bands

Status: shipped

## What

A flattening of the palette's category structure.

**The Tools tab is gone.** Every group it held became a top-level palette
category of its own, and a tab with no categories left is not a tab.

The full set, in band order: **Favourites**, then **Shapes / Write / Draw /
Devices**, then **Icons / Stickers / Technology / Media / Components**, then
**Data / Behaviours**. (Stickers joined the Decorate band later, in
[spec/116](116-stickers.md); Collaborate was merged into Behaviours later
still — see below.)

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
tools plus Frame). The **User / actor** tile was deleted outright — see below.

**The category dropdown gets bands**, the way the canvas-tool dropdown got them
(spec/108):

| Band           | Categories                         |
| -------------- | ---------------------------------- |
| _(no heading)_ | Favourites, full width             |
| **Common**     | Shapes, Write, Draw                |
| **Structure**  | Build, Components, Devices         |
| **Decorate**   | Icons, Stickers, Technology, Media |
| **Dynamic**    | Data, Behaviours                   |

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

Write, Draw, Behaviours, Data, Components, Media and Devices render as **rows
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

The same call was made when **Collaborate merged into Behaviours**: its seven
articles keep their `/help/palette/collaborate/` URLs and their parent page,
and only the copy changed — it now says where the elements actually live and
which two groups they are. A rename that broke seven live links to say
"Behaviours" in a path would be a cosmetic match bought with real breakage.

## Behaviours: one category, fully grouped

**Collaborate was merged into Behaviour**, and the survivor is named
**Behaviours** (32 tiles in 6 groups). The two were split on a real
distinction — Behaviour is "pressing this does something to your session",
Collaborate is "the board is collecting an answer from everybody" — and it
turned out to be a line to memorise rather than one to navigate by. You reach
for both while running a session, and nothing told a user hunting for the Done
check why it sat apart from the estimate card. [spec/137](137-done-check.md)
saw this coming: it filed the Done check under Behaviour, noted it was
arguably a Collaborate element by this spec's own rule, and said so.

What is left is one honest test for the category: **does this element's content
arrive at runtime rather than being drawn by the author?**

| Group              | Holds                                                            |
| ------------------ | ---------------------------------------------------------------- |
| **Ask the room**   | the three estimate scales, Temperature, Idea box, Dot vote, Poll |
| **Run the room**   | Reveal, Done, Picker, Timer                                      |
| **Keep a record**  | Comment panel, Agenda, Decision record, Roll call                |
| **Reactions**      | the five pads                                                    |
| **Selection Mode** | one button per mode (8)                                          |
| **Get around**     | Portal, Chair, Link card                                         |

**There is no Session group.** It held the Timer, the Dot vote and the Poll —
a group named after the machinery that runs them rather than the job they do.
A poll and a dot vote ARE asking the room, so they belong with the estimate
card and the temperature check, which is where somebody wanting to put a
question to everybody actually looks; a timer is facilitation, so it belongs
with the Reveal, the Done check and the Picker. With all three rehoused the
group had nothing left in it, and an empty group is not a group.

They remain one shape kind with a `session` config ([spec/105](105-session-button.md)) —
this is a palette grouping, not a model change.

The **Comment panel** is in **Keep a record**. It sat loose above the groups at
first, on the reasoning that it is the one you reach for outside a facilitated
session and a group of one would be a click in front of the category's
most-used tile. But a comment thread is a thing you leave behind on the board
for somebody to find later, which is exactly what the agenda, the decision
record and the roll call are — and one row floating above six category tiles
read as an oversight rather than as a shortcut. Every tile is in a group now.

Order is **room-first**: the three groups a facilitator opens mid-session come
before the three you set up once and forget.

Data-side, the merge is a `section` change: the Collaborate tiles moved to
`section: 'tools'` with `toolGroup: 'behaviour'`, so `tilesForCategory` and the
tab body needed no special case and the `'collaborate'` section is gone.

The grouping is by **what the element does with the room**, not by what it
looks like. That is the same rule that produced the Build category (spec/132),
and it is why Portal sits with Chair and the Link card (all three take you
somewhere — another tab, a seat, the page itself) rather than with Reveal
(which the facilitator drives). The Link card came here from Components, which
groups by what a thing looks like: a ready-made composite you recolour and
retitle. A link card is neither composite nor decoration, so it read as filler
in that category and as an obvious member of this one.

Three kinds were split into a tile per variant at the same time, on the
spec/121 pattern: selection modes, session tools, reactions, and estimate
scales. In every case the variant IS the decision — you know which mode, which
tool, which scale before you reach for the palette — so placing a default and
then reconfiguring it was two steps for something already settled. They remain
one shape kind each with a mode field; the choice rides the draw intent.

## The Structure band

Build, Components and Devices sit in their own band above Decorate.

All three are things you lay a board OUT with rather than draw on it: Build's
containers, the ready-made page composites, the device frames a wireframe sits
inside. Arranging a board comes before dressing it, which is the order the
bands now read in — Common, Structure, Decorate, Dynamic.

The category array must stay sorted by band: `PaletteTabBar` renders it
straight through and groups under the headings without sorting, so a
misplaced entry appears under the wrong one.

## Group counts are a badge

A collapsible group shows its tile count as a badge beside the title, not
folded into the blurb. "5 ways to celebrate on the board" made the reader
parse a sentence to learn a quantity, and left the blurb unable to simply say
what the group is for ("React on the board").
