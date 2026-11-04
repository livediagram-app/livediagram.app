import { isUntitledName, titleCase } from '@livehuddle/api-schema';
import { UNTITLED_DOCUMENT_NAME, isUntitledDocumentName } from './legacy-untitled';

// The catalogue (docs/specs/007-editor/templates-by-mode.md "The catalogue"): Blank Space and the four Spaces, every
// one opening on a meeting board. livehuddle is for meeting in Spaces; the retrospectives, workshops, planning and
// strategy boards and the quizzes and games are livediagram's (docs/specs/002-project-scope/not-in-livehuddle.md).
export type TemplateKind =
  // The blank (docs/specs/012-collaboration/workshop-mode.md "Templates").
  | 'blank-session'
  // The Spaces to walk round in Avatar mode (docs/specs/012-collaboration/virtual-office-template.md).
  | 'virtual-office'
  | 'coworking-space'
  | 'team-pod'
  | 'all-hands-hall';

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
  // Catalogue metadata only: it marks the starters that shipped first,
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
    title: 'Blank Space',
    description: 'An empty space to meet in: build a room, leave a note, run a timer or a vote.',
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
];

// The titles of the templates that left livehuddle (Work Tracker #423): a space made from one was named
// "Untitled <title>" and, until someone names it, still counts as untitled (isDefaultDocumentName).
const RETIRED_TEMPLATE_TITLES: readonly string[] = [
  'Retrospective',
  'SWOT',
  'User Journey',
  'Prioritization Matrix',
  'Roadmap',
  'RACI Matrix',
  'User Story Map',
  'Affinity Map',
  'Lean Coffee',
  'Brainstorm Board',
  'Workshop Board',
  'Town Hall Q&A',
  'Pub Quiz',
  'Icebreaker Questions',
  'Two Truths and a Lie',
  'Would You Rather',
  'Find Someone Who Bingo',
  'Business Model Canvas',
  'Empathy Map',
  'Start, Stop, Continue',
  'Mad, Sad, Glad',
  '4Ls Retrospective',
  'Sailboat Retrospective',
  'Incident Postmortem',
  'Opportunity Solution Tree',
  'Crazy 8s',
  'Stakeholder Map',
  'Risk Matrix',
  'Value Proposition Canvas',
  'User Persona',
  'Meeting Agenda',
  'Objectives Planner',
  'PESTLE Analysis',
  'KWL Chart',
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
// "Untitled Space" (UNTITLED_DOCUMENT_NAME, legacy-untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind) return UNTITLED_DOCUMENT_NAME;
  // A blank names what it makes ("Untitled Whiteboard"), not the card ("Blank Whiteboard").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_DOCUMENT_NAME;
}

// Every name a document is given before anyone names it: each template's untitled name, plus "Untitled Space" and
// its legacy spellings. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a document still has a default name (docs/specs/007-editor/templates-by-mode.md "The document's name"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultDocumentName(name: string): boolean {
  DEFAULT_NAMES ??= new Set([
    ...TEMPLATES.map((t) => untitledNameForTemplate(t.kind)),
    ...RETIRED_TEMPLATE_TITLES.map((title) => `Untitled ${titleCase(title)}`),
  ]);
  return isUntitledDocumentName(name) || isUntitledName(name) || DEFAULT_NAMES.has(name);
}
