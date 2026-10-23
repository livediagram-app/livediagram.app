# Explorer structure

**Moved to liveworkspace's index (October 2026).** The Explorer's sidebar and pages are the shared package's. Its views are Home, My Work, Unsorted, Recent, Favourites, Shared With Me, Tags, Trash, Inbox, Search, a folder and a team's library, at `/explorer/<view>` ([its README](../../../../packages/explorer/README.md) "Views"). There is no Timeline, Activity, Offline Mode or Themes view. liveplanner's own sidebar, places-versus-views groups, ARIA tree hook and mobile drawer are gone.

liveplanner hosts it: `/explorer` renders `<Explorer app="liveplanner">` under liveplanner's header (`apps/editor/app/explorer/ExplorerShell.tsx`), supplying each item's address in its own app, a share link's address, New (the `/new` flow, filed where it was pressed) and the person's teams from their access token (`apps/editor/lib/explorer-host.ts`). The editor's floating Explorer panel is the package's `ExplorerPanel`.

The plan is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
