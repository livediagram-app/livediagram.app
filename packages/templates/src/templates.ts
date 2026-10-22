import { FORM_TEMPLATES, type FormTemplateKind } from './form-templates';
import { titleCase } from '@liveplanner/api-schema';
import { UNTITLED_DOCUMENT_NAME, isUntitledDocumentName } from './legacy-untitled';

export type TemplateKind =
  | 'blank'
  | 'mindmap'
  // Mind-map variants (docs/specs/008-canvas/canvas-and-palette.md): the radial 'mindmap' plus a left-to-right
  // tree and a central bubble map, grouped under the Mind maps category.
  | 'mindmap-tree'
  | 'mindmap-bubble'
  | 'orgchart'
  | 'retrospective'
  | 'flowchart'
  // Flowchart variants (docs/specs/008-canvas/canvas-and-palette.md): cross-functional lanes, branching decision
  // tree, an approval loop, and a data-flow diagram. Grouped under Flowcharts.
  | 'swimlane'
  | 'decision-tree'
  | 'approval-workflow'
  | 'data-flow'
  | 'kanban'
  | 'swot'
  | 'timeline'
  // Milestone timelines: the storytelling, presentation-ready siblings of
  // the plain 'timeline'. The horizontal kind (the original
  // 'milestone-timeline' id) places a launch year to scale on a phase
  // ribbon; the vertical variant tells a company history down the page.
  | 'milestone-timeline'
  | 'milestone-timeline-vertical'
  | 'venn'
  | 'journey'
  | 'fishbone'
  | 'pyramid'
  // A growth / momentum flywheel: a spinning hub and four hue-tinted
  // stage wheels on a flowing clockwise loop, each with its metric, plus
  // push / friction stickies. An extra.
  | 'flywheel'
  // Gantt chart: a twelve-week plan on a month + week calendar, grouped
  // by workstream, with owners, progress bars, dependencies, a milestone
  // and a Today line. A project-planning starter, and an extra.
  | 'gantt'
  // Comparison table: a plan-buying decision on the table element, with
  // ticks / crosses and the recommended plan highlighted.
  | 'comparison-table'
  // Technical / developer-diagram starters (docs/specs/008-canvas/canvas-and-palette.md "Templates"). They
  // reuse the existing shape vocabulary (cylinders for datastores, the
  // entity element for tables, dashed arrows for lifelines / returns)
  // so a dev audience has a first-class starting point. All extras.
  | 'system-architecture'
  | 'er-diagram'
  | 'sequence-diagram'
  // Impact / Effort prioritisation matrix: four named quadrants (Quick
  // wins / Big bets / Fill-ins / Money pits) with dot-voted items placed,
  // beside a vote, size, commit rail. A product / planning starter.
  | 'prioritization-matrix'
  // Now / Next / Later outcome roadmap: theme swimlanes across three
  // horizons of initiative cards, under one goal. The strategic sibling of
  // the date-driven Gantt.
  | 'roadmap'
  // RACI matrix: a tasks-by-roles table with every letter cell tinted by
  // its role, a legend spelling each letter out, and review checks.
  | 'raci-matrix'
  // User story mapping (agile): activities over tasks (the backbone) over
  // story stickies, sliced into release lanes.
  | 'user-story-map'
  // Affinity map: research notes grouped under insight headers and
  // themes, with dot-vote tallies and an unsorted pile still to place.
  | 'affinity-map'
  | 'brainstorm'
  | 'workshop-board'
  // The classic nine-block Business Model Canvas, coloured by area,
  // numbered in fill order and seeded with worked sticky notes.
  | 'business-model-canvas'
  // Empathy map: Says / Thinks / Does / Feels quadrants around a
  // central persona.
  | 'empathy-map'
  // Conversion funnel: narrowing stages with counts, derived step rates
  // and a callout on the biggest drop-off.
  | 'funnel'
  // Sankey diagram: website visits from their channels through the pages to a paid plan, the drop-off drawn
  // as the diagram's leftovers.
  | 'sankey'
  // OKR tree: an objective branching into measurable key results (each
  // with a progress ring) and the initiatives that move them.
  | 'okr-tree'
  // Sitemap: a website's page hierarchy (home, nav sections, pages with
  // their routes, footer and utility pages) drawn with elbow connectors.
  | 'sitemap'
  // Cloud architecture (Technology icons, docs/specs/010-palette/technology-icons.md): an AWS stack with
  // its services grouped into edge, region, VPC and subnet frames.
  | 'cloud-architecture'
  // UML class diagram: entity classes wired by inheritance / composition /
  // aggregation / association arrows (uses the UML arrowhead shapes).
  | 'uml-class'
  // UML state machine: initial / final pseudostates, a composite state and
  // transitions labelled event [guard] / action.
  | 'state-machine'
  // Event storming (docs/specs/021-event-storming/event-storming.md): the sticky-note workshop grammar for
  // exploring a business domain — orange domain events first, the rest
  // of the notation arrives incrementally. Colours ARE the semantics,
  // so its stickies pin their fills with `themeLockFill`.
  | 'event-storming'
  // Retro formats (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the Retrospective's siblings, run
  // with the same opening rail and closing actions so a team can rotate
  // formats without relearning the ritual. Columns (Start / Stop /
  // Continue, Mad / Sad / Glad), a 2x2 (4Ls) and a picture (Sailboat).
  | 'start-stop-continue'
  | 'mad-sad-glad'
  | 'four-ls'
  | 'sailboat'
  // A blameless incident postmortem: impact, a phased timeline, five whys,
  // what helped and hurt, and prioritised follow-ups.
  | 'incident-postmortem'
  // Product discovery's opportunity solution tree: outcome, opportunities,
  // solutions and assumption tests, one hue per level.
  | 'opportunity-solution-tree'
  // Crazy 8s: the design-sprint sketching exercise, eight one-minute frames
  // beside an 8-minute timer, a vote and a done check.
  | 'crazy-eights'
  // Power / interest stakeholder grid with stances and an engagement plan.
  | 'stakeholder-map'
  // The strategy and systems batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): a Wardley map, a
  // STRIDE threat model, a service blueprint, a north-star metric tree, the Value Proposition Canvas, a family tree
  // and a value stream map. The threat model, metric tree and value stream map make a companion Sheet tab after the drawing (template-companions.ts).
  | 'wardley-map'
  | 'threat-model'
  | 'service-blueprint'
  | 'metric-tree'
  | 'value-proposition-canvas'
  | 'family-tree'
  | 'value-stream-map'
  // 5x5 likelihood x impact heatmap beside a risk register.
  | 'risk-matrix'
  // A research-backed user persona laid out as a profile sheet.
  | 'user-persona'
  // Personal objectives, written with a sentence formula and a SMART check,
  // balanced across life areas, with key results and a check-in rhythm.
  | 'objectives-planner'
  // Whiteboard (docs/specs/007-editor/editor-modes.md): a blank tab of the whiteboard KIND, drawn on
  // with a dock of pens rather than the palette. Shown beside Blank as a
  // quick-pick, never inside a category grid.
  | 'whiteboard'
  // Draw templates (docs/specs/007-editor/templates-by-mode.md "Draw templates"): boards drawn with
  // freehand strokes, stickies, text and stickers, opening in Draw mode.
  | 'sketchnote'
  | 'rich-picture'
  | 'comic-strip'
  | 'doodle-warmup'
  | 'paper-prototype'
  | 'journey-doodle'
  | 'pre-mortem'
  | 'idea-garden'
  // Workshop mode's blank (docs/specs/012-collaboration/session-tools.md).
  | 'blank-session'
  // Plan templates (docs/specs/026-plan/plan-templates.md): a way of working across several tabs,
  // each opening in Plan mode, with no cards. The Kanban board ('kanban', above) is one of them;
  // Blank Plan is the mode's blank.
  | 'blank-plan'
  // A blank of Plan's beside Blank Plan: one tab holding an empty Sheet (docs/specs/007-editor/templates-by-mode.md
  // "The blanks").
  | 'blank-spreadsheet'
  | 'project-planner'
  | 'bug-triage'
  | 'team-retro'
  | 'weekly-planner'
  | 'content-calendar'
  | 'hiring-pipeline'
  | 'okrs'
  | 'product-launch'
  | 'feedback-board'
  | 'budget-planner'
  | 'timesheet'
  | 'contact-list'
  | 'task-tracker'
  // Spreadsheet templates added with the catalogue's job-based categories (docs/specs/026-plan/plan-templates.md
  // "Spreadsheet templates"): one Sheet each, filling its tab.
  | 'invoice'
  | 'expense-report'
  | 'loan-calculator'
  | 'sales-pipeline'
  | 'inventory'
  | 'guest-list'
  | 'grade-book'
  | 'habit-tracker'
  // Form templates (docs/specs/030-forms/forms.md "Starting a form"): one a form starter (form-templates.ts).
  | FormTemplateKind;

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
  // Catalogue metadata only: it marks the ten starters that shipped first,
  // and nothing gates on it. The picker used to hide extras behind a "Show
  // more" toggle; it browses by category now (docs/specs/008-canvas/canvas-and-palette.md), so every template is
  // reachable and this flag decides nothing about what a user sees.
  extra?: boolean;
  // True for templates that never appear in listings (the picker's browse
  // grids + search, the MCP list_templates catalogue) but stay buildable via
  // buildTemplate, for a dedicated entry point that names the kind directly.
  //
  // NO template sets it today. Its one user was the docs/specs/007-editor/guided-tour-sample.md guided-tour
  // sample, retired by docs/specs/007-editor/editor-tour.md's in-editor tour; the flag stays because the
  // listing paths already filter on it, so the next such entry point is a
  // one-word change rather than a new concept. `templates.test.ts` asserts
  // the set is empty, so this stays honest.
  hidden?: boolean;
  // Made in the editor only (a form template: the editor starts the form on its tab), so left out of the agents'
  // catalogue (templateCatalogue), whose creates are built on the api.
  editorOnly?: boolean;
};

export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank Diagram',
    description: 'An empty canvas for shapes, connectors and whatever you like.',
  },
  {
    kind: 'whiteboard',
    title: 'Blank Whiteboard',
    description: 'Free drawing without distractions',
  },
  {
    kind: 'blank-plan',
    title: 'Blank Plan',
    description: 'An empty Plan tab: pick the board that fits the work, or build your own.',
    extra: true,
  },
  {
    kind: 'blank-spreadsheet',
    title: 'Blank Spreadsheet',
    description: 'An empty spreadsheet: cells, formulas and charts, ready to type into.',
    extra: true,
  },
  {
    kind: 'blank-session',
    title: 'Blank Session',
    description: 'An empty tab to run a session on: timers, votes, polls and reveals to hand.',
    extra: true,
  },
  {
    kind: 'mindmap',
    title: 'Mind Map',
    description:
      'A team offsite plan: five colour-coded branches with glyphs radiating from the topic.',
  },
  {
    kind: 'mindmap-tree',
    title: 'Tree Mind Map',
    description: 'A left-to-right outline: a bold root, four branches and two sub-topics each.',
  },
  {
    kind: 'mindmap-bubble',
    title: 'Bubble Map',
    description: 'A brand voice ringed by six adjectives, each with a line that proves it.',
  },
  {
    kind: 'orgchart',
    title: 'Org Chart',
    description:
      'A leadership team by person, with team bands, a dotted-line report and an open role.',
  },
  {
    kind: 'retrospective',
    title: 'Retrospective',
    description:
      'Went well, To improve and Ideas columns, a mood check, a vote and an Action items checklist.',
  },
  {
    kind: 'flowchart',
    title: 'Flowchart',
    description:
      'A checkout drawn with the five ISO symbols, retry and back-order loops, and a key.',
  },
  {
    kind: 'swimlane',
    title: 'Swimlane Flowchart',
    description: 'An order from click to doorstep across four role lanes.',
    extra: true,
  },
  {
    kind: 'decision-tree',
    title: 'Decision Tree',
    description: 'Can we ship on Friday? Yes / no questions down to go, wait and stop outcomes.',
    extra: true,
  },
  {
    kind: 'approval-workflow',
    title: 'Approval Workflow',
    description: 'Manager and finance sign-off in role lanes, with rework and decline paths.',
    extra: true,
  },
  {
    kind: 'data-flow',
    title: 'Data Flow Diagram',
    description: 'A level-1 DFD of an online shop, with a key to the notation.',
    extra: true,
  },
  {
    kind: 'kanban',
    title: 'Kanban Board',
    description:
      'Continuous flow in three tabs: Board, with WIP limits from Backlog to Done; Requests, where new asks are accepted onto it; and Flow, a dashboard of where the work stands.',
  },
  {
    kind: 'project-planner',
    title: 'Project Planner',
    description:
      'Five tabs: a Now, Next, Later Roadmap with a Gantt chart of your projects, a Backlog of tasks by project, the Sprint board, a Daily Standup and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'bug-triage',
    title: 'Bug Tracker',
    description:
      'Three tabs: Triage new bugs by priority, follow them through Fixing to released, and watch Health on a dashboard.',
    extra: true,
  },
  {
    kind: 'team-retro',
    title: 'Team Retro',
    description:
      'Four tabs: a Retro where notes stay hidden until you reveal and vote, the Actions you agree, an Archive of past retros and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'weekly-planner',
    title: 'Weekly Planner',
    description:
      'Three tabs: This Week, a column a day; an Inbox to capture into; and a Calendar of what is due.',
    extra: true,
  },
  {
    kind: 'content-calendar',
    title: 'Content Calendar',
    description:
      'Three tabs: Ideas to vote on and approve, Production from drafting to published, and a Calendar of publish dates.',
    extra: true,
  },
  {
    kind: 'hiring-pipeline',
    title: 'Hiring Pipeline',
    description:
      'Four tabs: open Roles on a timeline, the candidate Pipeline a row per role, Onboarding for each new starter and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'okrs',
    title: 'OKRs',
    description:
      'Three tabs: Objectives on a timeline, their Key Results by objective (on track, at risk or off track) and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'product-launch',
    title: 'Product Launch',
    description:
      'Four tabs: workstreams on a Timeline, a Checklist per workstream, the Launch Day go / no-go and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'feedback-board',
    title: 'Feedback Board',
    description:
      'Three tabs: Feedback from users, voted on and reviewed, Delivery for what you plan through to shipped, and an Overview dashboard.',
    extra: true,
  },
  // Spreadsheet templates (docs/specs/026-plan/plan-templates.md "Spreadsheet templates").
  {
    kind: 'budget-planner',
    title: 'Budget Planner',
    description:
      'A spreadsheet filling the tab: planned and actual amounts by category, the difference worked out and totalled.',
    extra: true,
  },
  {
    kind: 'timesheet',
    title: 'Timesheet',
    description:
      'A spreadsheet filling the tab: this week Monday to Friday, by project and task, with the hours totalled.',
    extra: true,
  },
  {
    kind: 'contact-list',
    title: 'Contact List',
    description:
      'A spreadsheet filling the tab: names, companies, roles, emails, phones, when you last spoke and notes.',
    extra: true,
  },
  {
    kind: 'task-tracker',
    title: 'Task Tracker',
    description:
      'A spreadsheet on the canvas: tasks with owners, status, priority, dates and how much is done, beside a how-to.',
    extra: true,
  },
  {
    kind: 'invoice',
    title: 'Invoice',
    description:
      'A spreadsheet filling the tab: who it is from and to, line items with tax worked out, and the amount due.',
    extra: true,
  },
  {
    kind: 'expense-report',
    title: 'Expense Report',
    description:
      'A spreadsheet filling the tab: claims with dates and receipts, what is reimbursable, totalled by category.',
    extra: true,
  },
  {
    kind: 'loan-calculator',
    title: 'Loan Calculator',
    description:
      'A spreadsheet filling the tab: a loan’s amount, rate and term, the monthly payment and a yearly schedule.',
    extra: true,
  },
  {
    kind: 'sales-pipeline',
    title: 'Sales Pipeline',
    description:
      'A spreadsheet filling the tab: deals by stage, each weighted by its probability, with a forecast and a chart.',
    extra: true,
  },
  {
    kind: 'inventory',
    title: 'Inventory',
    description:
      'A spreadsheet filling the tab: stock on hand, its value, what is due a reorder, and a chart by item.',
    extra: true,
  },
  {
    kind: 'guest-list',
    title: 'Guest List',
    description:
      'A spreadsheet filling the tab: invitations, RSVPs, plus-ones and dietary needs, with the headcount totalled.',
    extra: true,
  },
  {
    kind: 'grade-book',
    title: 'Grade Book',
    description:
      'A spreadsheet filling the tab: each student’s scores, their average and grade, and how the class is doing.',
    extra: true,
  },
  {
    kind: 'habit-tracker',
    title: 'Habit Tracker',
    description:
      'A spreadsheet filling the tab: a week of ticks against each habit’s goal, the streaks counted and charted.',
    extra: true,
  },
  {
    kind: 'swot',
    title: 'SWOT',
    description: 'A 2×2 with named axes and sticky evidence, then a strip turning it into moves.',
  },
  {
    kind: 'timeline',
    title: 'Timeline',
    description: 'A year of milestones on one line, coloured by status, with a Today marker.',
  },
  {
    kind: 'milestone-timeline',
    title: 'Horizontal Milestone Timeline',
    description:
      'A launch year to scale: milestone cards on stems above and below a phase ribbon, with launch day as the hero.',
    extra: true,
  },
  {
    kind: 'milestone-timeline-vertical',
    title: 'Vertical Milestone Timeline',
    description:
      'A company history down the page: big years one side, story cards the other, a highlight and the next chapter.',
    extra: true,
  },
  {
    kind: 'venn',
    title: 'Venn Diagram',
    description:
      'Desirable, feasible, viable: every overlap named, with the sweet spot in the middle.',
    extra: true,
  },
  {
    kind: 'journey',
    title: 'User Journey',
    description: 'A journey map: stages across, doing / thinking / feeling / pains / ideas down.',
    extra: true,
  },
  {
    kind: 'fishbone',
    title: 'Fishbone',
    description: 'Cause and effect: six bones of likely causes feeding one problem.',
    extra: true,
  },
  {
    kind: 'pyramid',
    title: 'Pyramid',
    description: 'A five-tier strategy pyramid, purpose down to initiatives, each tier explained.',
    extra: true,
  },
  {
    kind: 'flywheel',
    title: 'Flywheel',
    description:
      'A growth loop that turns: four stages feeding each other round a spinning hub, each with its number, plus the push and friction acting on it.',
    extra: true,
  },
  {
    kind: 'gantt',
    title: 'Gantt Chart',
    description:
      'A twelve-week launch plan: workstreams, owners, progress bars, dependencies, a launch milestone and a Today line.',
    extra: true,
  },
  {
    kind: 'comparison-table',
    title: 'Comparison Table',
    description:
      'Three plans side by side with ticks and crosses, the cost for your team, and the recommended plan highlighted.',
    extra: true,
  },
  {
    kind: 'system-architecture',
    title: 'System Architecture',
    description:
      'A vendor-neutral logical architecture in tiered lanes: clients, edge, services and data, wired with labelled protocols.',
    extra: true,
  },
  {
    kind: 'er-diagram',
    title: 'Database Schema',
    description:
      'ER diagram of a food-delivery app: six tables with PK / FK columns, one-to-many relationships and their multiplicities.',
    extra: true,
  },
  {
    kind: 'sequence-diagram',
    title: 'Sequence Diagram',
    description:
      'UML checkout flow: an actor, lifelines, activation bars, sync / async / reply messages and an alt fragment.',
    extra: true,
  },
  {
    kind: 'prioritization-matrix',
    title: 'Prioritization Matrix',
    description: 'Impact vs effort: Quick wins, Big bets, Fill-ins and Money pits, with a vote.',
    extra: true,
  },
  {
    kind: 'roadmap',
    title: 'Roadmap',
    description:
      'Now / Next / Later by theme: outcome cards under one goal, with confidence and status at a glance.',
    extra: true,
  },
  {
    kind: 'raci-matrix',
    title: 'RACI Matrix',
    description:
      'Launch tasks by named roles with colour-coded R / A / C / I cells, a legend, and the checks to review it against.',
    extra: true,
  },
  {
    kind: 'user-story-map',
    title: 'User Story Map',
    description: 'Activities over tasks over stories, sliced into release lanes.',
    extra: true,
  },
  {
    kind: 'affinity-map',
    title: 'Affinity Map',
    description: 'Research notes grouped under insights and themes, with dot-vote tallies.',
    extra: true,
  },
  {
    kind: 'brainstorm',
    title: 'Brainstorm Board',
    description:
      'A question to answer, an Unsorted column for every new idea and themes to cluster them into, with a timer and a vote.',
    extra: true,
  },
  {
    kind: 'workshop-board',
    title: 'Workshop Board',
    description:
      'The kickoff wall for a longer session: a check-in and icebreaker, goals, a timed agenda and ground rules.',
    extra: true,
  },
  {
    kind: 'business-model-canvas',
    title: 'Business Model Canvas',
    description:
      'The classic nine blocks for a worked meal-kit business, coloured by area and numbered in the order to fill them.',
    extra: true,
  },
  {
    kind: 'empathy-map',
    title: 'Empathy Map',
    description:
      'A persona over Says / Thinks / Does / Feels quadrants, with a Pains and Gains strip.',
    extra: true,
  },
  {
    kind: 'funnel',
    title: 'Funnel',
    description:
      'Four narrowing stages with real counts and step rates, and a callout on the biggest drop-off with experiments to fix it.',
    extra: true,
  },
  {
    kind: 'sankey',
    title: 'Sankey Diagram',
    description:
      'Where visitors come from and where they go: channels into pages into trials, with every drop-off drawn to Bounced.',
    extra: true,
  },
  {
    kind: 'okr-tree',
    title: 'OKR Tree',
    description:
      'An objective over key results with progress rings, and initiatives with status badges.',
    extra: true,
  },
  {
    kind: 'sitemap',
    title: 'Sitemap',
    description:
      'A site page tree: nav sections, pages with type glyphs and routes, footer and utility pages.',
    extra: true,
  },
  {
    kind: 'cloud-architecture',
    title: 'Cloud Architecture',
    description:
      'A food-delivery stack on AWS: real service icons nested in edge, region, VPC and subnet groups.',
    extra: true,
  },
  {
    kind: 'uml-class',
    title: 'Class Diagram',
    description:
      'UML classes with visibility and types, wired by inheritance, composition, aggregation and associations.',
    extra: true,
  },
  {
    kind: 'state-machine',
    title: 'State Machine',
    description:
      'A delivery order’s UML lifecycle: a composite state, guards, a timeout and three final states.',
    extra: true,
  },
  {
    kind: 'event-storming',
    title: 'Event Storming',
    description:
      'Explore a business domain with the sticky-note workshop notation: orange domain events on a left-to-right timeline.',
    extra: true,
  },
  {
    kind: 'start-stop-continue',
    title: 'Start, Stop, Continue',
    description:
      'The plainest retro: what to begin, what to drop and what to keep, with a vote and owned actions.',
    extra: true,
  },
  {
    kind: 'mad-sad-glad',
    title: 'Mad, Sad, Glad',
    description:
      'A feelings-first retro with an anonymous idea box, emoji-led columns and actions that ask what would help.',
    extra: true,
  },
  {
    kind: 'four-ls',
    title: '4Ls Retrospective',
    description:
      'Liked, Learned, Lacked and Longed for in a 2x2: the reflective retro for after a milestone.',
    extra: true,
  },
  {
    kind: 'sailboat',
    title: 'Sailboat Retrospective',
    description:
      'The picture retro: wind that pushes us, anchors that hold us back, rocks ahead and the island we sail for.',
    extra: true,
  },
  {
    kind: 'incident-postmortem',
    title: 'Incident Postmortem',
    description:
      'A blameless postmortem: impact, a phased timeline, five whys, what helped and prioritised follow-ups.',
    extra: true,
  },
  {
    kind: 'opportunity-solution-tree',
    title: 'Opportunity Solution Tree',
    description:
      "Product discovery from one outcome: needs in the customer's voice, a target, three solutions and their tests.",
    extra: true,
  },
  {
    kind: 'crazy-eights',
    title: 'Crazy 8s',
    description:
      'Eight ideas in eight minutes: a sketch sheet of one-minute frames, a timer, a done check and a vote.',
    extra: true,
  },
  {
    kind: 'stakeholder-map',
    title: 'Stakeholder Map',
    description:
      'Power vs interest: who to manage closely, keep satisfied, inform or monitor, with stances and an engagement plan.',
    extra: true,
  },
  {
    kind: 'risk-matrix',
    title: 'Risk Matrix',
    description:
      'A 5x5 likelihood and impact heatmap with numbered risks, a residual move, and a register with owners and trends.',
    extra: true,
  },
  {
    kind: 'wardley-map',
    title: 'Wardley Map',
    description:
      'A value chain mapped on evolution: what to build, buy or rent, where it is all heading and the plays to make.',
    extra: true,
  },
  {
    kind: 'threat-model',
    title: 'Threat Model',
    description:
      'Two tabs: a data-flow diagram with its trust boundaries and STRIDE threats marked, then a live Threat Register.',
    extra: true,
  },
  {
    kind: 'service-blueprint',
    title: 'Service Blueprint',
    description:
      'An order end to end: what the customer does, what staff and systems do behind the line, and where it fails.',
    extra: true,
  },
  {
    kind: 'metric-tree',
    title: 'Metric Tree',
    description:
      'Two tabs: a north-star metric broken into the inputs teams own, then a Driver Model sheet to try what-ifs on.',
    extra: true,
  },
  {
    kind: 'value-proposition-canvas',
    title: 'Value Proposition Canvas',
    description:
      'What you offer against what one customer needs: their jobs, pains and gains, with the fit drawn in.',
    extra: true,
  },
  {
    kind: 'family-tree',
    title: 'Family Tree',
    description:
      'Three generations on one page: couples, children and an adoption, with years, birthplaces and family stories.',
    extra: true,
  },
  {
    kind: 'value-stream-map',
    title: 'Value Stream Map',
    description:
      'Two tabs: idea to production with its waits, process times and kaizen bursts, then the Flow Data sheet.',
    extra: true,
  },

  {
    kind: 'user-persona',
    title: 'User Persona',
    description:
      'A research-backed persona: profile and quote, goals, frustrations, behaviours, personality and how we help.',
    extra: true,
  },
  {
    kind: 'objectives-planner',
    title: 'Objectives Planner',
    description:
      'Write personal objectives that stick: start with why, a sentence formula, a SMART test, key results and check-ins.',
    extra: true,
  },
  {
    kind: 'sketchnote',
    title: 'Sketchnote',
    description:
      'Visual notes from a talk, drawn by hand: a lettered banner, the big idea in a cloud, then key points, quotes and questions.',
    extra: true,
  },
  {
    kind: 'rich-picture',
    title: 'Rich Picture',
    description:
      'Draw a messy problem as people see it: stick-figure stakeholders, what they say, where they clash, and a legend of symbols.',
    extra: true,
  },
  {
    kind: 'comic-strip',
    title: 'Comic Strip',
    description:
      'Tell a product story in six hand-drawn panels, with captions, speech bubbles and a sticker for each moment.',
    extra: true,
  },
  {
    kind: 'doodle-warmup',
    title: 'Doodle Warm-Up',
    description:
      'A meeting icebreaker: draw your teammate in 60 seconds, one frame each, then vote for the best likeness.',
    extra: true,
  },
  {
    kind: 'paper-prototype',
    title: 'Paper Prototype',
    description:
      'Sketch an app before anyone builds it: three hand-drawn phone screens, tap arrows between them and notes to test with users.',
    extra: true,
  },
  {
    kind: 'journey-doodle',
    title: 'Journey Doodle',
    description:
      "A customer's day drawn as a winding road: each stop a doodle, a face for how it felt, and the dip where it goes wrong.",
    extra: true,
  },
  {
    kind: 'pre-mortem',
    title: 'Pre-Mortem',
    description:
      'Imagine the project failed a year from now: a drawn wreck in the middle, the reasons on stickies round it, then what to do now.',
    extra: true,
  },
  {
    kind: 'idea-garden',
    title: 'Idea Garden',
    description:
      'Grow ideas as a drawn tree: the question at the roots, themes as branches, ideas as leaves and the best ones as fruit.',
    extra: true,
  },
  ...FORM_TEMPLATES,
];

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-document-route.md).
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATES.some((t) => t.kind === value);
}

/** The template a kind names, else null. For a kind that arrives as a plain string from outside (a link,
 *  an agent, a seed). */
export function templateKindOf(value: unknown): TemplateKind | null {
  return isTemplateKind(value) ? value : null;
}

// The editor URL that creates this template without the wizard and opens it
// (docs/specs/007-editor/new-document-route.md): what an outside surface links to, such as the marketing site's
// template gallery (docs/specs/019-marketing/marketing-site.md). The route is the editor's; the builder lives
// here so every caller spells the query the same way `isTemplateKind` reads.
export function templateCreateHref(kind: TemplateKind): string {
  return `/new?template=${encodeURIComponent(kind)}`;
}

// Default name for a freshly-created document: "Untitled <Template Title>" in
// title case so a templated document is recognisable in the Explorer (e.g.
// "Untitled Tree Mind Map"), while a blank one (or no template) keeps the plain
// "Untitled document" (UNTITLED_DOCUMENT_NAME, legacy-untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_DOCUMENT_NAME;
  // A blank names what it makes ("Untitled Whiteboard"), not the card ("Blank Whiteboard").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DOCUMENT_NAME;
}

// Every name a document is given before anyone names it: each template's untitled name, plus "Untitled document" and
// its legacy spelling. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a document still has a default name (docs/specs/007-editor/templates-by-mode.md "The document's name"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultDocumentName(name: string): boolean {
  DEFAULT_NAMES ??= new Set(TEMPLATES.map((t) => untitledNameForTemplate(t.kind)));
  return isUntitledDocumentName(name) || DEFAULT_NAMES.has(name);
}
