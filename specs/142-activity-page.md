# 142 — Activity page

**Status: implemented.** A new Explorer section, **Activity** at
`/explorer/activity`, that lists across every diagram the reader can
open: the **open actions assigned to them**, the **open actions they
assigned** to other people, and the **unresolved comment threads they
are in**. Each row opens the diagram on the right tab with the element
selected and its action / comment popover already open.

Builds on assigned actions (spec/68), comment threads (spec/09), the
Explorer's section model (spec/15, spec/138 §8.3), and the hybrid
identity + guest → account migration (spec/04).

## Why

Actions and comment threads are element-level collaboration metadata:
they live inside the element, inside the tab JSON, and the only place
that lists them today is the in-editor **Collaborate Panel**
(spec/68 §5), which is scoped to the tab that is open. Somebody who
has been assigned work on four diagrams has to remember which four.
Spec/68 §9 called the cross-diagram inbox out of scope and named the
reason: the per-element blob model is right for the editor, and a
listing across diagrams needs a table. This spec adds that table
without moving the source of truth.

The Timeline (spec/138) is not this. It records that an action _was
assigned_ and a comment _was added_; it never says whether the action
is still open, and it does not know who is still waiting on a thread.
The Activity page answers the present-tense question: **what is
outstanding for me right now.**

## Non-goals

- Not a replacement for the Collaborate Panel (spec/68 §5), which stays
  the in-editor, tab-scoped surface with its Open / Resolved sides.
- No completing, reassigning, resolving, or replying from the page in
  v1. Every row is a link into the editor, where those controls already
  exist with their edit-access gates. A future version can add
  "Mark done" to a row; the index carries what it needs.
- Done actions and resolved threads are not listed. The page is an
  inbox of what is outstanding, not a history; the Timeline and the
  Collaborate Panel's Resolved side already cover the past.
- Offline Mode diagrams (spec/76) never reach the worker, so their
  actions and threads never appear here, the same as on the Timeline.

## 1. What the user sees

A new **Activity** row in the sidebar's **Quick find** section, directly
under Timeline, with a badge counting the open actions **assigned to
the reader** (zero hides it: a "0 things to do" badge is noise, and
the count only covers work waiting on them, not work they handed out).

The pane is a single page of three sections, each a card-list of rows
(the same container the List view uses), each with a heading and a
count, and each hidden entirely when empty:

1. **Assigned to You** — open actions whose assignee is the reader.
   A self-assignment (spec/68: the Myself row, the guest to-do case)
   lands here and only here.
2. **You Assigned** — open actions the reader assigned to _somebody
   else_. Self-assignments are excluded so one action never appears
   twice.
3. **Open Comment Threads** — unresolved threads the reader is in.
   "In" means one of two things, and the row says which:
   - the reader wrote at least one comment in the thread, or
   - the thread is on a diagram the reader **owns** (owners are
     already treated as included: spec/64 emails them every new
     comment). The row carries a quiet **Your diagram** hint.

Rows share one anatomy with the Collaborate Panel's (spec/68 §5) so a
user recognises them: kind glyph far left (the action clipboard, the
comment bubble); name + one-line detail in the middle; person avatar
over a relative time far right. The detail line is where the row is
_from_: **element label · tab name**, with a **diagram chip** naming the
diagram (a team diagram's chip also names the team). An action row's
title is the action name, its avatar the assignee (brand-tinted when
that is the reader, labelled "You"); a **You Assigned** row shows the
assignee's avatar with "Assigned to <name>" on hover. A thread row's
title is the element label, its detail the latest comment's text, its
avatar the latest author's colour, with the comment count on hover.

Ordering within a section is **newest activity first**: an action's
`updatedAt` (a reassignment or edit bumps it), a thread's latest
comment. The page is capped at 100 rows per kind; the cap is a
ceiling on a page nobody scrolls that far down, not a paging design.

**Row click opens the element.** The link is the diagram's normal URL
(the share-code form for a diagram shared with the reader, spec/33)
with a fragment the editor reads on load:

```
/diagram/<id>[?s=<code>]#t=<tabId>&el=<elementId>&open=action|comments
```

`#t=` is the existing tab pin (spec/13); `el` and `open` are new. Once
the pinned tab's elements have loaded the editor selects the element,
scrolls it into view, and opens the named popover, exactly what a
Collaborate Panel row click does in-editor. The fragment is captured by
an effect declared ahead of the tab-entry effect (which rewrites the
hash to the plain `#t=` form on hydration, as it always has) and
consumed once, so a refresh lands on the tab without re-opening the
popover. It is not read during the first render: on a client-side
navigation from the Explorer, Next commits the new URL after that
render, so the hash would still be the Explorer's. An element the tab no longer holds
(deleted since the page loaded) degrades to opening the tab.

States:

- **Loading**: the Explorer's skeleton rows.
- **Empty** (nothing open in any section): one `EmptyState` — "Nothing
  waiting on you", with a line explaining what lands here and a link to
  the assigned-actions help article. No New Diagram CTA: a new diagram
  does not put anything on this page.
- **Failed**: "Couldn't load your activity" with **Try again**. Distinct
  from empty for the same reason the Timeline keeps them apart
  (spec/138 §2.4): "we couldn't ask" and "there is nothing" are
  different answers.

Coming back to a tab that has been open a while re-reads the list
(`useReturnToTab`, as the Timeline does), merging in place.

## 2. Data model: the collaboration index

Two index tables in D1, written by the api worker **in the same batch
as the tab row**, so they can never drift from the blob they mirror.
The tab JSON stays the source of truth (spec/68 §1); the index is a
projection of it that SQL can filter.

```sql
CREATE TABLE collab_actions (
  tab_id TEXT NOT NULL, element_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  element_label TEXT NOT NULL,          -- the row's "where": label / first table cell
  name TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL,                 -- 'open' | 'done'
  assignee_user_id TEXT, assignee_member_id TEXT, assignee_name TEXT,
  assigner_id TEXT NOT NULL, assigner_name TEXT,
  team_id TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (tab_id, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

CREATE TABLE collab_threads (
  tab_id TEXT NOT NULL, element_id TEXT NOT NULL,
  element_label TEXT NOT NULL,
  resolved INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  participant_ids TEXT NOT NULL,        -- JSON array of comment authorIds
  latest_text TEXT NOT NULL, latest_author_name TEXT NOT NULL, latest_author_color TEXT NOT NULL,
  first_at INTEGER NOT NULL, latest_at INTEGER NOT NULL,
  PRIMARY KEY (tab_id, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);
```

- **Keyed by tab, not diagram.** A tab can belong to several diagrams
  (spec/17); the diagram is resolved at read time through
  `diagram_tabs`, which is also what makes deletion free: a tab's rows
  die with it (FK cascade), and a diagram's tabs die with the diagram.
- **One row per element per kind** (spec/68: at most one action per
  element; one thread per element), so a save is a full replace of the
  tab's rows: `DELETE … WHERE tab_id = ?` for each table, then one
  `INSERT` per element that carries the thing. Idempotent, and it
  handles an action being deleted, moved, completed, or reassigned
  with no diffing. On a typical tab (no actions, no threads) that is
  two deletes that touch nothing.
- **No email, no comment history.** The thread row keeps the latest
  comment (what the row shows) and the set of author ids (who is in
  it). Every other comment stays in the blob.
- `participant_ids` is a JSON array queried with `json_each`. Not
  indexable, and it does not need to be: the read (§4) is bounded by
  the reader's own library before it ever looks at participants.

### 2.1 Where the writes happen

Every path that writes `tabs.data` contributes the index statements to
its own batch, all via one helper (`collabIndexStatements` in
`apps/api/src/db/collab-index.ts`), so a fifth write path cannot forget
by accident without also forgetting to write the tab:

| Path                                         | Where                      | How                                          |
| -------------------------------------------- | -------------------------- | -------------------------------------------- |
| tab autosave `PUT …/tabs/:tabId`             | `upsertTab`                | statements appended to the tab's batch       |
| view-role comment `POST …/comments`          | `upsertTab`                | same                                         |
| delete-own comment `DELETE …/comments/:id`   | `upsertTab`                | same                                         |
| create (`POST /diagrams`, templates, import) | `seedTabs`                 | same, per tab                                |
| duplicate / copy from a share link           | `copyDiagram`              | `INSERT … SELECT` from the source tab's rows |
| MCP `update_diagram` / `add_tab` (spec/62)   | goes through the tab `PUT` | covered                                      |
| tab / diagram delete, account delete         | FK cascade from `tabs`     | nothing to do                                |
| tab link into another diagram (spec/17)      | rows are per tab           | nothing to do                                |

The rows are derived by a pure function over the tab's elements
(`collabIndexRowsFromElements`), which reuses the element-label rule
the Collaborate Panel already applies (`elementDisplayLabel`, moved
into `packages/diagram` so the panel and the index cannot disagree on
what a row is called).

### 2.2 Identity across sign-up: `owner_aliases`

Comment `authorId`s and self-assigned `assignee.userId`s are written
with whatever identity the writer had at the time, a guest participant
id for anyone signed out (spec/04). When that guest signs up, their
diagrams migrate to the Clerk id (`POST /api/migrate`) but the ids
inside the blobs do not, and a later re-index of an untouched tab
would faithfully re-write the guest id. Rewriting blobs on migration
is the wrong fix (every tab of every diagram, on the sign-up path).

So the migration records the relationship instead:

```sql
CREATE TABLE owner_aliases (
  owner_id TEXT NOT NULL,    -- the current identity
  alias_id TEXT NOT NULL,    -- an identity it used to be
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, alias_id)
);
```

Both `/api/migrate` flows write a row (guest → account, and the legacy
unsigned-guest → signed-guest upgrade), carrying any aliases the source
id had already accumulated so a chain collapses onto the final id. The
Activity read matches `me = {ownerId} ∪ aliases(ownerId)` everywhere it
compares an identity, so a week of guest to-dos is still on the page
after signing up, whatever the blob says. Account deletion drops the
owner's alias rows.

This is deliberately the only consumer in v1. The editor's own
"mine" highlight and delete-own check keep comparing against the
current id; extending them is a separate change.

### 2.3 Backfill

Existing tabs have no index rows until they are saved again. On the
first `GET /api/activity` for an owner (no `collab_index_state` row),
the worker seeds the index off the response path (`waitUntil`) from
the tabs of every diagram the reader can see (owned, joined-team,
shared-with), cheaply pre-filtered in SQL to tabs whose JSON contains
a `commentThread` or `action` key, capped at 300 tabs (logged when
hit), and stamps `backfilled_at`. The write is the same full-replace
per tab as a save, so overlapping with a live save is harmless. The
same state row moves with the owner on migration so the seed does not
run twice against the new id.

## 3. API

```
GET /api/activity   -> { actions: ActivityAction[], threads: ActivityThread[] }
```

Hybrid identity (Clerk user or `X-Owner-Id`); guests get their own
page, keyed to their participant id. Read-only: nothing on the page is
mutated from the page in v1, so there is no other verb.

Wire types in `@livediagram/api-schema` (`activity.ts`), registered in
the OpenAPI manifest + schema roots (spec/37):

```ts
type ActivityPlace = {
  diagramId: string;
  diagramName: string;
  teamId: string | null;
  // 'own' | 'team' | 'shared' — how the reader reaches the diagram;
  // shareCode is set only for 'shared', so the client can build the
  // visitor URL (spec/33).
  via: 'own' | 'team' | 'shared';
  shareCode: string | null;
  tabId: string;
  tabName: string;
  elementId: string;
  elementLabel: string;
};
type ActivityAction = ActivityPlace & {
  id: string;
  name: string;
  description: string;
  assignee: { userId: string | null; name: string | null };
  assigner: { id: string; name: string | null };
  createdAt: number;
  updatedAt: number;
  assignedToMe: boolean;
  createdByMe: boolean; // resolved server-side against me ∪ aliases
};
type ActivityThread = ActivityPlace & {
  commentCount: number;
  latest: { text: string; authorName: string; authorColor: string; at: number };
  firstAt: number;
  youCommented: boolean;
  onYourDiagram: boolean;
};
```

## 4. The read, and who sees what

Every row is scoped **first** by the diagrams the reader can open, the
same three sets the Explorer's Recent already merges: diagrams they
own, diagrams in a team they have _joined_ (an `invited` row grants
nothing, spec/32), and diagrams shared with them whose share is still
live. Only then is the involvement test applied:

- an action is theirs to see when its `assignee_user_id` ∈ me, its
  `assigner_id` ∈ me, or its `assignee_member_id` is one of their
  `team_members` rows (this is how an action assigned to an
  _invited_ address finds its owner once they join, spec/68 §1);
- a thread is theirs when they own the diagram or an author id ∈ me.

That order is the security boundary: a name can never leak a row from
a diagram the reader has lost access to, and it is what keeps the
`json_each` participant scan bounded to one person's library.

A tab linked into two visible diagrams would list twice; the read
dedupes on (tab, element), preferring the diagram the reader owns,
then a team's, then a shared one.

## 5. Explorer integration

The section checklist from spec/138 §8.3: `views.tsx` gains
`{ kind: 'activity' }`, `routes.ts` maps it both ways,
`app/explorer/activity/page.tsx` is the route stub, `ExplorerSidebar`
gets the Quick find row (with `ActivityIcon` in `icons.tsx`),
`useExplorerPane` names it, `ExplorerPane` dispatches to the
lazy-loaded `ActivityPane` (not a `BROWSE_KIND`; no New Diagram / New
Folder header actions; Help links the new article), and
`routes.test.ts`'s `STATIC_NODES` lists it. The sidebar badge and the
pane read the same fetch (`useActivityFeed`, held in Explorer state
like favourites), so opening the section never issues a second request
and the badge cannot disagree with the list.

## 6. Telemetry

A new `Activity` category in `TELEMETRY_CATEGORIES` (spec/22):

- `Activity` / `Opened` when the section renders (once per visit);
- `Activity` / `Selected` with type `Action` | `Thread` on a row click;
- `Activity` / `Loaded` / `Retry` when a failed read is retried.

Never an action name, comment text, diagram name, or any identity.

## 7. Testing

- `collab-index-rows.test.ts`: the pure derivation (labels, statuses,
  participant sets, latest-comment selection, tables' first-cell rule).
- `activity.test.ts` (routes): owner gate, the db call is scoped to the
  resolved owner, backfill is dispatched only when unseeded, the
  `assignedToMe` / `createdByMe` / `youCommented` flags.
- `collab-index.test.ts` (db): the SQL statements a save contributes,
  including the two deletes on a tab with nothing, and the copy path.
- The OpenAPI drift test (spec/37) pins the new route + schemas.
- `routes.test.ts` round-trips the new section.
- `collab-deep-link.test.ts`: the fragment parser (tab only, tab +
  element, unknown `open`, junk).
- `useActivityFeed.test.tsx`: sections split from one read, error vs
  empty, retry.
- Help: the registry / icon / colour / articleCount tests pick the new
  article up automatically.

## 8. Docs and help

- Help article **Activity** under Explorer
  (`apps/help/app/explorer/activity/page.mdx`), registered with
  keywords ("inbox", "to do", "todo", "assigned to me", "my actions",
  "outstanding", "waiting", "open threads"), a card glyph + hue, and
  an `ActivityList` illustration.
- README / `docs/architecture.md` / `docs/what-is-livediagram.md` gain
  the section; spec/68 §9 and spec/15's sidebar list point here.
