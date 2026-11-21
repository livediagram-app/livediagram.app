// What the knowledgebase's start screen offers (docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): Start (Blank Knowledgebase) first, then every listed writing template under its category, and the search
// across them. Drawn from the template catalogue, so a new template joins its group with no change here. Pure: the
// panel draws what these return.
import {
  BLANK_TEMPLATE,
  isBlankTemplate,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCategory,
  templateMatchesQuery,
  templatePageKind,
  type TemplateDescriptor,
  type TemplateKind,
} from '@liveknowledge/templates';
import type { PageKind } from '@liveknowledge/document';

// What the start shows (start-diagramming.md "Page type"): every template, or only those opening on one kind of page.
export type StartPageType = 'all' | PageKind;

type TemplateStartGroup = {
  id: string;
  name: string;
  line: string;
  // The templates it shows, in catalogue order.
  kinds: readonly TemplateKind[];
};

type TemplateStart = {
  // Blank Pages, then every group holding a template.
  groups: readonly TemplateStartGroup[];
  // Every match, each once, under its group, in rail order.
  search: (query: string) => { group: string; kinds: TemplateKind[] }[];
};

type OwnGroup = { id: string; name: string; line: string; kinds: readonly TemplateKind[] };

// The id of the start's first group, and of its one card, Blank Knowledgebase: the knowledgebase as /new made it.
export const START_GROUP_ID = 'start';
export const BLANK_KNOWLEDGEBASE = 'blank' as const satisfies TemplateKind;

// Start leads, then one group per catalogue category, in the order and with the names every other picker uses
// (docs/specs/008-canvas/canvas-and-palette.md "Template categories"), each template under its primary category. A
// template in none of the groups is placed in the last.
const OWN_GROUPS: readonly OwnGroup[] = [
  {
    id: START_GROUP_ID,
    name: 'Start',
    line: 'An empty knowledgebase: its first page, ready to write.',
    kinds: [BLANK_KNOWLEDGEBASE],
  },
  ...TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.label,
    line: c.description,
    kinds: TEMPLATES.filter((t) => templateCategory(t.kind) === c.id).map((t) => t.kind),
  })),
];

const byKind = new Map(TEMPLATES.map((t) => [t.kind, t]));

/** A template's descriptor. */
export const templateOf = (kind: TemplateKind): TemplateDescriptor => byKind.get(kind)!;

function build(type: StartPageType): TemplateStart {
  // A page type keeps only the templates opening on that kind of page (templatePageKind).
  const ofType = (k: TemplateKind) => type === 'all' || templatePageKind(k) === type;
  // Blank Knowledgebase is the Start group's own; the other blanks (Blank Illustration, the blank article) are
  // offered nowhere, as Blank Knowledgebase already is what they make.
  const listed = [
    ...(ofType(BLANK_KNOWLEDGEBASE) ? [BLANK_KNOWLEDGEBASE] : []),
    ...TEMPLATES.filter(
      (t) =>
        !t.hidden &&
        t.kind !== BLANK_TEMPLATE &&
        !isBlankTemplate(t.kind) &&
        t.kind !== 'blank-article' &&
        ofType(t.kind),
    ).map((t) => t.kind),
  ];
  const rest: TemplateStartGroup[] = OWN_GROUPS.map((g, i, all) => ({
    ...g,
    kinds: [
      ...g.kinds.filter((k) => listed.includes(k)),
      ...(i === all.length - 1 ? listed.filter((k) => !all.some((x) => x.kinds.includes(k))) : []),
    ],
  }));
  const groups = rest.filter((g) => g.kinds.length > 0);
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

export const TEMPLATE_START: TemplateStart = build('all');

// Each page type's start, built the first time it is chosen and kept: a handful at most.
const BY_TYPE = new Map<StartPageType, TemplateStart>([['all', TEMPLATE_START]]);

/** The start showing only `type`'s templates (every template for 'all'). */
export function templateStartFor(type: StartPageType): TemplateStart {
  let start = BY_TYPE.get(type);
  if (!start) BY_TYPE.set(type, (start = build(type)));
  return start;
}
