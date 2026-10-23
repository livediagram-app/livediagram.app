# Inbox

The Inbox is liveworkspace's: one view in the shared Explorer (`/explorer/inbox`), listing open actions assigned to
you or by you and unresolved comment threads you are in, across every liveworkspace app, each row opening its item in
its own app at the tab and element.

livediagram feeds it. A canvas's Durable Object pushes each changed tab's threads and actions to the index
(`PUT /app/items/:id/collab/:tabId`), on idle and at most once a minute, from its outbox
(`apps/api/src/document-room/document-outbox.ts`, [API](../015-api/api.md) "Storage"). The comment text stays in the
canvas. The editor's deep link (`#t=<tab>&el=<element>&open=action|comments`) is what an Inbox row opens: it selects
the element and opens its popover.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Inbox" and "What an item
pushes". The Explorer that shows it is the shared package,
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
