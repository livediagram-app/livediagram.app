# Workspace

Follow the references below only as needed; never upfront.

- ./explorer-structure.md - when working on the Explorer sidebar or the editor's Explorer panel: places vs views, the Overview / Spaces / More groups, page titles that follow the rows, visibility rules, titles vs separators (Minimal chrome), alignment, ARIA tree keyboard model, mobile drawer, designs in This Browser
- ./folders.md - when working on Folders: Nested folders for designs in the Explorer; designs with no folder sit at the root of their space; deleting a folder moves its contents up to its parent
- ./share-roles.md - when working on what a share link or embed may do: Viewer, Participant, Editor; ownership powers
- ./share-password.md - when working on Share password: the index's per-item password over every link, and livedesign's password gate
- ./teams.md - when working on Teams: Teams with Admin/Member roles, email invites, Explorer section
- ./embeds.md - when working on Read-only embeds (`/embed`): Iframe-able `/embed` share view + Copy-embed-code in Share
- ./workbench-embeds.md - when a developer tool (an agent workbench, VS Code) frames the editor signed in: workbench tickets and sessions, the origin handshake, workbench messages, the selection reference
- ./tab-scoped-share-links.md - when working on Tab-scoped share links: A share link scoped to one tab; other tabs locked, enforced server-side incl. the room
- ./share-link-expiry.md - when working on Share-link expiry: the index's link lifetimes (week, month, 6 months), set and extended in the shared Share dialog
- ./team-shared-designs.md - when working on Team shared designs: a team's library on liveworkspace's index, edit for every joined member, and what livedesign adds (the library route, creating into a team, the Team badge, telemetry)
- ./live-image-share.md - when working on Live image share link: Share-link-scoped `<img>`-able SVG at `/api/share/<code>/image.svg`, liveworkspace's preview of the design ([Design SVG snapshots](../006-design/design-snapshots.md))
- ./share-link-previews.md - when working on what a pasted share link previews as in Slack, Teams, iMessage and the like: the design's name and a 1200 x 630 PNG share card (liveworkspace's previews, `/api/previews/share/<code>/card` and `/image.png`), the live worker's head rewrite, and the brand card everywhere else
- ./hide-from-recent.md - when working on Hide a design from Recent: a per-person choice on liveworkspace's index, shown by the shared Explorer's menus
- ./recent-folder-chip.md - when working on the location chip on Recent, Favourites, Search and Shared With Me rows (the shared Explorer's `FolderChip`)
- ./favourites.md - when working on Favourite designs: per-person stars on liveworkspace's index, the Favourites view, and an Offline Mode design's star on its offline record
- ./explorer-details-view.md - when working on the Explorer's Details view: the shared Explorer's sortable table (type, comments, access, size, dates), its resting-hover preview, and where livedesign's numbers come from (the summary each design pushes to the index)
- ./folder-content-previews.md - when working on Folder content previews: the shared Explorer's folder mosaic, drawn from the designs' previews
- ./timeline.md - when working on the Timeline: liveworkspace's day-grouped feed in the shared Explorer; livedesign reports `edited` from the design's room outbox, and the view's telemetry
- ./explorer-home.md - when working on Explorer Home: the landing view, one column of Jump Back In (a Within reach set: 4 most used, 4 recent) then What Happened
- ./inbox.md - when working on the Inbox: liveworkspace's shared view of open actions and unresolved threads; what livedesign pushes to it (each tab's threads and actions, from the design's outbox), its This Browser rows and snapshot, and how its rows open the editor
- ./default-folders.md - when working on Default folders: per-person folders new designs land in by creation intent (`mode:pages`), the explicit root, Duplicate beside its source, the intent recorded on the design, the index's placement defaults, precedence after explicit placement, dangling defaults skipped and kept, guest migration; the Use as Default for menu, the default marker, `/new` filing into the default, Settings > Designs
- ./trash.md - when working on Trash: every design delete moves it to a 30-day Trash (personal, team, or this-browser for Offline Mode), restorable to its folder and purged by the index's daily run; trashed designs leave every list, and share links, the room and saves answer `design_trashed`; Take Offline and account deletion bypass it
- ./explorer-filters.md - when working on Explorer filters: the lens, one string of words and tokens (`opens-in:` `made-by:ai` `edited:` `people:` `space:`) that chips write and the top-bar search types, with autocomplete, scope versus lens, `?q=` in the URL, the chip row, the field, Search results, and Made by AI replacing the Generated bucket
- ./empty-design-cleanup.md - when working on Empty design clean-up: the index's daily sweep moves a design with no elements, unchanged for 30 days, to the Trash (marked `empty`); what livedesign reports (`hasContent`) and shows (`reason`)
- ./blueprints/README.md - when implementing a workspace spec from its blueprint (share roles, workbench embeds, local opens)
