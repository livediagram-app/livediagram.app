// The layout view (docs/specs/024-agents/blueprints/document-views.md "layout", VW31, VW32): exact
// geometry relative to the content origin, or coarse rows per container.
import type { LayoutView, ViewDoor } from '@livediagram/api-schema';
import { contentOrigin, type Endpoint } from '@livediagram/document';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import type { ViewEdge } from './edges';
import { boxOf, numberField } from './fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { rowsOf } from './reading-order';
import { depthFirst, isViewRun, subtreeItems, type ViewNode } from './tree';

export type LayoutOptions = { budget?: number; door?: ViewDoor; only?: string; coarse?: boolean };

const BOX = { one: 'box', many: 'boxes' };
const ARROW = { one: 'arrow', many: 'arrows' };
const ROW = { one: 'container', many: 'containers' };

export type Origin = { x: number; y: number };

// An arrow end in content-origin terms: `ref.anchor`, `arrow:ref@t`, or `x,y` for a free end.
export function layoutEndText(end: Endpoint, model: ViewModel, origin: Origin): string {
  switch (end.kind) {
    case 'pinned':
      return `${model.refs.refOf(end.elementId)}.${end.anchor}`;
    case 'on-arrow':
      return `arrow:${model.refs.refOf(end.arrowId)}@${end.t.toFixed(2)}`;
    default:
      return `${Math.round(end.x - origin.x)},${Math.round(end.y - origin.y)}`;
  }
}

function unfolded(node: ViewNode): ViewNode[] {
  return node.children.flatMap((child) => (isViewRun(child) ? child.strokes : [child]));
}

function rowRefs(model: ViewModel, siblings: readonly ViewNode[]): string[][] {
  const { rows, loose } = rowsOf(siblings);
  return [...rows, ...(loose.length > 0 ? [loose] : [])].map((row) =>
    row.map((n) => model.refs.refOf(n.el.id)),
  );
}

function coarseLayout(model: ViewModel, options: LayoutOptions) {
  const containers = depthFirst(subtreeItems(model.tree, options.only)).filter(
    (node) => node.children.length > 0,
  );
  const rootRows =
    options.only === undefined
      ? [
          {
            container: null,
            rows: rowRefs(
              model,
              depthFirst(model.tree.roots).filter((n) => n.container === null),
            ),
          },
        ]
      : [];
  const rows = [
    ...rootRows,
    ...containers.map((node) => ({
      container: model.refs.refOf(node.el.id),
      rows: rowRefs(model, unfolded(node)),
    })),
  ];
  const lines: ViewLine[] = rows.map((r) => ({
    text: `${r.container ?? 'canvas'}: ${r.rows.map((row) => row.join(' ')).join(' / ')}`,
    noun: ROW,
  }));
  return { lines, rows };
}

function exactLayout(model: ViewModel, options: LayoutOptions, origin: Origin) {
  const nodes = depthFirst(subtreeItems(model.tree, options.only));
  const inScope = new Set(nodes.map((n) => n.el.id));
  const arrows = model.edges.all.filter(
    (edge) =>
      options.only === undefined ||
      [edge.arrow.from, edge.arrow.to].some(
        (end) => end.kind === 'pinned' && inScope.has(end.elementId),
      ),
  );
  type Placed = LayoutView['boxes'][number];
  const records = nodes.map((node): { line: ViewLine; box: Placed | null } => {
    const ref = model.refs.refOf(node.el.id);
    const box = boxOf(node.el);
    if (box === null) return { line: { text: `${ref} no geometry`, noun: BOX }, box: null };
    const placed: Placed = {
      ref,
      x: Math.round(box.x - origin.x),
      y: Math.round(box.y - origin.y),
      w: Math.round(box.width),
      h: Math.round(box.height),
      r: Math.round(numberField(node.el, 'rotation') ?? 0),
    };
    const rotated = placed.r !== 0 ? ` r=${placed.r}` : '';
    return {
      line: { text: `${ref} ${placed.x},${placed.y} ${placed.w}x${placed.h}${rotated}`, noun: BOX },
      box: placed,
    };
  });
  const arrowJson = arrows.map((edge: ViewEdge) => ({
    ref: edge.ref,
    from: layoutEndText(edge.arrow.from, model, origin),
    to: layoutEndText(edge.arrow.to, model, origin),
    style: edge.arrow.arrowStyle ?? 'straight',
  }));
  const arrowLines = arrowJson.map((a): ViewLine => ({
    text: `${a.ref} ${a.from} → ${a.to}${a.style === 'straight' ? '' : ` ${a.style}`}`,
    noun: ARROW,
  }));
  return { lines: [...records.map((r) => r.line), ...arrowLines], records, arrows: arrowJson };
}

export function layoutView(model: ViewModel, options: LayoutOptions = {}): ViewResult<LayoutView> {
  const origin = contentOrigin(model.printed);
  const header = headerLine(model.facts);
  const door = options.door ?? 'cli';
  if (options.coarse) {
    const { lines, rows } = coarseLayout(model, options);
    const fitted = fitLines({ header, lines, budget: options.budget, door });
    return {
      text: fitted.text,
      fit: fitOf(fitted),
      json: {
        header: viewHeader('layout', model.facts),
        origin,
        boxes: [],
        arrows: [],
        rows: rows.slice(0, fitted.kept),
        elision: fitted.elision,
      },
    };
  }
  const exact = exactLayout(model, options, origin);
  const fitted = fitLines({ header, lines: exact.lines, budget: options.budget, door });

  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: {
      header: viewHeader('layout', model.facts),
      origin,
      boxes: exact.records.slice(0, fitted.kept).flatMap((r) => (r.box === null ? [] : [r.box])),
      arrows: exact.arrows.slice(0, Math.max(0, fitted.kept - exact.records.length)),
      rows: null,
      elision: fitted.elision,
    },
  };
}
