// A read board to livediagram content (docs/specs/020-import-export/blueprints/whiteboard-import.md "Convert"):
// every item lands in exactly one of imported, degraded or skipped, counted per
// kind; the whole board moves so its content starts at the tab's origin.
// Notes, text, shapes, connectors and images join once real exports show
// their markup (E-C1); until then they are skipped and named.

import type { ArrowElement, Element } from '@livediagram/diagram';
import type { BoardItem, WhiteboardBoard } from './canvas';
import type { StrokeDraft } from './fit';
import { inkStrokeDrafts, readInkStrokes } from './ink';
import type { Point } from './matrix';

export type TallyRow = {
  /** `pen-stroke`, `highlighter-stroke`, …, or the Whiteboard kind of a skipped item. */
  kind: string;
  imported: number;
  degraded: Partial<Record<string, number>>;
  skipped: number;
};

export type WhiteboardTally = { rows: TallyRow[] };

// Every element this converter makes sits in a box; connectors join with E-C1.
export type BoxedElement = Exclude<Element, ArrowElement>;

export type ConvertedBoard = {
  items: (BoxedElement | StrokeDraft)[];
  tally: WhiteboardTally;
  backgroundColor?: string;
  unknownTransforms: string[];
};

const WHITE = '#ffffff';

class Tally {
  readonly #rows = new Map<string, TallyRow>();

  #row(kind: string): TallyRow {
    let row = this.#rows.get(kind);
    if (!row) {
      row = { kind, imported: 0, degraded: {}, skipped: 0 };
      this.#rows.set(kind, row);
    }
    return row;
  }

  imported(kind: string, degraded: readonly string[]) {
    const row = this.#row(kind);
    row.imported += 1;
    for (const reason of degraded) row.degraded[reason] = (row.degraded[reason] ?? 0) + 1;
  }

  skipped(kind: string) {
    this.#row(kind).skipped += 1;
  }

  result(): WhiteboardTally {
    return { rows: [...this.#rows.values()] };
  }
}

function convertInk(
  item: BoardItem,
  out: (BoxedElement | StrokeDraft)[],
  tally: Tally,
  unknown: string[],
) {
  const { strokes, unknown: inkUnknown } = readInkStrokes(item);
  unknown.push(...inkUnknown);
  for (const stroke of strokes) {
    const { drafts, degraded } = inkStrokeDrafts(stroke);
    out.push(...drafts);
    tally.imported(stroke.pen === 'highlighter' ? 'highlighter-stroke' : 'pen-stroke', degraded);
  }
}

function bounds(items: (BoxedElement | StrokeDraft)[]): Point | null {
  let minX = Infinity;
  let minY = Infinity;
  for (const item of items) {
    const points = 'raw' in item ? item.raw : [{ x: item.x, y: item.y }];
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY } : null;
}

function moveBy(
  item: BoxedElement | StrokeDraft,
  dx: number,
  dy: number,
): BoxedElement | StrokeDraft {
  if ('raw' in item) return { ...item, raw: item.raw.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  return { ...item, x: item.x + dx, y: item.y + dy };
}

/** The board's content in stacking order, what happened to each item, and the background. */
export function convertBoard(board: WhiteboardBoard): ConvertedBoard {
  const tally = new Tally();
  const unknown: string[] = [...board.items.flatMap((i) => i.unknownTransforms)];
  const items: (BoxedElement | StrokeDraft)[] = [];
  for (const item of board.items) {
    if (item.anchor.querySelector('g.inkStroke')) convertInk(item, items, tally, unknown);
    else tally.skipped(item.kind ?? 'unknown');
  }
  const min = bounds(items);
  const moved = min ? items.map((i) => moveBy(i, -Math.round(min.x), -Math.round(min.y))) : items;
  const background = board.background;
  console.info('[whiteboard-import]', 'board', {
    items: board.items.length,
    rows: tally.result().rows.map((r) => [r.kind, r.imported, r.skipped]),
  });
  return {
    items: moved,
    tally: tally.result(),
    ...(background && background !== WHITE ? { backgroundColor: background } : {}),
    unknownTransforms: [...new Set(unknown)],
  };
}
