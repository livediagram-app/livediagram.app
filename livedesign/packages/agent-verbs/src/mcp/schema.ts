// The element-schema MCP resource (docs/specs/015-api/mcp-server.md §4.5) + the tools' zod input shapes.
// Element types + anchors come from packages/design (single source of truth);
// the design rules are curated guidance. The element STRUCTURE is carried inline
// on every tool argument that takes elements (ELEMENT_SCHEMA_HINT) so the whole
// format is available from the tool definition itself, with no second lookup to
// make. It states that completeness as a fact about the tools rather than as a
// rule for the caller: a description that tells a model how to behave, or steers
// it away from other tools, is a connector-listing flag (docs/specs/015-api/mcp-server.md §4.15).
// isValidTab in the design package stays the runtime guard, so
// the structure still lives in one authoritative place (this string is guidance,
// not a second validator).
import { z } from 'zod';
import { findArchived } from './archive-tools';
import {
  FIND_QUERY_MAX_LENGTH,
  REF_INPUT_MAX_LENGTH,
  TAB_VIEW_NAMES,
  VIEW_BUDGET_MAX,
} from '@livedesign/api-schema';
import { FINISHES, type Finish, NAME_MAX_LENGTH, THEMES, truncateName } from '@livedesign/design';
import { themeIds, ELEMENT_SCHEMA_HINT } from './element-docs';
export { SCHEMA_RESOURCE_URI, elementSchemaDoc, SERVER_INSTRUCTIONS } from './element-docs';

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
      'update_design mode "ops". Provide template OR elements, not both.',
  );

// A theme id the server knows: an unknown one (a typo, a label such as "Ocean") was taken silently as
// the default scheme, so the answer claimed a theme the pages never wore.
const themeId = z.string().refine((id) => THEMES.some((t) => t.id === id), {
  message: `Unknown theme. One of: ${themeIds}.`,
});

const themeField = themeId
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

export const findDesignsShape = {
  query: z
    .string()
    .optional()
    .describe(
      "Only designs whose name, or whose folder's name, contains each word of this text (any case).",
    ),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
  archived: findArchived,
};

// What read_design fits every view to unless told otherwise (docs/specs/024-agents/design-views.md
// "Budgets", VW45).
export const READ_DESIGN_DEFAULT_BUDGET = 8000;

// The longest edit-operations text update_design takes: room for a few hundred lines.
const EDITS_MAX_CHARS = 40_000;

export const readDesignShape = {
  designId: z.string().describe('The design id (from find_designs).'),
  tabId: z.string().optional().describe('Which tab to read; defaults to the first.'),
  view: z
    .enum([...TAB_VIEW_NAMES, 'components'])
    .optional()
    .describe(
      'How to read the tab. outline (default): one line per element with its ref, label and arrows, ' +
        'nested by frame. graph: what connects to what. layout: where things sit. comments: open threads ' +
        'in full. show: one element in full (needs ref). find: elements holding some text (needs q). ' +
        "pages: a Pages tab's pages with their rectangles and the layouts on offer. components: the design's " +
        'components (not one tab): each main with its id, frame and elements, the ids componentOverrides takes.',
    ),
  budget: z
    .number()
    .int()
    .min(1)
    .max(VIEW_BUDGET_MAX)
    .optional()
    .describe(
      `Fit the view to about this many tokens (default ${READ_DESIGN_DEFAULT_BUDGET}); the last line says what was left out and how to see it.`,
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

// A design or tab name (docs/specs/006-design/name-length.md). Shortened with
// the same truncateName the api worker applies, so the name a tool reports back
// is the one stored; the cap is stated for the model in the description.
const nameField = (what: string, schema: z.ZodString = z.string()) =>
  schema
    .describe(
      `${what} Keep it short: at most ${NAME_MAX_LENGTH} characters. A longer name is ` +
        'shortened at a word boundary with an ellipsis.',
    )
    .transform(truncateName);

export const createDesignTab = z.object({
  name: nameField(
    'Name of the tab. Optional with a template (its own first tab name is used); otherwise "Tab n".',
  ).optional(),
  elements: elementArray.optional(),
  template: templateField,
  theme: themeId
    .optional()
    .describe('This tab’s theme, one of the theme ids above; the design’s theme when left out.'),
});

export const createDesignShape = {
  name: nameField('Name for the new design.'),
  // `tabs` is preferred; `tab` is accepted as an alias for a single tab so a
  // client with a stale cached schema (or one that just sends `tab`) still works
  // — provide one or the other.
  tabs: z
    .array(createDesignTab)
    .min(1)
    .max(20)
    .optional()
    .describe(
      'One or more tabs, each with its own pages. Preferred — pass several to create a multi-tab ' +
        'design in one call (e.g. a logo and the wireframes that use it).',
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
  // Making a design is a use (docs/specs/015-api/mcp-server.md §4.3).
  markUsed: z
    .boolean()
    .optional()
    .describe(
      "Whether this design joins the user's Most Used and Recent on Home (their most used and recent designs) " +
        'at once. Default true. Pass false when making many designs in one go, so a batch ' +
        "never pushes the user's own work out of reach.",
    ),
};

export const addTabShape = {
  designId: z.string().describe('The design to add a tab to (from find_designs / read_design).'),
  name: nameField('Name of the new tab.'),
  elements: elementArray.optional(),
  template: templateField,
  layout: layoutField,
  theme: themeField,
  finish: finishField,
};

export const updateDesignShape = {
  designId: z.string().describe('The design to edit (from find_designs / read_design).'),
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
      'ops mode: the tab revision read_design returned. An element a person changed since is then a ' +
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
            'update / remove: the existing element to change, by its id or the ref read_design prints.',
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
        '(puts a node on the a→b arrow and makes room); wrap <sel…> in frame [label=…] [tidy]; unwrap ' +
        '<frame>; detach <instance> (a component instance becomes plain elements); order <sel> front|back; layout <sel> [style=flow|tree|mindmap] [direction=down|right]. ' +
        'Selectors: a ref or id, "Label text", type:sticky, shape:diamond, in:<frame>, a->b, from:<x>, to:<x>, ' +
        'downstream:<x>. Placement: right-of:<x> left-of:<x> above:<x> below:<x> [gap:<n>], after:<x>, ' +
        'inside:<frame>, align:<x>, at:x,y; inside:<frame> right-of:<x> places beside x in that frame. A box placed ' +
        'beside one inside a frame joins it (the frame grows); to stay outside, place it against the ' +
        'frame itself (below:<frame>), with align:<x> to line it up with a member (below:<frame> align:<x>). ' +
        'Keys: label= note= shape= fill=theme|red|orange|yellow|green|blue|' +
        'violet (a sticky: classic|lemon|peach|rose|lilac|sky|mint|teal|slate) text=sm|md|lg border=solid|dashed|' +
        'dotted line=…, or any stored field by name. Values with spaces are quoted: label="Sign in". ' +
        'Coordinates are relative to the content origin, as the layout view prints them.',
    ),
};

export const shareDesignShape = {
  designId: z.string().describe('The design to share (from find_designs / read_design).'),
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

export const deleteDesignShape = {
  designId: z.string().describe('The design to delete (from find_designs / read_design).'),
  tabId: z
    .string()
    .optional()
    .describe(
      'Delete only this ONE tab instead of the whole design. A design must keep at ' +
        'least one tab, so deleting the last remaining tab is refused. A tab is deleted ' +
        'outright; it does not go to the Trash.',
    ),
};

// The Trash (docs/specs/013-workspace/trash.md): restore one design by id.
export const restoreDesignShape = {
  designId: z.string().describe('The design to restore (from list_trash).'),
};

// Listing the Trash takes no arguments: it is everything the user may restore.
export const listTrashShape = {};

export const renameDesignShape = {
  designId: z.string().describe('The design to rename (from find_designs / read_design).'),
  name: nameField('The new name.', z.string().min(1)),
  tabId: z
    .string()
    .optional()
    .describe('Rename this tab within the design instead of the design itself.'),
};
