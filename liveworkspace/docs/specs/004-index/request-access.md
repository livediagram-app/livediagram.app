# Request Access

Status: building in parts (Work Tracker 1137). What each part brings is in the blueprint's
[Build order](blueprints/request-access.md#build-order); until a part lands, what it describes is not reachable.

## What

A live embed ([live-embeds.md](live-embeds.md)) or a link to an item a person can't open leads them to a dead end:
the embed's no-access card, or the app's Not Found screen. **Request Access** lets a signed-in person ask the people
who run the item to share it with them. The item's owner (or its team) is told in the Inbox and by email, and shares
it from there in one click, or declines.

It is the index's: one record for every app (platform first, [platform.md](../001-platform-scope/platform.md)), beside
the item's share links. An app keeps thin doors: its Request Access button, its email, and the Inbox row the shared
Explorer draws.

## Names

- An **access request** is one account asking for one item. Each person has at most one per item, which is asked
  again rather than repeated.
- The **requester** is the account asking. The item's **managers** are those who manage its sharing
  ([Sharing and access](one-explorer-contracts.md#sharing-and-access)): the owner of a personal item, every joined
  member of a team item's team.
- A request is `open` until a manager **grants** it (`granted`) or **declines** it (`declined`).

## Nothing about the item is revealed

The requester knows only the id they came with (an embed's target, an address). Asking must tell them nothing more,
not even whether that id is an item:

- **One answer for every id.** `POST /items/:id/access-requests` answers `202 {requested: true}` for any id of the
  right form, whatever stands behind it: no such item, an item in the Trash or Archived, an item they already reach,
  their own item, a request already open, one asked too recently, or an item over its day's emails. The only other
  answers are about the requester alone: `401` signed out, `403 access_requests_need_a_person` for an app acting for
  them, `429 rate_limited` past their own day's limit (counted across every id they asked about, real or not), and
  `400 invalid_body` for a malformed note.
- **The same time for every id.** The answer is sent before the item is looked up: the index counts the requester's
  try, answers, and only then (off the response's path) reads the item and records the request, so a real item takes
  no longer to answer than a made-up one.
- **No read.** There is no route a requester can read their own requests back through. Their button remembers in the
  browser tab that it asked, and says **Requested** until the page is left.
- **Granted is the first they hear.** Only when a manager grants it is the requester told anything: the email names
  the item, which they can now open. A decline sends nothing.

## Asking

`POST /items/:id/access-requests` `{note?}` by an account in person (not an app acting for them, the Drive mirror or
the export; guests are refused everywhere). `note` is the requester's word to the managers ("I'm on the launch
team"), trimmed, at most `ACCESS_REQUEST_NOTE_MAX` (300) characters; empty is none.

The request is recorded only when every one of these holds, and nothing is said either way:

- the item exists, and is in neither the Trash nor Archived;
- the requester does not already reach it, at any level, through their own access or a live link in their Shared
  with me;
- they have no open request on it, and their last ask about it was at least `ACCESS_REQUEST_REPEAT_MS` (7 days) ago.

Recording opens their request (a new one, or their old one reopened with the new note and time). The managers are
then told:

- **In the Inbox**, at once (below).
- **By email**, unless the item has already sent `ACCESS_REQUEST_EMAILS_PER_ITEM_DAY` (10) request emails in the last
  24 hours. The index tells the item's app (`access_requested`, [The emails](#the-emails)), which emails the people
  named: the owner of a personal item; for a team item, the person who made it while they are still in its team
  (as accounts says now), and nobody when they are not (the team still sees it in the Inbox).

### Limits

| Limit                                | Value     | Bounds                                                                     |
| ------------------------------------ | --------- | -------------------------------------------------------------------------- |
| `ACCESS_REQUESTS_PER_PERSON_DAY`     | 20 a day  | one person's asks across every id, real or not: probing and spamming alike |
| `ACCESS_REQUEST_REPEAT_MS`           | 7 days    | one person asking about one item again (open, granted or declined)         |
| `ACCESS_REQUEST_EMAILS_PER_ITEM_DAY` | 10 a day  | the emails one item's managers get, however many people ask                |
| `ACCESS_REQUEST_NOTE_MAX`            | 300 chars | the requester's note                                                       |

Past the person's limit the ask is refused `429 rate_limited` with `Retry-After`; past the item's, the request is
still recorded and shows in the Inbox, with no email.

## Granting and declining

Only a manager of the item may, through their own access (a share link never manages).

- **Grant**: `POST /items/:id/access-requests/:requestId/grant` `{level?}`. The index makes a share link for the
  requester at `level` (`view` when the item's app offers it, else the app's default link level; one the app does not
  offer is `400 level_not_offered`), every tab, never expiring, and writes the requester's Shared with me row through
  it, so the item is in their Shared with me and opens for them at once, without the link's code. The link is an
  ordinary share link: it shows in the Share dialog's Passes, and deleting it takes the access away again. It records
  the `shared` event as any new link does. The request becomes `granted`, keeping the link's code, and the index
  tells the item's app (`access_granted`), which emails the requester. Answers `200 {link}`.
- **Decline**: `POST /items/:id/access-requests/:requestId/decline`. The request becomes `declined`; the requester is
  told nothing, and can ask again after `ACCESS_REQUEST_REPEAT_MS`. Answers `204`.

Either answers `404 access_request_not_found` when the item has no open request with that id (granted, declined or
never), and the item's own refusals as any manager's route does: `404` for an item the caller doesn't manage, `409
archived` for an Archived item, `404` for one in the Trash. Granting past the item's share link cap is `409
share_link_limit`, the request left open.

An item behind a share password still asks the requester for it, as every link does: the manager tells them the
password, or removes it.

## In the Inbox

The Inbox ([one-explorer-contracts.md "Inbox"](one-explorer-contracts.md#inbox)) lists each open request on an item
the reader manages, newest first: `accessRequests` beside its threads, actions and forms. A row says who asks (their
name as accounts named them when they asked, else **Someone**), their note, when, and the item. It asks something of
the reader, so it counts in the Inbox's badge.

- A request whose requester has since come to reach the item through a live link (granted elsewhere, or sent a
  link) is not listed.
- An item in the Trash or Archived lists none of its requests; they come back with it.
- Each row's verbs, for a manager: **Share** (one click, at the default level above; a menu beside it picks another
  offered level) and **Decline**. Open in the app goes to the item, as every row's does.

A grant is also in the requester's Inbox read, as `shares` (a grant of the last 7 days, while they reach the item):
not a row of the list, but what an open editor's notice says, "<Granter> shared <item> with you"
([inbox-notices.md](inbox-notices.md#shares-in-the-inbox-read)). The grant's `shared` event keeps the granter's name
as accounts gave it, read before the grant is written, so the notice can say who.

## The emails

The index sends no email ([one-explorer-contracts.md "Notices"](one-explorer-contracts.md#notices)). After the change
is written it tells the item's app `POST <app>/api/internal/items/:id/notices`:

- `{type: 'access_requested', requestId, requesterId, requesterName, recipientIds, itemTitle, note}`: the app emails
  each recipient whose **Someone Joined** emails (`notifyJoin`) are on: "<Requester> asked for access to <item>", the
  note quoted, and a button that opens the app's Inbox on the request.
- `{type: 'access_granted', requestId, requesterId, granterId, granterName, level, itemTitle}`: the app emails the
  requester (they asked for it, so no switch holds it back): "<Granter> shared <item> with you", and a button that
  opens it.

An app without the door takes the notice and sends nothing. Best-effort, as every notice: a failure is logged and
dropped.

## Closing an account

A closed account's own requests go, and so do its counted tries: a request from no one asks nothing.

## Not in scope

- Requests from a guest or someone signed out (signing in comes first), or from an app acting for a person.
- A request for one tab, or for a level: the requester asks for the item; the manager picks the level.
- Telling the requester of a decline, or letting them read their requests back.
- Events in History or the team audit log for asking and declining (a grant's link records `shared`).
