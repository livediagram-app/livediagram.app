# Default folders

A **default folder** is where a person's new documents land when they make one without choosing a place. Defaults
belong to the person and to the app: two teammates may send the same new documents to different places, and
livedocuments' defaults never move another app's items.

The index keeps them (`/placement-defaults`, [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md)
"Folders, tags, favourites, defaults"), and the shared Explorer, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md),
sets, shows and clears them.

## Entries

The list a person sets defaults from is titled **New documents that open as**, and holds, in this order:

| Entry     | Key             |
| --------- | --------------- |
| Documents | `livedocuments` |

livedocuments has no template families, so its one entry holds every new document
(`defaultEntries('livedocuments', …, [])`).

## Filing on create

A create that names no folder and no team lands in the working default of the app's key. An explicit
`folderId: null` is My Work's top chosen on purpose and wins over any default. A default whose folder is gone, or
is in a team the person has left, is skipped; with none left the document lands at the top of My Work. Deleting a
folder drops the defaults that point at it.

- `/new` sends no place unless a `?folder=` / `?team=` context names one, so its creates are filed by default.
- Duplicate and the server copy land beside their source and are never filed by a default.

## Surfaces

- **Use as Default for…** in a folder's menu opens the entries as checkboxes; it stays open so several can be set
  in one visit. A key points at one folder, so checking an entry moves it from the folder that held it.
- **My Work's own menu** (the sidebar's My Work row) carries the same Use as Default for…, for the top of My Work:
  an entry is checked while it has no working default (none, or one whose folder is gone) and is then
  unavailable; checking another clears its default, so those documents land at the top again. A team's top offers
  none: it cannot be a default.
- **The default marker**: a pin after a default folder's name (rows, cards, Details, the sidebar).
  Its words ("Default folder for new documents") are its tooltip and a
  hidden line for screen readers.
- **Default Folders** (Settings › Documents, and from Use as Default for…): each entry, where its new documents go, Clear
  and Change. Change opens the default folder picker, where My Work's top clears the default and a team's top
  cannot be chosen.
- **Deleting a default folder**: the confirmation names where the contents go and says which new documents were
  saved there.
