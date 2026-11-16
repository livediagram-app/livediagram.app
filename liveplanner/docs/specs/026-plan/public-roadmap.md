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
- **Never through a share link**, at any level: an Editor, a Participant and a Viewer neither see Publish as Roadmap
  nor may call its routes. Nor a grant confined to one tab, an API token or a workbench session (a delegated caller
  never opens a lasting public door). The api refuses them with 403 `roadmap_needs_owner`, so the menu row is
  presentation, never the rule.
- **A plan in This Browser** has no server to answer the page, so it offers no row.

## Publish as Roadmap

### Where it lives

**Publish as Roadmap…** in the **tab menu** (the tab's ⋯ and the canvas's right-click menu, one menu), beside
Subscribe to Calendar, on a tab holding at least one Plan board, for someone who may publish. It opens the Publish as
Roadmap dialog on the tab's first board (a board picker at the top when the tab holds several).

### The dialog

A centred dialog (a bottom sheet on a phone) titled **Publish as Roadmap**, subtitled "A public page of the cards you
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
- **Columns**: the board's columns, each a checkbox. To begin with every column is ticked except those whose name
  reads like triage (Under Review, Inbox, Backlog, Triage, Ideas, To Review, New, Suggestions), so suggestions stay
  hidden until the team moves them. At least one.
- **Card Types**: the types the board shows, each a checkbox, all ticked to begin with. At least one.
- **Fields**: the allowlist below, each a checkbox; **Title** always shows (no checkbox). To begin with only
  **Description** is ticked.
- **Voting**: on to begin with: visitors may upvote.
- **Suggest an Idea**: **None**, or one of the plan's published forms whose responses become cards in a column the
  roadmap does not show. A form whose responses would land in a shown column is listed but cannot be picked, with
  "Its cards would show on the roadmap at once."; a form with no live link or one sending to a Sheet is not listed.

An **All Cards** board or an archive board has no columns to choose, so it cannot be published (the dialog says "This
board has no columns to publish.").

### Telemetry

Counts only, never a plan, a board, a column or a link: the dialog opened (UI·Opened·Roadmap), a roadmap published
(Plan·Created·Roadmap), its settings changed (Plan·Changed·Roadmap), its link copied (Plan·Copied·Roadmap) and
unpublished (Plan·Ended·Roadmap).

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
- **An empty column**: "Nothing here yet."
- Footer: Made with liveplanner. The page is kept out of search engines, as every editor page is.

## How it answers

- `GET /api/roadmaps/<plan id>/<code>` (optionally `?browser=<key>`, to mark this browser's votes): the roadmap as
  JSON, built fresh on every read from the plan's own tables, `Cache-Control: no-store`, so an edit, a column change
  or an Unpublish shows on the next read.
- `POST /api/roadmaps/<plan id>/<code>/votes` with `{ card, browser, up, website }`: a vote given (`up: true`) or
  taken back; answers the card's new count and whether this browser now votes for it.
- **One answer for every miss**: an unknown or unpublished code, a plan that was never stored, is archived, in the
  Trash or gone, a board deleted or turned into an All Cards board, and a malformed code answer the same `404
roadmap_not_found`. A path no roadmap could have (no code, a malformed plan id, another door under the code) is
  turned away by the worker before any plan wakes, with the api's plain `404 not_found`, and a wrong method with
  `405`. A vote for a card not on the roadmap (another column, an unchosen type, archived, trashed) is
  `404 card_not_found`, as if it did not exist.
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

## Share roles

| Role                         | Publish, change, Unpublish | See the dialog | Open the public page |
| ---------------------------- | -------------------------- | -------------- | -------------------- |
| Owner, team member           | yes                        | yes            | yes                  |
| Editor (share link)          | no                         | no row         | yes, like anyone     |
| Participant, Viewer (link)   | no                         | no row         | yes, like anyone     |
| Anyone with the roadmap link | no                         | no             | yes, and upvote      |

## Not yet

- Votes by email through a form (option (b) on the card was not chosen: one vote per browser).
- Embedding the page on another site, a custom domain, and comments from visitors.
