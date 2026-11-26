# Reading and acting in the Inbox

The Inbox ([one-explorer-contracts.md "Inbox"](one-explorer-contracts.md#inbox)) lists what waits on someone across
every app. Two things made it hard to use (Work Tracker 1466, Work Tracker 1472): comments an AI wrote through the MCP
filled it and read as the person's own, and a row of another app could only be opened there, never answered where it
was read. This spec sets how a row reads, how it opens and is acted on in place in every app, how read and unread
stay in step across apps, and how AI comments reach it. Built once in the shared Explorer (`packages/explorer`), so
the Explorer page (liveworkspace.app's and each app's) and every editor's panel behave the same.

## A row says what happened, who, where and when

Each row is four short lines, after a dot that marks it unread:

1. **Who** and **what happened**, in one phrase, and its age: **Priya mentioned you**, **Bo replied**, **Ana
   assigned you a card**, **Claude** (AI) **needs your response**, **6 new responses**, then "12m", "3h", "2d" or the
   date (the full date in its tooltip).
2. **What it is**: the card's number and title, the thread's title or element, the action, the form's heading, the
   page (and the card's status chip, as before).
3. **The words**: the latest comment's first line in quotes for a thread, an action's or a card's note, a
   suggestion's reason, a rule's notice. Absent when there are none.
4. **Where**: the app's Living Prism, the **app's name** (livediagram, liveplanner, ...) and the item, then the tab
   (› Board). The teal **Offline** pill for an item only this browser holds.

An **unread** row has the brand dot before its lead and its who and title semibold; a read row has neither. The
reason's icon is kept beside the phrase so it never rests on words alone. A row an AI wrote last reads the
assistant's name with the violet **AI** chip, on the violet sparkle tile in place of a face (below, "AI comments").

The list keeps its date dividers (Today, Earlier This Week, Older), its filter dropdown and its keys.

## Opening a row: the thread in place

Choosing a row (a click, a tap, j/k or the arrows) shows it in the reading pane: beside the list on a page 768 px
or wider, in the list's place on a phone and in every editor's panel, under the shared back bar. The pane shows the
**whole thread** for a thread row, every comment oldest first, read from the owning app: an element's thread from
`GET /api/<items>/:id/comments?status=all`, a Plan card's thread from `GET /api/projects/:id/threads?item=<card id>`
(the threads on that one card). An AI's comment in the thread reads the assistant's name, the **AI** chip and
"for <person>" (the person whose token it wrote with: **for You** when that is the reader). A read that fails keeps
the row's latest comment, as before.

## Acting in place, in every app, for every app's threads

The pane's verbs:

- **Reply** (r): a field under the thread and **Send** (⌘↵). The reply joins the thread at once.
- **Resolve** (e): the thread is resolved in its app; the row leaves the list and the pane moves to the next row.
- **Mark Unread** / **Mark Read** (u): an icon button at the end of the pane's place line, with its name as a tooltip; the row's read state, below.
- **Open in <app>** (↵): always there, opening the row at its place in its app, as before.

Reply and Resolve work on **every app's threads from every page with the Inbox**: liveworkspace.app, each app's
Explorer page and each editor's panel. On liveworkspace.app the page's workspace token is already addressed to
every app's API. On an app's own address, and in its editors, the page asks accounts for one through its own
bearer: `GET /api/workspace/account/workspace-token` (the app's router forwards it to accounts'
`/api/account/workspace-token`, [accounts.md "liveworkspace.app's own token"](../003-accounts/accounts.md#liveworkspaceapps-own-token)),
kept until a minute before it runs out and asked once for every app's rows. With it the pane calls the owning app's
comment routes as the person, exactly as liveworkspace.app does. A signed-out reader, a guest (who has no account
to trade for a token) and a page whose ask fails offer no Reply or Resolve on another app's rows (Open in the app stays).

### Share roles

The owning app decides, as for any comment: a **Participant** or an **Editor** of the item replies and resolves; a
**Viewer** does neither (each product's comment routes answer 403). The pane reads the reader's level on the item
from the index (`GET /items/:id`, `item.access`, already read for its thumbnail) and offers Reply and Resolve only
at `participate` or above; for a Viewer it says **You can view this <kind> but not reply or resolve.** under the
verbs, and Open in the app stays. A refusal the pane could not foresee (a role changed since) says **Couldn't send
your reply.** or **Couldn't resolve this thread.**, as before.

## Read and unread, kept by the index

Read state is the person's, kept by the index (`inbox_reads`, `inbox_read_marks`, [blueprints/inbox.md "Read
state"](blueprints/inbox.md#read-state)), so a row read in livediagram reads as read in liveplanner, on
liveworkspace.app and on another device, at the next read of the Inbox (at most 30 seconds on an open page, at once
on coming back to the tab).

- A row is **read** when the person has chosen it and it has been shown in the pane for 1 second (the first row the
  page shows on its own as it opens is not read by that), or acted on there (Reply, Resolve, Open in the app), and
  **unread again when it changes**: a new comment, a card handed over again (its time moves past the time it was read
  at). A thread whose latest comment is the reader's own (not their assistant's) is read: their reply, here or in the
  app, has nothing new for them.
- **Mark Unread** (u) in the pane makes it unread until it is read again; **Mark Read** undoes that.
- **Mark All Read**: a glyph button (a double tick, tooltip **Mark All Read**) in the Inbox's header row, beside the
  filter, on the page and in the panel; disabled while nothing is unread. Every row listed or not becomes read; what
  arrives after is unread.
- Each change shows at once (the page holds it until the next read agrees) and is sent to the index in the
  background; a failed send keeps the change on this page and is tried again with the next change.
- **The count** ([inbox-notices.md "The count"](inbox-notices.md#the-count)) is the rows that wait on the reader and
  are unread: Mark All Read clears the badge, and new work raises it again.
- A guest's read state is the page's alone (the index keeps none for a guest).
- An index from before read state answers none: every row reads unread, and the count is as it was.

`GET /inbox` answers `read: { before, at }` for an account: `before` the time of their last Mark All Read (0 for
never) and `at` the time each listed row was read at (`0`: marked unread), by row key (`inboxRowKey`,
`@liveworkspace/index-client`). A row is read when `at[key] >= its time`, or, with no entry, when `before >= its time`.

`PUT /inbox/read` `{ read?: [{ key, at }] (≤ 200), unread?: [key] (≤ 200), all?: true }`, an account's alone (a guest
or an app `403`), writes them in one batch: `all` first (the mark moves to now, and every row entry of theirs goes),
then each read (`at` kept as the row's time it was read at, never moved back) and each unread (`at` 0). `204`; a key
over 300 characters, a bad time or too many `400 invalid_read`. The person's entries are kept to the newest 1,000.

## AI comments

A comment an agent writes through an API token (the MCP's tools, the CLI, a script) is stamped by its app with
`ai: true` and the assistant's name, `agent` (the MCP's client name, `X-<App>-Agent`; else the token's name; else
**MCP**, **CLI** or **API Token**, `itemAgentOf`), and stays the person's comment (`authorId` theirs).

- **It makes no Inbox entry by default.** A thread whose every comment is an AI's, none asking for a response, is
  listed in nobody's Inbox (`aiState` `quiet`, below); it is still pushed, so History and the event log keep it. An
  AI's reply in a thread people wrote in keeps the thread listed as it was, its latest comment marked AI.
- **An AI can ask for a response.** A comment created with `needsResponse: true` (the MCP's `change_threads` and
  `change_plan_threads` start and reply ops, the comment routes' body; only an agent's comment keeps it) asks the
  people the thread reaches (the item's owner, those in it and those mentioned) to answer or act. While no person
  has written in the thread since, its row is listed with **Needs your response** (the speech bubble icon, counted in
  the badge, a mention's weight), marked AI with the assistant's name. A person's reply ends it.
- **It never reads as mine.** A row whose latest comment is an AI's names the assistant (**Claude** with the AI chip
  on the violet sparkle tile), never "You", and the pane's comment says **for You** or **for Priya**.
- **Every app's own thread says the same.** A card's, an element's, a Sheet cell's or a page's thread in each app
  names an AI's comment by the assistant (its initial on the disc), then the **AI** chip, **for Priya** (the token's
  person) and, when flagged, **Asks for a response**: one `AiCommentMarks` (`@liveworkspace/ui/ai-comment-marks`),
  which the Inbox's chip and ask badge are too. An agent's comment from before the name was kept still shows
  **Generated by AI**. liveknowledge's page-foot threads keep the name but take no `needsResponse`, since they make no
  Inbox row to ask from.
- Old clients keep working: a comment without `needsResponse` simply makes no entry, and a push from an app before
  this change carries no `aiState` (read as before).

A thread's push says it (`CollabThreadInput`, [one-explorer-contracts.md "What an item pushes"](one-explorer-contracts.md#what-an-item-pushes)):
`latestAgent` (the latest comment's `agent` when it is an AI's, else absent) and `aiState`: `quiet` when every comment
is an AI's and none asks, `ask` when an AI comment with `needsResponse` is newer than every person's comment, else
absent. Worked out once, by `threadAiState` (`@liveworkspace/model-core/comment-ai`), for every app's threads.

## Telemetry

Through the host's `onTelemetry` (`Activity`): `Changed` `Read`, `Unread` and `ReadAll` for the read verbs, as
`Activity·Added` (`Reply`) and `Activity·Resolved` (`Thread`) are for the others.

## Not in scope

- Snooze, Later, Done or archive of a row: a row leaves when its work is done in its app.
- Reply and Resolve on an Offline row (only its editor reaches that store).
- Read state for the editor's Inbox notices, which keep their own seen rows per browser ([inbox-notices.md](inbox-notices.md)).
