# Approvals

Status: built (Work Tracker 937) in livediagram, livedocuments and livedesign.

## What

Decision records, policies, designs and architecture diagrams often need sign-off from named people. An **approval
request** asks them for it, in the item itself: an Editor of the whole item names the people who should approve it,
with a note and an optional due date. Each **approver** answers **Approve** or **Request Changes**. The item wears a
badge saying where it stands, and keeps saying so after it is approved: once the item changes, the badge reads
**Changed Since Approval**.

It is the index's: one record for every app (platform first, [platform.md](../001-platform-scope/platform.md)), beside
the item's share links and History. An app keeps a thin door: its gate, its email and where its badge, banner and Share
dialog sit. livediagram, livedocuments and livedesign offer it (the owner's scope, 2026-11-15); liveplanner and
livehuddle do not yet.

## One request at a time

An item has at most one **open** request. The item's **approval** is its latest request, unless that was cancelled.

| State       | Means                                                                  | Ends when                                                    |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `open`      | Waiting on its approvers' decisions                                    | every approver has approved (`approved`), or it is cancelled |
| `approved`  | Every approver approved; closed at the last approval (`closedAt`)      | never: a new request takes its place as the item's approval  |
| `cancelled` | Cancelled by an Editor, or replaced by a new request while it was open | never                                                        |

- **Each approver decides once per request, and may change their mind while it is open**: an approver who asked for
  changes approves once the change is made, and one who approved may ask for changes after all. Once every approver
  has approved, the request closes and the decisions stand.
- **Requesting again replaces.** A new request while one is open cancels the old one in the same batch (its
  `approval_cancelled` event says `replaced`), so the item never has two.
- **An item keeps its newest five requests** (`APPROVALS_KEPT`); a sixth deletes the oldest in the same batch. Only the
  newest is ever read; the rest are its History's, which the event log keeps.
- An approver who can no longer open the item (their link deleted, gone from the team) still holds their place: the
  request waits on them. An Editor cancels it and asks again without them.

## The badge

What the item's approval says, the same in every app (`status` on the wire):

| Status              | When                                                           | Badge                            |
| ------------------- | -------------------------------------------------------------- | -------------------------------- |
| `awaiting`          | Open, and no approver has asked for changes                    | **Awaiting n of m** (n approved) |
| `changes_requested` | Open, and at least one approver has asked for changes          | **Changes Requested**            |
| `approved`          | Approved, and the item's content unchanged since               | **Approved**                     |
| `changed`           | Approved, and the item's content saved after the last approval | **Changed Since Approval**       |
| none                | No request, or the latest was cancelled                        | no badge                         |

### Changed Since Approval: the item's revision

Every app reports its content's revision to the index with the summary it already pushes after a content save
([one-explorer-contracts.md "What an item pushes"](one-explorer-contracts.md#what-an-item-pushes)): the push's
`updatedAt` is the time of the item's newest content save. The index keeps it as the item's **`content_at`**, which only
moves forward and which nothing else writes (a rename, a move or a share leaves it alone, as none of them changes what
was approved). The approval is `changed` when `content_at` is later than its `closedAt`.

- A save made before the last approval but pushed after it carries its own, earlier time, so it never reads as a
  change.
- The push follows a save on idle, at most once a minute, so the badge turns to Changed Since Approval within about
  a minute of the first save after it.
- Every app reports this way, liveplanner and livehuddle included, so an app that adds the door later needs no new
  push.

## Who may do what

The share roles every app applies (each app's `013-workspace/share-roles.md`), with one exception: **approving and
requesting changes is the one write a Viewer has** (the owner's choice, 2026-11-15). Only a named approver may decide,
whatever their level.

| Who                                                                                                        | Sees the badge | Requests and cancels | Approves or requests changes |
| ---------------------------------------------------------------------------------------------------------- | -------------- | -------------------- | ---------------------------- |
| An **Editor** of the whole item: its owner, a member of its team, an edit link to the whole item           | Yes            | Yes                  | When named                   |
| An Editor through a link **confined to one tab**                                                           | Yes            | No                   | No                           |
| A **Participant**                                                                                          | Yes            | No                   | When named                   |
| A **Viewer**                                                                                               | Yes            | No                   | When named                   |
| A **Community** visitor (a public link), a **guest**, a workbench frame, an embed, an item in This Browser | No             | No                   | No                           |
| An **API token** (agents, MCP, CLI: an app acting for its person)                                          | No             | No                   | No                           |

Every route refuses an app acting for a person, the Drive mirror and the data export (403 `approvals_need_a_person`),
and a guest token, as the index refuses guests everywhere. A Community visitor's request answers `approval: null`.

### Who may be named

An approver is an **account** who reaches the **whole item** now, at any level:

- its owner (a personal item);
- a joined member of its team (a team item), as accounts says now;
- someone who came in through one of its live share links that opens every tab (they are in its Shared with me).

Never a guest (no address to email, no index access), never the person asking (they cannot approve their own
request), and at most `APPROVERS_MAX` (10) people. Anyone else named refuses the whole request (422
`approver_cannot_open`), naming nobody, so a request never reaches a stranger's inbox.

## Asking for approval

`POST /items/:id/approval` `{approverIds, note?, due?, snapshotId?}`:

- `note`: what to look at, trimmed, at most `APPROVAL_NOTE_MAX` (500) characters; empty is none.
- `due`: a day (`YYYY-MM-DD`, a real date) the requester hopes for an answer by. It is shown, never enforced: nothing
  closes a request when it passes. Past it, the badge's tooltip and the banner say **Overdue**.
- `snapshotId`: the snapshot ([014-snapshots](../014-snapshots/snapshots.md)) the editor took of the item as it was asked
  about, when the requester ticked **Save this version as a snapshot**. The index keeps the id and shows it; the
  snapshot itself is the item's, and goes with the item's five-snapshot rule.
- At most `APPROVAL_REQUESTS_PER_DAY` (10) requests on one item in a day, counted from its `approval_requested` events
  of the last 24 hours (429 `rate_limited`), so a request can't be used to send email in a loop.

In one batch: the old open request cancelled (when there is one), the request and its approvers written, the
`approval_requested` event (and the cancelled one's `approval_cancelled`), and the oldest request past five deleted.
Then, off the response's path, the index tells the item's app, which emails each approver (below).

## Deciding

`POST /items/:id/approval/decision` `{decision: 'approve' | 'request_changes', note?}`, by a named approver of the open
request who still reaches the whole item. `note` (at most 500 characters) is the approver's word on what to change, or
on the approval. Asking for changes asks for a note in the editor; the index takes one without.

- The approver's decision, note and time are written with the event (`approval_approved` or
  `approval_changes_requested`), and, when it is the last approval, the request closes as `approved` in the same batch
  (its event carries `complete`).
- The same decision again changes nothing and records nothing.
- Not named: 403 `not_an_approver`. No open request: 404 `approval_not_found`.

## Cancelling

`DELETE /items/:id/approval` by an Editor of the whole item: the open request becomes `cancelled`, with its
`approval_cancelled` event. 204; 404 `approval_not_found` when none is open.

## Reading

- `GET /items/:id/approval` → `{approval}`: the item's approval as the wire `Approval` below, or null. Anyone who
  reaches the item at any level (its tab or the whole of it) reads it, so every collaborator sees the badge.
- `GET /items/:id/approval/people` → `{people: [{id, name, via}]}`: who an Editor of the whole item may name beside the
  team's members: the owner (`via: 'owner'`) of a personal item, and each account in its Shared with me through a live
  link that opens every tab (`via: 'link'`), at most 100, newest visitor first. A team's members come from the app's own
  team read, which every editor already makes for mentions and assignments.

```ts
type Approval = {
  id: string;
  itemId: string;
  state: 'open' | 'approved' | 'cancelled';
  status: 'awaiting' | 'changes_requested' | 'approved' | 'changed' | null;
  requestedBy: { id: string; name: string | null };
  note: string | null;
  due: string | null; // YYYY-MM-DD
  snapshotId: string | null;
  createdAt: number;
  closedAt: number | null;
  approved: number; // how many have approved
  approvers: {
    id: string;
    name: string | null;
    decision: 'pending' | 'approved' | 'changes_requested';
    note: string | null;
    decidedAt: number | null;
  }[];
};
```

People are named by accounts as they are named now (`POST /api/account/index/people`), the same read as the team audit
log's; when accounts can't say, names are null and the editor says "Someone" (and "You" for the reader).

## The email

The index sends no email ([one-explorer-contracts.md "Notices"](one-explorer-contracts.md#notices)). After the request is
written it tells the item's app `POST <app>/api/internal/items/:id/notices`
`{type: 'approval_requested', approvalId, requesterId, requesterName, approverIds, itemTitle, note, due}`, and the app
emails each approver whose **Actions Assigned to Me** emails are on (an approval asks something of them, as an
assigned action does): "<Requester> asked you to approve <item>", the note quoted, the due day, and a button that
opens the item, where the banner waits. An app without the door answers the notice and sends nothing. Best-effort, as
every notice: a failure is logged and dropped.

## History and the team audit log

Four events, written in the batch that makes the change, with the actor named as accounts names them then:

| Event                        | When                                             | Detail                                               |
| ---------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `approval_requested`         | A request is made                                | `approvers` (how many), `due`, `snapshot` (when one) |
| `approval_approved`          | An approver approves                             | `note`; `complete` on the approval that closes it    |
| `approval_changes_requested` | An approver asks for changes                     | `note`                                               |
| `approval_cancelled`         | A request is cancelled, or replaced by a new one | `replaced` when a new request took its place         |

- **History.** They show in the item's History ([one-explorer-contracts.md "The event log"](one-explorer-contracts.md#the-event-log))
  under their own filter, **Approvals**: "Approval Requested", "Approved" ("Approved by everyone" on the closing one),
  "Changes Requested", "Approval Cancelled" ("Approval Asked Again" when a new request replaced it), the note quoted
  beneath.
- **Team audit log.** On a team's item each is copied into the team's audit log, kept a year
  ([team-audit-log.md](team-audit-log.md)): who asked whom, who approved and who asked for changes is a sign-off
  record a team looks back on. The Event filter lists them under the items' group.
- They are no webhook's events (yet).

## In the editor

Three surfaces, the same in every app that offers approvals, from `@liveworkspace/explorer`'s approvals kit: the app's
host builds a door from its gate and hands it to the provider; nothing is read for anyone without a door.

- **The badge**, in the header's pills after the visibility pill: Awaiting n of m (amber, a clock), Changes Requested (rose,
  a flag), Approved (green, a checked page), Changed Since Approval (amber outline, a pencil). Its tooltip names the
  requester, the due day (and Overdue) and who has and hasn't answered. For an Editor of the whole item it opens the
  Share dialog on its Approval tab. Like every header pill it shows from `sm` up.
- **The banner**, under the header, for a named approver of the open request: "<Requester> asked you to approve this
  <noun>", the note, the due day, and **Request Changes** and **Approve**. Request Changes opens a note field in place
  ("What needs to change?") with **Cancel** and **Send**; Send is off until there is a note. Once they have decided
  the banner says so ("You approved this. Waiting on 2 more.", "You asked for changes.") with **Change Decision**, and
  can be closed for the session. When their answer is the one that closes the request it says "Everyone has
  approved." without Change Decision. On a phone it wraps under its words, its buttons 44 px tall.
- **The Share dialog's Approval tab**, beside Passes (and Community where the app has one), for an Editor of the whole
  item:
  - With no request (or a cancelled one): **Approvers**, a checklist of whom they may name (the team's members, then
    the owner and link visitors), each with their avatar and how they reach it (Team, Owner, Link), with a filter field
    once there are more than eight; **Note** (optional); **Due** (optional, a date); **Save this version as a
    snapshot** where the editor offers Snapshots; and **Request Approval**, off until someone is ticked. Empty: "Nobody
    else can open this <noun> yet. Share it, or move it to a team, to ask someone to approve it."
  - With a request: its status pill, who asked and when, the note and due day, the snapshot it points at, and each
    approver with their decision (Approved, Changes Requested, Waiting) and note. **Cancel Request** (open only)
    confirms in place; **New Request** opens the form again, saying it replaces the open one.
  - Loading, three placeholder rows; a failed read, "Couldn't load the approval" with **Try Again**; a refusal is said
    in the dialog.

The approval is read once when the editor opens, again when the browser tab comes back into view (at most every 30
seconds), and after each of the reader's own changes. Nothing is pushed live: another person's decision shows on the
next read.

## Not in scope

- Approval chains or stages, required approver counts below everyone, or approvers outside who can open the item.
- Locking the item while approval is pending or after it.
- Webhook events, an MCP tool or a CLI verb for approvals.
- liveplanner and livehuddle's doors.
