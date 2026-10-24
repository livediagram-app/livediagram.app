# Favourites

Stars are liveworkspace's index's: `GET /favourites`, `PUT` and `DELETE /favourites/:itemId`, one set per person
across every app, unlimited. The shared Explorer's **Favourite** and **Unfavourite** menu items and its **Favourites**
view (`/explorer/favourites`, personal and team stars together) read and write the index. A star is personal: starring
a document in a team's library stars it for nobody else. livediagram keeps no stars of its own.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, favourites,
defaults". The Explorer that shows it is the shared package,
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
