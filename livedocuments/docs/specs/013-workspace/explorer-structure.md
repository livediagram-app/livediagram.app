# Explorer structure

**Moved to liveworkspace's index (October 2026).** The Explorer's sidebar and pages are the shared package's. Its views are Home, My Work, Unsorted, Recent, Favourites, Shared With Me, Trash, Inbox, Timeline, Search, a folder and a team's library, at `/explorer/<view>` ([its README](../../../../packages/explorer/README.md) "Views"). There are no Tags or Themes views: tags and custom themes were removed. The old Activity address opens the Inbox. livedocuments' own sidebar, places-versus-views groups, ARIA tree hook and mobile drawer are gone.

livedocuments hosts it: `/explorer` renders `<Explorer app="livedocuments">` under livedocuments' header (`apps/editor/app/explorer/ExplorerShell.tsx`), supplying each item's address in its own app, a share link's address, New (the `/new` flow, filed where it was pressed) and the person's teams from their access token (`apps/editor/lib/explorer-host.ts`). The editor's floating Explorer panel is the package's `ExplorerPanel`.

Older addresses still lead somewhere, so links already out there keep working. `/explorer/profile` opens Settings on Notifications (`/explorer?settings=notifications`): every notification email ever sent carries it as its unsubscribe link ([profile-and-email-notifications.md](../014-identity/profile-and-email-notifications.md)). `/explorer/activity` replaces itself with the Inbox, `/explorer/dynamic` with My Work, `/explorer/generated` with the Made by AI filter (documents the index records with source `ai`), and `/explorer/offline` with This Browser's own page, `/offline` (`apps/editor/app/explorer/RetiredViewRedirect.tsx`).

## This Browser

Documents kept only in this browser ([Offline Mode](../006-document/offline-mode.md)) never reach the index, so no Explorer list holds them. They have their own page, **This Browser** at `/offline` (`apps/editor/app/offline/OfflineDocuments.tsx`): every one, newest first, read from this browser alone, each opening in the editor. For a signed-in person each row has **Sync Document**, which moves it to the account and so into the Explorer. With none, the page says so.

- **The Explorer's sidebar** has a **This Browser** link to the page, with its browser-window icon (a host link, `sidebarLinks` in `apps/editor/app/explorer/ExplorerShell.tsx`).
- **The editor's Explorer panel** has a **This Browser** row with the count of documents in this browser, opening the page, shown only while there are some (`apps/editor/components/panels/ThisBrowserRow.tsx`).

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Items". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
