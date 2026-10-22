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
  // UI wireframes (use the device-frame shapes added in docs/specs/008-canvas/canvas-and-palette.md's
  // Devices accordion). Situational starters for design / product work,
  // which is why they are extras rather than defaults.
  | 'slide-deck'
  // A growth / momentum flywheel: a spinning hub and four hue-tinted
  // stage wheels on a flowing clockwise loop, each with its metric, plus
  // push / friction stickies. An extra.
  | 'flywheel'
  // Logo-design exploration sheet: six labelled artboards (horizontal /
  // stacked lockups with and without a tagline, the mark as an app icon,
  // a one-colour version) plus the brand palette, so a designer picks
  // the composition that fits, deletes the rest, and iterates.
  | 'logo-design'
  // Wireframe templates (docs/specs/007-editor/templates-by-mode.md "Wireframe templates"): flows
  // of wireframe pages, each screen a wireframe layout in its device.
  | 'wireframe-mobile-app'
  | 'wireframe-website'
  | 'wireframe-dashboard'
  | 'wireframe-tablet-app'
  | 'wireframe-watch-app'
  // Gantt chart: a twelve-week plan on a month + week calendar, grouped
  // by workstream, with owners, progress bars, dependencies, a milestone
  // and a Today line. A project-planning starter, and an extra.
  | 'gantt'
  // Group card: a greeting card the whole team signs (cover + message
  // wall). The kind id predates the name. An extra.
  | 'live-card'
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
  // Lean Coffee (docs/specs/012-collaboration/qa-board.md): an agenda-less meeting run on a Q&A board, with
  // its four-step loop drawn out, timebox timers, a keep-going poll and takeaways.
  | 'lean-coffee'
  | 'brainstorm'
  | 'workshop-board'
  // Town Hall Q&A (docs/specs/012-collaboration/qa-board.md): an audience Q&A board beside the panel, a
  // run-of-show agenda, a facilitator kit and a follow-ups checklist.
  | 'town-hall'
  // Quizzes & Games (docs/specs/012-collaboration/quiz-and-game-templates.md): a pub quiz on Quiz cards with a
  // scoreboard, icebreakers spun on Pickers, and three party games run on polls, timers and reaction pads.
  | 'pub-quiz'
  | 'icebreaker-questions'
  // A whole office to walk round in Avatar mode (docs/specs/012-collaboration/virtual-office-template.md).
  | 'virtual-office'
  // Its siblings, the spaces to walk round together (docs/specs/012-collaboration/virtual-office-template.md "Spaces").
  | 'coworking-space'
  | 'team-pod'
  | 'all-hands-hall'
  | 'two-truths-and-a-lie'
  | 'would-you-rather'
  | 'people-bingo'
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
  // Web page wireframe in a browser frame: an annotated landing page (nav,
  // hero, product shot, social proof, benefits, footer) with pinned notes.
  // The landing-page sibling of the mobile / laptop wireframes.
  // Storyboard: numbered shots of a short ad, each with a shot + timing
  // chip, a sketch, and action + sound lines beneath.
  | 'storyboard'
  // Cloud architecture (Technology icons, docs/specs/010-palette/technology-icons.md): an AWS stack with
  // its services grouped into edge, region, VPC and subnet frames.
  | 'cloud-architecture'
  // UML class diagram: entity classes wired by inheritance / composition /
  // aggregation / association arrows (uses the UML arrowhead shapes).
  | 'uml-class'
  // UML state machine: initial / final pseudostates, a composite state and
  // transitions labelled event [guard] / action.
  | 'state-machine'
  // Floor plan: rooms drawn to a real metric scale (80px = 1m), furnished
  // with the top-down Furniture icons, zone-tinted, dimensioned and keyed.
  // The only template whose geometry means something in the world, so its
  // scale is captioned on the canvas.
  | 'floor-plan'
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
  // STRIDE threat model, a service blueprint, a north-star metric tree, the Value Proposition Canvas, Amazon's
  // Working Backwards PR/FAQ (an article), a family tree and a value stream map. The threat model, metric tree and
  // value stream map make a companion Sheet tab after the drawing (template-companions.ts).
  | 'wardley-map'
  | 'threat-model'
  | 'service-blueprint'
  | 'metric-tree'
  | 'value-proposition-canvas'
  | 'working-backwards'
  | 'family-tree'
  | 'value-stream-map'
  // 5x5 likelihood x impact heatmap beside a risk register.
  | 'risk-matrix'
  // A research-backed user persona laid out as a profile sheet.
  | 'user-persona'
  // A meeting that runs itself: purpose, attendees, a live agenda element,
  // and the parking lot, decisions and actions it produces.
  | 'meeting-agenda'
  // Personal objectives, written with a sentence formula and a SMART check,
  // balanced across life areas, with key results and a check-in rhythm.
  | 'objectives-planner'
  // Whiteboard (docs/specs/007-editor/editor-modes.md): a blank tab of the whiteboard KIND, drawn on
  // with a dock of pens rather than the palette. Shown beside Blank as a
  // quick-pick, never inside a category grid.
  | 'whiteboard'
  // Article (docs/specs/007-editor/article-pages.md): a tab that opens in Pages mode on one
  // article page, written as a short project brief.
  | 'article'
  // Blank Illustration (docs/specs/007-editor/templates-by-mode.md "Five blanks"): a tab that opens
  // in Pages on one empty page, which asks what it is for. A quick-pick beside the other two
  // blanks, never inside a category grid.
  | 'blank-illustration'
  // The blanks of a page kind (docs/specs/007-editor/templates-by-mode.md "Blanks of a page kind"): one empty page
  // whose kind is already chosen (blank-page-templates.ts), so it never asks what it is for.
  | 'blank-slide-deck'
  | 'blank-article'
  | 'blank-infographic'
  | 'blank-logo'
  | 'blank-wireframe-phone'
  | 'blank-wireframe-tablet'
  | 'blank-wireframe-browser'
  | 'blank-wireframe-laptop'
  | 'blank-wireframe-watch'
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
  // Pages templates (docs/specs/007-editor/templates-by-mode.md "Pages templates"):
  // documents of pages, opening in Pages on pages of their own (template-pages.ts).
  | 'event-poster'
  | 'year-in-review'
  | 'resume'
  | 'recipe-card'
  | 'data-story'
  | 'how-it-works'
  | 'versus'
  | 'social-carousel'
  // Slide decks built from the slide layouts (template-builders-layout-decks.ts).
  | 'launch-keynote'
  | 'quarterly-review'
  | 'team-welcome'
  | 'workshop-kickoff'
  // Workshop mode's blank (docs/specs/012-collaboration/workshop-mode.md "Templates").
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
    kind: 'blank-illustration',
    title: 'Blank Illustration',
    description: 'An empty page for an infographic, an article, a slide, a logo or a wireframe.',
    extra: true,
  },
  {
    kind: 'blank-slide-deck',
    title: 'Blank Slide Deck',
    description: 'One empty 16:9 slide, ready for your first idea.',
    extra: true,
  },
  {
    kind: 'blank-article',
    title: 'Blank Article',
    description: 'One empty article page: a title and a first paragraph to write.',
    extra: true,
  },
  {
    kind: 'blank-infographic',
    title: 'Blank Infographic',
    description: 'One empty A4 infographic page: lay it out yourself or start from a layout.',
    extra: true,
  },
  {
    kind: 'blank-logo',
    title: 'Blank Logo',
    description: 'One empty square artboard for a mark, a wordmark or a lockup.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-phone',
    title: 'Blank Phone Wireframe',
    description: 'One empty iPhone screen to wireframe a mobile app on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-tablet',
    title: 'Blank Tablet Wireframe',
    description: 'One empty iPad screen to wireframe a tablet app on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-browser',
    title: 'Blank Website Wireframe',
    description: 'One empty browser window to wireframe a web page on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-laptop',
    title: 'Blank Laptop Wireframe',
    description: 'One empty laptop screen to wireframe a web or desktop app on.',
    extra: true,
  },
  {
    kind: 'blank-wireframe-watch',
    title: 'Blank Watch Wireframe',
    description: 'One empty watch face to wireframe a watch app on.',
    extra: true,
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
    kind: 'slide-deck',
    title: 'Slide Deck',
    description:
      'A six-slide pitch (title, problem, solution, traction, team, the ask) on 16:9 slide pages, with speaker notes.',
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
    kind: 'logo-design',
    title: 'Logo Design',
    description:
      'A brand exploration on Square pages: six lockups (horizontal, stacked, app icon, one colour), each on its own artboard, plus a palette page. Pick one, delete the rest, swap in your own mark.',
    extra: true,
  },
  {
    kind: 'wireframe-mobile-app',
    title: 'Mobile App Wireframe',
    description:
      'Five iPhone screens of a shopping app, from onboarding and sign in to the home feed, a product and checkout.',
    extra: true,
  },
  {
    kind: 'wireframe-website',
    title: 'Website Wireframe',
    description: 'Three browser pages of a product site: a landing page, pricing and sign in.',
    extra: true,
  },
  {
    kind: 'wireframe-dashboard',
    title: 'Web App Wireframe',
    description:
      'Three laptop screens of a web app: an overview dashboard, an orders table and settings.',
    extra: true,
  },
  {
    kind: 'wireframe-tablet-app',
    title: 'Tablet App Wireframe',
    description: 'Three iPad screens: a discovery feed, messages and a profile.',
    extra: true,
  },
  {
    kind: 'wireframe-watch-app',
    title: 'Watch App Wireframe',
    description: 'Three watch faces: a glance, a list and a notification.',
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
    kind: 'live-card',
    title: 'Group Card',
    description:
      'A greeting card the whole team signs, on two card pages: a cover with a photo, and an inside of signed notes with a slot for yours.',
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
    kind: 'lean-coffee',
    title: 'Lean Coffee',
    description:
      'The four-step loop drawn out, a topics board, and the timers and poll that run it.',
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
    kind: 'town-hall',
    title: 'Town Hall Q&A',
    description: 'An upvoted audience Q&A beside the panel, a run of show and a facilitator kit.',
    extra: true,
  },
  {
    kind: 'pub-quiz',
    title: 'Pub Quiz',
    description:
      'Three rounds of timed quiz questions, a team scoreboard, a quizmaster kit and a tie-breaker under a cover.',
    extra: true,
  },
  {
    kind: 'icebreaker-questions',
    title: 'Icebreaker Questions',
    description:
      'Spin a question and a person, two minutes each on the clock, then everyone says hello on the wall.',
    extra: true,
  },
  {
    kind: 'virtual-office',
    title: 'Virtual Office',
    description:
      'Rooms to walk round in Avatar mode: a reception, desks, a meeting room, a kitchen with coffee, a lounge and a focus room.',
    extra: true,
  },
  {
    kind: 'coworking-space',
    title: 'Coworking Space',
    description:
      'An open floor to walk round in Avatar mode: hot desks, two phone booths, a coffee bar and a lounge.',
    extra: true,
  },
  {
    kind: 'team-pod',
    title: 'Team Pod',
    description:
      'A small team’s corner in Avatar mode: four desks together, a table for the stand-up and a team board.',
    extra: true,
  },
  {
    kind: 'all-hands-hall',
    title: 'All-Hands Hall',
    description:
      'A hall for town halls and demos in Avatar mode: a stage, rows of seats facing it and Bring Focus.',
    extra: true,
  },
  {
    kind: 'two-truths-and-a-lie',
    title: 'Two Truths and a Lie',
    description:
      'Each player writes three statements, one of them false, and the room votes on the lie in a live poll.',
    extra: true,
  },
  {
    kind: 'would-you-rather',
    title: 'Would You Rather',
    description:
      'Six light dilemmas, each with a ready-made poll, so the room picks a side and argues its case.',
    extra: true,
  },
  {
    kind: 'people-bingo',
    title: 'Find Someone Who Bingo',
    description:
      'A 4 by 4 bingo card of things to find in a teammate, a ten-minute timer and a Bingo! button.',
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
    kind: 'storyboard',
    title: 'Storyboard',
    description:
      'A 30-second ad in six shots: shot and timing chips, sketches, action and sound lines.',
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
    kind: 'floor-plan',
    title: 'Floor Plan',
    description:
      'A two-bed flat with study drawn to scale: furniture, colour zones, dimensions and a key.',
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
    kind: 'working-backwards',
    title: 'Working Backwards',
    description:
      'Amazon’s PR/FAQ: the launch press release written before anything is built, then the customer and internal FAQs.',
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
    kind: 'meeting-agenda',
    title: 'Meeting Agenda',
    description:
      'A weekly sync that runs itself: purpose and roles, a timed agenda, then parking lot, decisions and actions.',
    extra: true,
  },
  {
    kind: 'article',
    title: 'Project Brief',
    description:
      'A project brief, written on pages like a doc: headings and lists to write over, room for charts and drawings in the text.',
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
  {
    kind: 'event-poster',
    title: 'Event Poster',
    description:
      'An A3 poster for a community night market: a bold title, the date, time and place, a photo and three highlights.',
    extra: true,
  },
  {
    kind: 'year-in-review',
    title: 'Year in Review',
    description:
      "A four-page team report: a cover, the year's headline numbers, a timeline of its moments and a thank-you.",
    extra: true,
  },
  {
    kind: 'resume',
    title: 'Résumé',
    description:
      'A one-page A4 résumé: name and role, a short profile, an experience timeline, skills and education.',
    extra: true,
  },
  {
    kind: 'recipe-card',
    title: 'Recipe Card',
    description:
      'A recipe to share in two pages: the dish with serves and timings, then the ingredients and the method in steps.',
    extra: true,
  },
  {
    kind: 'data-story',
    title: 'Data Story',
    description:
      'An A4 infographic that tells one story in numbers: a headline stat, pictograms, a then-and-now comparison and a source line.',
    extra: true,
  },
  {
    kind: 'how-it-works',
    title: 'How It Works',
    description:
      'A tall explainer for a story or a phone screen: five illustrated steps down a winding path, from first tap to done.',
    extra: true,
  },
  {
    kind: 'versus',
    title: 'Versus',
    description:
      'Two options side by side on a social post: a split page, matched rows of pros and cons, and a verdict at the foot.',
    extra: true,
  },
  {
    kind: 'social-carousel',
    title: 'Social Carousel',
    description:
      'Five square slides for a LinkedIn or Instagram carousel: a hook, three tips and a call to action, swipe cues included.',
    extra: true,
  },
  {
    kind: 'launch-keynote',
    title: 'Launch Keynote',
    description:
      'A six-slide launch keynote on an animated aurora: the hook, what is new, the beta in three numbers, the launch plan and the ask.',
    extra: true,
  },
  {
    kind: 'quarterly-review',
    title: 'Quarterly Review',
    description:
      'A six-slide quarterly business review on a moving mesh: the agenda, the quarter in a chart, goals as progress rings and the roadmap.',
    extra: true,
  },
  {
    kind: 'team-welcome',
    title: 'Team Welcome',
    description:
      'A six-slide welcome for a new joiner on floating bokeh: their manager, their first week, how the team works and who to ask.',
    extra: true,
  },
  {
    kind: 'workshop-kickoff',
    title: 'Workshop Kickoff',
    description:
      'A six-slide workshop opener on rolling waves: the outcomes, the agenda, how each round runs, the one rule and the close.',
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

// Templates retired for a better one, by their old kind: a link, an agent or a seed naming one makes
// its replacement. The diagram-mode device wireframes became wireframe pages in their devices
// (docs/specs/007-editor/templates-by-mode.md "Wireframe templates").
const RETIRED_TEMPLATE_KINDS: Readonly<Record<string, TemplateKind>> = {
  'mobile-wireframe': 'wireframe-mobile-app',
  'laptop-wireframe': 'wireframe-dashboard',
  'browser-wireframe': 'wireframe-website',
};

/** The template a kind names: itself, a retired kind's replacement, else null. For a kind that
 *  arrives as a plain string from outside (a link, an agent, a seed). */
export function templateKindOf(value: unknown): TemplateKind | null {
  if (isTemplateKind(value)) return value;
  return typeof value === 'string' && Object.hasOwn(RETIRED_TEMPLATE_KINDS, value)
    ? RETIRED_TEMPLATE_KINDS[value]!
    : null;
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
