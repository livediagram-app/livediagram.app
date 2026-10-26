# Folder location on Recent rows

The shared Explorer's lists that span places (Recent, Favourites, Search, Shared With Me) carry a location chip on
each row and card: its folder, its team for a team item in no folder, or My Work for one of yours in none; an item
reached through a link lives in someone else's library and has none. Clicking the chip goes to that place. Recent
and Search add an Owner column (and a line on each card): You, the team's name, or Shared with you
([its README](../../../../packages/explorer/README.md)).

A canvas kept only in this browser is on none of the index's lists; This Browser lists it
([Explorer structure](explorer-structure.md#this-browser)).

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
