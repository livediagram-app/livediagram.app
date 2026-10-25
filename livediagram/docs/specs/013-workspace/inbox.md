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

## How it reads, and what it can do

The Inbox is a list and a reading pane, drawn by one shared component (`packages/explorer/src/explorer/InboxPane.tsx`; the whole design is in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Inbox"):

- **The list**: every row newest first under Today, Earlier This Week and Older, three lines each: who (semibold when it asks something of you) and its age; what it is; why it is here as an icon and words (**To do**, **Waiting on Bo**, **Mentioned you**, **On your canvas**, **Replied to you** or **You replied**, **6 new responses**), then the app's Living Prism and the item, and the teal **This Browser** pill for a canvas only this browser holds.
- **The filter bar** over it: All, My Actions, Assigned by Me, Comments and Form Responses, each with its count, kept per viewer on this device, beside the header's app filter.
- **The reading pane**: where it is, the title, who and why, the verbs with their keys, the canvas's thumbnail, then the thread, the action's note or the form's responses, and a reply field where Reply is offered.
- **On a phone and in the editor's panel** the pane takes the list's place, with Back to Inbox; the browser's Back and Esc return to the list.

What the pane can do for livediagram's rows, through this app's own code (`apps/editor/lib/explorer-inbox-host`, over `@liveworkspace/explorer/inbox-actions`):

- **Open in livediagram** (↵), always: the row's deep link.
- **Reply** (r) and **Resolve** (e) on an element's thread, through the comment routes (`POST /api/<items>/:id/tabs/:tabId/comments`, `…/comments/:firstCommentId/resolve`), which relay to an open editor. Offered on liveworkspace.app (the workspace token reaches every app's api), on livediagram's own `/explorer` and in its editor's panel (their token is livediagram's). The pane reads the whole thread from `GET /api/<items>/:id/comments?status=all` once the choice settles.
- **Mark Done** (e) on an action, only in the editor's panel, and only for an action on the tab the canvas has open: the canvas's own Mark Done (`useCanvasChromePanels` hands the panel the active tab and `onToggleActionDone`). An action's status has no route of its own, so nowhere else offers it.
- Nothing on a This Browser row: no page but the editor reaches the offline store, and the editor has no verbs for it yet.

The Inbox keeps no read state: no Seen, Later or Done of its own, and rows carry no unread mark (a form's row counts the responses you haven't seen). A row whose work was done from the pane leaves the list at once. Loading shows skeleton rows of the same shape; with nothing open, the Inbox says **You're all caught up**. Telemetry: `Activity·Opened` (once a visit), `Activity·Selected` (a row opened in its app, by kind), `Activity·Loaded·Retry`, `Activity·Changed` (the filter bar), `Activity·Added·Reply` and `Activity·Resolved` (`Thread`, `Action`) ([Telemetry](../017-telemetry/telemetry.md)).
