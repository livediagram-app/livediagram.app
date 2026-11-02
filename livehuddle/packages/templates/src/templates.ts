import { isUntitledName, titleCase } from '@livehuddle/api-schema';
import { UNTITLED_DOCUMENT_NAME, isUntitledDocumentName } from './legacy-untitled';

export type TemplateKind =
  | 'blank'
  // Mind-map variants (docs/specs/008-canvas/canvas-and-palette.md): the radial 'mindmap' plus a left-to-right
  // tree and a central bubble map, grouped under the Mind maps category.
  | 'retrospective'
  // Flowchart variants (docs/specs/008-canvas/canvas-and-palette.md): cross-functional lanes, branching decision
  // tree, an approval loop, and a data-flow diagram. Grouped under Flowcharts.
  | 'data-flow'
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
  // Sankey diagram: website visits from their channels through the pages to a paid plan, the drop-off drawn
  // as the diagram's leftovers.
  // OKR tree: an objective branching into measurable key results (each
  // with a progress ring) and the initiatives that move them.
  | 'okr-tree'
  // Sitemap: a website's page hierarchy (home, nav sections, pages with
  // their routes, footer and utility pages) drawn with elbow connectors.
  // Cloud architecture (Technology icons, docs/specs/010-palette/technology-icons.md): an AWS stack with
  // its services grouped into edge, region, VPC and subnet frames.
  | 'cloud-architecture'
  // UML class diagram: entity classes wired by inheritance / composition /
  // aggregation / association arrows (uses the UML arrowhead shapes).
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
  // and a value stream map.
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
  // The use-case batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): four boards built from one board
  // grid over data (an Eisenhower matrix, a PESTLE scan, a class's KWL chart and a new starter's 30-60-90 day plan),
  // a photosynthesis concept map and a small office's network diagram.
  | 'eisenhower-matrix'
  | 'pestle-analysis'
  | 'kwl-chart'
  | 'onboarding-plan'
  | 'concept-map'
  | 'network-diagram'
  // Workshop mode's blank (docs/specs/012-collaboration/workshop-mode.md "Templates").
  | 'blank-session';

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
  // NO template sets it today. Its one user was the guided-tour
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
    kind: 'blank-session',
    title: 'Blank Workshop',
    description: 'An empty tab to run a workshop on: timers, votes, polls and reveals to hand.',
    extra: true,
  },
  {
    kind: 'retrospective',
    title: 'Retrospective',
    description:
      'Went well, To improve and Ideas columns, a mood check, a vote and an Action items checklist.',
  },
  {
    kind: 'data-flow',
    title: 'Data Flow Diagram',
    description: 'A level-1 DFD of an online shop, with a key to the notation.',
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
    kind: 'okr-tree',
    title: 'OKR Tree',
    description:
      'An objective over key results with progress rings, and initiatives with status badges.',
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
    description: 'A data-flow diagram with its trust boundaries and STRIDE threats marked.',
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
    description: 'A north-star metric broken into the inputs teams own.',
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
    description: 'Idea to production with its waits, process times and kaizen bursts.',
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
    kind: 'eisenhower-matrix',
    title: 'Eisenhower Matrix',
    description:
      'Sort a week by urgent and important: do it now, book it, hand it off or drop it, then pick today’s three.',
    extra: true,
  },
  {
    kind: 'pestle-analysis',
    title: 'PESTLE Analysis',
    description:
      'Scan the world outside the business through six lenses, vote on what matters, then carry it into the SWOT.',
    extra: true,
  },
  {
    kind: 'kwl-chart',
    title: 'KWL Chart',
    description:
      'A class topic before and after: what we know, what we want to know, then what we learned.',
    extra: true,
  },
  {
    kind: 'onboarding-plan',
    title: '30-60-90 Day Plan',
    description:
      'A new starter’s first three months: learn, contribute, then lead, with goals for each and the check-ins.',
    extra: true,
  },
  {
    kind: 'concept-map',
    title: 'Concept Map',
    description:
      'Link ideas into sentences: concepts in boxes, linking words on every arrow and cross-links between branches.',
    extra: true,
  },
  {
    kind: 'network-diagram',
    title: 'Network Diagram',
    description:
      'An office network in tiers: router, firewall and switches, VLANs with their subnets, Wi-Fi, VPN and an IP plan.',
    extra: true,
  },
];

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-document-route.md).
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATES.some((t) => t.kind === value);
}

/** The template a kind names: itself, else null. For a kind that arrives as a plain string from outside (a link, an
 *  agent, a seed). The Pages templates (slide decks, articles, wireframes, logos and the rest) moved out to
 *  livedocuments with Pages mode, and the old device wireframes they replaced went with them; the Plan templates (boards,
 *  spreadsheets and forms) moved out to liveplanner with Plan mode. A kind naming one is unknown, as any unknown kind
 *  is. */
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
// "Untitled canvas" (UNTITLED_DOCUMENT_NAME, legacy-untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_DOCUMENT_NAME;
  // A blank names what it makes ("Untitled Whiteboard"), not the card ("Blank Whiteboard").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DOCUMENT_NAME;
}

// Every name a document is given before anyone names it: each template's untitled name, plus "Untitled canvas" and
// its legacy spellings. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a document still has a default name (docs/specs/007-editor/templates-by-mode.md "The document's name"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultDocumentName(name: string): boolean {
  DEFAULT_NAMES ??= new Set(TEMPLATES.map((t) => untitledNameForTemplate(t.kind)));
  return isUntitledDocumentName(name) || isUntitledName(name) || DEFAULT_NAMES.has(name);
}
