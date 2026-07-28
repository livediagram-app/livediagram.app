# 95 — Favourite diagrams

Status: shipped

## What

A **Favourite** / **Unfavourite** toggle on the diagram menu in both Explorer
surfaces, and a **Favourites** view under **My Work → Dynamic** that collects
every starred diagram — personal or team — in one place.

The motivating case is team folders: a shared library accumulates diagrams
that aren't all relevant to any one person at any one time, and a star is how
you carve out the handful that are yours to watch.

## Per-user, and stored in its own table

Starring is personal. Starring a diagram in a shared team folder must not star
it for the rest of the team, so a star is a row keyed by
`(owner_id, diagram_id)` rather than a flag on the diagram.

It gets a **D1 table** (migration `0040_favourites.sql`) rather than a key in
the `user_preferences` blob, which is how spec/93 stores hidden-from-Recent
ids. That blob is capped at **4 KB** server-side — roughly 100 36-char UUIDs —
and favourites are meant to be unlimited. Overflowing it wouldn't just lose a
star: the PUT would start rejecting **every** preference write. A table has no
such ceiling, which is what lets the answer to "any limit?" be _no_.

The table carries `created_at`, so "when I starred it" is recoverable if a
sort-by-date-favourited ever earns its place. Re-starring keeps the original
timestamp (`ON CONFLICT DO NOTHING`) rather than bumping it.

`ON DELETE CASCADE` through `diagrams` means a deleted diagram takes everyone's
star with it, so the view can never list a dead id.

## No access check on write

`PUT /api/favourites/:id` doesn't verify the caller can read that diagram. A
star is a private bookmark in the starrer's own row: it grants no access,
reveals nothing, and the Favourites view renders by intersecting the starred
ids with **the diagram lists the client already has permission to see**. An id
for something you can no longer open simply doesn't appear. Checking on write
would cost a lookup per star to prevent nothing.

The sidebar badge counts the same intersection, not the raw id count, so a
star on a team you've since left doesn't inflate it.

## The view

Under **My Work → Dynamic**, beside Unsorted / Generated / Offline — the issue
asked for it "within My Work", and it behaves like the other synthetic folders
(a computed list, not a real folder you can move things into).

- **Sorted most-recently-updated first**, exactly like Recent and every folder,
  so there's nothing new to learn. Deliberately _not_ sort-by-date-favourited:
  "when I starred it" is rarely how anyone looks for something, and the source
  chip already answers the question people actually have.
- **Each row shows its source** via the spec/94 folder chip, which is exactly
  the indicator the issue asked for — the containing folder for a personal
  diagram, the team name for a team one. That chip was previously Recent-only;
  Favourites is the second pane that aggregates across folders, so the gate
  became "panes that aggregate" rather than "Recent".
- **Shared-with-you diagrams can't be starred.** They're not in your library —
  they live in the sharer's — and the existing **Dismiss** already covers
  "stop showing me this".

## Optimistic toggling

`useFavourites` flips the star immediately and fires the request behind it.
Starring mutates nothing anyone else can see, so the worst case for a failed
write is a star that doesn't survive a reload — a better trade than a UI that
stalls on every click. The hook keeps a ref mirror of the set because the
toggle must _read_ the current state to pick a direction, and a React state
updater is the wrong place for that: it may run during a later render, so
anything captured inside it is unsafe for the outbound request.

## Spelling

**Favourite**, matching the existing `palette-favourites.ts` and the Palette's
own "Favourites" tab. The issue said "Favorite"; the codebase is British
throughout and a split would be worse than either choice.

## Out of scope

- **Sorting / filtering controls** in the Favourites view (the issue's open
  question). It behaves like every other pane; a group-by-team control is
  worth revisiting once someone actually has favourites across several teams.
- **Starring a shared-with-you diagram**, per above.
- **A star affordance on the row itself** (a click-target star beside the
  name). The menu is where every other per-diagram action lives; a
  hover-to-star control is a different interaction pattern to introduce.
