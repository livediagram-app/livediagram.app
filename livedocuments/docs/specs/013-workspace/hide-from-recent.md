# Hide a document from Recent

Status: shipped, on liveworkspace's index and the shared Explorer
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)).

## What

Every item's menu, wherever it is listed (the Explorer page, the editor's Explorer panel, Home's cards), has
**Hide from Recent**, or **Show in Recent** once it is hidden. A hidden item never appears in **Recent** or in
Home's **Jump Back In** however recently it was opened, and behaves exactly as before everywhere else: folders,
search, Favourites, direct links, sharing, teams.

## Per person, not per item

Recent is your view of your own work, so the choice belongs to the reader, not the item. On a shared or team document,
one collaborator tidying their Recent leaves everyone else's alone. The index keeps it on the person's own `opens`
row (`hidden`), beside when they last opened the item
([one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, favourites,
defaults"):

- `PUT /recent-hidden/:itemId` hides it, `DELETE /recent-hidden/:itemId` shows it again. Hiding an item never
  opened makes a row with no open (`last_opened_at` 0), which showing it removes again; opening a hidden item keeps
  it hidden.
- Every item the index returns says `hiddenFromRecent`, so the menu reads the right label.
- A guest's choices move to their account with their opens when they sign in, and go with the account when it
  closes.
- There is no cap: a row per item the person hid, removed with the item.

## Where it is enforced

- **Recent** (`view=recent`) leaves hidden items out in the index, on the partial `opens_recent` index, before the
  page is cut, so hiding one lets the next in. The Explorer's Recent shows the 12 most recently opened
  (`RECENT_LIMIT`), from a page of 24, so a hide made here fills the gap at once.
- **Jump Back In's** Most Used (`used`) leaves them out too.
- The Explorer lays the change over every loaded list at once (the overlay), and takes it back with a toast when
  the index refuses.
- The landing page's note of recent diagrams ([Returning visitor](../019-marketing/returning-visitor.md)) leaves out
  what the index says is hidden.

## No badge anywhere else

Deliberate. The menu item's label states what the click will do, and so the current state, right where you would
change it. A badge on every row would compete with Private, Team, Shared and Made by AI, which describe the item;
this describes your view of it.

## Out of scope

- **Bulk hide or a management list.** You show an item again from its own menu wherever it lives.
- **Hiding Shared With Me rows.** Those have **Remove from Shared With Me**, which ends the share for you.
- **Hiding from search or folders.** This is about Recent only.
