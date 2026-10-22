# Timeline events

The **timeline events** are the record of everything that has happened
across the user's documents, teams, and account. Nobody opens the record
as a page of its own; three surfaces read it:

- **Explorer Home** ([Explorer Home](explorer-home.md)): What Happened (other
  people's doings), Jump Back In's use counts, and the Home row's unread
  badge (§2.5).
- **A document's History**, a dialog from a row's menu (§3.4).
- **A team's Team Activity**, a card on the team page (§3.4).

History and Team Activity draw the record as a **feed**: grouped by day as
a grid of cards, stacked when a day gets busy, and switchable into a
calendar month grid (§2). The code still calls the feed "the Timeline"
(`<Timeline>`, `useTimelineFeed`, `/api/timeline`).

**The Explorer's Timeline section is removed** (2026-10-22). It was a
personal feed of everything, the reader's own doings included, at
`/explorer/timeline` with a sidebar row under the Inbox, reached from Home's
**See Timeline** link, with card menus, Remove from Timeline, deep links and
New pills of its own. Home answers "what happened while I was away", and
History and Team Activity keep the whole record of a document or a team, so
the section only repeated them. The record stays because those three read
it. What went with the section: §2.7, §2.8, §2.9, §5, §6.2, §6.2a, §6.3 and
the personal read of §6.1. The existing D1 migrations that made its tables
and columns stay in place.

Modelled on the Timeline subsystem in the Manager Toolkit monorepo
(`specs/dashboard/timeline/spec.md` + `packages/ui/src/timeline/*` there),
adapted to liveplanner's data model and its light/dark UI.

## Why

Today the Explorer opens on **Recent**, a list of document rows ordered
by `updated_at`. It answers exactly one question — "what did I touch
last?" — and it is the only answer the Explorer gives. Everything else
that happens to a user is invisible until they go looking for it:

- Someone commented on a document you own. You find out by email ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)
  #1), or you don't.
- Someone assigned you an action ([Assigned actions](../012-collaboration/assigned-actions.md)). Same.
- A team invite arrived. It sits behind a badge in a sidebar section
  most users never expand.
- A teammate joined, left, or was promoted. Nothing tells you.
- An API token is about to expire ([Public API and API tokens](../015-api/public-api-and-tokens.md)). One email, seven days out.

Each of those already exists as a write somewhere in the api worker, and
each was a dead end. The record collects them, so the first thing a user
sees on opening the Explorer, Home, says **what has happened since they
were last here**, not just a list of files.

## Non-goals

- **Not an element-level audit log.** The feed never renders an
  element diff and never offers Revert. Document editing appears here as
  one coalesced "worked on" event per person per document per day (§4.2).
  (The editor's per-tab Activity panel, which did keep element diffs with
  per-entry revert, was removed on 2026-10-03.)
- **Not realtime.** No Durable Object fan-out, no per-user socket. The
  feed is read on load, on return to the tab and after the reader's own
  writes (§2.4a, §2.4b). liveplanner's realtime rooms are per-document; a per-user
  channel is a whole new object type for a screen the user looks at
  once a session.
- **No favourites / starring.** The Manager Toolkit timeline has them
  (they matter when a timeline is evidence for a performance review).
  Here the feed is ambient — you read it and move on — so the table and
  the endpoints aren't earned yet. The schema doesn't preclude them
  (§3.4). Per-entry removal, which started out in this bullet,
  shipped (§2.9) and went with the Explorer's Timeline section.
- **No AI day summary.** Manager Toolkit gates one behind Pro;
  liveplanner has no paid tier ([Business model + licence](../002-project-scope/business-model-and-licence.md)), so it would be free for
  everyone and gated only on the model key. Deferred as its own
  decision rather than smuggled in with this one.
- **No manual entries.** Every event is emitted by the system from a
  real write. There is no "add a note to your timeline".

## 1. Concepts

Three nouns, lifted from Manager Toolkit because the shape has already
been proven there.

### Event

One thing that happened. Carries:

- `sourceType` + `sourceId` — the domain object it is about
  (`document` + the document id, `team` + the team id). Synthesised for
  events with no single object (`account` + the owner id).
- `eventType` — what happened (`document_created`, `comment_added`,
  `team_member_joined`). Distinct from `sourceType`: one document
  produces many event types over its life.
- `title` / `description` — first-class columns, not snapshot fields.
  Every event has a title; they are the universal backbone and the
  thing a future search would index.
- `occurredAt` — the sort key.
- `snapshot` — JSON extras the renderer needs (the document's thumbnail
  key, the commenter's colour, the team's member count) captured at
  emit time so rendering the feed never fans out into other tables.
- `actorId` — who did it, as an owner id (account `sub` or guest
  participant id). `NULL` for system events like a token expiry
  warning. An owner id is a credential, so a `document:` scope (which a
  share-link visitor can read) returns only the reader's own id; every
  other actor goes out as `NULL` and renders by its snapshot name.

### Scope

**Who should see this event.** A scope is a `(scopeType, scopeId)` pair.

Three scope types: `user`, where `scopeId` is an owner id (Home's unread
count reads `user:<caller>`), and `document` and `team` (§3.4), which the
History and Team Activity feeds read.

`scopeType` is a free-text column with no CHECK constraint, so a later
per-document timeline (`document:<id>`) or a team activity feed (`team:<id>`) is a new
scope value plus a renderer — no migration, no change to the read path.
That is the whole reason for the join table below; see §3.4.

### Membership

One event, many scopes. A comment on a document that lives in a team
library reaches the document's owner **and** every joined member of that
team — one event row, N membership rows. Without the join table the
event would have to be duplicated per recipient, and a team of twelve
would multiply every comment by twelve.

## 2. What the user sees

The feed, as a document's History dialog and a team's Team Activity card
draw it (`ScopedTimeline` in `apps/live/components/panels/ScopedTimeline.tsx`),
each with its own header row holding the controls (§2.3).

```
┌──────────────────────────────────────────────────────────────────────┐
│ History                               [≡ Cards|▦ Calendar] [⧩ Filter] │
├──────────────────────────────────────────────────────────────────────┤
│  ●  ┃  [Today]  Tue, 5 Aug   2026                                    │
│  │  ┃  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  ┃  │              │ │              │ │   ╔═══╗      │            │
│  │  ┃  │  (snapshot)  │ │  (snapshot)  │ │   ║ ✎ ║ ▒▒   │  (stack)   │
│  │  ┃  │              │ │              │ │   ╚═══╝      │            │
│  │  ┃  ├──────────────┤ ├──────────────┤ ├──────────────┤            │
│  │  ┃  │ Payments     │ │ Onboarding   │ │ Documents    │            │
│  │  ┃  │ 🗑 Document   │ │ 💬 Comment    │ │ Renamed      │            │
│  │  ┃  │   Deleted    │ │   Added      │ │ 3 events ·   │            │
│  │  ┃  │ 09:12        │ │ 10:40 · Priya│ │ click to open│            │
│  │  ┃  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ●  ┃  Mon, 4 Aug                                                    │
│  │  ┃  ┌──────────────┐                                              │
│  │  ┃  │    ╔═══╗     │                                              │
│  │  ┃  │    ║ 👥 ║     │  (no snapshot: the glyph on the tone tint)   │
│  │  ┃  │    ╚═══╝     │                                              │
│  │  ┃  ├──────────────┤                                              │
│  │  ┃  │ Platform Guild                                              │
│  │  ┃  │ 👥 Joined a Team                                            │
│  │  ┃  │ 16:03                                                       │
│  │  ┃  └──────────────┘                                              │
└──────────────────────────────────────────────────────────────────────┘
```

**Day rail.** A dot and a connecting line down the left, one group per
calendar day in the reader's local timezone (`dateKey`), newest first. Today's dot is brand-500 with a soft
ring and its label carries a **Today** pill. Days in the future (a share
link expiring, a token expiring) sit above Today with a violet-tinted
dot and rail.

**Cards, in a grid.** Each day's events render as **cards laid out in
the same responsive grid the Explorer's Recent card view uses** (one
column on a phone, two from `sm:`, three from `lg:`), not as one
full-width row per event. The row layout this replaced put a 44px
thumbnail at the far right of a line of text, which made a document
event unrecognisable at a glance and a day of six events a wall of
near-identical lines. A card leads with the picture, so a day reads the
way Recent does: you recognise the document before you read a word.

A card has four regions, top to bottom:

1. **Preview.** A fixed-height letterbox (the same `h-48` as a Recent
   card, so the two grids look like one product). A document event shows
   the document's cached SVG snapshot ([Document SVG snapshots](../006-document/document-snapshots.md)), reusing the Explorer's
   `DocumentThumbnail` and inheriting its lazy intersection-observer
   fetch, so a feed of fifty cards doesn't trigger fifty server renders
   for documents nobody scrolls to. An event with **no picture** (a team,
   a folder, a token, a theme, a comment on a deleted document) fills the
   same box with the event's **glyph, large, on the event's tone tint**.
   The box is the same height either way, so a row of cards stays
   aligned whatever mix of kinds it holds; a shorter card for pictureless
   events was considered and rejected for exactly that reason.
2. **Title row.** The **subject** of the event (the document's name, the
   team's name, the token's name) as the card title. The title is the
   thing the reader scans for, and it sits in the same place on every
   card. (`<Timeline>` still takes an optional `cardSlots` hook for a
   menu in this row; no feed passes one since §2.8 went.)
3. **Reason line.** The event's glyph in its tone colour, then the
   **reason the card is on the timeline** in Title Case: "Document
   Created", "Document Updated", "Comment Added", "Member Joined". This
   is the stored event `title` verbatim (§4), which is Title Case by
   contract, so a card never says "created" while the stack beside it
   says "Documents Created". Then the time, and any quiet meta the
   renderer adds ("by Priya", "Now: New name", the commenter's words).
4. **Description**, when the renderer wants one (a comment's text).

**A card is one big click target.** Clicking anywhere on it that isn't
the menu opens whatever the event is about: the document, the team, your
invites, your tokens. Cards that lead nowhere are dimmed to 60%, and the
common case is a tombstone for a folder, theme or team: the emit
deliberately omits its id, so the renderer has nothing to link and the
dimming is structural rather than a rule someone has to remember. (A
deleted document has no tombstone at all; see §3.5.) For the keyboard and a screen reader the target is one real
button stretched across the card, named by its subject and reason ("Payments, Document Created"); the card itself is
no button, and anything a host slots into the title row sits above that button as a control of its own, never nested
in it.

### Colour means what happened, not where

The card's tint keys on the **event type**, not the source type.
A reader scanning a busy day asks "is any of this alarming?" long
before they ask "was that a document or a team", and only the first
question has a useful colour answer. Three tones, deliberately few —
a palette with six meanings is a legend the reader has to learn:

| Tone         | Colour | Covers                                                                                                                                                                                                                                                                         |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `danger`     | red    | Destruction and lost access: a team deleted, a member removed, a token revoked. Kept tight — if everything worrying is red, nothing is. Note `team_member_left` is _not_ here: leaving is a departure the person chose, and colouring it like being removed misreads the room. |
| `structural` | amber  | The shape of things changed. Nothing was lost, but something a reader might rely on moved: renames, folder and team placement, membership, roles, sharing, and the forward-dated expiry warnings.                                                                              |
| `create`     | green  | Things made, edited, said or finished — the ordinary business of using the product, and the bulk of any active day.                                                                                                                                                            |

Anything unmapped falls to a neutral slate rather than guessing, so an
event type from a newer worker reads as plain rather than as a
deletion. Every card of the same tone gets the _same_ tint — no
alternating stripe, which reads as "different kinds" and is the
opposite of what the colour is doing. The rules live in
`packages/ui/src/timeline/eventTone.ts`; the palette is a product
decision and lives in the live app's `globals.css`, light and dark.

**Classification is enforced by the compiler, not by a list.** That
neutral fallback is right for an event type this build has never heard
of and wrong for one it ships: an unclassified event renders in a colour
that says the wrong thing about what happened. So
`TIMELINE_EVENT_TYPES` in `@liveplanner/api-schema` is a runtime array,
`KnownTimelineEventType` derives from it, and both the tone map and the
filter-category map are `Record<KnownTimelineEventType, …>` — adding an
event type fails the build until it has a tone and a chip.
`TimelineEventType` stays open (`| (string & {})`) for the wire, which
is precisely why the closed array has to exist alongside it. Before
this, both maps were keyed on loose strings and the only net was a
hand-copied list of all 38 types inside `eventTone.test.ts` — a copy of
the union, in another package, which can only prove that the copy agrees
with itself. [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) records the same lesson from the palette telemetry
tokens, where the copy had silently drifted. The tests kept the half a
compiler can't check: that no known type was classified `neutral` or
`other` by hand, which is the other way to leave an event unclassified.

**A card that can't be clicked is dimmed.** A row that looks
identical to a clickable one but ignores the click reads as broken;
60% opacity answers the question before the pointer gets there. The
common case is a folder / theme / team tombstone — the emit deliberately
omits the deleted thing's id, so the renderer has nothing to link and
the dimming is structural rather than a rule someone has to remember.

**Copy rules.** A card separates the **subject** from the **reason**,
and each has one home:

- The **title is the subject**: the document, the team, the token, the
  folder. Never "Folder Deleted" as a title with the name underneath,
  and never a sentence. The subject is what the reader scans for, and
  the picture above it already says what kind of thing it is.
- The **reason line is the stored `title`**, which is a generic **Title
  Case** category by contract ("Comment Added", "Member Joined", "Taken
  Offline"). Every card and every collapsed stack draws its wording from
  the same field, so the feed can't drift into a mix of "created" and
  "Created" the way the sentence-per-row layout had. A renderer may
  override the reason only with another Title Case phrase.
- **People go in the meta**, not the title: "by Priya", "Priya joined",
  "Now: Payments v2". The reader chose to look at a document's card; who
  did it is the second thing they want, not the first.
- A comment's words go in the **description** (§4.3), the one place a
  card carries free text.
- "You" wins over a name whenever the actor is the reader, decided at
  render time against `viewerId` so one stored row serves the whole
  audience.

### 2.1 Stacking

When a day picks up volume the feed must not become a wall. Within one
day-group, events sharing a `(sourceType, eventType)` bucket collapse
into a single **stack card** reading **"N events · click to expand"**,
rendered with one or two faux-card layers stepping out behind it so the
pile reads as depth. It takes one cell of the day's grid, like any other
card; its preview box carries the kind's glyph and the count rather than
one member's thumbnail, because one document's snapshot can't speak for a
run spanning five. Clicking expands the run **in place**: the stack card
stays in its cell as the head of the run, reading **"N events · click
to collapse"** with its layers gone and a ring on it, and the member
cards take the cells after it.

- Grouping is **by bucket, not by adjacency**: four team-member events
  split by an unrelated card still collapse into one stack of four.
  The user reads a day by _kind of activity_, not by chronological run.
- The stack lands at the position of its **most recent** member, since
  entries arrive newest-first.
- Related event types alias onto one bucket so an add and a remove on
  the same day read as one moment: `team_member_joined` +
  `team_member_left` → "Members Changed"; `share_link_created` +
  `share_link_expired` → "Sharing Changed".
- **Never stacked**: `comment_added` on a thread you are in,
  `team_invite_received`, and any event whose description carries
  content that only makes sense individually. A collapsed comment hides
  the thing you wanted to read; a collapsed invite hides a question.
- A stack of one is just a card; the faux layers only render at 2+,
  and the second layer only at 3+.
- **Expanding and collapsing are the same control, in the same
  place.** The collapsed card is the click target that opened the run,
  so that card is what closes it: it stays put at the head of the run
  and its reason line flips to "click to collapse". An earlier version
  removed the stack card on expand and put a "Collapse N events" footer
  under the run instead; a footer is a second control the reader has to
  find, and once the run is open nothing else said it had ever been a
  stack. Keeping the head card keeps the run legible as a run.

The rules live in `packages/ui/src/timeline/stacking.ts` as pure
functions over the entry list, tested directly.

### 2.1a Created and updated on the same day

A document made this morning and worked on this afternoon produces two
events: `document_created` at 07:22 and the coalesced `document_edited`
whose `occurred_at` walks forward through the day (§4.2). Shown side by
side under Today they are the same card twice, "Created" and "Updated"
with the same thumbnail, and the second one tells the reader nothing the
first didn't: of course a new document was edited on the day it was made.

So **the feed hides a document's `document_edited` event on any local day
that also holds its `document_created` event.** The rule:

- Keyed on the document (`snapshot.documentId`) and the reader's local
  `dateKey`, the same boundary the day groups use, so the two cards it
  is collapsing are exactly the two that would have sat together.
- Applied **client-side, in `useTimelineControls`, to `visibleEvents`**,
  so the list, the calendar's dots, and the mini-calendar's marked days
  all agree. The stored rows are untouched: the edit event is still
  real, still counts for the sidebar's unread badge if a teammate made
  it, and still reaches a per-document History feed on a later day. Only
  the reading of "this day" is de-duplicated.
- The created card keeps its own time. It doesn't borrow the edit's
  later timestamp: the card says when the document was made, and "then
  edited until 16:40" is the kind of detail the sentence-per-row layout
  tried to carry and nobody read.
- Only the create/edit pair. A share, or a comment on the day of
  creation, is new information and stays.

Pure, in `packages/ui/src/timeline/sameDayCreate.ts`, tested directly.

### 2.2 Calendar mode

A segmented control in the header switches **Cards** / **Calendar**,
each wearing its own glyph so the pair reads without parsing the labels.
The first mode is `list` in code and in the `Changed` telemetry token
(it names the data shape, and the token predates the cards), but the
button says **Cards**, because that is what the reader is looking at.

There is no Week mode. There was one, the same grid over seven days with
taller cells, and it went in the card redesign: it showed nothing the
month grid's dots didn't, at a page-per-week cost the month grid doesn't
charge, and a third mode is a third thing to explain on a header that
also carries Filter, Help and New Document. The month grid's day popover
already answers "what happened on Wednesday".

**Calendar** renders a month grid. Each day cell carries one
coloured dot **per tone** present that day, with a count above one —
so a month view answers "when did something get deleted?" at a glance,
which "document vs team" would not. Dots sit in a fixed severity order
(danger, structural, create) so the eye can rely on position. Clicking
one opens a popover listing that day's events of that tone as the
same cards the list uses — the same renderers, so there is one card
implementation, not two.

- Navigation chevrons **page one month at a time** and are never
  disabled. A step is small enough that
  skipping empty periods would hide the shape of a quiet stretch, which
  is often the thing being looked at, and whichever period you land on is
  fetched on demand. The fetch follows the month's cursor to its end, page
  by page (each merged as it arrives), so a month busier than one page of
  `TIMELINE_PAGE_MAX` shows all its days; it stops at
  `TIMELINE_PERIOD_PAGES_MAX` (10) pages, logged, and a month left before
  its last page (a failed page, or paging away) is fetched again on return.

  Month paging used to jump to the nearest month that had events and
  disable itself when there was none, tooltipped "No earlier events" —
  correct while the client held the whole history, wrong the moment the
  feed became paginated. "Has events" could then only be answered from
  the LOADED events, i.e. page one, so an active user with a busy month
  saw both chevrons greyed out while the server held years more. Worse,
  paging is what triggers the period fetch, so the control that would
  have loaded those months was disabled for not having loaded them. The
  cost of the honest version is a click per empty month.

- Mode is not persisted across navigation. Each mount opens on Cards:
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

**On a phone the row is one button.** Below `sm:` the Cards /
Calendar switch leaves the header and moves to the top of the filter
popover, under a **View** heading, above the filters it applies to.
Collapsing its labels to icons bought room for a while, but two of
them beside Filter and the host's own title still crowded a phone header
into a scrum of glyphs — and the mode is a thing you set occasionally,
not a thing you need permanently on screen. One button that opens
everything beats five that technically fit. The trigger keeps its
Filter label and dot; its accessible name says "View and filter
timeline", because on that width it is both.

- **Activity by: Everyone / Other people.** The sharpest filter on the
  feed, so it leads the popover. On an active account your own edits
  drown everyone else's, and "what did I miss" is the question the whole
  surface exists to answer. System events (an expiring token) survive
  it: nobody did those, and they're exactly what the filter is looking
  for. It began as an "Others" button in the header — the wrong place,
  and a word that doesn't say others-what.
- **Category chips** — Comments, Actions, New documents, Edits, Renames,
  Deletions, Sharing, Teams, Organisation, Account. (The Organisation
  chip's id stays `filing` in code and telemetry; only the label changed.)

  These key on **what happened**, not on the source type. Chips keyed on
  source type were the first attempt and were nearly useless: comments,
  edits, renames, actions, sharing and deletions all carry
  `sourceType: 'document'`, so one chip covered most of a personal feed
  and turning it off left almost nothing. "Hide the document stuff" is
  not a thing anyone wants.

  The categories are coarser than the event type — nobody wants
  `comment_resolved` separately from `comment_added` — and finer than
  the tone, which answers a different question: tone is _how alarming_,
  category is _what happened_. Grouped by consequence rather than by
  table: losing a document, a folder, a team or a working token are all
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
  that day, and what that means follows the open mode. **Cards** scrolls the
  day-group into view and pulses it with a fading box-shadow — box-shadow
  only, never a transform, because transforming the group promotes it to its
  own compositing layer and tearing that layer down at animation end makes
  the cards visibly blink. **Calendar** moves the grid to that day's month.

  The mode split is not a nicety: the scroll target and the pulse are both
  rendered by the day groups, and only list mode renders those, so a
  scroll-and-pulse-only implementation left this control — offered in the
  header in both modes — doing nothing at all in one of them.

- **Show More** appends the next page when the read returns a cursor.
  Page size 50, capped server-side at 200.

**The Filter dot means "this feed is narrowed", whichever control did
it** — a reader wondering why the page looks short needs one signal, not
one per filter.

**There is no Refresh button.** The feed loads on mount and re-reads on
return to the tab (§2.4a) and after the reader's own writes (§2.4b).

The popover renders into a `document.body` portal at fixed coordinates
anchored to its trigger, re-anchored on scroll and resize. The History
dialog and the team card are rounded, `overflow: hidden` surfaces, so an
in-tree absolute popover is clipped no matter its z-index.

### 2.4 Empty and loading states

- **Loading**: a skeleton of three day-groups, not a spinner and not
  the empty state. The feed popping in after a fetch reads as a layout
  jump.
- **Empty (nothing yet)**: the shared `CompactEmptyState` from
  `@liveplanner/ui`, "No activity yet", with the host's line: "What happens
  to this document will show here." (History) or "What the team does will
  show here." (Team Activity).
- **Empty (all filtered out)**: the shared empty state
  ([Empty states](../004-interface-design/empty-states.md)), "No events match these filters", with a
  **Clear Filters** action. Distinct copy from the new-user case, so the
  user isn't told they have no history when they do. The filters run on
  the loaded pages only, so while the read still returns a cursor the
  copy is "No loaded events match these filters" ("Show More to look further back, or remove a filter.") instead, and Show
  more (§2.3) stays under it: claiming nothing matches while older
  pages are unread is the same lie in a smaller voice.
- **Failed**: the feed's error state, with a Try again action.
  **A read that failed must never render as an empty feed.** The first
  version of this surface mapped every failure — offline, an expired
  session token, a worker 500 — onto an empty page, so a reader who
  came back to a sleeping laptop was told nothing had ever happened to
  them, and only a manual browser refresh proved otherwise. That is the
  same lie §2.4 already forbids for the filtered case, and the Explorer
  already refuses to tell it about documents: a failed list there keeps
  its prior value and says so. The feed follows suit — on a failure it
  keeps whatever it had, and shows this state only when it has nothing.

### 2.4a Coming back to a tab

The feed is fetched on mount and there is no realtime push (§13), so a
tab left open overnight shows last night's feed. On **return** — the
document becoming visible again, or the browser reporting the network
back — the first page is re-read and merged in at the head, so coming
back to the tab and coming back to the app agree with each other. This
is also what recovers the failed state above without the user having to
press anything.

Rate-limited to one re-read per 30 seconds, because alt-tabbing is not
a request for fresh data. The merge dedupes on event id and keeps any
pages the reader had already loaded, so returning to a feed someone had
scrolled a long way down doesn't throw their place away.

### 2.4b Your own actions

A History dialog stays open beside the reader's own work: they rename,
share, or delete from the row menu it was opened from, or the editor
autosaves under it. Those used to be the one kind of change the feed
never noticed until a browser refresh proved otherwise. A feed that
doesn't show what you just did reads as broken.

So **any successful write re-reads the feed.** The api client raises a
module-level signal after every non-GET that returned 2xx
(`lib/api/write-signal.ts`, from `apiFetch` in `lib/api/core.ts`), and
the feed re-reads its first page off that signal, merged the same way
the return-to-tab read is. Announcing from the one place every request
passes through, rather than at each mutation's call site, is the whole
design: the list of writes that produce a timeline event would drift
the first time a route gained an emit, and a signal nobody has to
remember can't.

Two timings, both deliberate (`useAfterApiWrite`):

- **A one-second delay** before the re-read. Every emit runs after the
  response (`ctx.waitUntil`), so a read fired the instant the DELETE
  resolves lands before the tombstone does and shows the feed minus
  the thing the reader just did.
- **At most one re-read per five seconds**, trailing. The editor
  autosaves every ~600ms, and a document's History dialog reads the same
  hook; a read per save would be a request storm. Writes inside the
  interval collapse into one read at its end, so the last write is
  always followed by a read.

**The re-read reconciles, it doesn't just add.** A plain merge would
leave a deleted document's older cards up, and would keep the stale copy
of the coalesced edit event the worker upserts in place. Within the stretch of time the page covers, the page
is authoritative: a loaded card the page no longer holds is gone, and a
loaded card the page holds takes the page's copy. Cards older than the
page's floor can't be judged from that read and stay
(`reconcileEvents`, in `merge-events.ts`).

**A DELETE that ends an entity also names it.** `apiDelete` takes an
optional `purge: { sourceType, sourceId }`, set by the four wrappers
that end a document, folder, theme or team, and the feed drops that
entity's cards on the spot with the worker's own cascade predicate
(§3.5): keyed on the id, or referencing it from the snapshot under
`<sourceType>Id`. This is what covers pages the re-read won't reach — a
document created three months ago has its "Created" card well below page
one — and it is why the reader sees the cards go as the menu closes
rather than a second later.

### 2.5 Unread

The premise of Home is "what happened since I was last here", so something
has to track _last here_. `timeline_scope_state.last_seen_at` on the
reader's `user` scope does. The feeds (History, Team Activity) carry no New
pills: "since I was last here" is a question about one reader and one
place, and a shared document or team history has no single "here" to have
been last at.

- **Home's read moves it** ([Explorer Home](explorer-home.md#unread)), once
  per 60-second visit window (`isNewVisit`, `apps/api/src/timeline/seen.ts`),
  and returns the value as it stood **before** the read, so Home can mark
  what was new to this reader. Without the window, a client that fetches
  twice on mount (React's development double-effect does exactly this)
  wipes the markers before anyone has read them.
- A reader with **no** watermark has never opened Home, so nothing is
  counted: greeting a long-time user with "99+" would be a lie about what
  they missed.
- Unread is bounded at **both** ends: past the watermark **and not in the
  future**. The forward-dated expiry warnings from §4 are recorded at the
  instant they come due, and the watermark is only ever written as _now_ —
  which made `occurred_at > last_seen_at` permanently true for them. One
  API token lapsing next week pinned the badge to "1" for seven days.
  Something scheduled is not news until it happens, so it starts counting
  on the day it does. This is bounded by time rather than by the row's
  arrival timestamp because a coalesced event (§3.2) advances its
  `occurred_at` on every update while its `created_at` stays at first
  insert. The rule lives in `countUnseen` (server).

The Home row's badge is its own endpoint (`GET /api/timeline/unread`),
because it renders on every Explorer section and must not require loading
Home. It counts **only other people's events** — a number that goes up
because _you_ renamed something is noise — and caps at 99.

### 2.6 Motion

Cards fan in rather than appearing at once: each starts pulled to the
right with a small tilt and scale-down, then springs into place,
staggered 10ms by position, each card at the 150ms `micro` token ([Motion](../004-interface-design/motion.md)). The motion originates from the right
because that is where a collapsed stack's faux-card layers sit, so it
reads as cards dealt from the deck. The collapsed stack uses the mirror
motion, arriving from below, so folding a run reads as closing.

Three details:

- **No "have I animated this?" bookkeeping.** CSS keyframes fire on
  mount only, so a card that re-renders keeps its end state. React
  mounts a fresh node exactly when one is genuinely new.
- **The stagger index is precomputed** into a map rather than
  incremented inside the JSX, so it is identical however many times
  React calls the render function and doesn't depend on child
  evaluation order. It is **capped at 100ms**, so the whole feed settles within the
  250ms cascade budget of [Motion](../004-interface-design/motion.md): ungapped, a
  50-event page would start its last card half a second in and the
  bottom would sit blank long after the top had settled.
- **Expansion staggers at 10ms (capped at 100ms) and restarts from zero** for the run.
  What just arrived is those cards; carrying the page's global offset
  would make a stack halfway down sit still before unfolding.

Keyframes live in the shared Tailwind theme beside the empty-state ones,
so any app rendering the feed gets the motion without a per-app paste.
`prefers-reduced-motion` cancels all of it, pinning opacity to 1 —
fill-mode `both` would otherwise strand cards invisible.

**The Explorer's own lists cascade too**, via a `lvd-cascade` class on
the container rather than the Timeline's fan. Two differences, both
deliberate:

- **A calmer motion.** The fan comes from the right because that is
  where a collapsed stack's card layers sit. A file list has no deck, so
  reusing it there would be a flourish with nothing behind it; the rows
  get a small rise and a fade instead.
- **Staggered by `nth-child` on the container**, not by threading an
  index prop through four row/card components. That also makes folders
  and documents in one view cascade in document order for free, instead
  of each list restarting its own count.

The search panel uses the same class but only for a window after it
**opens**. Its results re-mount on every keystroke, so leaving it on
would slide the whole list on each character — motion fighting the thing
it decorates, and fast typing would feel laggy.

### 2.7 Deep links

Removed with the Explorer's Timeline section: `/explorer/timeline#event=<id>`
scrolled to an event there. The feeds have no URL of their own.

### 2.8 The card menu

Removed with the section. Its cards carried the Explorer's document,
folder, token, team, invite and theme menus; History and Team Activity
never did, since they sit outside the Explorer context those menus need,
and on a document's own history every card is the same document. The
`cardSlots` and `stackSlots` hooks on `<Timeline>` stay, unused.

### 2.9 Remove from Timeline

Removed with the section, with its endpoints (§6.2a). It soft-deleted the
reader's own `user` membership row (`timeline_event_scopes.deleted_at`,
§3.2); nothing writes that column now, and the reads still filter
`deleted_at IS NULL`, so what a reader removed before stays removed from
Home's count.

## 3. Data model

Three tables, owned by the api worker. Source and scope types, event types, stored titles and snapshot keys name the container a document ([Document](../006-document/document.md#renaming-from-diagram)).

### 3.1 `timeline_events`

```sql
CREATE TABLE timeline_events (
  id           TEXT PRIMARY KEY,          -- UUID
  actor_id     TEXT,                      -- owner id of who did it; NULL for system events
  source_type  TEXT NOT NULL,             -- 'diagram' | 'team' | 'account' | ...
  source_id    TEXT NOT NULL,
  event_type   TEXT NOT NULL,             -- 'document_created' | 'comment_added' | ...
  dedupe_key   TEXT NOT NULL DEFAULT '',  -- '' for one-shot events; see §4.2
  title        TEXT NOT NULL,
  description  TEXT,
  occurred_at  INTEGER NOT NULL,          -- epoch ms
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

`dedupe_key` is empty for events that happen **once per source** (a
document is created once; a tombstone is written once; an invite arrives
once). It carries `<actorId>:<YYYY-MM-DD>` for the coalesced events —
the editing event (§4.2) and a theme's saves — which
deliberately extend one row through the day.

**Events that can recur on the same source get a fresh key every time**
(`dedupeKeyOnce()`, a UUID): a rename, a move, a share link, an offline
/ sync toggle, a team rename, a role change, a member joining, leaving
or being removed, an invite answered, the invite link toggled. This was
a bug: they carried the empty key, so the UNIQUE index took the second
rename of a document for a retry of the first and **upserted** it. Three
renames in a day showed one "Document Renamed" card instead of a stack
of three, and a rename this month silently moved last month's card to
today. The idempotency the empty key buys — a retry or a backfill
overlap landing on the existing row — only matters for events the
backfill writes, and it writes none of these.

`occurred_at` is epoch ms rather than the ISO
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
  deleted_at INTEGER,                     -- was set by Remove from Timeline (§2.9, removed)
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
  last_seen_at     INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);
```

One row per scope. `last_seen_at` is the unread watermark (§2.5).

### 3.4 What the scope model bought

The join table and the free-text `scope_type` were the forward plan, and
two of the three have since shipped:

- **A per-document timeline** (`scope_type = 'document'`) — every document
  keeps its own history, surfaced from the row menu as **History**. It
  carries _document-level_ events (rename, share toggle, theme change),
  never element diffs. Its read gate defers to
  the document's OWN gate rather than re-deriving one, which is what lets
  a share-link visitor read the history of a document they can open but
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
rule. A missing document is a 403 rather than a 404, so the endpoint
can't be used to probe ids for existence. A team scope needs a _joined_
membership: an invite grants no access to team content, and a feed is
content.

Still open:

- **Favourites** would be a fourth table keyed by
  `(scope_type, scope_id, event_id)` — per viewing scope, not on the
  membership row, so a future composite read can't bleed one scope's
  stars into another's.
- **Per-entry dismissal** was a `deleted_at` on the membership row
  (§2.9), and went with the Explorer's
  Timeline section.

Favourites are not built. Everything here is additive.

### 3.5 Deletion and retention

- **A document in the [Trash](trash.md) is hidden, not swept.** Deleting a
  document moves it to the Trash for 30 days; while it waits, `readTimeline`
  and `countUnseen` leave out every event whose source or snapshot names a
  trashed document (`NOT_IN_TRASH` in `db/timeline.ts`, a primary-key probe
  per event), so a restore brings its history back. The purge is what
  cascades, as described next, through `documentsTimelineSweepStatement`
  (the set form of the helper below). Take Offline still sweeps at once.
- **Removing a document for good cascades**, matching Manager Toolkit. The purge
  hard-removes every `timeline_events` row with
  `source_type = 'document' AND source_id = <id>`; the
  `ON DELETE CASCADE` on `timeline_event_scopes.event_id` takes the
  membership rows with them. A feed that keeps narrating a document
  nobody can open any more is noise, and every one of those cards
  links to a 404.
  **And a deleted document leaves no tombstone.** From the Timeline's
  point of view it never existed: nothing is written in its place, and
  there is no `document_deleted` event type. There was one — "Diagram
  Deleted / Payments architecture", in danger red, surviving the sweep
  by being written after it — and it was noise the reader had asked to
  be rid of: the delete was their own act, and a red card for it told
  them nothing they didn't know. (Folders, themes and teams keep their tombstones: those are
  the one row that answers "what happened to it?" for a container other
  people may have relied on.)
  `markTimelineEventsDeletedBySource(env, sourceType, sourceId)` is the
  shared helper; any future entity's delete path calls it rather than
  writing the DELETE inline.
- **Deleting a folder, a theme, or a team cascades the same way.** They
  didn't at first: a folder delete wrote its tombstone and left "Folder
  Created" standing beside it, and every "Theme Saved" for a deleted
  theme stayed up, where a document's history had always been swept.
  Same helper, same order — the sweep runs first, then the tombstone,
  whose `:deleted` source id keeps it out of any later sweep. Folder and
  theme events live under the `account` source type keyed on the
  folder's / theme's id (§4.5), so that is what their routes sweep;
  a team sweeps `team`. The client mirrors the cascade the moment the
  DELETE resolves (§2.4b), so the reader doesn't wait a second for the
  re-read to see it.
- **Deleting an account does.** The existing account-deletion path
  hard-deletes `timeline_event_scopes WHERE scope_id = ?`, then
  `timeline_events WHERE actor_id = ?`, then the scope-state row. The
  `ON DELETE CASCADE` makes the order safe regardless; run them
  explicitly for clarity.
- **Retention is 365 days.** A daily sweep deletes events older than
  that. It runs on the api worker's daily 03:00 UTC cron. 365 days
  because a timeline's value is partly "when did I last touch this" and
  a year is the natural unit for that question.

## 4. Event catalogue

Every event is emitted **inline on the write path** in the api worker.
There are no scanners and no cron-driven scanning: unlike Manager
Toolkit, liveplanner has no entities whose state drifts silently, so a
"rescan for what I missed" pass would find nothing. The two exceptions
are the future-dated expiry events (§4.5), which the existing daily
crons already compute.

All emission goes through one module, `apps/api/src/db/timeline.ts`:

```ts
emitTimelineEvent(env, draft: TimelineEventDraft, scopes: TimelineScopeRef[]): Promise<void>
```

Fire-and-forget from the caller's perspective — wrapped in
`ctx.waitUntil` so a timeline write can never slow down or fail a
document save. A thrown error is swallowed and counted as an
`Error`/`Api` telemetry event; a missing timeline row is a cosmetic
loss, a failed save is not.

### 4.1 Resolving the audience

One helper decides who sees a document event:

```ts
audienceForDocument(env, diagram): Promise<string[]>   // owner ids
```

- Always the document's `owner_id`.
- Plus, when `documents.team_id` is set ([Team shared documents](team-shared-documents.md)), every `team_members`
  row for that team with `status = 'joined'` and a non-null `user_id`.
- The **actor is not excluded**. "You commented on X" is a legitimate
  entry in your own history; the renderer says "You" rather than your
  name, which is what makes it read correctly.

Team events use the analogous `audienceForTeam(env, teamId)`.

### 4.2 Document lifecycle and editing

**A document rename is not an event.** Every entry names its document as it is
called **now**: the feed reads each document's current name when it is served
(`readTimeline` joins `documents` on the event's document and overrides the
snapshot's `documentName`), so renaming a document updates every older entry
about it, and a separate "Renamed" card would only repeat what those now say.
Nothing records `document_renamed` any more, and the rows written before this
change are filtered out of every feed and the unread count. A document that no
longer exists keeps the name it had, and so does one the reader can no longer
open: the override applies only to a document in the reader's visible set (the
documents they own, their joined teams' documents, and live shares, as
`VISIBLE_DOCUMENTS_CTES` defines it), so leaving a team or losing a link never
leaks a later rename. A document feed passed that document's own read gate, so
its live name always shows there. Team renames are still events: a team's
name is not re-read onto older entries.

| `eventType`                            | Fires when                                                                                                                                       | Title / description                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `document_created`                     | `POST /api/documents`                                                                                                                            | "Document Created" / "Payments architecture"                    |
| `document_duplicated`                  | duplicate route                                                                                                                                  | "Document Duplicated" / "Copy of Payments architecture"         |
| `document_moved`                       | folder change                                                                                                                                    | "Moved to a Folder" / "Payments architecture → Architecture"    |
| `document_edited`                      | tab save (coalesced)                                                                                                                             | "Document Updated" / "You worked on Payments architecture"      |
| `document_opened_by_visitor`           | a share-code visitor reads a tab (`GET /api/documents/:id/tabs/:tabId`); owner only, coalesced per visitor per day ("Opened by a visitor" below) | "Opened by a Visitor" / "Payments architecture"                 |
| `document_copied_by_visitor`           | a share-code visitor copies it (`POST /api/documents/:id/copy`); owner only                                                                      | "Copied by a Visitor" / "Payments architecture"                 |
| `document_offline` / `document_synced` | Take Offline / Sync Document ([Offline Mode](../006-document/offline-mode.md))                                                                   | "Taken Offline" / "Synced to the Cloud"                         |
| `document_renamed`                     | never: retired, no longer emitted (see above)                                                                                                    | Legacy rows are filtered out of every feed and the unread count |

**The two Offline Mode conversions declare themselves**, because they reuse
ordinary endpoints and are otherwise indistinguishable from them: "Take
offline" is a plain `DELETE /documents/:id` (the server copy really does go)
and "Sync document" a plain `POST /documents`. Undeclared, the worker treated
them as a deletion and a `document_created` — so the feed lost a document the
owner had just moved into this browser, and told them one they had just
uploaded was brand **new**. The editor therefore
sends `X-Document-Conversion: offline | sync` on the request that performs it,
and the route picks the honest event. Header name, values and the reader live in
`packages/api-schema` beside the event types they select, since it is a
two-sided contract and two copies of a string is how these drift. An
unrecognised value falls back to the truthful default: the header is
client-supplied.

**Only the owner's conversion is honoured**, and that clause is load-bearing
rather than defensive. `document_offline` is owner-scoped — an offline document
exists in exactly one browser, so no teammate has a stake in it — but the DELETE
is also reachable by any joined member of the document's team ([Team shared documents](team-shared-documents.md)), and the
Explorer offers Take Offline on a team-library row without checking who owns it.
When a teammate does it the document lands in **their** browser and leaves the
owner's account for good; from the owner's and the team's side that is a
deletion, not something they can still reach, and a deletion records nothing
(§3.5) — so honouring the conversion would hand the teammate an owner-scoped
"Taken Offline" card for a document they took from someone else. A non-owner's
DELETE is therefore a plain delete. The source cascade (§3.5) runs either way:
whatever the server held is gone, so its prior events would point at a 404.

**The coalesced editing event** is the one that needs care, because it
is the highest-volume write in the product and a naive emit would bury
everything else even with stacking.

- Emitted from the tab-save path (`upsertTab`), the one write every
  edit goes through.
- `dedupe_key = "<actorId>:<YYYY-MM-DD>"` in UTC. The first save of the
  day inserts; every later save that day hits the `UNIQUE` constraint
  and **updates** `occurred_at` to now (with the title, description and
  snapshot, so a rename shows). One row per person per document per day.
  The upsert and its scope rows are one D1 batch: the scopes attach to
  whichever row survived the upsert, found by its unique key.
- Description is actor-relative at render time: "You worked on X" for
  your own, "Priya edited your document X" for someone else's. The row
  stores the actor id; the renderer resolves the pronoun.
- This is a deliberate departure from Manager Toolkit's
  **additive-only** refresh rule (existing rows are never mutated
  there). It is safe here precisely because there are no favourites and
  no user edits to preserve — nothing is attached to the row that a
  mutation could invalidate. If favourites ever land (§3.4), this
  event's mutation needs revisiting.

**A person's own opens are recorded here but are not part of this feed.** [Explorer Home](explorer-home.md#opens)
keeps a coalesced `document_opened` row per person per document per UTC day, in that person's `user` scope only
(opens are private); Jump Back In counts them as use days. It is outside the
feed's vocabulary: `readTimeline` and `countUnseen` leave it out the way they leave out legacy renames, and no
renderer, tone or chip knows it. Deletion, retention, the document sweep and sign-up migration treat it like every
other row.

Offline documents ([Offline Mode](../006-document/offline-mode.md)) live only in IndexedDB and never reach the
worker, so they emit nothing. Their absence from the Timeline is
correct and matches the rest of the product's server-side surfaces.

### 4.3 Collaboration

| `eventType`          | Fires when                                                  | Notes                                                                                                |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `comment_added`      | both comment paths                                          | See below                                                                                            |
| `comment_resolved`   | thread flips to `resolved` on tab save                      | Diffed the same way; description is the thread's opening comment, so the card says what was resolved |
| `action_assigned`    | an `ElementAction` appears on save, or via `/notify-action` | Audience is the assignee plus the document audience                                                  |
| `action_completed`   | an action's `status` flips to `done`                        |                                                                                                      |
| `share_link_created` | share link minted                                           | Audience is the owner only                                                                           |

**Comments have two write paths and both must emit.** Comments live
inside element JSON on the tab (`packages/document/src/comments.ts`),
not in a table — there is no comments table to hang a trigger off. The
worker already has to reason about which comments are _new_ on every
save, in `apps/api/src/comments.ts`:

- `POST /api/documents/:id/tabs/:tabId/comments` — the explicit path a
  view-role visitor uses. Emit directly; the comment object is right
  there.
- The ordinary tab `PUT`, where `rewriteCommentAuthors` already
  compares incoming comments against the previous tab's by id in order
  to stamp server-trusted authorship. The same diff yields the new
  comments. `hasNewComments` is already exported from that module.

The comment **text** goes in the description, truncated to 240
characters with an ellipsis. A comment feed you can't read the comment
in is a notification list, not a timeline. This is the same trust
boundary as the document's own content: everyone in the audience already
has read access to that thread. (Note that this is _narrower_ than the
email notification in [Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md) #1, which deliberately never includes
comment text — an email leaves the product's authorisation boundary
and can sit in an inbox forever; the Timeline is behind the same auth
as the document itself.)

**A comment event's actor is the comment's author, never simply the saver.** A
tab save can carry a peer's new comment that reached the saver live before the
author's own save landed; `rewriteCommentAuthors` stores it without an author
id, credited by the room's name. Its `comment_added` is recorded with no actor
then, and the author's own later save, which claims the comment, fills the actor
in (an emit's conflict update fills a missing actor and never replaces one). An
author id other than the saver's is never trusted as an actor.

**A deleted comment takes its words with it.** Every path that removes a comment
deletes its `comment_added` event, and, when it opened its thread, the thread's
`comment_resolved` event, whose description is that opening comment's text: the
delete-own comment route, a Plan card's comment delete, and a tab save that drops
comment ids (one by one, or with their element), diffed by `removedComments`. A
comment that comes back (an undo) is new again to the next save and is recorded
afresh.

Deleting a whole tab or a whole Plan card retracts every comment it held the same
way (`retractTabComments`, `retractCardComments`): the tab delete route unlinks the
tab and reads its stored body in one statement (`deleteTabRow`), and the card delete
route reads the card as it deletes it (`deleteItemRow`), so a comment written a
moment before can never slip between a read and the delete. Every comment event is
pinned to the document whose write recorded it, so a tab unlinked from one document
loses only that document's events; another document still holding the tab keeps
its own, until the tab leaves it too. Purging a document from the Trash, or deleting
it outright, sweeps all of its events (§3.5), its tabs' and cards' comments among
them. An undone card delete brings the card's comments back without their events: a
card's comments are recorded only by the comment routes.

A `comment_added` snapshot carries `reply: true` when the comment is not the first of its thread, and an
`action_assigned` snapshot carries the assignee's owner id as `assigneeId` (null for an invited member with no
account yet). Both are what [Explorer Home](explorer-home.md)'s What Happened needs to say "replied" and "assigned
you an action"; rows written before them read as "commented" and "assigned an action".

Assigned actions ([Assigned actions](../012-collaboration/assigned-actions.md)) are likewise element-JSON, diffed on save
the same way. `apps/api/src/routes/team-action-routes.ts`'s
`notify-action` endpoint is the cleaner hook where the client already
calls it.

### 4.4 Teams and invites

| `eventType`                 | Fires when                                                                               | Audience                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| `team_created`              | `POST /api/teams`                                                                        | Creator                                    |
| `team_invite_received`      | admin invites an address                                                                 | The invitee, once their id is known        |
| `team_invite_accepted`      | `.../accept`                                                                             | The team                                   |
| `team_invite_declined`      | invite row deleted by invitee                                                            | Team admins                                |
| `team_member_joined`        | accept, or invite-link join                                                              | The team                                   |
| `team_member_left`          | member deletes own row                                                                   | The team                                   |
| `team_member_removed`       | admin removes someone                                                                    | The team, and the removed person           |
| `team_role_changed`         | `PUT .../members/:id`                                                                    | The team                                   |
| `team_document_added`       | document published to a team library ([Team shared documents](team-shared-documents.md)) | The team                                   |
| `team_document_removed`     | document pulled back out of a team library                                               | The team it left, resolved BEFORE the move |
| `team_renamed`              | `PUT /api/teams/:id` with a new name: "Team Renamed" / "Design → Product design"         | The team                                   |
| `team_deleted`              | `DELETE /api/teams/:id`: "Team Deleted" / the team's name, no team link                  | The team, resolved BEFORE the delete       |
| `team_invite_link_enabled`  | `POST /api/teams/:id/invite-link` (generate or rotate): "Invite Link Turned On"          | Team admins                                |
| `team_invite_link_disabled` | `DELETE /api/teams/:id/invite-link`: "Invite Link Turned Off"                            | Team admins                                |

**`team_invite_received` has an ordering problem worth naming.** An
invite is created against an _email address_; the invitee's owner id is
unknown until they sign in and the lazy email-claim step connects the
row ([Teams](teams.md)). So there is nobody to scope the event to at emit time.
Resolution: emit the event with **no `user` scope**, and attach the
scope in the same lazy-claim step that fills in `user_id`, using the
invite's original `created_at` as `occurred_at`. The invite then
appears on the new member's Timeline dated when it was actually sent.

Teams are for accounts only, so none of these events ever reach a guest scope.

### 4.5 Account and housekeeping

An account event (a token, a theme, a folder, an upload) reaches only its
person's own `user` scope, which no feed draws since the Explorer's Timeline
section went: it is still recorded, and leaves with the account (§3.5). Home's badge counts
only what someone else did or nobody did, so of these only a token's expiry
warning, once due, adds to it. A
`share_link_expiring` warning is a document event, so it shows in that
document's History.

| `eventType`           | Fires when                                                                            | Notes                                                                             |
| --------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `token_created`       | `POST /api/tokens` ([Public API and API tokens](../015-api/public-api-and-tokens.md)) |                                                                                   |
| `token_revoked`       | `DELETE /api/tokens/:id`: "API Token Revoked" / the token's name                      | Withdraws the token's `token_expiring` warning first                              |
| `token_expiring`      | the existing daily expiry-warning cron                                                | **Future-dated**: `occurred_at` is the expiry, not now                            |
| `share_link_expiring` | the share-expiry cron ([Share-link expiry](share-link-expiry.md))                     | Future-dated                                                                      |
| `theme_saved`         | custom theme created ([Custom themes](../011-theme/custom-themes.md))                 |                                                                                   |
| `theme_deleted`       | `DELETE /api/custom-themes/:id`: "Theme Deleted" / the theme's name                   | Tombstone: the theme's `theme_saved` rows go first ("reads its name first" below) |
| `folder_created`      | `POST /api/folders`, personal or team: "Folder Created" / the folder's name           | The person who made it only                                                       |
| `folder_deleted`      | `DELETE /api/folders/:id`: "Folder Deleted" / the folder's name                       | The person who deleted it only; tombstone like `theme_deleted`                    |

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
  on the document, one warning however many links are expiring, so revoking
  one of two retracts a warning the other still justifies. The daily sweep
  re-emits whatever is still inside its window, so the cost is at most a
  day of silence — strictly better than a deadline the owner has already
  dealt with standing indefinitely.

**"Opened by a visitor" hangs off the TAB read, not the document GET.**
The document endpoint is hit by link previews and polling; fetching tab
content means a person is actually looking at the canvas. It is also the
one event a stranger can trigger at will, so it coalesces per visitor
per day — otherwise anyone holding a link could flood an owner's feed by
refreshing.

**A "visitor" is somebody who presented a SHARE CODE**, not merely somebody
who isn't the owner. That distinction is the whole meaning of both
visitor-facing events, and keying them on `owner !== ownerId` got it wrong:
the read gate also admits every joined member of the document's team
([Team shared documents](team-shared-documents.md)), and a teammate presents no code. So browsing your own team's
library told the document's owner _"opened by a visitor · Someone with the
share link"_, under the **sharing** filter, for a document they had never
shared a link for — once per teammate per day, so a twelve-person library
could put eleven false cards a day on one document. Duplicating a
team-library document reported _"copied by a visitor"_, which is simply
untrue. Both now require a share code to have been presented. The
teammate's own `document_duplicated` event is unaffected: they really did
copy it.

**Leaving a team library is its own event, and its audience is resolved
before the move.** Publishing into a team and pulling back out of one are not
one event with a direction: the out case takes the document away from everybody
else, and when the mover isn't the owner [Team shared documents](team-shared-documents.md) hands them ownership, so the
previous owner loses it too. It used to fall through to `document_moved` and
read "Moved to a Folder → Unsorted" — in the **mover's** feed only, because
`recordDocumentMoved` resolves its audience from the document and by then the
document is personal. A document could leave a shared library and change hands
with nothing in the team's feed or the old owner's. And since a document at the
library root already has `folderId === null`, moving it to personal Unsorted
changed no folder, so that arm didn't fire either and **no event was written at
all**. `team_document_removed` now covers it, carrying the new owner's name for
the readers who no longer have the document, and the audience is read from the
outgoing team before `setDocumentFolder` — the same ordering, for the same
reason, as the delete tombstone.

**Invite-link toggles go to admins only.** Whether a join credential is
live is an administrative fact, and telling every member one exists is a
nudge to go and find it.

**Anything whose row is about to vanish reads its name first** and omits
the id from the snapshot, so a folder / theme / team tombstone can't
link at something that no longer exists — the same structural guard the
document tombstone uses.

Future-dated events are why the day rail renders future groups above
Today with a distinct tint. They are the feed's only forward-looking
content and they are the reason a user opens it before something
breaks rather than after.

## 5. Backfill

Removed with the Explorer's Timeline section. On a personal scope's first
read the worker used to seed it from the caller's library (a
`document_created` and a reconstructed `document_edited` per document, a
`team_member_joined` per team), so a new personal feed wasn't empty. Home
counts only real edits and real makings, and History and Team Activity
were never seeded, so nothing reads what it wrote. Rows it wrote stay,
marked `backfilled: true`, and Home keeps leaving them out.

## 6. API

One route module, `apps/api/src/routes/timeline.ts`, dispatched from
`src/index.ts`. It serves the scoped feeds and Home's badge; the personal
feed's read, refresh and dismissal went with the Explorer's Timeline
section.

### 6.1 `GET /api/timeline`

Query params:

- `scope` — `<scopeType>:<scopeId>`, `document:<id>` or `team:<id>`.
  Required: without it, or with a `user` scope, the read is refused (the
  personal feed it used to default to is gone).
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
      "sourceType": "document",
      "sourceId": "...",
      "eventType": "comment_added",
      "title": "Comment Added",
      "description": "Priya on Payments architecture",
      "occurredAt": 1754380800000,
      "actorId": "user_...",
      "snapshot": { "documentName": "Payments architecture", "text": "Should the retry budget…" }
    }
  ],
  "nextCursor": "1754380800000:abc"
}
```

**Authorisation.** Explicit per scope type, with anything unrecognised
refused (§3.4): a `document` scope defers to the document's own read gate
(a missing document is a `403`, so ids can't be probed), a `team` scope
needs a joined membership. An owner id is a credential, so a `document`
feed names only the reader themself as an actor; every other actor goes
out as `null` and renders by its snapshot name.

### 6.2 `POST /api/timeline/refresh`

Removed with the backfill (§5) it ran.

### 6.2a `DELETE /api/timeline/events/:id`

Removed with Remove from Timeline (§2.9), as was
`POST /api/timeline/events/dismiss`. Both are gone from the OpenAPI
manifest.

### 6.2b `GET /api/timeline/unread`

`{ count }`: other people's unseen events on the caller's own `user` scope
(§2.5), for the Home row's badge. Zero when the scope has no watermark yet.

### 6.3 Stale-read refresh

Removed with the backfill (§5): a read seeds nothing.

### 6.4 Wire types

`TimelineEvent`, `TimelineScopeRef`, `TimelineReadResult`, and
`TIMELINE_PAGE_SIZE` / `TIMELINE_PAGE_MAX` go in
`@liveplanner/api-schema`, per the existing
convention that every DTO the worker emits and the editor consumes
lives there.

Client wrappers go in `apps/live/lib/api/timeline.ts` and are
re-exported from the `lib/api-client.ts` barrel, matching every other
domain. **Offline mode is a no-op here**: `isOfflineId` doesn't apply
(the scope is an owner, not a document), and an offline-only browser has
no server events.

`apiListTimeline` takes the scope it reads and returns `null` when the
read fails rather than throwing OR returning an empty page. Both alternatives were tried and
both are wrong: throwing pushes an error screen over the dialog or card the feed sits in,
and an empty page is indistinguishable from a genuinely empty
feed, which is exactly how "nothing has happened yet" came to be shown
to people with years of history (§2.4). `null` is the third answer —
"we don't know" — and the caller keeps what it had. This matches the
Explorer's document list, which already keeps its prior value on a
failed read and toasts rather than flashing its empty state.

## 7. UI packaging

Per the reuse principle, the generic pieces go in
**`packages/ui/src/timeline/`** and know nothing about liveplanner's
domain:

```
Timeline.tsx             the feed: grouping, rail, stacks. No header.
TimelineControls.tsx     mode switch + filter trigger, for the host's header
useTimelineControls.ts   the state both halves share, + derived filtering
TimelineGroup.tsx        one day: dot, line, date label, Today pill, the card grid
TimelineCard.tsx         preview / title + menu slot / reason line / description
StackedCard.tsx          the collapsed run with its faux-card layers
ExpandedStack.tsx        the open run: the stack card as its head, then the members
TimelineCalendarView.tsx month grid, per-tone dots, day popover
TimelineFilterPopover.tsx chips + mini calendar, portalled
useTimelineGrouping.ts   group-by-day (pure, exported for reuse)
stacking.ts              bucket + alias rules (pure)
sameDayCreate.ts         hide the edit that shares a day with the create (pure, §2.1a)
eventTone.ts             event type -> tone, and the tone colour vars
monthCells.ts            month-grid arithmetic (pure)
sourceTypeMeta.ts        chip label + fallback glyph per source type
types.ts                 TimelineEvent, renderer contracts
```

The **renderers** — the functions that turn a `TimelineEvent` into a
card's parts (`subject`, `label`, `meta`, `preview`, `onClick`), and that know a document event links to `/document/<id>` and a
team event to `/explorer/team?id=<id>` — live in
**`apps/live/app/explorer/timeline/renderers.tsx`** (a folder that is no
longer a route), keyed by `sourceType`. The package takes a registry prop;
it never imports a route.

This split is what lets History and Team Activity (§3.4) share the same
components without inheriting any one host's copy.

**Colour.** Each tone gets a CSS variable pair
(`--ld-timeline-<tone>` and `--ld-timeline-<tone>-soft`) defined in the
live app's `globals.css` with **both light and dark values** —
liveplanner has a class-based dark mode ([Live app](../007-editor/live-app.md)), unlike Manager
Toolkit which is dark-only, so every tint needs two, and dark mode
lifts the bold value (a 600-weight hue goes muddy on slate-900) while
dropping the soft one (an alpha tint over a dark surface reads far
stronger than the same alpha over white). In light mode each bold value is a 700 step where the 600 fell short:
it labels a card's reason in 12 px text, so amber (`#b45309`) and emerald (`#047857`) read at 4.5:1 or better on
white and on their own tint. `eventTone` reads the var
with a fallback baked into the package, so the components render
standalone.

**Animation.** A card fades in on the first mount of its event id
only — the component keeps a `Set` of seen ids. Without that, every
existing card re-animates on each refresh, which reads as the whole
feed vanishing and coming back.

## 8. Explorer integration

### 8.1 Home is the landing view

The Explorer lands on **Home** ([Explorer Home](explorer-home.md)). A static export has no single
entry point, so the landing is applied in several places, all reading one constant, `EXPLORER_LANDING_PATH`
(`apps/live/lib/explorer-landing.ts`):

1. `apps/live/src/worker.ts`: the `/explorer` 302.
2. `apps/live/app/explorer/page.tsx`: the client `router.replace` fallback for the dev server and direct asset hits.
3. `scripts/e2e-stack.mjs`: the end-to-end stack's stand-in for the worker.

`apps/live/app/explorer/routes.ts`'s `selectedFromRoute` `default:` case, which catches mangled URLs (an old
`/explorer/timeline` link among them) and id-less `folder`/`team` links, returns `{ kind: 'home' }`; its test holds
the route table to the constant.

**Recent is not removed.** It keeps its route (`/explorer/recent`); it answers a different question ("what did I
touch last"). It has no sidebar row.

### 8.2 Sidebar

The record has no sidebar row. Its unread badge sits on the **Home** row
([Explorer structure](explorer-structure.md)):

```text
Overview
  ⌂  Home              ← the landing view; badge: other people's unseen events (§2.5)
  ◔  Inbox
  ↗  Shared With Me
```

### 8.3 The section checklist

Adding an Explorer section touches the same files every section does:
`views.tsx` (the `SelectedNode` union), `routes.ts` (both directions),
`apps/live/app/explorer/<section>/page.tsx` (the route stub),
the sidebar group that holds its row, if it has one (`app/explorer/sidebar/`, [Explorer structure](explorer-structure.md)),
`components/primitives/explorer-icons.tsx`, `view-titles.ts` and `useExplorerPane.ts` (pane content, title, crumbs),
`ExplorerPane.tsx` (dispatch), `ExplorerEmptyState.tsx`, and `routes.test.ts`'s `STATIC_NODES`. Removing one
touches the same files.

## 9. Guests

Guests' writes are recorded too, keyed to their signed participant id
([Auth + guest access](../014-identity/auth-and-guest-access.md)): document lifecycle, editing, comments on their
own documents, and share-link events. Team, invite, and token events never reach them because those features are
signed-in only — Home and a History are simply thinner, with no sign-in wall.

**On sign-up, the record migrates.** `POST /api/migrate` already
moves documents from the guest participant id to the account user id; it
gains two statements in the same transaction:

```sql
UPDATE timeline_event_scopes SET scope_id = ?1 WHERE scope_type = 'user' AND scope_id = ?2;
UPDATE timeline_events       SET actor_id = ?1 WHERE actor_id = ?2;
```

Plus a move of the `timeline_scope_state` row, so the Home watermark
carries over. A user who drew for a week as a guest keeps that week when
they sign up — which is the point of the guest path existing at all.

## 10. Telemetry

Category `Timeline` in the closed enum in
`@liveplanner/api-schema` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), fired by
the History and Team Activity feeds:

- `Timeline`/`Changed` with `type` `List` | `Calendar` — mode switch.
- `Timeline`/`Selected` with `type` the source type — a filter chip
  toggled; `Others` | `Everyone` for the Activity by switch.
- `Timeline`/`Opened` with `type` `Stack` — a stacked run expanded.
  Tells us whether stacking thresholds are right.
- `Timeline`/`Loaded` with `type` `More` — Show More; `Retry` — a failed
  read retried.

The section's own events went with it: `Timeline`/`Opened` `Landing` |
`Nav` | `Menu`, `Timeline`/`Removed` `Entry` | `Stack`, and the sidebar's
Timeline row.

No event ever carries a document name, team name, or comment text; the
`type` slot is a fixed token, bounded by the existing
`TELEMETRY_TYPE_PATTERN`.

## 11. Testing

Per [Testing](../003-system-architecture/testing.md):

- **Pure units, tested directly**: `stacking.ts` (bucketing, aliasing,
  never-stack rules, position-of-most-recent), `useTimelineGrouping`
  (day grouping, out-of-order tolerance), `sameDayCreate.ts` (the edit
  goes when its create shares the local day, stays otherwise, and other
  same-day kinds are untouched), `monthCells` (Monday-first padding,
  leap years, empty-month skipping), and `eventTone` (every emitted
  event type maps to a tone, and an unknown one falls to neutral rather
  than to danger).
- **The card, rendered** (jsdom): the subject is the title and the
  stored Title Case category is the reason line; a card with no preview
  shows the glyph box instead; the `menu` slot renders and a click on it
  does not fire the card's own `onClick`; the `title` slot replaces the
  subject. This is the one component in the folder with a render test,
  because the menu slot is the one place a card's click and a child's
  click compete.
- **Worker route tests** alongside `teams.test.ts`: scope
  authorisation (a `user` or missing scope is refused, a document scope
  defers to the document's gate, a team scope needs a joined membership),
  pagination and cursor stability, filter params, and the
  `UNIQUE`-constraint idempotence of `emitTimelineEvent` — emit the
  same draft twice, assert one row.
- **Audience resolution**: a comment on a team document fans out to
  every joined member and to nobody who is merely `invited`.
- **Coalescing**: three saves in one UTC day produce one row whose
  `occurred_at` advances; a save the next day produces a second row.
- **Migration**: guest → account id moves scopes, events, and scope
  state.
- **Failed reads never read as empty** (§2.4): `apiListTimeline`
  returns null on a refusal (401), on a worker error, on a thrown fetch
  and on an unparseable body — and an empty page only when the worker
  actually said the feed is empty. This is the regression that
  motivated the failed state, so it's pinned at the wrapper, which is
  where the two answers were conflated.
  It's pinned in the hook body too, under the jsdom docblock
  `useTimelineFeed.test.tsx` already uses: a failed first read reports
  an error with no events, Try again clears it, and a read for a new
  owner that fails doesn't leave the previous owner's events on screen.
- **Merging a re-read** (§2.4a): `mergeEvents` is a pure module for
  this reason — new events land at the head, an older fetched range
  sorts into place, ids dedupe, and an unchanged read returns the SAME
  array so the feed doesn't re-render. The wiring around it is tested
  in the hook: a visibility change past the throttle merges what
  happened since without dropping loaded events, a failed re-read keeps
  the feed it had, and two changes inside the window read nothing.

## 12. Docs

- The help centre's [Home](../../../apps/help/app/explorer/home/page.mdx) article
  ([Help app](../018-help/help-app.md)) describes Home and, under "Team and
  document histories", the feeds, registered as `home` in
  `packages/help-registry/src/index.ts`. Its old URL, `/help/explorer/timeline/`,
  redirects there.
- `README.md` and `docs/development/architecture.md` list the tables and the
  `/api/timeline` routes.

## 13. Out of scope for v1

- Favourites / starring, manual entries.
- A personal feed of everything (the Explorer's Timeline section, removed).
- AI day summaries.
- Realtime push. A fresh read on mount, the re-read on return to the
  tab (§2.4a), and the re-read after the reader's own write (§2.4b)
  are the whole freshness story.
- Cross-user search over the feed.
- Backfilling anything (§5).
