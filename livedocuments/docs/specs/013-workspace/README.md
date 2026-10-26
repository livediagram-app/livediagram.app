# Workspace

Follow the references below only as needed; never upfront.

The Explorer, and everything it lists, lives in liveworkspace's index and its shared Explorer package: [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) is the document and [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) the calls. The specs below marked "platform" describe a platform service and what livedocuments supplies to it.

- ./explorer-structure.md - when working on the Explorer page or the editor's Explorer panel: the shared `@liveworkspace/explorer` hosted at `/explorer`, its views, and what livedocuments supplies (addresses, New, teams) (platform)
- ./share-roles.md - when working on what a share link, embed or API token may do: Viewer, Participant, Editor; ownership powers
- ./share-password.md - when working on a link visitor's password prompt; the password itself is the index's (platform)
- ./tab-scoped-share-links.md - when working on a share link confined to one tab: the grant's `tab`, enforced by the api and the room (platform)
- ./share-link-expiry.md - when working on how long a share link lasts (platform)
- ./teams.md - when working on teams: managed on liveworkspace.app, read from the access token (platform)
- ./team-shared-documents.md - when working on a team's library (platform)
- ./folders.md - when working on folders (platform)
- ./default-folders.md - when working on where a new document is filed by default (platform)
- ./favourites.md - when working on favourites (platform)
- ./trash.md - when working on the Trash or a trashed document's refusals (platform)
- ./empty-document-cleanup.md - when working on Empty document clean-up: the index's daily sweep moves a document with no element or page on any tab, unchanged for 30 days, to the Trash (marked `empty`, a fresh 30 days there); guest, account and team documents, never Offline Mode
- ./explorer-home.md - when working on Explorer Home and recording a document's opens (platform)
- ./hide-from-recent.md - when looking for Hide from Recent / Show in Recent
- ./explorer-filters.md - when looking for the Explorer's filter lens (platform: the shared Explorer's `packages/explorer/src/lens/`)
- ./explorer-details-view.md - when working on the per-tab stats a document pushes to the index for the Details view (platform)
- ./inbox.md - when working on what a document pushes for the Inbox (platform)
- ./timeline.md - when looking for the Timeline, What Happened, History or Team Activity (platform)
- ./embeds.md - when working on Read-only embeds (`/embed`): the iframe-able share view
- ./workbench-embeds.md - when a developer tool (an agent workbench, VS Code) frames the editor signed in: workbench tickets and sessions, the origin handshake, workbench messages, the selection reference
- ./live-image-share.md - when working on Live image share link: Share-link-scoped `<img>`-able SVG at `/api/share/<code>/image.svg`, served by liveworkspace's previews from the document's drawing ([Document previews](../006-document/document-snapshots.md))
- ./share-link-previews.md - when working on what a pasted share link previews as in Slack, Teams, iMessage and the like: the document's name and a 1200 x 630 PNG share card (`/api/share/<code>/card`, `/api/share/<code>/image.png`, liveworkspace's), the editor worker's head rewrite, and the brand card everywhere else
- ./blueprints/README.md - when implementing a workspace spec from its blueprint (share roles, workbench embeds)
