# Start a Call Here

**Start a Call Here** opens a livehuddle call about any item, in any app, in a new browser tab (Work Tracker 1367). Teams
discuss a diagram, a plan or a document on a call in another tool, then lose what they decided. livehuddle is the
meeting app, but a call only started from livehuddle. Here the call starts from the work, the people who open the work
see it is on and join it, and what was decided lands where it belongs: the summary in a knowledgebase, the actions in
a plan, and both listed on the item.

The platform holds what every app would otherwise build again: the call's record, who may start and join it, the live
count every open editor shows, the invites, the summary's page and the item's Meetings, and the button, the pill and
the Meetings list themselves (one copy in `@liveworkspace/workbench`). livehuddle holds the call (its Space, its audio,
video and screen share) and the Wrap Up ([Calls from other apps](../../../../livehuddle/docs/specs/012-collaboration/calls-from-items.md)).
Where each app's button sits is that app's spec (`<app>/docs/specs/013-workspace/start-a-call.md`).

## Names

- The **item** is what the call is about: a diagram, a plan, a document, a design or a knowledgebase. livehuddle's own
  Spaces start no calls this way: a Space is a meeting already.
- A **call** is a livehuddle Space made for one item, with a Participant link that lets its people in, or the host's
  **Calls Space** when they chose one ([below](#your-calls-space)). It is **live** while anyone is in it.
- The **host** is the account that started it. A Space made for the call is theirs, in their own space, named
  "<item title> Call", and **made by Call**: a mark on the call's record, which only the index sets, and only on a
  Space it made for that call. A Space made by Call goes to the Trash when its call ends ([When a call
  ends](#when-a-call-ends)).
- A **meeting** is a call as the item remembers it: when it started and ended, who was in it, its summary page and the
  plan its actions went to.

## Starting

**Call** sits in the editor's top-right corner card, first, before Copy and Share. Its hover card reads "Start a Call
Here: choose where to meet, then a livehuddle call about this <noun> opens in a new tab."

- **Pressing Call asks first** (Work Tracker 1470). A call never starts by accident: Call opens the
  [Start a Call popover](#the-start-a-call-popover), and only its **Start Call** starts one.
- **Start Call** opens a **new browser tab** in that press (an empty one, so no pop-up blocker stops it), and the index
  answers with the call's address, which the tab then goes to. The call never opens inside the item's tab (owner,
  2026-11-22).
- **One call an item.** While a call about the item is live, pressing starts nothing new: the person joins that call.
- **A Document Room with the item on its wall** (Work Tracker 1427). A Space made for the call is livehuddle's
  [Document Room](../../../../livehuddle/docs/specs/012-collaboration/virtual-office-template.md#document-room)
  (`ITEM_CALL_TEMPLATE`, `document-room`): chairs facing a big wall Screen, and the item already on the Screen, each
  person seeing it with their own access. The index asks the template door for it with `screen: {app, itemId, name}`
  ([kits.md](kits.md) "The apps' door"). A call in a Calls Space leaves that Space as it is.
- The call's tab is named for the item, so pressing Call or Join again brings the open call's tab to the front instead
  of opening another, and **Open Item** in the call brings the item's tab back.
- The tab enters the call through livehuddle's no-click sign-in (`/api/auth/silent?return=<the call's address>`,
  [Signing in without a click](../003-accounts/accounts.md)), so someone signed in to liveworkspace arrives in the call
  signed in, with their own name, even on their first visit to livehuddle; a guest comes straight back as a guest.
  The call's address is a share link (`?s=`), which a page's own no-click sign-in never bounces, so the tab asks first.
- **Who may start one**: anyone who can open the item, at any level (an Editor, a Participant, a Viewer, a holder of a
  tab's link), signed in to an account: the Space needs an owner who keeps it. A guest is offered Join once a call is
  live, never Start.
- If the index can't make the call, the new tab closes and a toast says "Couldn't start the call. Try again."
- With a [Calls Space](#your-calls-space) chosen, the call starts there instead of in a new Space.

### The Start a Call popover

The popover opens under Call, right-aligned to it, in the look of Share (the meeting hero band, the same buttons and
radius); on a phone, from the Apps drawer's Call tile, it is a sheet rising from the bottom edge.

- **Header**: the meeting art's band, "Start a Call", and "About <item title>".
- **Where to Meet**: one choice, as a list of rows, each a native radio so the arrow keys move between them:
  **A New Space** ("Made for this call, named after the <noun>") first, then the person's choosable livehuddle
  Spaces (the [Calls Space](#your-calls-space) picker's list: owned or the team's, most recently changed first), each
  with its preview, its name and "Your Space" or "Team Space". A search field shows from 7 Spaces; the list scrolls
  inside the popover.
- **Preselected from the setting.** The person's **Calls Open In** is chosen when it opens, its Space marked "Your
  Calls Space" (A New Space, marked "Default", when it is unset or Default). A setting that is Unavailable leaves A New Space chosen and says so
  ("Your Calls Space isn't available, so a new Space is chosen.").
- **For this call only.** Choosing another row changes only this call: the setting is never written. Under the list:
  "For this call only. Change where calls open in Settings › Calls."
- **Start Call** (the primary button, last) starts the call as above with the chosen row: A New Space starts it as
  the default does even when a Calls Space is set; a Space starts it there, checked as any Calls Space is
  ([below](#your-calls-space)). Enter in the popover is Start Call. **Cancel**, Escape, the close, or a press outside
  it closes it with nothing started.
- **While the Spaces load** the rows they will fill pulse, and A New Space and Start Call already work; a list kept
  from an earlier open this page shows at once and is read again behind it. **A list that can't load** says "Your
  Spaces couldn't be loaded." with Try Again, and Start Call still starts in the chosen place (the setting's Space,
  named "Your Calls Space", or A New Space). **No Spaces** shows A New Space alone and "Make a Space in livehuddle to
  meet in it."
- **Starting**: Start Call says "Starting" and is disabled until the index answers; the popover closes once the tab
  is open, and the toasts are those above.
- **Join is not asked.** While a call about the item is live, the pill's Join opens it at once: the call has its
  Space already, and there is nothing to choose.
- **Who sees it**: whoever may start a call (an account). A guest sees what they saw before: Join while a call is
  live, nothing otherwise.

## Your Calls Space

**Calls Open In**, in Settings › **Calls** (an account category, [site.md](../010-site/site.md#settings)), picks where
a person's Call opens (Work Tracker 1409). It is one setting on the account, the `all` scope's `callSpace`
([accounts.md](../003-accounts/accounts.md#scopes)), so it follows them to every app and every device.

- **A New Space for Each Call** is the default, and what an unset setting means: Call makes a Space for the item as
  above, exactly as before the setting existed. Picking it again stores an **empty choice** (`''`), never a deleted
  key: each editor lays the account's settings over its own saved copy, so only a value overwrites a Space an editor
  still holds from before. An empty choice reads, and starts a call, exactly as an unset one.
- **One of my Spaces**: the picker lists the person's livehuddle Spaces they can choose, each with its name, its
  preview and whose space it is in (Yours, or a team's), the most recently changed first, at most
  `CALL_SPACES_LISTED` (200). A Space can be chosen when the person **owns it or it is their team's** (they reach it as
  its owner or a member, never through someone's link), and it is out of the Trash and Archived.
- **Starting.** The editor sends the Space chosen in the [Start a Call popover](#the-start-a-call-popover) with the
  start (the setting's, unless the person picked another for this call). The index checks it again as the person, at that
  moment: owned or the team's, livehuddle's, not trashed or archived. Then the call starts in it: the item's call row
  points at that Space, the room is told the call's id, and the tab opens the Space. Everyone who joins from the item
  lands in the same Space. The Space keeps its own name; nothing in it is changed or moved.
- **One call an item still holds.** A live call about the item is joined, never restarted, whatever the setting says.
- **A Space holds one item's call at a time.** When the chosen Space is in a live call about another item, the call
  gets a Space of its own, as the default does, and a toast says "Your Calls Space is in another call, so this call
  has a Space of its own." The other call is never taken over.
- **People already in the Space**, working or meeting with no call, are in the call once it starts: they count in the
  item's pill, and the item's readers can join them. Choosing a Space is choosing to meet there.
- **Unavailable.** A Space that was deleted, archived or trashed, or that the person can no longer choose (they left
  the team, the Space changed hands), is skipped: Call makes a new Space as the default does, and a toast says "Your
  Calls Space isn't available, so this call has a new Space. Choose another in Settings › Calls." Settings shows the
  choice as **Unavailable** with the same reason, until another is chosen or Default is picked again.
- **Who gets in.** Joining is the same as for any call: the index hands the way in only to someone it has just found
  can read the item. The way in to a Calls Space is **one link of its own for calls**, a Participant link the index
  makes on the Space the first time and reuses after, which stops working `CALL_SPACE_LINK_DAYS` (7) days after the
  latest call there started. So someone who joined one call can't come back to the Space for good: the Space's own
  roles and links decide that, as before. The link shows in the Space's Share like any other, so its owner can stop
  it sooner. Settings says so under the picker.
- **When a call there ends.** A Calls Space is used for other things too, so a call in it that has been live and has
  stood empty for `ITEM_CALL_START_GRACE_MS` (2 minutes) has ended for good: people coming back to the Space later are
  not that item's call. Starting a call in it ends any earlier call there that hadn't ended. A Calls Space is never
  made by Call, so it is never deleted ([When a call ends](#when-a-call-ends)); choosing a Space made by Call as your
  Calls Space keeps it.
- **Meetings.** Each call in a Calls Space is its own meeting on its own item, with its own summary and actions. Wrap
  Up is the host's of each.
- **Guests and everyone without the setting** see no change: a guest never starts a call, and a call without the
  setting is made as before.

## Joining

While a call about the item has someone in it, **Call** becomes a pill in its place: a pulsing green dot, "3 in Call", and
**Join**. Its hover card names who is in it ("Call in progress, 3 people: Ana, Bo and Cy").

- **Join** opens the call in its tab (bringing it to the front when it is already open).
- **Who may join**: anyone with at least view access to the item, as the index reads their access to it (a share link's
  code included). An account joins as themselves; a guest who opened the item through its link joins as a guest. They
  go in through the Space's Participant link, so the call's own gates are livehuddle's as for any Space.
- **Live, never polled.** The Space's room tells the index how many people are in it and their names, at most once a
  `ITEM_CALL_SETTLE_MS` (1.5 s) of changes. When the count changes the index tells the item's room through its app's
  `source-changed` door (`{app: livehuddle, itemId: <space>, calls: true}`), the room tells its open sessions, and each
  reads the item's calls again with its own access. Every open of the item reads them once, and again when its tab comes back into view. A missed signal costs only
  freshness.
- A call whose last person leaves has ended: the pill goes back to **Call**, and the item's Meetings list it. Someone
  who comes back into its Space while it is still there brings it back to live.
- A call nobody has joined yet has not ended: the room's first word, an empty Space while the starter's tab is still on
  its way, ends nothing, so for `ITEM_CALL_START_GRACE_MS` after its start it is still the item's call and a second
  press joins it rather than making another.

## When a call ends

A Space made by Call exists for its call alone (owner, 2026-11-25, Work Tracker 1445), so it does not stay behind in
the host's Explorer once the call is over.

- **Deleted when its call ends.** A call that has been live and has then stood empty for `ITEM_CALL_START_GRACE_MS`
  (2 minutes) has ended, and its Space, when made by Call, goes to the Trash, as an Explorer Delete would put it there:
  the host's Trash, restorable for 30 days, then gone. The index's quarter-hourly run does it, so the Space goes within
  15 minutes of the grace running out. A call nobody ever joined has not been live, so its
  Space is left.
- **Someone back in time keeps it.** Anyone who comes back into the Space before then makes the call live again, and
  the Space and everything on it stay. When they leave, it ends again, and the count starts over.
- **Only a Space made by Call.** The mark is the only gate, never a Space's name or template. It is never on a Space
  the person chose as their [Calls Space](#your-calls-space), nor on any Space the index did not make for the call. A
  Space made before the mark existed has none and is left as it is.
- **Made your own, kept.** The host makes a Space made by Call their own, and it loses the mark for good, by renaming
  it, moving it to a folder or a team, archiving it, choosing it as their Calls Space, or restoring it from the Trash.
  It is then a Space like any other, and its later calls end without deleting it.
- **What goes, what stays.** Whatever was drawn or written on the Space goes to the Trash with it. The meeting stays on
  the item: its time, who was in it, its summary page and the plan its actions went to stay in the item's Meetings,
  even once the Trash has purged the Space. The summary and the actions are in a knowledgebase and a plan of their
  own, never in the Space.
- **The next Call makes a new Space.** An ended call is never joined again, so pressing Call afterwards starts a fresh
  call in a fresh Space.

## Invites

In the call, **Invite** lists the people who reach the whole item (the same list [Approvals](./approvals.md) names
approvers from) and invites the ones picked, at most 10 a press. Each gets an Inbox row in every app, "Ana invited you
to a call about Launch Plan", whose reading pane reads the call as it stands and has **Join Call** while it is on
("The call has ended" after); an open editor shows it as an Inbox notice
([Inbox notices](./inbox-notices.md)). An invite is listed under the Inbox's **Calls** filter for a day, marked Live
while the call is, and never counted in the Inbox's badge. Only accounts who reach the item can be invited; anyone
else is refused before any row is written.

**Who may invite** is whoever may speak in the call: an account at Participant or above on the call's Space, who
reaches the item (owner, Work Tracker 1458). A Viewer of the Space watches and invites no one: livehuddle shows them
no Invite, and the index refuses their invite and the list of whom to invite (`403`). A call's Space is shared by its
Participant link, so everyone who joins from the item may invite; a Viewer is someone holding a view link to the Space
itself (a public link, or a Viewer link made before livehuddle stopped offering them).

## After the call

livehuddle's **Wrap Up**, the host's alone, asks where the meeting goes
([Calls from other apps](../../../../livehuddle/docs/specs/012-collaboration/calls-from-items.md) "Wrap Up"):

- **The summary** is written as a page in a knowledgebase the host picks, through the knowledgebase's own door as the
  host (the "Write a Page in a Knowledgebase" step of [Automations](../018-automations/automations.md) "Steps in other
  apps"): never verified, its Owner the host, stamped as written from the call. The default is a knowledgebase
  connected to the item ([Connected tabs](./connected-tabs.md), either way), else the newest knowledgebase of the
  item's team the host can edit, else none, and the host picks one.
- **The actions** go to a plan through [Send to Plan](./send-to-plan.md): the Space's stickies, one card each. A card
  sent from a call's Space carries, under its line back to the sticky, a second line back to the item: "Discussed on a
  call about <item title> (<app>): <link>".
- Both are kept on the meeting: the summary's page and the plan the last send went to.

## Meetings

Every editor's [Tools](./footer-tools-menu.md) has **Meetings**, under Collaborate, for someone who can read the item's
calls: an account or a guest holding the item, the item in the cloud (not Offline, an embed, a workbench frame or a
Community copy). It opens inside Tools: the live call first, with **Join**, then the meetings, newest first, at most
`ITEM_CALLS_READ_MAX` (20). Each says when it started and how long it ran, who was in it (eight names, then "+N"), and
offers **Summary** (the page), **Actions** (the plan) and, while it is live, **Join**. Summary and Actions show only to a reader who
can open that knowledgebase or plan themselves, so neither name reaches anyone who could not see it. With none:
"No calls yet. Press Call at the top right to start one."

## Recording

A call is never recorded: livehuddle records nothing. Every person who joins a call from an item is told so once, in
the toast that names the item ("This call is about Launch Plan. It isn't recorded."). Should recording come, it is the
host's choice alone, off until they turn it on, with a notice to everyone in the call.

## Who may do what

| Who                                        | Start | Join          | Invite | Wrap Up    | Meetings |
| ------------------------------------------ | ----- | ------------- | ------ | ---------- | -------- |
| Editor, Participant, Viewer (an account)   | Yes   | Yes           | Yes    | The host's | Yes      |
| A Viewer of the call's Space (an account)  | n/a   | Watches       | No     | No         | n/a      |
| A guest holding the item's link            | No    | Yes, as guest | No     | No         | Yes      |
| Offline, embed, workbench frame, Community | No    | No            | No     | No         | No       |

## Limits

| Limit                   | Value | What it bounds                                                      |
| ----------------------- | ----- | ------------------------------------------------------------------- |
| `ITEM_CALL_SETTLE_MS`   | 1,500 | How often a Space's room tells the index who is in its call         |
| `ITEM_CALL_NAMES_MAX`   | 50    | Names a meeting keeps (everyone who joined, first come)             |
| `ITEM_CALLS_READ_MAX`   | 20    | Meetings an item's read answers, newest first                       |
| `ITEM_CALL_CHECKS_MAX`  | 10    | Knowledgebases and plans a read checks the reader's access to       |
| `ITEM_CALL_INVITES_MAX` | 10    | People one Invite names                                             |
| `ITEM_CALL_INVITE_DAYS` | 1     | Days an invite stays in the Inbox                                   |
| `CALL_SPACES_LISTED`    | 200   | Spaces Settings › Calls lists to choose from                        |
| `CALL_SPACE_LINK_DAYS`  | 7     | Days a Calls Space's call link works after its latest call started  |
| `ITEM_CALL_SWEEP_MAX`   | 50    | Spaces made by Call one quarter-hourly run moves to the Trash       |
| Starts, invites, wraps  | 10/m  | The kit run limiter (`KIT_RUN_LIMITER`), under `item-call:<person>` |

## Cost

No new service, Worker or binding. A call is a livehuddle Space, so it runs on livehuddle's own calls (Cloudflare
Realtime, under its [calls kill switch](../../../../livehuddle/docs/specs/016-platform/calls-kill-switch.md)), and its
minutes count, as any Space's, against the host's month ([Call Minutes](../../../../livehuddle/docs/specs/012-collaboration/call-minutes.md)).
Built-in AI for the summary is Ask AI's allowance ([Ask AI](../020-ask/ask.md) "Built-in AI").

## Security

- **The way in is the item.** The call's link reaches only someone the index has just found can read the item; a link
  forwarded on is a Space link like any, which the host can stop from the Space's Share.
- **A Calls Space is never opened wider than its owner meant.** It can be chosen only by its owner or its team's
  members, is checked again at every start, and its call link stops a week after the latest call
  ([Your Calls Space](#your-calls-space) "Who gets in").
- **Names, not ids, and only to the item's readers.** Who is in a call reaches those who can open the item.
- **No backdoor.** The summary is written by the knowledgebase's own door with the host's grant at their own access;
  the actions are Send to Plan's sends, each checked as any.
- **The signal carries ids only.** A `source-changed` with `calls` says nothing of who or how many.
- **Purges.** A meeting goes with its item. Its Space going (to the Trash and then purged) leaves the meeting, with
  no Space: it can't be joined again. An invite goes with its meeting or its person.
- **Deleting only what Call made.** The quarter-hourly run trashes a Space only when its call's record carries the
  made-by-Call mark, the call has been live and has stood empty past the grace, and the Space is still livehuddle's,
  out of the Trash and Archived. Each move to the Trash is one statement that checks all of it again, so someone
  rejoining a moment before is never cut off.

## Telemetry

Each app sends these under its own name through the workbench's `track`, in the UI category, typed by the feature and
never by an item or a person: `UI·Started·ItemCall` (a call started), `UI·Opened·ItemCall` (Join pressed),
`UI·Refused·ItemCall` (a start turned away), `UI·Opened·Meetings` (Meetings opened) and `UI·Opened·MeetingSummary` (a
summary opened from Meetings). livehuddle sends
`UI·Opened·CallItem` (Open Item), `UI·Created·CallSummary` (a summary written to a knowledgebase),
`UI·Used·CallSummaryAi` (Write With AI) and `UI·Created·CallInvite` (an Invite sent). Charted on the site's telemetry
page (`apps/site/app/telemetry/_shared/item-call-metrics.ts`) as the Start a Call Here stack in every app but
livehuddle, and as the Calls About Items stack in livehuddle.
