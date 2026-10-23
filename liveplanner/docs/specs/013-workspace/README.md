# Workspace

Follow the references below only as needed; never upfront.

The Explorer, and everything it lists, lives in liveworkspace's index and its shared Explorer package: [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md) is the plan and [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) the calls. The specs below marked "moved" are short notes saying what went and what liveplanner still does.

- ./explorer-structure.md - when working on the Explorer page or the editor's Explorer panel: the shared `@liveworkspace/explorer` hosted at `/explorer`, its views, and what liveplanner supplies (addresses, New, teams) (moved)
- ./share-roles.md - when working on what a share link, embed or API token may do: Viewer, Participant, Editor; ownership powers
- ./share-password.md - when working on a link visitor's password prompt; the password itself is the index's (moved)
- ./tab-scoped-share-links.md - when working on a share link confined to one tab: the grant's `tab`, enforced by the api and the room (moved)
- ./share-link-expiry.md - when working on how long a share link lasts (moved)
- ./teams.md - when working on teams: managed on liveworkspace.app, read from the access token (moved)
- ./team-shared-projects.md - when working on a team's library (moved)
- ./folders.md - when working on folders (moved)
- ./default-folders.md - when working on where a new plan is filed by default (moved)
- ./tags.md - tags (removed from the Explorer)
- ./favourites.md - when working on favourites (moved)
- ./trash.md - when working on the Trash or a trashed plan's refusals (moved)
- ./empty-project-cleanup.md - when looking for the empty-project sweep (removed)
- ./explorer-home.md - when working on Explorer Home and recording a plan's opens (moved)
- ./hide-from-recent.md - when looking for Hide from Recent (removed)
- ./explorer-filters.md - when looking for the Explorer's filter lens (removed; `packages/explorer-lens` remains)
- ./explorer-details-view.md - when working on the per-tab stats a plan pushes to the index for the Details view (moved)
- ./inbox.md - when working on what a plan pushes for the Inbox (moved)
- ./timeline.md - when looking for the Timeline, What Happened, History or Team Activity (removed)
- ./embeds.md - when working on Read-only embeds (`/embed`): the iframe-able share view
- ./workbench-embeds.md - when a developer tool (an agent workbench, VS Code) frames the editor signed in: workbench tickets and sessions, the origin handshake, workbench messages, the selection reference
- ./live-image-share.md - when working on Live image share link: Share-link-scoped `<img>`-able SVG at `/api/share/<code>/image.svg`, served from the snapshot cache ([Project SVG snapshots](../006-project/project-snapshots.md))
- ./share-link-previews.md - when working on what a pasted share link previews as in Slack, Teams, iMessage and the like: the project's name and a 1200 x 630 PNG share card (`/api/share/<code>/card`, `/api/share/<code>/image.png`), the editor worker's head rewrite, and the brand card everywhere else
- ./blueprints/README.md - when implementing a workspace spec from its blueprint (share roles, workbench embeds)
