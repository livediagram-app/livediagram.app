# Favourite documents

Status: shipped

## What

A **Favourite** / **Unfavourite** toggle on the document menu in both Explorer
surfaces, and a **Favourites** view at `/explorer/favourites` that collects
every starred document — personal or team — in one place.

The motivating case is team folders: a shared library accumulates documents
that aren't all relevant to any one person at any one time, and a star is how
you carve out the handful that are yours to watch.

## Per-user, and stored in its own table

Starring is personal. Starring a document in a shared team folder must not star
it for the rest of the team, so a star is a row keyed by
`(owner_id, document_id)` rather than a flag on the document.

It gets a **D1 table** (migration `0040_favourites.sql`) rather than a key in
the `user_preferences` blob, which is how [Hide a document from Recent](hide-from-recent.md) stores hidden-from-Recent
ids. That blob is capped at **4 KB** server-side — roughly 100 36-char UUIDs —
and favourites are meant to be unlimited. Overflowing it wouldn't just lose a
star: the PUT would start rejecting **every** preference write. A table has no
such ceiling, which is what lets the answer to "any limit?" be _no_.

The table carries `created_at`, so "when I starred it" is recoverable if a
sort-by-date-favourited ever earns its place. Re-starring keeps the original
timestamp (`ON CONFLICT DO NOTHING`) rather than bumping it.

`ON DELETE CASCADE` through `documents` means a deleted document takes everyone's
star with it, so the view can never list a dead id.

## Stars follow the owner

A star is the starrer's data, keyed on their owner id, so it takes part in
both owner-wide operations ([Owner-keyed data](../015-api/api.md#owner-keyed-data)):

- **Account deletion erases every star the user placed**, including those on
  a teammate's or anyone else's document. The cascade only reaches stars on
  the user's own documents, so the rest are deleted by owner id.
- **Signing up carries a guest's stars into the account.** Both identities may
  have starred the same document, and the primary key is
  `(owner_id, document_id)`, so the move is `INSERT OR IGNORE` then `DELETE`:
  on a collision the account's star, and its original `created_at`, wins.

## No access check on write

`PUT /api/favourites/:id` doesn't verify the caller can read that document. A
star is a private bookmark in the starrer's own row: it grants no access,
reveals nothing, and the Favourites view renders by intersecting the starred
ids with **the document lists the client already has permission to see**. An id
for something you can no longer open simply doesn't appear. Checking on write
would cost a lookup per star to prevent nothing.

## An offline document's star lives in the browser

The table's `document_id` is a foreign key into `documents`, and an offline
document ([Offline Mode](../006-document/offline-mode.md)) has no row there: it lives only in this browser's
IndexedDB. Sending its star to the server is therefore not merely wasted, it
is **rejected** with `FOREIGN KEY constraint failed`, and because the toggle
is optimistic and the write is swallowed, the star would appear on click and
be gone on the next reload.

So a star on an offline document is kept on the offline record itself, and
`apiSetFavourite` dispatches on `isOfflineId` exactly as load / save / delete
already do. This is also what [Offline Mode](../006-document/offline-mode.md) requires of every offline row: no
server fetch, "list, thumbnail, or otherwise".

Listing is the exception that isn't a dispatch, for the same reason the
document list is: the Favourites view shows both kinds in one place, so
`apiListFavourites` **merges** the cloud ids with the local ones, and the
local ones still answer when the cloud fetch fails.

Converting a document between offline and cloud does not carry the star
across; it is dropped with the copy that held it.

## The view

At `/explorer/favourites`. It has **no sidebar row**
([Explorer structure](explorer-structure.md)); the route keeps working for links
and bookmarks. It behaves like the synthetic folders (a computed list, not a real
folder you can move things into).

- **Sorted most-recently-updated first**, exactly like Recent and every folder,
  so there's nothing new to learn. Deliberately _not_ sort-by-date-favourited:
  "when I starred it" is rarely how anyone looks for something, and the source
  chip already answers the question people actually have.
- **Each row shows its source** via the [Folder location on Recent rows](recent-folder-chip.md) folder chip, which is exactly
  the indicator the issue asked for — the containing folder for a personal
  document, the team name for a team one. That chip was previously Recent-only;
  Favourites is the second pane that aggregates across folders, so the gate
  became "panes that aggregate" rather than "Recent".
- **A starred document shows a star wherever it's listed**, before its name in
  the list view (so a column of rows lines its stars up in one scannable
  vertical, rather than at ragged name-end positions) and in the meta row on a
  card. Amber rather than brand, because it's a personal mark sitting beside
  status badges that describe the document itself.

  This is the opposite call to hidden-from-Recent ([Hide a document from Recent](hide-from-recent.md)), which stays
  menu-only — deliberately: hiding is a set-and-forget negative you rarely
  revisit, where a favourite is a positive you actively scan for.

- **The empty state has no CTA.** Creating a document doesn't land it here,
  starring an existing one does, so the generic "New document" button would be
  a dead end — same reason Shared and Unsorted carry none.
- **Shared-with-you documents can't be starred.** They're not in your library —
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
- **Starring a shared-with-you document**, per above.
- **A star affordance on the row itself** (a click-target star beside the
  name). The menu is where every other per-document action lives; a
  hover-to-star control is a different interaction pattern to introduce.
