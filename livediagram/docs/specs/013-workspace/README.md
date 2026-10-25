# Workspace

Follow the references below only as needed; never upfront.

The Explorer, and everything it lists, is liveworkspace's index and its shared Explorer package, served at livediagram's own `/explorer`: [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md) is the document and [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) the calls. The specs below marked "index" are short pages saying what the index does and what livediagram supplies.

- ./explorer-structure.md - when working on the Explorer at `/explorer` or the editor's Explorer panel: the shared `@liveworkspace/explorer` served at livediagram's address, its views, what livediagram lends it (addresses, New, the Library, Take Offline and Sync Canvas, Share, Help), and This Browser at `/offline` (index)
- ./folders.md - when working on folders (index)
- ./default-folders.md - when working on where a new canvas is filed by default: the app's entry and the template families' (Retrospective, Kanban), filing on create, a template picked after creation (index)
- ./share-roles.md - when working on what a share link, embed or API token may do: Viewer, Participant, Editor; ownership powers
- ./share-password.md - when working on a link visitor's password gate and its cache; a listed Community post locks Password Protection; the password itself is the index's (index)
- ./tab-scoped-share-links.md - when working on a share link confined to one tab: the grant's `tab`, redaction, the room's filtering, the visitor's "Not shared" tabs (index)
- ./share-link-expiry.md - when working on how long a share link lasts (index)
- ./teams.md - when working on teams: managed on liveworkspace.app, read from the access token, made from the Move dialog's New Team, invitations
- ./team-shared-documents.md - when working on a team's library: every joined member manages its canvases (index)
- ./embeds.md - when working on Read-only embeds (`/embed`): Iframe-able `/embed` share view + Copy-embed-code in Share
- ./workbench-embeds.md - when a developer tool (an agent workbench, VS Code) frames the editor signed in: workbench tickets and sessions, the origin handshake, workbench messages, the selection reference
- ./live-image-share.md - when working on Live image share link: Share-link-scoped `<img>`-able SVG at `/api/share/<code>/image.svg`, served from the snapshot cache ([Document SVG snapshots](../006-document/document-snapshots.md))
- ./share-link-previews.md - when working on what a pasted share link previews as in Slack, Teams, iMessage and the like: the document's name and a 1200 x 630 PNG share card (`/api/share/<code>/card`, `/api/share/<code>/image.png`), the editor worker's head rewrite, and the brand card everywhere else
- ./hide-from-recent.md - when working on Hide from Recent / Show in Recent: per person, on the index's opens, left out of Recent, Jump Back In and `/new`'s card (index)
- ./recent-folder-chip.md - when working on the location chip on rows of lists that span places (index)
- ./folder-content-previews.md - when working on a folder card's mosaic: the index's `GET /folders/previews` and livediagram's canvas preview (index)
- ./tags.md - tags (removed from the Explorer)
- ./favourites.md - when working on favourites (index)
- ./explorer-details-view.md - when working on the per-tab stats a canvas pushes to the index for the Details view (index)
- ./timeline.md - when working on the Timeline: what the index records, the `edited` events livediagram reports, the view (index)
- ./explorer-home.md - when working on Explorer Home: the words, first-run welcome manifest and Help livediagram gives it, and recording a canvas's opens (index)
- ./inbox.md - when working on what a canvas pushes for the Inbox (index)
- ./explorer-filters.md - when working on the Explorer's filter lens: the shared lens, with livediagram's template families for the Template chip (index)
- ./trash.md - when working on the Trash: deleting and its Undo, a trashed canvas's refusals, the purge, the API and the Drive mirror; This Browser deletes for good (index)
- ./empty-document-cleanup.md - when working on Empty document clean-up: the index's daily sweep sends a canvas with no elements or articles in any tab, unchanged for 30 days, to the Trash (marked `empty`); never This Browser's
- ./shape-libraries.md - when working on Shape libraries: named, owner-scoped sets of reusable shapes (draw.io libraries imported, one library per file, never merged), the palette My shapes category, the shared Explorer's Shape Libraries and the previews route that draws its shapes, the `/api/shape-libraries` resource, limits and sign-up migration
- ./blueprints/README.md - when implementing a workspace spec from its blueprint (shape libraries, share roles, workbench embeds)
