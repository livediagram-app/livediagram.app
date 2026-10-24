# Favourite designs

Status: shipped

## What

A **Favourite** / **Unfavourite** toggle on the design menu in both Explorer
surfaces, and a **Favourites** view at `/explorer/favourites` that collects
every starred design — personal or team — in one place.

The motivating case is team folders: a shared library accumulates designs
that aren't all relevant to any one person at any one time, and a star is how
you carve out the handful that are yours to watch.

## Per-user, and stored in its own table

Starring is personal. Starring a design in a shared team folder must not star
it for the rest of the team, so a star is a row keyed by
`(owner_id, design_id)` rather than a flag on the design.

Stars are liveworkspace's index's, one `favourites` row per person and design
([one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, tags, favourites,
defaults": `GET /favourites`, `PUT/DELETE /favourites/:itemId`), not a key in
the preferences set, which is how [Hide a design from Recent](hide-from-recent.md) once stored hidden-from-Recent
ids. That set is kept under **4 KB** — roughly 100 36-char UUIDs —
and favourites are meant to be unlimited. Overflowing it wouldn't just lose a
star: the PUT would start rejecting **every** preference write. A table has no
such ceiling, which is what lets the answer to "any limit?" be _no_.

The row carries `created_at`, so "when I starred it" is recoverable if a
sort-by-date-favourited ever earns its place. Re-starring keeps the original
timestamp (`INSERT OR IGNORE`) rather than bumping it. A purged design takes
everyone's star with it, so the view can never list a dead id.

## Stars follow the owner

A star is the starrer's data, so the index handles it in both person-wide operations:

- **Closing an account erases every star the person placed**, including those on
  a teammate's or anyone else's design.
- **Signing up carries a guest's stars into the account.** Both identities may
  have starred the same design, so the move is `INSERT OR IGNORE`: on a
  collision the account's star, and its original `created_at`, wins.

## No access check on write

Starring doesn't verify the caller can read that design. A
star is a private bookmark in the starrer's own row: it grants no access,
reveals nothing, and the Favourites view lists only starred designs the person can still reach. An id
for something you can no longer open simply doesn't appear. Checking on write
would cost a lookup per star to prevent nothing.

## An offline design's star lives in the browser

An offline design ([Offline Mode](../006-design/offline-mode.md)) is not in the index: it lives only in this
browser's IndexedDB. A star sent to the index for it would name an item nobody can list, so the star would appear
on click and be gone on the next reload.

So a star on an offline design is kept on the offline record itself
(`offlineSetFavourite`, `apps/live/lib/offline/offline-store.ts`), which the shared Explorer reads with the rest of
the This Browser list (`packages/explorer/src/this-browser.ts` at the repo root). This is also what [Offline Mode](../006-design/offline-mode.md) requires of every offline row: no
server fetch, "list, thumbnail, or otherwise".

The Favourites view shows both kinds in one place: the index's stars and the
This Browser ones, which still answer when the index can't be reached.

Converting a design between offline and cloud carries the star across: Take
Offline reads it from the index onto the offline record, and Sync Design stars
the new cloud design (`apps/live/lib/offline/offline-convert.ts`,
`offline-sync.ts`).

## The view

At `/explorer/favourites`. It has **no sidebar row**
([Explorer structure](explorer-structure.md)); the route keeps working for links
and bookmarks. It behaves like the synthetic folders (a computed list, not a real
folder you can move things into), so like Recent its header offers no
**New folder**: a folder made there would not appear there.

- **Sorted most-recently-updated first**, exactly like Recent and every folder,
  so there's nothing new to learn. Deliberately _not_ sort-by-date-favourited:
  "when I starred it" is rarely how anyone looks for something, and the source
  chip already answers the question people actually have.
- **Each row shows its source** via the [Folder location on Recent rows](recent-folder-chip.md) folder chip, which is exactly
  the indicator the issue asked for — the containing folder for a personal
  design, the team name for a team one. That chip was previously Recent-only;
  Favourites is the second pane that aggregates across folders, so the gate
  became "panes that aggregate" rather than "Recent".
- **A starred design shows a star wherever it's listed**, before its name in
  the list view (so a column of rows lines its stars up in one scannable
  vertical, rather than at ragged name-end positions) and in the meta row on a
  card. Amber rather than brand, because it's a personal mark sitting beside
  status badges that describe the design itself.

  This is the opposite call to hidden-from-Recent ([Hide a design from Recent](hide-from-recent.md)), which stays
  menu-only — deliberately: hiding is a set-and-forget negative you rarely
  revisit, where a favourite is a positive you actively scan for.

- **The empty state has no CTA.** Creating a design doesn't land it here,
  starring an existing one does, so the generic "New Design" button would be
  a dead end, the same reason Shared With Me carries none.
- **Shared-with-you designs can't be starred.** They're not in your library —
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
- **Starring a shared-with-you design**, per above.
- **A star affordance on the row itself** (a click-target star beside the
  name). The menu is where every other per-design action lives; a
  hover-to-star control is a different interaction pattern to introduce.
