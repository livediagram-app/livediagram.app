# Teams

**Moved to liveworkspace's index (October 2026).** Teams belong to the liveworkspace account and are managed on liveworkspace.app: made, renamed, staffed and deleted there ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). liveplanner no longer keeps a copy: its teams mirror, change-feed cron, team routes and invitations are gone. An account's teams come from its access token's `teams` claim; the Explorer lists them, each with its library ([Team shared projects](team-shared-projects.md)), and a Manage Teams row links to liveworkspace.app.

Team members are no longer listed anywhere in liveplanner, so comment mentions, the assignee list on actions and team email notifications have no member source for now and suggest nobody from a team. `GET /api/teams` lists the caller's teams from the token for API clients.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
