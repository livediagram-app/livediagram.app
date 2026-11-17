// What an empty tab's template start offers (docs/specs/007-editor/start-diagramming.md): Start Making Pages on a
// Pages tab. Every listed template, a rail over them (Recommended, then groups) and the search across them. The
// start groups them as the catalogue does, by what each design is for, after Blank Pages (OWN_GROUPS). Drawn from the template catalogue, so a new template joins its group with no change here. Pure: the
// panel draws what these return.
import {
  EXTRA_BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCategory,
  popularKindsFor,
  templateEditorMode,
  templateMatchesQuery,
  templatePageKind,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livedesign/templates';
import type { EditorMode, PageKind } from '@livedesign/design';

// What the start shows (start-diagramming.md "Page type"): every template, or only those opening on one kind of page.
export type StartPageType = 'all' | PageKind;

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

const RECOMMENDED_LINE: Record<EditorMode, string> = {
  pages: 'The quickest ways to make something to share, picked for most people.',
};

type OwnGroup = { id: string; name: string; line: string; kinds: readonly TemplateKind[] };

// Blank Pages leads with one empty page of each kind, then one group per catalogue category, in the order and with
// the names every other picker uses (docs/specs/008-canvas/canvas-and-palette.md "Template categories"), each
// template under its primary category. A template in none of the groups is placed in the last.
const BLANK_PAGES: OwnGroup = {
  id: 'blank-pages',
  name: 'Blank Pages',
  line: 'One empty page of the kind you mean: a logo, or a wireframe in its device.',
  kinds: EXTRA_BLANK_TEMPLATES,
};

const OWN_GROUPS: Readonly<Record<EditorMode, readonly OwnGroup[]>> = {
  pages: [
    BLANK_PAGES,
    ...TEMPLATE_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.label,
      line: c.description,
      kinds: TEMPLATES.filter((t) => templateCategory(t.kind) === c.id).map((t) => t.kind),
    })),
  ],
};

const byKind = new Map(TEMPLATES.map((t) => [t.kind, t]));

/** A template's descriptor. */
export const templateOf = (kind: TemplateKind): TemplateDescriptor => byKind.get(kind)!;

function build(mode: EditorMode, type: StartPageType): TemplateStart {
  // A page type keeps only the templates opening on that kind of page (templatePageKind).
  const ofType = (k: TemplateKind) => type === 'all' || templatePageKind(k) === type;
  // Blank Tab, the mode's blank, leaves the same empty tab the × does, so it is made by name only (an agent's add_tab, a `/new?blank` link), in no category, so on no start either.
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== 'blank' && templateEditorMode(t.kind) === mode && ofType(t.kind),
  ).map((t) => t.kind);
  const recommended: TemplateStartGroup = {
    id: 'recommended',
    name: 'Recommended',
    line: RECOMMENDED_LINE[mode],
    kinds: popularKindsFor(mode).filter(ofType),
  };
  const rest: TemplateStartGroup[] = OWN_GROUPS[mode].map((g, i, all) => ({
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

export const TEMPLATE_STARTS: Readonly<Record<EditorMode, TemplateStart>> = {
  pages: build('pages', 'all'),
};

// Each page type's start, built the first time it is chosen and kept: a handful at most.
const BY_TYPE = new Map<string, TemplateStart>();

/** The start for `mode`, showing only `type`'s templates (every template for 'all'). */
export function templateStartFor(mode: EditorMode, type: StartPageType): TemplateStart {
  if (type === 'all') return TEMPLATE_STARTS[mode];
  const key = `${mode}:${type}`;
  let start = BY_TYPE.get(key);
  if (!start) BY_TYPE.set(key, (start = build(mode, type)));
  return start;
}
