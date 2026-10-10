// The element-schema MCP resource (docs/specs/015-api/mcp-server.md §4.5) + the tools' zod input shapes.
// Element types + anchors come from packages/document (single source of truth);
// the design rules are curated guidance. The element STRUCTURE is carried inline
// on every tool argument that takes elements (ELEMENT_SCHEMA_HINT) so the whole
// format is available from the tool definition itself, with no second lookup to
// make. It states that completeness as a fact about the tools rather than as a
// rule for the caller: a description that tells a model how to behave, or steers
// it away from other tools, is a connector-listing flag (docs/specs/015-api/mcp-server.md §4.15).
// isValidTab in the document package stays the runtime guard, so
// the structure still lives in one authoritative place (this string is guidance,
// not a second validator).
import { z } from 'zod';
import {
  FIND_QUERY_MAX_LENGTH,
  REF_INPUT_MAX_LENGTH,
  TAB_VIEW_NAMES,
  VIEW_BUDGET_MAX,
} from '@livediagram/api-schema';
import {
  ANCHORS,
  CODE_LANGUAGES,
  CODE_MAX_LENGTH,
  CODE_THEMES,
  ELEMENT_TYPES,
  ENTITY_MAX_FIELDS,
  GRAPH_LABEL_MAX,
  NAME_MAX_LENGTH,
  SHAPE_KINDS,
  STICKY_PRESETS,
  THEMES,
  truncateName,
} from '@livediagram/document';

export const SCHEMA_RESOURCE_URI = 'livediagram://schema/elements';

const types = [...ELEMENT_TYPES].join(', ');
const anchors = [...ANCHORS].join(', ');
const shapeKinds = [...SHAPE_KINDS].join(', ');
const themeIds = THEMES.map((t) => t.id).join(', ');

// The content fields of the kinds that carry content (docs/specs/015-api/mcp-server.md §4.7a), as
// facts. One copy, shared by the tool argument and the schema resource; the
// vocabularies come from packages/document so they can't drift.
const stickyPairs = STICKY_PRESETS.map((p) => `${p.name.toLowerCase()} ${p.fill}/${p.text}`).join(
  ', ',
);
const CONTENT_KINDS =
  'Content-carrying kinds: ' +
  'type "sticky": a note whose "label" is its text; the theme never recolours it, so its own ' +
  `"fillColor" + "textColor" are kept (palette pairs, fill/text: ${stickyPairs}); unset it is ` +
  'the classic amber note. ' +
  'type "table": "cells" is rows of strings (ragged rows are padded), "headerRow" / ' +
  '"headerColumn" style the first row / column, "zebra" tints alternate rows. ' +
  `shape "code-block": "code" (up to ${CODE_MAX_LENGTH} chars), "codeLanguage" (` +
  `${CODE_LANGUAGES.join(', ')}), "codeTheme" (${CODE_THEMES.map((t) => t.id).join(', ')}; ` +
  'default midnight, dark), "codeWrap"; the block draws itself and shows no label. ' +
  'shape "entity": "label" is the title, "entityFields" is [{ "name", "type"? }] rows (up to ' +
  `${ENTITY_MAX_FIELDS}; keys go in the type, e.g. "uuid PK"); the box grows to fit its rows. ` +
  'shape "lane": a swimlane whose "label" is the title in its left strip; elements fully inside ' +
  'its box belong to it, lanes are placed one under another, and they paint behind everything. ' +
  'shape "bar-chart" / "pie-chart": "pieSlices" is [{ "label", "value" }]; categories show in ' +
  'the legend. shape "line-chart": "lineCategories" is the x labels, "lineSeries" is ' +
  '[{ "name", "values" }] with one value per category. A chart draws no title (a caption is a ' +
  'separate "text" element) and draws sample data when its data is empty.';

// Self-contained element schema, attached to each tool's element argument so the
// model reads it straight from the tool definition (see the comment above).
const ELEMENT_SCHEMA_HINT =
  'An array of element objects. This is the COMPLETE format, documented inline ' +
  'here: the tool definition is the full reference for it. ' +
  'Each element: { "id": a unique string, "type", ' +
  '"x", "y", "width", "height", and optional "label" }. ' +
  'type "shape" is a NODE (a labelled box) and also needs "shape", one of ' +
  `${shapeKinds}. The default box is "square" (there is NO "rectangle"); use ` +
  '"diamond" for a decision, "cylinder" for a datastore, "stadium" for start/end. ' +
  'type "text" is BARE text with no box; use it only for a title, caption, or ' +
  'legend, never for a node. type "arrow" needs "from" and "to" endpoints, each ' +
  'either { "kind": "pinned", "elementId", "anchor" } (anchors: ' +
  `${anchors}; preferred, so arrows track their shapes) or ` +
  '{ "kind": "free", "x", "y" }; an arrow may carry a "label". ' +
  'The theme owns fill, stroke, and text colour on every element except a sticky. ' +
  CONTENT_KINDS;

export function elementSchemaDoc(): string {
  return `# livediagram element schema

A tab is { name, elements: Element[] }. Every element needs a unique string "id".
A document has one or more tabs, each its own canvas. create_document makes a
document with one or more tabs at once; add_tab appends another tab to an existing
document (e.g. an overview tab, then a detail tab zooming into one subsystem).

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

## Content-carrying kinds
${CONTENT_KINDS}

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
Set "theme" on create_document / add_tab to one of these presets and the server
paints the whole diagram + canvas with it (you still omit per-element colours):
  ${themeIds}
Defaults to "brand", the Default scheme: the plain, un-themed canvas, which
follows each reader's own light / dark setting in the editor and paints no
element colours at all. Rough guide: cool blues = ocean / sky; greens = forest /
pine / olive; warm = sunset / sand / rose / mocha; neutral = mono / steel /
cream; dark backdrops = midnight / plum / abyss / espresso (or leave it on
"brand", which is dark for a reader in dark mode); multi-colour (each branch a
different hue) = rainbow / pastel / tropical / autumn / jewel; uml = standard
UML notation colours. Pick one that fits the subject; one scheme applies to all
tabs in a create_document call.

## Design rules (diagrams that read well)
- Nodes are SHAPES, not text. Use type "shape" (shape: "square" by default,
  "diamond" for a decision, "cylinder" for a datastore) for every box in the
  diagram. Reserve type "text" for stand-alone titles / captions.
- Do NOT set colours. The theme owns fill / stroke / text colour; omit them and
  the diagram inherits a coherent palette. A sticky is the exception: it is not
  themed, so its own fillColor / textColor are kept.
- Size sibling nodes consistently (e.g. every box 160x64).
- Prefer pinned arrows (node -> node) so they track their shapes when moved.
- Give every node an id and a short, clear label.
- For a standard artefact (kanban, flowchart, SWOT, gantt, wireframe, ...),
  don't rebuild it from raw elements: call list_templates and pass its kind as
  "template" on create_document / add_tab, then personalise the labels with
  update_document. The hand-tuned scaffold reads better than a from-scratch one.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (docs/specs/015-api/mcp-server.md §4.5). Phrased as facts about the server (what it does
// with what you send, and where the format is written down), not as rules for
// the calling model (docs/specs/015-api/mcp-server.md §4.15).
export const SERVER_INSTRUCTIONS = `Tools to find, view, create, add tabs to, edit, share, rename, delete (to the Trash) and restore the user's livediagram documents.
The calling model produces the diagram elements AND decides their layout; this
server validates, persists, and renders them, and only auto-arranges the graph
when you ask it to (or leave nodes unplaced). The full element format is
documented inline on each tool's element argument, so the tool definitions are
the complete reference for it. The EASIEST way to author a node/edge diagram (flowchart, org chart,
architecture, dependency graph) is the "graph" argument: give just nodes + edges
by id and the server builds the boxes + arrows and lays them out — no
coordinates, no anchors; the same graph can be given as Mermaid text
("mermaid"). A node's label is its heading (up to 40 characters, longer ones
shortened with the full text kept in the node's note). Raw "elements" are for a deliberate
arrangement (a cycle as a ring, a grid) or mixed non-node content. Either way:
use a unique "id" per element, make nodes "shape" elements (a labelled box) NOT
"text" (text is only for titles/captions), prefer pinned arrows (node -> node),
and the theme owns colours (a sticky keeps its own). Stickies, tables, code blocks,
entities, lanes and charts carry content fields, documented on each tool's
element argument. For a standard artefact (kanban, flowchart, SWOT,
gantt, wireframe, ...) check list_templates first and pass its kind as
"template" on create_document / add_tab — the hand-tuned scaffold beats
rebuilding one from raw elements — then fill in real labels with
update_document. Plan boards hold cards (items), which have their own tools:
list_items reads a document's boards, their columns by name, its cards and its
card types; change_items adds, edits and moves cards, naming columns, card
types, fields and people as the board shows them; add_board puts a board on a
tab (a preset or columns by name) and change_board changes one (title, columns,
the card types it shows); change_card_types adds and edits card types and their
custom fields. A board shows only the card types it takes. A Plan template (kanban, project-planner, bug-triage)
makes a document with boards ready to fill. Sheets (spreadsheets on a tab) have
theirs: list_sheets lists a document's sheets, read_sheet reads one's cells by A1
(inputs, worked-out values and what they show), change_sheet sets, clears and
formats cells, inserts and deletes rows and columns, sorts, freezes and renames,
and add_sheet puts a new Sheet on a tab, blank or from rows or CSV text.
Illustrate tabs hold pages: infographics, slides, logo artboards and articles
(documents of text on pages). change_pages adds, changes, lays out (from a
ready-made layout), moves, copies and deletes infographic, slide and logo pages
and answers each page's rectangle on the canvas, where update_document puts
elements; write_article writes an article from Markdown, new or over an existing
one, and the editor flows it onto pages. Asked to write a document, a report or
a brief, write an article; asked for a deck, add slide pages; asked for a logo,
add a logo page. A new document for pages starts with create_document and one
tab whose template is "blank-illustration" (then write_article or change_pages
on it); the Illustrate templates (article, slide-deck, logo-design, ...) start
from ready-made pages. A layout's elements hold sample text: read_document with
view "pages" lists each page's elements with their refs and text, to replace
with update_document. It also shows each article as Markdown.`;

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
      'update_document mode "ops". Provide template OR elements, not both.',
  );

const themeField = z
  .string()
  .optional()
  .describe(
    'Preset theme id that paints the whole diagram + canvas. One of: ' +
      `${themeIds}. Omit per-element colours and let the theme own them. ` +
      'Defaults to "brand".',
  );

// Graph-first authoring (docs/specs/015-api/mcp-server.md §4.7): the LOW-BURDEN path. Give just the
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
          label: z
            .string()
            .optional()
            .describe(
              `The heading in the box, at most ${GRAPH_LABEL_MAX} characters. A longer label is ` +
                "shortened at a word boundary and its full text is kept in the node's note. " +
                'The box is sized to fit the label.',
            ),
          shape: z
            .string()
            .optional()
            .describe(
              `Shape kind (${shapeKinds}); default "square". Use "diamond" for a ` +
                'decision, "cylinder" for a datastore, "stadium" for start/end.',
            ),
          note: z
            .string()
            .optional()
            .describe(
              'Detail behind the heading: longer explanation, context or a description. ' +
                "Stored as the element's note, which the editor shows on the element.",
            ),
          group: z
            .string()
            .optional()
            .describe(
              "Id of the group this node sits in; the same as listing it in that group's members.",
            ),
        }),
      )
      .min(1)
      .describe('The nodes (boxes). Each needs a unique id.'),
    edges: z
      .array(
        z.object({
          from: z.string().describe('Source node or group id.'),
          to: z.string().describe('Target node or group id.'),
          label: z
            .string()
            .optional()
            .describe(`Optional text on the arrow, at most ${GRAPH_LABEL_MAX} characters.`),
        }),
      )
      .describe('Directed connections between ids. An edge to an unknown id is dropped.'),
    groups: z
      .array(
        z.object({
          id: z.string().describe('Unique id (an edge may point at a group).'),
          label: z.string().optional().describe("The group's heading, drawn on its frame."),
          members: z
            .array(z.string())
            .optional()
            .describe('The node ids inside this group (or set "group" on each node).'),
        }),
      )
      .optional()
      .describe(
        'Named clusters (e.g. "Frontend", "Backend"): each is drawn as a frame around its ' +
          'members and laid out as one block.',
      ),
    direction: z
      .enum(['down', 'right'])
      .optional()
      .describe(
        'Flow direction: "down" (top to bottom) or "right" (left to right). Default: auto.',
      ),
    style: z
      .enum(['flow', 'tree', 'mindmap'])
      .optional()
      .describe(
        'Layout: "flow" (layered, the default; the layout for processes and systems), "tree" ' +
          '(a tidy hierarchy, the layout for org charts), "mindmap" (radial around the first ' +
          'node). With groups the layout is flow.',
      ),
    lines: z
      .enum(['straight', 'angled', 'curved'])
      .optional()
      .describe('Arrow routing. Default: straight for flow, angled for tree, curved for mindmap.'),
  })
  .optional()
  .describe(
    'A node/edge graph the server turns into laid-out boxes + arrows — the ' +
      'easiest way to author. Provide one of graph, mermaid, elements or template.',
  );

// The same graph as Mermaid (docs/specs/015-api/mcp-server.md §4.7): parsed by the editor's own
// importer, so a model can write the notation it already knows.
const mermaidField = z
  .string()
  .optional()
  .describe(
    'The diagram as Mermaid text: a flowchart (graph / flowchart, with subgraphs), a state ' +
      'diagram (stateDiagram) or an ER diagram (erDiagram). Parsed into the same graph as the ' +
      '"graph" input: subgraphs become groups, the direction is kept, and the same label limit ' +
      'applies. Provide one of graph, mermaid, elements or template.',
  );

export const findDocumentsShape = {
  query: z.string().optional().describe('Only documents whose name contains this text.'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

// What read_document fits every view to unless told otherwise (docs/specs/024-agents/document-views.md
// "Budgets", VW45).
export const READ_DOCUMENT_DEFAULT_BUDGET = 8000;

export const readDocumentShape = {
  documentId: z.string().describe('The document id (from find_documents).'),
  tabId: z.string().optional().describe('Which tab to read; defaults to the first.'),
  view: z
    .enum(TAB_VIEW_NAMES)
    .optional()
    .describe(
      'How to read the tab. outline (default): one line per element with its ref, label and arrows, ' +
        'nested by frame. graph: what connects to what. layout: where things sit. comments: open threads ' +
        'in full. show: one element in full (needs ref). find: elements holding some text (needs q). ' +
        "pages: an Illustrate tab's pages with their rectangles, each article as Markdown, and the layouts on offer.",
    ),
  budget: z
    .number()
    .int()
    .min(1)
    .max(VIEW_BUDGET_MAX)
    .optional()
    .describe(
      `Fit the view to about this many tokens (default ${READ_DOCUMENT_DEFAULT_BUDGET}); the last line says what was left out and how to see it.`,
    ),
  only: z
    .string()
    .min(1)
    .max(REF_INPUT_MAX_LENGTH)
    .optional()
    .describe('outline, layout: one element (a ref from a view) and what nests under it.'),
  ref: z
    .string()
    .min(1)
    .max(REF_INPUT_MAX_LENGTH)
    .optional()
    .describe('show: the element, by the ref a view printed, any unique prefix, or its id.'),
  q: z
    .string()
    .min(1)
    .max(FIND_QUERY_MAX_LENGTH)
    .optional()
    .describe('find: the text to look for, case-insensitive.'),
  coarse: z.boolean().optional().describe('layout: rows per frame instead of coordinates.'),
  all: z.boolean().optional().describe('comments: include resolved threads.'),
  style: z
    .boolean()
    .optional()
    .describe('outline: add the colours and line styles that differ from the defaults.'),
  format: z
    .enum(['view', 'json'])
    .optional()
    .describe("view (default) returns the text view; json returns the tab's elements as stored."),
  image: z
    .boolean()
    .optional()
    .describe('Also attach a PNG preview of the tab (costs about a thousand tokens).'),
};

// A document or tab name (docs/specs/006-document/name-length.md). Shortened with
// the same truncateName the api worker applies, so the name a tool reports back
// is the one stored; the cap is stated for the model in the description.
const nameField = (what: string, schema: z.ZodString = z.string()) =>
  schema
    .describe(
      `${what} Keep it short: at most ${NAME_MAX_LENGTH} characters. A longer name is ` +
        'shortened at a word boundary with an ellipsis.',
    )
    .transform(truncateName);

const tabShape = z.object({
  name: nameField('Name of the tab.'),
  graph: graphField,
  mermaid: mermaidField,
  elements: elementArray.optional(),
  template: templateField,
});

export const createDocumentShape = {
  name: nameField('Name for the new document.'),
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
        'document in one call (e.g. an overview tab plus a detail tab per subsystem).',
    ),
  tab: tabShape.optional().describe('A single tab — accepted as an alias for tabs: [tab].'),
  layout: layoutField,
  theme: themeField,
  // Making a document is a use (docs/specs/015-api/mcp-server.md §4.3).
  markUsed: z
    .boolean()
    .optional()
    .describe(
      "Whether this document joins the user's Jump back in (their most used and recent documents) " +
        'at once. Default true. Pass false when making many documents in one go, so a batch ' +
        "never pushes the user's own work out of reach.",
    ),
};

export const addTabShape = {
  documentId: z
    .string()
    .describe('The document to add a tab to (from find_documents / read_document).'),
  name: nameField('Name of the new tab.'),
  graph: graphField,
  mermaid: mermaidField,
  elements: elementArray.optional(),
  template: templateField,
  layout: layoutField,
  theme: themeField,
};

export const updateDocumentShape = {
  documentId: z.string().describe('The document to edit (from find_documents / read_document).'),
  tabId: z.string().optional().describe('Which tab to edit; defaults to the first.'),
  mode: z.enum(['replace', 'ops']).describe('"replace" the whole tab, or apply granular "ops".'),
  rev: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'ops mode: the tab revision read_document returned. An element a person changed since is then a ' +
        'conflict, never silently overwritten; read again and redo the edit.',
    ),
  graph: graphField,
  mermaid: mermaidField,
  elements: elementArray
    .optional()
    .describe(`Replace mode: the full new element list. ${ELEMENT_SCHEMA_HINT}`),
  layout: layoutField,
  ops: z
    .array(
      z.object({
        op: z
          .enum(['add', 'update', 'remove'])
          .describe('"add" a new element, "update" fields of an existing one, or "remove" one.'),
        element: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'add: the full new element, with a unique id. update: only the fields to change, ' +
              'merged over the existing element. Not used by remove. Same format as "elements".',
          ),
        elementId: z
          .string()
          .optional()
          .describe(
            'update / remove: the existing element to change, by its id or the ref read_document prints.',
          ),
      }),
    )
    .optional()
    .describe('ops mode: ordered add / update / remove against existing elements, by id or ref.'),
};

export const shareDocumentShape = {
  documentId: z.string().describe('The document to share (from find_documents / read_document).'),
  role: z
    .enum(['view', 'participate', 'edit'])
    .optional()
    .describe(
      'What the link grants. "participate" (default): recipients add stickies, write and vote ' +
        'but cannot reshape it; right for a retro or a workshop. "view": they only look, ' +
        'with no comments or votes. "edit": they can change anything. No sign-in is needed to open any.',
    ),
  expiry: z
    .enum(['never', 'week', 'month', 'sixMonths'])
    .optional()
    .describe('When the link stops working. Defaults to "never" (until revoked).'),
};

export const deleteDocumentShape = {
  documentId: z.string().describe('The document to delete (from find_documents / read_document).'),
  tabId: z
    .string()
    .optional()
    .describe(
      'Delete only this ONE tab instead of the whole document. A document must keep at ' +
        'least one tab, so deleting the last remaining tab is refused. A tab is deleted ' +
        'outright; it does not go to the Trash.',
    ),
};

// The Trash (docs/specs/013-workspace/trash.md): restore one document by id.
export const restoreDocumentShape = {
  documentId: z.string().describe('The document to restore (from list_trash).'),
};

// Listing the Trash takes no arguments: it is everything the user may restore.
export const listTrashShape = {};

export const renameDocumentShape = {
  documentId: z.string().describe('The document to rename (from find_documents / read_document).'),
  name: nameField('The new name.', z.string().min(1)),
  tabId: z
    .string()
    .optional()
    .describe('Rename this tab within the document instead of the document itself.'),
};
