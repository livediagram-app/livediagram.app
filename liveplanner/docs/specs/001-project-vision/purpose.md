# Purpose

liveplanner is a web app where teams **plan the work together, in real time**.

This is the root of the spec tree: every other spec is a decision taken inside
the boundaries set here. That only works if it stays true, so it carries a
[record of the boundaries that have moved](#boundaries-that-have-moved) rather
than quietly describing a product that no longer exists.

## What it is

A multiplayer planner in the browser. What a person makes is a **project**
([Domain language](../003-system-architecture/domain-language.md)): a named set of tabs, each one of four kinds
([Plan tabs](../026-plan/plan-tabs.md)):

- a **Board** of cards for the work itself: columns, swimlanes, WIP limits, card types with their own fields;
- a **Sheet** for the numbers: a spreadsheet with formulas that can read the project's cards;
- a **Dashboard** that puts the project's boards, sheets, plan views, charts and notes side by side;
- a **Form** whose responses land as cards on a board.

Anyone with access to a project can join, see the others' cursors and edits
live, and work on it at the same time. The output is a plan a team keeps
running, not a report one person writes and the rest review.

The project is the product. Everything else exists because a team planning
together is usually doing it **with other people in the room**, and what that
needs (a way to vote on cards, a timer, comments that turn into actions, a way
to collect requests from outside the team) was otherwise a second tool and a
context switch.

## Target users

Teams that run work together and want one place for it:

- Product and engineering teams running a backlog, a roadmap, a sprint or a bug triage.
- Operations, marketing and events teams tracking launches, content calendars and requests.
- Any group running a retro, a planning session or an intake form whose answers become work.

The unit of value is the **team**. The entry point is one person: the planner
works fully without signing in, and a guest gets persistence, share links and
real-time collaboration ([Auth + guest access](../014-identity/auth-and-guest-access.md)). That is not a
contradiction, it is the funnel. Somebody tries it alone, and the product earns
the second person. What it must not become is a tool where the second person
never arrives.

## Core capabilities

- **Real-time collaboration** ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)):
  live cursors and presence on cards and cells, per-change merge so concurrent edits don't clobber, and an
  ordered room with reconnect catch-up.
- **Boards and cards** ([Plan board](../026-plan/plan-board.md), [Items](../026-plan/items.md),
  [Item types](../026-plan/item-types.md)): cards kept in their own store, dragged between columns and rows,
  typed with custom fields, voted on, and drawn into plan views (Gantt, calendar, workload, status, priority;
  [Plan views](../026-plan/plan-views.md)).
- **Sheets** ([Sheet](../029-sheets/sheet.md)): cells, formulas, formats, validation and conditional formats,
  live for everyone with one undo timeline.
- **Dashboards** ([Plan tabs](../026-plan/plan-tabs.md)): rows of slots holding live versions of the project's
  boards and sheets, plan views, charts and notes.
- **Forms** ([Forms](../030-forms/forms.md)): a public link anyone can fill in without an account; every
  response becomes a card.
- **Running the session**: timers and dot votes on cards
  ([Session tools (timer + voting)](../012-collaboration/session-tools.md)), comments and
  [assigned actions](../012-collaboration/assigned-actions.md), and the Actions board that collects them
  ([Linked boards](../026-plan/linked-boards.md)).
- **Templates** ([Plan templates](../026-plan/plan-templates.md)): projects that start with their boards, card
  types and example cards set up for the job.
- **Teams** ([Teams](../013-workspace/teams.md), [Team shared projects](../013-workspace/team-shared-projects.md)):
  a named group with Admin and Member roles and a shared library of projects and folders. A project lives in
  exactly one place: someone's own tree, or one team's library. Personal is the default; a team is opt-in.
- **Persistence and history**: every change is saved; undo and redo step through your own recent edits, and
  [timeline events](../013-workspace/timeline.md) record what happened to each project.
- **Machine access**: a REST API with signed-in tokens
  ([Public API and API tokens](../015-api/public-api-and-tokens.md)), an MCP server so AI tools can read and
  change boards, cards, sheets and forms ([MCP server](../015-api/mcp-server.md)), and the `liveplanner`
  [CLI](../015-api/cli.md).

## What it is _not_

- **Not a diagram tool or a whiteboard.** liveplanner was forked from livediagram and keeps only its Plan mode;
  shapes, arrows, freehand drawing, pages and workshops are livediagram's, not this product's. The test for a
  new feature is whether it helps a team plan and run work, not whether a canvas could hold it.
- **Not a writing tool or wiki.** A card has a description and a project has comments; long-form prose is
  not the goal.
- **Not a desktop app.** The web, with collaboration, is the product. Offline Mode is a per-project choice, not
  the default posture ([Offline Mode](../006-project/offline-mode.md)).
- **Not a paid product, ever.** No tier, no billing, no feature flags gating the planner
  ([Business model + licence](../002-project-scope/business-model-and-licence.md)).
- **Not a public codebase (yet).** The code is MIT licensed but its repository is private; the product is free to use.

## Boundaries that have moved

When a boundary moves, it is recorded here in the same change, with the spec that moved it.

- **From a diagram canvas to a planner** (October 2026): liveplanner began as a fork of livediagram, whose
  boundary was "teams build diagrams together". The fork keeps Plan (Board, Sheet, Dashboard and Form tabs) and
  the core around it (the Explorer, sign-in, collaboration, comments, sharing, teams, the Trash, settings,
  theming, the MCP server and the CLI), and drops the diagram, draw, workshop and pages modes with their
  elements, importers, facilitation tools and community gallery ([Scope](../002-project-scope/product-scope.md)).
- **"Not an offline-first desktop app"**: narrowed by [Offline Mode](../006-project/offline-mode.md). Still not
  a desktop app, and cloud is still the default, but a project can be kept only in this browser's IndexedDB and
  converted back and forth.

## Why it matters

Most teams spread one plan across several tools: a board in one, the numbers in
a spreadsheet, a status report in a slide, the requests in a form tool, and the
retro on a whiteboard. Each is either single-player, heavyweight, or paid per
seat. liveplanner exists to be the **fast, free, multiplayer-from-the-start**
place where one team's plan lives in one project.

"One project" is the load-bearing phrase. The honest check on any new feature is
not "is this good?" but "does a team running this plan need it in the project?".

## How it ships

liveplanner is **MIT licensed** and runs as one **hosted product**, free for
everyone, no paid tier, with no trackers and no ads. See
[Business model + licence](../002-project-scope/business-model-and-licence.md). It has not been deployed yet
([Build phase](../005-project-roadmap/prototype-scope.md)).

The planner is **always available without signing in**: a visitor can build a
real plan before being asked to create an account. Signing in (a liveworkspace account) adds sync,
teams and per-account history on top of that
([Auth + guest access](../014-identity/auth-and-guest-access.md)).

Usage is measured, anonymously and first-party, and published at `/telemetry`
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)). That dashboard is how a claim on
this page gets checked: "the unit of value is the team" is a statement the Collaboration tab can agree or
disagree with.
