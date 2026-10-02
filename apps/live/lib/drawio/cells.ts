// A draw.io page's cell tree (docs/specs/020-import-export/blueprints/drawio-import.md
// step 7): every mxCell (unwrapped from UserObject / object), its parent and
// children in document order, the layers, and geometry resolved from
// parent-relative to canvas coordinates.

import { readColour } from './colour';
import { parseStyle, type DrawioStyle } from './style';

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type DrawioGeometry = Rect & {
  relative: boolean;
  points: Pt[];
  sourcePoint?: Pt;
  targetPoint?: Pt;
  offset?: Pt;
};

export type DrawioCell = {
  id: string;
  parentId: string | null;
  vertex: boolean;
  edge: boolean;
  /** The label: the `value` attribute, or a wrapper's `label`. */
  value: string;
  html: boolean;
  style: DrawioStyle;
  link?: string;
  tooltip?: string;
  /** A wrapper's custom properties, in attribute order. */
  props: [string, string][];
  visible: boolean;
  collapsed: boolean;
  source?: string;
  target?: string;
  geometry?: DrawioGeometry;
  children: string[];
};

export type DrawioGraph = {
  cells: Map<string, DrawioCell>;
  rootId: string;
  /** The root's children, bottom to top. */
  layerIds: string[];
  background?: string;
  backgroundImage: boolean;
};

// Wrapper attributes that are not custom properties.
const WRAPPER_KEYS = new Set(['id', 'label', 'link', 'tooltip', 'placeholders']);
// Ids other tools write to trace their own objects through a conversion into draw.io: not the
// author's properties, so they fill placeholders but never become note lines.
export const DRAWIO_PROVENANCE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'lucidchartObjectId',
  'visioObjectId',
  'gliffyId',
]);

const num = (el: Element, name: string): number => {
  const n = Number(el.getAttribute(name) ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const point = (el: Element): Pt => ({ x: num(el, 'x'), y: num(el, 'y') });

function readGeometry(cell: Element): DrawioGeometry | undefined {
  const geo = Array.from(cell.children).find(
    (c) => c.localName === 'mxGeometry' && (c.getAttribute('as') ?? 'geometry') === 'geometry',
  );
  if (!geo) return undefined;
  const out: DrawioGeometry = {
    x: num(geo, 'x'),
    y: num(geo, 'y'),
    width: num(geo, 'width'),
    height: num(geo, 'height'),
    relative: geo.getAttribute('relative') === '1',
    points: [],
  };
  for (const child of Array.from(geo.children)) {
    const as = child.getAttribute('as');
    if (child.localName === 'Array' && as === 'points') {
      out.points = Array.from(child.children)
        .filter((p) => p.localName === 'mxPoint')
        .map(point);
    } else if (child.localName === 'mxPoint') {
      if (as === 'sourcePoint') out.sourcePoint = point(child);
      else if (as === 'targetPoint') out.targetPoint = point(child);
      else if (as === 'offset') out.offset = point(child);
    }
  }
  return out;
}

const fillPlaceholders = (label: string, props: [string, string][]) => {
  const byName = new Map(props);
  return label.replace(/%([^%\s]+)%/g, (all, name: string) => byName.get(name) ?? all);
};

function readCell(el: Element): DrawioCell | null {
  let cellEl = el;
  let wrapper: Element | null = null;
  if (el.localName === 'UserObject' || el.localName === 'object') {
    wrapper = el;
    const inner = Array.from(el.children).find((c) => c.localName === 'mxCell');
    if (!inner) return null;
    cellEl = inner;
  } else if (el.localName !== 'mxCell') {
    return null;
  }
  const id = (wrapper ?? cellEl).getAttribute('id') ?? '';
  const isEdge = cellEl.getAttribute('edge') === '1';
  const style = parseStyle(cellEl.getAttribute('style') ?? '', isEdge);
  const attributes: [string, string][] = wrapper
    ? Array.from(wrapper.attributes)
        .filter((a) => !WRAPPER_KEYS.has(a.name))
        .map((a) => [a.name, a.value])
    : [];
  const props = attributes.filter(([name]) => !DRAWIO_PROVENANCE_ATTRIBUTES.has(name));
  let value = wrapper
    ? (wrapper.getAttribute('label') ?? '')
    : (cellEl.getAttribute('value') ?? '');
  if (wrapper?.getAttribute('placeholders') === '1') value = fillPlaceholders(value, attributes);
  const link = wrapper?.getAttribute('link') || undefined;
  const tooltip = wrapper?.getAttribute('tooltip') || undefined;
  const geometry = readGeometry(cellEl);
  return {
    id,
    parentId: cellEl.getAttribute('parent'),
    vertex: cellEl.getAttribute('vertex') === '1',
    edge: isEdge,
    value,
    html: style.str('html') === '1',
    style,
    ...(link ? { link } : {}),
    ...(tooltip ? { tooltip } : {}),
    props,
    visible: cellEl.getAttribute('visible') !== '0',
    collapsed: cellEl.getAttribute('collapsed') === '1',
    ...(cellEl.getAttribute('source') ? { source: cellEl.getAttribute('source')! } : {}),
    ...(cellEl.getAttribute('target') ? { target: cellEl.getAttribute('target')! } : {}),
    ...(geometry ? { geometry } : {}),
    children: [],
  };
}

export function readGraph(model: Element | null): DrawioGraph {
  const cells = new Map<string, DrawioCell>();
  const graph: DrawioGraph = { cells, rootId: '0', layerIds: [], backgroundImage: false };
  if (!model) return graph;

  const bg = readColour(model.getAttribute('background') ?? undefined);
  if (bg.kind === 'hex') graph.background = bg.value;
  graph.backgroundImage = model.hasAttribute('backgroundImage');

  const root = Array.from(model.children).find((c) => c.localName === 'root');
  const ordered: DrawioCell[] = [];
  for (const el of Array.from(root?.children ?? [])) {
    const cell = readCell(el);
    if (!cell) continue;
    cells.set(cell.id, cell); // a duplicate id: the last one wins (D21)
    ordered.push(cell);
  }

  const rootCell = ordered.find((c) => !c.parentId) ?? cells.get('0');
  if (!rootCell) return graph;
  graph.rootId = rootCell.id;
  graph.layerIds = ordered.filter((c) => c.parentId === rootCell.id).map((c) => c.id);

  for (const cell of ordered) {
    if (cell === rootCell) continue;
    if (!cell.parentId || !cells.has(cell.parentId) || cell.parentId === cell.id) {
      cell.parentId = graph.layerIds[0] ?? rootCell.id;
    }
    cells.get(cell.parentId)!.children.push(cell.id);
  }
  return graph;
}

const isContainerRoot = (graph: DrawioGraph, id: string | null | undefined) =>
  !id || id === graph.rootId || graph.layerIds.includes(id);

const rects = new WeakMap<DrawioGraph, Map<string, Rect | null>>();

/** A vertex's box in canvas coordinates; null without geometry, inside an
 *  edge (the converter places those), or on a parent cycle. */
export function absoluteRect(graph: DrawioGraph, id: string): Rect | null {
  let memo = rects.get(graph);
  if (!memo) {
    memo = new Map();
    rects.set(graph, memo);
  }
  if (memo.has(id)) return memo.get(id)!;
  memo.set(id, null); // a cycle resolves to null rather than recursing forever
  const cell = graph.cells.get(id);
  const geo = cell?.geometry;
  let out: Rect | null = null;
  if (cell && geo) {
    if (isContainerRoot(graph, cell.parentId)) {
      out = { x: geo.x, y: geo.y, width: geo.width, height: geo.height };
    } else {
      const parent = graph.cells.get(cell.parentId!);
      const parentRect = parent && !parent.edge ? absoluteRect(graph, parent.id) : null;
      if (parentRect) {
        const x = geo.relative ? geo.x * parentRect.width + (geo.offset?.x ?? 0) : geo.x;
        const y = geo.relative ? geo.y * parentRect.height + (geo.offset?.y ?? 0) : geo.y;
        out = { x: parentRect.x + x, y: parentRect.y + y, width: geo.width, height: geo.height };
      }
    }
  }
  memo.set(id, out);
  return out;
}

/** The canvas origin of a parent's coordinate space (edge points live in it). */
export function originOf(graph: DrawioGraph, parentId: string | null | undefined): Pt {
  if (isContainerRoot(graph, parentId)) return { x: 0, y: 0 };
  const rect = absoluteRect(graph, parentId!);
  return rect ? { x: rect.x, y: rect.y } : { x: 0, y: 0 };
}
