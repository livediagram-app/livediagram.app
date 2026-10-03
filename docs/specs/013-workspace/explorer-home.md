# Explorer Home

**Home** is the Explorer's landing view and the first row of the sidebar's Overview group
([Explorer structure](explorer-structure.md)). It answers the two questions a returning person
brings, in one screen: "what was I working on?" and "what happened while I was away?".

## Route

- Home lives at `/explorer/home`. `/explorer`, and any Explorer URL that names no view, lands on it.
- The Timeline feed ([Timeline](timeline.md)) keeps its route, `/explorer/timeline`, under the page title **All
  activity**. It has no sidebar row: it is reached from What happened's **See all activity** link, and its breadcrumb
  leads back to Home (**Home › All activity**).

## Layout

- **Desktop and tablet** (`md:` and wider): two columns side by side.
  - **Recent** on the left, taking the remaining width.
  - **Timeline** on the right, a fixed-width column. It has **no panel background or border of its own**: it sits
    directly on the page and blends in, set apart only by its heading and its centre line.
- **Phone** (below `md:`): one column with a two-option switch, **Recent** and **Timeline**, at the top of the page.
  - **Recent** is shown by default on every visit.
  - The switch follows the WAI-ARIA tabs pattern: two tabs and one tab panel.
- The page header carries **New document**, as every Explorer section does, and the section's Help link, as every
  section's header does ([Contextual help links](../018-help/contextual-help-links.md)). Home has no other header
  actions: no import, no folder, no view switch.
- The two columns scroll with the page; neither scrolls on its own.

## Recent

Recent holds two sections, top to bottom.

### Jump back in

- The documents the person **returns to most**: ranked by how often they open each document, weighted towards
  recent opens, not by recency alone. Plain recency is the Timeline's job, so the two never repeat each other.
- The rank is the document's **frecency**: every day the person opens it adds one, and each day's weight halves
  every **14 days** (an exponential decay with a fortnight's half-life). A document opened on each of the last ten
  days outranks one opened once yesterday for about six weeks after its last open.
- At most **12** documents, the strongest first. Only documents the person can open now: never one in the Trash,
  nor one whose share link has lapsed or whose team they have left.
- **Seeded once** from what the person already did, so the strip is not empty on the day Home arrives: on their
  first Home, every day they edited a document counts as a day they opened it (an edit needs an open). Only days
  before the document's first recorded open count, so a day is never counted twice and seeding again changes
  nothing. Bounded to their most recent edits.
- A single row, a **scrolling strip** of small snapshot thumbnails, each with the document's name below it in a
  small font, truncated to the thumbnail's width. The full name is its tooltip and accessible name.
- The strip scrolls sideways (touch, trackpad, Shift+wheel, and keyboard focus moving through it). Its trailing
  edge fades to say there is more, and only while there is more.
- Activating a thumbnail opens the document.
- A document stored only in this browser ([Offline Mode](../006-document/offline-mode.md)) carries the **Local only**
  pill on its thumbnail, as every other row and card of one does. It ranks among the rest by the same frecency,
  counted in this browser ([Opens](#opens)).

### What happened

- What **other people** did to documents the person can open, grouped under day headings (**Today**, **Yesterday**,
  then the date). The days are the person's own (their time zone), and the section covers the last **14 days**.
- "Documents the person can open" are the ones they own, the ones in a team they have joined, and the ones shared
  with them through a link that is still live. A link scoped to one tab ([Tab-scoped share links](tab-scoped-share-links.md))
  shows nothing here: the actions name things on tabs the link does not reach.
- "Other people" are everyone but the person, under any identity they have had (a guest id before sign-up counts as
  theirs).
- The actions and their verbs are a closed set, in this order wherever several are named:

  | Action                                         | Verb phrase            |
  | ---------------------------------------------- | ---------------------- |
  | A comment that starts a thread                 | commented              |
  | A comment on a thread that already had one     | replied                |
  | A thread resolved                              | resolved a thread      |
  | A day of edits (one per person per day)        | edited                 |
  | An action assigned to the person               | assigned you an action |
  | An action assigned to anyone else              | assigned an action     |
  | An action completed                            | completed an action    |
  | The document published into one of their teams | shared                 |

- Opens are never listed here: whether someone looked at a document is theirs to know, not the reader's.
- **No filter controls** sit in or above this section. It stays clean; the shared filters live on the other
  Explorer views ([Explorer filters](explorer-filters.md)).
- A quiet **See all activity** link beside the section's heading opens the Timeline feed (**All activity**), where
  everything that happened, the person's own doings included, can be filtered and paged.
- Every entry is **spot on**. It names:
  - who acted;
  - what they did, as a plain verb phrase (commented, replied, resolved a thread, edited, assigned you an action,
    shared);
  - which document;
  - where the document lives (its space and folder).
- One document's actions on one day form a **group**. A group with one person is shown as that person's entries,
  one per action.
- **Several actions on one document by more than one person collapse into one entry**, a **summary sentence that
  expands**:
  - the people's avatars, overlapped, then one sentence naming them and what they did, e.g. "Priya, Sam and Lee
    commented, edited and assigned you an action in **Payments architecture**";
  - beneath it, where the document lives and how many updates there were ("Platform team · 5 updates");
  - the time of the latest action, and a chevron;
  - expanding lists every underlying action, newest first: avatar, who, what, a small icon for the kind, and time.
  - The entry is a disclosure button (`aria-expanded`); collapsed is the default, and the state is not remembered.
  - Each expanded action opens the document.
- A one-person entry is a link that opens the document. A comment or reply shows its words beneath, an action its
  name, on one line.
- "Where the document lives" reads **My documents** or the team's name, then `›` and the folder when it has one; a
  document shared with the person reads **Shared by** and the owner's name.
- A person without a known name is **Someone**. A summary names at most three people, then "and N others".
- Times are the person's own clock times (`14:05`), under the day heading that dates them.

## Timeline

- The person's **own** document activity only: documents they **created** (a duplicate is a document they created),
  **updated** or **opened**, on documents they can still open.
- One entry per document per day (their time zone). When a day holds more than one, the entry says the strongest:
  created, then updated, then opened, at that event's time.
- Newest first, 30 entries at a time, with more loaded on demand.
- Only events with a real actor count. The Timeline's backfill ([Timeline](timeline.md) §5) reconstructs a
  document's last save as its owner's edit without knowing who saved, so those reconstructed edits are not shown.
- Entries run down a vertical centre line, newest first, under day markers.
- Each entry is the document's snapshot thumbnail ([Document SVG snapshots](../006-document/document-snapshots.md)),
  placed on **alternating sides** of the line. People recognise their own documents by what is drawn on them.
- The document's name sits **below** its thumbnail in a small font. It never exceeds the thumbnail's width: a longer
  name is truncated with an ellipsis, and the full name is its accessible name and tooltip.
- A small marker on the centre line says what happened (created, updated or opened). The marker is never colour
  alone: each kind has its own glyph (a plus, a pencil, an eye), and the entry's accessible name states it. The
  entry's time sits on the other side of the line, level with the marker.
- Day markers sit on the centre line: **Today**, **Yesterday**, then the date.
- More entries load as the person scrolls towards the end of the column; a reserved slot at the foot holds the
  loading row (or, when a page fails, **Try again**), so nothing moves when the page lands.
- Activating an entry opens the document.
- Documents stored only in this browser never reach the server, so they have no Timeline entries.

## Unread

Viewing Home counts as having looked: it moves the Timeline's unread mark exactly as the Timeline page does
([Timeline](timeline.md) §2.5), once per visit, and says where the mark stood before, so what is new to the person
can be marked.

## Opens

An **open** is the editor loading a document for a person to look at.

- It counts for whoever opens it: the owner, a teammate, or a visitor through a share link. A visitor always has an
  identity (their guest id, or their account), so their open is theirs.
- It is recorded **once per person per document per day** (UTC, the day boundary every coalesced event uses), at the
  day's first open.
- These are **not** opens: a snapshot or thumbnail, an embed ([Read-only embeds](embeds.md)), a duplicate, Take
  Offline, the Google Drive mirror, and any read through the public API or an AI tool.
- Opens are **private**. Only the person who opened a document ever sees that they did: in their Jump back in and
  their Timeline, never in What happened, a document's History, a team's feed, or the Timeline feed
  ([Timeline](timeline.md)).
- Offline Mode documents never reach the server, so the server records none of their opens. **This browser counts
  them instead**: the editor opening a document stored only here adds an open day to that document's own record in
  this browser, by the same once-per-UTC-day rule and the same frecency, so Jump back in ranks it among the rest. The
  count lives and dies with the document's local record and never leaves the browser.

### Guests, sign-up and deletion

- Guests have Home in full, keyed to their guest id.
- Signing up moves a guest's opens to the account with the rest of their data ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
  A document opened under both identities keeps both histories: the two frecencies add up.
- Deleting the account deletes its opens. Deleting a document for good deletes everyone's opens of it; a document in
  the Trash only leaves Home until it is restored.
- An open older than a year is forgotten, the Timeline's retention ([Timeline](timeline.md) §3.5).

## States

Every state keeps the layout it lands in: headings are in place from the first paint, and each section's skeleton
has the size of what replaces it, so nothing shifts (CLS 0).

| State                 | What shows                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Loading               | Each section's skeleton: a strip of thumbnail boxes, three entry rows, four Timeline entries         |
| Jump back in, empty   | "The documents you open most will gather here."                                                      |
| What happened, empty  | "Nothing from others in the last 14 days." (See all activity stays.)                                 |
| Timeline, empty       | "Documents you create, update or open will appear here."                                             |
| Read failed           | "Home could not load. Check your connection and try again." with **Try again**, in place of the body |
| A further page failed | "Could not load more." with **Try again**, in the Timeline's reserved slot                           |

Under reduced motion nothing animates: no skeleton pulse, no chevron turn, no smooth scrolling.

## Telemetry

One-liners on the closed vocabulary ([Telemetry](../017-telemetry/telemetry.md)), never a name or an id:

- `Home·Opened·Landing` / `Nav`: Home shown, as the page the Explorer opened on or after starting elsewhere.
- `Home·Selected·JumpBackIn` / `Timeline` / `WhatHappened`: a document opened from that part of Home.
- `Home·Opened·Group`: a summary entry expanded.
- `Home·Loaded·More` / `Retry`: a further Timeline page loaded, or a failed read retried.

## Help

The help centre's [Home](../../../apps/help/app/explorer/timeline/page.mdx) article describes Home and All activity.

## Accessibility

- Both columns are landmarks with headings (**Recent**, **Timeline**). On a phone the switch's two tabs name them,
  and the headings stay for assistive technology.
- A summary entry's expanded list is the region its disclosure button controls (`aria-controls`).
- The Timeline is a list; each entry is one link, whose name is the document, what happened and when.
- Every thumbnail has a text alternative: the document name and what happened.
- Keyboard order follows the reading order: Jump back in, What happened, then Timeline.
- WCAG 2.2 AA: contrast, visible focus, and targets of at least 24 by 24 px.
