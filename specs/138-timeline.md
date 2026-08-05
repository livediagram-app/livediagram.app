# 138 — Timeline

The Explorer's landing page becomes a chronological feed of everything
that has happened across the user's diagrams, teams, and account —
grouped by day, stacked when a day gets busy, and switchable into a
calendar month grid.

Modelled on the Timeline subsystem in the Manager Toolkit monorepo
(`specs/dashboard/timeline/spec.md` + `packages/ui/src/timeline/*` there),
adapted to livediagram's data model and its light/dark UI.

## Why

Today the Explorer opens on **Recent**, a list of diagram rows ordered
by `updated_at`. It answers exactly one question — "what did I touch
last?" — and it is the only answer the Explorer gives. Everything else
that happens to a user is invisible until they go looking for it:

- Someone commented on a diagram you own. You find out by email (spec/64
  #1), or you don't.
- Someone assigned you an action (spec/68). Same.
- A team invite arrived. It sits behind a badge in a sidebar section
  most users never expand.
- A teammate joined, left, or was promoted. Nothing tells you.
- An API token is about to expire (spec/61). One email, seven days out.

Each of those already exists as a write somewhere in the api worker, and
each is currently a dead end. The Timeline is one surface that collects
them, so the first thing a user sees on opening the Explorer is **what
has happened since they were last here**, not just a list of files.

## Non-goals

- **Not a replacement for the Activity Panel** (spec/12). That panel is
  element-level, tab-scoped, and revertable — a precision instrument for
  one diagram. The Timeline never renders an element diff and never
  offers Revert. Diagram editing appears here as one coalesced "worked
  on" event per person per diagram per day (§4.2).
- **Not realtime.** No Durable Object fan-out, no per-user socket. The
  feed is read on load, with a Refresh button and a stale-read refresh
  (§6.3). livediagram's realtime rooms are per-diagram; a per-user
  channel is a whole new object type for a screen the user looks at
  once a session.
- **No favourites / starring, and no per-entry delete** in v1. The
  Manager Toolkit timeline has both (they matter when a timeline is
  evidence for a performance review). Here the feed is ambient — you
  read it and move on — so the tables and the eight endpoints they
  need aren't earned yet. The schema doesn't preclude them (§3.4).
- **No AI day summary.** Manager Toolkit gates one behind Pro;
  livediagram has no paid tier (spec/03), so it would be free for
  everyone and gated only on `OPENAI_API_KEY`. Deferred as its own
  decision rather than smuggled in with this one.
- **No manual entries.** Every event is emitted by the system from a
  real write. There is no "add a note to your timeline".

## 1. Concepts

Three nouns, lifted from Manager Toolkit because the shape has already
been proven there.

### Event

One thing that happened. Carries:

- `sourceType` + `sourceId` — the domain object it is about
  (`diagram` + the diagram id, `team` + the team id). Synthesised for
  events with no single object (`account` + the owner id).
- `eventType` — what happened (`diagram_created`, `comment_added`,
  `team_member_joined`). Distinct from `sourceType`: one diagram
  produces many event types over its life.
- `title` / `description` — first-class columns, not snapshot fields.
  Every event has a title; they are the universal backbone and the
  thing a future search would index.
- `occurredAt` — the sort key.
- `snapshot` — JSON extras the renderer needs (the diagram's thumbnail
  key, the commenter's colour, the team's member count) captured at
  emit time so rendering the feed never fans out into other tables.
- `actorId` — who did it, as an owner id (Clerk `sub` or guest
  participant id). `NULL` for system events like a token expiry
  warning.

### Scope

**Who should see this event.** A scope is a `(scopeType, scopeId)` pair.

v1 ships exactly one scope type: `user`, where `scopeId` is an owner id.
The Timeline page reads `user:<caller>`.

`scopeType` is a free-text column with no CHECK constraint, so a later
per-diagram timeline (`diagram:<id>`, a natural second home for the
Activity Panel's data) or a team activity feed (`team:<id>`) is a new
scope value plus a renderer — no migration, no change to the read path.
That is the whole reason for the join table below; see §3.4.

### Membership

One event, many scopes. A comment on a diagram that lives in a team
library reaches the diagram's owner **and** every joined member of that
team — one event row, N membership rows. Without the join table the
event would have to be duplicated per recipient, and a team of twelve
would multiply every comment by twelve.

## 2. What the user sees

`/explorer/timeline`, rendered in the Explorer's right pane using the
existing `ExplorerPane` dispatch.

```
┌──────────────────────────────────────────────────────────────┐
│ Timeline  [≡ List|▦ Calendar] [⧩ Filter] [? Help] [+ New diagram]│
├──────────────────────────────────────────────────────────────┤
│  ●  ┃  [Today]  Tue, 5 Aug   2026                            │
│  │  ┃  ┌────┬─────────────────────────────────┬─────┐        │
│  │  ┃  │ 🗑 │ Payments architecture deleted   │     │  (red) │
│  │  ┃  └────┴─────────────────────────────────┴─────┘        │
│  │  ┃  ┌────┬─────────────────────────────────┬─────┐        │
│  │  ┃  │ 💬 │ Priya commented on Payments…    │ ▤   │ (green)│
│  │  ┃  │    │ "Per-shard or global?"          │     │        │
│  │  ┃  └────┴─────────────────────────────────┴─────┘        │
│  │  ┃  ┌────┬───────────────────────────────────────┐──┐─┐   │
│  │  ┃  │ ✎  │ Diagrams Renamed                      │  │ │   │
│  │  ┃  │    │ 3 events · click to expand            │  │ │(amber)
│  │  ┃  └────┴───────────────────────────────────────┘──┘─┘   │
│  ●  ┃  Mon, 4 Aug                                            │
│  │  ┃  ┌────┬───────────────────────────────────────┐        │
│  │  ┃  │ 👥 │ You joined Platform Guild             │(amber) │
│  │  ┃  └────┴───────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

**Day rail.** A dot and a connecting line down the left, one group per
calendar day (UTC), newest first. Today's dot is brand-500 with a soft
ring and its label carries a **Today** pill. Days in the future (a share
link expiring, a token expiring) sit above Today with a violet-tinted
dot and rail.

**Bubble.** Four regions, and the layout is strict:

1. **Icon strip**, 44px, right-bordered, holding the event's glyph.
2. **Content** — headline, optional description, optional meta line.
3. **Preview** — for events that have one (a diagram's cached SVG
   snapshot, spec/67). Fixed height and vertically centred, so it sits
   _inside_ the height the content already sets: a preview that grew
   the row would make every diagram bubble taller than every other
   kind. Reuses the Explorer's `DiagramThumbnail`, inheriting its lazy
   intersection-observer fetch, so a feed of fifty rows doesn't trigger
   fifty server renders for diagrams nobody scrolls to. Suppressed on a
   collapsed stack — one diagram's thumbnail can't speak for a run
   spanning five.
4. **Action strip** — contextual actions, hover-revealed. Usually
   empty, because most bubbles make the whole row clickable instead. It
   exists so a later star / dismiss has exactly one place to land,
   rather than a button floating in the content row.

### Colour means what happened, not where

The bubble's tint keys on the **event type**, not the source type.
A reader scanning a busy day asks "is any of this alarming?" long
before they ask "was that a diagram or a team", and only the first
question has a useful colour answer. Three tones, deliberately few —
a palette with six meanings is a legend the reader has to learn:

| Tone         | Colour | Covers                                                                                                                                                                                                                                                           |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `danger`     | red    | Destruction and lost access: a diagram deleted, a member removed. Kept tight — if everything worrying is red, nothing is. Note `team_member_left` is _not_ here: leaving is a departure the person chose, and colouring it like being removed misreads the room. |
| `structural` | amber  | The shape of things changed. Nothing was lost, but something a reader might rely on moved: renames, folder and team placement, membership, roles, sharing, and the forward-dated expiry warnings.                                                                |
| `create`     | green  | Things made, edited, said or finished — the ordinary business of using the product, and the bulk of any active day.                                                                                                                                              |

Anything unmapped falls to a neutral slate rather than guessing, so an
event type from a newer worker reads as plain rather than as a
deletion. Every bubble of the same tone gets the _same_ tint — no
alternating stripe, which reads as "different kinds" and is the
opposite of what the colour is doing. The rules live in
`packages/ui/src/timeline/eventTone.ts`; the palette is a product
decision and lives in the live app's `globals.css`, light and dark.

**Classification is enforced by the compiler, not by a list.** That
neutral fallback is right for an event type this build has never heard
of and wrong for one it ships: an unclassified event renders in a colour
that says the wrong thing about what happened. So
`TIMELINE_EVENT_TYPES` in `@livediagram/api-schema` is a runtime array,
`KnownTimelineEventType` derives from it, and both the tone map and the
filter-category map are `Record<KnownTimelineEventType, …>` — adding an
event type fails the build until it has a tone and a chip.
`TimelineEventType` stays open (`| (string & {})`) for the wire, which
is precisely why the closed array has to exist alongside it. Before
this, both maps were keyed on loose strings and the only net was a
hand-copied list of all 38 types inside `eventTone.test.ts` — a copy of
the union, in another package, which can only prove that the copy agrees
with itself. spec/22 records the same lesson from the palette telemetry
tokens, where the copy had silently drifted. The tests kept the half a
compiler can't check: that no known type was classified `neutral` or
`other` by hand, which is the other way to leave an event unclassified.

**A bubble that can't be clicked is dimmed.** A row that looks
identical to a clickable one but ignores the click reads as broken;
60% opacity answers the question before the pointer gets there. The
common case is a tombstone — the emit deliberately omits the deleted
diagram's id, so the renderer has nothing to link and the dimming is
structural rather than a rule someone has to remember.

**Copy rules.** The headline names the **subject first**, then what
happened to it:

- "Payments architecture deleted", not "Diagram Deleted" with the name
  on a second line. A feed is read by scanning the left edge, and the
  subject is what the reader scans for; the category is already carried
  by the icon and the colour. The subject is bolded so that edge stays
  legible at a glance.
- Where a person is the subject, they lead: "Priya commented on
  Payments architecture", "Sam joined Platform Guild".
- The **stored** `title` stays a generic Title Case category
  ("Comment Added"). That is what a collapsed stack wears and what a
  future search would index, so the two readings coexist: individual
  rows are specific, collapsed runs stay honest (§2.1).
- Supporting detail goes in the description or the quiet meta line —
  a rename's new name, an edit's author, a comment's text.

### 2.1 Stacking

When a day picks up volume the feed must not become a wall. Within one
day-group, events sharing a `(sourceType, eventType)` bucket collapse
into a single bubble reading **"N events - click to expand"**, rendered
with one or two faux-card layers stepping out to the right so the pile
reads as depth. Clicking expands the run inline.

- Grouping is **by bucket, not by adjacency**: four team-member events
  split by an unrelated bubble still collapse into one stack of four.
  The user reads a day by _kind of activity_, not by chronological run.
- The stack lands at the position of its **most recent** member, since
  entries arrive newest-first.
- Related event types alias onto one bucket so an add and a remove on
  the same day read as one moment: `team_member_joined` +
  `team_member_left` → "Members Changed"; `share_link_created` +
  `share_link_expired` → "Sharing Changed".
- **Never stacked**: `comment_added` on a thread you are in, and any
  event whose description carries content that only makes sense
  individually. A collapsed comment hides the thing you wanted to read.
- A stack of one is just a bubble; the faux layers only render at 2+,
  and the second layer only at 3+.
- **Expanding and collapsing are the same control.** The collapsed
  bubble is its own click target, so opening a run is obvious; closing
  it is not, because once the run is open nothing is left saying it was
  ever a stack. So an expanded run carries a **"Collapse N events"**
  footer, indented to the bubbles' content column and worded to mirror
  the "N events · click to expand" the reader just clicked. Without it,
  a reader who opened a day of twelve renames to check one of them has
  no way back short of navigating away.

The rules live in `packages/ui/src/timeline/stacking.ts` as pure
functions over the entry list, tested directly.

### 2.2 Calendar mode

A segmented control in the header switches **List** / **Week** /
**Calendar**, each wearing its own glyph so the trio reads without
parsing three labels (and collapsing to icons below `sm:`, where three
labels plus Filter and Help would wrap the header row).

**Week** is the same grid over seven days, with taller cells.

**Calendar** renders a month grid. Each day cell carries one
coloured dot **per tone** present that day, with a count above one —
so a month view answers "when did something get deleted?" at a glance,
which "diagram vs team" would not. Dots sit in a fixed severity order
(danger, structural, create) so the eye can rely on position. Clicking
one opens a popover listing that day's events of that tone as full
timeline bubbles — the same renderers, so there is one bubble
implementation, not two.

- Navigation chevrons **page one period at a time**, in both week and
  month mode, and are never disabled. A step is small enough that
  skipping empty periods would hide the shape of a quiet stretch, which
  is often the thing being looked at, and whichever period you land on is
  fetched on demand.

  Month paging used to jump to the nearest month that had events and
  disable itself when there was none, tooltipped "No earlier events" —
  correct while the client held the whole history, wrong the moment the
  feed became paginated. "Has events" could then only be answered from
  the LOADED events, i.e. page one, so an active user with a busy month
  saw both chevrons greyed out while the server held years more. Worse,
  paging is what triggers the period fetch, so the control that would
  have loaded those months was disabled for not having loaded them. The
  cost of the honest version is a click per empty month, which is the
  trade week mode had already made.

- Mode is not persisted across navigation. Each mount opens on List:
  someone who looked at the calendar once should not find the feed in
  calendar mode a week later wondering where their list went.

### 2.3 Filters, refresh, paging

**The controls are not part of the feed.** `<Timeline>` renders no
header of its own; `<TimelineControls>` is a separate export that the
host places in its own page-header row, beside that page's other
actions and styled to match them. A second row of buttons directly
under a header that already has one reads as two unrelated toolbars.
The two halves share one `useTimelineControls()` state, so a filter
chip and the list it filters can never disagree.

**The header also carries New diagram**, at the row's right edge where
every other Explorer section puts its create action. A feed is a record
of what happened rather than a container you add to, so this page
originally left creation to the empty state's CTA (§2.4). That was
wrong once Timeline became the landing page (§8.1): the empty state is
precisely what a returning user never sees, so the first screen of the
app offered no way to start a diagram. Timeline is still not a
container — the button is a page-level action that navigates to `/new`,
not an "add to this feed" verb, and it takes no folder or team
argument the way the browse sections' create action does.

Because Timeline offers no **New folder**, this is the one create verb
on the page, and `PaneHeader` renders a lone verb as itself rather than
behind the `+ Create` dropdown (see `pane-create-action.ts`). A
dropdown holding a single tile costs a click and hides the word
"diagram" behind the word "Create". Recent, the other one-verb section,
gets the same treatment. Below `sm` the label collapses to its icon and
`aria-label` carries the name — the same idiom, and the same reason, as
the mode buttons in §2.2.

- **Activity by: Everyone / Other people.** The sharpest filter on the
  feed, so it leads the popover. On an active account your own edits
  drown everyone else's, and "what did I miss" is the question the whole
  surface exists to answer. System events (an expiring token) survive
  it: nobody did those, and they're exactly what the filter is looking
  for. It began as an "Others" button in the header — the wrong place,
  and a word that doesn't say others-what.
- **Category chips** — Comments, Actions, New diagrams, Edits, Renames,
  Deletions, Sharing, Teams, Filing, Account.

  These key on **what happened**, not on the source type. Chips keyed on
  source type were the first attempt and were nearly useless: comments,
  edits, renames, actions, sharing and deletions all carry
  `sourceType: 'diagram'`, so one chip covered most of a personal feed
  and turning it off left almost nothing. "Hide the diagram stuff" is
  not a thing anyone wants.

  The categories are coarser than the event type — nobody wants
  `comment_resolved` separately from `comment_added` — and finer than
  the tone, which answers a different question: tone is _how alarming_,
  category is _what happened_. Grouped by consequence rather than by
  table: losing a diagram, a folder, a team or a working token are all
  **Deletions**, because someone scanning for "did anything disappear?"
  wants them in one place.

  Only categories present in the feed get a chip, so a reader with no
  teams isn't offered a Teams chip that filters nothing. Chip order is
  fixed rather than alphabetical or by frequency — a control that moves
  between visits is one you have to re-read every time. The chips are
  brand-coloured, not tone-coloured: colour on this surface already
  means severity, and two colour systems in one popover would make the
  reader learn both. Anything unmapped falls to **Other**, so an event
  type from a newer worker is still filterable.

- **Mini calendar** inside the popover: clicking a date takes the reader to
  that day, and what that means follows the open mode. **List** scrolls the
  day-group into view and pulses it with a fading box-shadow — box-shadow
  only, never a transform, because transforming the group promotes it to its
  own compositing layer and tearing that layer down at animation end makes
  the bubbles visibly blink. **Calendar** moves the grid to that day's month;
  **week** moves it to the week containing it.

  The mode split is not a nicety: the scroll target and the pulse are both
  rendered by the day groups, and only list mode renders those, so a
  scroll-and-pulse-only implementation left this control — offered in the
  header in all three modes — doing nothing at all in two of them.

- **Show more** appends the next page when the read returns a cursor.
  Page size 50, capped server-side at 200.

**The Filter dot means "this feed is narrowed", whichever control did
it** — a reader wondering why the page looks short needs one signal, not
one per filter.

**There is no Refresh button.** The feed loads on mount, and the worker
seeds a first-time scope off that same read (§5), so a manual refresh
had nothing to do that reopening the page doesn't already do. The
`POST /api/timeline/refresh` endpoint stays part of the documented
public API for an external caller that wants to force a seed; the app
simply doesn't need it.

The popover renders into a `document.body` portal at fixed coordinates
anchored to its trigger, re-anchored on scroll and resize. The Explorer
pane is a rounded, `overflow: hidden` card, so an in-tree absolute
popover is clipped no matter its z-index.

### 2.4 Empty and loading states

- **Loading**: a skeleton of three day-groups, not a spinner and not
  the empty state. The feed popping in after a fetch reads as a layout
  jump.
- **Empty (new user)**: the shared `EmptyState` from `@livediagram/ui`,
  copy "Nothing has happened yet — create a diagram and it'll show up
  here", with a New Diagram action. In practice a signed-up user is
  rarely empty because of the backfill (§5) — which is exactly why this
  CTA can't be the page's only route to a new diagram, and why the
  header carries one too (§2.3).
- **Empty (all filtered out)**: "No events match these filters", with a
  Clear filters action. Distinct copy from the new-user case, so the
  user isn't told they have no history when they do.

### 2.5 Unread

The premise is "what happened since I was last here", so something has
to track _last here_. `timeline_scope_state.last_seen_at` does:

- The read returns the watermark as it stood **before** it, so the
  response can mark what is new to this reader, and then moves it
  forward. The client renders from the value it was handed rather than
  re-deriving one, because a second read would report nothing new.
- It moves on the **first page only**. Stamping while someone pages
  backwards through history would mark the whole feed seen halfway down
  it.
- And only **once per 60-second visit window**. Without that, a client
  that fetches twice on mount — React's development double-effect does
  exactly this — wipes the markers before anyone has read them.
- Events past the watermark wear a **New** pill. A collapsed stack wears
  one if _any_ member is unseen, or the marker would hide inside the
  thing that collapsed it.
- A reader with **no** watermark has never opened the feed, so nothing
  is marked: greeting a long-time user with "99+" on a feature they have
  never seen would be a lie about what they missed.
- Unread is bounded at **both** ends: past the watermark **and not in the
  future**. The forward-dated expiry warnings from §4 are recorded at the
  instant they come due, so they sit in the Upcoming band, and the
  watermark is only ever written as _now_ — which made
  `occurred_at > last_seen_at` permanently true for them. One API token
  lapsing next week pinned the sidebar badge to "1" for seven days, two
  pinned it to "2", and no amount of reading the feed cleared it; every
  Upcoming bubble wore a New pill on every visit for the same reason.
  Something scheduled is not news until it happens, so it starts counting
  on the day it does. This is bounded by time rather than by switching to
  the row's arrival timestamp because a coalesced event (§3.2) advances
  its `occurred_at` on every update while its `created_at` stays at first
  insert, and comparing arrival would stop genuinely-new activity on an
  existing row from ever marking the scope unread again. The rule lives in
  `countUnseen` (server) and `isNewEvent` (client), which are deliberately
  two implementations of one sentence and are tested as such.

The sidebar badge is its own endpoint (`GET /api/timeline/unread`)
rather than a field on the feed read, because it renders on every
Explorer section and must not require loading a feed nobody is looking
at. It counts **only other people's events** — a number that goes up
because _you_ renamed something is noise — and caps at 99.

Only the `user` scope carries a watermark. A shared team feed has no
single "here" to have been last at.

### 2.6 Motion

Bubbles fan in rather than appearing at once: each starts pulled to the
right with a small tilt and scale-down, then springs into place,
staggered 35ms by position. The motion originates from the right
because that is where a collapsed stack's faux-card layers sit, so it
reads as cards dealt from the deck. The collapsed stack uses the mirror
motion, arriving from below, so folding a run reads as closing.

Three details:

- **No "have I animated this?" bookkeeping.** CSS keyframes fire on
  mount only, so a bubble that re-renders keeps its end state. React
  mounts a fresh node exactly when one is genuinely new.
- **The stagger index is precomputed** into a map rather than
  incremented inside the JSX, so it is identical however many times
  React calls the render function and doesn't depend on child
  evaluation order. It is **capped at 700ms** total: ungapped, a
  50-event page starts its last bubble 1.7s in and the bottom sits
  blank long after the top has settled.
- **Expansion staggers at 60ms and restarts from zero** for the run.
  What just arrived is those bubbles; carrying the page's global offset
  would make a stack halfway down sit still before unfolding.

Keyframes live in the shared Tailwind theme beside the empty-state ones,
so any app rendering a Timeline gets the motion without a per-app paste.
`prefers-reduced-motion` cancels all of it, pinning opacity to 1 —
fill-mode `both` would otherwise strand bubbles invisible.

**The Explorer's own lists cascade too**, via a `lvd-cascade` class on
the container rather than the Timeline's fan. Two differences, both
deliberate:

- **A calmer motion.** The fan comes from the right because that is
  where a collapsed stack's card layers sit. A file list has no deck, so
  reusing it there would be a flourish with nothing behind it; the rows
  get a small rise and a fade instead.
- **Staggered by `nth-child` on the container**, not by threading an
  index prop through four row/card components. That also makes folders
  and diagrams in one view cascade in document order for free, instead
  of each list restarting its own count.

The search panel uses the same class but only for a window after it
**opens**. Its results re-mount on every keystroke, so leaving it on
would slide the whole list on each character — motion fighting the thing
it decorates, and fast typing would feel laggy.

### 2.7 Deep links

`/explorer/timeline#event=<id>` scrolls to that event and rings it. The
target may sit inside a collapsed stack, so those stacks are forced
open — otherwise the link lands the reader on a generic "4 events"
bubble with no idea which one they came for. That is **derived** from
the data rather than pushed into the expanded set from an effect, so it
costs no extra render; the reader can still collapse it afterwards.

The hash is read once at module scope, like the landing-vs-nav
telemetry: it describes how the page was _opened_, and a later in-app
navigation should not resurrect an old target.

## 3. Data model

Migration `0042_timeline.sql`. Three tables, owned by the api worker.

### 3.1 `timeline_events`

```sql
CREATE TABLE timeline_events (
  id           TEXT PRIMARY KEY,          -- UUID
  actor_id     TEXT,                      -- owner id of who did it; NULL for system events
  source_type  TEXT NOT NULL,             -- 'diagram' | 'team' | 'account' | ...
  source_id    TEXT NOT NULL,
  event_type   TEXT NOT NULL,             -- 'diagram_created' | 'comment_added' | ...
  dedupe_key   TEXT NOT NULL DEFAULT '',  -- '' for one-shot events; see §4.2
  title        TEXT NOT NULL,
  description  TEXT,
  occurred_at  INTEGER NOT NULL,          -- epoch ms, matching change_log
  snapshot     TEXT NOT NULL,             -- JSON extras for the renderer
  created_at   INTEGER NOT NULL,
  UNIQUE (source_type, source_id, event_type, dedupe_key)
);

CREATE INDEX timeline_events_occurred_idx ON timeline_events(occurred_at);
```

The `UNIQUE` constraint is what makes emission idempotent. Emitting the
same event twice — because a client retried, or because the backfill
covers ground a live emit already covered — updates the existing row
rather than duplicating it.

`dedupe_key` is empty for one-shot events (a diagram is created once).
It carries `<actorId>:<YYYY-MM-DD>` for the coalesced editing event
(§4.2), which is the one event type that deliberately extends itself
through the day.

`occurred_at` is epoch ms, matching `change_log` rather than the ISO
strings Manager Toolkit uses. Manager Toolkit has a whole normalisation
helper because SQLite defaults, `toISOString()`, and date-only columns
produce three lexically-incomparable formats in one column. An integer
column has no such failure mode; use it.

### 3.2 `timeline_event_scopes`

```sql
CREATE TABLE timeline_event_scopes (
  event_id   TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,               -- v1: 'user'. Reserved: 'diagram', 'team'.
  scope_id   TEXT NOT NULL,               -- an owner id when scope_type = 'user'
  added_at   INTEGER NOT NULL,
  PRIMARY KEY (scope_type, scope_id, event_id)
);

CREATE INDEX timeline_event_scopes_event_idx ON timeline_event_scopes(event_id);
```

The primary key doubles as the read index: `WHERE scope_type = 'user'
AND scope_id = ?` is a prefix scan. The join into `timeline_events` then
sorts by `occurred_at DESC`.

**On not denormalising `occurred_at` onto this row.** A covering index
`(scope_type, scope_id, occurred_at DESC)` would let a page come back
without a sort, and it is the obvious optimisation. It is deliberately
not in v1: it duplicates the sort key across two tables, and the
coalesced editing event mutates `occurred_at` through the day, so every
extension would have to write both rows in step. A personal feed inside
the retention window is hundreds of rows, not millions. Revisit with a
measurement, not a hunch.

### 3.3 `timeline_scope_state`

```sql
CREATE TABLE timeline_scope_state (
  scope_type       TEXT NOT NULL,
  scope_id         TEXT NOT NULL,
  backfilled_at    INTEGER,               -- NULL until the one-shot backfill has run
  last_refreshed_at INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);
```

One row per scope. `backfilled_at` gates the one-shot seeding in §5;
`last_refreshed_at` backs the "Last refreshed …" line and the
stale-read threshold.

### 3.4 What the scope model bought

The join table and the free-text `scope_type` were the forward plan, and
two of the three have since shipped:

- **A per-diagram timeline** (`scope_type = 'diagram'`) — every diagram
  keeps its own history, surfaced from the row menu as **History**. The
  Activity Panel's element diffs stay where they are; this carries the
  _diagram-level_ events spec/12 explicitly lists as out of scope for
  its V1 (rename, share toggle, theme change). Its read gate defers to
  the diagram's OWN gate rather than re-deriving one, which is what lets
  a share-link visitor read the history of a diagram they can open but
  which sits in nobody's `user` scope.
- **A team activity feed** (`scope_type = 'team'`), rendered on the team
  pane. This wasn't only a feature: per-member scopes are written when
  an event happens, so a member who joined in March had nothing from
  February. The team scope carries the whole history and any joined
  member may read it. Per-member scopes are still written — they are
  what makes a personal feed one indexed scan rather than a union across
  every team you belong to.

**A scoped feed must not outlive its scope.** Switching teams is a
query-string navigation on one route, so the pane's children stay mounted
unless keyed — and a `ScopedTimeline` that survives carries the previous
team's category chips, actor filter and parked calendar month into the
next team's feed. Worse, `useTimelineFeed` remembers which periods it has
already fetched on demand (§2.2), keyed on the period alone: with the feed
still mounted, paging to a month visited under team A found it marked
fetched, skipped the request, and rendered an empty grid — reporting that
nothing happened in team B that month. So the team feed is keyed on
`teamId` at its call site (as the team library beside it already was), and
the period cache is cleared whenever the scope or owner changes, which is
exactly when the first-page effect re-runs.

Read authorisation is explicit per scope type with an unrecognised type
**refused**, so a scope added later is inert until somebody writes its
rule. A missing diagram is a 403 rather than a 404, so the endpoint
can't be used to probe ids for existence. A team scope needs a _joined_
membership: an invite grants no access to team content, and a feed is
content.

Still open:

- **Favourites** would be a fourth table keyed by
  `(scope_type, scope_id, event_id)` — per viewing scope, not on the
  membership row, so a future composite read can't bleed one scope's
  stars into another's.
- **Per-entry dismissal** would be a `deleted_at` on the membership
  row, soft so a re-emit doesn't resurrect what the user dismissed.

None of those are built. All of them are additive.

### 3.5 Deletion and retention

- **Deleting a diagram cascades**, matching Manager Toolkit. The delete
  hard-removes every `timeline_events` row with
  `source_type = 'diagram' AND source_id = <id>`; the
  `ON DELETE CASCADE` on `timeline_event_scopes.event_id` takes the
  membership rows with them. A feed that keeps narrating a diagram
  nobody can open any more is noise, and every one of those bubbles
  links to a 404.
  **The tombstone survives**, because the cascade runs _before_ the
  `diagram_deleted` emit, not after. So a deleted diagram collapses
  from a run of bubbles to exactly one — "Diagram Deleted / Payments
  architecture" — which is the row that actually answers "what
  happened to it?". `markTimelineEventsDeletedBySource(env,
sourceType, sourceId)` is the shared helper; any future entity's
  delete path calls it rather than writing the DELETE inline.
- **Deleting an account does.** The existing account-deletion path
  hard-deletes `timeline_event_scopes WHERE scope_id = ?`, then
  `timeline_events WHERE actor_id = ?`, then the scope-state row. The
  `ON DELETE CASCADE` makes the order safe regardless; run them
  explicitly for clarity.
- **Retention is 365 days.** A daily sweep deletes events older than
  that. It joins the existing 03:00 UTC cron that already prunes
  `change_log` at 90 days (spec/12), running immediately after it.
  365 rather than 90 because a timeline's value is partly "when did I
  last touch this" and a year is the natural unit for that question,
  where an element-level audit trail's value decays in weeks.

## 4. Event catalogue

Every event is emitted **inline on the write path** in the api worker.
There are no scanners and no cron-driven scanning: unlike Manager
Toolkit, livediagram has no entities whose state drifts silently, so a
"rescan for what I missed" pass would find nothing. The two exceptions
are the future-dated expiry events (§4.5), which the existing daily
crons already compute.

All emission goes through one module, `apps/api/src/db/timeline.ts`:

```ts
emitTimelineEvent(env, draft: TimelineEventDraft, scopes: TimelineScopeRef[]): Promise<void>
```

Fire-and-forget from the caller's perspective — wrapped in
`ctx.waitUntil` so a timeline write can never slow down or fail a
diagram save. A thrown error is swallowed and counted as an
`Error`/`Api` telemetry event; a missing timeline row is a cosmetic
loss, a failed save is not.

### 4.1 Resolving the audience

One helper decides who sees a diagram event:

```ts
audienceForDiagram(env, diagram): Promise<string[]>   // owner ids
```

- Always the diagram's `owner_id`.
- Plus, when `diagrams.team_id` is set (spec/35), every `team_members`
  row for that team with `status = 'joined'` and a non-null `user_id`.
- The **actor is not excluded**. "You commented on X" is a legitimate
  entry in your own history; the renderer says "You" rather than your
  name, which is what makes it read correctly.

Team events use the analogous `audienceForTeam(env, teamId)`.

### 4.2 Diagram lifecycle and editing

| `eventType`                          | Fires when                            | Title / description                                          |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------ |
| `diagram_created`                    | `POST /api/diagrams`                  | "Diagram Created" / "Payments architecture"                  |
| `diagram_renamed`                    | `PUT` where the name changes          | "Diagram Renamed" / "Payments v1 → Payments architecture"    |
| `diagram_duplicated`                 | duplicate route                       | "Diagram Duplicated" / "Copy of Payments architecture"       |
| `diagram_deleted`                    | `DELETE`                              | "Diagram Deleted" / "Payments architecture"                  |
| `diagram_moved`                      | folder change                         | "Moved to a Folder" / "Payments architecture → Architecture" |
| `diagram_edited`                     | tab save (coalesced)                  | "Diagram Updated" / "You worked on Payments architecture"    |
| `diagram_snapshot`                   | snapshot taken (spec/67)              | "Snapshot Taken" / "Payments architecture"                   |
| `diagram_offline` / `diagram_synced` | Take Offline / Sync Diagram (spec/76) | "Taken Offline" / "Synced to the Cloud"                      |

**The two Offline Mode conversions declare themselves**, because they reuse
ordinary endpoints and are otherwise indistinguishable from them: "Take
offline" is a plain `DELETE /diagrams/:id` (the server copy really does go)
and "Sync diagram" a plain `POST /diagrams`. Undeclared, the worker recorded
`diagram_deleted` and `diagram_created` — so the feed told an owner, in danger
red, that a diagram they had just moved into this browser had been **deleted**,
and that one they had just uploaded was brand **new**. The editor therefore
sends `X-Diagram-Conversion: offline | sync` on the request that performs it,
and the route picks the honest event. Header name, values and the reader live in
`packages/api-schema` beside the event types they select, since it is a
two-sided contract and two copies of a string is how these drift. An
unrecognised value falls back to the truthful default: the header is
client-supplied.

**Only the owner's conversion is honoured**, and that clause is load-bearing
rather than defensive. `diagram_offline` is owner-scoped — an offline diagram
exists in exactly one browser, so no teammate has a stake in it — but the DELETE
is also reachable by any joined member of the diagram's team (spec/35), and the
Explorer offers Take Offline on a team-library row without checking who owns it.
When a teammate does it the diagram lands in **their** browser and leaves the
owner's account for good; from the owner's and the team's side that is a
deletion, not something they can still reach. Honouring it as a conversion there
would write the one and only event to the actor, so the owner and the whole team
would be told _nothing_ while the row and its entire history disappeared from
the library. So a non-owner's DELETE records `diagram_deleted` and fans out to
the team audience, exactly as it did before conversions existed. The source cascade (§3.5) runs either way:
whatever the server held is gone, so its prior events would point at a 404.

**The coalesced editing event** is the one that needs care, because it
is the highest-volume write in the product and a naive emit would bury
everything else even with stacking.

- Emitted from the tab-save path (`upsertTab`), not from
  `change_log` — the log is tab-scoped and 90-day, and reading it back
  to derive a daily rollup would be a join per save.
- `dedupe_key = "<actorId>:<YYYY-MM-DD>"` in UTC. The first save of the
  day inserts; every later save that day hits the `UNIQUE` constraint
  and **updates** `occurred_at` to now and bumps a `saves` counter in
  the snapshot. One row per person per diagram per day.
- Description is actor-relative at render time: "You worked on X" for
  your own, "Priya edited your diagram X" for someone else's. The row
  stores the actor id; the renderer resolves the pronoun.
- This is a deliberate departure from Manager Toolkit's
  **additive-only** refresh rule (existing rows are never mutated
  there). It is safe here precisely because there are no favourites and
  no user edits to preserve — nothing is attached to the row that a
  mutation could invalidate. If favourites ever land (§3.4), this
  event's mutation needs revisiting.

Offline diagrams (spec/76) live only in IndexedDB and never reach the
worker, so they emit nothing. Their absence from the Timeline is
correct and matches the rest of the product's server-side surfaces.

### 4.3 Collaboration

| `eventType`          | Fires when                                                  | Notes                                              |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `comment_added`      | both comment paths                                          | See below                                          |
| `comment_resolved`   | thread flips to `resolved` on tab save                      | Diffed the same way                                |
| `action_assigned`    | an `ElementAction` appears on save, or via `/notify-action` | Audience is the assignee plus the diagram audience |
| `action_completed`   | an action's `status` flips to `done`                        |                                                    |
| `share_link_created` | share link minted                                           | Audience is the owner only                         |

**Comments have two write paths and both must emit.** Comments live
inside element JSON on the tab (`packages/diagram/src/comments.ts`),
not in a table — there is no comments table to hang a trigger off. The
worker already has to reason about which comments are _new_ on every
save, in `apps/api/src/comments.ts`:

- `POST /api/diagrams/:id/tabs/:tabId/comments` — the explicit path a
  view-role visitor uses. Emit directly; the comment object is right
  there.
- The ordinary tab `PUT`, where `rewriteCommentAuthors` already
  compares incoming comments against the previous tab's by id in order
  to stamp server-trusted authorship. The same diff yields the new
  comments. `hasNewComments` is already exported from that module.

The comment **text** goes in the description, truncated to 240
characters with an ellipsis. A comment feed you can't read the comment
in is a notification list, not a timeline. This is the same trust
boundary as the diagram's own content: everyone in the audience already
has read access to that thread. (Note that this is _narrower_ than the
email notification in spec/64 #1, which deliberately never includes
comment text — an email leaves the product's authorisation boundary
and can sit in an inbox forever; the Timeline is behind the same auth
as the diagram itself.)

Assigned actions (spec/68) are likewise element-JSON, diffed on save
the same way. `apps/api/src/routes/team-action-routes.ts`'s
`notify-action` endpoint is the cleaner hook where the client already
calls it.

### 4.4 Teams and invites

| `eventType`            | Fires when                                    | Audience                                   |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| `team_created`         | `POST /api/teams`                             | Creator                                    |
| `team_invite_received` | admin invites an address                      | The invitee, once their id is known        |
| `team_invite_accepted` | `.../accept`                                  | The team                                   |
| `team_invite_declined` | invite row deleted by invitee                 | Team admins                                |
| `team_member_joined`   | accept, or invite-link join                   | The team                                   |
| `team_member_left`     | member deletes own row                        | The team                                   |
| `team_member_removed`  | admin removes someone                         | The team, and the removed person           |
| `team_role_changed`    | `PUT .../members/:id`                         | The team                                   |
| `team_diagram_added`   | diagram published to a team library (spec/35) | The team                                   |
| `team_diagram_removed` | diagram pulled back out of a team library     | The team it left, resolved BEFORE the move |

**`team_invite_received` has an ordering problem worth naming.** An
invite is created against an _email address_; the invitee's owner id is
unknown until they sign in and the lazy email-claim step connects the
row (spec/32). So there is nobody to scope the event to at emit time.
Resolution: emit the event with **no `user` scope**, and attach the
scope in the same lazy-claim step that fills in `user_id`, using the
invite's original `created_at` as `occurred_at`. The invite then
appears on the new member's Timeline dated when it was actually sent.

Teams are Clerk-only, so none of these events ever reach a guest scope.

### 4.5 Account and housekeeping

| `eventType`           | Fires when                             | Notes                                                  |
| --------------------- | -------------------------------------- | ------------------------------------------------------ |
| `token_created`       | `POST /api/tokens` (spec/61)           |                                                        |
| `token_expiring`      | the existing daily expiry-warning cron | **Future-dated**: `occurred_at` is the expiry, not now |
| `share_link_expiring` | the share-expiry cron (spec/34)        | Future-dated                                           |
| `theme_saved`         | custom theme created (spec/44)         |                                                        |
| `image_uploaded`      | image upload (spec/19)                 | Coalesced per day like editing                         |

**A warning that stops being true is withdrawn, not corrected.** The two
future-dated rows above are the only events the feed states before they
happen, which makes them the only ones the owner can act on to stop them
happening. Revoking a token, revoking a share link, or extending a link's
deadline all leave a standing warning quoting a date that will never
arrive: the feed counted down to a token expiry sitting directly above its
own past-tense "API Token Revoked" row, which reads as the product not
knowing what the owner just did. So each of those four routes retracts the
matching warning — `retractTimelineWarning(sourceType, sourceId, eventType)`.

Three constraints shaped it:

- **Retract, don't re-date.** `emitTimelineEvent` resolves a conflict with
  `occurred_at = MAX(old, new)`, so a corrected deadline could only ever
  move a warning later, never nearer and never away. And an extended link
  may fall outside the sweep's window entirely, where the right answer is
  no warning rather than a different one.
- **Keyed on `eventType`, not just the source.** `token_expiring` and
  `token_created` share a source id, and the existing
  `markTimelineEventsDeletedBySource` cascade matches on source alone.
  Erasing the record that a token was ever created, in order to withdraw a
  warning about it, would be a worse lie than the warning.
- **Self-healing rather than exhaustive.** `share_link_expiring` is keyed
  on the diagram, one warning however many links are expiring, so revoking
  one of two retracts a warning the other still justifies. The daily sweep
  re-emits whatever is still inside its window, so the cost is at most a
  day of silence — strictly better than a deadline the owner has already
  dealt with standing indefinitely.

**"Opened by a visitor" hangs off the TAB read, not the diagram GET.**
The diagram endpoint is hit by link previews and polling; fetching tab
content means a person is actually looking at the canvas. It is also the
one event a stranger can trigger at will, so it coalesces per visitor
per day — otherwise anyone holding a link could flood an owner's feed by
refreshing.

**A "visitor" is somebody who presented a SHARE CODE**, not merely somebody
who isn't the owner. That distinction is the whole meaning of both
visitor-facing events, and keying them on `owner !== ownerId` got it wrong:
the read gate also admits every joined member of the diagram's team
(spec/35), and a teammate presents no code. So browsing your own team's
library told the diagram's owner _"opened by a visitor · Someone with the
share link"_, under the **sharing** filter, for a diagram they had never
shared a link for — once per teammate per day, so a twelve-person library
could put eleven false bubbles a day on one diagram. Duplicating a
team-library diagram reported _"copied by a visitor"_, which is simply
untrue. Both now require a share code to have been presented. The
teammate's own `diagram_duplicated` event is unaffected: they really did
copy it.

**Leaving a team library is its own event, and its audience is resolved
before the move.** Publishing into a team and pulling back out of one are not
one event with a direction: the out case takes the diagram away from everybody
else, and when the mover isn't the owner spec/35 hands them ownership, so the
previous owner loses it too. It used to fall through to `diagram_moved` and
read "Moved to a Folder → Unsorted" — in the **mover's** feed only, because
`recordDiagramMoved` resolves its audience from the diagram and by then the
diagram is personal. A diagram could leave a shared library and change hands
with nothing in the team's feed or the old owner's. And since a diagram at the
library root already has `folderId === null`, moving it to personal Unsorted
changed no folder, so that arm didn't fire either and **no event was written at
all**. `team_diagram_removed` now covers it, carrying the new owner's name for
the readers who no longer have the diagram, and the audience is read from the
outgoing team before `setDiagramFolder` — the same ordering, for the same
reason, as the delete tombstone.

**Invite-link toggles go to admins only.** Whether a join credential is
live is an administrative fact, and telling every member one exists is a
nudge to go and find it.

**Anything whose row is about to vanish reads its name first** and omits
the id from the snapshot, so a folder / theme / team tombstone can't
link at something that no longer exists — the same structural guard the
diagram tombstone uses.

Future-dated events are why the day rail renders future groups above
Today with a distinct tint. They are the feed's only forward-looking
content and they are the reason a user opens it before something
breaks rather than after.

## 5. Backfill

A brand-new Timeline that is empty for an existing user with 60
diagrams is a broken-looking feature. On the first read of a scope
(`timeline_scope_state.backfilled_at IS NULL`), the worker seeds it:

- For the caller's 200 most recently updated diagrams: a
  `diagram_created` event at `diagrams.created_at`, and a
  `diagram_edited` event at `updated_at` with the matching
  `<actorId>:<date>` dedupe key.
- For each team the caller has joined: a `team_member_joined` event at
  their `team_members.created_at`.
- Nothing else. Comments and actions are inside tab JSON and
  backfilling them would mean parsing every tab of every diagram in a
  request — a cost with no ceiling. The feed's older reaches are
  thinner than its recent ones; that is the honest trade and it is
  invisible within a week of use.

The backfill is idempotent by construction (every insert hits the
`UNIQUE` key), runs inside `ctx.waitUntil` after the response is
served, and stamps `backfilled_at` so it never runs twice. The 200 cap
is logged rather than silent — a user with 400 diagrams should not be
told their history starts in March when it doesn't.

## 6. API

One route module, `apps/api/src/routes/timeline.ts`, dispatched from
`src/index.ts`.

### 6.1 `GET /api/timeline`

Query params:

- `scope` — `<scopeType>:<scopeId>`. Optional; defaults to
  `user:<caller>`. Present in v1 only so the forward-compatible shape
  is fixed from the start.
- `from`, `to` — epoch ms bounds on `occurred_at`. The calendar view
  passes the visible month.
- `sourceType` — repeatable; narrows to those source types.
- `limit` — default 50, max 200.
- `cursor` — `<occurredAt>:<eventId>`, so the tiebreak is stable when
  several events share a millisecond.

Response:

```json
{
  "items": [
    {
      "id": "...",
      "sourceType": "diagram",
      "sourceId": "...",
      "eventType": "comment_added",
      "title": "Comment Added",
      "description": "Priya on Payments architecture",
      "occurredAt": 1754380800000,
      "actorId": "user_...",
      "snapshot": { "diagramName": "Payments architecture", "text": "Should the retry budget…" }
    }
  ],
  "nextCursor": "1754380800000:abc",
  "lastRefreshedAt": 1754384400000
}
```

**Authorisation.** A caller may only read a `user` scope whose
`scopeId` is their own resolved owner id — the Clerk `sub` for a signed
-in caller, the signed guest participant id otherwise. Any other scope
is `403`. This is the only gate the endpoint needs in v1, and it is
worth stating plainly because the scope parameter looks like it invites
more.

### 6.2 `POST /api/timeline/refresh`

Stamps `last_refreshed_at`, runs the backfill if it hasn't run, and
returns `{ lastRefreshedAt }`. Throttled to one call per scope per 5
seconds server-side to absorb spam-clicks on the Refresh button.

There is no `POST`/`PATCH`/`DELETE` for events. Nothing user-authored
lives on this feed.

### 6.3 Stale-read refresh

`GET /api/timeline` triggers the backfill (and only the backfill) when
`backfilled_at` is null. It does **not** rescan anything else — there
is nothing to rescan, since all emission is inline. The 30-second
stale threshold Manager Toolkit uses exists to amortise scanner cost;
here it has nothing to amortise. The Refresh button re-reads, and that
is the whole story.

### 6.4 Wire types

`TimelineEvent`, `TimelineScopeRef`, `TimelineReadResult`, and
`TIMELINE_PAGE_SIZE` / `TIMELINE_PAGE_MAX` go in
`@livediagram/api-schema` alongside `ChangeLogEntry`, per the existing
convention that every DTO the worker emits and the editor consumes
lives there.

Client wrappers go in `apps/live/lib/api/timeline.ts` and are
re-exported from the `lib/api-client.ts` barrel, matching every other
domain. **Offline mode is a no-op here**: `isOfflineId` doesn't apply
(the scope is an owner, not a diagram), and an offline-only browser has
no server events. `apiListTimeline` returns an empty page when the
fetch fails rather than throwing, so a worker outage degrades the
landing page to an empty feed instead of an error screen — the same
posture the Explorer's diagram list already takes.

## 7. UI packaging

Per the reuse principle, the generic pieces go in
**`packages/ui/src/timeline/`** and know nothing about livediagram's
domain:

```
Timeline.tsx             the feed: grouping, rail, stacks. No header.
TimelineControls.tsx     mode switch + filter trigger, for the host's header
useTimelineControls.ts   the state both halves share, + derived filtering
TimelineGroup.tsx        one day: dot, line, date label, Today pill
TimelineBubble.tsx       icon / content / preview / action strip
StackedBubble.tsx        the collapsed run with its faux-card layers
ExpandedStack.tsx        the open run plus its "Collapse N events" footer
TimelineCalendarView.tsx month grid, per-tone dots, day popover
TimelineFilterPopover.tsx chips + mini calendar, portalled
useTimelineGrouping.ts   group-by-day (pure, exported for reuse)
stacking.ts              bucket + alias rules (pure)
eventTone.ts             event type -> tone, and the tone colour vars
monthCells.ts            month-grid arithmetic (pure)
sourceTypeMeta.ts        chip label + fallback glyph per source type
types.ts                 TimelineEvent, renderer contracts
```

The **renderers** — the functions that turn a `TimelineEvent` into a
bubble, and that know a diagram event links to `/diagram/<id>` and a
team event to `/explorer/team?id=<id>` — live in
**`apps/live/app/explorer/timeline/renderers.tsx`**, keyed by
`sourceType`. The package takes a registry prop; it never imports a
route.

This split is what lets a per-diagram timeline (§3.4) or the editor's
Activity Panel adopt the same components later without either one
inheriting Explorer-specific copy.

**Colour.** Each tone gets a CSS variable pair
(`--ld-timeline-<tone>` and `--ld-timeline-<tone>-soft`) defined in the
live app's `globals.css` with **both light and dark values** —
livediagram has a class-based dark mode (spec/07), unlike Manager
Toolkit which is dark-only, so every tint needs two, and dark mode
lifts the bold value (a 600-weight hue goes muddy on slate-900) while
dropping the soft one (an alpha tint over a dark surface reads far
stronger than the same alpha over white). `eventTone` reads the var
with a fallback baked into the package, so the components render
standalone.

**Animation.** A bubble fades in on the first mount of its event id
only — the component keeps a `Set` of seen ids. Without that, every
existing bubble re-animates on each refresh, which reads as the whole
feed vanishing and coming back.

## 8. Explorer integration

### 8.1 Timeline becomes the landing view

The default lands in three places, all of which must change together
(they exist because a static export has no single entry point):

1. `apps/live/src/worker.ts` — the `/explorer` → `/explorer/recent`
   302 becomes `/explorer/timeline`.
2. `apps/live/app/explorer/page.tsx` — the client `router.replace`
   fallback for the dev server and direct asset hits.
3. `apps/live/app/explorer/routes.ts` — `selectedFromRoute`'s
   `default:` case, which catches mangled URLs and id-less
   `folder`/`team` links, returns `{ kind: 'timeline' }`.

**Recent is not removed.** It keeps its route, its sidebar row, and its
badge. It answers a different question ("what did I touch last") and
answers it better than a feed does.

### 8.2 Sidebar

Quick find gains Timeline at the top and **Favourites moves into it**:

```
Quick find
  ⏱  Timeline          ← new, and the landing view
  🕐  Recent
  ★  Favourites        ← moved up from My Work › Dynamic
  ↗  Shared with you

My Work
  ⊞  Dynamic
     ▫ Unsorted
     ✨ Generated
     ⬒  Offline
  … root folders
```

Favourites is a user's own curated shortlist, not a synthetic view of
where a diagram happens to sit, so it belongs beside Recent rather than
buried a level down among Unsorted / Generated / Offline. The Dynamic
parent's badge stops adding `favouriteCount` when it does.

Timeline **does** carry an unread badge. This section deferred it ("an
unread count needs a per-user last-seen marker, which is a preference
write on every visit"), and the objection turned out not to hold: the
marker is `timeline_scope_state.last_seen_at`, a row the read already
touches, so it costs no extra write — and without it the feed could not
answer the question it exists for, since new and old looked identical.
The badge counts only OTHER people's events (a number that rises because
you renamed something is noise) and reads from its own cheap endpoint
rather than a field on the feed, because it renders on every Explorer
section and must not drag a feed nobody is looking at.

### 8.3 The section checklist

Adding the section touches the same files every Explorer section does:
`views.tsx` (the `SelectedNode` union), `routes.ts` (both directions),
`apps/live/app/explorer/timeline/page.tsx` (the route stub),
`ExplorerSidebar.tsx`,
`icons.tsx`, `useExplorerPane.ts` (pane content, title, crumbs),
`ExplorerPane.tsx` (dispatch — Timeline is not a `BROWSE_KIND`),
`ExplorerEmptyState.tsx`, and `routes.test.ts`'s `STATIC_NODES`.

The pane is lazy-loaded like `ProfilePane` / `TeamPane`, so the
calendar grid and mini-calendar chunk stays off the critical path for
users who never switch modes.

## 9. Guests

Guests get the Timeline, keyed to their signed participant id
(spec/04). They see diagram lifecycle, editing, comments on their own
diagrams, and share-link events. Team, invite, and token events never
reach them because those features are Clerk-only — the feed is simply
thinner, with no sign-in wall and no empty-section prompt.

**On sign-up, timeline history migrates.** `POST /api/migrate` already
moves diagrams from the guest participant id to the Clerk user id; it
gains two statements in the same transaction:

```sql
UPDATE timeline_event_scopes SET scope_id = ?1 WHERE scope_type = 'user' AND scope_id = ?2;
UPDATE timeline_events       SET actor_id = ?1 WHERE actor_id = ?2;
```

Plus a move of the `timeline_scope_state` row, so the backfill doesn't
re-run against the new id and duplicate what already migrated. A user
who drew for a week as a guest keeps that week when they sign up —
which is the point of the guest path existing at all.

## 10. Telemetry

New category `Timeline` in the closed enum in
`@livediagram/api-schema` (spec/22). Existing actions cover it:

- `Timeline`/`Opened` — the section is viewed. `type` is `Landing` when
  it was the default landing view, `Nav` when reached from the sidebar,
  so the landing-page change is measurable.
- `Timeline`/`Changed` with `type` `List` | `Calendar` — mode switch.
- `Timeline`/`Selected` with `type` the source type — a filter chip
  toggled.
- `Timeline`/`Opened` with `type` `Stack` — a stacked run expanded.
  Tells us whether stacking thresholds are right.
- `Timeline`/`Loaded` with `type` `More` — Show more.

No event ever carries a diagram name, team name, or comment text; the
`type` slot is a fixed token, bounded by the existing
`TELEMETRY_TYPE_PATTERN`.

## 11. Testing

Per spec/18:

- **Pure units, tested directly**: `stacking.ts` (bucketing, aliasing,
  never-stack rules, position-of-most-recent), `useTimelineGrouping`
  (day grouping, out-of-order tolerance), `monthCells` (Monday-first
  padding, leap years, empty-month skipping), and `eventTone` (every
  emitted event type maps to a tone, and an unknown one falls to
  neutral rather than to danger).
- **Worker route tests** alongside `teams.test.ts`: scope
  authorisation (a caller cannot read another owner's scope),
  pagination and cursor stability, filter params, and the
  `UNIQUE`-constraint idempotence of `emitTimelineEvent` — emit the
  same draft twice, assert one row.
- **Audience resolution**: a comment on a team diagram fans out to
  every joined member and to nobody who is merely `invited`.
- **Coalescing**: three saves in one UTC day produce one row whose
  `occurred_at` advances; a save the next day produces a second row.
- **Migration**: guest → Clerk id moves scopes, events, and scope
  state, and the backfill does not re-run afterwards.
- **Round-trip**: `/explorer/timeline` added to `STATIC_NODES` in
  `routes.test.ts`.

## 12. Docs

- A help-centre article under the Explorer / organising category
  (spec/55), with its registry entry in
  `packages/help-registry/src/index.ts` — slug, title, short
  description, and keywords including "feed", "activity", "history",
  "what's new", "calendar", "notifications" — plus a bump to that
  category's `articleCount`. Per the repo rule, an unregistered article
  is invisible to both the help search and the editor's search panel,
  so it ships in the same change as the page.
- `README.md` and `docs/architecture.md` gain the new tables and the
  `/api/timeline` route in their existing lists.

## 13. Out of scope for v1

- Favourites / starring, per-entry dismissal, manual entries.
- An unread badge on the sidebar row.
- Per-diagram and per-team timeline scopes (the schema is ready; the
  renderers, routes, and UI are not).
- AI day summaries.
- Realtime push. A Refresh button and a fresh read on mount.
- Cross-user search over the feed.
- Backfilling comments and actions out of historical tab JSON.
