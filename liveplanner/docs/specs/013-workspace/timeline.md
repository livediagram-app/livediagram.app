# Timeline

The record of what happened to the plans a person can reach, and their teams' plans, shown in the shared Explorer at
`/explorer/timeline`. liveworkspace's index keeps it for every app; liveplanner reports who edited which plan and
renders the view through [`@liveworkspace/explorer`](../../../../packages/explorer/README.md). The calls and types are
in [one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "Timeline"; the help article
is `apps/help/app/explorer/timeline`.

## 1. What is recorded

The index records what it changes itself, in the same batch as the change: a plan made (`created`, with `source`
`ai` for an MCP create and `import` for a CLI one, or `copiedFrom` for a copy), `renamed`, `moved`, `trashed`,
`restored`, `shared` (a share link made, with its level), `unshared` and `favourited` (on its person's Timeline only).

liveplanner reports `edited`. The plan's room records the editor of every save made through an HTTP route that
carries an identity (`plan-room.ts`, `recordEditor` in `plan-outbox.ts`): one outbox row per person, replaced on each
save, so a burst of saves is one row. The outbox drains them with the plan's other index reports, up to
`APP_EVENTS_MAX` a batch, as `PUT /app/items/:id/events`. The index keeps one `edited` event per person, plan and
UTC day, moving its time forward, and records a use day for that person, so editing a plan counts toward Most Used.
Writes from a WebSocket participant carry no account and are not attributed.

## 2. Who sees what

A person sees the events on plans in their own space, and on each team's plans for every team in their token
(including what happened before they joined). A plan shared with them through a link is not on their Timeline. The
index keeps no names: a card says "you" for the reader's own doing, the name an app reported, or "a teammate".

## 3. The view

The Explorer's Timeline row sits in the sidebar's Overview group under the Inbox, in amber. The pane header carries
the This app / All filter (the Explorer's one filter, remembered per app in this browser under
`liveworkspace:explorer-filter:<app>`, or the host's when it controls it), the Cards / Calendar switch and Filter.

- **This app** asks for liveplanner's events only; **All** for every app's, each card wearing its app's mark and
  opening in its own app.
- One day per group on a rail, **Today** marked; each day's cards in the Explorer's card grid. A card shows the
  plan's thumbnail (or the event's glyph on its tone's tint), its current name, the reason line ("Plan Renamed") in
  the event's tone, and the time with its detail ("Was “Q3” · by you").
- Tones: red for the Trash, amber for renamed, moved and sharing, green for made, edited, restored and favourited.
- A day's run of one kind folds into a stack ("Plans Renamed", "12 events · click to expand"), dealt out beside it
  on a click. A plan made and edited the same day shows only its making.
- **New** marks events by someone else since the last look. The first page carries `seenAt`; the visit then posts
  `POST /timeline/seen`. A first visit marks nothing.
- Pages of 30, **Show More** for the next. A failed read with nothing loaded says so, with Try again, never "nothing
  has happened".
- Filter: Everyone or Other people, a chip per kind of event, and a mini calendar that jumps to a day. The filters
  run on the loaded pages; with nothing matching, the feed says so and offers Show More and Clear filters.
- Calendar: a month grid with a dot per tone on each day; a dot opens that day's cards.
- A plan in the Trash opens the Trash.

## 4. Telemetry

`Timeline·Changed` (`Cards` is reported as `List`, and `Calendar`), `Timeline·Selected` (a category switched off,
`Everyone`, `Others`), `Timeline·Loaded` (`More`, `Retry`) and `Timeline·Opened` (`Card`, `Stack`), through the
Explorer's `onTimeline` prop (`app/explorer/ExplorerShell.tsx`).

## 5. Performance

One indexed statement per page (by scope, then app, then time; at most `limit + 1` rows read per scope). Measured on
the index with 10,000 events of the reader's among 100,000: 14.7 ms for every app, 2.2 ms for one app. The view
renders one page at a time; working out the days and stacks of 10,000 loaded events stays under the test's budget.

## 6. Not carried over

livediagram's card ⋯ menus and inline rename on a card, deep links to one event, a plan's own History panel, a
team's Team Activity, and the unread count on the sidebar's row.
