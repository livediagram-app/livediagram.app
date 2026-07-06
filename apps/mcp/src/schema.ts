// The element-schema MCP resource (spec/62 §4.5) + the tools' zod input shapes.
// Element types + anchors come from packages/diagram (single source of truth);
// the design rules are curated guidance. The element STRUCTURE is carried inline
// on every tool argument that takes elements (ELEMENT_SCHEMA_HINT) so a calling
// model has the whole format from the tool definition itself and never needs to
// fetch the resource, web-search the open-source repo, or read another diagram
// to discover it. isValidTab in the diagram package stays the runtime guard, so
// the structure still lives in one authoritative place (this string is guidance,
// not a second validator).
import { z } from 'zod';
import { ANCHORS, ELEMENT_TYPES, SHAPE_KINDS, THEMES } from '@livediagram/diagram';

export const SCHEMA_RESOURCE_URI = 'livediagram://schema/elements';

const types = [...ELEMENT_TYPES].join(', ');
const anchors = [...ANCHORS].join(', ');
const shapeKinds = [...SHAPE_KINDS].join(', ');
const themeIds = THEMES.map((t) => t.id).join(', ');

// Self-contained element schema, attached to each tool's element argument so the
// model reads it straight from the tool definition (see the comment above).
const ELEMENT_SCHEMA_HINT =
  'An array of element objects. This is the COMPLETE format; you already have ' +
  'everything you need, so do NOT web-search, open the source repo, or read ' +
  'another diagram to discover it. Each element: { "id": a unique string, "type", ' +
  '"x", "y", "width", "height", and optional "label" }. ' +
  'type "shape" is a NODE (a labelled box) and also needs "shape", one of ' +
  `${shapeKinds}. The default box is "square" (there is NO "rectangle"); use ` +
  '"diamond" for a decision, "cylinder" for a datastore, "stadium" for start/end. ' +
  'type "text" is BARE text with no box; use it only for a title, caption, or ' +
  'legend, never for a node. type "arrow" needs "from" and "to" endpoints, each ' +
  'either { "kind": "pinned", "elementId", "anchor" } (anchors: ' +
  `${anchors}; preferred, so arrows track their shapes) or ` +
  '{ "kind": "free", "x", "y" }; an arrow may carry a "label". ' +
  'Do NOT set colours; the theme owns fill, stroke, and text.';

export function elementSchemaDoc(): string {
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
    block of almost every diagram. It also needs "shape": one of
    ${shapeKinds}. The default box / process step is "square" (a rounded
    rectangle that fills its width × height) — there is NO "rectangle" kind.
    Use "diamond" for a decision, "cylinder" for a datastore, "stadium" for a
    start/end, "circle", "hexagon", "parallelogram" for I/O, and "frame" for a
    section container. An unknown kind is coerced to "square".
  - "text" is BARE text with no box, fill, or border. Use it ONLY for a
    free-standing title, caption, legend, or note — NEVER for a node. A node
    that has a label is a "shape" with a "label" (use shape: "square"), not a
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
- Nodes are SHAPES, not text. Use type "shape" (shape: "square" by default,
  "diamond" for a decision, "cylinder" for a datastore) for every box in the
  diagram. Reserve type "text" for stand-alone titles / captions.
- Do NOT set colours. The theme owns fill / stroke / text colour; omit them and
  the diagram inherits a coherent palette.
- Size sibling nodes consistently (e.g. every box 160x64).
- Prefer pinned arrows (node -> node) so they track their shapes when moved.
- Give every node an id and a short, clear label.
- For a standard artefact (kanban, flowchart, SWOT, gantt, wireframe, ...),
  don't rebuild it from raw elements: call list_templates and pass its kind as
  "template" on create_diagram / add_tab, then personalise the labels with
  update_diagram. The hand-tuned scaffold reads better than a from-scratch one.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (spec/62 §4.5). The element format is carried inline on the tool
// arguments, so these instructions tell the model NOT to look it up elsewhere.
export const SERVER_INSTRUCTIONS = `Tools to find, view, create, add tabs to, edit, share, rename, and delete the user's livediagram diagrams.
The calling model produces the diagram elements AND decides their layout; this
server validates, persists, and renders them, and only auto-arranges the graph
when you ask it to (or leave nodes unplaced). The full element format is
described inline on each tool's element argument, so you already have everything
you need from the tool definitions: do NOT web-search, open the open-source repo,
or read another diagram to learn the schema. The EASIEST way to author a node/edge diagram (flowchart, org chart,
architecture, dependency graph) is the "graph" argument: give just nodes + edges
by id and the server builds the boxes + arrows and lays them out — no
coordinates, no anchors. Reach for raw "elements" only for a deliberate
arrangement (a cycle as a ring, a grid) or mixed non-node content. Either way:
use a unique "id" per element, make nodes "shape" elements (a labelled box) NOT
"text" (text is only for titles/captions), prefer pinned arrows (node -> node),
and do NOT set colours, the theme owns them. For a standard artefact (kanban, flowchart, SWOT,
gantt, wireframe, ...) check list_templates first and pass its kind as
"template" on create_diagram / add_tab — the hand-tuned scaffold beats
rebuilding one from raw elements — then fill in real labels with
update_diagram.`;

// --- Tool input shapes (ZodRawShape). Element arrays are permissive; isValidTab
// is the real guard, so there's no second schema to drift. ---

const elementArray = z.array(z.record(z.string(), z.unknown())).describe(ELEMENT_SCHEMA_HINT);

const layoutField = z
  .enum(['auto', 'preserve'])
  .optional()
  .describe(
    'How to position elements. "preserve" keeps the exact x/y you give — use it for a deliberate shape (a cycle as a ring, a tree, a grid). "auto" arranges a clean directed graph for you. Omit to auto-detect: a real arrangement is kept; nodes left piled at one point get laid out. Supporting text is always kept in place either way.',
  );

// Template kinds are validated at runtime against the shared catalogue
// (@livediagram/templates) rather than a z.enum, so a new template is one
// catalogue entry with no schema churn; list_templates is the discovery
// surface.
const templateField = z
  .string()
  .optional()
  .describe(
    'Start from a hand-tuned template scaffold instead of providing elements: a template ' +
      'kind from list_templates (e.g. "kanban", "flowchart", "gantt"). The server ' +
      'materialises its curated layout ("layout" is ignored for a template tab) and paints ' +
      'it with the chosen theme. Personalise the placeholder labels afterwards with ' +
      'update_diagram mode "ops". Provide template OR elements, not both.',
  );

const themeField = z
  .string()
  .optional()
  .describe(
    'Preset theme id that paints the whole diagram + canvas. One of: ' +
      `${themeIds}. Omit per-element colours and let the theme own them. ` +
      'Defaults to "brand".',
  );

// Graph-first authoring (spec/62 §4.7): the LOW-BURDEN path. Give just the
// connection graph — nodes and edges by id — and the server builds the
// boxes + arrows and lays them out for you. Prefer this over hand-placing
// elements whenever the diagram is a node/edge graph (flowcharts, org
// charts, architecture, dependency graphs): no x/y/width/height, no
// anchors, far fewer mistakes. Use `elements` only when you need precise
// control (a deliberate ring/grid, mixed free-text, non-node content).
const graphField = z
  .object({
    nodes: z
      .array(
        z.object({
          id: z.string().describe('Unique id the edges reference.'),
          label: z.string().optional().describe('Text inside the box.'),
          shape: z
            .string()
            .optional()
            .describe(
              `Shape kind (${shapeKinds}); default "square". Use "diamond" for a ` +
                'decision, "cylinder" for a datastore, "stadium" for start/end.',
            ),
        }),
      )
      .min(1)
      .describe('The nodes (boxes). Each needs a unique id.'),
    edges: z
      .array(
        z.object({
          from: z.string().describe('Source node id.'),
          to: z.string().describe('Target node id.'),
          label: z.string().optional().describe('Optional text on the arrow.'),
        }),
      )
      .describe('Directed connections between node ids. An edge to an unknown id is dropped.'),
  })
  .optional()
  .describe(
    'A node/edge graph the server turns into laid-out boxes + arrows — the ' +
      'easiest way to author. Provide graph OR elements OR template, not more than one.',
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
  graph: graphField,
  elements: elementArray.optional(),
  template: templateField,
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
  graph: graphField,
  elements: elementArray.optional(),
  template: templateField,
  layout: layoutField,
  theme: themeField,
};

export const updateDiagramShape = {
  diagramId: z.string(),
  tabId: z.string().optional().describe('Which tab to edit; defaults to the first.'),
  mode: z.enum(['replace', 'ops']).describe('"replace" the whole tab, or apply granular "ops".'),
  graph: graphField,
  elements: elementArray
    .optional()
    .describe(`Replace mode: the full new element list. ${ELEMENT_SCHEMA_HINT}`),
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

export const shareDiagramShape = {
  diagramId: z.string().describe('The diagram to share (from find_diagrams / read_diagram).'),
  role: z
    .enum(['view', 'edit'])
    .optional()
    .describe(
      'What the link grants. "view" (default) — recipients can open and read but ' +
        'not change it; safest for just showing your work. "edit" — recipients ' +
        'can also edit. No sign-in is needed to open either.',
    ),
  expiry: z
    .enum(['never', 'week', 'month', 'sixMonths'])
    .optional()
    .describe('When the link stops working. Defaults to "never" (until revoked).'),
};

export const deleteDiagramShape = {
  diagramId: z.string().describe('The diagram to delete (from find_diagrams / read_diagram).'),
  tabId: z
    .string()
    .optional()
    .describe(
      'Delete only this ONE tab instead of the whole diagram. A diagram must keep at ' +
        'least one tab, so deleting the last remaining tab is refused.',
    ),
};

export const renameDiagramShape = {
  diagramId: z.string().describe('The diagram to rename (from find_diagrams / read_diagram).'),
  name: z.string().min(1).describe('The new name.'),
  tabId: z
    .string()
    .optional()
    .describe('Rename this tab within the diagram instead of the diagram itself.'),
};
