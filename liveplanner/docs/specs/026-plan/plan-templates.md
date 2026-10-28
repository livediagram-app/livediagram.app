# Plan templates

A Plan template sets up a **way of working**, not one board: a project planner with its roadmap, backlog,
sprint and daily standup; a retro with its actions and archive. Each makes several tabs, every tab opening in
[Plan mode](plan-mode.md), and the boards on those tabs share their statuses, so a card moved on one tab turns
up on the next. A template opens on a **worked example**: the columns, swimlanes, card fields, card types, widgets,
views and facilitation tools are ready, and every board already holds a small team's believable work, so a person
sees what the template is for before they add their own (see [Example cards](#example-cards)).

## Example cards

Every Plan template with boards opens with **example cards**: a small team's real-looking work, spread so that every
board of the template shows some, and every plan view on its Dashboard has something to draw.

- **What they are.** Ordinary cards, made with the template's tabs: anyone may move, edit, archive or delete them like
  any other card. Nothing marks them as examples, and nothing removes them later.
- **Who they belong to.** The cards are shared among an **example team** of five (Maya Chen, Sam Ortiz, Priya Nair,
  Leo Park, Ana Silva), each with a colour of their own: the assignees, the swimlane rows of a board laid by assignee,
  and the voters behind a card's dots. An example person's id starts `example-`, never a real person's
  (`itemPersonId`), so an example card is never counted as anyone's own vote or card.
- **What they hold.** Each card fills the fields its board shows: a title, a type its board takes, a status (a column
  of its board), and where the board shows them an assignee, priority, labels, estimate, checklist, dates, the type's
  own fields (a Request's Requested By, a Key Result's Baseline, Target and Current) and votes. A card a template links
  to another (a Story's Project, a Candidate's Role, a Key Result's Objective, an Onboarding Task's New Starter, a Launch
  Check's Workstream) names the card made with it.
- **Dates count from today.** Start and Due are days from the day the project is made, so a Gantt chart, a due chip
  and a Calendar never open stale: a project started two weeks ago and due in three.
- **Archived examples.** Team Retro's **Past Retros** board shows two archived notes from the sprint before.
- **They are marked.** Every example card carries the `example` flag ([Items](items.md#example-cards)), so the
  project knows which cards a template made however they have since moved.
- **Where they are made.** Only where a **person** makes the template: the New Project wizard (the cards ride the
  create, or an Offline Mode project's first item write) and a start screen on an empty tab (the cards are one write,
  one undo step, after the tabs land). **Agents** (the MCP's `create_project` and `add_tab`, the api's seeded create)
  get the set-up alone: an agent fills a board with real cards, and examples would be cards it then had to find and
  delete.
- **Clearing them.** While the project holds an example card that is not in the Trash, every board showing one
  carries a one-line notice under its header: an info glyph, **"Example cards show how this board runs."**, and two
  buttons, **Clear Example Cards** and **Keep Them**.
  - **Clear Example Cards** sends every example card of the project (every board, every tab) to the Trash as one
    write and one undo step, and announces "N example cards moved to the Trash". The Trash restores any of them.
  - **Keep Them** takes the flag off every example card, one write and one undo step: they are ordinary cards from
    then on.
  - Either way no card is an example any more, so the notice goes, for everyone, on every board. Undo brings it back
    with the cards or the flags.
  - It sends `Plan · Deleted · ExampleCards` or `Plan · Changed · ExampleCardsKept`.
  - **Who sees it**: only an **Editor** (the notice trashes or changes other people's cards, which a Participant may
    not, [Share roles](../013-workspace/share-roles.md#what-a-participant-changes)). A **Participant** and a
    **Viewer** never see it; to them the example cards are cards like any other. A card shown outside a board (a
    Plan card, a Dashboard's views) carries no notice: the board does.
- **Blank Plan and the spreadsheet templates** have no boards, so no example cards; a spreadsheet template's Sheet is
  already filled in ([Spreadsheet templates](#spreadsheet-templates)).
- **The catalogue.** `PLAN_TEMPLATE_SEEDS` (`packages/templates/src/plan-template-seed-data.ts`), pure data, resolved
  by `planTemplateSeedItems(kind, today)` into the item store's creates. A test holds every card to a board of its
  template that shows it, every board to at least one card, and every card to what the item store accepts.

## Domain language

| Term                | Means                                                                                     | Not                        |
| ------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| **template tab**    | One tab a template makes, named by the template (Roadmap, Backlog...)                     | page, sheet                |
| **hand-off**        | A status two boards of a template share, so a card leaving one board arrives on the other | link, sync                 |
| **dashboard tab**   | A template tab of plan views and no board, reading every card                             | report tab                 |
| **ready-made type** | A card type defined in code that a board brings into the project when it is made (a Role) | preset type, built-in type |

## How a template with tabs is made

- **Every Plan template but Blank Plan and the spreadsheet templates makes several tabs**, in the order below; those
  make one, as do the blank and the form templates.
- **Where a person makes one**:
  - **The New Project wizard** makes the project with all the template's tabs, named as the template names
    them; the first is the one that opens.
  - **A start screen on an empty tab** (Start Planning, or another start's search) puts the first template tab on
    that tab (renaming it to the template tab's name) and adds the others straight after it, in order. The tab it was
    picked on stays the active one.
  - **Agents**: the MCP's `create_project` and the api's seeded create (the CLI's `--template`) add all the
    template's tabs where the template is named; the first takes the name given, the rest the template's names.
    A name given that is one of the template's later tabs (an agent naming the tab it wanted) leaves the first its
    template name instead, so no two tabs share a name; with no name given the first takes its template name (Tab 1
    for a template of one tab). One rule (`templateTabName`) serves the MCP and the api.
    A **replace** (the MCP's `add_tab`, the CLI's `replace --template`) fills its one tab with the template's
    first tab.
- A template of one tab keeps the name the tab would have had (Tab 1 in the wizard).
- **Every template tab** takes the theme chosen, opens in Plan, and is otherwise an ordinary tab: renamed,
  reordered, deleted or copied like any other.
- The template step shows a template's tabs in its description, so a person knows what they are getting.

## Hand-offs

- A **hand-off** is a column that names the same status on two boards of a template, on different tabs. Moving
  a card into it on one board puts the card on the other, with nothing else to do. Both columns carry the same
  name, so the status reads the same wherever it shows.
- The board where a card leaves counts it as on the board while it sits in the hand-off column; once the next
  board moves it on, it is "not on this board" there, which is what the first board's header says.
- Statuses, their names and their [phases](plan-views.md#what-a-plan-view-reads) are the **project's**: the
  open tab's boards first, then every other tab's in tab order. A card's status picker offers every column of
  the project, so a card on the Sprint tab can be sent back to the Backlog's.

## Layout of a template tab

A template's tabs are made in the Plan kinds ([Plan tabs](plan-tabs.md#templates)): each tab of the catalogue that
names a board is a **Board tab** of that board alone, each that names a Sheet a **Sheet tab**, and the views and notes
the catalogue lists are gathered on the template's **Dashboard** (its own dashboard tab, or an **Overview** added last).
The catalogue below still lists, per tab, the metrics, charts and rail it brings: they are what that Dashboard holds.

- Every board is wide enough that each column fits at its narrowest without scrolling sideways.

## Card types a template uses

- **Every board takes only the card types its work is made of.** A board of a template names its card types
  (its **Card Types**), never "every type": a Pipeline takes Candidates, a Retro Notes and Ideas. A board's Add card
  offers only those types ([Plan mode](plan-mode.md#no-palette)).
- **A template uses only the card types its work is made of.** Where none of the five default types fits the
  work, the template uses a card type of its own, with the fields that work needs: a Role, a Candidate, an
  Objective. Every card type a board can bring is a **ready-made type**: one catalogue in code
  (`READY_MADE_CARD_TYPES`, below), shared by the templates and the board presets, so two templates that need the
  same kind of card (Kanban's requests, Feedback's) bring the same type.
- **A template's boards choose the project's card types.** A project made from a template has exactly the
  ready-made types its boards take, in the order they name them, and no others: a Hiring Pipeline has Role,
  Candidate and Onboarding Task, never a Project or a Note
  ([Item types](item-types.md#the-type-catalogue)). Added to a project that already has card types or cards
  (a start screen on a new tab), its boards add each type they take that the project lacks, after the ones it has.
  Either way it is one change, on every path that makes the tabs: the New Project wizard (the project is created
  with them), a start screen (every tab it adds, not only the one it lands on), and agents (the MCP's
  `create_project` and `add_tab`, the api's seeded create). A project that already has a type of that id keeps
  its own. The [Plan mode](plan-mode.md#no-palette) rule holds: only a board being made brings types, so a type
  someone deleted stays deleted.
- **Hand-offs carry the type**: a board receiving a hand-off takes every type the board handing off takes, so a
  card moved on is shown where it lands.
- **A board laid out by a field takes only types that have it**: a row per role takes Candidates (each names its
  Role), never a type that would always fall in the "No Role" row.
- **A board of dated cards has a Gantt chart of them under it**: the chart's card types are the board's
  (`types` on the view), not only Projects.
- **A ready-made type's Default State** is a state name ([Item types](item-types.md#an-item-type)): for the ten
  below, the first column of the board it is made for.

### Ready-made card types

The five default types (Project, Task, Note, Idea, Action: [Items](items.md#item-types)) and these ten. Colours from
the Plan palette. Every type also offers Comments, last. Card fields link to the type named. "On the card" is what
its Detailed cards add Under the Title.

| Type            | Id                | Glyph     | Colour           | Fields                                                                                                                                                                                                      | On the card     | Default State  |
| --------------- | ----------------- | --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------- |
| Bug             | `bug`             | bug       | red `#dc2626`    | A Task's (Parent among them), then **Steps to Reproduce** (Long Text) and **Environment** (Text)                                                                                                            |                 | New            |
| Story           | `story`           | story     | violet `#7c3aed` | A Task's                                                                                                                                                                                                    |                 | Backlog        |
| Request         | `request`         | inbox     | orange `#ea580c` | Description, Status, Assignee, Priority, Votes, Labels; **Requested By** (Text)                                                                                                                             | Requested By    | New            |
| Content         | `content`         | megaphone | pink `#db2777`   | Description, Status, Assignee, Votes, Labels, Due, Checklist; **Channel** (Choice: Blog, Newsletter, Social, Video, Podcast), **Link** (Link)                                                               | Channel         | Ideas          |
| Role            | `role`            | briefcase | cyan `#0891b2`   | Description, Status, Assignee (the hiring manager), Priority, Colour, Start, Due, Labels; **Team** (Text), **Location** (Text), **Employment** (Choice: Full-time, Part-time, Contract, Internship)         | Team            | Opening Soon   |
| Candidate       | `candidate`       | user-plus | pink `#db2777`   | Description, Status, Assignee (who looks after them), Labels, Due (the next step), Checklist; **Role** (Card: Role), **Source** (Choice: Referral, Job Board, Inbound, Agency, Sourced), **Profile** (Link) |                 | Applied        |
| Onboarding Task | `onboarding-task` | checklist | green `#16a34a`  | Description, Status, Assignee, Due, Checklist; **New Starter** (Card: Candidate)                                                                                                                            |                 | Before Day One |
| Objective       | `objective`       | target    | amber `#d97706`  | Description, Status, Assignee, Priority, Colour, Start, Due, Labels                                                                                                                                         |                 | Draft          |
| Key Result      | `key-result`      | trend     | teal `#0d9488`   | Description, Status, Assignee, Due, Checklist; **Objective** (Card: Objective), **Baseline**, **Target**, **Current** (Numbers)                                                                             | Current, Target | Not Started    |
| Launch Check    | `launch-check`    | flag      | green `#16a34a`  | Description, Status, Assignee, Priority; **Workstream** (Card: Project)                                                                                                                                     | Workstream      | Not Checked    |

- A Role and an Objective offer Start and Due, so the Gantt chart draws them; a Candidate's Role, a Key Result's
  Objective and an Onboarding Task's New Starter are what their boards lay their rows by.

## The templates

Colours: **green** `#16a34a`, **amber** `#d97706`, **red** `#dc2626`. A board's card types are named in its row,
each a [ready-made type](#ready-made-card-types); the project has those and no others. A hand-off is marked ⇄.

### Blank Plan

One tab (named as any new tab is), empty: no board, so the tab shows Plan's **Start Planning** picker
([Plan mode](plan-mode.md#starting-a-board)), where the person picks the board that fits (or searches for a template).

### Project Planner

Projects on a roadmap and a timeline, broken into tasks, run in sprints and walked every day.

| Tab           | Holds                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap       | Board **Roadmap**: Now, Next, Later, Shipped (done); Projects; start and due dates. Gantt Chart under it. How this works                                                                            |
| Backlog       | Board **Backlog**: Backlog, Ready, This Sprint ⇄; a row per project; Stories, Tasks and Bugs; estimates and priority                                                                                |
| Sprint        | Board **Sprint**: This Sprint ⇄, In Progress (WIP 3) ⇄, Blocked (red) ⇄, In Review ⇄, Done ⇄; a row per person; Stories, Tasks and Bugs; points. Cards by Field and Priority by Status under it     |
| Daily Standup | Board **Daily Standup**: In Progress ⇄, Blocked ⇄, In Review ⇄, Done ⇄; a row per person; Stories, Tasks and Bugs; Detailed cards. How we run it, a 15 minute timer and a picker for who goes first |

- How this works: add a Project for each piece of work on Roadmap and give it dates (the Gantt draws them);
  break it into Stories, Tasks and Bugs on Backlog, each under its project; move what the team takes on to This Sprint; walk
  Daily Standup each morning.

### Kanban Board

Continuous flow: requests come in, are accepted onto the board, and flow to Done under WIP limits. It stays in
the Kanban boards family.

| Tab      | Holds                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Board    | Board **Kanban**: Backlog ⇄, To Do, In Progress (WIP 3), Review (WIP 2), Done; Tasks and Requests                                   |
| Requests | Board **Requests**: New, Needs Info (amber), Backlog ⇄ (green: accepted, it lands on the Board), Declined; Requests. How this works |
| Flow     | Dashboard: Item Count, Completion, Stale Cards, Unassigned; Cards by Field, Priority by Status, Due Calendar                        |

### Bug Tracker

Bugs triaged by priority, then fixed, reviewed and released.

| Tab    | Holds                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Triage | Board **Triage**: New, Needs Info (amber), Confirmed ⇄, Won't Fix, Duplicate (no done column); a row per priority; Bugs. How we triage |
| Fixing | Board **Fixing**: Confirmed ⇄, Fixing (WIP 4), In Review, Fixed (done), Released; a row per person; Bugs                               |
| Health | Dashboard: Item Count, Priorities, Stale Cards, Unassigned; Priority by Status, Cards by Field, Due Calendar                           |

- How we triage: Urgent is broken for everyone (fix now), High blocks someone, Medium has a workaround, Low is
  polish; give each confirmed bug an owner.

### Team Retro

Notes written in private, revealed and voted on; the actions they lead to, tracked between retros; past notes
archived. It is the Retrospectives family's one template.

| Tab     | Holds                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retro   | Board **Retro**: Went Well (green), To Improve (red), Ideas (teal); Notes and Ideas only; hide writing on. How we run it, a 5 minute timer, a **Vote** button (5 dots each) and a temperature check |
| Actions | Board **Actions**: To Do, Doing, Done (done); Actions only; a row per person; due dates                                                                                                             |
| Archive | An Archive board, **Past Retros**                                                                                                                                                                   |

- How we run it: check in on the temperature; review last retro's actions; write notes (they stay hidden) while
  the timer runs; reveal together; press Vote (5 dots each, on the cards); turn the top votes into Actions on the Actions tab; archive the
  notes when done.

### Weekly Planner

A person's (or a small team's) week, fed from an inbox, with what is due on a calendar.

| Tab       | Holds                                                                                   |
| --------- | --------------------------------------------------------------------------------------- |
| This Week | Board **This Week**: Monday to Friday, Done (done); Tasks, Actions and Notes; due dates |
| Inbox     | Board **Inbox**: Inbox, Next Up, Waiting On (amber), Someday. How this works            |
| Calendar  | Dashboard: Due Soon, Completion, Item Count; Due Calendar across the full width         |

- How this works: capture everything in Inbox; each Monday, give the week's cards a day on This Week (the
  card's status picker lists the days); what waits on someone else goes in Waiting On.

### Content Calendar

Ideas voted on and approved, produced through review to published, and every publish date on a calendar.

| Tab        | Holds                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Ideas      | Board **Ideas**: Ideas, Shortlisted, Approved ⇄, Parked; Content; a **Vote** button (5 dots each)                                              |
| Production | Board **Production**: Approved ⇄, Drafting, In Review, Scheduled, Published (done); Content and Tasks; labels and due dates (the publish date) |
| Calendar   | Dashboard: Due Soon, Completion, People; Due Calendar and Cards by Field                                                                       |

### Hiring Pipeline

Open roles, the candidates for each, and the new starter's first month.

| Tab        | Holds                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles      | Board **Roles**: Opening Soon, Open, Offer Out, Filled (done); Roles; start and due dates. Gantt Chart of the Roles under it                 |
| Pipeline   | Board **Pipeline**: Applied, Screen, Interview, Offer, Hired (done), Not Progressing; a row per role (Role); Candidates; stale cards         |
| Onboarding | Board **Onboarding**: Before Day One, First Week, First Month, Done (done); a row per new starter (New Starter); Onboarding Tasks; due dates |

- How it fits: each Role is a card on Roles; each Candidate names their Role, so the Pipeline lays a row per role,
  and a Role's panel lists its candidates (Linked as Role, with **New Candidate**); once hired, a Candidate is the
  New Starter their Onboarding Tasks name, a row each.

### OKRs

Objectives for the period and the key results that measure them, checked in on each week.

| Tab         | Holds                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objectives  | Board **Objectives**: Draft, Committed, Achieved (done), Missed; Objectives; start and due dates. Gantt Chart of the Objectives under it                                                                        |
| Key Results | Board **Key Results**: Not Started, On Track (green), At Risk (amber), Off Track (red), Done (done); a row per objective (Objective); Key Results; checklist progress. Cards by Field under it. How we check in |

- How we check in: each week, update every key result's Current, move it to the column it is in and say why in a comment; anything
  At Risk or Off Track gets its next steps on its checklist.

### Product Launch

Workstreams on a timeline, a checklist per workstream, and the go/no-go on launch day.

| Tab        | Holds                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Timeline   | Board **Workstreams**: Planned, In Progress, Ready, Launched (done); Projects (one per workstream). Gantt Chart under it          |
| Checklist  | Board **Checklist**: To Do, Doing, Blocked (red), Done (done); a row per workstream (Parent); Tasks; due dates                    |
| Launch Day | Board **Go / No-Go**: Not Checked, Go (green), No-Go (red); Launch Checks; a row per person. How we call it and a 30 minute timer |

- How we call it: each owner checks their item and moves it to Go or No-Go; any No-Go is talked through; launch
  when every card is Go.

### Feedback Board

Requests from users, voted on and reviewed, and the ones planned followed to shipped.

| Tab      | Holds                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Feedback | Board **Feedback**: New, Under Review, Planned ⇄, Not Planned; Requests; a **Vote** button (3 dots each). How this works |
| Delivery | Board **Delivery**: Planned ⇄, Building, Shipped (done); Requests and Tasks; a row per person                            |

- How this works: add each request as a Request; vote on what matters; review the top voted each week; Planned
  moves it to Delivery.

## Spreadsheet templates

Twelve Plan templates are a spreadsheet rather than boards: each makes its tabs with a **Sheet** already filled from one
of the [sheet templates](../029-sheets/sheet.md#sheet-templates) (the Banded look, the header frozen, the canvas's
light or dark tints, its chart beside it), and no board, so the tab
opens on the sheet, not on Start Planning. They sit in the template picker's Plan section beside the board
templates, and bring no card types. Whether the Sheet fills its tab is decided per template:

- **Fill Tab** when the sheet is the whole job (a budget, a timesheet, a contact list, an invoice, a guest list...): nothing else belongs on the
  tab, so the sheet takes it, as a spreadsheet file would ([Fill Tab](../029-sheets/sheet.md#fill-tab)).
- **On Canvas** when the sheet is one piece of a working space: the tracker sits on the canvas with its How this
  works sticky beside it, and room around it for notes, a diagram or a board.

| Template          | Kind                | Sheet               | Fills its tab | Holds                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------- | ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget Planner    | `budget-planner`    | **Budget**          | Yes           | The Budget sheet template: planned against actual by category, a summary and a spending pie chart                                                                                                                                                                                   |
| Timesheet         | `timesheet`         | **Timesheet**       | Yes           | The Timesheet sheet template: this week's hours Monday to Friday, billable time and the amount to bill                                                                                                                                                                              |
| Contact List      | `contact-list`      | **Contacts**        | Yes           | The Contacts sheet template: six people with stages, days since contact and who is due a follow-up                                                                                                                                                                                  |
| Task Tracker      | `task-tracker`      | **Tracker**         | No            | The Tracker sheet template: eight tasks with progress, days left, counts and a status chart; on the canvas with a How this works sticky beside it ("Add a row for each task"; "Set its Status and how much is Done"; "Sort or filter by Owner, Status or Due from a column's menu") |
| Invoice           | `invoice`           | **Invoice**         | Yes           | The Invoice sheet template: who it is from and to, line items, tax and the amount due, ready to send                                                                                                                                                                                |
| Expense Report    | `expense-report`    | **Expense Report**  | Yes           | The Expense Report sheet template: claims with receipts, what is reimbursable, a summary and a pie chart by category                                                                                                                                                                |
| Loan Calculator   | `loan-calculator`   | **Loan Calculator** | Yes           | The Loan Calculator sheet template: the loan's amount, rate and term, the monthly payment and a year-by-year schedule on a line chart                                                                                                                                               |
| Sales Pipeline    | `sales-pipeline`    | **Sales Pipeline**  | Yes           | The Sales Pipeline sheet template: deals by stage weighted by probability, a forecast and a bar chart                                                                                                                                                                               |
| Inventory         | `inventory`         | **Inventory**       | Yes           | The Inventory sheet template: stock, its value, what to reorder and a bar chart                                                                                                                                                                                                     |
| Guest List        | `guest-list`        | **Guest List**      | Yes           | The Guest List sheet template: invitations, RSVPs, dietary needs, the headcount and a pie chart                                                                                                                                                                                     |
| Grade Book        | `grade-book`        | **Grade Book**      | Yes           | The Grade Book sheet template: scores, averages, grades and a bar chart of how the class is doing                                                                                                                                                                                   |
| Habit Tracker     | `habit-tracker`     | **Habit Tracker**   | Yes           | The Habit Tracker sheet template: a week of ticks against each habit's goal and a bar chart                                                                                                                                                                                         |
| Blank Spreadsheet | `blank-spreadsheet` | **Sheet 1**         | Yes           | A blank (`isBlankTemplate`): an empty grid from the `blank-spreadsheet` start, no template, no charts                                                                                                                                                                               |

- Each makes one tab, which keeps the name it would have had, as any template of one tab; the Sheet is titled as the
  table says.
- **The sheet is made with the project.** The template's Sheet element names its start (`start` on the element,
  [Sheet store](../029-sheets/sheet-store.md#template-starts)); every path that makes the tabs makes the sheet
  from it there and then: the New Project wizard (stored with the project, cloud or This Browser), a start screen (as
  it adds the tabs), and agents (the MCP's `create_project` and `add_tab`, the api's seeded create). So the sheet
  is there for everyone, an agent's `read_sheet` included, the moment the project is.
- The eight added with the template catalogue's categories (Invoice, Expense Report, Loan Calculator, Sales Pipeline,
  Inventory, Guest List, Grade Book, Habit Tracker) each make the sheet template of the same name, filling its tab;
  the four Money sheets and the Sales Pipeline sit in the picker's **Finance** category, the rest in
  **Spreadsheets** ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).
- Start Planning's **Inspiration** leaves out the spreadsheet templates that make one tab: each is one Sheet that
  Start Planning's **Spreadsheets** already offers as a sheet template, so it would show the same thing twice. One
  that sets up more tabs (Task Tracker, its Sheet and an Overview) stays in it
  ([Plan mode](plan-mode.md#starting-a-board)).
- Telemetry as any template: `Template` · `Used` with its kind.

## Telemetry

- A template with tabs sends `Template` · `Used` once, with its kind, as any template; the tabs it adds are not
  `Tab` · `Created`.
