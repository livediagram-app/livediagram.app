# Inbox

The Inbox is liveworkspace's: one view in the shared Explorer (`/explorer/inbox`), listing open actions assigned to
you or by you and unresolved comment threads you are in, across every liveworkspace app, each row opening its item in
its own app at the tab and element.

livediagram feeds it. A canvas's Durable Object pushes each changed tab's threads and actions to the index
(`PUT /app/items/:id/collab/:tabId`), on idle and at most once a minute, from its outbox
(`apps/api/src/document-room/document-outbox.ts`, [API](../015-api/api.md) "Storage"). The comment text stays in the
canvas. The editor's deep link (`#t=<tab>&el=<element>&open=action|comments`) is what an Inbox row opens: it selects
the element and opens its popover.

Canvases kept only in this browser never reach the index; the editor reads their actions and threads from the
offline store (`apps/editor/lib/offline/offline-activity.ts`) and hands them to the Explorer's `inbox` prop
(`apps/editor/lib/explorer-inbox-host.tsx`), which lists them among the index's rows with the This Browser pill. The Explorer page on livediagram's own address (liveworkspace's build) can't read the offline store, so the editor also keeps a snapshot of these rows in localStorage under `liveworkspace:this-browser-inbox:livediagram` (`apps/editor/lib/offline/inbox-snapshot.ts`, over `@liveworkspace/explorer/this-browser`'s `inboxSnapshotKeeper`): whose rows they are (the account id, and this browser's guest id), at most 100 actions and 100 threads, newest first, long text cut short. It is worked out again about 1.5 s after the offline store last writes (a card assigned, an action added), once a page load, and as the panel's Inbox reads; it is dropped when this browser holds no canvases. The page lists it only to the person it names, so another account in the same browser never sees it, and hears it change. liveworkspace.app, on its own origin, can't read it, as it can't read the This Browser list.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Inbox" and "What an item
pushes". The Explorer that shows it is the shared package,
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
