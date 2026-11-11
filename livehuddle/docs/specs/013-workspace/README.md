# Workspace

Follow the references below only as needed; never upfront.

The Explorer, and everything it lists, is liveworkspace's index and its shared Explorer package, served at livehuddle's own `/explorer`: [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) is the document and [one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) the calls. The specs below marked "index" are short pages saying what the index does and what livehuddle supplies.

- ./share-roles.md - when gating any livehuddle feature by share role: what an Editor, a Participant and a Viewer may do in a space, feature by feature
- ./explorer-structure.md - when working on the Explorer at `/explorer` or the editor's Explorer panel: the shared `@liveworkspace/explorer` served at livehuddle's address, its views, what livehuddle lends it (addresses, New, the Library, Take Offline and Sync Space, Share, Help), and This Browser at `/offline` (index)
- ./folders.md - when working on folders (index)
- ./default-folders.md - when working on where a new canvas is filed by default: the app's one entry (Spaces), the retired entries that read as it, filing on create, a template picked after creation (index)
- ./share-password.md - when working on a link visitor's password gate and its cache; a listed Community post locks Password Protection; the password itself is the index's (index)
- ./tab-scoped-share-links.md - when working on a share link confined to one tab: the grant's `tab`, redaction, the room's filtering, the visitor's "Not shared" tabs (index)
- ./share-link-expiry.md - when working on how long a share link lasts (index)
- ./teams.md - when working on teams: managed on liveworkspace.app, read from the access token, made from the Move dialog's New Team, invitations
- ./team-shared-documents.md - when working on a team's library: every joined member manages its canvases (index)
- ./embeds.md - when working on Read-only embeds (`/embed`): Iframe-able `/embed` share view + Copy-embed-code in Share
- ./live-image-share.md - when working on Live image share link: Share-link-scoped `<img>`-able SVG at `/api/share/<code>/image.svg`, served from the snapshot cache ([Document SVG snapshots](../006-document/document-snapshots.md))
- ./share-link-previews.md - when working on what a pasted share link previews as in Slack, Teams, iMessage and the like: the document's name and a 1200 x 630 PNG share card (`/api/share/<code>/card`, `/api/share/<code>/image.png`), the editor worker's head rewrite, and the brand card everywhere else
- ./hide-from-recent.md - when working on Hide from Recent / Show in Recent: per person, on the index's opens, left out of Recent, Home's Most Used and `/new`'s card (index)
- ./recent-folder-chip.md - when working on the location chip on rows of lists that span places (index)
- ./folder-content-previews.md - when working on a folder card's mosaic: the index's `GET /folders/previews` and livehuddle's canvas preview (index)
- ./favourites.md - when working on favourites (index)
- ./explorer-details-view.md - when working on the per-tab stats a canvas pushes to the index for the Details view (index)
- ./history.md - when working on an item's History: what the index records, the `edited` events livehuddle reports, the History dialog, and the retired Timeline, What Happened and Team Activity
- ./explorer-home.md - when working on Explorer Home: the words, first-run welcome manifest and Help livehuddle gives it, and recording a canvas's opens (index)
- ./inbox.md - when working on what a canvas pushes for the Inbox (index)
- ./explorer-filters.md - when working on the Explorer's filter lens: the shared lens, with livehuddle's template families for the Template chip (index)
- ./trash.md - when working on the Trash: deleting and its Undo, a trashed canvas's refusals, the purge, the API and Google Drive sync; This Browser deletes for good (index)
- ./empty-document-cleanup.md - when working on Empty document clean-up: the index's daily sweep sends a canvas with no elements or articles in any tab, unchanged for 30 days, to the Trash (marked `empty`); never This Browser's
- ./shape-libraries.md - (Gone from livehuddle, Work Tracker #423 part 4) when working on Shape libraries: named, owner-scoped sets of reusable shapes (draw.io libraries imported, one library per file, never merged), the palette My shapes category, the shared Explorer's Shape Libraries and the previews route that draws its shapes, the `/api/shape-libraries` resource, limits and sign-up migration
- ./blueprints/README.md - when implementing a workspace spec from its blueprint (shape libraries, share roles)
