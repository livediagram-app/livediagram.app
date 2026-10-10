# Plan templates

A Plan template sets up a **way of working**, not one board: a project planner with its roadmap, backlog,
sprint and daily standup; a retro with its actions and archive. Each makes several tabs, every tab opening in
[Plan mode](plan-mode.md), and the boards on those tabs share their statuses, so a card moved on one tab turns
up on the next. A template comes with **no cards**: the columns, swimlanes, card fields, card types, widgets,
views and facilitation tools are ready, and the team adds its own work.

## Domain language

| Term                | Means                                                                                      | Not                        |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| **template tab**    | One tab a template makes, named by the template (Roadmap, Backlog...)                      | page, sheet                |
| **hand-off**        | A status two boards of a template share, so a card leaving one board arrives on the other  | link, sync                 |
| **dashboard tab**   | A template tab of plan views and no board, reading every card                              | report tab                 |
| **ready-made type** | A card type defined in code that a board brings into the document when it is made (a Role) | preset type, built-in type |

## How a template with tabs is made

- **Every Plan template but Blank Plan and the spreadsheet templates makes several tabs**, in the order below; those
  make one. Every
  template of another mode makes one tab, as before.
- **Where a person makes one**:
  - **The New Document wizard** makes the document with all the template's tabs, named as the template names
    them; the first is the one that opens.
  - **Quick Start on an empty tab** puts the first template tab on that tab (renaming it to the template tab's
    name) and adds the others straight after it, in order. The tab Quick Start was opened on stays the active
    one.
  - **Agents**: the MCP's `create_document` and the api's seeded create (the CLI's `--template`) add all the
    template's tabs where the template is named; the first takes the name given, the rest the template's names.
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
- Statuses, their names and their [phases](plan-views.md#what-a-plan-view-reads) are the **document's**: the
  open tab's boards first, then every other tab's in tab order. A card's status picker offers every column of
  the document, so a card on the Sprint tab can be sent back to the Backlog's.

## Layout of a template tab

- The board sits top left. Plan views sit under it: metrics in a row, then charts two to a row (the Gantt
  across the full width).
- A **rail** to the board's right holds the tab's sticky ("How this works" or "How we run it": the steps of
  the session or the flow) and its facilitation tools (a timer, a picker, a temperature check), top to bottom.
- A **dashboard tab** has no board: a row of metrics over a two-by-two grid of charts.
- Every board is wide enough that each column fits at its narrowest without scrolling sideways.

## Card types a template uses

- **Every board takes only the card types its work is made of.** A board of a template names its card types
  (its **Card Types**), never "every type": a Pipeline takes Candidates, a Retro Notes and Ideas. The palette's
  card tiles a tab's boards would not take are greyed out ([Plan mode](plan-mode.md#the-palette)).
- **A template uses only the card types its work is made of.** Where none of the five default types fits the
  work, the template uses a card type of its own, with the fields that work needs: a Role, a Candidate, an
  Objective. Every card type a board can bring is a **ready-made type**: one catalogue in code
  (`READY_MADE_CARD_TYPES`, below), shared by the templates and the board presets, so two templates that need the
  same kind of card (Kanban's requests, Feedback's) bring the same type.
- **A template's boards choose the document's card types.** A document made from a template has exactly the
  ready-made types its boards take, in the order they name them, and no others: a Hiring Pipeline has Role,
  Candidate and Onboarding Task, never a Project or a Note
  ([Item types](item-types.md#the-type-catalogue)). Added to a document that already has card types or cards
  (Quick Start on a new tab), its boards add each type they take that the document lacks, after the ones it has.
  Either way it is one change, on every path that makes the tabs: the New Document wizard (the document is created
  with them), Quick Start (every tab it adds, not only the one it lands on), and agents (the MCP's
  `create_document` and `add_tab`, the api's seeded create). A document that already has a type of that id keeps
  its own. The [Plan mode](plan-mode.md#the-palette) rule holds: only a board being made brings types, so a type
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
each a [ready-made type](#ready-made-card-types); the document has those and no others. A hand-off is marked ⇄.

### Blank Plan

One tab (named as any new tab is), empty: no board, so the tab shows Plan's **Start Planning** picker
([Plan mode](plan-mode.md#starting-a-board)), where the person picks the board that fits (or opens the Quick Start).
The mode's blank, as Blank Diagram is Diagram's.

### Project Planner

Projects on a roadmap and a timeline, broken into tasks, run in sprints and walked every day.

| Tab           | Holds                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap       | Board **Roadmap**: Now, Next, Later, Shipped (done); Projects; start and due dates. Gantt Chart under it. How this works                                                                           |
| Backlog       | Board **Backlog**: Backlog, Ready, This Sprint ⇄; a row per project; Stories, Tasks and Bugs; estimates and priority                                                                               |
| Sprint        | Board **Sprint**: This Sprint ⇄, In Progress (WIP 3) ⇄, Blocked (red) ⇄, In Review ⇄, Done ⇄; a row per person; Stories, Tasks and Bugs; points. Cards by Field and Priority by Status under it    |
| Daily Standup | Board **Daily Standup**: In Progress ⇄, Blocked ⇄, In Review ⇄, Done ⇄; a row per person; Stories, Tasks and Bugs; Compact cards. How we run it, a 15 minute timer and a picker for who goes first |

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
archived. It joins the Retrospectives family beside the sticky-note formats, which stay Diagram templates.

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

Four Plan templates are a spreadsheet rather than boards: each makes its tabs with a **Sheet** already filled from a
template start (the Header look, the header row frozen, the canvas's light or dark tints), and no board, so the tab
opens on the sheet, not on Start Planning. They sit in the template picker's Plan section beside the board
templates, and bring no card types. Whether the Sheet fills its tab is decided per template:

- **Fill Tab** when the sheet is the whole job (a budget, a timesheet, a contact list): nothing else belongs on the
  tab, so the sheet takes it, as a spreadsheet file would ([Fill Tab](../029-sheets/sheet.md#fill-tab)).
- **On Canvas** when the sheet is one piece of a working space: the tracker sits on the canvas with its How this
  works sticky beside it, and room around it for notes, a diagram or a board.

| Template       | Kind             | Sheet         | Fills its tab | Holds                                                                                                                                                                                                                                                                                                  |
| -------------- | ---------------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Budget Planner | `budget-planner` | **Budget**    | Yes           | Category, Item, Planned, Actual, Difference (`=Planned-Actual`); seven rows (Home, Food, Travel, Leisure, Savings, Other); a **Total** row summing the three amounts; amounts to two decimals                                                                                                          |
| Timesheet      | `timesheet`      | **Timesheet** | Yes           | Day, Date, Project, Task, Hours; Monday to Friday of the week it is made, dated; a **Total** row summing the hours                                                                                                                                                                                     |
| Contact List   | `contact-list`   | **Contacts**  | Yes           | Name, Company, Role, Email, Phone, Last Contacted (dates), Notes; four people                                                                                                                                                                                                                          |
| Task Tracker   | `task-tracker`   | **Tracker**   | No            | Task, Owner, Status, Priority, Start, Due, Done (a whole percentage); five tasks dated from the day it is made; on the canvas with a How this works sticky beside it ("Add a row for each task"; "Set its Status and how much is Done"; "Sort or filter by Owner, Status or Due from a column's menu") |

- Each makes one tab, which keeps the name it would have had, as any template of one tab; the Sheet is titled as the
  table says.
- **The sheet is made with the document.** The template's Sheet element names its start (`start` on the element,
  [Sheet store](../029-sheets/sheet-store.md#template-starts)); every path that makes the tabs makes the sheet
  from it there and then: the New Document wizard (stored with the document, cloud or Local only), Quick Start (as
  it adds the tabs), and agents (the MCP's `create_document` and `add_tab`, the api's seeded create). So the sheet
  is there for everyone, an agent's `read_sheet` included, the moment the document is.
- Telemetry as any template: `Template` · `Used` with its kind.

## Telemetry

- A template with tabs sends `Template` · `Used` once, with its kind, as any template; the tabs it adds are not
  `Tab` · `Created`.
