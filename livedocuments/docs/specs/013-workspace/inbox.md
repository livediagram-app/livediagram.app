# Inbox

**Moved to liveworkspace's index (October 2026).** livedocuments' own Inbox, the `/explorer/inbox` view over a per-app collaboration index (`collab_actions`, `collab_threads`, `owner_aliases`), is gone. The Inbox is liveworkspace's now: one view in the shared Explorer, listing open actions assigned to you or by you and unresolved comment threads you are in, across every liveworkspace app, each row opening its item in its own app at the tab and element.

What livedocuments still does is feed it. A document's Durable Object pushes each changed tab's threads and actions to the index (`PUT /app/items/:id/collab/:tabId`), on idle and at most once a minute, from its outbox (`apps/api/src/document-room/document-outbox.ts`, [API](../015-api/api.md) "Storage"). The comment text stays in the document. The editor's deep link (`#t=<tab>&el=<element>`) is what an Inbox row opens.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Inbox" and "What an item pushes". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).
