# Team shared documents

**Moved to liveworkspace's index (October 2026).** A team's library is the index's: each team has its own folder tree, and an item filed in it can be opened and managed by every joined member. The shared Explorer shows it as the team's view (`/explorer/team?id=`). livedocuments' team folders, team placement and its `TeamSharedDocuments` panel are gone.

Team membership comes from the `teams` claim of the person's access token, so neither the index nor livedocuments keeps a copy of teams. API clients can still read a team's documents at `GET /api/teams/:id/library` ([API](../015-api/api.md)), which reads the index.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
