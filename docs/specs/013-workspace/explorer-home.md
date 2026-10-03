# Explorer Home

**Home** is the Explorer's landing view and the first row of the sidebar's Overview group
([Explorer structure](explorer-structure.md)). It answers the two questions a returning person
brings, in one screen: "what was I working on?" and "what happened while I was away?".

## Layout

- **Desktop and tablet** (`md:` and wider): two columns side by side.
  - **Recent** on the left, taking the remaining width.
  - **Timeline** on the right, a fixed-width column. It has **no panel background or border of its own**: it sits
    directly on the page and blends in, set apart only by its heading and its centre line.
- **Phone** (below `md:`): one column with a two-option switch, **Recent** and **Timeline**, at the top of the page.
  - **Recent** is shown by default on every visit.
  - The switch follows the WAI-ARIA tabs pattern: two tabs and one tab panel.
- The page header carries **New document**, as every Explorer section does. Home has no other header actions.

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
  small font, truncated to the thumbnail's width.
- The strip scrolls sideways (touch, trackpad, Shift+wheel, and keyboard focus moving through it). Its trailing
  edge fades to say there is more.

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
  alone: the entry's accessible name states it.
- Activating an entry opens the document.

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
- Offline Mode documents never reach the server, so their opens are not recorded, as with every other server-side
  surface.

### Guests, sign-up and deletion

- Guests have Home in full, keyed to their guest id.
- Signing up moves a guest's opens to the account with the rest of their data ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
  A document opened under both identities keeps both histories: the two frecencies add up.
- Deleting the account deletes its opens. Deleting a document for good deletes everyone's opens of it; a document in
  the Trash only leaves Home until it is restored.
- An open older than a year is forgotten, the Timeline's retention ([Timeline](timeline.md) §3.5).

## Accessibility

- Both columns are landmarks with headings (**Recent**, **Timeline**).
- Every thumbnail has a text alternative: the document name and what happened.
- Keyboard order follows the reading order: Jump back in, What happened, then Timeline.
- WCAG 2.2 AA: contrast, visible focus, and targets of at least 24 by 24 px.
