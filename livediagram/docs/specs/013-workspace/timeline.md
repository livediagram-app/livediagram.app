# Timeline

The record of what happened to the canvases a person can reach, and their teams' canvases, shown in the shared Explorer at
`/explorer/timeline`. liveworkspace's index keeps it for every app; livediagram reports who edited which canvas, and the
view is rendered through [`@liveworkspace/explorer`](../../../../packages/explorer/README.md). The calls and types are
in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Timeline"; the help article
is `apps/help/app/explorer/timeline`.

## 1. What is recorded

The index records what it changes itself, in the same batch as the change: a canvas made (`created`, with `source`
`ai` for an MCP create and `import` for a CLI one, or `copiedFrom` for a copy), `renamed`, `moved`, `trashed`,
`restored`, `shared` (a share link made, with its level), `unshared` and `favourited` (on its person's Timeline only).

livediagram reports `edited`. The canvas's room records the editor of every save made through an HTTP route that
carries an identity (`apps/api/src/document-room/document-room.ts`, `recordItemEditor` from `@liveworkspace/index-app`): one outbox row per person, replaced on each
save, so a burst of saves is one row. The outbox drains them with the canvas's other index reports, up to
`APP_EVENTS_MAX` a batch, as `PUT /app/items/:id/events`. The index keeps one `edited` event per person, canvas and
UTC day, moving its time forward, and records a use day for that person, so editing a canvas counts toward Most Used.
Writes from a WebSocket participant carry no account and are not attributed.

## 2. Who sees what

A person sees the events on canvases in their own space, and on each team's canvases for every team in their token
(including what happened before they joined). A canvas shared with them through a link is not on their Timeline. The
index keeps no names: a card says "you" for the reader's own doing, the name an app reported, or "a teammate".

## 3. The view

The Explorer's Timeline row sits in the sidebar's Overview group under the Inbox, in amber. The pane header carries
the This app / All filter (the Explorer's one filter, remembered per app in this browser under
`liveworkspace:explorer-filter:<app>`, or the host's when it controls it), the Cards / Calendar switch and Filter.

- **This app** asks for livediagram's events only; **All** for every app's, each card wearing its app's mark and
  opening in its own app.
- One day per group on a rail, **Today** marked; each day's cards in the Explorer's card grid. A card shows the
  canvas's thumbnail (or the event's glyph on its tone's tint), its current name, the reason line ("Canvas Renamed") in
  the event's tone, and the time with its detail ("Was “Q3” · by you").
- Tones: red for the Trash, amber for renamed, moved and sharing, green for made, edited, restored and favourited.
- A day's run of one kind folds into a stack ("Canvases Renamed", "12 events · click to expand"), dealt out beside it
  on a click. A canvas made and edited the same day shows only its making.
- **New** marks events by someone else since the last look. The first page carries `seenAt`; the visit then posts
  `POST /timeline/seen`. A first visit marks nothing.
- Pages of 30, **Show More** for the next. A failed read with nothing loaded says so, with Try again, never "nothing
  has happened".
- Filter: Everyone or Other people, a chip per kind of event, and a mini calendar that jumps to a day. The filters
  run on the loaded pages; with nothing matching, the feed says so and offers Show More and Clear filters.
- Calendar: a month grid with a dot per tone on each day; a dot opens that day's cards.
- A canvas in the Trash opens the Trash.
- Each card has a ⋯ menu (also on a right-click): the canvas's own menu (Open, Rename, Duplicate, Change Folder,
  Share, Favourites, Delete; Restore and Delete Forever for one in the Trash) with **Remove from Timeline** before
  the destructive rows. Rename edits the name in place on the card whose menu started it, and every card of that
  canvas follows. A stack's ⋯ menu has Remove from Timeline for its whole run. Removing takes the cards off at once
  and puts them back, with a message, if the index refuses (`POST /timeline/dismiss`); it is the reader's own
  Timeline only.
- A link ending `#event=<id>` rings that card, holds its stack open and scrolls to it, looking up to five pages
  back for it.
- A day still to come sits above Today in a violet **Upcoming** band. The index takes a report from at most five
  minutes ahead, so this is for events written as scheduled.
- The sidebar's Timeline row counts events by someone else since the last look ("99+" past 99), from the Inbox
  read the sidebar already makes (`timelineNew`). Opening the Timeline clears it once the visit is marked seen.

## 4. Telemetry

`Timeline·Changed` (`Cards` is reported as `List`, and `Calendar`), `Timeline·Selected` (a category switched off,
`Everyone`, `Others`), `Timeline·Loaded` (`More`, `Retry`), `Timeline·Opened` (`Card`, `Stack`, `Menu`) and
`Timeline·Removed` (`Entry`, `Stack`), through the Explorer's `onTimeline` prop, counted for livediagram on the Explorer at its address and in the
workbench's Explorer (`apps/editor/app/embed/workbench/ExplorerHost.tsx`).

## 5. Performance

One indexed statement per page (by scope, then app, then time; at most `limit + 1` rows read per scope). Measured on
the index with 10,000 events of the reader's among 100,000: 14.7 ms for every app, 2.2 ms for one app. The view
renders one page at a time; working out the days and stacks of 10,000 loaded events stays under the test's budget.

Removed events are skipped inside each scope's range by their primary key, so a page past 1,000 removed events
reads in 1.0 ms. The sidebar count rides in the Inbox's batch, no request of its own, bounded at 100 rows per
scope: 1.4 ms with the Inbox on the same 100,000 events. Remove from Timeline sends at most 100 ids a call. The menu
is one per pane, drawn only while open.

## 6. Beyond the feed

An item's own history is **History** on its menu in the Explorer: the item's own Timeline (`GET /timeline?item=`),
paged. A team's events are on every member's Timeline. An API token's expiry warning is the liveworkspace account's,
sent by email ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)), and is no Timeline row.
