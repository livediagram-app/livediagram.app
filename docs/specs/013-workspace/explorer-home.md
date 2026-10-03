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

- **One column**, at every width: **Jump back in**, then **What happened**. It scrolls with the page.
- **Headings with a rule** set the sections apart. Each section opens with its heading row: the title (a larger
  heading, about 16 px, bold), the section's quiet link at the right end (**See more**, **See all activity**), and
  a hairline rule under the row (1 px, the page's line colour, spanning the section's width). Generous space (about
  28 px) separates one section from the next.
- No cards and no panel backgrounds: the sections sit directly on the page.
- The page header carries **New document**, as every Explorer section does, and the section's Help link, as every
  section's header does ([Contextual help links](../018-help/contextual-help-links.md)). Home has no other header
  actions: no import, no folder, no view switch.
- The person's own history (what they created, updated or opened) is not on Home: Jump back in holds what they
  reach for, and the full record is All activity's.

## Jump back in

Jump back in is a **[Within reach](../004-interface-design/within-reach.md)** set of the person's documents:
the **4 most used** and the **4 most recent**, no document twice.

- **Most used**: the documents the person used on the most days in the **last 90 days**. A **use day** is a UTC
  day on which they opened the document ([Opens](#opens)), edited it (an edit needs an open, so the days before
  opens were recorded still count, through their edits) or made it ([Making a document](#making-a-document)).
  Equal counts go to the one used most recently.
- **Recent**: the documents the person used most recently, newest first: the latest of their last open, their last
  edit and their making of it. A document that is both shows under **Most used**, and Recent takes the next most
  recent instead.
- **Not empty on day one**: every day the person edited a document before opens were recorded counts as a day
  they opened it, so Most used reflects the work they already did.
- **Making a document is a use**, and a **bulk import is not** ([Making a document](#making-a-document)): what the
  person just made is in Jump back in at once, opened or not, while one big import never pushes everything else
  out of it.
- Only documents the person can open now: never one in the Trash, nor one whose share link has lapsed or whose
  team they have left.
- A document stored only in this browser ([Offline Mode](../006-document/offline-mode.md)) takes part with this
  browser's own record of its opens and edits ([Opens](#opens)), and carries the **Local only** pill on its
  thumbnail, as every other row and card of one does.
- Each document is a small snapshot thumbnail with its name below it in a small font, truncated to the
  thumbnail's width. The full name is its tooltip and accessible name. Activating a thumbnail opens the document.
- **No row titles.** "Jump back in" is the section's only title: the two groups carry no visible label and no
  extra screen-reader label, and their order (most used first, then recent) is left to people's intuition
  ([Design principles: Calm by default](../004-interface-design/design-principles.md)). The documents are one list
  of links, named **Jump back in**, each named by its document's name.
- **See more** opens the **Recent** page: a quiet link at the end of the section's heading row on a desktop or
  tablet, the strip's last tile on a phone. The Recent page is `/explorer/recent`: every document the person can
  open, newest first, with the shared filter chips ([Explorer filters](explorer-filters.md)). Its breadcrumb leads
  back to Home (**Home › Recent**).

### Desktop and tablet

- A **4 by 2 grid** that never scrolls sideways: the top row holds the most used, the bottom row the recent, each
  most used or newest first from the left. The tiles share the section's width equally; the thumbnails keep one
  short height, so the grid's height never depends on the width.

### Phone

- One **sideways-scrolling strip** of at most **8** thumbnails: most used, recent, most used, recent, and so on;
  when one group runs out, the rest of the other follows.
- The strip ends in a **See more** tile, the same size as a thumbnail, that opens the Recent page.
- The strip scrolls sideways (touch, trackpad, Shift+wheel, and keyboard focus moving through it). Its trailing
  edge fades to say there is more, and only while there is more.

### Fewer than 8 documents

- Only the documents that exist are drawn: no empty boxes. A short group leaves the rest of its row blank; with no
  most used document at all, the recent ones take the top row.
- The grid keeps its two rows' height whatever lands in it, so nothing below moves when Home loads.
- With no document at all, the section holds one quiet line: "The documents you use most and last will gather
  here." On a phone the strip still ends in its See more tile.

### Making a document

- **Making a document is a use.** The day a person makes a document is a use day of it, and the moment they make
  it a use, however they make it: the New Document wizard, an import of one document, a duplicate, a copy of a
  document shared with them, or one an AI tool or an API client makes for them. So a document made without being
  opened is in Jump back in at once.
- **Once a day, as ever.** The wizard opens what it makes: the making and the first open fall on one day, which is
  one use day, not two.
- **A bulk import is not a use.** An import that makes **more than one document in one go** (a Microsoft
  Whiteboard export of several boards, several draw.io files, several Excalidraw files) does not mark its
  documents used, so one big import never pushes everything else out of the recent row. They wait on the Recent
  page and in their folder until they are opened or edited. The import of a single document counts as any other
  making does.
- **The create says so.** Creating a document says whether it counts as a use: `markUsed`, true unless the caller
  sends `false` ([API](../015-api/api.md), `POST /api/documents`). The editor's bulk imports send `false`; any API
  client may, and an AI tool's create may too ([MCP server](../015-api/mcp-server.md), `create_document`).
- Moving a document is not making it: saving an [Offline Mode](../006-document/offline-mode.md) document to the
  cloud, or taking a cloud one offline, is no use of it.
- Only makings from when a making began to count are counted: a document made before that joins at its next open
  or edit, as before.
- A document stored only in this browser counts its making in this browser's record ([Opens](#opens)), by the same
  rule: a bulk import of local documents marks none of them used.

## What happened

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
  - beneath it, where the document lives, how many updates there were and the time of the latest ("Platform team ·
    5 updates · 14:05");
  - a chevron;
  - expanding lists every underlying action, newest first: avatar, who, what, a small icon for the kind, and time.
  - The entry is a disclosure button (`aria-expanded`); collapsed is the default, and the state is not remembered.
  - Each expanded action opens the document.
- A one-person entry is a link that opens the document. A comment or reply shows its words beneath, an action its
  name, on one line; then where the document lives and the time.
- "Where the document lives" reads the team's name for a document in a team (whoever reaches it, its owner included)
  or **My documents**, then `›` and the folder when it has one; a
  document shared with the person reads **Shared by** and the owner's name.
- A person without a known name is **Someone**. A summary names at most three people, then "and N others".
- Times are clock times in the person's own time zone and locale (`14:05`, `2:05 PM`), under the day heading that dates
  them.

## Unread

Viewing Home counts as having looked: it moves the Timeline feed's unread mark exactly as the Timeline page does
([Timeline](timeline.md) §2.5), once per visit, and says where the mark stood before, so what is new to the person
can be marked.

- In What happened, an entry newer than that mark carries a **New** pill, as the Timeline's cards do: the word,
  never colour alone. A summary is new when its latest action is.
- A person who has never looked sees none: marking a whole history new would be noise.
- The mark is the one the first read of the visit reports; a retry does not move what is marked.
- The sidebar's Home badge clears when Home has been read.

## Opens

An **open** is the editor loading a document for a person to look at.

- It counts for whoever opens it: the owner, a teammate, or a visitor through a share link. A visitor always has an
  identity (their guest id, or their account), so their open is theirs.
- Its **day** is recorded **once per person per document per day** (UTC, the day boundary every coalesced event
  uses), at the day's first open. Every open, the first of the day or not, moves the person's **last open** of the
  document, which is what Recent reads.
- These are **not** opens: a snapshot or thumbnail, an embed ([Read-only embeds](embeds.md)), a duplicate, Take
  Offline, the Google Drive mirror, and any read through the public API or an AI tool.
- Opens are **private**. Only the person who opened a document ever sees that they did: in their Jump back in, never in What happened, a document's
  History, a team's feed, or the Timeline feed ([Timeline](timeline.md)).
- Offline Mode documents never reach the server, so the server records none of their opens. **This browser counts
  them instead**: the editor opening a document stored only here adds the day to that document's own record in
  this browser, by the same once-per-UTC-day rule, keeping the days of the last 90, and moves its last open. Its
  last edit is the record's own save time. Making a document here starts that record with the day and the moment
  it was made, as an open would, unless it came in a bulk import ([Making a document](#making-a-document)). So
  Jump back in places it among the rest by the same rule. The record lives and dies with the document's local
  record and never leaves the browser.

### Guests, sign-up and deletion

- Guests have Home in full, keyed to their guest id.
- Signing up moves a guest's opens to the account with the rest of their data ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
  A document opened under both identities keeps both histories: its use days are the days of either, and its last
  open the later of the two.
- Deleting the account deletes its opens. Deleting a document for good deletes everyone's opens of it; a document in
  the Trash only leaves Home until it is restored.
- An open older than a year is forgotten, the Timeline's retention ([Timeline](timeline.md) §3.5).

## States

Every state keeps the layout it lands in: headings are in place from the first paint, and each section's skeleton
has the size of what replaces it, so nothing shifts (CLS 0).

| State                 | What shows                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Loading               | Each section's skeleton: the grid's two rows (the phone's strip), three entry rows                   |
| Jump back in, partial | What exists, no empty boxes (see [Fewer than 8 documents](#fewer-than-8-documents))                  |
| Jump back in, empty   | "The documents you use most and last will gather here."                                              |
| What happened, empty  | "Nothing from others in the last 14 days." (See all activity stays.)                                 |
| Read failed           | "Home could not load. Check your connection and try again." with **Try again**, in place of the body |

Under reduced motion nothing animates: no skeleton pulse, no chevron turn, no smooth scrolling.

## Telemetry

One-liners on the closed vocabulary ([Telemetry](../017-telemetry/telemetry.md)), never a name or an id:

- `Home·Opened·Landing` / `Nav`: Home shown, as the page the Explorer opened on or after starting elsewhere.
- `Home·Selected·JumpBackIn.MostUsed` / `JumpBackIn.Recent`: a document opened from Jump back in, by the group it
  belongs to (most used or recent), wherever it sits.
- `Home·Selected·JumpBackIn.SeeMore`: See more followed to the Recent page (the link or the phone's tile).
- `Home·Selected·WhatHappened`: a document opened from What happened.
- `Home·Opened·Group`: a summary entry expanded.
- `Home·Loaded·Retry`: a failed read retried.

## Help

The help centre's [Home](../../../apps/help/app/explorer/timeline/page.mdx) article describes Home (Jump back in, What happened) and All activity.

## Accessibility

- Each section is a landmark (`section`) named by its heading (**Jump back in**, **What happened**).
- Jump back in's documents are one list named **Jump back in**; each document is one link named by its document's
  name (plus **Local only** for a document stored only here). No row or group carries a label of its own.
- A summary entry's expanded list is the region its disclosure button controls (`aria-controls`).
- Keyboard order follows the reading order: See more (desktop and tablet), Jump back in's documents in their order
  (then the See more tile on a phone), then What happened.
- WCAG 2.2 AA: contrast, visible focus, and targets of at least 24 by 24 px.
