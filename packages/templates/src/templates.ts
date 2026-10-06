import {
  WHITEBOARD_DEFAULT_PATTERN,
  type BackgroundPattern,
  type Tab,
} from '@livediagram/document';
import { articleTemplateOverrides } from './article-template';
import { templatePages } from './template-pages';
import { templateEditorMode } from './template-modes';
import { titleCase } from '@livediagram/api-schema';
import { templateLayers } from './template-layers';

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
  | 'mobile-wireframe'
  | 'laptop-wireframe'
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
  // Town Hall Q&A (docs/specs/012-collaboration/qa-board.md): an audience Q&A board beside the panel, a
  // run-of-show agenda, a facilitator kit and a follow-ups checklist.
  | 'town-hall'
  // The classic nine-block Business Model Canvas, coloured by area,
  // numbered in fill order and seeded with worked sticky notes.
  | 'business-model-canvas'
  // Empathy map: Says / Thinks / Does / Feels quadrants around a
  // central persona.
  | 'empathy-map'
  // Conversion funnel: narrowing stages with counts, derived step rates
  // and a callout on the biggest drop-off.
  | 'funnel'
  // OKR tree: an objective branching into measurable key results (each
  // with a progress ring) and the initiatives that move them.
  | 'okr-tree'
  // Sitemap: a website's page hierarchy (home, nav sections, pages with
  // their routes, footer and utility pages) drawn with elbow connectors.
  | 'sitemap'
  // Web page wireframe in a browser frame: an annotated landing page (nav,
  // hero, product shot, social proof, benefits, footer) with pinned notes.
  // The landing-page sibling of the mobile / laptop wireframes.
  | 'browser-wireframe'
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
  // Whiteboard (docs/specs/023-draw-mode/draw-mode.md): a blank tab of the whiteboard KIND, drawn on
  // with a dock of pens rather than the palette. Shown beside Blank as a
  // quick-pick, never inside a category grid.
  | 'whiteboard'
  // Article (docs/specs/007-editor/article-pages.md): a tab that opens in Illustrate mode on one
  // article page, written as a short project brief.
  | 'article'
  // Blank Illustration (docs/specs/007-editor/templates-by-mode.md "Four blanks"): a tab that opens
  // in Illustrate on one empty page, which asks what it is for. A quick-pick beside the other two
  // blanks, never inside a category grid.
  | 'blank-illustration'
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
  // Illustrate templates (docs/specs/007-editor/templates-by-mode.md "Illustrate templates"):
  // documents of pages, opening in Illustrate on pages of their own (template-pages.ts).
  | 'event-poster'
  | 'year-in-review'
  | 'resume'
  | 'recipe-card'
  | 'data-story'
  | 'how-it-works'
  | 'versus'
  | 'social-carousel'
  // Plan templates (docs/specs/026-plan/plan-templates.md): a way of working across several tabs,
  // each opening in Plan mode, with no cards. The Kanban board ('kanban', above) is one of them;
  // Blank Plan is the mode's blank.
  | 'blank-plan'
  | 'project-planner'
  | 'bug-triage'
  | 'team-retro'
  | 'weekly-planner'
  | 'content-calendar'
  | 'hiring-pipeline'
  | 'okrs'
  | 'product-launch'
  | 'feedback-board';

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
    description: 'An empty page for an infographic or an article, sized for print or social.',
    extra: true,
  },
  {
    kind: 'blank-plan',
    title: 'Blank Plan',
    description: 'One empty board: name its first column and build it the way your team works.',
    extra: true,
  },
  {
    kind: 'mindmap',
    title: 'Mind map',
    description:
      'A team offsite plan: five colour-coded branches with glyphs radiating from the topic.',
  },
  {
    kind: 'mindmap-tree',
    title: 'Tree mind map',
    description: 'A left-to-right outline: a bold root, four branches and two sub-topics each.',
  },
  {
    kind: 'mindmap-bubble',
    title: 'Bubble map',
    description: 'A brand voice ringed by six adjectives, each with a line that proves it.',
  },
  {
    kind: 'orgchart',
    title: 'Org chart',
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
    title: 'Swimlane flowchart',
    description: 'An order from click to doorstep across four role lanes.',
    extra: true,
  },
  {
    kind: 'decision-tree',
    title: 'Decision tree',
    description: 'Can we ship on Friday? Yes / no questions down to go, wait and stop outcomes.',
    extra: true,
  },
  {
    kind: 'approval-workflow',
    title: 'Approval workflow',
    description: 'Manager and finance sign-off in role lanes, with rework and decline paths.',
    extra: true,
  },
  {
    kind: 'data-flow',
    title: 'Data flow diagram',
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
      'Four tabs: a Now, Next, Later Roadmap with a Gantt chart of your projects, a Backlog of tasks by project, the Sprint board and a Daily Standup.',
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
      'Three tabs: a Retro where notes stay hidden until you reveal and vote, the Actions you agree, and an Archive of past retros.',
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
      'Three tabs: open Roles on a timeline, the candidate Pipeline a row per role, and Onboarding for each new starter.',
    extra: true,
  },
  {
    kind: 'okrs',
    title: 'OKRs',
    description:
      'Two tabs: Objectives on a timeline, and their Key Results by objective, on track, at risk or off track.',
    extra: true,
  },
  {
    kind: 'product-launch',
    title: 'Product Launch',
    description:
      'Three tabs: workstreams on a Timeline, a Checklist per workstream, and the Launch Day go / no-go.',
    extra: true,
  },
  {
    kind: 'feedback-board',
    title: 'Feedback Board',
    description:
      'Two tabs: Feedback from users, voted on and reviewed, and Delivery for what you plan, through to shipped.',
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
    title: 'Horizontal milestone timeline',
    description:
      'A launch year to scale: milestone cards on stems above and below a phase ribbon, with launch day as the hero.',
    extra: true,
  },
  {
    kind: 'milestone-timeline-vertical',
    title: 'Vertical milestone timeline',
    description:
      'A company history down the page: big years one side, story cards the other, a highlight and the next chapter.',
    extra: true,
  },
  {
    kind: 'venn',
    title: 'Venn diagram',
    description:
      'Desirable, feasible, viable: every overlap named, with the sweet spot in the middle.',
    extra: true,
  },
  {
    kind: 'journey',
    title: 'User journey',
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
    kind: 'mobile-wireframe',
    title: 'Mobile wireframe',
    description:
      'A three-screen app flow joined by tap arrows, with numbered pins matching design notes.',
    extra: true,
  },
  {
    kind: 'laptop-wireframe',
    title: 'Laptop wireframe',
    description:
      'An analytics dashboard on a laptop: nav, sidebar, KPI row, a chart and a recent sign-ups table.',
    extra: true,
  },
  {
    kind: 'slide-deck',
    title: 'Slide deck',
    description:
      'A six-slide pitch (title, problem, solution, traction, team, the ask) on Slide (16:9) pages, with speaker notes.',
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
    title: 'Logo design',
    description:
      'A brand exploration on Square pages: six lockups (horizontal, stacked, app icon, one colour), each on its own artboard, plus a palette page. Pick one, delete the rest, swap in your own mark.',
    extra: true,
  },
  {
    kind: 'gantt',
    title: 'Gantt chart',
    description:
      'A twelve-week launch plan: workstreams, owners, progress bars, dependencies, a launch milestone and a Today line.',
    extra: true,
  },
  {
    kind: 'live-card',
    title: 'Group card',
    description:
      'A greeting card the whole team signs, on two card pages: a cover with a photo, and an inside of signed notes with a slot for yours.',
    extra: true,
  },
  {
    kind: 'comparison-table',
    title: 'Comparison table',
    description:
      'Three plans side by side with ticks and crosses, the cost for your team, and the recommended plan highlighted.',
    extra: true,
  },
  {
    kind: 'system-architecture',
    title: 'System architecture',
    description:
      'A vendor-neutral logical architecture in tiered lanes: clients, edge, services and data, wired with labelled protocols.',
    extra: true,
  },
  {
    kind: 'er-diagram',
    title: 'Database schema',
    description:
      'ER diagram of a food-delivery app: six tables with PK / FK columns, one-to-many relationships and their multiplicities.',
    extra: true,
  },
  {
    kind: 'sequence-diagram',
    title: 'Sequence diagram',
    description:
      'UML checkout flow: an actor, lifelines, activation bars, sync / async / reply messages and an alt fragment.',
    extra: true,
  },
  {
    kind: 'prioritization-matrix',
    title: 'Prioritization matrix',
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
    title: 'RACI matrix',
    description:
      'Launch tasks by named roles with colour-coded R / A / C / I cells, a legend, and the checks to review it against.',
    extra: true,
  },
  {
    kind: 'user-story-map',
    title: 'User story map',
    description: 'Activities over tasks over stories, sliced into release lanes.',
    extra: true,
  },
  {
    kind: 'affinity-map',
    title: 'Affinity map',
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
    kind: 'town-hall',
    title: 'Town Hall Q&A',
    description: 'An upvoted audience Q&A beside the panel, a run of show and a facilitator kit.',
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
    title: 'Empathy map',
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
    kind: 'okr-tree',
    title: 'OKR tree',
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
    kind: 'browser-wireframe',
    title: 'Web page wireframe',
    description:
      'A real landing page in a browser frame, annotated with pinned notes on why it is laid out so.',
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
    title: 'Cloud architecture',
    description:
      'A food-delivery stack on AWS: real service icons nested in edge, region, VPC and subnet groups.',
    extra: true,
  },
  {
    kind: 'uml-class',
    title: 'Class diagram',
    description:
      'UML classes with visibility and types, wired by inheritance, composition, aggregation and associations.',
    extra: true,
  },
  {
    kind: 'state-machine',
    title: 'State machine',
    description:
      'A delivery order’s UML lifecycle: a composite state, guards, a timeout and three final states.',
    extra: true,
  },
  {
    kind: 'floor-plan',
    title: 'Floor plan',
    description:
      'A two-bed flat with study drawn to scale: furniture, colour zones, dimensions and a key.',
    extra: true,
  },
  {
    kind: 'event-storming',
    title: 'Event storming',
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
    title: '4Ls retrospective',
    description:
      'Liked, Learned, Lacked and Longed for in a 2x2: the reflective retro for after a milestone.',
    extra: true,
  },
  {
    kind: 'sailboat',
    title: 'Sailboat retrospective',
    description:
      'The picture retro: wind that pushes us, anchors that hold us back, rocks ahead and the island we sail for.',
    extra: true,
  },
  {
    kind: 'incident-postmortem',
    title: 'Incident postmortem',
    description:
      'A blameless postmortem: impact, a phased timeline, five whys, what helped and prioritised follow-ups.',
    extra: true,
  },
  {
    kind: 'opportunity-solution-tree',
    title: 'Opportunity solution tree',
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
    title: 'Stakeholder map',
    description:
      'Power vs interest: who to manage closely, keep satisfied, inform or monitor, with stances and an engagement plan.',
    extra: true,
  },
  {
    kind: 'risk-matrix',
    title: 'Risk matrix',
    description:
      'A 5x5 likelihood and impact heatmap with numbered risks, a residual move, and a register with owners and trends.',
    extra: true,
  },
  {
    kind: 'user-persona',
    title: 'User persona',
    description:
      'A research-backed persona: profile and quote, goals, frustrations, behaviours, personality and how we help.',
    extra: true,
  },
  {
    kind: 'meeting-agenda',
    title: 'Meeting agenda',
    description:
      'A weekly sync that runs itself: purpose and roles, a timed agenda, then parking lot, decisions and actions.',
    extra: true,
  },
  {
    kind: 'article',
    title: 'Article',
    description:
      'Write on pages, like a doc: a project brief with headings and lists, room for charts and drawings in the text.',
    extra: true,
  },
  {
    kind: 'objectives-planner',
    title: 'Objectives planner',
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
];

// Picker grouping. Templates are organised into a handful of
// categories so the picker reads as titled sections (Diagrams /
// Planning / Design / Technical) instead of one long flat grid. The
// mapping lives beside the catalogue (mirroring TEMPLATE_PATTERNS) so a
// new template slots into a section with a one-line edit; the picker
// renders sections in TEMPLATE_CATEGORIES order and skips empties.
export type TemplateCategory =
  | 'mindmaps'
  | 'flowcharts'
  | 'hierarchies'
  | 'planning'
  | 'project-management'
  | 'strategy'
  | 'design'
  | 'technical';

// Category descriptions are kept to a similar length (~40-46 chars) so the
// overview cards read as a tidy, even set rather than ragged.
export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; description: string }[] = [
  {
    id: 'mindmaps',
    // Id kept (links and telemetry name it); the label says what the shelf is for.
    label: 'Brainstorm',
    description: 'Mind maps and sketchnotes for getting ideas out of heads.',
  },
  {
    id: 'flowcharts',
    label: 'Flowcharts',
    description: 'Step-by-step process and decision flows.',
  },
  {
    id: 'hierarchies',
    label: 'Hierarchies',
    description: 'Org charts, goal trees, sitemaps and pyramids.',
  },
  {
    // id stays 'planning' (nothing saved references it; label is the
    // user-facing name) — Agile artefacts: boards, retros, prioritisation.
    id: 'planning',
    label: 'Agile',
    description: 'Boards, retrospectives and prioritisation.',
  },
  {
    id: 'project-management',
    label: 'Projects',
    description: 'Plans, timelines, risks and meeting agendas.',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    description: 'Analysis frameworks, decisions and Venn sets.',
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Wireframes, decks, mock-ups and floor plans.',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Architecture, schema and sequence diagrams.',
  },
];

const TEMPLATE_CATEGORY: Record<TemplateKind, TemplateCategory> = {
  // Mind maps: radial / tree / bubble brainstorming layouts.
  mindmap: 'mindmaps',
  'mindmap-tree': 'mindmaps',
  'mindmap-bubble': 'mindmaps',
  // Flowcharts: process + decision flows. Blank lives here too: it is shown
  // as a separate quick-pick in the picker, never inside a category grid, so
  // its category is nominal. The map is a Record over TemplateKind, so every
  // kind needs an entry whether or not a grid ever reads it.
  blank: 'flowcharts',
  flowchart: 'flowcharts',
  swimlane: 'flowcharts',
  'decision-tree': 'flowcharts',
  'approval-workflow': 'flowcharts',
  'data-flow': 'flowcharts',
  // Hierarchies: top-down structure, goal trees + cause-effect.
  orgchart: 'hierarchies',
  pyramid: 'hierarchies',
  fishbone: 'hierarchies',
  'okr-tree': 'hierarchies',
  'opportunity-solution-tree': 'hierarchies',
  sitemap: 'hierarchies',
  // Planning: agile boards, retrospectives, prioritisation, story maps.
  kanban: 'planning',
  // Plan templates (docs/specs/026-plan/plan-templates.md). Blank Plan is a quick-pick; its category is nominal.
  'blank-plan': 'planning',
  'project-planner': 'project-management',
  'bug-triage': 'planning',
  'team-retro': 'planning',
  'weekly-planner': 'project-management',
  'content-calendar': 'project-management',
  'hiring-pipeline': 'project-management',
  okrs: 'project-management',
  'product-launch': 'project-management',
  'feedback-board': 'planning',
  retrospective: 'planning',
  'start-stop-continue': 'planning',
  'mad-sad-glad': 'planning',
  'four-ls': 'planning',
  sailboat: 'planning',
  'prioritization-matrix': 'planning',
  'user-story-map': 'planning',
  'affinity-map': 'planning',
  // Live sessions run on a Q&A board (docs/specs/012-collaboration/qa-board.md): meetings, which the Agile
  // category's retros already make a home for.
  'lean-coffee': 'planning',
  'town-hall': 'planning',
  // Projects: time-ordered schedules, roadmaps + ownership.
  gantt: 'project-management',
  timeline: 'project-management',
  'milestone-timeline': 'project-management',
  'milestone-timeline-vertical': 'project-management',
  roadmap: 'project-management',
  'raci-matrix': 'project-management',
  'risk-matrix': 'project-management',
  'meeting-agenda': 'project-management',
  article: 'project-management',
  'objectives-planner': 'project-management',
  // Strategy: business / product analysis, decision frameworks + set
  // relationships (Venn).
  swot: 'strategy',
  flywheel: 'strategy',
  journey: 'strategy',
  'comparison-table': 'strategy',
  venn: 'strategy',
  'business-model-canvas': 'strategy',
  'empathy-map': 'strategy',
  'user-persona': 'strategy',
  'stakeholder-map': 'strategy',
  funnel: 'strategy',
  // Design: wireframes, slides + visual mock-ups.
  'mobile-wireframe': 'design',
  'laptop-wireframe': 'design',
  'browser-wireframe': 'design',
  'slide-deck': 'design',
  storyboard: 'design',
  'logo-design': 'design',
  'live-card': 'design',
  // A floor plan is a layout drawing, so it sits with the wireframes and
  // mock-ups rather than with the developer diagrams in Technical.
  'floor-plan': 'design',
  'crazy-eights': 'design',
  // Technical / developer diagrams.
  'system-architecture': 'technical',
  'cloud-architecture': 'technical',
  'er-diagram': 'technical',
  'sequence-diagram': 'technical',
  'uml-class': 'technical',
  'state-machine': 'technical',
  'event-storming': 'technical',
  // Nominal, like Blank: the picker shows the other two blanks only as quick-picks.
  whiteboard: 'design',
  'blank-illustration': 'design',
  // Draw templates (docs/specs/007-editor/templates-by-mode.md).
  sketchnote: 'mindmaps',
  'rich-picture': 'strategy',
  'comic-strip': 'design',
  'doodle-warmup': 'planning',
  'paper-prototype': 'design',
  'journey-doodle': 'strategy',
  'pre-mortem': 'planning',
  'idea-garden': 'mindmaps',
  // Illustrate templates.
  'event-poster': 'project-management',
  'year-in-review': 'strategy',
  resume: 'design',
  'recipe-card': 'design',
  'data-story': 'strategy',
  'how-it-works': 'flowcharts',
  versus: 'strategy',
  'social-carousel': 'design',
  'incident-postmortem': 'technical',
};

// The picker's "Popular" shelf (docs/specs/008-canvas/canvas-and-palette.md "Templates section"): where
// most people start, open by default above the categories. Not a category of
// its own (every kind here still lives in its real one); the four blanks lead it, one per editor
// mode (docs/specs/007-editor/templates-by-mode.md "Four blanks"), so the picker needs no separate
// blank card.
export const POPULAR_TEMPLATE_KINDS: readonly TemplateKind[] = [
  'blank',
  'whiteboard',
  'blank-illustration',
  'blank-plan',
  'mindmap',
  'sketchnote',
  'sailboat',
  'flowchart',
  'orgchart',
  'article',
];

export function templateCategory(kind: TemplateKind): TemplateCategory {
  return TEMPLATE_CATEGORY[kind];
}

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-document-route.md).
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATES.some((t) => t.kind === value);
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
// "Untitled document".
export const UNTITLED_DOCUMENT_NAME = 'Untitled document';

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_DOCUMENT_NAME;
  // A blank names what it makes ("Untitled Whiteboard"), not the card ("Blank Whiteboard").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DOCUMENT_NAME;
}

// The canvas backdrop pattern that best suits each template's layout.
// Applied on top of the chosen theme (which only supplies the colours),
// so a starter ships with a fitting canvas instead of inheriting the
// theme's default dot grid:
//   - graph paper for alignment-heavy scaffolds (flow / org / SWOT /
//     Gantt / kanban / wireframes) where boxes snap to a square grid,
//   - a blank canvas for clean radial layouts (Venn, flywheel,
//     pyramid) where the shapes should carry the page,
//   - a crosshatch backdrop for the storyboard, so its scene frames
//     read as cards lifted off a textured surface,
//   - a blank surround for the templates that open on Illustrate pages
//     (Article, Slide deck, Logo design, Group card and the rest): the pages are the paper,
//   - horizontal rules for the time-ordered timeline / journey,
//   - the dot grid (explicit, so it survives even a blank-canvas theme)
//     for the sticky-note / freeform boards.
// Templates not listed here fall through to the theme's pattern.
const TEMPLATE_PATTERNS: Partial<Record<TemplateKind, BackgroundPattern>> = {
  flowchart: 'graph',
  swimlane: 'graph',
  'decision-tree': 'graph',
  'approval-workflow': 'graph',
  'data-flow': 'graph',
  orgchart: 'graph',
  swot: 'graph',
  gantt: 'graph',
  // Plan boards (docs/specs/026-plan/plan-mode.md) sit on the quiet dot grid: the board is the structure.
  kanban: 'grid',
  'blank-plan': 'grid',
  'project-planner': 'grid',
  'bug-triage': 'grid',
  'team-retro': 'grid',
  'weekly-planner': 'grid',
  'content-calendar': 'grid',
  'hiring-pipeline': 'grid',
  okrs: 'grid',
  'product-launch': 'grid',
  'feedback-board': 'grid',
  'mobile-wireframe': 'graph',
  'laptop-wireframe': 'graph',
  venn: 'blank',
  flywheel: 'blank',
  pyramid: 'blank',
  // The templates on pages keep a plain surround, like the Article: the pages are the paper.
  'slide-deck': 'blank',
  'logo-design': 'blank',
  timeline: 'lines',
  'milestone-timeline': 'lines',
  // The vertical variant reads best on a clean canvas: horizontal ruled
  // lines fight a downward spine.
  'milestone-timeline-vertical': 'blank',
  journey: 'lines',
  retrospective: 'grid',
  fishbone: 'grid',
  'live-card': 'blank',
  mindmap: 'grid',
  // Tree map rides the dot grid like the radial map; the bubble map is a
  // clean radial layout, so it gets a blank canvas like Venn / pyramid.
  'mindmap-tree': 'grid',
  'mindmap-bubble': 'blank',
  // Technical diagrams are alignment-heavy (boxes + tables snap to a
  // grid), so they ride graph paper like the flow / org / SWOT scaffolds.
  'system-architecture': 'graph',
  'er-diagram': 'graph',
  'sequence-diagram': 'graph',
  'prioritization-matrix': 'graph',
  // The later batch splits the same three ways: alignment-heavy scaffolds
  // ride graph paper, sticky-note workshop boards pin the dot grid, and
  // the funnel's clean stacked silhouette gets a blank canvas. The
  // storyboard rides crosshatch so its scene frames read as cards on a
  // textured board.
  roadmap: 'graph',
  'raci-matrix': 'graph',
  'business-model-canvas': 'graph',
  'okr-tree': 'graph',
  sitemap: 'graph',
  'browser-wireframe': 'graph',
  'cloud-architecture': 'graph',
  'uml-class': 'graph',
  'state-machine': 'graph',
  // A floor plan IS a scale drawing, so graph paper is doing its literal
  // job here: the squares read as the metre grid the rooms are drawn on.
  'floor-plan': 'graph',
  'user-story-map': 'grid',
  'affinity-map': 'grid',
  'lean-coffee': 'grid',
  'town-hall': 'grid',
  // Event storming is a sticky-note workshop like the story / affinity
  // maps, so it pins the dot grid rather than riding the other technical
  // templates' graph paper.
  'event-storming': 'grid',
  'empathy-map': 'grid',
  funnel: 'blank',
  storyboard: 'crosshatch',
  // A new whiteboard starts on Grid (docs/specs/023-draw-mode/draw-mode.md "Board background").
  whiteboard: WHITEBOARD_DEFAULT_PATTERN,
  // The Draw templates start on the whiteboard's board too.
  sketchnote: WHITEBOARD_DEFAULT_PATTERN,
  'rich-picture': WHITEBOARD_DEFAULT_PATTERN,
  'comic-strip': WHITEBOARD_DEFAULT_PATTERN,
  'doodle-warmup': WHITEBOARD_DEFAULT_PATTERN,
  'paper-prototype': WHITEBOARD_DEFAULT_PATTERN,
  'journey-doodle': WHITEBOARD_DEFAULT_PATTERN,
  'pre-mortem': WHITEBOARD_DEFAULT_PATTERN,
  'idea-garden': WHITEBOARD_DEFAULT_PATTERN,
  // The twelve-starter batch follows the same split: the retro formats,
  // Crazy 8s, persona, agenda and objectives are sticky-note / workshop
  // boards on the dot grid, as is the postmortem (a dense written report,
  // where graph lines behind every card read as noise); the matrices and
  // tree ride graph paper;
  // the Sailboat's drawn scene gets a blank canvas like the flywheel.
  'start-stop-continue': 'grid',
  'mad-sad-glad': 'grid',
  'four-ls': 'grid',
  sailboat: 'blank',
  'incident-postmortem': 'grid',
  'opportunity-solution-tree': 'graph',
  'crazy-eights': 'grid',
  'stakeholder-map': 'graph',
  'risk-matrix': 'graph',
  'user-persona': 'grid',
  'meeting-agenda': 'grid',
  // An article's surround stays plain: the page is the paper.
  article: 'blank',
  // The other Illustrate templates: their pages are the paper.
  'blank-illustration': 'blank',
  'event-poster': 'blank',
  'year-in-review': 'blank',
  resume: 'blank',
  'recipe-card': 'blank',
  'data-story': 'blank',
  'how-it-works': 'blank',
  versus: 'blank',
  'social-carousel': 'blank',
  // A personal planning sheet, read closely like a page: even dots behind
  // its cards read as noise, so it gets a clean canvas.
  'objectives-planner': 'blank',
};

// How far each loud backdrop pattern steps back behind a template's content
// (the tab's `backgroundOpacity`, which dims only the pattern layer). Graph
// paper is the loudest (two line weights across the whole page), so it drops
// the most; ruled lines, crosshatch and the checkerboard sit between. The dot
// grid and a blank canvas are already quiet and keep full strength. The user
// can still turn any of them back up in the Canvas controls.
const TEMPLATE_PATTERN_OPACITY: Partial<Record<BackgroundPattern, number>> = {
  graph: 0.4,
  crosshatch: 0.5,
  lines: 0.6,
  checkerboard: 0.6,
};

// Tab-level overrides a specific template ships with, applied on top
// of whatever theme is selected. Each template carries its preferred
// backdrop pattern (see TEMPLATE_PATTERNS); Mind map and User journey
// additionally soften the canvas opacity so the pattern recedes behind
// the radiating branches / the stage row. Layered templates (docs/specs/006-document/layers.md)
// also carry their `Tab.layers` here, matching the `layerId`s their
// builder pre-stamps, so every application path lands scaffold and
// layers in one commit.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  const overrides: Partial<Tab> = {};
  const pattern = TEMPLATE_PATTERNS[kind];
  if (pattern) overrides.backgroundPattern = pattern;
  // The pattern recedes behind the content: a template is read, so its
  // backdrop should organise the page rather than compete with it. The
  // louder the pattern, the further it steps back (TEMPLATE_PATTERN_OPACITY);
  // a few radial / stage layouts soften further still, and the lower of the
  // two wins.
  // A whiteboard draws its own quiet board pattern (docs/specs/023-draw-mode/draw-mode.md "Board
  // background"), so it never takes a template's dimming.
  const mode = templateEditorMode(kind);
  const quiet = pattern && mode !== 'draw' ? TEMPLATE_PATTERN_OPACITY[pattern] : undefined;
  const soft =
    kind === 'mindmap' ||
    kind === 'mindmap-tree' ||
    kind === 'journey' ||
    kind === 'prioritization-matrix'
      ? 0.8
      : undefined;
  const opacity = Math.min(quiet ?? 1, soft ?? 1);
  if (opacity < 1) overrides.backgroundOpacity = opacity;
  const layers = templateLayers(kind);
  if (layers) overrides.layers = layers;
  // A template can also declare what KIND of board it makes (docs/specs/021-event-storming/event-storming.md).
  // The kind, not a layer id, is what the editor reads to decide it is a
  // workshop board, so it must land on every application path: the picker,
  // /new, and the MCP worker all go through here.
  // A template's mode (docs/specs/007-editor/templates-by-mode.md): the Draw templates are general
  // tabs that OPEN in Draw mode (docs/specs/007-editor/editor-modes.md "Where the mode lives";
  // whiteboarding is no kind), the Illustrate ones open in Illustrate (their pages below).
  if (mode !== 'diagram') overrides.opensIn = mode;
  // The Article opens in Illustrate on its one article page (docs/specs/007-editor/article-pages.md).
  if (kind === 'article') Object.assign(overrides, articleTemplateOverrides());
  // The Slide deck, Logo design and Group card open in Illustrate on their own pages
  // (canvas-and-palette.md "Templates on pages"); their builders place every element on them.
  const pages = templatePages(kind);
  if (pages) Object.assign(overrides, { opensIn: 'illustrate', pages });
  if (kind === 'event-storming') {
    overrides.kind = 'event-storming';
    // The seed note is built on a lane, so the board is born settled and the
    // one-time settle never runs on it (docs/specs/021-event-storming/event-storming.md "Always on a lane").
    overrides.esLanesSettled = true;
  }
  return overrides;
}
