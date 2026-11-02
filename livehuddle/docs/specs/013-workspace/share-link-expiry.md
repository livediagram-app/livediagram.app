# Share-link expiry

A link's lifetime is the index's: Forever, 1 week, 1 month or 6 months, chosen when the link is made in the shared Share dialog (Lasts) and extended there (`POST /share/:code/extend`). An expired link grants nothing: the index refuses it, so `GET /api/share/:code` answers 404 and an open room drops the visitor when their grant lapses. A link made with `POST /api/documents/:id/share` (the MCP server's `share_document`) lasts as its `expiry` says, Forever when it names none.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
