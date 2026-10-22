// The element-schema MCP resource (docs/specs/015-api/mcp-server.md §4.5) + the tools' zod input shapes.
// Element types + anchors come from packages/project (single source of truth);
// the design rules are curated guidance. The element STRUCTURE is carried inline
// on every tool argument that takes elements (ELEMENT_SCHEMA_HINT) so the whole
// format is available from the tool definition itself, with no second lookup to
// make. It states that completeness as a fact about the tools rather than as a
// rule for the caller: a description that tells a model how to behave, or steers
// it away from other tools, is a connector-listing flag (docs/specs/015-api/mcp-server.md §4.15).
// isValidTab in the project package stays the runtime guard, so
// the structure still lives in one authoritative place (this string is guidance,
// not a second validator).
import { z } from 'zod';
import { METRIC_KINDS, PLAN_VISUALISATIONS } from '@liveplanner/items';
import {
  FIND_QUERY_MAX_LENGTH,
  REF_INPUT_MAX_LENGTH,
  TAB_VIEW_NAMES,
  VIEW_BUDGET_MAX,
} from '@liveplanner/api-schema';
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
  ENTITY_MAX_FIELDS,
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
} from '@liveplanner/project';

export const SCHEMA_RESOURCE_URI = 'liveplanner://schema/elements';

const types = [...ELEMENT_TYPES].join(', ');
const anchors = [...ANCHORS].join(', ');
const shapeKinds = [...SHAPE_KINDS].join(', ');
const themeIds = THEMES.map((t) => t.id).join(', ');

// The content fields of the kinds that carry content (docs/specs/015-api/mcp-server.md §4.7a), as
// facts. One copy, shared by the tool argument and the schema resource; the
// vocabularies come from packages/project so they can't drift.
const stickyPairs = STICKY_PRESETS.map((p) => `${p.name.toLowerCase()} ${p.fill}/${p.text}`).join(
  ', ',
);
const CONTENT_KINDS =
  'Content-carrying kinds: ' +
  'type "sticky": a note whose "label" is its text; the theme never recolours it, so its own ' +
  `"fillColor" + "textColor" are kept (palette pairs, fill/text: ${stickyPairs}); unset it is ` +
  'the classic amber note. ' +
  'type "image": an empty picture placeholder; liveplanner keeps no uploaded pictures, so it takes no ' +
  '"imageId" (one is refused); "alt" describes what it stands for. ' +
  'type "table": "cells" is rows of strings (ragged rows are padded), "headerRow" / ' +
  '"headerColumn" style the first row / column, "zebra" tints alternate rows. ' +
  `shape "code-block": "code" (up to ${CODE_MAX_LENGTH} chars), "codeLanguage" (` +
  `${CODE_LANGUAGES.join(', ')}), "codeTheme" (${CODE_THEMES.map((t) => t.id).join(', ')}; ` +
  'default midnight, dark), "codeWrap"; the block draws itself and shows no label. ' +
  'shape "entity": "label" is the title, "entityFields" is [{ "name", "type"?, "key"? }] rows (up to ' +
  `${ENTITY_MAX_FIELDS}; "key" is "pk", "fk", "pk-fk" or "uk"); the box grows to fit its rows. A pinned ` +
  'arrow end on an entity may add "field": a row index, with anchor "w" or "e", to join that field. ' +
  'shape "lane": a swimlane whose "label" is the title in its left strip; elements fully inside ' +
  'its box belong to it, lanes are placed one under another, and they paint behind everything. ' +
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
  // The diagram-building kinds (docs/specs/015-api/mcp-server.md §4.7a).
  'shape "card": a node with a title, meta line and body; "pageTitle" is the title, "pageSubtitle" ' +
  'the meta (a product or runtime), "label" the body, "cardMedia" + "iconId" the glyph (a badge disc, a ' +
  `tile or an initial), "cardHeader" true for a coloured header band, "tags" up to ${CARD_TAGS_MAX} short ` +
  'facts. Use cards for service and component nodes. "callout" is accepted and stored as a card. ' +
  '"accentEdge" on a square, stadium or card draws a coloured strip on that side. ' +
  `shape "badge": a small label pill (up to ${BADGE_LABEL_MAX} chars); shape "step": a numbered disc ` +
  `("label" the number, up to ${STEP_LABEL_MAX} chars). Both take "chipLook"; with "attachedTo" (a node id) ` +
  'and "attachAt" they sit on that point of the node and move, copy and delete with it; no x / y needed. ' +
  'shape "boundary": a titled container ("label" the title, "pageSubtitle" a meta line such as a CIDR, ' +
  '"iconId" in its tab); elements whose centre is inside it belong to it; nest them for edge, region, ' +
  'VPC and subnet, "boundaryStyle" inset for a nested one, c4 for a C4 diagram. ' +
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
  'shape "diagram-key": a legend of the tab\'s arrow line styles and tag colours; its rows fill in by ' +
  'themselves, "keyMeanings" maps a row id ("line:dashed", "tag:<tag>") to what it means. ' +
  'shape "stack": a container that lines up the elements whose centre is inside it; "stackDirection", ' +
  '"stackColumns" (2 to 6, grid), "stackGap" and "stackPadding" (0 to 64), "stackAlign"; place children ' +
  'anywhere inside and the editor lays them out. ' +
  'shape "sequence": a UML sequence diagram in one element; "sequenceParticipants" is [{ "id", "label", ' +
  '"actor"? }] (2 to 12, left to right), "sequenceMessages" [{ "from", "to", "label", "kind": call | async | ' +
  'reply }] (up to 60, top to bottom, from === to a self-call), "sequenceNumbered" true numbers them. It lays ' +
  'itself out; prefer it over loose shapes and arrows for a sequence diagram you will edit.';

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
  'success, warning, danger, highlight); "iconId" with "iconPosition"; "note" (detail ' +
  'shown on the element); on an arrow "label", ' +
  '"strokeStyle", "arrowEnds", "arrowheadShape" (an ER line\u2019s ends: one, zero-or-one, many, zero-or-many, ' +
  'one-or-many), "arrowheadStartShape" (the start\u2019s, when it differs: a one at one table, a many at the ' +
  'other). A field a type ' +
  'does not have, or a value off its list, is refused naming what it takes. ' +
  'Facilitation kinds and what they hold: "session-button" a "session" ({"tool": "timer" with "minutes", ' +
  '"stopwatch", or "vote" with "dots"}), drawn as what pressing it does ' +
  'unless it has a label; "checklist" its "checklistItems" ' +
  '([{"text", "done"}]); a stat row its "stats" ([{"value", "caption"}]); a callout its "pageTitle" over its "label" ' +
  '(the body); a banner its "pageTitle" and "pageSubtitle"; "sticker" a "stickerId" (an emoji- id). The entries of a "temperature" check ' +
  'are the people\u2019s, never an edit\u2019s. ';

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
  '). A hand-drawn board starts from the "whiteboard" template, a tab in Draw mode: underline a ' +
  'heading, ring a word or draw a doodle with a few strokes, a point every 10 to 20 px along a ' +
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
  return `# liveplanner element schema

A tab is { name, elements: Element[] }. Every element needs a unique string "id".
A project has one or more tabs, each its own canvas. create_project makes a
project with one or more tabs at once; add_tab appends another tab to an existing
project (e.g. an overview tab, then a detail tab zooming into one subsystem).

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
Set "theme" on create_project / add_tab to one of these presets and the server
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
tabs in a create_project call.

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
- list_templates has hand-tuned Plan scaffolds (kanban, project planner, bug
  triage, ...) to pass as "template"; a "dashboard" builds a Dashboard tab.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (docs/specs/015-api/mcp-server.md §4.5). Phrased as facts about the server (what it does
// with what you send, and where the format is written down), not as rules for
// the calling model (docs/specs/015-api/mcp-server.md §4.15).
export const SERVER_INSTRUCTIONS = `Tools to find, read, create, add tabs to, change, share, rename, delete (to the Trash) and restore the user's liveplanner projects. A project holds tabs: Board tabs of cards, Sheet tabs (spreadsheets), Dashboard tabs and Form tabs.
list_templates lists the Plan templates (kanban, project-planner, bug-triage, budget-planner, ...):
pass a kind as "template" on create_project or add_tab to start a project or a tab from it. A "dashboard" on
create_project or add_tab makes a Dashboard tab over the project's Board and Sheet tabs by name: metrics, Gantts,
calendars, workload charts and notes, drawn live from the cards. update_project changes a tab's elements, or rebuilds
a Dashboard tab whole; the element format is documented inline on each tool's element argument.
Plan boards hold cards (items), which have their own tools:
list_items reads a project's boards, their columns by name, its cards and its
card types; change_items adds, edits and moves cards, naming columns, card
types, fields and people as the board shows them; add_board puts a board on a
tab (a preset or columns by name) and change_board changes one (title, columns,
the card types it shows); change_card_types adds and edits card types and their
custom fields. A board shows only the card types it takes. Sheets (spreadsheets on a tab) have
theirs: list_sheets lists a project's sheets, read_sheet reads one's cells by A1
(inputs, worked-out values and what they show), change_sheet sets, clears and
formats cells, inserts and deletes rows and columns, sorts, freezes and renames,
and sets dropdowns, checkboxes and other validation rules and conditional formats,
and add_sheet puts a new Sheet on a tab, blank or from rows or CSV text.
Form tabs hold forms (like Google Forms): questions anyone fills in from a link,
without an account, each response a card on a Board tab or a row in a sheet.
add_form makes one (from a starter or questions, in a project of its own when
no projectId is given), change_form changes it, read_form reads it with its
link, state and anything stopping it being published, share_form publishes,
closes or deletes its link, and try_form fills it in as a test response. Asked for a form, survey, sign-up or RSVP, make a
form; its responses are read with list_items (cards) or read_sheet (rows).`;

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
// (@liveplanner/templates) rather than a z.enum, so a new template is one
// catalogue entry with no schema churn; list_templates is the discovery
// surface.
// A new Dashboard tab (docs/specs/026-plan/plan-agents.md "Making a dashboard"), everything named as people name it.
const dashboardField = z
  .object({
    tabs: z
      .union([z.array(z.string()), z.literal('every')])
      .optional()
      .describe(
        'The Board and Sheet tabs it shows, by name (in create_project, other tabs of the same call), or "every"; ' +
          'two to a row.',
      ),
    metrics: z
      .array(z.enum(METRIC_KINDS))
      .optional()
      .describe(
        'Metric tiles, four to a row: count (cards), progress (percent done), people, types, priorities, due ' +
          '(overdue and due soon), unassigned, points (estimates), top-voted, stale.',
      ),
    charts: z
      .array(
        z.object({
          view: z
            .enum(PLAN_VISUALISATIONS)
            .exclude(['status-mix'])
            .describe(
              'gantt, calendar (by due date), start-calendar, workload (cards by a field), priority-matrix ' +
                '(priority by status), search.',
            ),
          groupBy: z
            .string()
            .optional()
            .describe(
              'workload only: assignee (default), type, priority, status, or a field by name.',
            ),
          types: z.array(z.string()).optional().describe('Only these card types, by name.'),
        }),
      )
      .optional()
      .describe('Charts, two to a row; a Gantt takes a row of its own.'),
    notes: z
      .array(
        z.object({
          title: z.string().describe('The note’s heading.'),
          text: z.string().describe('Its text; a line each.'),
        }),
      )
      .optional()
      .describe('Notes, three to a row.'),
  })
  .optional()
  .describe(
    'Make the tab a Plan Dashboard instead of a canvas: rows of the tabs it shows, then metrics, Gantts, other ' +
      'charts and notes, each drawn live from the cards; up to 12 rows. Give it in place of elements or template.',
  );

const templateField = z
  .string()
  .optional()
  .describe(
    'Start from a hand-tuned template scaffold instead of providing elements: a template ' +
      'kind from list_templates (e.g. "kanban", "project-planner", "bug-triage"). The server ' +
      'materialises its curated layout ("layout" is ignored for a template tab) and paints ' +
      'it with the chosen theme. Personalise the placeholder labels afterwards with ' +
      'update_project mode "ops". Provide template OR elements, not both.',
  );

const themeField = z
  .string()
  .optional()
  .describe(
    'Preset theme id that paints the whole diagram + canvas. One of: ' +
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

export const findProjectsShape = {
  query: z.string().optional().describe('Only projects whose name contains this text.'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

// What read_project fits every view to unless told otherwise (docs/specs/024-agents/project-views.md
// "Budgets", VW45).
export const READ_PROJECT_DEFAULT_BUDGET = 8000;

// The longest edit-operations text update_project takes: room for a few hundred lines.
const EDITS_MAX_CHARS = 40_000;

export const readProjectShape = {
  projectId: z.string().describe('The project id (from find_projects).'),
  tabId: z.string().optional().describe('Which tab to read; defaults to the first.'),
  view: z
    .enum(TAB_VIEW_NAMES)
    .optional()
    .describe(
      'How to read the tab. outline (default): one line per element with its ref, label and arrows, ' +
        'nested by frame. graph: what connects to what. layout: where things sit. comments: open threads ' +
        'in full. show: one element in full (needs ref). find: elements holding some text (needs q).',
    ),
  budget: z
    .number()
    .int()
    .min(1)
    .max(VIEW_BUDGET_MAX)
    .optional()
    .describe(
      `Fit the view to about this many tokens (default ${READ_PROJECT_DEFAULT_BUDGET}); the last line says what was left out and how to see it.`,
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

// A project or tab name (docs/specs/006-project/name-length.md). Shortened with
// the same truncateName the api worker applies, so the name a tool reports back
// is the one stored; the cap is stated for the model in the description.
const nameField = (what: string, schema: z.ZodString = z.string()) =>
  schema
    .describe(
      `${what} Keep it short: at most ${NAME_MAX_LENGTH} characters. A longer name is ` +
        'shortened at a word boundary with an ellipsis.',
    )
    .transform(truncateName);

export const createProjectTab = z.object({
  name: nameField(
    'Name of the tab. Optional with a template (its own first tab name is used); otherwise "Tab n".',
  ).optional(),
  elements: elementArray.optional(),
  template: templateField,
  dashboard: dashboardField,
  theme: z
    .string()
    .optional()
    .describe('This tab’s theme, one of the theme ids above; the project’s theme when left out.'),
});

export const createProjectShape = {
  name: nameField('Name for the new project.'),
  // `tabs` is preferred; `tab` is accepted as an alias for a single tab so a
  // client with a stale cached schema (or one that just sends `tab`) still works
  // — provide one or the other.
  tabs: z
    .array(createProjectTab)
    .min(1)
    .max(20)
    .optional()
    .describe(
      'One or more tabs, each its own canvas. Preferred — pass several to create a multi-tab ' +
        'project in one call (e.g. an overview tab plus a detail tab per subsystem).',
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
  // Making a project is a use (docs/specs/015-api/mcp-server.md §4.3).
  markUsed: z
    .boolean()
    .optional()
    .describe(
      "Whether this project joins the user's Jump back in (their most used and recent projects) " +
        'at once. Default true. Pass false when making many projects in one go, so a batch ' +
        "never pushes the user's own work out of reach.",
    ),
};

export const addTabShape = {
  projectId: z
    .string()
    .describe('The project to add a tab to (from find_projects / read_project).'),
  name: nameField('Name of the new tab.'),
  elements: elementArray.optional(),
  template: templateField,
  dashboard: dashboardField,
  layout: layoutField,
  theme: themeField,
  finish: finishField,
};

export const updateProjectShape = {
  projectId: z.string().describe('The project to edit (from find_projects / read_project).'),
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
      'ops mode: the tab revision read_project returned. An element a person changed since is then a ' +
        'conflict, never silently overwritten; read again and redo the edit.',
    ),
  elements: elementArray
    .optional()
    .describe(`Replace mode: the full new element list. ${ELEMENT_SCHEMA_HINT}`),
  dashboard: dashboardField.describe(
    'Replace mode on a Dashboard tab: its tabs, metrics, charts and notes rebuilt whole (the tab keeps its id ' +
      'and name). Only a Dashboard tab takes one.',
  ),
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
            'update / remove: the existing element to change, by its id or the ref read_project prints.',
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
      'ops mode, instead of "ops": edit operations, one a line, applied all or nothing. ' +
        'Operations: add <kind> [id=<id>] key=value… [placement]; set <sel> key=value… ' +
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

export const shareProjectShape = {
  projectId: z.string().describe('The project to share (from find_projects / read_project).'),
  role: z
    .enum(['view', 'participate', 'edit'])
    .optional()
    .describe(
      'What the link grants. "participate" (default): recipients work cards and Sheet cells, comment and vote ' +
        'but cannot reshape a board; right for a retro or a workshop. "view": they only look, ' +
        'with no comments or votes. "edit": they can change anything. No sign-in is needed to open any.',
    ),
  expiry: z
    .enum(['never', 'week', 'month', 'sixMonths'])
    .optional()
    .describe('When the link stops working. Defaults to "never" (until revoked).'),
};

export const deleteProjectShape = {
  projectId: z.string().describe('The project to delete (from find_projects / read_project).'),
  tabId: z
    .string()
    .optional()
    .describe(
      'Delete only this ONE tab instead of the whole project. A project must keep at ' +
        'least one tab, so deleting the last remaining tab is refused. A tab is deleted ' +
        'outright; it does not go to the Trash.',
    ),
};

// The Trash (docs/specs/013-workspace/trash.md): restore one project by id.
export const restoreProjectShape = {
  projectId: z.string().describe('The project to restore (from list_trash).'),
};

// Listing the Trash takes no arguments: it is everything the user may restore.
export const listTrashShape = {};

export const renameProjectShape = {
  projectId: z.string().describe('The project to rename (from find_projects / read_project).'),
  name: nameField('The new name.', z.string().min(1)),
  tabId: z
    .string()
    .optional()
    .describe('Rename this tab within the project instead of the project itself.'),
};
