# Plan templates

A Plan template sets up a **way of working**, not one board: a project planner with its roadmap, backlog,
sprint and daily standup; a retro with its actions and archive. Each makes several tabs, every tab opening in
[Plan mode](plan-mode.md), and the boards on those tabs share their statuses, so a card moved on one tab turns
up on the next. A template comes with **no cards**: the columns, swimlanes, card fields, card types, widgets,
views and facilitation tools are ready, and the team adds its own work.

## Domain language

| Term              | Means                                                                                     | Not         |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------- |
| **template tab**  | One tab a template makes, named by the template (Roadmap, Backlog...)                     | page, sheet |
| **hand-off**      | A status two boards of a template share, so a card leaving one board arrives on the other | link, sync  |
| **dashboard tab** | A template tab of plan views and no board, reading every card                             | report tab  |

## How a template with tabs is made

- **Every Plan template but Blank Plan makes several tabs**, in the order below; Blank Plan makes one. Every
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

## The templates

Colours: **green** `#16a34a`, **amber** `#d97706`, **red** `#dc2626`. Card types are the built-in ones
([Item types](item-types.md)). A hand-off is marked ⇄.

### Blank Plan

One tab (named as any new tab is), empty: no board, so the tab shows Plan's **Start with a Board** picker
([Plan mode](plan-mode.md#starting-a-board)), where the person picks the board that fits (or opens the Quick Start).
The mode's blank, as Blank Diagram is Diagram's.

### Project Planner

Projects on a roadmap and a timeline, broken into tasks, run in sprints and walked every day.

| Tab           | Holds                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap       | Board **Roadmap**: Now, Next, Later, Shipped (done); Projects; start and due dates. Gantt Chart under it. How this works                                                  |
| Backlog       | Board **Backlog**: Backlog, Ready, This Sprint ⇄; a row per project; Tasks; estimates and priority                                                                        |
| Sprint        | Board **Sprint**: This Sprint ⇄, In Progress (WIP 3) ⇄, Blocked (red) ⇄, In Review ⇄, Done ⇄; a row per person; points. Workload by Person and Status Breakdown under it  |
| Daily Standup | Board **Daily Standup**: In Progress ⇄, Blocked ⇄, In Review ⇄, Done ⇄; a row per person; Compact cards. How we run it, a 15 minute timer and a picker for who goes first |

- How this works: add a Project for each piece of work on Roadmap and give it dates (the Gantt draws them);
  break it into Tasks on Backlog, each under its project; move what the team takes on to This Sprint; walk
  Daily Standup each morning.

### Kanban Board

Continuous flow: requests come in, are accepted onto the board, and flow to Done under WIP limits. It stays in
the Kanban boards family.

| Tab      | Holds                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Board    | Board **Kanban**: Backlog ⇄, To Do, In Progress (WIP 3), Review (WIP 2), Done                                                              |
| Requests | Board **Requests**: New, Needs Info (amber), Backlog ⇄ (green: accepted, it lands on the Board), Declined; Tasks and Ideas. How this works |
| Flow     | Dashboard: Item Count, Completion, Stale Cards, Unassigned; Status Breakdown, Workload by Person, Priority by Status, Due Calendar         |

### Bug Tracker

Bugs triaged by priority, then fixed, reviewed and released.

| Tab    | Holds                                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Triage | Board **Triage**: New, Needs Info (amber), Confirmed ⇄, Won't Fix, Duplicate (no done column); a row per priority; Tasks. How we triage |
| Fixing | Board **Fixing**: Confirmed ⇄, Fixing (WIP 4), In Review, Fixed (done), Released; a row per person                                      |
| Health | Dashboard: Item Count, Priorities, Stale Cards, Unassigned; Priority by Status, Workload by Person, Status Breakdown, Due Calendar      |

- How we triage: Urgent is broken for everyone (fix now), High blocks someone, Medium has a workaround, Low is
  polish; give each confirmed bug an owner.

### Team Retro

Notes written in private, revealed and voted on; the actions they lead to, tracked between retros; past notes
archived. It joins the Retrospectives family beside the sticky-note formats, which stay Diagram templates.

| Tab     | Holds                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retro   | Board **Retro**: Went Well (green), To Improve (red), Ideas (teal); Notes and Ideas only; voting with 5 votes; hide writing on. How we run it, a 5 minute timer and a temperature check |
| Actions | Board **Actions**: To Do, Doing, Done (done); Actions only; a row per person; due dates                                                                                                 |
| Archive | An Archive board, **Past Retros**                                                                                                                                                       |

- How we run it: check in on the temperature; review last retro's actions; write notes (they stay hidden) while
  the timer runs; reveal together; vote, 5 each; turn the top votes into Actions on the Actions tab; archive the
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

| Tab        | Holds                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Ideas      | Board **Ideas**: Ideas, Shortlisted, Approved ⇄, Parked; Ideas; voting with 5 votes                                                          |
| Production | Board **Production**: Approved ⇄, Drafting, In Review, Scheduled, Published (done); Tasks and Ideas; labels and due dates (the publish date) |
| Calendar   | Dashboard: Due Soon, Completion, People; Due Calendar and Workload by Person                                                                 |

### Hiring Pipeline

Open roles, the candidates for each, and the new starter's first month.

| Tab        | Holds                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Roles      | Board **Roles**: Opening Soon, Open, Offer Out, Filled (done); Projects (one per role); start and due dates. Gantt Chart under it  |
| Pipeline   | Board **Pipeline**: Applied, Screen, Interview, Offer, Hired (done), Not Progressing; a row per role; Tasks and Notes; stale cards |
| Onboarding | Board **Onboarding**: Before Day One, First Week, First Month, Done (done); a row per person; Tasks and Actions; due dates         |

### OKRs

Objectives for the period and the key results that measure them, checked in on each week.

| Tab         | Holds                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objectives  | Board **Objectives**: Draft, Committed, Achieved (done), Missed; Projects (one per objective); start and due dates. Gantt Chart under it                                                        |
| Key Results | Board **Key Results**: Not Started, On Track (green), At Risk (amber), Off Track (red), Done (done); a row per objective; Tasks; checklist progress. Status Breakdown under it. How we check in |

- How we check in: each week, move every key result to the column it is in and say why in a comment; anything
  At Risk or Off Track gets an Action.

### Product Launch

Workstreams on a timeline, a checklist per workstream, and the go/no-go on launch day.

| Tab        | Holds                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Timeline   | Board **Workstreams**: Planned, In Progress, Ready, Launched (done); Projects (one per workstream). Gantt Chart under it  |
| Checklist  | Board **Checklist**: To Do, Doing, Blocked (red), Done (done); a row per workstream; Tasks and Actions; due dates         |
| Launch Day | Board **Go / No-Go**: Not Checked, Go (green), No-Go (red); Tasks; a row per person. How we call it and a 30 minute timer |

- How we call it: each owner checks their item and moves it to Go or No-Go; any No-Go is talked through; launch
  when every card is Go.

### Feedback Board

Requests from users, voted on and reviewed, and the ones planned followed to shipped.

| Tab      | Holds                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Feedback | Board **Feedback**: New, Under Review, Planned ⇄, Not Planned; Ideas; voting (no budget). How this works |
| Delivery | Board **Delivery**: Planned ⇄, Building, Shipped (done); Ideas and Tasks; a row per person               |

- How this works: add each request as an Idea; vote on what matters; review the top voted each week; Planned
  moves it to Delivery.

## Telemetry

- A template with tabs sends `Template` · `Used` once, with its kind, as any template; the tabs it adds are not
  `Tab` · `Created`.
