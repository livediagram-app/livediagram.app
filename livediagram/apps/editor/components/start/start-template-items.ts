// What an empty tab's template start offers (docs/specs/007-editor/start-diagramming.md): Start Diagramming on a
// Diagram tab, Start a Workshop on a Workshop tab. Every listed template
// of the mode, a rail over them (Recommended, then groups) and the search across them. Diagram's groups are the
// catalogue's categories; Workshop's templates nearly all share one, so they group their own way
// (OWN_GROUPS). Drawn from the template
// catalogue, so a new template joins its mode's panel with no change here. Pure: the panel draws what these return.
import {
  BLANK_TEMPLATE_FOR_MODE,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isInTemplateCategory,
  popularKindsFor,
  templateCategory,
  templateEditorMode,
  templateMatchesQuery,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livediagram/templates';

export type TemplateStartMode = 'diagram' | 'draw' | 'workshop';

type TemplateStartGroup = {
  id: string;
  name: string;
  line: string;
  // The templates it shows (Recommended's are in order; a group's in catalogue order).
  kinds: readonly TemplateKind[];
};

type TemplateStart = {
  // The mode's blank: Recommended's first card, which starts from nothing.
  blank: TemplateKind;
  // Recommended, then every group holding a template.
  groups: readonly TemplateStartGroup[];
  // Every match, each once, under its first group after Recommended, in rail order.
  search: (query: string) => { group: string; kinds: TemplateKind[] }[];
};

const RECOMMENDED_LINE: Record<TemplateStartMode, string> = {
  diagram: 'The quickest ways to start, picked for most diagrams.',
  draw: 'The quickest ways to start sketching, picked for most people.',
  workshop: 'The quickest ways to run a session, picked for most teams.',
};

// Recommended leaves these to their group (Timeline, under Timelines).
const NOT_RECOMMENDED: ReadonlySet<TemplateKind> = new Set(['timeline']);

type OwnGroup = { id: string; name: string; line: string; kinds: readonly TemplateKind[] };

// The modes whose templates nearly all share one catalogue category group them their own
// way: Workshop by the session each runs. A template of the mode in none of its groups is placed in the last.
const OWN_GROUPS: Readonly<Record<Exclude<TemplateStartMode, 'diagram'>, readonly OwnGroup[]>> = {
  workshop: [
    {
      id: 'retrospectives',
      name: 'Retrospectives',
      line: 'Look back as a team: what went well, what to change.',
      kinds: [
        'retrospective',
        'sailboat',
        'start-stop-continue',
        'mad-sad-glad',
        'four-ls',
        'incident-postmortem',
      ],
    },
    {
      id: 'meetings',
      name: 'Meetings',
      line: 'Agendas, Q&A and open discussion with the room.',
      kinds: ['meeting-agenda', 'workshop-board', 'town-hall', 'lean-coffee'],
    },
    {
      id: 'spaces',
      name: 'Spaces',
      line: 'Offices and halls to walk round together in Avatar mode.',
      kinds: ['virtual-office', 'coworking-space', 'team-pod', 'all-hands-hall'],
    },
    {
      id: 'games',
      name: 'Quizzes & Games',
      line: 'Quizzes, icebreakers and games to warm up the room.',
      kinds: [
        'pub-quiz',
        'icebreaker-questions',
        'two-truths-and-a-lie',
        'would-you-rather',
        'people-bingo',
      ],
    },
    {
      id: 'ideation',
      name: 'Ideation',
      line: 'Hands-on formats for ideas and design work.',
      kinds: [
        'brainstorm',
        'crazy-eights',
        'affinity-map',
        'user-persona',
        'empathy-map',
        'journey',
      ],
    },
    {
      id: 'planning',
      name: 'Planning',
      line: 'Agree the goals, the roadmap and who does what.',
      kinds: ['objectives-planner', 'roadmap', 'raci-matrix', 'user-story-map'],
    },
    {
      id: 'strategy',
      name: 'Strategy',
      line: 'Map the business, the people and the opportunities.',
      kinds: [
        'swot',
        'business-model-canvas',
        'value-proposition-canvas',
        'stakeholder-map',
        'opportunity-solution-tree',
      ],
    },
    {
      id: 'decisions',
      name: 'Decisions',
      line: 'Boards the room votes on to decide what comes first.',
      kinds: ['prioritization-matrix', 'risk-matrix'],
    },
  ],
  draw: [
    {
      id: 'visual-notes',
      name: 'Visual Notes',
      line: 'Sketchnotes, journeys and stories told in pictures.',
      kinds: ['sketchnote', 'rich-picture', 'journey-doodle', 'comic-strip'],
    },
    {
      id: 'exercises',
      name: 'Exercises',
      line: 'Warm-ups and drawn exercises to run with a team.',
      kinds: ['doodle-warmup', 'pre-mortem', 'idea-garden'],
    },
    {
      id: 'prototypes',
      name: 'Prototypes',
      line: 'Rough screens and flows, sketched before they are built.',
      kinds: ['paper-prototype'],
    },
  ],
};

const byKind = new Map(TEMPLATES.map((t) => [t.kind, t]));

/** A template's descriptor. */
export const templateOf = (kind: TemplateKind): TemplateDescriptor => byKind.get(kind)!;

function build(mode: TemplateStartMode): TemplateStart {
  const blank = BLANK_TEMPLATE_FOR_MODE[mode];
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== blank && templateEditorMode(t.kind) === mode,
  ).map((t) => t.kind);
  const recommended: TemplateStartGroup = {
    id: 'recommended',
    name: 'Recommended',
    line: RECOMMENDED_LINE[mode],
    kinds: popularKindsFor(mode).filter((k) => !NOT_RECOMMENDED.has(k)),
  };
  const rest: TemplateStartGroup[] =
    mode === 'diagram'
      ? TEMPLATE_CATEGORIES.map((c) => ({
          id: c.id,
          name: c.label,
          line: c.description,
          kinds: listed.filter((k) => isInTemplateCategory(k, c.id)),
        }))
      : OWN_GROUPS[mode].map((g, i, all) => ({
          ...g,
          kinds: [
            ...g.kinds.filter((k) => listed.includes(k)),
            ...(i === all.length - 1
              ? listed.filter((k) => !all.some((x) => x.kinds.includes(k)))
              : []),
          ],
        }));
  const groups = [recommended, ...rest].filter((g) => g.kinds.length > 0);
  // Where a match is listed: Diagram's under its primary category, another mode's under its group.
  const home = (k: TemplateKind) =>
    mode === 'diagram' ? templateCategory(k) : (rest.find((g) => g.kinds.includes(k))?.id ?? null);
  const search = (query: string) => {
    if (query.trim() === '') return [];
    const found = listed.filter((k) => templateMatchesQuery(templateOf(k), query));
    return rest
      .map((g) => ({ group: g.id, kinds: found.filter((k) => home(k) === g.id) }))
      .filter((g) => g.kinds.length > 0);
  };
  return { blank, groups, search };
}

export const TEMPLATE_STARTS: Readonly<Record<TemplateStartMode, TemplateStart>> = {
  diagram: build('diagram'),
  draw: build('draw'),
  workshop: build('workshop'),
};
