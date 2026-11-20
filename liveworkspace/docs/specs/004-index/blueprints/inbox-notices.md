# Inbox notices: blueprint

Derived from [inbox-notices.md](../inbox-notices.md). The spec decides; this file only adds engineering precision,
read from the code. Paths are relative to the repository root.

Scope, by file:

| File                                                          | Role                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/explorer/src/inbox-notices/watch.ts`                | `createInboxWatch`, `inboxWatchFor`: the one read per browser and address, shared over a channel         |
| `packages/explorer/src/inbox-notices/rows.ts`                 | `noticeRows`, `freshRows`, `noticeHeadline`: which rows notify and what each says                        |
| `packages/explorer/src/inbox-notices/seen.ts`                 | `createSeenStore`, `seenStoreFor`: rows shown, dismissed or read here, per person, across tabs           |
| `packages/explorer/src/inbox-notices/center.ts`               | `createNoticeCenter`: the notice on screen, grouping, its timer, dismissal                               |
| `packages/explorer/src/inbox-notices/dialog-open.ts`          | `dialogOpenNow`, `subscribeDialogs`: whether a dialog is open over the page                              |
| `packages/explorer/src/inbox-notices/InboxNotice.tsx`         | The card                                                                                                 |
| `packages/explorer/src/inbox-notices/useInboxNotices.tsx`     | `useInboxNotices`: the watch, the seen rows and the center for one reader; the count; the layer          |
| `packages/explorer/src/inbox-notices/InboxCountBadge.tsx`     | The Explorer button's count                                                                              |
| `packages/explorer/src/inbox-notices/index.ts`                | `@liveworkspace/explorer/inbox-notices`: small on purpose, so an editor's first load carries no Explorer |
| `packages/explorer/src/data/useInbox.ts`                      | Takes the watch's answers (All: as the list; this app: a re-read when they differ)                       |
| `packages/explorer/src/explorer/InboxPane.tsx`                | `?at=<row key>` opens the pane on that row; a list on screen marks its rows seen                         |
| `packages/workbench/src/components/chrome/useEditorInbox.tsx` | The editor's door: a signed-in account, the index client, the app's `track`                              |
| `<product>/…/components/chrome/ToolbarExplorerButton.tsx`     | The count on the Explorer button and the notice layer, in each editor with an Inbox                      |
| `liveworkspace/apps/index/src/inbox.ts`                       | The `shares` statement                                                                                   |
| `liveworkspace/apps/index/src/access-requests.ts`             | The grant's `shared` event with the granter's name                                                       |

## Behaviour and state

### The watch (`watch.ts`)

One per index client on a page (`inboxWatchFor(client)`, a `WeakMap`), started by its first subscriber and stopped
with its last. State: `data` (the last answer, or null), `at` (its time).

- **Reading.** `client.inbox({})` with no app and the default limit. Before it, the time is written to
  `localStorage['liveworkspace:inbox-watch:read-at']`; a read is skipped when that time is under
  `INBOX_WATCH_POLL_MS` (30 s) old, the next turn set for when it will be. An answer is kept, given to the
  subscribers, and posted on `BroadcastChannel('liveworkspace:inbox-watch')` as `{ type: 'answer', at, data }`.
  A failure keeps the data; an abort (stopped) is silent.
- **Turns.** One `setTimeout` at a time, only while the tab is visible and was used (`pointerdown`, `keydown`,
  passive, on `window`) in the last `INBOX_WATCH_IDLE_MS` (10 min). Hidden, or idle at the turn: no timer.
  `visibilitychange` to visible, `focus`, or the first press after idling read at once when the last read (any
  tab's) is over `INBOX_WATCH_RETURN_MS` (15 s) old and an eager listener is subscribed, else set the turn for 30 s
  after it. A page of passive listeners only (the Explorer, which reads for itself on coming back) waits at least
  `INBOX_WATCH_RETURN_MS` before its turn.
- **Hearing another tab.** An `answer` with a newer `at` replaces `data` and is given to the subscribers; the turn
  moves to 30 s after it.
- `subscribe(listener, { readNow })`: the first listener starts the watch, the last one gone stops it (timer,
  listeners, channel, any read still out). The editor's notices subscribe eager (`readNow`, they need the reader's
  Inbox as it is); `useInbox` subscribes passive, having just read the Inbox itself, and its own reads call
  `touch()`, which counts as this page's last read so the watch's next turn waits 30 s from it.

`inboxSignature(data, app)`: each row's key and time (threads `latestAt`, actions `updatedAt`, access requests
`askedAt`, shares `sharedAt`, forms `latestAt` and `unseen`), sorted, joined; with `app`, that app's rows only. Two
answers with one signature list the same Inbox.

### Which rows notify (`rows.ts`)

`noticeRows(data, viewerId, here, viewerName)`: every row that would notify, each `{ key, at, kind, who, what, quote, place, href }`:

- Threads, unresolved, whose `latestAuthorId` is set and is not the reader: `mention` when `mentionsYou` (who is
  `mentionedBy.name`, else the latest author), else `comment` when `onYourItem` (**commented**) or `youCommented`
  (**replied**). A card thread read through two items is one row (`c:<app>:<elementId>`), the newer. The quote is
  the latest comment's first line through `nameMentions`: each whole-token `@handle` (the rule of model-core's
  `mentionSegments`) that is `mentionHandle` of the reader's name (`viewerName`, the deferred auth's profile
  name), `mentionedBy.name` or `latestAuthorName`, with or without a `-N` suffix, becomes `@<name>`; any other
  stays as written. The thread carries no list of its mentions, so these three are the names it knows.
- Actions, open, `assigneeId` the reader, `assignerId` not the reader: `assigned` (**assigned you a card** with
  the card's key and title, or **assigned you an action** with its name).
- `accessRequests`: `access` (**asked for access**). `shares`: `share` (**shared it with you**, the item named on the place line).

Keys are the Inbox list's (`threadKey`, `actionKey`), `r:<id>` for a request, `s:<id>` for a share. A row's `href`:
a thread or action, `<app's address>/explorer/inbox?at=<key>` (this app's own path when it is this app); a request or
a share, the item in its app (`APP_ITEMS[app].itemPath`).

`freshRows(rows, seen, now)`: those whose `at` is after `seen.since`, within `NOTICE_MAX_AGE_MS` (24 h), and whose
key is not seen at that `at` or later.

### Seen rows (`seen.ts`)

`localStorage['liveworkspace:inbox-notices:<viewerId>']`: `{ since, seen: { [key]: at } }`. `since` is written the
first time the store is read for that person here (now), so what is in the Inbox then never notifies. `mark(rows)`
sets each key's `at` (never lowering it); `prune(keys)` keeps only keys the Inbox still lists; at most
`SEEN_MAX` (500) keys, the oldest let go. Every other tab hears a write through the `storage` event; a write that
cannot be made (private mode, full) keeps the marks in memory for the page.

### The notice (`center.ts`)

One per page. `offer(rows)`: rows not on screen join the notice (newest first) and its timer restarts
(`NOTICE_SHOW_MS`, 15 s, held while any `hold(true, reason)` stands: `pointer` for the pointer or focus on it,
`dialog` while a dialog is open); each joins `seen` at once, so no other tab shows it. `dismiss()`
clears it; `forget(keys)` drops rows another tab or the Inbox marked seen, closing the notice when none is left. A
notice is offered only by a visible tab; a hidden tab offers what is still fresh when it becomes visible.

### In the editor (`useEditorInbox.tsx`, `useInboxNotices.tsx`)

`useEditorInbox(app)`: on when `appHasInbox(app)` and the deferred auth has a signed-in `userId`; the client is the
workbench's `indexClient`. It answers `{ count, label, notices }`: `count` is `inboxCount(data, viewerId, app)` (this app's rows only)
over the watch's answer less the reader's done rows (`withoutSettled`, `settledStoreFor`, `data/inbox-settled.ts`),
`label`
names the button ("Explorer, 3 in Inbox"), `notices` is the layer (a `Portal`) to draw beside the button.

The card is placed from `[data-corner-actions]`'s bottom (8 px below it, read when it shows and on resize), else
12 px from the top. On a phone (the editors' `phone:` variant: under 640 px wide, or a touch screen under 500 px
tall) it spans `left: 16px; right: 16px`. `z-index: var(--z-modal)`, but it is never drawn over a dialog: while
`[aria-modal="true"]` (the shared Dialog, workbench and canvas modals) or `dialog[open]` is in the page, the layer
draws nothing and holds the timer (`hold(true, 'dialog')`). A `MutationObserver` on `document.body` (child lists,
and the `aria-modal` and `open` attributes) watches for that only while a notice is waiting or showing, so the
canvas's own DOM changes cost nothing otherwise. Lowering the card to `--z-overlay` instead would still draw it over
a dialog's backdrop. Motion: `motion-safe` slide and fade (`translate-y-2`, 160 ms); `.reduce-motion` and
`prefers-reduced-motion` keep the fade only.

### The Inbox page (`InboxPane.tsx`, `useInbox.ts`)

`?at=<key>`, read once when the list first has rows: the row with that key is chosen (in the panel and on a phone the
pane opens on it), the address left as it was. Each time the list has rows while it is on screen, its keys at their
times join the seen rows and any notice holding them closes.

## Data

`shares` (`liveworkspace/apps/index/src/inbox.ts`), a fifth statement in the Inbox's batch:

```sql
SELECT r.id, i.app, r.item_id, i.title AS item_title, i.team_id AS item_team_id, r.closed_at AS shared_at,
  e.actor_id AS shared_by_id, e.actor_name AS shared_by_name
FROM access_requests r JOIN items i ON i.id = r.item_id
LEFT JOIN events e ON e.item_id = r.item_id AND e.type = 'shared' AND e.occurred_at = r.closed_at
WHERE r.requester_id = ? AND r.state = 'granted' AND r.closed_at >= ? AND i.trashed_at IS NULL [AND i.app = ?]
  AND EXISTS (SELECT 1 FROM shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
    WHERE sw.person_id = r.requester_id AND sw.item_id = r.item_id AND <live link>)
GROUP BY r.id ORDER BY r.closed_at DESC LIMIT ?
```

From `access_requests_person_item (requester_id, item_id)`: the reader's own requests, a handful. No migration: the
granter's name rides the `shared` event the grant already writes (`events.actor_name`), read from accounts before
the grant's batch instead of after it.

## Performance and limits

| What                | Bound                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Inbox reads         | one per 30 s per browser and address while someone is there (≤ 121 an hour), none hidden or idle   |
| Timers              | one turn timer per page; one notice timer                                                          |
| Listeners           | `visibilitychange`, `focus`, `pointerdown`, `keydown`, `storage`, one channel; all removed on stop |
| Seen rows           | ≤ 500 keys per person                                                                              |
| Grouped lines drawn | ≤ 3                                                                                                |

`watch.test.ts` pins the budget: three tabs, an hour, visible and in use, at most 121 reads; hidden or idle, none
past the first quiet ten minutes.

## Testing

| Test                                                               | Pins                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `packages/explorer/src/inbox-notices/watch.test.ts`                | one read across tabs, turns, hidden and idle pauses, coming back, the hour budget   |
| `packages/explorer/src/inbox-notices/rows.test.ts`                 | each kind, own moves never, the 24 h cut, the first watch, card threads once        |
| `packages/explorer/src/inbox-notices/seen-center.test.ts`          | marks, pruning, the cap, other tabs hearing; grouping, the timer, holding, forget   |
| `packages/explorer/src/inbox-notices/notices-ui.test.tsx`          | the card for one row and a group, links, Dismiss, Escape, reduced motion, the badge |
| `packages/explorer/src/data/useInbox-watch.test.tsx`               | the list taking the watch's answers                                                 |
| `packages/explorer/src/explorer/inbox-at.test.tsx`                 | `?at=` choosing the row; the list marking rows seen                                 |
| `packages/workbench/src/components/chrome/useEditorInbox.test.tsx` | off for a guest and livehuddle; on for an account                                   |
| `liveworkspace/apps/index/src/inbox-shares.test.ts`                | a grant in `shares`, with who; old, Trash and unreachable ones not                  |

## Constants and configuration

`INBOX_WATCH_POLL_MS` 30,000, `INBOX_WATCH_RETURN_MS` 15,000, `INBOX_WATCH_IDLE_MS` 600,000 (`watch.ts`);
`NOTICE_SHOW_MS` 15,000, `NOTICE_LINES_MAX` 3 (`center.ts`); `NOTICE_MAX_AGE_MS` 86,400,000 (`rows.ts`); `SEEN_MAX`
500 (`seen.ts`); `INBOX_SHARES_MS` 7 days (`@liveworkspace/index-client` `access-requests.ts`).
