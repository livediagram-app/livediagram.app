# Blueprint: Watching a Page

How [Watching a Page](../watching.md) is built. It follows [Reactions on a Page](page-reactions.md) for the watch
itself (a table of the room's own, a route under the page every signed-in reader may write, one store in the editor)
and the Review Due email ([knowledge-ui.md](knowledge-ui.md), `knowledge/knowledge-emails.ts`) for the work that
tells people: noted where a change happens, told on the room's alarm.

## Domain and naming

- **Watch** (`PageWatch`): one person's row on one page, `scope` `page` or `section`. **Watcher**: a person with a
  watch that **covers** a page: a `page` watch of it, or a `section` watch of it or of any page above it.
- **Change** (`WatchChangeKind`, the platform's `UpdateKind`): `saved`, `review_due`, `approved`, `rejected`,
  `moved`, `deleted`.
- **Update** (`watch_updates` row): the changes to one page folded within `WATCH_UPDATE_WINDOW_MS` of its first; the
  Inbox row (`UpdatePush`, `@liveworkspace/index-client`) and a digest line are made from it.
- **Digest**: the daily email, `watchDigestEmail`; its switch `notifyWatchDigest` (**Daily Digest of Watched
  Pages**).

## Interfaces and contracts

- `@liveknowledge/api-schema` `page-watch.ts`: `PageWatchScope = 'page' | 'section'`, `PageWatchResponse { watching:
PageWatchScope | null, through: { tab, name } | null, watchers: number, section: boolean }` (`section`: the page has
  subpages), `PageWatchChange { scope: PageWatchScope | null }`, the bounds.
- `GET /api/documents/<id>/pages/<tab>/watch`: the caller's watch of the page and its count. Every grant that reads
  the page; a guest or an agent reads `watching: null`.
- `PUT /api/documents/<id>/pages/<tab>/watch` `{ scope }`: sets the caller's own watch of this page (null removes
  it), answering the same body as GET. Refusals: `invalid_change` 400, `watch_needs_account` 403 (no account, a
  guest, a link visitor without one, a token), `section_out_of_reach` 403 (a section through a link confined to one
  page, or `section` on a page with no subpages: `not_a_section` 400), `watchers_full` 409, `watching_too_fast` 429.
- The room pushes `PUT /app/items/:id/updates` (`pushUpdates`) from its alarm; the Explorer reads `updates` from
  `GET /inbox` ([one-explorer-contracts.md](../../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)).

## Behaviour and state

- **The route** (`routes/knowledge-watch-routes.ts`) runs after the knowledge router's grant and page lookup, so its
  read is every role's. A change needs `pageCreatorOf(ctx)` and `readerOf(ctx).kind === 'person'` (as a reaction);
  the role is never read: a Viewer passes. Rate: `createReactionRate(WATCH_CHANGES_PER_MINUTE)`, its own map.
- **The store** (`knowledge/page-watch.ts`): `setPageWatch(env, tab, person, scope, now)` deletes the person's row
  for the tab, or upserts it (`INSERT ... ON CONFLICT (tab, person) DO UPDATE SET scope, at`), refusing a new row past
  `WATCHES_PER_KNOWLEDGEBASE_MAX`. `watchOf(env, tree, tab, person)` reads the person's rows for the page and its
  ancestors (`pageParents` over the stored tree) and answers the nearest: the page's own, else the nearest section
  above (`through`). `coveringWatchers(rows, tree, tab)`: every person whose row covers the page, the earliest `at`
  each.
- **Noting a change** (`knowledge/watch-notes.ts` `noteWatched(env, { tabs, kind, actor })`): one read asks whether
  the knowledgebase has any watch (`SELECT 1 FROM page_watchers LIMIT 1`); with none it returns, reading nothing
  more and never asking who the actor is (`actor` is a function). Else, per page, it folds into the page's open
  update (`first_at > now - WATCH_UPDATE_WINDOW_MS`, the newest) or opens one (`id` `<tab>:<now>`): `kinds` gains
  the kind in first-seen order, the actor goes to the front of `actors` (at most `UPDATE_ACTORS_MAX` kept by name)
  and into `actor_ids` (every id, at most `WATCH_ACTOR_IDS_MAX`), `count` + 1, `latest_at` now, `tab_name` the page's
  name now. Then `env.WATCH_OWED?.('inbox', now + WATCH_PUSH_DELAY_MS)`. Writes go through `knowledgeDb`: no edit is
  noted. A failure is logged (`[watch] note failed`) and never fails the write it follows.
- **Call sites**: `notePageWrite` (`saved`, the writer: the tab PUT when `savedPageChanged`, an agent's changeset,
  an agent's page write, an accepted suggestion), the version restore (`saved`, its author), the approval route
  (`approved`, `rejected`, the decider), the page tree saves (`moved`, the pages whose parent changed: the tab list
  PUT's `writeTabParents`, an agent's move, a whole-tab save whose `parent` moved), the tab delete that trashes a
  page (`deleted`), and the review check (`review_due`, below). Never the reaction route, the thread routes or Verify.
- **The review check**: `runKnowledgeEmail`'s `review-email` work also runs `noteReviewsLapsed(env, pages, now)`
  (knowledge-emails.ts), which notes `review_due` for each page newly due (a `watch-review` mark a page, holding the
  `verifiedAt` told of, as `rule-review` does) when the knowledgebase has a watch, and answers the next review's
  time so the work wakes for it with email off too.
- **The push** (`knowledge/watch-work.ts`, work `watch` / `inbox`): reads the updates of the last `INBOX_UPDATES_MS`,
  newest first, at most `UPDATES_PUSH_MAX`; the watches and the tree (a trashed page's place is its `page_trash`
  parent); for each update its `people`: the watchers covering its page whose watch began at or before its
  `latest_at`, less anyone whose ids are all of `actor_ids`, at most `UPDATE_PEOPLE_MAX` by earliest watch. Updates
  for nobody are left out. One `pushUpdates`; without an index it is done; a failed push is tried again after
  `WATCH_RETRY_MS`, doubling to an hour (`attempt` in the work's payload). The push also runs after a watch is set or
  removed (the people changed), on the same delay.
- **The daily check** (work `watch` / `daily`, owed when the first watch is made, again each day while any is
  left): (1) **reach**: the distinct watchers, at most `WATCH_REACH_CHECKS_PER_DAY` by the oldest `watch-reach`
  mark, through `ownersWhoReach`; a person who no longer reaches loses every watch here, and the push is owed;
  (2) **digest**: for each watcher with an update for them (the push's rule) whose `latest_at` is after their last
  `watch-digest` mark (or the last day, for a first digest), one `watchDigestEmail`, sent through
  `notifyWatchDigests` (the switch read opt-in: only an explicit `true` sends) within `WATCH_DIGESTS_PER_DAY`
  (`usage_counters` scope `watch-emails`); the sent get their mark. A watcher the ceiling held waits for the next day.
- **Unwatch, and a page gone**: removing a watch drops nothing but its row; its person leaves every update's `people`
  at the next push. A page deleted for good (`DELETE FROM tabs`) takes its watches and updates by trigger.

## Data and persistence

- `page_watchers (tab TEXT, person TEXT, scope TEXT CHECK (scope IN ('page','section')), at INTEGER, PRIMARY KEY
(tab, person))`, index `(person)`; trigger `page_watchers_tab_removed` AFTER DELETE ON tabs.
- `watch_updates (id TEXT PRIMARY KEY, tab TEXT, tab_name TEXT, kinds TEXT, actors TEXT, actor_ids TEXT, count
INTEGER, first_at INTEGER, latest_at INTEGER)`, indexes `(tab, first_at)` and `(latest_at)`; trigger
  `watch_updates_tab_removed`. `kinds`, `actors` (`[{id, name}]`) and `actor_ids` are JSON arrays.
- Schema step V40 (`pageWatchSchemaStep`), appended after V39, additive and IF NOT EXISTS. `knowledge_email_marks`
  takes the kinds `watch-review`, `watch-digest` and `watch-reach`; `knowledge_work` the kind `watch`.
- The daily prune deletes updates older than `INBOX_UPDATES_MS` and past the newest `WATCH_UPDATES_KEPT`, and marks
  of people with no watch.
- A closed account (`document-anonymise.ts`): its watches go, and its id leaves every update's `actor_ids` (its name
  stays as written, like a comment's).
- Nothing of it is in the page's body, a snapshot, an export or a copy: a copy starts with no watchers.

## Errors and edge cases

- A watch of a page that is in the Trash: the page lookup reads it as missing (404), as every page route does.
- `section` on a page with no subpages: `not_a_section` 400. A section whose subpages all go later keeps its row and
  covers the page alone.
- Two changes at once on one page: each folds with one read and one write; the race can open two updates within the
  hour, which the push sends as two rows (accepted).
- A review that comes due on a deleted page is not noted (the check reads linked pages only).

## Security and trust

- A Viewer's write, reaching `page_watchers` alone; the grant's role is never widened. Nobody reads who watches.
- The Inbox's rows carry the page's name and the actors' names, only to people the index finds reach the item; the
  digest names pages only to someone `ownersWhoReach` admits that day.
- Spam: an update is at most one a page an hour, the digest one a knowledgebase a day and off by default.

## Performance and limits

- A save in a knowledgebase with no watch pays one indexed `SELECT ... LIMIT 1` (measured in the PR); with watches,
  one read and one write of `watch_updates` for the page and an alarm wake. No fan-out in a request.
- The push: one read of at most 50 updates, one of the watches (at most 2,000 rows) and the tree; `people` worked out
  in memory (pages × ancestors, depth at most `MAX_PAGE_DEPTH`); one request of at most about 50 × 200 × 40 B = 400 KB,
  under the index's 512 KiB body limit.
- The daily check: at most 200 reach checks (one team read plus a grant request each for the rest) and 200 emails.

## Presentation and UX

- `components/page-watch/`: `usePageWatch` (the store slice, `canWatch`, `set(scope)` with the toasts), `PageWatchRow`
  (the rail's row: `Watch`/`Watching` button with its menu, the count with its hover card).
- The tree row menu: `PageTreeRowMenu` takes `watch` (`{ watching, through, section }` for the row's page, loaded
  when the menu opens) and draws Watch / Watch This Section / Unwatch rows after Request Approval, for every role;
  the verbs `watch`, `watch-section`, `unwatch`.
- The rail: `PageWatchRow` at the top of the Page Health card, a 32 px row: the eye, the label, a chevron; the count
  in muted text at its right.
- Toasts: "Watching Deploys" with "You'll hear when it changes"; "Stopped Watching Deploys". A refusal's words come
  from the api's message.
- Settings: `emailSwitch('notifyWatchDigest', ...)` reads `p.notifyWatchDigest === true` (off by default).

## Accessibility

- The rail's button is named "Watch Deploys" or "Watching Deploys" with `aria-haspopup="menu"`; its menu rows are
  menu items with `aria-checked`. The count is text with its hover card on focus too.

## Testing

- api `knowledge-watch-routes.test.ts`: every role (Editor, Participant, Viewer, view link with and without an
  account, page link, guest, agent), set, change and remove, `through`, the count, the bounds and the rate.
- api `watch-notes.test.ts`: each change kind noted from its call site, the hour's folding, own changes, nothing with
  no watch, nothing for a reaction, a thread or Verify.
- api `watch-work.test.ts`: the push's people (section cover, own change, watch started later, unwatched, the cap),
  the retry, the daily reach check removing a watcher who lost access, the digest (off by default, on, once a day,
  the ceiling).
- api `watch-digest-email.test.ts`: the template's lines, escaping and unsubscribe.
- editor `page-watch-store.test.ts`, `PageWatchRow.test.tsx` and `PageTree.watch.test.tsx` (each role sees the rows).

## Constants and configuration

`WATCH_UPDATE_WINDOW_MS` 1 h; `WATCH_PUSH_DELAY_MS` 60 s; `WATCH_RETRY_MS` 60 s (doubling to 1 h);
`WATCHES_PER_KNOWLEDGEBASE_MAX` 2,000; `WATCH_CHANGES_PER_MINUTE` 30; `WATCH_ACTOR_IDS_MAX` 50;
`WATCH_UPDATES_KEPT` 200; `WATCH_REACH_CHECKS_PER_DAY` 200; `WATCH_DIGESTS_PER_DAY` 200; `DAY_MS` for the daily
work; and the platform's `UPDATES_PUSH_MAX` 50, `UPDATE_ACTORS_MAX` 5, `UPDATE_PEOPLE_MAX` 200, `INBOX_UPDATES_MS` 14
days.
