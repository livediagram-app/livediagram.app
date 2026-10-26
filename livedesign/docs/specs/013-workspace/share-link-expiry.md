# Share-link expiry

A link's lifetime is liveworkspace's index's: Forever, 1 week, 1 month or 6 months, chosen when the link is made in the shared Share dialog (Lasts) and extended there (`POST /share/:code/extend`). An expired link grants nothing: the share URL and the embed show the same not-found surface as a revoked link.

The plan is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
