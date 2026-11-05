# Explorer structure

The Explorer is liveworkspace's: the shared package [`@liveworkspace/explorer`](../../../../packages/explorer/README.md),
built once by liveworkspace.app and shown at livehuddle's own address. livehuddle's router answers `/explorer/*` by
fetching the same page from liveworkspace.app, with the address bar unchanged (`livehuddle.app/explorer/recent`), so
the person's session, This Browser's canvases and livehuddle's colours come along
([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "The Explorer on each app's address"). The editor
serves no `/explorer` page of its own; its links to it go through `explorerHref` (`../packages/workbench/src/lib/explorer-href.ts`).

## Views

Its views are Home, My Work, Recent, Favourites, Shared With Me, Trash, Inbox, Timeline, Invites, Search,
a folder, a team's library and the Library's pages, at `/explorer/<view>` ([its README](../../../../packages/explorer/README.md)
"Views"). There is no Unsorted view: an item in no folder sits at the root of My Work, or of its
team, which lists it. Older addresses still lead somewhere, so links already out there keep working: `/explorer/profile` opens
Settings on Notifications (every notification email carries it as its unsubscribe link), `/explorer/activity` the
Inbox, `/explorer/unsorted` and `/explorer/dynamic` My Work and `/explorer/generated` the Made by AI filter.

On livehuddle's address the page reads as livehuddle: New makes a Canvas, items of livehuddle open on the same
origin and other apps' items on their own sites, and the filter shows "this app's items" or "All Apps".

## What livehuddle lends it

The page at `/explorer` reads livehuddle's entry in the sites registry (`APP_ITEMS.livehuddle` in
`@liveworkspace/sites`: item, share, new, preview, Library, import and This Browser paths). The editor's Explorer panel
and the workbench's Explorer (`apps/editor/app/embed/workbench/ExplorerHost.tsx`) get the same from the editor's own
hosts, named below.

- **Addresses.** A canvas opens at `/document/<id>` (with `?s=<code>` when it is reached through a link, and the
  editor's deep link `#t=<tab>&el=<element>` when a row pins one); a share link reads `/document/shared?s=<code>`,
  the address whose page head names the canvas, so it previews as the canvas in chat apps
  ([Share-link previews](share-link-previews.md)). `itemHref` and `shareUrl` in `apps/editor/lib/explorer-host.ts`.
- **New.** The `/new` flow, filed where it was pressed (`?folder=`, `?team=`) ([Default folders](default-folders.md)).
- **What it makes.** Home's hero pictures an app's kinds of work, each starting its template through
  `/new?template=`; livehuddle's are its four Spaces (Virtual Office, Team Pod, Coworking Space, All-Hands Hall), each
  opening that template in `/new` (the package's `WORK_KINDS`, [Explorer Home](explorer-home.md), [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "What you can make, on Home's hero").
- **The Library.** The person's **Image Gallery**, read through this site's API, and **Import from**, whose
  buttons open this site's `/import` page for the source, which imports where New was pressed and comes back
  (`apps/editor/lib/explorer-library-host.tsx`). livehuddle lists no source (the sites registry's `imports: []`), so
  Import from shows none; the `/import` page answers only its Excalidraw link. (Shape Libraries, and the
  draw.io and Microsoft Whiteboard imports, left livehuddle in Work Tracker #423 part 4:
  [Shape libraries](shape-libraries.md).)
- **The item menu.** In the editor's Explorer panel, **Take Offline** and **Sync Space** on a canvas's menu, as the
  person (`apps/editor/hooks/persistence/useOfflineItemMenu.tsx`, the package's `itemMenu`;
  [Offline Mode](../006-document/offline-mode.md)). The Explorer page, built by liveworkspace.app, hands both over to
  the editor at the canvas's own address, which runs them.
- **Share.** What the shared Share dialog needs beyond a link's address: a canvas's tabs (a link can open one), its
  embed and live image, the Help articles and telemetry (`apps/editor/lib/explorer-share-host.ts`). The editor's
  Share is the same dialog with livehuddle's Community band below it ([Community](../025-community/community.md)).
- **Help.** Each view's Help button opens livehuddle's article for it (`explorerHelpHref`).

## The editor's Explorer panel

The editor's floating Explorer panel is the package's `ExplorerPanel`, with the same lists, menus and dialogs as the
page, inside the editor's movable panel, which docks in a corner or opens as the menu button's popover
(`apps/editor/components/panels/Explorer.tsx`). The open canvas shows on top, read once from the index when the
panel opens (the package's `useOpenItem`), or from This Browser's list for a canvas kept only in this browser, with
the This Browser pill and This Browser's menu ([one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#the-explorer-on-each-apps-address) "The Explorer on each app's address": the editors' panel). On a desktop or tablet the popover is up to 64rem (its rail 13rem, its preview cards four across)
wide and 56rem tall, inside the window, over a dimmed scrim on every screen size (a press on it closes the panel and
focus goes back to the menu button); on a phone it stays the sheet. Every list is one request a page, loaded only once its section is chosen. It is wrapped in `React.memo`
so the editor's per-frame churn never re-renders it.

## This Browser

Canvases kept only in this browser ([Offline Mode](../006-document/offline-mode.md)) never reach the index, so none of
the index's lists holds them. They are the Explorer's **This Browser** view, in the page (`/explorer/offline`) and the
editor's panel alike: every one, newest first, read from this browser alone, each opening in the editor. For a
signed-in person each row has **Sync Space**, which moves it to the account and so into the Explorer; in the panel
each row has **Delete**, which removes it for good after a confirmation, since nothing else holds it. With none, the
view says so.

- **The Explorer on livehuddle's address** reads them too: the editor's offline store keeps a small list of them
  (id, title and dates, never content) in the shared `localStorage` key the Explorer reads
  (`apps/editor/lib/offline/this-browser.ts`, `@liveworkspace/explorer/this-browser`). Its sidebar has a **This
  Browser** row with their count, shown while there are some, opening the Explorer's own This Browser view
  (`/explorer/offline`), each canvas opening in the editor; Home's Jump Back In shows the ones opened, each a card
  like the rest with the This Browser badge, its menu (Open, Sync Space) and its drag (the Trash or a folder,
  [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md) "This Browser in Jump Back In"). On
  liveworkspace.app, which cannot read this browser's storage for livehuddle, the row links to `/explorer/offline` here.
- **The editor's Explorer panel** has This Browser as a view of its own: a rail entry under More with the count,
  shown only while there are some, opening its pane in place (`apps/editor/hooks/persistence/useThisBrowserHost.ts`,
  the panel's `thisBrowser`). Each canvas opens in the editor; signed in, each row has **Sync Space**; each row has
  **Delete**, which asks first.
- **`/offline`**, the old This Browser page, only redirects to `/explorer/offline`, its query kept
  (`@liveworkspace/explorer/offline-redirect`). Take Offline, Sync and Delete asked by an address run in the editor at the
  canvas's own address (`/document/<id>?convert=take-offline|sync|delete&item=<id>`, `apps/editor/components/dialogs/ConversionHandoff.tsx`
  over `apps/editor/hooks/persistence/useConversionHandoff.ts`), which checks the canvas is the person's to move and
  asks them to confirm.

The document is [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Items". The Explorer that shows
it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
