# Public roadmap

A **public roadmap** is one Plan board published as a live, read-only page anyone can open without an account: the
columns the team chooses (Planned, In Progress, Shipped), the card types it chooses and, on each card, only the fields
on the roadmap's allowlist. Visitors upvote ideas, one vote per browser, and suggest new ones through a form the plan
already has. Product teams use it to answer "is X coming?" once, in public, and to hear what customers want most
(Work Tracker 936; competitors: Canny, Productboard Portal, Trello public boards).

It is a new anonymous read and write surface on plan data, so its first rule is the allowlist: the public route sends
the fields listed under [What a visitor sees](#what-a-visitor-sees) and nothing else, whatever the card holds.

## Domain language

| Term                | Meaning                                                                                    | Not                         |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| **public roadmap**  | One board published as a public page: its chosen columns, card types and fields            | public board, portal        |
| **roadmap link**    | The page's address, `/roadmap/<plan id>/<roadmap code>`, the same for as long as it is up  | share link, embed           |
| **roadmap code**    | The random part of the link (`lpr_…`); kept as it is, since the link is meant to be shared | token, password             |
| **roadmap fields**  | The card fields the roadmap shows, chosen from the allowlist                               | columns, properties         |
| **upvote**          | One browser's vote for one card on the roadmap, taken back by pressing again               | dot, like                   |
| **suggestion form** | A Form tab of the plan whose link the page offers as **Suggest an Idea**                   | feedback widget, idea board |
| **Unpublish**       | Takes the roadmap down: its link answers "not available" at once                           | delete, archive             |

## Who may publish

- **The plan's owner and the members of its team** (ownership, [share-roles.md](../013-workspace/share-roles.md)
  "Ownership"): publishing widens who sees the plan beyond anyone the owner shared it with, as sharing does, so it is
  never an access level's. A guest owner may publish (the planner works without signing in).
- **Never through a share link**, at any level: an Editor, a Participant and a Viewer neither see Publish Roadmap
  nor may call its routes. Nor a grant confined to one tab, an API token or a workbench session (a delegated caller
  never opens a lasting public door). The api refuses them with 403 `roadmap_needs_owner`, so the menu row is
  presentation, never the rule.
- **A plan kept Offline** has no server to answer the page, so it offers no row.

## Publish Roadmap

(Named **Publish as Roadmap** until 2026-11-19, owner.)

### Where it lives

**Publish Roadmap** in the footer's **Tools** menu, in Collaborate beside Subscribe to Calendar (owner, 2026-11-17;
no longer in the tab menu), for someone who may publish, on a plan with at least one Plan board on any tab. It opens
inside Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md). At the top, **Tab** lists the plan's tabs holding
a Plan board as pills (a board glyph, the tab's name, a green dot where a board on it is published), starting on the
tab in view when it holds one (else the first); **Board** pills under it show when the chosen tab holds several.
Changing the tab starts on its first board. The Card Types offered are the chosen board's own (the types it shows).

### The dialog

A centred dialog (a bottom sheet on a phone) titled **Publish Roadmap**, subtitled "A public page of the cards you
choose.", in two states:

- **Not published**: the roadmap's settings (below) and **Publish Roadmap**.
- **Published**: "Your roadmap is live." with the link in a read-only field, **Copy Link** and **Open Roadmap** (a new
  tab), the settings, which save as they change (the link kept), and **Unpublish** behind a confirm: "Unpublish this
  roadmap? Its link stops working at once. Publishing again makes a new link."

Under the settings, in the dialog's warning tone: "Anyone with the link can see the chosen columns, card types and
fields. People, comments and other fields are never shown."

While it reads, a quiet loading row; when the read fails, "Couldn't load your roadmap." with **Try Again**. When a
write fails, the dialog stays as it was and says "Couldn't save. Try again."

### The settings

- **Title**: the page's heading, the board's title to begin with (1 to 80 characters).
  Columns, Card Types and Fields are each a collapsed section (owner, 2026-11-17), and only one opens at a time, so
  the page stays short. Closed, a section's head shows its name, what is on as a line of names ("Needs Info, Confirmed,
  Won't Fix +1") and a count ("4/5"); open, a hint, **All** and **None**, and a card of rows, each a glyph, its name and
  a switch. Past eight rows the card gains a filter field and scrolls inside itself. The last one on cannot be switched
  off (its tooltip says why).

- **Columns**: the board's columns, each with its colour dot. To begin with every column is on except those whose name
  reads like triage (Under Review, Inbox, Backlog, Triage, Ideas, To Review, New, Suggestions), so suggestions stay
  hidden until the team moves them. At least one.
- **Card Types**: the types the board shows, each with its glyph, all on to begin with. At least one. Hidden when the
  board shows one type.
- **Fields**: the allowlist below, each with its glyph and a line saying what it shows; **Title** always shows (no
  row). To begin with only **Description** is on.
- **Voting**: on to begin with: visitors may upvote. **Votes is added for you, never offered**: once the roadmap is
  published with Voting on, every chosen card type that has no **Votes** field, or has it but not on its card face,
  gets the built-in Votes field, placed in its Detailed card's Footer, as one change to the plan's card types (one
  undo step), so the team sees each card's count and can sort by it. It happens at **Publish Roadmap**, when a
  published roadmap gains a type or has Voting turned back on, and when the dialog opens on a published roadmap whose
  types lack it (one published before this rule). A line under the toggle says so once ("Project cards now show their
  votes."). Nothing is added while the roadmap is only a draft, or with Voting off, and a type is tried once per
  opening, so a save that does not take is not repeated. The board's own Roadmap preset needs nothing: its Project
  type carries Votes from the start ([items.md](items.md) "Item types").
- **Suggest an Idea**: **None**, or one of the plan's published forms whose responses become cards in a column the
  roadmap does not show. A form whose responses would land in a shown column is listed but cannot be picked, with
  "Its cards would show on the roadmap at once."; a form with no live link or one sending to a Sheet is not listed.
  Its last option, **＋ Create a Suggestion Form**, shown while a column is hidden, makes a "Suggest an Idea" Form
  tab after the board's tab (its cards land in the first hidden column as the first type shown), publishes its link
  and picks it, without leaving the page. On a roadmap not yet out it is made when **Publish Roadmap** is pressed (the
  line under it says so); on one already out, at once.

An **All Cards** board or an archive board has no columns to choose, so it cannot be published (the dialog says "This
board has no columns to publish.").

### On the board

A published board says so in its own header, as a board a form sends its responses to shows its Form strip
([forms.md](../030-forms/forms.md) "Hearing about responses"), so the team sees at a glance which board is out in
public (Work Tracker 1312, owner 2026-11-19):

- **The Roadmap pill** leads the board's widgets, after any Form pills (in the header, or in the band's controls card
  when the board fills its tab), shown with no one adding it, in the Form pill's shape: the megaphone glyph (Publish
  Roadmap's own), the word **Roadmap**, a green dot (its state read out, "Published"), then three buttons, each with a
  tooltip: **Copy Roadmap Link** (it reads "Copied"), **Open Roadmap** (the public page in a new tab; its tooltip names
  the roadmap, "Open Product Roadmap", as a Form pill's Open names its form) and **Roadmap
  Settings** (a cog: Publish Roadmap opens on this board, its tab and board picked, the same dialog as Tools'). It is
  not a stored widget: it comes with **Publish Roadmap** and goes with **Unpublish**, at once, from whichever door
  the dialog was opened by, and a settings change (a new title) shows on it as it saves.
- **Who sees it**: only someone who may publish ([Who may publish](#who-may-publish): the plan's owner and its team
  members, in person). A share-link holder at any level, an Editor included, sees no pill, so the board tells them
  nothing it did not before; the public page is still theirs to open from its link, like anyone's. (The Form pill
  shows to everyone the board shows, since its Form tab is theirs to open too; a roadmap has no tab of its own.)
  Offline, embedded and workbench plans have no roadmap, so no pill.
- **It keeps the widgets their room**: it shows the word Roadmap, never the title (the board's own title is beside
  it, and a roadmap starts with the board's title), so a board with a Form pill and a roadmap still shows its card
  type chips and widgets on a desktop header; the roadmap's title is the pill's accessible name ("Product Roadmap,
  published roadmap") and Open Roadmap's tooltip. Short of room it gives way as the Form pill does. **On a phone**,
  whose header has room for about one pill, it is one button: the megaphone with its green dot, named "Product
  Roadmap, published roadmap. Roadmap settings", with the tooltip Roadmap Settings, opening the dialog (which has
  the link, Copy Link and Open Roadmap). A Form pill beside it leaves its Copy Form Link to the Form tab there, so
  it keeps its count and Open Form, and neither runs under the top-right corner card.
- A board in a Dashboard slot has no pill until it is maximised from the slot, as it has no Form strip.
- **How it knows**: one read of the plan's roadmaps (the managing `GET`, [below](#managing-a-roadmap-signed-in-routes)),
  the first time a board header is drawn for someone who may publish, kept for as long as the plan is open and
  shared by every board's header; the dialog's own Publish, changes and Unpublish update it, so it is never read
  again per header or per render. A read that fails shows no pill and is not retried until the plan is opened again.
  A roadmap published from another browser shows the next time the plan is opened.

### Telemetry

Counts only, never a plan, a board, a column or a link: the dialog opened (UI·Opened·Roadmap), a roadmap published
(Plan·Created·Roadmap), its settings changed (Plan·Changed·Roadmap), its link copied (Plan·Copied·Roadmap) and
unpublished (Plan·Ended·Roadmap), and a suggestion form made by Create a Suggestion Form (Form·Created·Roadmap). The
board's Roadmap pill counts its Copy Roadmap Link as the dialog's Copy Link (Plan·Copied·Roadmap) and its Roadmap
Settings as the dialog opening (UI·Opened·Roadmap).

## What a visitor sees

The page at the roadmap link, in the board tab's look (its theme's backdrop and accent, its finish and font, as a form
on its tab is drawn): the title, **Suggest an Idea** when the roadmap has a suggestion form, then the chosen columns in
the board's order, each with its name, its card count and its cards in the board's order (its Sort Cards when set,
else rank). On a phone the columns stack; on a wider screen they sit side by side and scroll sideways.

### The allowlist

A card on the roadmap is a **live card** (not archived, not in the Trash) whose status is one of the chosen columns'
and whose type is one of the chosen types the board shows. Of it, the public route sends:

| Field           | Sent                       | Shown                                                             |
| --------------- | -------------------------- | ----------------------------------------------------------------- |
| card id         | always (the vote names it) | never                                                             |
| **Title**       | always                     | the heading (`Untitled` for none)                                 |
| **Votes**       | when Voting is on          | the vote button's count: the card's Votes total, never who voted  |
| **Description** | when chosen (default)      | as plain text, up to 1,000 characters, three lines with Show More |
| **Number**      | when chosen                | `#12` before the title                                            |
| **Card Type**   | when chosen                | the type's name as a chip                                         |
| **Labels**      | when chosen                | chips                                                             |
| **Start Date**  | when chosen                | "Starts 3 Mar 2027" (a day)                                       |
| **Due Date**    | when chosen                | "Target 14 Apr 2027" (a day)                                      |

**Never sent**, whichever fields are chosen: people (Assignee, every Person field, who made or last edited a card,
who voted), comments and comment threads, custom fields of every kind, Priority, Estimate, Checklist, Attachments and
covers, Parent, card links and Blocked By, pull requests, history, the card's status, rank and stamps, the plan's
name, the other columns (not even their names or how many cards they hold) and cards of types not chosen.

A column holds at most **200 cards** on the page, the first 200 in the board's order; the count shows the column's
full number of live cards of the chosen types.

### Upvotes

- Each card has a vote button with its count. Pressing it gives the card this browser's vote; pressing it again takes
  it back. The button shows which cards this browser has voted for, from the api, not from memory.
- **One vote per browser per card**: the browser is a random key the page keeps in local storage (never an account,
  a cookie or an address). A visitor who clears it can vote again; that is the price of no sign-in, kept small by the
  limits below.
- A vote lands in the card's built-in **Votes** field as its own voter (`rv:` and a hash of the plan and the browser
  key, so a browser is not followed from one plan to another), beside any session votes, so the card face's ▲ count
  and the board's **Sort Cards** by Votes include it ([plan-board.md](plan-board.md) "Sort Cards"). A card holds at
  most 500 voters, session and public together ([items.md](items.md) "Tally"); past it the page says "This idea has all the
  votes it can take."
- **Limits, as forms are** ([forms.md](../030-forms/forms.md) "Abuse and limits"): 60 votes a minute from one network
  and 60 reads a minute, each on its own key; 500 votes an hour to one roadmap from everyone (past it `429
roadmap_busy`, "Voting is busy. Try again in a few minutes."); a hidden field the page never fills, a vote that
  fills it answered as a success and dropped.
- With Voting off, the page draws no vote button and the vote route answers `404`.

### Suggest an Idea

A button under the title opening the suggestion form's own page in a new tab. Its cards land where the form sends them,
a column the roadmap does not show, so the team reads, edits or merges a suggestion before moving it into a shown
column, and only then does it appear. The api refuses a suggestion form whose default column or any card type rule's
column is a shown one (400 `roadmap_suggestions_public`), and the public read leaves the button out while the form's
link is gone or suspended, or once a later change sends its cards to a shown column.

### States

- **Loading**: column skeletons.
- **Not available** (unknown code, unpublished, a plan archived, in the Trash or gone, a board deleted): "This roadmap isn't
  available" and "It may have been unpublished, or the link may be wrong."
- **Error**: "We couldn't load this roadmap" with **Try Again**.
- **Busy** (the read answered `429`, the per-network read limit): "This roadmap is busy" and "Lots of people are
  looking right now. It tries again in a minute.", with **Try Again**. The page waits out the limit's window (the
  answer's `Retry-After` when it can read it, else 60 seconds, the limiter's window, held to 5 to 300) and reads
  again on its own, once a window while it stays busy, so it never adds to the limit; Try Again reads at once. Never "Check your connection", which is not the reason.
- **An empty column**: "Nothing here yet."
- Footer: Made with liveplanner. The page is kept out of search engines, as every editor page is.

## How it answers

- `GET /api/roadmaps/<plan id>/<code>` (optionally `?browser=<key>`, to mark this browser's votes): the roadmap as
  JSON, `Cache-Control: no-store`. The plan's room builds the page once and keeps it in memory for the next reads
  (a busy roadmap is read far more often than it changes); any write to the plan's storage after it was built
  (a card, a vote, a column, a card type, a form link, the roadmap's settings, Publish or Unpublish) clears it, so an
  edit, a column change or an Unpublish still shows on the next read. Only `voted` is worked out per read, for the
  browser asking.
- `POST /api/roadmaps/<plan id>/<code>/votes` with `{ card, browser, up, website }`: a vote given (`up: true`) or
  taken back; answers the card's new count and whether this browser now votes for it.
- **One answer for every miss**: an unknown or unpublished code, a plan that was never stored, is archived, in the
  Trash or gone, a board deleted or turned into an All Cards board, and a malformed code answer the same `404
roadmap_not_found`. A path no roadmap could have (no code, a malformed plan id, another door under the code) is
  turned away by the worker before any plan wakes, with the api's plain `404 not_found`, and a wrong method with
  `405`. A vote for a card not on the roadmap (another column, an unchosen type, archived, trashed) is
  `404 card_not_found`, as if it did not exist.
- The per-network limit's `429` (`rate_limited`) carries `Retry-After: 60`, the limiter's window.
- Every answer carries `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`.

## Managing a roadmap (signed-in routes)

`/api/projects/:id/roadmaps`, answered inside the plan's room, the owner's and team members' only (above):

- `GET`: every published roadmap of the plan (one per board), the boards that may be published with their columns
  and types, and the forms that may be suggestion forms.
- `PUT /:boardId`: publish the board with the body's settings (201, a new code), or change a published one's
  settings, keeping its link (200).
- `DELETE /:boardId`: Unpublish; 204 whether or not it was published.

A body names columns by their status and types by id, each among the board's; fields from the allowlist; a form by its
code. Anything else is `400 roadmap_invalid`. Every answer is `no-store`.

## Tiers

With Pro off nothing here applies: a person publishes as many roadmaps as they have boards. With [Pro on](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) the
roadmaps an owner has published at once, over all their plans, are limited by the **owner's tier** (Free 1, Pro 10,
Pro for Teams unlimited): a team's for a plan in a team's library, otherwise the owning person's.

- **Publish** asks the subscription service for one more before it makes the link. At the limit it is refused with
  **409** `roadmap_limit_reached`, carrying `limit` (`publicRoadmaps`), `used` and `max`, and nothing is published.
  If the subscription service refuses the app's own request, nothing is published uncounted and the request fails
  as a server error, never as a limit.
- **Changing** a published roadmap's settings never counts, and is never refused by a tier.
- **Unpublish**, a board or tab that has gone, the plan's purge and the plan moving to another owner each give the
  place back. A plan in the Trash or archived keeps its places: it can come back.
- **A roadmap answers only while it holds a counted place.** Each roadmap keeps a mark: counted, not counted, or
  never counted. One whose place was given back (its board or tab went) or refused holds none: its link answers
  the same not-found as any other miss, its row and its link are kept, and its board reads as not published in the
  dialog, with the limit beside it. So deleting a board, publishing another and undoing the delete never leaves two
  answering on a limit of one.
- **A board that came back** asks for its place again the next time the plan's roadmaps are counted (the list, a
  Publish, the plan's daily upkeep). It answers again, on the same link, if the owner has a place for it; otherwise
  Publish Roadmap on it is refused at the limit like any other.
- **Roadmaps from before** (published before Pro, or while the subscription service could not be reached) were
  never counted and keep answering until their first count. That count takes the plan's roadmaps **oldest first**:
  within the owner's limit none ever comes down; past it the oldest keep the places and the rest hold none until
  the owner has room (unpublishing one, or a higher tier). Nothing is deleted.
- **A plan that moves** to another owner or team gives its places back and asks the new owner for them, oldest
  first, by the same rule. A move is never a way past a limit.
- **A higher tier takes effect at once**: a Publish refused at the limit asks for the owner's limits once more
  before it answers, and the list does when it holds a roadmap with no place.
- **A guest's plan** (its owner has no account) is held to Free's 1, counted in the plan itself. The subscription
  service is never asked about it, `owner` is absent and `guest: true` is sent in its place, on the list and on
  the refusal. Nobody is offered an upgrade there.
- `GET` carries `usage` (`used` and `limit`, null for unlimited) and `owner` (the owner's scope) so the dialog can
  say how many are left and ask the subscription service which action to offer.

### What the dialog shows

Only with Pro on. A board not yet published, while the owner has published every roadmap their tier allows (the
list's `usage`, or a refused Publish's own numbers; a plan with no roadmap out gets no count from the list, so the
owner and the owning team read it from their own subscription), shows a panel above the settings, **Publish This Board as a
Roadmap**. Publish Roadmap stays on: the numbers may be from before an upgrade, so a press asks the api, which
answers with the limit when it still holds. The list is read again when the owner's tier changes and when the
window is looked at again, so the panel goes by itself after an upgrade, with no reload.

In a guest's plan the panel is a single note in its place: "This plan has its one public roadmap. Sign in to keep
this plan as your own." with **Sign In**. No offer and nothing about a tier.

- It says who holds the place. One roadmap of this plan: "Free publishes 1 roadmap, and "Product Roadmap" is using
  it." A board of another of the owner's plans (the list is this plan's alone, so it cannot be named): "Free publishes
  1 roadmap, and a board in another plan is using it. Unpublish it there to publish this board."
- The owner (or an admin of the owning team) also reads what the tier above publishes ("Pro publishes 10.") with
  **Upgrade to Pro**; another member of the team is pointed at an admin with **Ask an Admin**.
- **Publish This One Instead** is offered only when exactly one roadmap of this plan holds a place. After a confirm
  that names it ("Unpublish “Product Roadmap” and publish this board?", with **Publish Instead**), that roadmap is unpublished (its link stops at once) and this board is published with the settings
  chosen. With several of this plan's out, or the place held by another plan, the panel says to unpublish one.
- It ends "Visitors and votes on a published roadmap are never limited."

A published roadmap's own view never shows the panel: changing or unpublishing it is never limited.

## Share roles

| Role                         | Publish, change, Unpublish | See the dialog | The board's Roadmap pill | Open the public page |
| ---------------------------- | -------------------------- | -------------- | ------------------------ | -------------------- |
| Owner, team member           | yes                        | yes            | yes, with its buttons    | yes                  |
| Editor (share link)          | no                         | no row         | no                       | yes, like anyone     |
| Participant, Viewer (link)   | no                         | no row         | no                       | yes, like anyone     |
| Anyone with the roadmap link | no                         | no             | no                       | yes, and upvote      |

## Not yet

- Votes by email through a form (option (b) on the card was not chosen: one vote per browser).
- Embedding the page on another site, a custom domain, and comments from visitors.
