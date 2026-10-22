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
} from '@livedesign/api-schema';
import {
  ANCHORS,
  BADGE_LABEL_MAX,
  CARD_TAGS_MAX,
  ELEMENT_FIELD_VALUES,
  GREY_PEN_COLOUR,
  INK_PEN_COLOUR,
  PEN_COLOUR_NAMES,
  FINISHES,
  type Finish,
  CODE_LANGUAGES,
  CODE_MAX_LENGTH,
  CODE_THEMES,
  ELEMENT_TYPES,
  NAME_MAX_LENGTH,
  SANKEY_LINK_COLORS,
  SANKEY_MAX_FLOWS,
  SANKEY_NAME_MAX,
  SANKEY_UNIT_MAX,
  SANKEY_VALUE_LABELS,
  SHAPE_KINDS,
  STEP_LABEL_MAX,
  STICKY_PRESETS,
  THEMES,
  truncateName,
} from '@livedesign/document';

export const SCHEMA_RESOURCE_URI = 'livedesign://schema/elements';

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
  'type "image": a picture from the user\'s gallery: "imageId" is an id from list_images (one not in the ' +
  'gallery is refused); without it the element is a placeholder the user fills in the editor. "objectFit" ' +
  'contain (default, the whole picture) or cover (fills the box, cropping); "alt" describes it. A box in the ' +
  "picture's own proportions (its width and height from list_images, scaled) shows it uncropped. " +
  'type "table": "cells" is rows of strings (ragged rows are padded), "headerRow" / ' +
  '"headerColumn" style the first row / column, "zebra" tints alternate rows. ' +
  `shape "code-block": "code" (up to ${CODE_MAX_LENGTH} chars), "codeLanguage" (` +
  `${CODE_LANGUAGES.join(', ')}), "codeTheme" (${CODE_THEMES.map((t) => t.id).join(', ')}; ` +
  'default midnight, dark), "codeWrap"; the block draws itself and shows no label. ' +
  'shape "bar-chart" / "pie-chart": "pieSlices" is [{ "label", "value" }]; categories show in ' +
  'the legend. shape "line-chart": "lineCategories" is the x labels, "lineSeries" is ' +
  '[{ "name", "values" }] with one value per category. "chartVariant" picks the chart type: ' +
  'on "bar-chart" "horizontal" draws a Bar chart (absent: upright columns); on "line-chart" "area" ' +
  'fills each series down to zero and "scatter" draws points only, at x = each category read as a ' +
  'number; on "pie-chart" "doughnut" opens the middle. "chartValues": true prints each mark\'s ' +
  "number on the chart (a pie's as percentages when its values add up to 100; a column chart also " +
  'names each column under it, so "chartLegend": false can drop the key). "chartAxis": true draws the value axis, ' +
  'round tick values and gridlines (not on a pie). A "lineSeries" entry with "axis": "right" is drawn against a ' +
  'scale of its own, labelled on the right, so a series in the thousands and one in the tens both read. ' +
  'A chart draws no title (a caption is a ' +
  'separate "text" element) and draws sample data when its data is empty. ' +
  'shape "sankey": a Sankey diagram, bands as wide as the amount they carry, laid out in columns ' +
  'by itself. "sankeyFlows" is [{ "from", "to", "value" }] with node NAMES (the nodes are the ' +
  `names; up to ${SANKEY_MAX_FLOWS} flows, names up to ${SANKEY_NAME_MAX} chars, values above ` +
  'zero; a flow back to an earlier node is hidden, as is one into itself). Options: ' +
  `"sankeyLinkColor" (${SANKEY_LINK_COLORS.join(', ')}; default gradient), "sankeyAlign" ` +
  '(justify: end nodes in the last column, the default; left: each at its own step), ' +
  `"sankeyValueLabel" (${SANKEY_VALUE_LABELS.join(', ')}), "sankeyUnit" (e.g. "£", "kWh"; up ` +
  `to ${SANKEY_UNIT_MAX} chars), "sankeyNodes" [{ "name", "color", "leftover": false }] to colour a node or switch ` +
  'off its own leftover, ' +
  '"sankeyLeftover" (show, the default: a middle node that sends on less than it receives draws ' +
  'the difference to a "Leftover" end node; hide: it does not), "sankeyLeftoverName" (that ' +
  "node's name; do not write leftover flows yourself). Make it " +
  'wide (about 2:1); it draws no title. ' +
  // The building kinds (docs/specs/015-api/mcp-server.md §4.7a).
  'shape "card": a node with a title, meta line and body; "pageTitle" is the title, "pageSubtitle" ' +
  'the meta (a product or runtime), "label" the body, "cardMedia" + "iconId" the glyph (a badge disc, a ' +
  `tile or an initial), "cardHeader" true for a coloured header band, "tags" up to ${CARD_TAGS_MAX} short ` +
  'facts. Use cards for service and component nodes. "callout" is accepted and stored as a card. ' +
  '"accentEdge" on a square, stadium or card draws a coloured strip on that side. ' +
  `shape "badge": a small label pill (up to ${BADGE_LABEL_MAX} chars); shape "step": a numbered disc ` +
  `("label" the number, up to ${STEP_LABEL_MAX} chars). Both take "chipLook"; with "attachedTo" (a node id) ` +
  'and "attachAt" they sit on that point of the node and move, copy and delete with it; no x / y needed. ' +
  'shape "layer-stack" / "pyramid" / "cycle": "conceptRows" is [{ "label", "note"? }]: a stack 2 to 8 ' +
  '(note = a side note), a pyramid 2 to 6 (first row the apex; "pyramidVariant" funnel makes it a ' +
  'funnel and its note the row\'s value), a cycle 3 to 8 clockwise from the top (its "label" is the ' +
  'centre); "hub" 3 to 8 satellites round its "label" ("hubSpokes" false hides the lines), "onion" 2 to 6 ' +
  'rings from the core out, "chevrons" 2 to 8 stages left to right, "timeline-rail" 2 to 8 milestones ' +
  'left to right (label = what, note = when: a date, a quarter). They draw their own rows in the colour ramp; ' +
  'do not draw them from separate shapes. ' +
  // Round 2 (docs/specs/015-api/mcp-server.md §4.7a).
  'shape "pointer-note": a note ("label") with a leader to a tip; "pointerTip" { x, y } is relative to its ' +
  'top-left, or "attachedTo" + "attachAt" pins the tip to that point of a node. ' +
  'shape "stack": a container that lines up the elements whose centre is inside it; "stackDirection", ' +
  '"stackColumns" (2 to 6, grid), "stackGap" and "stackPadding" (0 to 64), "stackAlign"; place children ' +
  'anywhere inside and the editor lays them out.';

// The style fields a box or arrow takes beyond its geometry, as facts (docs/specs/015-api/mcp-server.md §4.7a "Style
// fields"): the closed vocabularies from the one list edit operations and the value check read, so they cannot drift.
const STYLE_FIELDS =
  'Style fields: ' +
  Object.entries(ELEMENT_FIELD_VALUES)
    .map(([key, values]) => `"${key}" (${values.join(', ')})`)
    .join(', ') +
  '; "textBold", "textItalic" (true/false); "colorPreset" (a shape\u2019s look from the theme, its border\u2019s ' +
  'width and style included, so it outranks a "strokeStyle" given with it; ghost and outline are dashed, dotted ' +
  'and dash-dot as named: theme, soft, ' +
  'tinted, solid, bold, ghost, paper, muted, slate, inked, hairline, outline, dotted, dash-dot, frame, info, ' +
  'success, warning, danger, highlight); "iconId" (an id from search_icons) with "iconPosition"; "note" (detail ' +
  'shown on the element); on text, wordmark type: "letterSpacing" (em between letters, -0.2 to 1), ' +
  '"fontWeight" (400, 500, 700), "textCase" (upper, lower), "textArc" (bends one line along a circle, -360 to ' +
  '360 degrees, positive bowing up: a badge\u2019s top line 180, its bottom -180); on an arrow "label", ' +
  '"strokeStyle", "arrowEnds", "arrowheadShape" (an ER line\u2019s ends: one, zero-or-one, many, zero-or-many, ' +
  'one-or-many), "arrowheadStartShape" (the start\u2019s, when it differs: a one at one table, a many at the ' +
  'other). A field a type ' +
  'does not have, or a value off its list, is refused naming what it takes. ' +
  'Kinds and what they hold: "checklist" its "checklistItems" ' +
  '([{"text", "done"}]); a stat row its "stats" ([{"value", "caption"}]); a callout its "pageTitle" over its "label" ' +
  '(the body); a banner its "pageTitle" and "pageSubtitle"; "sticker" a "stickerId" (an emoji- id from search_icons). ';

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
  'legend, never for a node; it is centred in its box, so a left-aligned heading or caption sets ' +
  '"textAlignX": "left". type "freehand" is a HAND-DRAWN stroke: give "points" as canvas ' +
  'coordinates, [[x, y], ...] in drawing order (the box is taken from them), with "closed" true to ' +
  'close and fill the shape, and "penColour" (' +
  `${[INK_PEN_COLOUR, GREY_PEN_COLOUR, ...PEN_COLOUR_NAMES].join(', ')}` +
  '): underline a heading, ring a word or draw a doodle with a few strokes, a point every 10 to 20 px along a ' +
  'curve; an arrow between boxes stays a pinned "arrow", which a "sketch" finish draws by hand and ' +
  'which stays attached. Any box may carry "rotation" in degrees, a small tilt (-4 to 4) reading as ' +
  'placed by hand. type "arrow" needs "from" and "to" endpoints, each ' +
  'either { "kind": "pinned", "elementId", "anchor" } (anchors: ' +
  `${anchors}; preferred, so arrows track their shapes) or ` +
  '{ "kind": "free", "x", "y" }; an arrow may carry a "label". ' +
  'The theme owns fill, stroke, and text colour on every element except a sticky. ' +
  'Any element may carry "finish" ("flexible", "professional", "sketch" or "marker") to be drawn ' +
  'differently from its tab. ' +
  STYLE_FIELDS +
  CONTENT_KINDS;

export function elementSchemaDoc(): string {
  return `# livedesign element schema

A tab is { name, elements: Element[] }, and its pages (logo artboards, wireframe
screens and blank pages) sit on its canvas; an element is on the page whose
rectangle holds it. Every element needs a unique string "id". A document has one
or more tabs. create_document makes a document with one or more tabs at once;
add_tab appends another tab to an existing document. change_pages answers each
page's rectangle, so elements can be placed on it.

## Element types
${types}

Boxed elements (shape, text, sticky, table, image, annotation) carry:
  id, type, x, y, width, height, and an optional "label" (string).
  - "shape" is the element for a NODE — a labelled box, the default building
    block of almost every page. It also needs "shape": one of
    ${shapeKinds}. The default box / process step is "square" (a rounded
    rectangle that fills its width × height) — there is NO "rectangle" kind.
    Use "diamond" for a decision, "cylinder" for a datastore, "stadium" for a
    start/end, "circle", "hexagon", "parallelogram" for I/O, and "frame" for a
    section container. An unknown kind is coerced to "square".
  - "text" is BARE text with no box, fill, or border. Use it ONLY for a
    free-standing title, caption, legend, or note — NEVER for a node. A node
    that has a label is a "shape" with a "label" (use shape: "square"), not a
    "text". Defaulting to "text" for nodes makes a page of floating words
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
paints the pages and their elements with it (you still omit per-element colours):
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

## Design rules (pages that read well)
- Nodes are SHAPES, not text. Use type "shape" (shape: "square" by default,
  "diamond" for a decision, "cylinder" for a datastore) for every box on the
  page. Reserve type "text" for stand-alone titles, captions and running copy.
- Do NOT set colours. The theme owns fill / stroke / text colour; omit them and
  the page inherits a coherent palette. A sticky is the exception: it is not
  themed, so its own fillColor / textColor are kept.
- Size sibling nodes consistently (e.g. every box 160x64).
- Prefer pinned arrows (node -> node) so they track their shapes when moved.
- Give every node an id and a short, clear label.
- For a logo, a set of wireframe screens or another ready-made page,
  list_templates has ready-made pages to pass as "template", then replace their
  sample text with update_document.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (docs/specs/015-api/mcp-server.md §4.5). Phrased as facts about the server (what it does
// with what you send, and where the format is written down), not as rules for
// the calling model (docs/specs/015-api/mcp-server.md §4.15).
export const SERVER_INSTRUCTIONS = `Tools to find, view, create, add tabs to, edit, share, rename, delete (to the Trash) and restore the user's livedesign documents.
A document holds tabs, and each tab holds pages: logo artboards and wireframes. change_pages adds, changes, lays out
(from a ready-made layout), moves, copies and deletes them and answers each page's rectangle on the canvas, where
update_document puts elements. Asked for a logo, add a logo page; asked for a screen, add a wireframe page. A new
document starts with create_document and one tab whose template is "blank-logo" for a logo (one empty artboard;
change_pages adds the rest, each change an object such as {"op": "add", "kind": "logo", "layout": ...}),
"blank-wireframe-phone", "blank-wireframe-browser" or another blank wireframe for screens, or "blank-illustration"
otherwise; the other templates (logo-design, wireframe-mobile-app, wireframe-website, wireframe-dashboard, ...) start
from ready-made pages, and list_templates lists them all. A layout's elements hold sample text: read_document with view "pages" lists
each page's elements with their refs and text, to replace with update_document.
The calling model produces the elements on a page AND decides their layout; this server validates, persists, and
renders them, and only auto-arranges boxes and arrows when you ask it to (or leave nodes unplaced). The full element
format is documented inline on each tool's element argument, so the tool definitions are the complete reference for
it. Each element has a unique "id"; nodes are "shape" elements (a labelled box) NOT "text" (text is only for titles,
captions and running copy); pinned arrows (node -> node) track their boxes; and the theme owns colours (a sticky keeps
its own). Stickies, tables, code blocks and charts carry content fields, documented on each tool's element argument.
search_icons finds icon ids for "iconId"; list_images lists the user's pictures for an image element's "imageId".`;

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
// (@livedesign/templates) rather than a z.enum, so a new template is one
// catalogue entry with no schema churn; list_templates is the discovery
// surface.
const templateField = z
  .string()
  .optional()
  .describe(
    'Start from a template\u2019s ready-made pages instead of providing elements: a template ' +
      'kind from list_templates (e.g. "blank-logo", "logo-design", "wireframe-mobile-app"). The server ' +
      'builds its pages ("layout" is ignored for a template tab) and paints ' +
      'them with the chosen theme. Replace the sample text afterwards with ' +
      'update_document mode "ops". Provide template OR elements, not both.',
  );

const themeField = z
  .string()
  .optional()
  .describe(
    'Preset theme id that paints the pages and their elements. One of: ' +
      `${themeIds}. Omit per-element colours and let the theme own them. ` +
      'Defaults to "brand".',
  );

const finishField = z
  .enum(FINISHES as unknown as [Finish, ...Finish[]])
  .optional()
  .describe(
    'How the tab is drawn (docs/specs/008-canvas/finish.md): "flexible" (the default), "professional" ' +
      '(crisp corners, thin lines, no shadows), "sketch" (hand-drawn pencil lines, hatched fills, a ' +
      'handwriting font) or "marker" (bold felt-tip lines, coloured-in fills, marker lettering). An element ' +
      'can carry its own "finish" too.',
  );

// Icon search (docs/specs/015-api/mcp-server.md §4.5a): the ids "iconId" takes, found by what they show.
export const searchIconsShape = {
  query: z
    .string()
    .min(1)
    .max(60)
    .describe('What the icon shows, in plain words ("database", "load balancer", "aws lambda").'),
  limit: z.number().int().min(1).max(50).optional().describe('At most this many (default 20).'),
};

export const findDocumentsShape = {
  query: z.string().optional().describe('Only documents whose name contains this text.'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

// What read_document fits every view to unless told otherwise (docs/specs/024-agents/document-views.md
// "Budgets", VW45).
export const READ_DOCUMENT_DEFAULT_BUDGET = 8000;

// The longest edit-operations text update_document takes: room for a few hundred lines.
const EDITS_MAX_CHARS = 40_000;

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
        "pages: a Pages tab's pages with their rectangles and the layouts on offer.",
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
    .describe(
      'Also attach a PNG preview of the tab (costs about a thousand tokens). A Pages tab draws as its pages, each as it exports: its background, what reaches onto it, cut at its edges.',
    ),
  page: z
    .union([z.string(), z.number().int().min(1)])
    .optional()
    .describe(
      'With image, on a Pages tab: draw only this page, at its own size (its id, its place 1 first, or its name). Without it every page is drawn, in rows.',
    ),
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

export const createDocumentTab = z.object({
  name: nameField(
    'Name of the tab. Optional with a template (its own first tab name is used); otherwise "Tab n".',
  ).optional(),
  elements: elementArray.optional(),
  template: templateField,
  theme: z
    .string()
    .optional()
    .describe('This tab’s theme, one of the theme ids above; the document’s theme when left out.'),
});

export const createDocumentShape = {
  name: nameField('Name for the new document.'),
  // `tabs` is preferred; `tab` is accepted as an alias for a single tab so a
  // client with a stale cached schema (or one that just sends `tab`) still works
  // — provide one or the other.
  tabs: z
    .array(createDocumentTab)
    .min(1)
    .max(20)
    .optional()
    .describe(
      'One or more tabs, each with its own pages. Preferred — pass several to create a multi-tab ' +
        'document in one call (e.g. a logo and the wireframes that use it).',
    ),
  // The alias is checked against the tab shape by the tool, not listed here a second time: the shape carries the
  // whole element format, and a definition twice its size is one a client's tool search ranks out of sight.
  tab: z
    .unknown()
    .optional()
    .describe('A single tab, shaped as one item of "tabs"; accepted as an alias for tabs: [tab].'),
  layout: layoutField,
  theme: themeField,
  finish: finishField,
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
  elements: elementArray.optional(),
  template: templateField,
  layout: layoutField,
  theme: themeField,
  finish: finishField,
};

export const updateDocumentShape = {
  documentId: z.string().describe('The document to edit (from find_documents / read_document).'),
  tabId: z.string().optional().describe('Which tab to edit; defaults to the first.'),
  mode: z
    .enum(['replace', 'ops', 'edits'])
    .describe(
      '"replace" the whole tab, or change it in place: "ops" (an ops list, or "edits" text); "edits" names the same ' +
        'mode by its text form.',
    ),
  rev: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'ops mode: the tab revision read_document returned. An element a person changed since is then a ' +
        'conflict, never silently overwritten; read again and redo the edit.',
    ),
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
  edits: z
    .string()
    .max(EDITS_MAX_CHARS)
    .optional()
    .describe(
      'ops mode, instead of "ops": edit operations, one a line, applied all or nothing. The language the lint ' +
        'fixes are written in. Operations: add <kind> [id=<id>] key=value… [placement]; set <sel> key=value… ' +
        '[all]; rm <sel> [all] [keep-arrows]; move <sel> <placement>|by=dx,dy; connect <a> -> <b> [label=…] ' +
        '[line=straight|angled|curved]; rewire <arrow> from=<x> to=<y>; insert <kind> key=value… between <a> <b> ' +
        '(puts a node on the a→b arrow and makes room); wrap <sel…> in frame|lane [label=…] [tidy]; unwrap ' +
        '<frame>; order <sel> front|back; layout <sel> [style=flow|tree|mindmap] [direction=down|right]. ' +
        'Selectors: a ref or id, "Label text", type:sticky, shape:diamond, in:<frame>, a->b, from:<x>, to:<x>, ' +
        'downstream:<x>. Placement: right-of:<x> left-of:<x> above:<x> below:<x> [gap:<n>], after:<x>, ' +
        'inside:<frame>, align:<x>, at:x,y; inside:<frame> right-of:<x> places beside x in that frame. A box placed ' +
        'beside one inside a frame or lane joins it (the container grows); to stay outside, place it against the ' +
        'frame itself (below:<frame>), with align:<x> to line it up with a member (below:<frame> align:<x>). ' +
        'Keys: label= note= shape= fill=theme|red|orange|yellow|green|blue|' +
        'violet (a sticky: classic|lemon|peach|rose|lilac|sky|mint|teal|slate) text=sm|md|lg border=solid|dashed|' +
        'dotted line=…, or any stored field by name. Values with spaces are quoted: label="Sign in". ' +
        'Coordinates are relative to the content origin, as the layout view prints them.',
    ),
};

export const shareDocumentShape = {
  documentId: z.string().describe('The document to share (from find_documents / read_document).'),
  role: z
    .enum(['view', 'participate', 'edit'])
    .optional()
    .describe(
      'What the link grants. "participate" (default): recipients comment, react, and add stickies and text, ' +
        'but cannot reshape it; right for feedback on a design. "view": they only look, ' +
        'with no comments. "edit": they can change anything. No sign-in is needed to open any.',
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
