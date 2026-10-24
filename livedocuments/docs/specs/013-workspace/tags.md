# Tags

**Removed (October 2026).** Tags, the coloured labels a person put on their documents, are gone to keep the Explorer simple: there is no Tags view, tag picker, chip or tag search in the Explorer, and the index holds no tags (no `/tags` routes, `tags` or `item_tags` table, `tag` list filter or `tagIds` on an item). An offline document no longer carries tags; an older offline record that still has tag ids syncs as before, with them ignored. Tags may come back later. (A card's own tags on a board are a different thing and stay.)

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Folders, favourites, defaults". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
