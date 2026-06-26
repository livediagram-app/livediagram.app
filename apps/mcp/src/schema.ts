// The element-schema MCP resource (spec/62 §4.5) + the tools' zod input shapes.
// Element types + anchors come from packages/diagram (single source of truth);
// the design rules are curated guidance. Tool element arrays stay permissive
// here — the real structural check is the diagram package's isValidTab at the
// tool boundary, so the schema lives in one place.
import { z } from 'zod';
import { ANCHORS, ELEMENT_TYPES, THEMES } from '@livediagram/diagram';

export const SCHEMA_RESOURCE_URI = 'livediagram://schema/elements';

export function elementSchemaDoc(): string {
  const types = [...ELEMENT_TYPES].join(', ');
  const anchors = [...ANCHORS].join(', ');
  const themeIds = THEMES.map((t) => t.id).join(', ');
  return `# livediagram element schema

A tab is { name, elements: Element[] }. Every element needs a unique string "id".
A diagram has one or more tabs, each its own canvas. create_diagram makes a
diagram with one or more tabs at once; add_tab appends another tab to an existing
diagram (e.g. an overview tab, then a detail tab zooming into one subsystem).

## Element types
${types}

Boxed elements (shape, text, sticky, table, image, annotation) carry:
  id, type, x, y, width, height, and an optional "label" (string).
  - "shape" is the element for a NODE — a labelled box, the default building
    block of almost every diagram. It also needs "shape": "rectangle" (the
    default box / process step), "diamond" (a decision), "cylinder" (a
    datastore / database), "circle", "ellipse", "square", "cloud", "hexagon",
    "parallelogram" (I/O), "star", and more, plus "frame" (a section container
    drawn behind its contents). Unknown shape kinds fall back to a rounded box.
  - "text" is BARE text with no box, fill, or border. Use it ONLY for a
    free-standing title, caption, legend, or note — NEVER for a node. A node
    that has a label is a "shape" with a "label" (use shape: "rectangle"), not a
    "text". Defaulting to "text" for nodes makes a diagram of floating words
    with no boxes; reach for "shape" unless you specifically want loose text.

## Arrows
type "arrow" with "from" and "to" endpoints. PREFER pinned endpoints so arrows
track their shapes when laid out or moved:
  from / to: { "kind": "pinned", "elementId": "<id>", "anchor": "<a>" }
  anchors: ${anchors}
A free endpoint is { "kind": "free", "x": number, "y": number }. Arrows may carry
an optional "label".

## Layout — your call
YOU decide the layout; the server does not override a real arrangement.
- For a deliberate shape, set explicit x/y and they are kept as given: a life
  CYCLE as a ring with an arrow looping back to the start, a hierarchy as a
  top-down tree, a comparison as a grid, a timeline as a row.
- For a simple flow you'd rather not position, leave coordinates rough or zero
  and the server arranges a clean graph (>= 3 nodes joined by pinned arrows).
- The "layout" tool argument forces it either way: "preserve" keeps your
  coordinates, "auto" re-lays-out the graph. Omitted = auto-detect (a real
  arrangement is kept; nodes left piled at one point get laid out).
- Supporting text (a per-node description, a caption, a title) is ALWAYS kept
  where you place it and never auto-arranged — so put it next to the node it
  describes, not in a loose pile.

## Themes (the look)
Set "theme" on create_diagram / add_tab to one of these presets and the server
paints the whole diagram + canvas with it (you still omit per-element colours):
  ${themeIds}
Defaults to "brand" (clean, light). Rough guide: cool blues = ocean / sky;
greens = forest / pine / olive; warm = sunset / sand / rose / mocha; neutral =
mono / steel / cream; dark backdrops = midnight / charcoal / plum / abyss;
multi-colour (each branch a different hue) = rainbow / pastel / tropical /
autumn / jewel; uml = standard UML notation colours. Pick one that fits the
subject; one theme applies to all tabs in a create_diagram call.

## Design rules (diagrams that read well)
- Nodes are SHAPES, not text. Use type "shape" (shape: "rectangle" by default,
  "diamond" for a decision, "cylinder" for a datastore) for every box in the
  diagram. Reserve type "text" for stand-alone titles / captions.
- Do NOT set colours. The theme owns fill / stroke / text colour; omit them and
  the diagram inherits a coherent palette.
- Size sibling nodes consistently (e.g. every box 160x64).
- Prefer pinned arrows (node -> node) so they track their shapes when moved.
- Give every node an id and a short, clear label.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (spec/62 §4.5).
export const SERVER_INSTRUCTIONS = `Tools to find, view, create, add tabs to, and edit the user's livediagram diagrams.
The calling model produces the diagram elements AND decides their layout; this
server validates, persists, and renders them, and only auto-arranges the graph
when you ask it to (or leave nodes unplaced). Read the ${SCHEMA_RESOURCE_URI}
resource before creating or updating: use a unique "id" per element, make nodes
"shape" elements (a labelled box) NOT "text" (text is only for titles/captions),
position elements yourself for a deliberate shape (a cycle as a ring, a tree, a
grid), prefer pinned arrows (node -> node), and do NOT set colours — the theme
owns them.`;

// --- Tool input shapes (ZodRawShape). Element arrays are permissive; isValidTab
// is the real guard, so there's no second schema to drift. ---

const elementArray = z.array(z.record(z.string(), z.unknown()));

const layoutField = z
  .enum(['auto', 'preserve'])
  .optional()
  .describe(
    'How to position elements. "preserve" keeps the exact x/y you give — use it for a deliberate shape (a cycle as a ring, a tree, a grid). "auto" arranges a clean directed graph for you. Omit to auto-detect: a real arrangement is kept; nodes left piled at one point get laid out. Supporting text is always kept in place either way.',
  );

const themeField = z
  .string()
  .optional()
  .describe(
    'Preset theme id that paints the whole diagram + canvas (see the schema ' +
      'resource for the list, e.g. brand, ocean, forest, sunset, midnight, rainbow). ' +
      'Omit per-element colours and let the theme own them. Defaults to "brand".',
  );

export const findDiagramsShape = {
  query: z.string().optional().describe('Only diagrams whose name contains this text.'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

export const readDiagramShape = {
  diagramId: z.string().describe('The diagram id (from find_diagrams).'),
  tabId: z.string().optional().describe('Which tab to read; defaults to the first.'),
};

const tabShape = z.object({
  name: z.string().describe('Name of the tab.'),
  elements: elementArray.describe('The elements (see the schema resource).'),
});

export const createDiagramShape = {
  name: z.string().describe('Name for the new diagram.'),
  // `tabs` is preferred; `tab` is accepted as an alias for a single tab so a
  // client with a stale cached schema (or one that just sends `tab`) still works
  // — provide one or the other.
  tabs: z
    .array(tabShape)
    .min(1)
    .max(20)
    .optional()
    .describe(
      'One or more tabs, each its own canvas. Preferred — pass several to create a multi-tab ' +
        'diagram in one call (e.g. an overview tab plus a detail tab per subsystem).',
    ),
  tab: tabShape.optional().describe('A single tab — accepted as an alias for tabs: [tab].'),
  layout: layoutField,
  theme: themeField,
};

export const addTabShape = {
  diagramId: z
    .string()
    .describe('The diagram to add a tab to (from find_diagrams / read_diagram).'),
  name: z.string().describe('Name of the new tab.'),
  elements: elementArray.describe('The elements for the new tab (see the schema resource).'),
  layout: layoutField,
  theme: themeField,
};

export const updateDiagramShape = {
  diagramId: z.string(),
  tabId: z.string().optional().describe('Which tab to edit; defaults to the first.'),
  mode: z.enum(['replace', 'ops']).describe('"replace" the whole tab, or apply granular "ops".'),
  elements: elementArray.optional().describe('replace mode: the full new element list.'),
  layout: layoutField,
  ops: z
    .array(
      z.object({
        op: z.enum(['add', 'update', 'remove']),
        element: z.record(z.string(), z.unknown()).optional(),
        elementId: z.string().optional(),
      }),
    )
    .optional()
    .describe('ops mode: ordered add / update / remove against existing element ids.'),
};
