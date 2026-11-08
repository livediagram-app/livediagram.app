// The layout view (docs/specs/024-agents/blueprints/document-views.md "layout", VW31, VW32): exact
// geometry relative to the content origin, or coarse rows of the canvas.
import type { LayoutView, ViewDoor } from '@livehuddle/api-schema';
import { contentOrigin } from '@livehuddle/document';
import {
  fitLines,
  fitOf,
  type ViewLine,
  type ViewResult,
} from '@liveworkspace/document-views/budget';
import { boxOf, numberField } from '@liveworkspace/document-views/fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { rowsOf } from './reading-order';
import { nodesOf, subtreeItems, type ViewNode } from './tree';

type LayoutOptions = { budget?: number; door?: ViewDoor; only?: string; coarse?: boolean };

const BOX = { one: 'box', many: 'boxes' };
const ROW = { one: 'row', many: 'rows' };

export type Origin = { x: number; y: number };

function rowRefs(model: ViewModel, siblings: readonly ViewNode[]): string[][] {
  const { rows, loose } = rowsOf(siblings);
  return [...rows, ...(loose.length > 0 ? [loose] : [])].map((row) =>
    row.map((n) => model.refs.refOf(n.el.id)),
  );
}

// The canvas's rows, one line each (`row 2: a b c`): nothing nests since part 3 of the element engine
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"), so a budget cuts whole rows.
function coarseLayout(model: ViewModel, options: LayoutOptions) {
  const rows = rowRefs(model, nodesOf(subtreeItems(model.tree, options.only)));
  const lines: ViewLine[] = rows.map((row, i) => ({
    text: `row ${i + 1}: ${row.join(' ')}`,
    noun: ROW,
  }));
  return { lines, rows };
}

function exactLayout(model: ViewModel, options: LayoutOptions, origin: Origin) {
  const nodes = nodesOf(subtreeItems(model.tree, options.only));
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
  // A stored arrow (a retired element, part 4 of the element engine) has no box: it prints `no geometry` like any
  // element without one, and the `arrows` list stays on the wire, empty.
  return { lines: records.map((r) => r.line), records, arrows: [] as LayoutView['arrows'] };
}

// Coordinates are printed from the content origin; a stored one is the printed one plus it, said once on the
// header (before its rev) whenever the two differ (docs/specs/024-agents/document-views.md "The views").
function withOrigin(header: string, origin: Origin): string {
  const [x, y] = [Math.round(origin.x), Math.round(origin.y)];
  if (x === 0 && y === 0) return header;
  return header.replace(
    / · rev \d+$/,
    (rev) => ` · origin ${x},${y}: stored = shown + origin${rev}`,
  );
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
        // One group, the canvas: `container` stays on the wire, null.
        rows: [{ container: null, rows: rows.slice(0, fitted.kept) }],
        elision: fitted.elision,
      },
    };
  }
  const exact = exactLayout(model, options, origin);
  const fitted = fitLines({
    header: withOrigin(header, origin),
    lines: exact.lines,
    budget: options.budget,
    door,
  });

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
