// What an empty tab's template start offers (docs/specs/007-editor/start-diagramming.md): Start Diagramming on a
// Diagram tab, Start Drawing on a Draw tab, Start a Space on a Workshop tab. Every listed template of the mode, a
// rail over them (Recommended, then groups) and the search across them. The groups are the catalogue's categories in
// every mode: they are grouped by use case, so they already say which session a Workshop template runs and what a
// Draw template is for. Drawn from the template catalogue, so a new template joins its mode's panel with no change
// here. Pure: the panel draws what these return.
import {
  BLANK_TEMPLATE_FOR_MODE,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isBlankTemplate,
  isInTemplateCategory,
  popularKindsFor,
  templateCategory,
  templateEditorMode,
  templateMatchesQuery,
  type TemplateCategory,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livehuddle/templates';

// Workshop, the one editor mode (docs/specs/007-editor/editor-modes.md).
export type TemplateStartMode = 'workshop';

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
  // The group the start opens on: the Office Spaces (LEADING_START_GROUP).
  initial: string;
  // The Spaces, then Recommended, then every other group holding a template.
  groups: readonly TemplateStartGroup[];
  // Every match, each once, under its primary category, in rail order.
  search: (query: string) => { group: string; kinds: TemplateKind[] }[];
};

const RECOMMENDED_LINE: Record<TemplateStartMode, string> = {
  workshop: 'The quickest ways to meet, picked for most teams.',
};

// The group the start leads with and opens on (docs/specs/007-editor/start-diagramming.md "The Spaces lead"):
// livehuddle is a place to meet, so the Office Spaces to walk round come before everything, Recommended included.
export const LEADING_START_GROUP: TemplateCategory = 'office';

const byKind = new Map(TEMPLATES.map((t) => [t.kind, t]));

/** A template's descriptor. */
export const templateOf = (kind: TemplateKind): TemplateDescriptor => byKind.get(kind)!;

function build(mode: TemplateStartMode): TemplateStart {
  const blank = BLANK_TEMPLATE_FOR_MODE[mode];
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && !isBlankTemplate(t.kind) && templateEditorMode(t.kind) === mode,
  ).map((t) => t.kind);
  const recommended: TemplateStartGroup = {
    id: 'recommended',
    name: 'Recommended',
    line: RECOMMENDED_LINE[mode],
    kinds: popularKindsFor(mode),
  };
  const rest: TemplateStartGroup[] = TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.label,
    line: c.description,
    kinds: listed.filter((k) => isInTemplateCategory(k, c.id)),
  }));
  const lead = rest.filter((g) => g.id === LEADING_START_GROUP);
  const others = rest.filter((g) => g.id !== LEADING_START_GROUP);
  const railed = [...lead, ...others];
  const groups = [...lead, recommended, ...others].filter((g) => g.kinds.length > 0);
  const search = (query: string) => {
    if (query.trim() === '') return [];
    const found = listed.filter((k) => templateMatchesQuery(templateOf(k), query));
    return railed
      .map((g) => ({ group: g.id, kinds: found.filter((k) => templateCategory(k) === g.id) }))
      .filter((g) => g.kinds.length > 0);
  };
  return { blank, initial: groups[0]?.id ?? recommended.id, groups, search };
}

export const TEMPLATE_STARTS: Readonly<Record<TemplateStartMode, TemplateStart>> = {
  workshop: build('workshop'),
};
