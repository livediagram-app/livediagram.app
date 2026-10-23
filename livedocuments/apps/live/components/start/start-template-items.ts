// What an empty tab's template start offers (docs/specs/007-editor/start-diagramming.md): Start Making Pages on a
// Pages tab. Every listed template, a rail over them (Recommended, then groups) and the search across them. The
// templates nearly all share one catalogue category (Presentations), so the start groups them by what each makes
// (OWN_GROUPS). Drawn from the template catalogue, so a new template joins its group with no change here. Pure: the
// panel draws what these return.
import {
  BLANK_TEMPLATE,
  TEMPLATES,
  stepPopularKinds,
  templateMatchesQuery,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livedocuments/templates';

type TemplateStartGroup = {
  id: string;
  name: string;
  line: string;
  // The templates it shows (Recommended's are in order; a group's in catalogue order).
  kinds: readonly TemplateKind[];
};

type TemplateStart = {
  // Recommended, then every group holding a template.
  groups: readonly TemplateStartGroup[];
  // Every match, each once, under its group, in rail order.
  search: (query: string) => { group: string; kinds: TemplateKind[] }[];
};

const RECOMMENDED_LINE = 'The quickest ways to make something to share, picked for most people.';

// Start Making Pages' Recommended opens on two blanks of a page kind in place of the Popular shelf's Blank Illustration
// and Article: a page already of its kind is the quicker start (docs/specs/007-editor/start-diagramming.md
// "Recommended and groups"). The shelf itself, shared with the gallery, is unchanged.
const RECOMMENDED_SWAPS: ReadonlyMap<TemplateKind, TemplateKind> = new Map<
  TemplateKind,
  TemplateKind
>([
  ['blank-illustration', 'blank-infographic'],
  ['article', 'blank-article'],
]);

type OwnGroup = { id: string; name: string; line: string; kinds: readonly TemplateKind[] };

// Grouped by what each makes, each group but Posters and Design led by its blank of a page kind. A template in none of
// the groups is placed in the last.
const OWN_GROUPS: readonly OwnGroup[] = [
  {
    id: 'slides',
    name: 'Slides',
    line: 'Decks to present, one idea to a slide.',
    kinds: [
      'blank-slide-deck',
      'slide-deck',
      'launch-keynote',
      'quarterly-review',
      'team-welcome',
      'workshop-kickoff',
    ],
  },
  {
    id: 'infographics',
    name: 'Infographics',
    line: 'Numbers, comparisons and how-tos told visually.',
    kinds: ['blank-infographic', 'year-in-review', 'data-story', 'how-it-works', 'versus'],
  },
  {
    id: 'articles',
    name: 'Articles',
    line: 'Articles, résumés and cards of text on pages.',
    kinds: ['blank-article', 'article', 'working-backwards', 'resume', 'recipe-card'],
  },
  {
    id: 'posters',
    name: 'Posters and Social',
    line: 'Posters, cards and social posts to print, pin up or share.',
    kinds: ['event-poster', 'social-carousel', 'live-card'],
  },
  {
    id: 'logos',
    name: 'Logos',
    line: 'Marks, wordmarks and lockups for a brand.',
    kinds: ['blank-logo', 'logo-design'],
  },
  {
    id: 'wireframes',
    name: 'Wireframes',
    line: 'Screens in their device: a phone, a tablet, a laptop, a browser or a watch.',
    kinds: [
      'blank-wireframe-phone',
      'blank-wireframe-tablet',
      'blank-wireframe-browser',
      'blank-wireframe-laptop',
      'blank-wireframe-watch',
      'wireframe-mobile-app',
      'wireframe-website',
      'wireframe-dashboard',
      'wireframe-tablet-app',
      'wireframe-watch-app',
    ],
  },
  {
    id: 'design',
    name: 'Design',
    line: 'Storyboards and floor plans, drawn to show.',
    kinds: ['storyboard', 'floor-plan'],
  },
];

const byKind = new Map(TEMPLATES.map((t) => [t.kind, t]));

/** A template's descriptor. */
export const templateOf = (kind: TemplateKind): TemplateDescriptor => byKind.get(kind)!;

function build(): TemplateStart {
  // Blank Illustration leaves the same empty tab the × does, so it is offered nowhere. Blank Tab is made by name only (an agent's add_tab, a `/new?blank` link), in no category, so on no start either.
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== BLANK_TEMPLATE && t.kind !== 'blank',
  ).map((t) => t.kind);
  const recommended: TemplateStartGroup = {
    id: 'recommended',
    name: 'Recommended',
    line: RECOMMENDED_LINE,
    kinds: stepPopularKinds().map((k) => RECOMMENDED_SWAPS.get(k) ?? k),
  };
  const rest: TemplateStartGroup[] = OWN_GROUPS.map((g, i, all) => ({
    ...g,
    kinds: [
      ...g.kinds.filter((k) => listed.includes(k)),
      ...(i === all.length - 1 ? listed.filter((k) => !all.some((x) => x.kinds.includes(k))) : []),
    ],
  }));
  const groups = [recommended, ...rest].filter((g) => g.kinds.length > 0);
  // Where a match is listed: its first group.
  const home = (k: TemplateKind) => rest.find((g) => g.kinds.includes(k))?.id ?? null;
  const search = (query: string) => {
    if (query.trim() === '') return [];
    const found = listed.filter((k) => templateMatchesQuery(templateOf(k), query));
    return rest
      .map((g) => ({ group: g.id, kinds: found.filter((k) => home(k) === g.id) }))
      .filter((g) => g.kinds.length > 0);
  };
  return { groups, search };
}

export const TEMPLATE_START: TemplateStart = build();
