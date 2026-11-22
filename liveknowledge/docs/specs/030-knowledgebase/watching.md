# Watching a Page

Owner, 2026-11-21, picked from the lead's suggestions (Work Tracker 1340): readers can't follow a page. Only a page's
owner hears of it, by the Review Due email ([Verification](verification.md#reminders)), so someone who relies on the
On-Call or Expenses page never hears that it changed.

Status: **built, not yet verified on a deployed Worker** ([blueprint](blueprints/watching.md)). Details marked
"(decided)" were decided by the builder and stand until the owner overturns them.

## What watching is

- **Watch** follows one page. **Watch This Section** follows a page and every page under it, now and later: a
  subpage added under it is watched too. A section is any page with subpages; a page with none offers Watch alone.
- A watch is one person's, private to them: nobody sees who watches, only how many (below). One watch a person a
  page: watching a section replaces a watch of that page alone, and Unwatch ends either.
- **Covered by a section.** A page under a section you watch reads as watched, "Watching Through <Section>", and its
  own Watch is not offered (decided): Unwatch the section from its page. Watching a page and then its parent's
  section keeps both rows; the section's covers it either way.
- Stored in the knowledgebase's Durable Object, its own table `page_watchers` (one row a person a page, schema step
  after the reactions'), never in the page's body and never in D1. Watching is no edit: no revision, no Updated
  stamp, no History entry and no Most Used day. A page deleted for good takes its watches with it; a closed account's
  are removed.

## What a watcher hears of

A watcher hears of a page's **changes**, each by who made it:

| Change               | When                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Edited**           | a save that changed the saved page ([Editing](editing.md): Save, an agent's write, an accepted suggestion, a restored version); never a draft's keystrokes or autosaves |
| **Verification Lapsed** | the page's review came due ([Verification](verification.md#states)), once a verification        |
| **Approved**, **Rejected** | a decision on the page's approval request ([Approval](approval.md))                            |
| **Moved**            | the page has a new parent in the tree (reordering among its siblings is not a move)                    |
| **Deleted**          | the page went to the knowledgebase's [page Trash](knowledgebases-and-pages.md#the-page-trash)          |

- **Never for reactions** ([Reactions on a Page](page-reactions.md#no-notifications)), comments (the Inbox already
  has threads), Verify, a request for approval, a rename alone in the tree (a rename is a save of the page's name,
  so it is Edited), or watching itself.
- **Your own changes never notify you.** A row made only of your changes is not yours; one where someone else
  changed the page too is, and names them.
- **Only while you can read it.** A watcher who loses access to the knowledgebase (left the team, a share revoked,
  a link expired) stops hearing at once in the Inbox, which lists only what they reach, and their watch is removed
  at the next daily check, so it stops counting and they get no email.

## In the Inbox: one row a page an hour

- The changes to a page are folded into one **update**: the first change opens it and every change to that page in
  the hour after it joins it. So a page makes at most one Inbox row an hour (decided), however many saves it gets.
  The row names who (the newest person, "and 2 others"), what (the page), and why (the change's word, the first and
  "+N" for several), with the eye icon; its pane lists each kind in a line. Rows are kept 14 days.
- The rows reach the Inbox through the platform's contract ([one-explorer-contracts.md "What an item
  pushes"](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#what-an-item-pushes),
  `PUT /app/items/:id/updates`, and "Inbox" `updates`), pushed by the knowledgebase's room on its own alarm, never
  in the request that made the change: a minute after the first change, then at most once a minute.
- An update asks nothing of you: it is listed, never counted in the badge, and under its own **Updates** filter. It
  notifies once, as an [Inbox notice](../013-workspace/inbox-notices.md) while you work ("Priya changed a page you
  watch").
- A guest has no Inbox notices and no address: watching needs an account (below).

## The daily digest email

- **Daily Digest of Watched Pages** (Settings, Account, Notifications, Email; `notifyWatchDigest`): **off by default**
  (the one email switch that is), so watching is quiet until someone asks for email.
- When it is on, a watcher gets at most one email a day a knowledgebase, **Changes to Pages You Watch**: every page
  with an update for them since the last digest (the first 100 by most recent, the rest counted), each a link with
  what happened and who ("Edited by Priya Shah and Sam Lee", "Verification lapsed"), then the knowledgebase's link.
  Nothing is sent on a day with nothing to tell.
- It goes through the platform's notifier to the account's verified address, with the settings link and the
  `List-Unsubscribe` header every opt-out email carries; turning the switch off stops the next one. Only someone who
  can still open the knowledgebase is emailed (the daily check). At most 200 a knowledgebase a day (decided); a
  watcher the ceiling leaves out gets theirs the next day. A deployment that sends no email sends none, and the
  switch is not shown.

## Where it shows

- **The page's menu** in the tree: **Watch** (the eye) and, on a page with subpages, **Watch This Section**; when
  watched, **Unwatch** or **Unwatch This Section**; under a watched section, a greyed **Watching Through <Section>**
  whose hover card says to unwatch the section from its page. Offered to every role that reads the page, a Viewer's
  menu included (decided: the row menu's toolbar keeps Copy Link alone for a Viewer).
- **The Page Info rail**: a **Watch** row at the top of Page Health, the eye and **Watch** (or **Watching**), a menu
  with Watch This Page, Watch This Section (for a section) and Unwatch, and beside it how many watch the page
  ("3 watching"; nothing at 0), a hover card saying "3 people get updates about this page". The count is everyone
  whose watch covers the page, the page's and its sections' together, once each.
- A press shows at once and is put back with a toast in words if the api refuses it. The toast on success:
  "Watching <page>" ("You'll hear when it changes"), or "Stopped watching <page>".
- Hidden in an embed, a published site and a knowledgebase kept Offline.

## Share roles

| Action                                 | Editor | Participant | Viewer | Signed-in link visitor | Guest (no account) | Agent |
| -------------------------------------- | ------ | ----------- | ------ | ---------------------- | ------------------ | ----- |
| See how many watch a page              | yes    | yes         | yes    | yes                    | yes                | no    |
| Watch or unwatch a page                | yes    | yes         | yes    | yes                    | no                 | no    |
| Watch or unwatch a section             | yes    | yes         | yes    | not through a link to one page | no         | no    |

Watching is every signed-in reader's, Viewers included: like a reaction, it reaches one table and nothing in the
page. A guest with no account and an agent's token are refused (`watch_needs_account`, 403): there is nobody to
tell. A link confined to one page reaches that page's watch alone (`section_out_of_reach`, 403, for its section).
Every gate is enforced in the api with a test per role.

## Bounds (decided)

At most 2,000 watches a knowledgebase (`watchers_full`, 409); at most 30 watch changes a minute a person
(`watching_too_fast`, 429); an update carries at most 200 people to the Inbox (a page watched by more reaches the
200 who watched first); at most 50 updates are pushed, newest first; updates older than 14 days are dropped.

## Telemetry

`UI·Toggled`, typed `WatchPageOn`, `WatchPageOff`, `WatchSectionOn`, `WatchSectionOff`, when the person presses;
`UI·Toggled·NotifyWatchDigestOn` / `Off` for the setting.

## Offline

A knowledgebase kept Offline has no room and nobody else changes it: Watch is not offered.
