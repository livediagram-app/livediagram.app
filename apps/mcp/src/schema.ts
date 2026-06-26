// The element-schema MCP resource (spec/62 §4.5) + the tools' zod input shapes.
// Element types + anchors come from packages/diagram (single source of truth);
// the design rules are curated guidance. Tool element arrays stay permissive
// here — the real structural check is the diagram package's isValidTab at the
// tool boundary, so the schema lives in one place.
import { z } from 'zod';
import { ANCHORS, ELEMENT_TYPES } from '@livediagram/diagram';

export const SCHEMA_RESOURCE_URI = 'livediagram://schema/elements';

export function elementSchemaDoc(): string {
  const types = [...ELEMENT_TYPES].join(', ');
  const anchors = [...ANCHORS].join(', ');
  return `# livediagram element schema

A tab is { name, elements: Element[] }. Every element needs a unique string "id".

## Element types
${types}

Boxed elements (shape, text, sticky, table, image, annotation) carry:
  id, type, x, y, width, height, and an optional "label" (string).
  - "shape" also needs "shape": square, rectangle, circle, ellipse, diamond,
    triangle, cylinder, cloud, hexagon, parallelogram, star, and more, plus
    "frame" (a section container drawn behind its contents). Unknown shape kinds
    fall back to a rounded box rather than being dropped.
  - "text" is a label-only element (no fill / border).

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

## Design rules (diagrams that read well)
- Do NOT set colours. The theme owns fill / stroke / text colour; omit them and
  the diagram inherits a coherent palette.
- Size sibling nodes consistently (e.g. every box 160x64).
- Prefer pinned arrows (node -> node) so they track their shapes when moved.
- Give every node an id and a short, clear label.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (spec/62 §4.5).
export const SERVER_INSTRUCTIONS = `Tools to find, view, create, and edit the user's livediagram diagrams.
The calling model produces the diagram elements AND decides their layout; this
server validates, persists, and renders them, and only auto-arranges the graph
when you ask it to (or leave nodes unplaced). Read the ${SCHEMA_RESOURCE_URI}
resource before creating or updating: use a unique "id" per element, position
elements yourself for a deliberate shape (a cycle as a ring, a tree, a grid),
prefer pinned arrows (node -> node), and do NOT set colours — the theme owns them.`;

// --- Tool input shapes (ZodRawShape). Element arrays are permissive; isValidTab
// is the real guard, so there's no second schema to drift. ---

const elementArray = z.array(z.record(z.string(), z.unknown()));

const layoutField = z
  .enum(['auto', 'preserve'])
  .optional()
  .describe(
    'How to position elements. "preserve" keeps the exact x/y you give — use it for a deliberate shape (a cycle as a ring, a tree, a grid). "auto" arranges a clean directed graph for you. Omit to auto-detect: a real arrangement is kept; nodes left piled at one point get laid out. Supporting text is always kept in place either way.',
  );

export const findDiagramsShape = {
  query: z.string().optional().describe('Only diagrams whose name contains this text.'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

export const readDiagramShape = {
  diagramId: z.string().describe('The diagram id (from find_diagrams).'),
  tabId: z.string().optional().describe('Which tab to read; defaults to the first.'),
};

export const createDiagramShape = {
  name: z.string().describe('Name for the new diagram.'),
  tab: z
    .object({
      name: z.string().describe('Name of the tab.'),
      elements: elementArray.describe('The elements (see the schema resource).'),
    })
    .describe('The single tab to create.'),
  layout: layoutField,
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
