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
- A **call** is a livehuddle Space made for one item, with a Participant link that lets its people in. It is **live**
  while anyone is in it.
- The **host** is the account that started it. The Space is theirs, in their own space, named "<item title> Call".
- A **meeting** is a call as the item remembers it: when it started and ended, who was in it, its summary page and the
  plan its actions went to.

## Starting

**Call** sits in the editor's top-right corner card, first, before Copy and Share. Its hover card reads "Start a Call
Here: a livehuddle call about this <noun>, in a new tab."

- Pressing it opens a **new browser tab** at once (an empty one, so no pop-up blocker stops it), and the index answers
  with the call's address, which the tab then goes to. The call never opens inside the item's tab (owner, 2026-11-22).
- **One call an item.** While a call about the item is live, pressing starts nothing new: the person joins that call.
- The call's tab is named for the item, so pressing Call or Join again brings the open call's tab to the front instead
  of opening another, and **Open Item** in the call brings the item's tab back.
- **Who may start one**: anyone who can open the item, at any level (an Editor, a Participant, a Viewer, a holder of a
  tab's link), signed in to an account: the Space needs an owner who keeps it. A guest is offered Join once a call is
  live, never Start.
- If the index can't make the call, the new tab closes and a toast says "Couldn't start the call. Try again."

## Joining

While a call about the item is live, **Call** becomes a pill in its place: a pulsing green dot, "3 in Call", and
**Join**. Its hover card names who is in it ("Call in progress, 3 people: Ana, Bo and Cy").

- **Join** opens the call in its tab (bringing it to the front when it is already open).
- **Who may join**: anyone with at least view access to the item, as the index reads their access to it (a share link's
  code included). An account joins as themselves; a guest who opened the item through its link joins as a guest. They
  go in through the Space's Participant link, so the call's own gates are livehuddle's as for any Space.
- **Live, never polled.** The Space's room tells the index how many people are in it and their names, at most once a
  `ITEM_CALL_SETTLE_MS` (1.5 s) of changes. When the count changes the index tells the item's room through its app's
  `source-changed` door (`{app: livehuddle, itemId: <space>, calls: true}`), the room tells its open sessions, and each
  reads the item's calls again with its own access. Every open of the item reads them once. A missed signal costs only
  freshness.
- A call whose last person leaves has ended: the pill goes back to **Call**, and the item's Meetings list it. Someone
  who opens the Space again later brings it back to live.

## Invites

In the call, **Invite** lists the people who reach the whole item (the same list [Approvals](./approvals.md) names
approvers from) and invites the ones picked, at most 10 a press. Each gets an Inbox row in every app, "Ana invited you
to a call about Launch Plan", which opens the item, where **Join** waits; an open editor shows it as an Inbox notice
([Inbox notices](./inbox-notices.md)). An invite is listed under the Inbox's **Calls** filter for a day, marked Live
while the call is, and never counted in the Inbox's badge. Only accounts who reach the item can be invited; anyone
else is refused before any row is written.

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
offers **Summary** (the page), **Actions** (the plan) and **Open Space**. Summary and Actions show only to a reader who
can open that knowledgebase or plan themselves, so neither name reaches anyone who could not see it. With none:
"No calls yet. Press Call at the top right to start one."

## Recording

A call is never recorded: livehuddle records nothing. Every person who joins a call from an item is told so once, in
the toast that names the item ("This call is about Launch Plan. It isn't recorded."). Should recording come, it is the
host's choice alone, off until they turn it on, with a notice to everyone in the call.

## Who may do what

| Who                                       | Start | Join          | Invite | Wrap Up    | Meetings |
| ----------------------------------------- | ----- | ------------- | ------ | ---------- | -------- |
| Editor, Participant, Viewer (an account)  | Yes   | Yes           | Yes    | The host's | Yes      |
| A guest holding the item's link           | No    | Yes, as guest | No     | No         | Yes      |
| Offline, embed, workbench frame, Community | No    | No            | No     | No         | No       |

## Limits

| Limit                   | Value  | What it bounds                                                          |
| ----------------------- | ------ | ----------------------------------------------------------------------- |
| `ITEM_CALL_SETTLE_MS`   | 1,500  | How often a Space's room tells the index who is in its call             |
| `ITEM_CALL_NAMES_MAX`   | 50     | Names a meeting keeps (everyone who joined, first come)                 |
| `ITEM_CALLS_READ_MAX`   | 20     | Meetings an item's read answers, newest first                           |
| `ITEM_CALL_CHECKS_MAX`  | 10     | Knowledgebases and plans a read checks the reader's access to          |
| `ITEM_CALL_INVITES_MAX` | 10     | People one Invite names                                                 |
| `ITEM_CALL_INVITE_DAYS` | 1      | Days an invite stays in the Inbox                                       |
| Starts, invites, wraps  | 10/m   | The kit run limiter (`KIT_RUN_LIMITER`), under `item-call:<person>`     |

## Cost

No new service, Worker or binding. A call is a livehuddle Space, so it runs on livehuddle's own calls (Cloudflare
Realtime, under its [calls kill switch](../../../../livehuddle/docs/specs/016-platform/calls-kill-switch.md)), and its
minutes count, as any Space's, against the host's month ([Call Minutes](../../../../livehuddle/docs/specs/012-collaboration/call-minutes.md)).
Built-in AI for the summary is Ask AI's allowance ([Ask AI](../020-ask/ask.md) "Built-in AI").

## Security

- **The way in is the item.** The call's link reaches only someone the index has just found can read the item; a link
  forwarded on is a Space link like any, which the host can stop from the Space's Share.
- **Names, not ids, and only to the item's readers.** Who is in a call reaches those who can open the item.
- **No backdoor.** The summary is written by the knowledgebase's own door with the host's grant at their own access;
  the actions are Send to Plan's sends, each checked as any.
- **The signal carries ids only.** A `source-changed` with `calls` says nothing of who or how many.
- **Purges.** A meeting goes with its item or its Space; an invite with its meeting or its person.

## Telemetry

Each app sends these under its own name through the workbench's `track`, in the UI category, typed by the feature and
never by an item or a person: `UI·Started·ItemCall` (a call started), `UI·Opened·ItemCall` (Join pressed),
`UI·Refused·ItemCall` (a start turned away) and `UI·Opened·Meetings` (Meetings opened). livehuddle sends
`UI·Opened·CallItem` (Open Item), `UI·Created·CallSummary` (a summary written to a knowledgebase),
`UI·Used·CallSummaryAi` (Write With AI) and `UI·Created·CallInvite` (an Invite sent). Charted on the site's telemetry
page as the Calls stack in every app (`apps/site/app/telemetry/_shared/item-call-metrics.ts`).
