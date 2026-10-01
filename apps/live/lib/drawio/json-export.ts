// draw.io's "Export as JSON" (docs/specs/020-import-export/drawio-import.md "The JSON export"):
// `{ version, pages: [{ id, name, cells }], data? }`. With `data` holding the full mxfile, that file
// is the diagram. Otherwise the cells carry only the graph (nodes, edges, layers; no geometry, no
// style), which is laid out by the layered layout Mermaid import uses.

import {
  layoutClusteredGraph,
  type Element,
  type GraphEdge,
  type GraphNode,
} from '@livediagram/document';
import type { ReportTally } from './notes';
import { DrawioRefused } from './refusals';

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

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * A draw.io HTML label as plain text: line breaks and block ends become new lines, every other tag
 * goes, entities decode, runs of blank lines collapse, the ends are trimmed.
 */
export function jsonLabelText(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const isHtml = (html: unknown) => html !== 0 && html !== '0' && html !== false;
const followable = (link: string) => /^(https?:|mailto:)/i.test(link);

/**
 * One graph-only page as laid-out elements: nodes as boxes, edges between them as connections. Ids
 * are minted fresh; edges to a node that is not on the page are dropped and counted.
 */
export function jsonPageElements(page: JsonExportPage, tally: ReportTally): Element[] {
  const ids = new Map<string, string>();
  const nodes: GraphNode[] = [];
  for (const cell of page.cells) {
    if (cell.type !== 'node' || typeof cell.id !== 'string') continue;
    const id = crypto.randomUUID();
    ids.set(cell.id, id);
    const raw = typeof cell.label === 'string' ? cell.label : '';
    const label = isHtml(cell.html) ? jsonLabelText(raw) : raw;
    const link = typeof cell.metadata?.link === 'string' ? cell.metadata.link.trim() : '';
    if (link && !followable(link)) tally.add('link-dropped');
    nodes.push({
      id,
      ...(label ? { label } : {}),
      ...(link && followable(link) ? { link } : {}),
    });
  }
  const edges: GraphEdge[] = [];
  for (const cell of page.cells) {
    if (cell.type !== 'edge') continue;
    const from = typeof cell.source === 'string' ? ids.get(cell.source) : undefined;
    const to = typeof cell.target === 'string' ? ids.get(cell.target) : undefined;
    if (!from || !to) {
      tally.add('connection-loosened');
      continue;
    }
    const raw = typeof cell.label === 'string' ? cell.label : '';
    const label = isHtml(cell.html) ? jsonLabelText(raw) : raw;
    edges.push({ from, to, ...(label ? { label } : {}) });
  }
  if (nodes.length === 0) return [];
  tally.add('auto-layout');
  return layoutClusteredGraph({ nodes, edges });
}
