# Workspace blueprints

Follow the references below only as needed; never upfront.

- ./trash.md - when implementing or changing the Trash: soft delete, restore, purge, the local Trash, the doors' 410
- ./design-placement.md - when changing where a create files a design: the placement resolver, its rejections, its callers
- ./default-folders.md - when implementing or changing default folders: the table, the routes, the intent, the resolver step, the menus, marker, wizard and Settings surfaces
- ./folder-delete.md - when changing what deleting a folder does: contents move up to the parent, in one batch
- ./tags.md - when implementing or changing tags: the tables, `/api/tags`, the owner migration merge, the provider and its optimistic writes, the picker, chips, the Tags page, sidebar rows and the panel section
- ./explorer-filters.md - when implementing or changing Explorer filters: the lens grammar, matching, suggestions, view models, `q`
- ./explorer-structure.md - when implementing or changing the Explorer sidebar: layout rules, rows, ARIA tree keyboard hook
- ./explorer-details-view.md - when implementing or changing the Details view: `tab_stats` and its writers, `DesignSummary.stats`, the backfill, the preview hint, the table and its sort
- ./explorer-home.md - when changing Home's data: recording opens, Jump Back In's Within reach set, the `/api/home` read and its wire
- ./explorer-home-view.md - when changing the Home page: its route, Jump Back In (grid, phone strip, See More), What Happened entries, local opens
- ./share-roles.md - when implementing or changing access levels (Viewer, Participant, Editor): the participant content rule, the room's participant write path and adder keys, editor capabilities, the Share dialog and role pill
- ./workbench-embeds.md - when implementing or changing workbench embeds: pairing, tickets, `lvw_` sessions and their confinement, the baseline migration, the `/embed/workbench` page and its messages, the selection reference, `/workbench/pair`, Settings pairings, `workbench open` and `pair`
- ./team-invites.md - when changing team invites: the decline token and its open doors, rejected rows, the reminder and expiry sweep
- ./DEFAULTS.md - when a workspace blueprint applies a default the spec leaves open
- ./COMPLETENESS.md - when checking which completeness categories a workspace blueprint covers
- ./empty-design-cleanup.md - when implementing or changing the daily move of empty designs to the Trash: the sweep, the trash reason, the restore restart
