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
- **Coming back to the tab.** The feed has no push, so a Timeline left open overnight would show last night's feed.
  When the browser tab becomes visible again or the window takes focus, the first page is read again and merged in
  at the head: events already shown keep their place, pages already loaded stay, and a new event joins the top.
  The New marks keep the visit's first `seenAt`, so the read cannot clear what the reader came back to look at. At
  most one read per 30 seconds (`useReturnToTab`, the Inbox's), since switching tabs is not a request for fresh
  data. A read that fails keeps what is shown; a feed whose first page failed is read again whole.

## 3a. Team Activity

A team's view (`/explorer/team?id=`, at its root) carries the team's own feed under its card and library: **Team
Activity**, the events on the team's canvases and the team's own events (joined, renamed, roles), from the team's
scope alone (`GET /timeline?team=<id>`). Every joined member reads the team's whole history, including what happened
before they joined; anyone else is refused (`403 not_team_member`) and the view is the team's not-found card anyway.

- A section headed **Team Activity** (an `h2`), closed by default as a disclosure (`aria-expanded`), so the
  library stays the first thing on the page and nothing is read until it is opened. Opening it reads the first page.
- The same cards, stacks and Show More as the Timeline, every app's events (each card wears its app's mark), no
  New marks (a shared feed has no one "last look") and no Remove from Timeline (that is the reader's own Timeline).
- Empty: the shared empty state, "No Team Activity Yet", "What the team does will show here." Failed: "Couldn't
  load this team's activity." with Try again.
- Moving to another team starts the feed again: the section is keyed on the team.
- It reads again on coming back to the tab, the same way and at the same rate as the Timeline.

## 4. Telemetry

`Timeline·Changed` (`Cards` is reported as `List`, and `Calendar`), `Timeline·Selected` (a category switched off,
`Everyone`, `Others`), `Timeline·Loaded` (`More`, `Retry`), `Timeline·Opened` (`Card`, `Stack`, `Menu`) and
`Timeline·Removed` (`Entry`, `Stack`), through the Explorer's `onTimeline` prop, counted for livediagram on the Explorer at its address and in the
workbench's Explorer (`apps/editor/app/embed/workbench/ExplorerHost.tsx`).

## 5. Performance

One indexed statement per page (by scope, then app, then time; at most `limit + 1` rows read per scope). Measured on
the index with 10,000 events of the reader's among 100,000: 14.7 ms for every app, 2.2 ms for one app. The view
renders one page at a time; working out the days and stacks of 10,000 loaded events stays under the test's budget.

A team's feed is the same statement over one scope: one index range of at most `limit + 1` rows, so a single term
and far inside D1's five-term compound limit (`unionAll`). Coming back to the tab reads one page at most every 30
seconds.

Removed events are skipped inside each scope's range by their primary key, so a page past 1,000 removed events
reads in 1.0 ms. The sidebar count rides in the Inbox's batch, no request of its own, bounded at 100 rows per
scope: 1.4 ms with the Inbox on the same 100,000 events. Remove from Timeline sends at most 100 ids a call. The menu
is one per pane, drawn only while open.

## 6. Beyond the feed

An item's own history is **History** on its menu in the Explorer: the item's own Timeline (`GET /timeline?item=`),
paged. It is a dialog rather than a page, because "what happened to this?" is asked while looking at the row
(`packages/explorer/src/library/HistoryDialog.tsx`, the rules in `history.ts`). Every app's Explorer, the
liveworkspace.app Explorer and the editors' Explorer panel open the same one.

- **Whose history.** The header shows the item itself: its thumbnail (the host's `renderThumbnail`, else the item
  glyph), its name as the dialog's heading, its app's mark (`AppMark`, never a coloured dot) with its kind word,
  its owner ("You", the team, or the owner's name) and when it was made.
- **At a glance.** A strip under the header: how many events are loaded ("30+" while older ones remain), how many
  people took part (their avatars, up to three), when it was made and when it last changed.
- **Filter.** One chip per kind of event present in what is loaded (the Timeline's categories: Edits, Renames,
  Sharing, Organisation, Comments, ...), with **All** first; shown only when two or more kinds are present. One
  chip at a time, each a toggle button (`aria-pressed`). With nothing matching, the list says so and offers Show
  older events and Show all.
- **The rail.** Events newest first on a vertical rail, one ordered list per day under a sticky day heading:
  **Today**, **Yesterday**, the weekday within the last week, then the date ("Tue, 5 Aug", with its year when not
  this year's). Each heading and time is a `<time datetime>`.
- **An event.** Its kind's glyph in a disc on the rail, in its tone (red for the Trash, amber for renamed, moved and
  sharing, green for made and edited), always with the reason line in words ("Canvas Renamed"), so colour is never
  the only signal. Then who did it (an avatar with their initials, in a stable colour from the presence palette,
  and their name or "You"), the detail ("Was “Q3”", "To Launches", "Anyone with the link can edit"), a comment's or
  action's words quoted beneath, and the time.
- **Runs.** Consecutive events of one kind by one person on one day fold into one entry ("Renamed 3 times · You ·
  13:47–14:00"); **Show all 3** (`aria-expanded`) deals the run out beneath it.
- **Paging.** Pages of 30. **Show older events** under the rail reads the next page and says how many are shown;
  the button is gone at the end of the history. No other request is made: people's names come from the Explorer's
  shared people store, the one that names the Owner column, gathered into one batch and cached.
- **States.** Loading: a rail-shaped skeleton (`aria-busy`). Nothing yet: the shared empty state. A failed first
  read says so with **Try again**, never "nothing has happened"; a failed later page keeps what is shown and
  offers Try again beside the button.
- **Fit.** A centred panel up to 36 rem wide on a desktop, its body scrolling under the fixed header; edge to edge
  and full height on a phone. Light and dark. Hover transitions are `duration-micro`; a run dealt out fades in, not
  under reduced motion. Escape closes and focus returns to the menu's row.
- **Speed.** The days, runs, chips and summary are worked out once per loaded page and filter (memoised); 1,000
  loaded events group in well under a frame (a test keeps a budget).

A team's events are on every member's Timeline. An API token's expiry warning is the liveworkspace account's,
sent by email ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)), and is no Timeline row.
