# Team shared documents

A team's library is the index's: each team has its own folder tree, and a canvas filed in it can be opened and
managed by every joined member (open, rename, duplicate, move, share, delete). The shared Explorer shows it as the
team's view (`/explorer/team?id=`), and its Move dialog offers every space, so a team canvas is never trapped.
Deleting a team canvas sends it to the team's Trash ([Trash](trash.md)).

Team membership comes from the `teams` claim of the person's access token, so neither the index nor livediagram
keeps a copy of teams ([Teams](teams.md)). The index's grant on a team canvas names its team, and a joined member is
granted edit ([API](../015-api/api.md) "Access to a canvas is the index's grant").

What livediagram does with it:

- **New in a team.** New from a team's view, or a folder in it, carries the place into the `/new` flow (`?team=`,
  `?folder=`), and the canvas is registered there in the one create.
- **Share.** In the editor, a team canvas opened without a share code shows **Share** to every joined member, never
  Make a Copy (`mayShareDocument`); a teammate who arrives on a share link is a visitor of that link.
- **The header badge.** A team canvas shows a **Team** title badge instead of Private; a shared one reads Shared.
- **A member who leaves.** Their access ends with their token's `teams` claim: the next grant the index issues
  them on a team canvas is none, so an open room session is closed when its grant lapses (`4007`) and stays out.
- **Assign Action** offers the people of the canvas's team ([Assigned actions](../012-collaboration/assigned-actions.md)).

API clients read a team's canvases at `GET /api/teams/:id/library` ([API](../015-api/api.md)), which reads the
index.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Sharing and access". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
