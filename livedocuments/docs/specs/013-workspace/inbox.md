# Inbox

**Moved to liveworkspace's index (October 2026).** livedocuments' own Inbox, the `/explorer/inbox` view over a per-app collaboration index (`collab_actions`, `collab_threads`, `owner_aliases`), is gone. The Inbox is liveworkspace's now: one view in the shared Explorer, listing open actions assigned to you or by you and unresolved comment threads you are in, across every liveworkspace app, each row opening its item in its own app at the tab and element.

What livedocuments still does is feed it. A document's Durable Object pushes each changed tab's threads and actions to the index (`PUT /app/items/:id/collab/:tabId`), on idle and at most once a minute, from its outbox (`apps/api/src/document-room/document-outbox.ts`, [API](../015-api/api.md) "Storage"). The comment text stays in the document. The editor's deep link (`#t=<tab>&el=<element>`) is what an Inbox row opens.

The document is [one-explorer.md](../../../../liveworkspace/docs/one-explorer.md); the calls and types are in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Inbox" and "What an item pushes". The Explorer that shows it is the shared package, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md).

## How a row reads

Every Inbox row, on the Explorer page and in the editor's Explorer panel, is one link drawn by one shared component (`packages/explorer/src/explorer/inbox/InboxRows.tsx`) at one of two densities: **comfortable** on the page, **compact** in the panel (tighter padding, a smaller avatar, shorter times). Top to bottom it reads:

- **Where**, as a quiet breadcrumb: the item's app mark (in the All filter), the team glyph for a team's item, the item's title, then the tab and the element or board. On the right, when it last changed, in a `<time>` element with the full date on hover.
- **What needs you**, in bold: the action's name, the card's number and title, the element a thread is on, or the form's heading. One line, the full text on hover.
- **The detail**, up to two lines: the latest comment quoted under its author's name, or the action's note.
- **Why it is here**, a chip that pairs an icon with its words, never colour alone: **Assigned to you** (followed by who assigned it), **Waiting on Bo** (work you assigned), **Mentioned you**, **On your {kind}** (the item is yours and you haven't replied), **You replied**, or **3 new responses**. Beside it the card's type glyph and label, the thread's comment count, and **This Browser** for an item only this browser holds.
- **Who**, as an avatar at the start: who assigned it to you, who you assigned it to, or who wrote the latest comment, in their presence colour when the app sends one (darkened until the initials read at AA, a quiet disc otherwise), with a small badge for the row's kind. A form's row shows the form glyph instead.

The row's accessible name is its title, why it is here and its item; the detail and the time describe it. Hover and keyboard focus tint the row at `duration-micro` (no motion under reduced motion), and on the page an Open arrow shows. A row only opens its place: the Inbox offers no Mark Done, and the index sends no read state for actions and threads, so rows carry no unread mark (a form's row counts the responses you haven't seen). Loading shows skeleton rows of the same shape. With nothing open, the Inbox says **You're all caught up**.
