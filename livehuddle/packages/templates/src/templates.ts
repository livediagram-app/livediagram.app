import { isUntitledName, titleCase } from '@livehuddle/api-schema';
import { UNTITLED_DOCUMENT_NAME, isUntitledDocumentName } from './legacy-untitled';

export type TemplateKind =
  // Workshop's templates and the Spaces (docs/specs/007-editor/templates-by-mode.md "Workshop templates"): the
  // catalogue livehuddle ships, every one opening in Workshop.
  // Workshop's blank (docs/specs/012-collaboration/workshop-mode.md "Templates").
  | 'blank-session'
  // The Retrospectives family (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the Retrospective and its
  // siblings, run with the same opening rail and closing actions so a team can rotate formats without relearning the
  // ritual. Columns (Start / Stop / Continue, Mad / Sad / Glad), a 2x2 (4Ls) and a picture (Sailboat).
  | 'retrospective'
  | 'start-stop-continue'
  | 'mad-sad-glad'
  | 'four-ls'
  | 'sailboat'
  // The session formats. Lean Coffee and Town Hall Q&A (docs/specs/012-collaboration/qa-board.md) run on a Q&A board;
  // Crazy 8s is the design-sprint sketching exercise; the meeting agenda runs itself; the workshop and brainstorm
  // boards are built from the retro kit.
  | 'town-hall'
  | 'lean-coffee'
  | 'crazy-eights'
  | 'meeting-agenda'
  | 'workshop-board'
  | 'brainstorm'
  // The boards that ship a dot vote.
  | 'affinity-map'
  | 'prioritization-matrix'
  | 'risk-matrix'
  // The boards a team fills in together in a session, a sticky note per voice.
  | 'incident-postmortem'
  | 'user-persona'
  | 'empathy-map'
  | 'journey'
  | 'objectives-planner'
  | 'roadmap'
  | 'raci-matrix'
  | 'user-story-map'
  | 'swot'
  | 'pestle-analysis'
  | 'business-model-canvas'
  | 'value-proposition-canvas'
  | 'stakeholder-map'
  | 'opportunity-solution-tree'
  | 'kwl-chart'
  // Event storming (docs/specs/021-event-storming/event-storming.md): the sticky-note workshop grammar for
  // exploring a business domain. Colours ARE the semantics, so its stickies pin their fills with `themeLockFill`.
  | 'event-storming'
  // Quizzes & Games (docs/specs/012-collaboration/quiz-and-game-templates.md): a pub quiz on Quiz cards with a
  // scoreboard, icebreakers spun on Pickers, and three party games run on polls, timers and reaction pads.
  | 'pub-quiz'
  | 'icebreaker-questions'
  | 'two-truths-and-a-lie'
  | 'would-you-rather'
  | 'people-bingo'
  // The Spaces to walk round in Avatar mode (docs/specs/012-collaboration/virtual-office-template.md).
  | 'virtual-office'
  | 'coworking-space'
  | 'team-pod'
  | 'all-hands-hall';

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
    kind: 'swot',
    title: 'SWOT',
    description: 'A 2×2 with named axes and sticky evidence, then a strip turning it into moves.',
  },
  {
    kind: 'journey',
    title: 'User Journey',
    description: 'A journey map: stages across, doing / thinking / feeling / pains / ideas down.',
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
    kind: 'value-proposition-canvas',
    title: 'Value Proposition Canvas',
    description:
      'What you offer against what one customer needs: their jobs, pains and gains, with the fit drawn in.',
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
  if (!kind) return UNTITLED_DOCUMENT_NAME;
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
