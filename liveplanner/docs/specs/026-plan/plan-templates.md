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
- **Archived examples.** Team Retro's **Past Retros** board shows two archived notes from the sprint before, and
  Meeting Agenda's **Past Meetings** two topics from the meeting before.
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
- **A template may mix boards and a Sheet.** Event Planner's **Guest List**, Sales CRM's **Contacts** and Personal
  Goals' **Habits** are Sheet tabs among the boards, each filled from its sheet template and filling its tab, made on
  every path exactly as a [spreadsheet template's](#spreadsheet-templates) Sheet is; the template's Dashboard shows
  them beside its boards.
- **A template may hold a Form tab** whose responses go to one of its own tabs: Help Desk's **Contact Form** feeds
  its Tickets board, Event Planner's **RSVP** its RSVP Responses sheet, and Kanban Board, Bug Tracker, Hiring Pipeline
  and Feedback Board have theirs ([Forms a template holds](#forms-a-template-holds)). The catalogue names the form's starter and
  the tab it feeds, and the form is made with its tab on every path below, unpublished
  ([Forms](../030-forms/forms.md#starting-a-form), "In a plan template").
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
- **A ready-made type's Default State** is a state name ([Item types](item-types.md#an-item-type)): for the thirteen
  below, the first column of the board it is made for.

### Ready-made card types

The five default types (Project, Task, Note, Idea, Action: [Items](items.md#item-types)) and these thirteen. Colours from
the Plan palette. Every type also offers Comments, last. Card fields link to the type named. "On the card" is what
its Detailed cards add Under the Title.

| Type            | Id                | Glyph     | Colour           | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                    | On the card     | Default State  |
| --------------- | ----------------- | --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------- |
| Bug             | `bug`             | bug       | red `#dc2626`    | A Task's (Parent among them), then **Steps to Reproduce** (Long Text), **Environment** (Text) and **Email** (Email: who reported it)                                                                                                                                                                                                                                                                                                      |                 | New            |
| Story           | `story`           | story     | violet `#7c3aed` | A Task's                                                                                                                                                                                                                                                                                                                                                                                                                                  |                 | Backlog        |
| Request         | `request`         | inbox     | orange `#ea580c` | Description, Status, Assignee, Priority, Votes, Labels; **Requested By** (Text), **Email** (Email)                                                                                                                                                                                                                                                                                                                                        | Requested By    | New            |
| Content         | `content`         | megaphone | pink `#db2777`   | Description, Status, Assignee, Votes, Labels, Due, Checklist; **Channel** (Choice: Blog, Newsletter, Social, Video, Podcast), **Link** (Link)                                                                                                                                                                                                                                                                                             | Channel         | Ideas          |
| Role            | `role`            | briefcase | cyan `#0891b2`   | Description, Status, Assignee (the hiring manager), Priority, Colour, Start, Due, Labels; **Team** (Text), **Location** (Text), **Employment** (Choice: Full-time, Part-time, Contract, Internship)                                                                                                                                                                                                                                       | Team            | Opening Soon   |
| Candidate       | `candidate`       | user-plus | pink `#db2777`   | Description, Status, Assignee (who looks after them), Labels, Due (the next step), Checklist; **Role** (Card: Role), **Source** (Choice: Referral, Job Board, Inbound, Agency, Sourced), **Profile** (Link), **Email** (Email)                                                                                                                                                                                                            |                 | Applied        |
| Onboarding Task | `onboarding-task` | checklist | green `#16a34a`  | Description, Status, Assignee, Due, Checklist; **New Starter** (Card: Candidate)                                                                                                                                                                                                                                                                                                                                                          |                 | Before Day One |
| Objective       | `objective`       | target    | amber `#d97706`  | Description, Status, Assignee, Priority, Colour, Start, Due, Labels                                                                                                                                                                                                                                                                                                                                                                       |                 | Draft          |
| Key Result      | `key-result`      | trend     | teal `#0d9488`   | Description, Status, Assignee, Due, Checklist; **Objective** (Card: Objective), **Baseline**, **Target**, **Current** (Numbers)                                                                                                                                                                                                                                                                                                           | Current, Target | Not Started    |
| Milestone       | `milestone`       | milestone | teal `#0d9488`   | Description, Status, Due (the date to reach it by), Checklist; **Goal** (Card: Objective)                                                                                                                                                                                                                                                                                                                                                 |                 |                | Not Started |
| Launch Check    | `launch-check`    | flag      | green `#16a34a`  | Description, Status, Assignee, Priority; **Workstream** (Card: Project)                                                                                                                                                                                                                                                                                                                                                                   | Workstream      | Not Checked    |
| Deal            | `deal`            | coin      | green `#16a34a`  | Description, Status, Assignee (the deal's owner), Due (the expected close), Checklist, Labels; **Company** (Text), **Value** (Currency: GBP in the catalogue; a project newly given the type from the editor takes the browser region's currency when it is one of the common codes, set once and kept, so a value already stored in GBP stays GBP), **Contact** (Text), **Source** (Choice: Inbound, Referral, Outbound, Event, Partner) | Company, Value  | Lead           |
| Ticket          | `ticket`          | ticket    | blue `#2563eb`   | Description, Status, Assignee, Priority, Due (when it is promised by), Checklist, Labels; **Customer** (Text), **Email** (Email), **Channel** (Choice: Email, Chat, Phone, Form)                                                                                                                                                                                                                                                          | Customer        | New            |

- A Role and an Objective offer Start and Due, so the Gantt chart draws them; a Candidate's Role, a Key Result's
  Objective, a Milestone's Goal and an Onboarding Task's New Starter are what their boards lay their rows by. A
  Milestone is a step on the way to a personal goal: it is reached when it is in a done column, so it needs no
  numbers.
- A Request's, a Bug's and a Candidate's **Email** is where a template's form puts the sender's address
  ([Forms a template holds](#forms-a-template-holds)), so the form brings no field of its own; a Ticket has had one
  from the start.

### Card templates the ready-made types hold

Eight ready-made types come with [card templates](item-types.md#card-templates), so a board that brings one (a
template's or a preset's) offers its kinds of card already filled in from **Add card**'s menu. They are the type's
own, as a person's are: renamed, changed or deleted in the type editor, and never put back. Each holds only what a
template may (a description, a checklist, labels and the type's own text, choice and long text fields); none holds a
title, so its card takes the type's new-card title.

| Type            | Card templates                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bug             | **Crash** (label crash; Steps to Reproduce laid out; checks: reproduced on the latest build, crash log attached, versions affected), **Visual Glitch** (label ui; a screenshot, light and dark, a phone), **Slow Screen** (label performance; how long, how much data, against the last release) |
| Story           | **User Story** (As a, I want, So that; checks: acceptance criteria agreed, designs linked, estimated), **Spike** (label spike; the question and its time box; options written up, recommendation shared)                                                                                         |
| Request         | **Feature Request** (label feature; what they want to do, why it matters and how they do it today), **Access Request** (label access; which tool, what level and who approved it); a Request has no checklist                                                                                    |
| Content         | **Blog Post** (Channel Blog; outline, draft, edit, images with alt text, search title), **Newsletter** (Channel Newsletter; lead story, links checked, test send, scheduled), **Social Post** (Channel Social; copy, image or video, alt text, scheduled)                                        |
| Candidate       | **Interview Loop** (screen, skills, team, references, decision), **Referral** (Source Referral; who referred them and why; thank the referrer, screen call)                                                                                                                                      |
| Onboarding Task | **Laptop and Accounts** (order the laptop, email and calendar, chat, password manager, tools), **First Week Plan** (meet the team, coffee with a buddy, a first small task, end-of-week check-in)                                                                                                |
| Deal            | **Inbound Lead** (Source Inbound; qualify budget, decision maker and timeline, book a demo), **Renewal** (label renewal; usage review, pricing agreed, contract sent, signed)                                                                                                                    |
| Ticket          | **Something’s Broken** (label bug; steps, a screenshot, passed to engineering), **Billing Question** (label billing; find the invoice, explain the charge, refund if due), **Refund Request** (label refund; order found, within the window, refunded, customer told)                            |

- A test holds every card template to what a type's templates accept (`readCardTemplates`, refusing): only fields the
  type offers, of kinds a template sets.
- The five default types (Project, Task, Note, Idea, Action) hold none: they are every project's, and a template on
  them would arrive in plans that never asked for it.

## What a template shows off

A template is the first thing a person sees of liveplanner, so each uses the features that fit its work, set up and
working, not described:

- **Card templates** where people file the same kind of card again and again, on the ready-made types above.
- **A form wired to its board** where people outside the team send the work in (below).
- **Flow charts** on the Dashboard of every **delivery** template (one whose work flows to done under WIP limits):
  Cumulative Flow, Cycle Time and Throughput ([Plan views](plan-views.md#flow-charts)). Project Planner, Kanban Board,
  Bug Tracker, Feedback Board, Help Desk, Sprint Board and Editorial Pipeline carry them.
- **The calendar feed** on every date-heavy template: its How this works note ends "Subscribe to Calendar from the
  tab menu to see these dates in your own calendar" ([Calendar feed](calendar-feed.md)). Project Planner, Weekly
  Planner, Content Calendar, Event Planner, Study Planner, Client Onboarding, Editorial Pipeline and Trip Planner say
  so.
- **WIP limits, votes, hand-offs, rows by a field** and the rest, each where the work needs it (the tables below).
- **Starter rules** on every template with a board, made in the plan's Automations (below).

### Starter rules

Every template with a board starts with [Automations](automations.md) rules picked for its work, so its board already
does the dull bits and the Automations screen opens on rules that fit the plan rather than an empty list. A Sheet
template and a blank plan have no cards for a rule to act on, and start with none.

- **What they are.** Each is the Templates gallery's own rule (Automations "The Automations screen": Templates),
  filled from the columns and card types the template makes, under its gallery name, named free among the plan's rules
  so making them again never doubles a name.
- **On or off.** A rule ships on only when it moves, sets a field, flags, assigns or comments and has nothing left to
  pick. **Triage New Bugs**, **Route Reviews** and **Share Out Form Responses** ship off
  without their Assign in Turn step, which a save refuses until it names 2 to 10 people: whoever turns one on adds the
  step with the people on the plan.
- **Never outgoing.** No starter rule sends an email, calls a webhook, mentions anyone, makes or copies a card,
  archives or asks the AI; a test holds every template's starter rules to moves, fields, labels, flags, assignees and
  comments, and every template with a board to at least one rule that is on.
- **Who gets them.** A rule acts for a signed-in Editor and runs on the plan's server, so the rules are made where the
  plan is saved to an account by a signed-in person:
  - **A cloud plan** made from the editor's wizard (/new, the workspace's New): its create names the template
    (`starterRules` on `POST /api/projects`, [API](../015-api/api.md)) and the server makes them as it makes the plan.
  - **The API's create** with a seeded template tab (the MCP's `create_project`, the CLI's `--template`) makes them the
    same way, for a signed-in person or their API token.
  - **Start Planning** on a cloud plan's first tab: the editor makes them, as Make Plan makes its own, once it knows the
    person may.
  - **A plan in This Browser** keeps its template with the plan (made from the wizard, or Start Planning on its first
    tab), and its rules are made, on or off as they ship, the moment it is saved to the cloud: Sync Plan's create names
    the template as the wizard's does.
  - A guest's cloud plan gets none (a guest can hold no rule; Automations "Who may do what"), nor does a template on a
    later tab, a copy (it keeps its plan's rules) or an import.
- **Their time zone** is the person's (the browser's), for a rule that reads one; the API's seeded create uses UTC.
- **Completed On.** Stamp the Finish Date sets a date field named like Completed On, which the delivery templates'
  work types carry (their card types below). A card of a type without it is skipped, never failed.

| Template           | On                                                                                 | Off                                                      |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Project Planner    | Stamp the Finish Date, Close the Parent, Assign on Start, Flag Blocked Cards       | Route Reviews                                            |
| Kanban Board       | Assign on Start, Flag Blocked Cards, Close the Parent                              | Route Reviews, Share Out Form Responses                  |
| Bug Tracker        | Stamp the Finish Date, Reopen on New Comment, Flag Blocked Cards, Close the Parent | Triage New Bugs, Route Reviews, Share Out Form Responses |
| Team Retro         | Assign on Start, Give It a Due Date                                                |                                                          |
| Weekly Planner     | Flag Blocked Cards, Close the Parent                                               |                                                          |
| Content Calendar   | Assign on Start, Flag Blocked Cards                                                | Route Reviews                                            |
| Hiring Pipeline    | Assign on Start, Flag Blocked Cards                                                | Share Out Form Responses                                 |
| OKRs               | Flag Blocked Cards, Close the Parent                                               |                                                          |
| Product Launch     | Assign on Start, Flag Blocked Cards, Close the Parent                              |                                                          |
| Feedback Board     | Assign on Start, Flag Blocked Cards                                                | Share Out Form Responses                                 |
| Event Planner      | Give It a Due Date, Flag Blocked Cards, Close the Parent                           |                                                          |
| Sales CRM          | Assign on Start, Flag Blocked Cards                                                |                                                          |
| Help Desk          | Reopen on New Comment, Assign on Start                                             | Route Reviews                                            |
| Meeting Agenda     | Assign on Start, Give It a Due Date                                                |                                                          |
| Personal Goals     | Flag Blocked Cards, Close the Parent                                               |                                                          |
| Study Planner      | Give It a Due Date, Flag Blocked Cards                                             |                                                          |
| Sprint Board       | Stamp the Finish Date, Close the Parent, Assign on Start, Flag Blocked Cards       | Triage New Bugs, Route Reviews                           |
| Client Onboarding  | Assign on Start, Flag Blocked Cards, Close the Parent                              |                                                          |
| Editorial Pipeline | Assign on Start, Give It a Due Date, Flag Blocked Cards                            |                                                          |
| Trip Planner       | Flag Blocked Cards                                                                 |                                                          |

The rules are built from the template's own boards (a few milliseconds), in the server's create or, for Start
Planning, in a chunk the editor loads only then; each Start Planning rule is one Automations request.

### Forms a template holds

| Template        | Form tab         | Starter         | Its responses                                     | Left out            |
| --------------- | ---------------- | --------------- | ------------------------------------------------- | ------------------- |
| Kanban Board    | **Request Form** | Contact         | Requests on **Requests**, in New                  |                     |
| Bug Tracker     | **Bug Report**   | Bug Report      | Bugs on **Triage**, in New                        | Severity            |
| Hiring Pipeline | **Application**  | Job Application | Candidates on **Pipeline**, in Applied            | Years of Experience |
| Feedback Board  | **Request Form** | Contact         | Requests on **Feedback**, in New                  |                     |
| Event Planner   | **RSVP**         | Event RSVP      | Rows on **RSVP Responses**                        |                     |
| Help Desk       | **Contact Form** | Contact         | Tickets on **Tickets**, in New (Name as Customer) |                     |

- **Left out**: a starter question whose field the target's card type lacks and that the work does not need is left
  out of the template's form, so the form brings no field of its own: a Bug's priority is the team's call in triage,
  not the reporter's Severity, and a Candidate's experience is in their answer. The entry names the questions it
  leaves out by the field they map to (`leaveOut`).
- Each form's Responses figure sits on its template's Dashboard, beside the boards.

## The templates

Colours: **green** `#16a34a`, **amber** `#d97706`, **red** `#dc2626`. A board's card types are named in its row,
each a [ready-made type](#ready-made-card-types); the project has those and no others. A hand-off is marked ⇄.

### Blank Plan

One tab (named as any new tab is), empty: no board, so the tab shows Plan's **Start Planning** picker
([Plan mode](plan-mode.md#starting-a-board)), where the person picks the board that fits (or searches for a template).

### Project Planner

Projects on a roadmap and a timeline, broken into tasks, run in sprints and walked every day.

| Tab           | Holds                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap       | Board **Roadmap**: Now, Next, Later, Shipped (done); Projects; start and due dates. Gantt Chart under it. How this works                                                                                                                 |
| Backlog       | Board **Backlog**: Backlog, Ready, This Sprint ⇄; a row per project; Stories, Tasks and Bugs; estimates and priority                                                                                                                     |
| Sprint        | Board **Sprint**: This Sprint ⇄, In Progress (WIP 3) ⇄, Blocked (red) ⇄, In Review ⇄, Done ⇄; a row per person; Stories, Tasks and Bugs; points. Cards by Field, Priority by Status, Cumulative Flow, Cycle Time and Throughput under it |
| Daily Standup | Board **Daily Standup**: In Progress ⇄, Blocked ⇄, In Review ⇄, Done ⇄; a row per person; Stories, Tasks and Bugs; Detailed cards. How we run it, a 15 minute timer and a picker for who goes first                                      |

- How this works: add a Project for each piece of work on Roadmap and give it dates (the Gantt draws them);
  break it into Stories, Tasks and Bugs on Backlog, each under its project (a Story or Bug from its card templates);
  move what the team takes on to This Sprint; walk Daily Standup each morning; subscribe to Calendar from the tab menu
  to see these dates in your own calendar.

### Kanban Board

Continuous flow: requests come in, are accepted onto the board, and flow to Done under WIP limits. It stays in
the Kanban boards family.

| Tab          | Holds                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Board        | Board **Kanban**: Backlog ⇄, To Do, In Progress (WIP 3), Review (WIP 2), Done; Tasks and Requests                                             |
| Requests     | Board **Requests**: New, Needs Info (amber), Backlog ⇄ (green: accepted, it lands on the Board), Declined; Requests. How this works           |
| Request Form | Form **Request Form**: the Contact starter, each message a Request in Requests' New; unpublished                                              |
| Flow         | Dashboard: Item Count, Completion, Stale Cards, Unassigned, Request Form's Responses; Cumulative Flow, Cycle Time, Throughput, Cards by Field |

- How this works: publish Request Form and share its link, so requests land in New; add your own there too; ask in
  Needs Info when one is unclear; accept one by moving it to Backlog (it lands on the Board tab); say why in a comment
  when you decline.

### Bug Tracker

Bugs triaged by priority, then fixed, reviewed and released.

| Tab        | Holds                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Triage     | Board **Triage**: New, Needs Info (amber), Confirmed ⇄, Won't Fix, Duplicate (no done column); a row per priority; Bugs. How we triage                       |
| Bug Report | Form **Bug Report**: the Bug Report starter without Severity, each report a Bug in Triage's New; unpublished                                                 |
| Fixing     | Board **Fixing**: Confirmed ⇄, Fixing (WIP 4), In Review, Fixed (done), Released; a row per person; Bugs                                                     |
| Health     | Dashboard: Item Count, Priorities, Stale Cards, Unassigned, Bug Report's Responses; Priority by Status, Cards by Field, Cycle Time, Throughput, Due Calendar |

- How we triage: publish Bug Report and share its link, so reports land in New; start your own from Crash, Visual
  Glitch or Slow Screen; Urgent is broken for everyone (fix now), High blocks someone, Medium has a workaround, Low is
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
  card's status picker lists the days); what waits on someone else goes in Waiting On; subscribe to Calendar from the
  tab menu to see these dates in your own calendar.

### Content Calendar

Ideas voted on and approved, produced through review to published, and every publish date on a calendar.

| Tab        | Holds                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ideas      | Board **Ideas**: Ideas, Shortlisted, Approved ⇄, Parked; Content; a **Vote** button (5 dots each)                                                              |
| Production | Board **Production**: Approved ⇄, Drafting, In Review, Scheduled, Published (done); Content and Tasks; labels and due dates (the publish date). How this works |
| Calendar   | Dashboard: Due Soon, Completion, People; Due Calendar and Cards by Field                                                                                       |

- How this works: start each piece from its card template (Blog Post, Newsletter or Social Post) and work down its
  checklist; set Due to the publish date; move it along as it is written, reviewed and scheduled; subscribe to Calendar
  from the tab menu to see these dates in your own calendar.

### Hiring Pipeline

Open roles, the candidates for each, and the new starter's first month.

| Tab         | Holds                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles       | Board **Roles**: Opening Soon, Open, Offer Out, Filled (done); Roles; start and due dates. Gantt Chart of the Roles under it                                                                       |
| Pipeline    | Board **Pipeline**: Applied, Screen, Interview, Offer, Hired (done), Not Progressing; a row per role (Role); Candidates; stale cards. Item Count, Stale Cards, Unassigned; Cycle Time. How it fits |
| Application | Form **Application**: the Job Application starter without Years of Experience, each application a Candidate in Pipeline's Applied; unpublished                                                     |
| Onboarding  | Board **Onboarding**: Before Day One, First Week, First Month, Done (done); a row per new starter (New Starter); Onboarding Tasks; due dates                                                       |
| Overview    | Dashboard: the views and note above, and Application's Responses figure, beside each tab                                                                                                           |

- How it fits: each Role is a card on Roles; publish Application and share its link, so applicants land in Applied;
  each Candidate names their Role, so the Pipeline lays a row per role, and a Role's panel lists its candidates
  (Linked as Role, with **New Candidate**); start a candidate from Interview Loop or Referral; once hired, a Candidate
  is the New Starter their Onboarding Tasks name, a row each.

### OKRs

Objectives for the period and the key results that measure them, checked in on each week.

| Tab         | Holds                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objectives  | Board **Objectives**: Draft, Committed, Achieved (done), Missed; Objectives; start and due dates. Gantt Chart of the Objectives under it                                                                                      |
| Key Results | Board **Key Results**: Not Started, On Track (green), At Risk (amber), Off Track (red), Done (done); a row per objective (Objective); Key Results; due dates and checklist progress. Cards by Field under it. How we check in |
| Overview    | Dashboard: the views and note above, beside each tab                                                                                                                                                                          |

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

| Tab          | Holds                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Feedback     | Board **Feedback**: New, Under Review, Planned ⇄, Not Planned; Requests; a **Vote** button (3 dots each). How this works          |
| Request Form | Form **Request Form**: the Contact starter, each message a Request in Feedback's New; unpublished                                 |
| Delivery     | Board **Delivery**: Planned ⇄, Building, Shipped (done); Requests and Tasks; a row per person. Cycle Time and Throughput under it |
| Overview     | Dashboard: the views and note above, and Request Form's Responses figure, beside each tab                                         |

- How this works: publish Request Form and share its link, so requests land in New; add your own as a Request (a
  Feature Request from its card template); press Vote and vote on what matters; review the top voted each week;
  Planned moves it to Delivery.

### Event Planner

An event's workstreams on a timeline, the tasks under each, the guest list, and an RSVP form whose replies land as rows,
with what is due on a calendar.

| Tab            | Holds                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline       | Board **Workstreams**: Planned, In Progress, At Risk (red), Confirmed (green, done); Projects (one per workstream: Venue, Catering...); start and due dates. Gantt Chart under it |
| Tasks          | Board **Tasks**: To Do, Doing, Waiting On (amber), Done (done); a row per workstream (Parent); Tasks; due dates. Due Soon, Completion, Unassigned; Due Calendar. How this works   |
| Guest List     | Sheet **Guest List**, filling the tab: the Guest List sheet template (invitations, RSVPs, plus-ones and dietary needs, the headcount and a pie chart)                             |
| RSVP           | Form **RSVP**: the Event RSVP starter (Name, Email, Attending?, Dietary needs), each reply a row on RSVP Responses; unpublished                                                   |
| RSVP Responses | Sheet **RSVP Responses**, filling the tab: a blank sheet, its headers written by the form                                                                                         |
| Overview       | Dashboard: the views and note above, and RSVP's Responses figure, beside each tab                                                                                                 |

- How this works: add a Workstream for each part of the event (venue, catering, speakers), with its dates; break each
  into Tasks on Tasks, under its workstream; publish RSVP and share its link, each reply landing on RSVP Responses;
  keep the Guest List as replies come in; watch what is due on Overview; subscribe to Calendar from the tab menu to see
  these dates in your own calendar.

### Sales CRM

Deals moved from lead to won, each with its company and value, the people behind them on a contact list, and the
pipeline on a dashboard.

| Tab      | Holds                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deals    | Board **Deals**: Lead, Qualified, Proposal, Negotiation (amber), Won (green, done), Lost; a row per person (the deal's owner); Deals; due dates (the expected close). How this works |
| Contacts | Sheet **Contacts**, filling the tab: the Contacts sheet template (people with stages, days since contact and who is due a follow-up)                                                 |
| Overview | Dashboard: Item Count, Completion, People, Stale Cards; Cards by Field and Due Calendar, beside each tab                                                                             |

- How this works: add a Deal for each opportunity, with its company and value; move it along as it progresses; set
  Due to when you expect it to close; keep the people you speak to on Contacts.

### Help Desk

A support queue: tickets by priority from new to closed, a contact form whose messages land as tickets, and the help
articles they lead to.

| Tab            | Holds                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tickets        | Board **Tickets**: New, Open, Waiting on Customer (amber), Resolved (green, done), Closed; a row per priority; Tickets; due dates. How we work the queue             |
| Contact Form   | Form **Contact Form**: the Contact starter (Name to Customer, Email, Subject to Title, Message to Description), each message a Ticket in Tickets' New; unpublished   |
| Knowledge Base | Board **Knowledge Base**: To Write, Drafting, In Review, Published (done); Notes (one per article); labels                                                           |
| Overview       | Dashboard: Item Count, Priorities, Stale Cards, Unassigned, Contact Form's Responses; Priority by Status, Cards by Field, Cycle Time and Throughput, beside each tab |

- How we work the queue: publish the Contact Form and share its link, so messages arrive as tickets in New; every new
  ticket gets an owner and a priority (one you log yourself can start from Something’s Broken, Billing Question or
  Refund Request); urgent first, then the oldest; Waiting on
  Customer while you need their reply; Resolved once they confirm, Closed a week later; a question asked twice
  becomes an article on Knowledge Base.

### Meeting Agenda

A recurring meeting's topics, voted into order and discussed one at a time, the actions they lead to, and past
meetings archived.

| Tab      | Holds                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agenda   | Board **Agenda**: To Discuss, Discussing (WIP 1), Discussed (done); Notes (one per topic); votes. How we run it, a 10 minute timer and a **Vote** button (3 dots each) |
| Actions  | Board **Actions**: To Do, Doing, Done (done); Actions only; a row per person; due dates                                                                                |
| Archive  | An Archive board, **Past Meetings**                                                                                                                                    |
| Overview | Dashboard: the note above, beside each tab                                                                                                                             |

- How we run it: add topics to To Discuss before the meeting; press Vote (3 dots each) to put them in order; take one
  topic at a time into Discussing; write the decision in a comment; turn every follow-up into an Action; archive the
  topics when done.

### Personal Goals

A person's goals for the year, the milestones on the way to each, and the daily habits behind them. It speaks
plainly, not in OKR terms: its steps are Milestones, never Key Results.

| Tab         | Holds                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goals       | Board **Goals**: Someday, This Year, Working On (teal), Achieved (green, done); Objectives; start and due dates. Gantt Chart of the Objectives under it        |
| Key Results | Board **Key Results**: Not Started, On Track (green), Behind (amber), Done (done); a row per goal (Objective); Key Results; checklist progress. How this works |
| Habits      | Sheet **Habit Tracker**, filling the tab: the Habit Tracker sheet template (a week of ticks against each habit's goal and a bar chart)                         |
| Overview    | Dashboard: the chart and note above, beside each tab                                                                                                           |

- How this works: write each goal on Goals, with when you want it by; break it into two or three Milestones, each
  with a date; each Sunday, move your milestones along; tick your habits on Habits each day.

### Study Planner

A student's coursework and revision, by subject, with every deadline on a calendar.

| Tab         | Holds                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Assignments | Board **Assignments**: To Do, In Progress, Submitted (teal, done), Graded (green); Tasks, labelled by subject; due dates and checklists |
| Revision    | Board **Revision**: Not Started, Revising (amber), Confident (green, done); Notes (one per topic), labelled by subject. How this works  |
| Calendar    | Dashboard: Due Soon, Completion, Item Count; Due Calendar across the full width                                                         |

- How this works: add each assignment with its subject as a label and its due date; break big ones into steps on its
  checklist; add a card per exam topic on Revision; move a topic to Confident once you can explain it without notes;
  subscribe to Calendar from the tab menu to see these dates in your own calendar.

### Sprint Board

One team's sprint run for flow: a backlog made ready, work pulled under WIP limits, and the flow charts read at the
retro. Lighter than Project Planner (no roadmap, no standup board); in the Kanban boards family as Project Planner is.

| Tab     | Holds                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint  | Board **Sprint**: To Do ⇄, In Progress (WIP 3), In Review (WIP 2), Blocked (red), Done (done); a row per person; Stories, Tasks and Bugs; estimates and priority |
| Backlog | Board **Backlog**: Backlog, Ready (green), To Do ⇄; Stories, Tasks and Bugs; estimates and priority. How this works                                              |
| Flow    | Dashboard: Item Count, Completion, Stale Cards, Unassigned; Cumulative Flow, Cycle Time, Throughput and Cards by Field                                           |

- How this works: write each piece of work as a Story, Task or Bug (a User Story or Spike from its card template);
  estimate it and move it to Ready once the team understands it; at planning, move what fits to To Do (it lands on
  Sprint); keep In Progress under its limit and finish before you start; name what holds a card up in its Blocked By
  and move it to Blocked; read Flow at the retro.

### Client Onboarding

Each new client from signed to live: their stages on a timeline, the tasks for each, and what is due on a calendar.

| Tab      | Holds                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clients  | Board **Clients**: Signed, Kickoff, Setup, Training, Live (green, done); Projects (one per client); start and due dates (the go-live). Gantt Chart under it                                       |
| Tasks    | Board **Tasks**: To Do, Doing, Waiting on Client (amber), Done (done); a row per client (Parent); Tasks; checklists and due dates. Due Soon, Completion, Unassigned; Due Calendar. How this works |
| Overview | Dashboard: the views and note above, beside each tab                                                                                                                                              |

- How this works: add a Client card for each new customer, with their start and go-live dates; break the onboarding
  into Tasks under each client (kickoff call, data import, admin training); Waiting on Client while they owe you
  something; move the client along as each stage finishes, Live once they use it every day; subscribe to Calendar from
  the tab menu to see these dates in your own calendar.

### Editorial Pipeline

Pitches voted on and commissioned, then written, edited and fact-checked under WIP limits to published, with the
flow of finished pieces on a dashboard. Content Calendar plans a marketing team's posts; this runs an editorial desk.

| Tab        | Holds                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pitches    | Board **Pitches**: Pitched, Shortlisted, Commissioned ⇄ (green), Declined; Content; votes; a **Vote** button (3 dots each)                                                                                                                                                  |
| Production | Board **Production**: Commissioned ⇄, Drafting (WIP 4), Editing (WIP 2), Fact Check, Scheduled, Published (done); Content and Tasks; due dates (the publish date). Due Soon, Completion, Stale Cards; Cumulative Flow, Cycle Time, Throughput, Due Calendar. How this works |
| Overview   | Dashboard: the views and note above, beside each tab                                                                                                                                                                                                                        |

- How this works: pitch a piece on Pitches and vote on the ones worth writing; commission it and it lands in
  Production; start it from its card template (Blog Post, Newsletter or Social Post); keep Editing under its limit so
  drafts never pile up; set Due to the publish date; subscribe to Calendar from the tab menu to see these dates in
  your own calendar.

### Trip Planner

A group trip: ideas voted onto the days, every booking with its date to book by, and who packs what.

| Tab       | Holds                                                                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Itinerary | Board **Itinerary**: Ideas, Day 1, Day 2, Day 3, Day 4 (no done column); Ideas and Notes; votes; a **Vote** button (3 dots each)                                                          |
| Bookings  | Board **Bookings**: To Book, Booked (teal), Paid (green, done); Tasks, labelled Travel, Stay, Food or Activities; due dates (book by). Due Soon, Completion; Due Calendar. How this works |
| Packing   | Board **Packing**: To Pack, Packed (done); a row per person; Tasks; checklists                                                                                                            |
| Overview  | Dashboard: the views and note above, beside each tab                                                                                                                                      |

- How this works: add each idea to Itinerary's Ideas and vote on the ones you want; move the winners onto a day; add
  every flight, stay and ticket to Bookings with the date to book it by; Booked once confirmed, Paid once settled;
  share out the packing on Packing; subscribe to Calendar from the tab menu to see these dates in your own calendar.

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
  each sits in the category of the job it does (Inventory with the Money sheets in **Finance**, Guest List in
  **Events**, Grade Book in **Education**), as every template does
  ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).
- Start Planning's **Inspiration** leaves out the spreadsheet templates that make one tab: each is one Sheet that
  Start Planning's **Spreadsheets** already offers as a sheet template, so it would show the same thing twice. One
  that sets up more tabs (Task Tracker, its Sheet and an Overview) stays in it
  ([Plan mode](plan-mode.md#starting-a-board)).
- Telemetry as any template: `Template` · `Used` with its kind.

## Telemetry

- A template with tabs sends `Template` · `Used` once, with its kind, as any template; the tabs it adds are not
  `Tab` · `Created`.
