# Fact sheet

The canonical, true-today facts all marketing copy is built from. If something
below stops being true, fix it here first, then propagate to the taglines and
descriptions. Mirrors [Build phase](../../docs/specs/005-project-roadmap/prototype-scope.md)
and [Purpose](../../docs/specs/001-project-vision/purpose.md).

## One line

A real-time planner for teams that works without signing up. Open a link, plan
the work, share it.

## What it is

A shared place in the browser to plan work together, live. Each project holds
tabs: boards of cards, spreadsheets, dashboards and forms, all working from the
same set of cards. There is no sign-up wall in front of it, so the friction to
start is "open the link, add a card."

## Who it's for

Teams that plan and track work together: product and engineering teams running
sprints and bug triage, marketing teams with a content calendar, hiring
managers with a pipeline, small businesses with a budget, an invoice or an
inventory, and anyone gathering answers with a form. The unit of value is the
team, not the individual.

## Shipped today

- Projects with tabs: Board, Sheet, Dashboard and Form tabs, side by side.
- Boards: kanban columns of cards with WIP limits, swimlanes by assignee, type,
  priority or any field, header widgets (Completion, Due Soon, WIP Alerts and
  more), hidden cards for retros, and CSV import and export.
- Cards: one item, shown on as many boards as you like. Rich-text description,
  checklist, status, assignee, priority, labels, dates, comments with
  @mentions.
- Card types: five built in (Project, Task, Note, Idea, Action), or your own
  with custom fields (text, number, date, choice, a link to another card, and
  more).
- Plan views: a Gantt chart, due and start calendars, and charts of cards by
  any field, drawn live from the cards.
- Sheets: spreadsheets with over 150 functions, number formats, sort, filter
  and freeze, dropdowns and checkboxes, conditional formatting, named ranges,
  cell comments, and charts from any cells. Cards can be listed as rows that
  stay linked both ways. Copy and paste with Google Sheets and Excel, CSV in
  and out.
- Dashboards: rows of live slots, each holding a board, a sheet, a plan view, a
  chart, a figure, or a note.
- Forms: build a form in place, share one public link, and each response lands
  as a card on a board or a row in a sheet. No account needed to answer.
- Templates: Project Planner, Kanban, Bug Triage, Team Retro, Weekly Planner,
  Content Calendar, Hiring Pipeline, OKRs, Product Launch, Feedback Board and
  Task Tracker; spreadsheets such as Budget Planner, Timesheet, Invoice,
  Expense Report, Sales Pipeline and Inventory; forms such as Bug Report,
  Feedback, Feature Request, RSVP, Job Application and Contact; or a blank
  board, sheet or form.
- Real-time collaboration: live presence, edits that land for everyone at once,
  each person's selection in their own colour, comments, and undo and redo
  personal to each editor.
- Sharing: editor, participant or view-only links, optionally for one tab,
  with expiry, revocable any time.
- Teams with a shared folder of projects; folders and a Timeline and Inbox in
  the Explorer.
- Agents: AI tools can read and change boards, cards, sheets and forms over
  MCP, the API or the CLI.
- Hybrid auth: guests get the full feature set keyed to a per-browser id;
  signed-in users (Clerk) add cross-device sync, teams and account self-delete.
- Anonymous first-party telemetry. No third-party analytics, no identifiers on
  the wire. Off in any deployment unless configured.

## Licence and price

- Proprietary: the source is not public, and nobody else can run a copy.
- Free at liveplanner.app. No paid tier and no plan to introduce one.
- No ads and no third-party trackers. Boards and sheets export (CSV, image,
  PDF, Markdown outline), so work is never locked in.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, D1 for storage,
Durable Objects for realtime, Static Assets for the Next.js frontends. No
Node-hosted backend, no SSR.

## Not yet shipped (do not imply these exist)

- Operational transform / CRDT (realtime is last-writer-wins today).
- Native mobile or desktop apps (it runs in the browser).

## Links

- Hosted: https://liveplanner.app
- Start a project: https://liveplanner.app/new
