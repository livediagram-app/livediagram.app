// draw.io's "Export as JSON" (docs/specs/020-import-export/drawio-import.md "The JSON export"):
// `{ version, pages: [{ id, name, cells }], data? }`. With `data` holding the full mxfile, that file
// is the diagram. Otherwise the cells carry only the graph (nodes, edges, layers; no geometry, no
// style), which is laid out by the layered layout Mermaid import uses.

import {
  layoutClusteredGraph,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementLink,
  type GraphEdge,
  type GraphNode,
} from '@livediagram/document';
import { DRAWIO_JSON_LOOSE_EDGE_PX } from './limits';
import { DrawioRefused } from './refusals';
import { readLabel } from './label';
import { elementLink, type ConvertContext } from './vertex-props';

type JsonCell = {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  html?: unknown;
  source?: unknown;
  target?: unknown;
  metadata?: { link?: unknown } | null;
};

export type JsonExportPage = { id: string; name: string; cells: JsonCell[] };

export type JsonExport = { kind: 'xml'; text: string } | { kind: 'graph'; pages: JsonExportPage[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** The export's pages, or the full diagram its `data` carries. Refuses anything else. */
export function readJsonExport(text: string): JsonExport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DrawioRefused('not-xml');
  }
  if (!isObject(raw) || !Array.isArray(raw.pages)) throw new DrawioRefused('not-xml');
  if (typeof raw.data === 'string' && raw.data.trimStart().startsWith('<mxfile')) {
    return { kind: 'xml', text: raw.data };
  }
  const pages = raw.pages.filter(isObject).map((p, i) => ({
    id: typeof p.id === 'string' && p.id ? p.id : `page-${i + 1}`,
    name: typeof p.name === 'string' ? p.name : '',
    cells: Array.isArray(p.cells) ? (p.cells.filter(isObject) as JsonCell[]) : [],
  }));
  if (pages.length === 0) throw new DrawioRefused('no-pages');
  return { kind: 'graph', pages };
}

/**
 * A draw.io HTML label as plain text, read by the same inert `DOMParser` walk as every other label
 * (`readLabel`): `br` and block ends become new lines, entities decode once, scripts and styles are
 * skipped, runs of blank lines collapse, the ends are trimmed. The result is text, never markup.
 */
export function jsonLabelText(html: string): string {
  return readLabel(html, true).plain;
}

const isHtml = (html: unknown) => html !== 0 && html !== '0' && html !== false;
const labelOf = (cell: JsonCell) => {
  const raw = typeof cell.label === 'string' ? cell.label : '';
  return isHtml(cell.html) ? jsonLabelText(raw) : raw;
};

// An edge with exactly one end on a node: drawn from (or to) that node, its other end free.
type LooseEdge = { nodeId: string; free: 'to' | 'from'; label: string };

// The loose edge as an arrow: pinned on the node's facing side, the free end a short way out.
function looseArrow(edge: LooseEdge, node: BoxedElement): ArrowElement {
  const y = node.y + node.height / 2;
  const pinned = {
    kind: 'pinned' as const,
    elementId: node.id,
    anchor: edge.free === 'to' ? ('e' as const) : ('w' as const),
  };
  const free =
    edge.free === 'to'
      ? { kind: 'free' as const, x: node.x + node.width + DRAWIO_JSON_LOOSE_EDGE_PX, y }
      : { kind: 'free' as const, x: node.x - DRAWIO_JSON_LOOSE_EDGE_PX, y };
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: edge.free === 'to' ? pinned : free,
    to: edge.free === 'to' ? free : pinned,
    ...(edge.label ? { label: edge.label } : {}),
  };
}

/**
 * One graph-only page as laid-out elements: nodes as boxes, edges between them as connections. Ids
 * are minted fresh. Links follow the XML path's rule (web and email, and pages of the same export as
 * tab links). An edge with one end on a node keeps it, its free end drawn a short way out; an edge
 * with neither is left out. Both count as loosened connections.
 */
export function jsonPageElements(page: JsonExportPage, ctx: ConvertContext): Element[] {
  const ids = new Map<string, string>();
  const links = new Map<string, ElementLink>();
  const nodes: GraphNode[] = [];
  for (const cell of page.cells) {
    if (cell.type !== 'node' || typeof cell.id !== 'string') continue;
    const id = crypto.randomUUID();
    ids.set(cell.id, id);
    const raw = typeof cell.metadata?.link === 'string' ? cell.metadata.link : undefined;
    const link = elementLink(raw, ctx);
    if (link) links.set(id, link);
    const label = labelOf(cell);
    nodes.push({ id, ...(label ? { label } : {}) });
  }
  const edges: GraphEdge[] = [];
  const loose: LooseEdge[] = [];
  for (const cell of page.cells) {
    if (cell.type !== 'edge') continue;
    const from = typeof cell.source === 'string' ? ids.get(cell.source) : undefined;
    const to = typeof cell.target === 'string' ? ids.get(cell.target) : undefined;
    const label = labelOf(cell);
    if (from && to) edges.push({ from, to, ...(label ? { label } : {}) });
    else if (from) loose.push({ nodeId: from, free: 'to', label });
    else if (to) loose.push({ nodeId: to, free: 'from', label });
    ctx.tally.add('connection-loosened', from && to ? 0 : 1);
  }
  if (nodes.length === 0) return [];
  ctx.tally.add('auto-layout');
  const laid = layoutClusteredGraph({ nodes, edges }).map((el) => {
    const link = links.get(el.id);
    return link ? { ...el, link } : el;
  });
  const boxes = new Map(
    laid.filter((el): el is BoxedElement => el.type !== 'arrow').map((el) => [el.id, el]),
  );
  return [...laid, ...loose.map((edge) => looseArrow(edge, boxes.get(edge.nodeId)!))];
}
