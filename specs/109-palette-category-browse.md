# 109 — Browsing the palette by category

Status: shipped

## What

The Icons and Technology tabs browse the same way the Tools tab does: a grid of
category tiles, click one to open it, a breadcrumb back, and a search box that
cuts across every category at once.

The category **filter dropdowns** those two tabs used ("Filter icons by
category", "Filter technology icons by provider") are gone, along with their
"All" entry.

## Why

All three tabs hold a catalogue too big for one screen — Tools has ~25 tiles,
Icons 183 glyphs, Technology a few dozen brand marks — and all three were
answering that in different ways. Tools drilled in (spec/09 "Sub-categories");
Icons and Technology showed a flat scroll behind a dropdown.

The dropdown made the catalogue's own structure invisible. That there **is** a
People set, a Furniture set, an Emoji set is the single most useful thing to
know when you don't have a name in mind, and it sat inside a control you had to
open to read. The default view was instead a wall of 183 glyphs you scrolled.

Category tiles put that structure on the first screen, and each tile carries the
category's **first glyph** as its artwork — so a category looks like what it
holds, and no separate icon set can drift from the contents.

## No descriptions on Icons / Technology

Tool categories get a tooltip describing what's inside ("Blocks: code blocks,
checklists, …"), because the label alone doesn't answer "is the thing I want in
here?".

"People", "Arrows", "AWS" and "Azure" already answer it. A tooltip that restates
the label under the glyph is a delay in exchange for nothing, so `description`
on a category is now optional and those two tabs omit it — no tooltip renders at
all.

## Search is never narrowed

Search runs over the **whole** catalogue, not the open category. The old
dropdown filtered first and searched within, so a search from the "People"
filter silently missed every match elsewhere. With browsing and searching now
two separate ways in, filtering one by the other would be the same trap with
better scenery.

A non-empty query replaces the whole navigation with one flat grid of hits —
the breadcrumb would be lying about where the results came from.

## One implementation

`components/palette/PaletteCategoryBrowser.tsx` owns the navigation for all
three tabs: search box, category grid, breadcrumb, open-category body, empty and
loading states. Tabs supply their catalogue, their search function and their
tile rendering; nothing about a glyph, a tool tile or a brand mark leaks into
it.

`ToolsBreadcrumb` takes a `root` label so it reads "Icons › People" rather than
always "Tools ›".

## Every icon must be in a category

Without an "All" filter, an icon in no category is an icon nobody can reach
except by guessing its name into the search box. `lib/icons.test.ts` asserts
that every catalogue entry belongs to exactly one `ICON_CATEGORIES` entry, so
adding a glyph without filing it fails the suite rather than quietly hiding it.

## Telemetry

Both tabs emit the pair the Tools tab already did (spec/22): `UI·Opened` with
`IconGroup` / `TechGroup` when a category opens, and one `UI·Searched` per mount
with `IconSearch` / `TechSearch` on the first keystroke. Which categories people
open, versus whether they skip straight to search, is the whole question this
change was meant to answer.
