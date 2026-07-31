# 110 — Palette top-level categories and bands

Status: shipped

## What

Two changes to how the palette's categories are organised.

**Behaviour and Data leave Tools.** Each is now a top-level palette category of
its own, beside Shapes, Components and Devices. The Tools tab keeps four
categories: Write & Draw, Structure, Blocks, People & Media.

**The category dropdown gets bands**, the way the canvas-tool dropdown got them
(spec/108):

| Band            | Categories                    |
| --------------- | ----------------------------- |
| _(no heading)_  | Favourites, full width        |
| **Common**      | Shapes, Tools, Devices        |
| **Decorate**    | Icons, Technology, Components |
| **Interactive** | Data, Behaviour               |

## Why promote the two

Both were a group inside Tools, which meant two levels of navigation before you
saw a tile: open Tools, then open the category. That is the right cost for
"which of the twenty tools is the polygon one" and the wrong cost for a set you
go to deliberately.

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
with Shapes and Tools that it does not have.

So it sits **full width above the first heading**, with no band of its own. The
grid gained a `fullWidth` option for this, and it lays its glyph beside the
label rather than above it — a one-column card stretched sideways reads as a
mistake.

## Rows, not tiles, for three categories

Behaviour, Data and Components render as **rows with a one-line blurb**, like
the Tools categories, not as the icon-over-caption grid Shapes and Devices use.

The rule is whether the picture explains the thing. A square tile explains a
square. A cursor-on-a-target does not explain a Picker, a donut does not
explain "how far along something is", and a grey wireframe of a layout shows a
composite's arrangement but not its job. Those three get words.

`palette-tile-defs.test.tsx` now requires a blurb on every tile in all four
row-rendered sections, so a new one can't ship as a bare row.

## What did not move

The help centre's URLs. The data articles still live under
`/help/palette/tools/data-elements/`, and the Behaviour ones under
`/help/palette/tools/`. Those are a documentation hierarchy, not a mirror of
the palette's, and moving them would break every existing link for a cosmetic
match. The article **copy** was updated, since a reader sent to the Tools tab
looking for a chart would not find one.
