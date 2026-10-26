# Team shared documents

A team's library is liveworkspace's index's: each team has its own folder tree, and an item filed in it can be opened and managed by every joined member. The shared Explorer shows it as the team's view (`/explorer/team?id=`). livedocuments keeps no team folders or team placement of its own.

Team membership comes from the `teams` claim of the person's access token, so neither the index nor livedocuments keeps a copy of teams. API clients read a team's documents at `GET /api/teams/:id/library` ([API](../015-api/api.md)), which reads the index.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
