// What an empty tab's template start offers (docs/specs/007-editor/start-diagramming.md): Start Diagramming on a
// Diagram tab, Start Drawing on a Draw tab, Start a Workshop on a Workshop tab. Every listed template of the mode, a
// rail over them (Recommended, then groups) and the search across them. The groups are the catalogue's categories in
// every mode: they are grouped by use case, so they already say which session a Workshop template runs and what a
// Draw template is for. Drawn from the template catalogue, so a new template joins its mode's panel with no change
// here. Pure: the panel draws what these return.
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
} from '@livehuddle/templates';

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
  // Every match, each once, under its primary category, in rail order.
  search: (query: string) => { group: string; kinds: TemplateKind[] }[];
};

const RECOMMENDED_LINE: Record<TemplateStartMode, string> = {
  diagram: 'The quickest ways to start, picked for most diagrams.',
  draw: 'The quickest ways to start sketching, picked for most people.',
  workshop: 'The quickest ways to run a session, picked for most teams.',
};

// Recommended leaves these to their group (Timeline, under Planning).
const NOT_RECOMMENDED: ReadonlySet<TemplateKind> = new Set(['timeline']);

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
  const rest: TemplateStartGroup[] = TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.label,
    line: c.description,
    kinds: listed.filter((k) => isInTemplateCategory(k, c.id)),
  }));
  const groups = [recommended, ...rest].filter((g) => g.kinds.length > 0);
  const search = (query: string) => {
    if (query.trim() === '') return [];
    const found = listed.filter((k) => templateMatchesQuery(templateOf(k), query));
    return rest
      .map((g) => ({ group: g.id, kinds: found.filter((k) => templateCategory(k) === g.id) }))
      .filter((g) => g.kinds.length > 0);
  };
  return { blank, groups, search };
}

export const TEMPLATE_STARTS: Readonly<Record<TemplateStartMode, TemplateStart>> = {
  diagram: build('diagram'),
  draw: build('draw'),
  workshop: build('workshop'),
};
