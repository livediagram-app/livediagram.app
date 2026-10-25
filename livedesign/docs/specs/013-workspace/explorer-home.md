# Explorer Home

**Home** is the Explorer's landing view and the first row of the sidebar's Overview group
([Explorer structure](explorer-structure.md)). It answers the two questions a returning person
brings, in one screen: "what was I working on?" and "what happened while I was away?".

## Route

- Home lives at `/explorer/home`. `/explorer`, and any Explorer URL that names no view, lands on it.
- The **Timeline** ([Timeline](timeline.md)) lives at `/explorer/timeline`, with a sidebar row of its own under the
  Inbox ([Explorer structure](explorer-structure.md)). What Happened's **See Timeline** link also opens it; its
  breadcrumb is its own (**Timeline**).

## Layout

Home reads as the front page of the person's work, in the marketing site's visual language: the dotted
backdrop, a heavy display heading, pills with a coloured dot, the glowing search field and the pictures of what it makes
([Design principles](../004-interface-design/design-principles.md)).

- **The hero** opens the page ([The hero](#the-hero)): a full-width band under the Explorer header, above the
  sidebar and the sections. It is Home's page header; Home has no other.
- **One column** under it, beside the sidebar, at every width: **Jump Back In**, then **What Happened**. It scrolls
  with the page.
- **Display headings** set the sections apart. Each section opens with its heading row: the title (about 24 px,
  extra bold, tight tracking) and the section's quiet link at the right end (**See More**, **See Timeline**). No rule
  runs under the row. Generous space (about 40 px) separates one section from the next.
- Jump Back In's designs are **cards** ([Jump Back In](#jump-back-in)); What Happened's days sit in **one panel**
  (a white, rounded, hairline-bordered surface; the raised surface in dark mode).
- Home has no import, no folder and no view switch.
- The person's own history (what they created, updated or opened) is not on Home: Jump Back In holds what they
  reach for, and the full record is the Timeline's.

## The hero

A band the page's full width, under the Explorer header and above the sidebar and Home's sections, on Home only. Its
ground is the marketing hero's: a soft rose wash under a dotted grid, a hairline under it. In dark mode it is the
[Midnight](../004-interface-design/color-scheme.md#explorer-midnight) ground with a soft rose glow from the top.
Its content sits in the Explorer's content width.

Top to bottom, left column:

- **Status pills**, two, each a link with a coloured dot:
  - the person's designs: "1 design" / "N designs" (My Work, the person's own space, this browser's
    designs in This Browser not counted), opening **My Work**; a green dot;
  - the Inbox: "Inbox is clear" when no open action is assigned to the person, else "N open in your Inbox", the
    sidebar's Inbox count ([Inbox](inbox.md)), opening the **Inbox**; a sky dot.
  - A pill is drawn once its count is known: never "0 designs" while the lists load or after the list failed to, nor "Inbox is clear" for an
    Inbox that has not loaded or failed to.
- **The greeting**, the page's `h1`: "Good morning.", "Good afternoon." or "Good evening." by the reader's local
  hour (5 to 11 morning, 12 to 17 afternoon, else evening), then "What are we picking up?". Large display type
  (about 56 px on a desktop, 36 px on a phone), extra bold, tight tracking. The tab's title stays **Home**.
- **The lead**: "Jump back into what you use most, or see what changed while you were away."
- **The search field**: the Explorer's lens field ([Explorer filters](explorer-filters.md#the-field)) drawn large
  (60 px high, a 2 px rose edge and a soft rose glow), with **New Design** as a solid button inside its right end.
  On Home it is the only lens field: the header's is not drawn, so the page never shows two. Typing in it opens
  Search results, as the header's field does from Home, and the header's field there takes the focus with the caret
  after what was typed, so the typing carries on uninterrupted.

Beside the field (from `lg` up) or under it, the hero shows **what livedesign makes**: a **Logo**, an **App
Wireframe**, a **Web Wireframe** and a **Photo**, each a small picture in livedesign's rose with its name, laid out
as every app's are ([one-explorer.md](../../../../liveworkspace/docs/one-explorer.md) "What you can make, on Home's hero"). Each starts one (`/new?template=` `blank-logo`, `blank-wireframe-phone`,
`blank-wireframe-browser`, `photo-edit`). **Nothing is fetched** to draw them.

**It comes and goes with Home.** Leaving Home for another Explorer page folds the hero away (its height to nothing as
it fades), and the page under it slides up; returning to Home unfolds it again. Each runs over the `long` motion token
(250 ms), driven by the reader's own navigation ([Motion](../004-interface-design/motion.md) "Layout stability").
Landing on Home from outside the Explorer shows it at once, with no animation. Under reduced motion it appears and
goes at once. While folding away it takes no focus.

The hero's top right holds Home's **Help** link ([Contextual help links](../018-help/contextual-help-links.md)). On a
phone (below `sm`) its top left holds the menu button that opens the [mobile drawer](explorer-structure.md#mobile-drawer).

## Hiding the banner

Next to Help, wherever the hero puts it (a phone's row, the pills' row, the wide top right), sits a **close** (an ×
button the size of Help, named and tooltipped "Hide Home Banner"). Pressing it hides the hero for good, as the
synced `homeBanner` preference set to `false`
([User preferences](../007-editor/user-preferences.md)), on every device the person signs in on. It folds away as it
does on leaving Home. **Settings > Designs > Explorer > Show Home Banner** turns it back on. Either flip reports
`UI / Toggled / HomeBannerOff` or `HomeBannerOn` before the preference is written.

With the banner hidden, Home is drawn like every other Explorer page:

- the **header's search field** is drawn on Home too ([Explorer filters](explorer-filters.md#the-field)), so the page
  still has exactly one lens field;
- Home takes the ordinary **page header** (the title "Home", its Help link, New Design and, on a phone, the menu
  button), so it keeps its `h1`;
- Jump Back In and What Happened, or a first run's sections, follow as before.

One reading, the `homeBanner` preference, which the editor's Explorer host hands the shared Explorer as
`heroHidden` (`apps/live/app/embed/workbench/ExplorerHost.tsx`), decides all three, so Home never shows two fields or
none. The banner's first-run words and template search go with it; the first run's sections under it stay.

## First run

A person with **nothing yet** gets a Home that starts them off instead of one that waits for history. "Nothing yet"
means, once the Explorer's lists have loaded: no design of their own, none shared with them, none in any team
they belong to, and none stored only in this browser. Until the lists load, Home's body is the ordinary Home (its
skeletons); it never guesses. A list that failed to load says nothing about them, so it is never "nothing yet": Home
stays the ordinary Home, and the browser's remembered answer is left as it was. The moment they have a design, Home
is the ordinary Home again.

The hero's words can't wait on the lists without a flash, so the hero draws the answer this browser last saw: it
remembers, per person, whether they had anything, and until the lists land it greets them by that. A person this
browser has never seen is greeted as new, which a newcomer is; before a guest's identity resolves, the browser's
last answer stands for whoever is here. Only a first run fetches the welcome's template previews.

The hero speaks to a beginning:

- **Pills** say what is true of every start and are not links: "Free and open source" (green dot) and, for a guest,
  "No sign-up to start" (sky dot); for someone signed in, "Saved to your account".
- **The greeting** is "Welcome to livedesign. What are you making first?".
- **The lead** is "Pick a starting point, or search the templates. Whatever you make lands here, ready to pick up
  again."
- **The field searches templates**, not designs (there are none): its placeholder is "Search templates", and
  Enter opens the New Design wizard with the words in its template search (`/new?q=`). Inside its right end,
  **Start Blank** makes a blank Pages design with its start closed (`/new?start=blank`).
- **What it makes**: the same four pictures as the ordinary hero, so a first run shows what can be made.

Under it, beside the sidebar, Home holds three sections in place of Jump Back In and What Happened:

- **Start Blank**: the Pages blanks (Blank Logo, the blank wireframes, Photo Edit and the rest), each a card with its preview,
  title and one-line description. Activating one makes
  that blank at once (`/new?template=<kind>`).
- **Popular Templates**: the first eight non-blank templates of the shared Popular list, as large cards with their
  previews, titles and descriptions; activating one makes it at once. A quiet **Browse All Templates** link in the
  heading row opens the wizard (`/new`).
- Every start card shows its **whole title and description**, wrapped onto as many lines as they need and never
  cut short with an ellipsis, at every width; the cards in a row stand as tall as the tallest of them.
- **Already Have Work?**, for a guest on a deployment with sign-in only: **Nothing here yet? Sign in**: "If you have
  used livedesign before, sign in and your designs come back with you." with a **Sign In** button. A signed-out
  person who expected their work finds the way back first.

The welcome's previews are loaded only for a person with nothing yet, so everyone else's Home pays nothing for
them. It follows the share-role rule trivially: it is the person's own Home, with no shared design in reach.

## Jump Back In

Jump Back In is a **[Within reach](../004-interface-design/within-reach.md)** set of the person's designs:
the **4 most used** and the **4 most recent**, no design twice.

- **Most Used**: the designs the person used on the most days in the **last 90 days**. A **use day** is a UTC
  day on which they opened the design ([Opens](#opens)), edited it (an edit needs an open, so the days before
  opens were recorded still count, through their edits) or made it ([Making a design](#making-a-design)).
  Equal counts go to the one used most recently.
- **Recent**: the designs the person used most recently, newest first: the latest of their last open, their last
  edit and their making of it. A design that is both shows under **Most Used**, and Recent takes the next most
  recent instead.
- **Not empty on day one**: every day the person edited a design before opens were recorded counts as a day
  they opened it, so Most Used reflects the work they already did.
- **Making a design is a use** ([Making a design](#making-a-design)): what the person just made is in Jump
  Back In at once, opened or not.
- Only designs the person can open now: never one in the Trash, nor one whose share link has lapsed or whose
  team they have left.
- A design stored only in this browser ([Offline Mode](../006-design/offline-mode.md)) takes part with this
  browser's own record of its opens and edits ([Opens](#opens)), and carries the **This Browser** pill on its
  thumbnail, as every other row and card of one does.
- Each design is a **card**: its snapshot thumbnail, its name, and one quiet line that says why it is there.
  The full name is its accessible name, and no tooltip repeats the name written under the picture; the quiet line is
  its description. Activating a card opens the
  design.
  - A most used design's line counts its use days: "Used on 1 day", "Used on N days".
  - A recent design's line says when the person last used it: "Used 2 hours ago", "Used yesterday" (the
    Explorer's relative time).
- **Each card has the design's ⋯ menu**, the same menu its row and card carry everywhere else in the Explorer
  (Rename, Duplicate, Move, Favourite, History, Delete and the rest; a design shared with you gets the
  shared-with-you menu), so it can be changed from Home without opening it. A ⋯ button opens it: at the top right of
  a large card's thumbnail, at the right end of a compact card, and at the top right of a phone tile's thumbnail. A
  right-click anywhere on the card opens it too. Under a mouse the button shows while the card is hovered or has
  keyboard focus; on touch it always shows. It is a button beside the card's link, never inside it.
  - The menu opens **beside the card**, out of its way, never over it: to the card's right with its top level with
    the card's, or to its left when the right has no room. Only when neither side has room (a phone, a narrow
    window) does it hang below the ⋯ as other menus do. Either way it stays inside the window. The ⋯ and a
    right-click open it in the same place.
  - **Rename** edits the name in place on the card, as on an Explorer card; while renaming, the card does not open.
  - What changes shows at once: a renamed design shows its new name, and a design moved to the Trash or taken
    off Shared With Me leaves Jump Back In (and comes back if the move is undone).
  - The menu is the Explorer's own, so it offers each design what the Explorer does and nothing more
    ([Share roles](share-roles.md)): your own and your team's designs get the full menu, and one
    shared with you gets the shared-with-you menu.
  - A design the Explorer has not loaded (a team library the sidebar has not read yet) has no ⋯: a menu that
    guesses is worse than none, and the card still opens on click.
- **Two labelled groups** on a desktop or tablet: a small uppercase label, **Most Used** then **Recent**, over each.
  The designs are one list of links named **Jump Back In**; each group's label is its own list's name.
- **See More** opens the **Recent** page: a quiet link at the end of the section's heading row on a desktop or
  tablet, the strip's last tile on a phone. It shows only once Jump Back In has a design: not while it loads, and
  not when it is empty. The Recent page is `/explorer/recent`: every design the person can
  open, most recently saved first (a save by anyone), not by the person's own use as Jump Back In's recent
  group is, with the shared filter chips ([Explorer filters](explorer-filters.md)). Its breadcrumb leads
  back to Home (**Home › Recent**).

### Desktop and tablet

- **Most Used** first: up to 4 large cards (a white, rounded, hairline-bordered card; the thumbnail 128 px high
  inside it, the name in semibold and the quiet line under it), most used first from the left.
- **Recent** under it: up to 4 cards the size of Most Used's (the thumbnail above the name and the quiet line), newest first, so every card in Jump Back In reads, opens and drags alike.
- Four across from the `lg` breakpoint; two across below it. Nothing scrolls sideways.
- A card lifts a little on hover (a rose edge and a soft rose shadow), within the motion budget.

### Phone

- One **sideways-scrolling strip** of at most **8** thumbnails: most used, recent, most used, recent, and so on;
  when one group runs out, the rest of the other follows. The strip interleaves the groups, so it carries no group
  labels and no quiet lines: each tile is its thumbnail and name.
- The strip ends in a **See More** tile, the same size as a thumbnail, that opens the Recent page.
- The strip scrolls sideways (touch, trackpad, Shift+wheel, and keyboard focus moving through it). Its trailing
  edge fades to say there is more, and only while there is more.

### Fewer than 8 designs

- Only the designs that exist are drawn: no empty boxes. A short group leaves the rest of its row blank; a group
  with no design at all is not drawn, label included.
- Jump Back In keeps both groups' height whatever lands in it, so nothing below moves when Home loads.
- With **no design at all** it looks as if it held one: a single slot the size and place of one most used card
  (the first column, a dashed edge), holding the empty state ("No designs yet", "The designs you use most and last
  will gather here."), and no group labels. Only then is Jump Back In shorter than its reserved height: What Happened
  sits under the one row.
- On a phone with no design at all, the strip holds the small [empty state](../004-interface-design/empty-states.md)'s
  heading alone, the size of one tile, and no See More tile.

### Making a design

- **Making a design is a use.** The day a person makes a design is a use day of it, and the moment they make
  it a use, however they make it: the New Design wizard, a duplicate, a copy of a
  design shared with them, or one an AI tool or an API client makes for them. So a design made without being
  opened is in Jump Back In at once.
- **Once a day, as ever.** The wizard opens what it makes: the making and the first open fall on one day, which is
  one use day, not two.
- **The create says so.** Creating a design says whether it counts as a use: `markUsed`, true unless the caller
  sends `false` ([API](../015-api/api.md), `POST /api/designs`). The editor never sends it; any API
  client may, and an AI tool's create may too ([MCP server](../015-api/mcp-server.md), `create_design`).
- Moving a design is not making it: saving an [Offline Mode](../006-design/offline-mode.md) design to the
  cloud, or taking a cloud one offline, is no use of it.
- Only makings from when a making began to count are counted: a design made before that joins at its next open
  or edit, as before.
- A design stored only in this browser counts its making in this browser's record ([Opens](#opens)), by the same
  rule.

## What Happened

- What **other people** did to designs the person can open, grouped under day headings (**Today**, **Yesterday**,
  then the date). The days are the person's own (their time zone), and the section covers the last **14 days**.
- "Designs the person can open" are the ones they own, the ones in a team they have joined, and the ones shared
  with them through a link that is still live. A link scoped to one tab ([Tab-scoped share links](tab-scoped-share-links.md))
  shows nothing here: the actions name things on tabs the link does not reach.
- "Other people" are everyone but the person, under any identity they have had (a guest id before sign-up counts as
  theirs).
- The actions and their verbs are a closed set, in this order wherever several are named:

  | Action                                       | Verb phrase            |
  | -------------------------------------------- | ---------------------- |
  | A comment that starts a thread               | commented              |
  | A comment on a thread that already had one   | replied                |
  | A thread resolved                            | resolved a thread      |
  | A day of edits (one per person per day)      | edited                 |
  | An action assigned to the person             | assigned you an action |
  | An action assigned to anyone else            | assigned an action     |
  | An action completed                          | completed an action    |
  | The design published into one of their teams | shared                 |

- Opens are never listed here: whether someone looked at a design is theirs to know, not the reader's.
- **No filter controls** sit in or above this section. It stays clean; the shared filters live on the other
  Explorer views ([Explorer filters](explorer-filters.md)).
- **Nothing from anyone, no section.** When nobody else did anything in the window, What Happened is left out of the
  page entirely, heading included, rather than set a second empty state under Jump Back In's. While it loads, its
  heading and skeleton hold its place.
- A quiet **See Timeline** link beside the section's heading opens the **Timeline**, shown only once What Happened
  has an entry (not while it loads, not when it is empty), where
  everything that happened, the person's own doings included, can be filtered and paged.
- Every entry is **spot on**. It names:
  - who acted;
  - what they did, as a plain verb phrase (commented, replied, resolved a thread, edited, assigned you an action,
    shared);
  - which design;
  - where the design lives (its space and folder).
- One design's actions on one day form a **group**. A group with one person is shown as that person's entries,
  one per action.
- **Several actions on one design by more than one person collapse into one entry**, a **summary sentence that
  expands**:
  - the people's avatars, overlapped, then one sentence naming them and what they did, e.g. "Priya, Sam and Lee
    commented, edited and assigned you an action in **Payments architecture**";
  - beneath it, where the design lives, how many updates there were and the time of the latest ("Platform team ·
    5 updates · 14:05");
  - a chevron;
  - expanding lists every underlying action, newest first: avatar, who, what, a small icon for the kind, and time.
  - The entry is a disclosure button (`aria-expanded`); collapsed is the default, and the state is not remembered.
  - Each expanded action opens the design.
- A one-person entry is a link that opens the design. A comment or reply shows its words beneath, an action its
  name, on one line; then where the design lives and the time.
- "Where the design lives" reads the team's name for a design in a team (whoever reaches it, its owner included)
  or **My Work**, then `›` and the folder when it has one; a
  design shared with the person reads **Shared by** and the owner's name.
- A person without a known name is **Someone**. A summary names at most three people, then "and N others".
- Times are clock times in the person's own time zone and locale (`14:05`, `2:05 PM`), under the day heading that dates
  them.

## Unread

Viewing Home counts as having looked: it moves the Timeline feed's unread mark exactly as the Timeline page does
([Timeline](timeline.md) §2.5), once per visit, and says where the mark stood before, so what is new to the person
can be marked.

- In What Happened, an entry newer than that mark carries a **New** pill, as the Timeline's cards do: the word,
  never colour alone. A summary is new when its latest action is.
- A person who has never looked sees none: marking a whole history new would be noise.
- The mark is the one the first read of the visit reports; a retry does not move what is marked.
- The sidebar's Home badge clears when Home has been read.

## Opens

An **open** is the editor loading a design for a person to look at.

- It counts for whoever opens it: the owner, a teammate, or a visitor through a share link. A visitor always has an
  identity (their guest id, or their account), so their open is theirs.
- Its **day** is recorded **once per person per design per day** (UTC, the day boundary every coalesced event
  uses), at the day's first open. Every open, the first of the day or not, moves the person's **last open** of the
  design, which is what Recent reads.
- These are **not** opens: a snapshot or thumbnail, an embed ([Read-only embeds](embeds.md)), a duplicate, Take
  Offline, and any read through the public API or an AI tool.
- Opens are **private**. Only the person who opened a design ever sees that they did: in their Jump Back In, never in What Happened, a design's
  History, a team's feed, or the Timeline feed ([Timeline](timeline.md)).
- Offline Mode designs never reach the server, so the server records none of their opens. **This Browser counts
  them instead**: the editor opening a design stored only here adds the day to that design's own record in
  this browser, by the same once-per-UTC-day rule, keeping the days of the last 90, and moves its last open. Its
  last edit is the record's own save time. Making a design here starts that record with the day and the moment
  it was made, as an open would ([Making a design](#making-a-design)). So
  Jump Back In places it among the rest by the same rule. The record lives and dies with the design's local
  record and never leaves the browser.

### Guests, sign-up and deletion

- Guests have Home in full, keyed to their guest id.
- Signing up moves a guest's opens to the account with the rest of their data ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
  A design opened under both identities keeps both histories: its use days are the days of either, and its last
  open the later of the two.
- Deleting the account deletes its opens. Deleting a design for good deletes everyone's opens of it; a design in
  the Trash only leaves Home until it is restored.
- An open older than a year is forgotten, the Timeline's retention ([Timeline](timeline.md) §3.5).

## States

Every state keeps the layout it lands in: headings are in place from the first paint, and each section's skeleton
has the size of what replaces it, so nothing shifts (CLS 0). The one exception is a person with no design at all:
Jump Back In's single empty slot is shorter than the skeleton, so What Happened rises once, on a page with nothing
else on it.

| State                 | What shows                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Loading               | Each section's skeleton: both groups' cards (the phone's strip), three entry rows in the panel                 |
| Jump Back In, partial | What exists, no empty boxes (see [Fewer than 8 designs](#fewer-than-8-designs))                                |
| Jump Back In, empty   | One card-sized slot: empty state "No designs yet": "The designs you use most and last will gather here."       |
| What Happened, empty  | The section is left out: no heading, no link, no empty state. It is the page's last section, so nothing moves. |
| Read failed           | "Home could not load. Check your connection and try again." with **Try again**, in place of the body           |

Under reduced motion nothing animates: no skeleton pulse, no chevron turn, no smooth scrolling.

## Telemetry

One-liners on the closed vocabulary ([Telemetry](../017-telemetry/telemetry.md)), never a name or an id:

- `Home·Opened·Landing` / `Nav`: Home shown, as the page the Explorer opened on or after starting elsewhere.
- `Home·Selected·JumpBackIn.MostUsed` / `JumpBackIn.Recent`: a design opened from Jump Back In, by the group it
  belongs to (most used or recent), wherever it sits.
- `Home·Selected·JumpBackIn.SeeMore`: See More followed to the Recent page (the link or the phone's tile).
- `Home·Selected·WhatHappened`: a design opened from What Happened.
- `Home·Opened·Group`: a summary entry expanded.
- `Home·Loaded·Retry`: a failed read retried.
- `Home·Opened·Welcome`: the first-run Home shown.
- `Home·Selected·Welcome.Blank` / `Welcome.Template` / `Welcome.AllTemplates` / `Welcome.Search` /
  `Welcome.StartBlank` / `Welcome.SignIn`: a start taken from it (a blank card, a template card, Browse All
  Templates, a template search, the field's Start Blank, Sign In).

## Help

The help centre's [Home](../../../apps/help/app/explorer/timeline/page.mdx) article describes Home (Jump Back In, What Happened) and the Timeline.

## Accessibility

- Each section is a landmark (`section`) named by its heading (**Jump Back In**, **What Happened**).
- Jump Back In's designs are one list named **Jump Back In**; each design is one link named by its design's
  name (plus **This Browser** for a design stored only here). No row or group carries a label of its own.
- A summary entry's expanded list is the region its disclosure button controls (`aria-controls`).
- Keyboard order follows the reading order: See More (desktop and tablet), Jump Back In's designs in their order
  (then the See More tile on a phone), then What Happened.
- WCAG 2.2 AA: contrast, visible focus, and targets of at least 24 by 24 px.
