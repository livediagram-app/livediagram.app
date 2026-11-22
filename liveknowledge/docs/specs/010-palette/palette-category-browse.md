# Browsing the palette by category

## What

The Icons, Stickers and Technology catalogues browse the same way: a grid of category tiles, click one to open it, a
breadcrumb back, and a search box that cuts across every category at once. There is no category filter dropdown and
no "All" entry.

## Why

Each holds a catalogue too big for one screen (Icons about 183 glyphs, Stickers about 190). A filter dropdown would
make the catalogue's own structure invisible. That there **is** a People set, a Furniture set, a Feelings set is the
single most useful thing to know when you don't have a name in mind, and it should not sit inside a control you have
to open to read, behind a wall of glyphs you scroll.

Category tiles put that structure on the first screen, and each tile carries the
category's **first glyph** as its artwork, so a category looks like what it
holds, and no separate icon set can drift from the contents.

## No descriptions on Icons / Stickers

"People", "Arrows", "Feelings" and "Work" already answer "is the thing I want in here?". A hover card that restates
the label under the glyph is a delay in exchange for nothing, so `description` on a category is optional and these
catalogues omit it: no hover card renders at all.

## Search is never narrowed

Search runs over the **whole** catalogue, not the open category. A search from inside "People" that silently missed
every match elsewhere would be a trap: browsing and searching are two separate ways in.

A non-empty query replaces the whole navigation with one flat grid of hits,
since the breadcrumb would be lying about where the results came from.

## Two panes in the category bar's flyouts

On the category bar ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)), Icons and Stickers
browse as **two panes** instead of the drill-in: the groups down a rail on the left (each its glyph,
name and count badge, the open one raised with a brand edge), the open group's entries on the right under a sticky
heading, and the search across the top. There is no breadcrumb and no grid of group tiles: every group is in view
and one press away, so there is nothing to back out of. It opens on the first group, and after that on the one it
was left on, for the page load (`BrowseMemory`, keyed by the browse's root); the query is not kept. Search is never
narrowed, as above: a query replaces the right pane with "Results for “…”" across every group.

`PaletteCategoryBrowser` draws either: the flyout sets `BrowseLayoutContext` to `rail` (`PaletteCategoryRail`), and
every other host keeps the drill-in grid.

## One implementation

`components/palette/PaletteCategoryBrowser.tsx` owns the navigation for every
catalogue: search box, category grid, breadcrumb, open-category body, empty and
loading states. Tabs supply their catalogue, their search function and their
tile rendering; nothing about a glyph, a tool tile or a brand mark leaks into
it.

`ToolsBreadcrumb` takes a `root` label so it reads "Icons › People".

## Every icon must be in a category

With no "All" filter, an icon in no category is an icon nobody can reach
except by guessing its name into the search box. `lib/icons.test.ts` asserts
that every catalogue entry belongs to exactly one `ICON_CATEGORIES` entry, so
adding a glyph without filing it fails the suite rather than quietly hiding it.

## Telemetry

Each catalogue emits a pair ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `UI·Opened`
with `IconGroup` / `StickerGroup` / `TechGroup` when a category opens, and one `UI·Searched` per mount with
`IconSearch` / `StickerSearch` / `TechSearch` on the first keystroke. Which categories people open, versus whether
they skip straight to search, is the question it answers.
