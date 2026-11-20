# Inbox notices

Someone working in one item only learned about a new Inbox row (a mention, a card handed to them, someone asking to
get in) by opening the Inbox. An Inbox notice puts it on screen while they work: a small card in the editor, saying
what arrived and from whom, with a link to it. The Inbox itself is unchanged ([one-explorer-contracts.md
"Inbox"](one-explorer-contracts.md#inbox)); notices are a way of hearing about its new rows.

## Who sees them, and where

- **Every editor with an Inbox** (livediagram, liveplanner, livedocuments, livedesign; not livehuddle, which has no
  Inbox, `appHasInbox`), for a **signed-in account**. A guest has no notices: their own moves can't be told from
  anyone else's without an account id.
- Only the person's own Inbox: the rows come from their own `GET /inbox`, which lists only items they can reach. A
  notice shows nothing that row does not, so it never names an item the reader can't see, whatever their role on the
  open item (Viewer, Participant or Editor alike).
- Not in Zen mode, an embed or the workbench frame: the editor's menu card (the Explorer button) is not drawn there,
  and the notices go with it. The rows wait in the Inbox and its count.

## What notifies

A row notifies when it is **new to this browser**: its key at its time has not been shown, dismissed or read here
before. Each kind, and what it says:

| Kind           | When                                                                                                        | Says                                                     | Link                 |
| -------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------- |
| Mention        | a thread mentions the reader and its latest comment is someone else's                                       | **Priya mentioned you**, the comment's first line        | the Inbox at the row |
| Comment        | a thread on the reader's item, or one they are in, where someone else wrote last                            | **Priya commented** or **Priya replied**, its first line | the Inbox at the row |
| Assigned       | an open action or card assigned to the reader by someone else                                               | **Bo assigned you a card**, its number and title         | the Inbox at the row |
| Access request | someone asks for access to an item the reader manages ([request-access.md](request-access.md#in-the-inbox)) | **Ana asked for access**, the item                       | the Inbox at the row |
| Share          | a manager granted the reader's own request in the last 7 days (`shares`, below)                             | **Ana shared it with you**, the item named below         | the item             |

Each notice also names the item (and the tab, for a thread). Form responses, work the reader handed out and threads
whose latest comment is their own never notify: the reader's own actions are never news. A row older than 24 hours
never notifies (a browser opened after a week away shows the Inbox's count, not a week of notices), and neither does
anything already in the Inbox when this browser first watches for this person.

A share has no row of its own in the Explorer's Inbox list (it asks nothing), so its link opens the item itself, in
its app. An access request's row (`r:<request id>`) is on the Inbox of the request's app, or on liveworkspace.app's
for an app with no Inbox (livehuddle).

### `shares` in the Inbox read

`GET /inbox` also answers `shares`: the reader's own access requests granted in the last `INBOX_SHARES_MS` (7 days),
newest first, on items they still reach through a live link and not in the Trash, each
`{ id, app, itemId, itemTitle, itemTeamId, sharedById, sharedByName, sharedAt }`. `sharedById` and `sharedByName`
are the `shared` event the grant wrote (its actor, and their name as accounts gave it then; null for a grant written
before names were kept, which reads **Someone**). The Explorer's list draws no rows from it.

## How the editor hears

The Inbox is read, not pushed: an index Durable Object or socket per person would be new infrastructure, and an
item's rows reach the index only when its outbox drains (at least 60 seconds apart,
[blueprints/inbox.md](blueprints/inbox.md)), so a push could beat a short read by seconds at most.

- **One reader per browser per address.** Every tab of one app address shares one read: a tab reads `GET /inbox`
  (every app, the default limit) at most every 30 seconds, and only when no other tab of that address read in that
  time (the time of the last read is kept in `localStorage`); the answer goes to every tab of the address over a
  `BroadcastChannel`. So the reads per hour are those of one tab however many are open.
- **Only while someone is there.** A tab reads only while it is visible and has had a key or pointer press in the
  last 10 minutes; coming back (visible again, focus, or the first press after a pause) reads at once when the last
  read is more than 15 seconds old. A browser left on a page overnight reads nothing after its first 10 quiet
  minutes.
- **The Explorer's Inbox listens too.** The Inbox's list and badge (`useInbox`, on the Explorer page and in the
  editor's panel) take each new answer: with the All filter it becomes the list as it is, with no request of its own;
  with this app's filter, an answer whose rows differ from the list's reads the list again. So the editor's count,
  the panel's rail and the Explorer's sidebar move together, live.
- A failed read keeps what was there; the next read is the next turn.

## How a notice looks

A small card under the editor's top-right corner card (its Share and account buttons), 8 px below it, 320 px wide on
a computer; on a phone and at 450 px it spans the screen under the top row with a 16 px gutter. It never covers the
palette strip, the menu card or the corner card, and takes no focus.

- **One row**: the kind's icon, who and what in one line (**Priya mentioned you**), the comment's first line in quotes
  where there is one (an `@handle` of the reader, of who mentioned them or of who wrote it reads as that person's
  name, **@Ada Quinn**, not **@ada-quinn**; anyone else's handle stays as written, as in the comment's chips), the item (› the tab › the element, or › the card, as its Inbox row names them, so rows on one
  canvas tell apart) in small text, and one action: **Open in Inbox** (or **Open** for a share).
  A close button (**Dismiss**, with its tooltip) at the top right.
- **Several rows** that arrive in one read, or while a notice is still on screen, are one notice: **3 New in Your
  Inbox**, then up to three lines (each who and what, then the item, each a link to its own place), **and 2 more**
  past three, and **Open Inbox**.
- Light and dark from the page's theme; the card is the corner card's surface (white or slate-900, its border and
  shadow). It slides down 8 px and fades in over 160 ms, and only fades with reduced motion (the system setting or
  the app's Reduce Motion).
- Announced politely (`role="status"`): a screen reader hears the notice's first line once, never twice.
- **Never over a dialog.** While a dialog is open over the page (a modal such as Share, or a canvas modal such as
  livedesign's Start Making Pages), a notice waits: it is not drawn and its 15 seconds do not run. It shows when the
  dialog closes, with its full time.

## How a notice goes away

- **Dismiss**, Escape while it has focus, or following one of its links.
- **On its own** after 15 seconds, held while the pointer is on it, focus is in it, or a dialog is open.
- **Opening the Inbox**: while the Inbox list is on screen (the Explorer page or the editor's panel), every row it
  lists counts as read, and an open notice closes.

Whatever way it goes, its rows are **seen** in this browser: they never notify again, in this tab or any other of the
address, until they change (a new comment, a card handed over again). A notice dismissed in one tab closes in every
other tab of the address at once. Seen rows are kept per person in `localStorage`, bounded, and let go once the Inbox
no longer lists them. Another browser or device keeps its own: the index holds no read state (one-explorer.md "Open
questions").

## The count

The editor's Explorer button carries this app's Inbox count (the sidebar's rule, what waits on the reader,
[one-explorer-contracts.md "Inbox"](one-explorer-contracts.md#inbox), over the rows of the editor's own app only) as
a small brand badge at its corner, `9+` past nine, nothing at 0; the button's name says it ("Explorer, 3 in Inbox").
It moves with each read. The owner, 2026-11-19: "It should only show the inbox items I have in that app, not all
apps". Every row names its app as the index's `?app=` reads it (an access request its item's, a card thread the
plan's that lists it), so each row counts in its own app's editor and none is lost; a livehuddle request, an app
with no Inbox, counts in liveworkspace.app's Explorer, which lists every app's. The editor's panel draws the same
number on its rail's Inbox, whichever filter its list shows, so the two never disagree; the Explorer page's sidebar
keeps the count of the list it shows (All's, every app's). A row done from the Inbox's pane (resolved) leaves the
count at once and after a reload, while the index still lists it ([one-explorer-contracts.md "What the reading pane
can do"](one-explorer-contracts.md#inbox)).

## Telemetry

Through the editor's `track` (the workbench binding): `UI·Opened·InboxNotice` when one of a notice's links is
followed, `UI·Removed·InboxNotice` when the person dismisses it (Dismiss or Escape). Nothing on its own timeout.

## Not in scope

- Read state across devices, snooze, or a setting to turn notices off (the editor's Show Notifications preference
  quiets toasts, not these).
- Desktop (system) notifications, sound, or the browser tab's title.
- Notices on the Explorer page itself: the Inbox is there.
