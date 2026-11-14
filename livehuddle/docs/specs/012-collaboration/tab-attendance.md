# Tab attendance

Who was in a tab and when. Presence is live only, so once someone leaves there is no record of them; a tab's
**Attendance** keeps one: each person who came in, when they joined, when they left and how long they stayed, newest
first. It answers "who came to the stand-up in the Team Pod?" after the meeting has ended.

> "Who may see a tab's join and leave history, and should it wait for #683?" Answered "B": Editors and Participants
> see it, built now with its own store (the owner, 2026-11-11, Work Tracker #691).

This overturns the old line that a Space never remembers who was in (Roll call, [roll-call.md](roll-call.md), left
with Work Tracker #423; the photo wall's "a wall that remembers who was in" stays out of scope,
[team-pieces.md](../009-elements/team-pieces.md#not-in-scope)): attendance is a record kept by the room, not a piece
on the canvas.

## What is recorded

One **visit** per person per stretch of time in a tab:

- **Who**: the name the room gives them ([Presence names](../014-identity/auth-and-guest-access.md#presence-names): their
  profile's, a link visitor's typed one, or their key's guest name; never the one their hello claims, and a rename
  shows on their open visits) and their colour (their hello's, or a later
  `presence-colour`, which shows on their open visits), their Google picture when a verified account holds the session
  ([Profile pictures](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)), and whether they were a guest
  (no account). Never an account id, a guest id or an email: the visit is keyed by the session's **collab key**
  ([Share roles, "The collab key"](../013-workspace/share-roles.md)), the one-way public id the roster already
  carries.
- **Joined at**: when the person's first connection showed that tab (its `hello` or `tab-focus` naming it, or naming
  it as the other pane of a side by side split, [Split view](../007-editor/split-view.md#presence)).
- **Left at**: when their last connection on that tab moved to another tab or closed. Empty while they are still
  there ("Here Now").
- **Time spent** is not stored: it is left at (or now) minus joined at.

What is not recorded: agents ([Agent presence](../024-agents/agent-presence.md)), which hold no socket; a session that
never said hello; a tab the document does not have; a tab outside a tab-scoped link's scope.

### One person, one visit

- **Several devices or browser tabs** of the same person are one visit: joining is the first of their connections to
  show the tab, leaving is the last one going. People are told apart by collab key, which is the same for a person on
  every device (it is derived from who they are). A link visitor with no identity has a key per browser (derived from
  a secret their browser keeps, [Share roles, "The collab key"](../013-workspace/share-roles.md)), so a reconnect or
  a second browser tab of theirs carries on the same visit rather than adding one.
- **A reconnect is not a leave**: someone back in a tab within 2 minutes of leaving it (`ATTENDANCE_REJOIN_GRACE_MS`),
  a network blip, a reload, a quick hop to another tab and back, carries on the same visit rather than starting a new
  one. Their time away is counted in the visit.
- **A room restart**: the room keeps the time it last saw each open visit. When the room starts again with nobody
  connected (a deploy closes every socket without telling the room), every visit still open is closed at that time.
  Someone who reconnects within the grace carries on their visit as after any reconnect.

## How long it is kept

- **90 days** (`ATTENDANCE_RETENTION_MS`) after a visit ends, then it is deleted: on the document's daily upkeep, and
  on each new visit to the tab. A read never shows an older one.
- **500 visits per tab** (`ATTENDANCE_TAB_MAX`): a new visit past that deletes the oldest. A busy tab keeps its
  latest 500.
- A deleted tab deletes its visits; a deleted (purged) document deletes them all.
- Never in a tab read, an export, a copy, a version, the Drive mirror or the index: attendance is stored beside the
  content in the document's own SQLite, like a Suggestion Box's notes.

## Who sees it

| Act                      | Editor                                         | Participant | Viewer |
| ------------------------ | ---------------------------------------------- | ----------- | ------ |
| Is recorded when present | Yes                                            | Yes         | Yes    |
| Open a tab's Attendance  | Yes                                            | Yes         | No     |
| See a person's picture   | When the reader is signed in, as on the roster | Same        | No     |

- A tab-scoped link sees its own tab's Attendance only (any other tab reads as missing, 404).
- A Community visitor (content-only pass) sees none.
- An API token reads it as the owner it belongs to; nothing in the MCP server or CLI reads it.
- A Viewer is still recorded: being present in a shared Space is visible to everyone in it already, and the record is
  shown only to people who could see them there live.

## Closing an account

When a person closes their account, the index tells each document that names them
([Closing an account](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)), and the document
anonymises their visits as the team audit log does: the visit stays (so a meeting's head count stays true), its key
becomes `anonymised`, its name "Deleted account" and its picture goes. Running it again changes nothing.

> "Are a guest's visits from before they signed in linked to the account on sign-in, or purged with it?" Decided:
> **purged with it** (Work Tracker 730). Linking would rewrite every document the guest visited at the moment they sign
> in, which the sign-in cannot reach (it names no documents), and would put an account's name on visits made before
> it existed. So a guest's visits keep the guest's key and name while the account is open, and go with the account.

- **Visits made as a guest** before signing in are anonymised with the account's own. Signing in records, beside the
  account, the collab keys of the guests it took over (each one-way, never a guest id), and closing the account
  anonymises every visit under the account's key or any of those, on every document the index names. Those keys stay
  only as long as the close needs them: 8 days after the account closes (a little past the index's week of retries),
  then they go too.
- Nothing about a guest's visit changes while the account is open: nobody who could not see it before sees it now.

## Where it shows

- **Attendance** in the tab menu (the tab's ⋯ and its right-click), for an Editor and a Participant on a document
  that has a room (not one saved only in This Browser). A Participant's tab menu, otherwise closed to them, opens with
  this one row. Opening it shows a dialog for that tab:
  - Title "Attendance", subtitle the tab's name and "Last 90 days".
  - Visits grouped by the day they started ("Today", "Yesterday", then the date), newest first.
  - Each row: the person's avatar (picture or initials on their colour), their name, a "You" badge on your own
    visits, "Guest" for a guest, "Here Now" while the visit is open; under it "Joined 14:02 · Left 14:47"; on the
    right the time spent ("45 min", "1 hr 5 min", "Under a minute").
  - Empty: "Nobody has been in this tab yet." with a line saying visits show here for 90 days.
  - Loading: placeholder rows. Failure: "Couldn't load attendance." with Try Again.
- The help article [Attendance](../../../apps/help/app/collaboration/live-presence/tab-attendance/page.mdx).

## The wire

- `GET /api/documents/:id/tabs/:tabId/attendance` answers `{ visits, retentionDays, perTabMax }`, each visit
  `{ id, name, color, picture?, guest, self, joinedAt, leftAt }` (`leftAt` null while open). Gated by
  `gateParticipate` (Editor or Participant); a Viewer is refused 403.
- The room records visits from the frames it already handles (hello, tab-focus, a socket closing): no new op and
  nothing new on the roster.

## Telemetry

`UI · Opened · Attendance` when the dialog opens. Nothing about who was in.
