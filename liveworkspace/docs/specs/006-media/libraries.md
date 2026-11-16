# Libraries

A **library** is where people keep the things they draw again and again: a team's service icons, a standard component,
a logo lock-up, a labelled box for an internal system. Someone selects it once, chooses **Save to Library**, and from
then on it is in the palette of every document in every app that can draw it. Each person has a **Personal** library,
and each team they are in has one too.

The libraries live in the media service, beside the pictures they hold, on **liveworkspace.app/api/media/app/library**.
Like the rest of the media API, only an app's own Worker calls it; a browser asks its app (`/api/library` on each app's
api), and the app says who is asking and which teams they are in.

```
packages/media/src/library*.ts   @liveworkspace/media: the item's shape, limits, kinds, the service's client and each app's door
liveworkspace/apps/media/src/library/   the service's routes, store, pictures and the read-through to the old shape libraries
packages/workbench/src/components/library/   the palette's Library and the Save to Library dialog every editor mounts
```

livediagram, livedocuments and livedesign save to it and place from it. livediagram and livehuddle also keep the
**shape libraries** people imported from draw.io before the Library existed; those stay where they are and appear in the
Library unchanged (below).

## What an item is

- **An item**: an id, a **title** (1 to 200 characters), a **folder** (0 to 80 characters; empty is the scope's top),
  its **elements** as the saving app's portable JSON, positioned from the item's top-left corner at (0, 0), its **width**
  and **height**, the **kinds** it uses (the distinct `type` of each element), the gallery **images** its image elements
  place, a **preview** (an SVG drawing of it, made by the saving app), the app it was saved in, who saved it, and when.
- **A scope** is whose library holds it: `personal` (one person's, keyed by their media owner, so a guest's stays in the
  app they are in, as their pictures do) or `team` (one team's, keyed by the team id).
- **A folder** is a name items share within one scope, nothing more: it exists while an item names it. Folders sort
  by name; items within a folder newest first.
- **No live link.** Placing an item puts a copy of its elements on the canvas, with fresh ids. Changing or deleting the
  item later changes nothing already placed.

## Who may do what

The app vouches for the caller: their media owner, and their teams with their role in each, read from their access
token's `teams` claim (accounts.md "How an app and the index know someone's teams"). The service trusts the app's word,
as it does for pictures, and checks each action against it.

| Action                              | Personal  | A team library                 |
| ----------------------------------- | --------- | ------------------------------ |
| See and place its items             | its owner | every member (admin or member) |
| Save to it                          | its owner | every member                   |
| Tidy it: rename an item or a folder | its owner | the team's admins              |
| Tidy it: delete an item             | its owner | the team's admins              |

A team the caller is not in answers `404` as missing; a member trying to tidy answers `403 { error: 'admin_only' }`.
Saving is a person's act, never a token's: an API token or a workbench session reaches the library only through its own
app's editor, which it doesn't hold.

Share roles reach a library only through the canvas it is used on: the library belongs to a person or a team, not to a
document. **Save to Library** sits on the selection toolbar beside Duplicate (a marquee selection's toolbar too), and in
livedocuments, which has no toolbar for one element, in the element menu's quick bar. It is offered to an Editor only:
a Participant's and a Viewer's toolbars carry comments and growing a map, never Duplicate, and saving copies the
document's content out of it. Placing an item is adding to the canvas, so the Library is a palette category like any
other: an Editor's palette has it, a Participant's (Participate alone) and a Viewer's (none) do not.

**The Library sits beside Search.** On the Toolbar strip it is not a category: it holds what people saved, not
what the app ships, so it is an icon-only button at the strip's far right, just before Search (`ToolbarLibraryButton`,
`packages/workbench/src/components/palette/ToolbarLibraryButton.tsx`), with the Library's glyph (`LibraryIcon`,
`packages/workbench/src/components/library/library-icons.tsx`) in every app, centred in its square, and a hover card
("Library" and its line). It
opens the Library's body in the strip's popover, as Search opens its own; opening one closes the other. In livediagram,
livedocuments and livedesign alike. In the Palette panel, where every category is a row, the Library stays its last
row (`libraryLast`, `packages/workbench/src/components/palette/library-last.ts`).

## Kinds an app lacks

Apps share most element kinds but not all (livediagram has event storming notes, livedesign has wireframe parts). Each
app's door sends the kinds it can draw (its `ELEMENT_TYPES`), and the list leaves out every item that uses a kind the app
lacks, counting them in `hidden`; the palette says "2 items from other apps can't be placed here." when any are hidden.
Placing an item runs its elements through the app's own migration and element check, and drops any that fail.

## Pictures

An item's pictures are gallery images (media.md). They are kept like this:

- **Saved to Personal**: the item names the owner's own images; nothing is copied.
- **Saved to a team**: each image element's picture that the saver owns is **copied under the team's grant** into the
  team's own gallery (owner `team:<teamId>`, deduped on the bytes' hash like any owner's), and the item names the copies.
  So the team's item keeps its pictures if the saver deletes theirs or leaves the team. A picture the saver doesn't own
  (one placed from someone else's gallery) is left as it was.
- **Placed from a team library**: each team picture is copied into the placer's own gallery (deduped), and the elements
  placed name the placer's copies, so the canvas serves them by the app's usual rule (the image's owner reads it, and the
  canvas holds a placement grant for it).
- **Kept**: every item records a reference from `library:<itemId>` to each image it names (`refs`, app `library`), so the
  daily sweep never takes a picture a library still holds. Deleting the item removes its references.

## The old shape libraries, read in place

livediagram's and livehuddle's shape libraries (each product's `docs/specs/013-workspace/shape-libraries.md`) stay in
each person's store, untouched; nothing is migrated at deploy. They appear in the Library as **Personal** folders, one per
shape library, named as the library is:

- **In other apps**, the service reads them through: for a signed-in person (never a guest, whose libraries never leave
  their app) it asks each of those apps' internal door, `GET /api/internal/shape-libraries?owner=<account>` with that
  app's media key, in parallel, with a timeout of `LIBRARY_LEGACY_TIMEOUT_MS` (3 s). A door that fails or is not
  configured leaves its libraries out of that answer (`legacy.unavailable` lists the apps), and the palette shows the
  rest. The service never asks the caller's own app: that app merges its own shape libraries itself, which works for its
  guests too.
- **Copied on first write.** The first tidy of a shape library's item or folder (rename or delete) copies that whole
  shape library into the person's Personal library first: every item, with fresh ids, in a folder of the library's name,
  remembering which shape library it came from. From then on the copy is what the Library shows; the old library stays
  in its store, untouched, and keeps appearing in that app's Explorer Shape Libraries page as before.
- An item read in place has the id `legacy~<app>~<libraryId>~<itemId>`; placing one reads it through the same door.

## The API

Every route is `POST` under `/api/media/app/library` with a JSON body, the app's key and `X-Media-App`, as media.md "The
API". Every body carries `actor: { owner, teams: [{ id, name, role }] }`. Answers are JSON; errors `{ error }`.

| Route            | Body (beside `actor`)                                                 | Answer                                                                |
| ---------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/list`          | `{ kinds }`                                                           | `{ items, teams, hidden, legacy: { unavailable, copied, writable } }` |
| `/save`          | `{ scope, teamId?, folder, title, width, height, elements, preview }` | `201 { item }`                                                        |
| `/place`         | `{ id }`                                                              | `{ elements, width, height }`, pictures copied as above               |
| `/rename`        | `{ id, title }`                                                       | `{ item }`                                                            |
| `/rename-folder` | `{ scope, teamId?, from, to }`                                        | `{ renamed }`                                                         |
| `/delete`        | `{ id }`                                                              | `{ ok: true }`                                                        |

`items` are summaries without their elements (`LibraryItemSummary`): id, scope, team id, folder, title, width, height,
kinds, preview, app, created and updated times, and `legacy` for an item read in place. `legacy.copied` names the
caller's own app's shape libraries already copied, so that app leaves them out of what it merges; `legacy.writable` says
whether the caller may tidy them (an account: the first tidy copies the library, above; a guest's stay read-only).
`teams` echoes the caller's teams, for the Save dialog's choices.

Refusals: `400 invalid_body`; `400 invalid_title`, `invalid_folder`, `invalid_elements`; `404 not_found` (no such item,
or one the actor may not see); `403 admin_only`; `409 library_full` past `LIBRARY_ITEMS_PER_SCOPE_MAX` (500) items in a
scope; `413 item_too_large` past `LIBRARY_ITEM_BYTES_MAX` (256 KB of elements JSON); `403 gallery_full` when a team's
gallery can't take a copied picture; `503 media_unavailable` without a bucket.

## Each app's door

Each app's api answers its editor on `/api/library` (`GET` the list, `POST` save, `POST /:id/place`, `PUT /:id`
rename, `PUT /folders` rename a folder, `DELETE /:id`; `PUT` rather than `PATCH` so the api's write rate limit and
read-only token gate apply as to every other write) through `@liveworkspace/media`'s `handleLibraryDoor`, binding
only what is its own: its kinds, its element check and migration, its server-side SVG renderer for the preview, its
media owner rule and its teams claim. A guest has a Personal library and no teams. An app without a media key answers
`503 { error: 'library_unavailable' }`, and its palette shows no Library.

The editor asks for the list the first time something needs it: the palette's Library opening, or Save to Library. An
editor session that never opens either makes no request. The list is asked again after each save, rename or delete.
A document kept only in this browser has no owner on the api, so its editor mounts no Library (livediagram's palette
then shows My shapes as before).

## Account and guest lifecycle

- **A guest signs up**: `POST /owners/merge` moves the guest's Personal items to the account, as it moves their pictures.
- **An account is deleted**: `DELETE /owners/<owner>` deletes its Personal items with its pictures. Items it saved to a
  team stay the team's.

## Out of scope (for now)

- Live-updating components: a placed item is a copy.
- Moving the old shape libraries out of livediagram's and livehuddle's stores in bulk.
- A Library page in the Explorer; it is managed from the palette.
- Draw.io export of a library, and libraries from other tools.
