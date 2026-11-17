// The walks that lift what the dark paper sank off it (docs/specs/011-theme/light-and-dark.md "Ink marks on the plain
// paper stay seen"; blueprint docs/specs/011-theme/blueprints/paper-label-ink.md), and re-running them for only what
// an edit changed (Work Tracker 963): an edit, a remote one included, re-inks the parts it changed and the ones whose
// backdrop it could change, not a whole board of thousands. Pure.
import {
  withPaperLabelInks,
  withPaperMarkInks,
  withReadableLabelInks,
  type Element,
} from '@livedesign/design';

/** `drawn` (the elements `stored` drawn on `canvases.drawn`) with what the redraw sank lifted off the paper, in
 *  order: ink marks straight on the plain paper ("Ink marks on the plain paper stay seen"), then labels under 3:1
 *  against what is behind them, then words straight on the plain paper at the contrast they were made with. The canvas
 *  (createStockColourProjector, through reinkOnPaper) and the layout picker's tiles (layout-render-thumb.tsx) draw
 *  through it, so a tile matches the page. The same array when nothing changes. */
export function inkedOnPaper(
  stored: readonly Element[],
  drawn: readonly Element[],
  canvases: { stored: string; drawn: string },
): readonly Element[] {
  const marked = withPaperMarkInks(stored, canvases.stored, drawn, canvases.drawn);
  return withPaperLabelInks(
    stored,
    canvases.stored,
    withReadableLabelInks(stored, canvases.stored, marked, canvases.drawn),
    canvases.drawn,
  );
}

/** More elements changed or gone than this and the whole board is re-inked: a paste or an undo of many parts gains
 *  little from the sub-board. Safe range 8..256. */
export const REINK_MAX_CHANGED = 32;
/** More affected elements and supports than this and the whole board is re-inked. Safe range 64..2048. */
export const REINK_MAX_SUB = 512;

/** The last re-ink: both boards as handed in, what the walks drew, each id's index, and the canvases it was read on. */
export type InkedBoard = {
  readonly stored: readonly Element[];
  readonly drawn: readonly Element[];
  readonly inked: readonly Element[];
  readonly index: ReadonlyMap<string, number>;
  readonly canvases: string;
};

type Box = { type: string; x?: number; y?: number; width?: number; height?: number };
type Rect = { x0: number; y0: number; x1: number; y1: number };

const num = (v: number | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;
/** What can be behind a label or a mark (label-backdrop's isPanel): shapes and stickies. */
const isPanel = (el: Element): boolean => el.type === 'shape' || el.type === 'sticky';
const rectOf = (el: Element): Rect => {
  const b = el as Box;
  return { x0: num(b.x), y0: num(b.y), x1: num(b.x) + num(b.width), y1: num(b.y) + num(b.height) };
};
const centreOf = (el: Element): { x: number; y: number } => {
  const b = el as Box;
  return { x: num(b.x) + num(b.width) / 2, y: num(b.y) + num(b.height) / 2 };
};
// Edges included: a superset of label-backdrop's strict test, so nothing it reads is ever left out.
const holds = (r: Rect, c: { x: number; y: number }): boolean =>
  c.x >= r.x0 && c.x <= r.x1 && c.y >= r.y0 && c.y <= r.y1;

/** The elements an edit changed since `prev`, by index in the new board, and the boxes of the panels among them (as
 *  they were and as they are, and of the panels gone). Null when the whole board should be re-inked: too many
 *  changed, or the kept elements' paint order moved. */
function changedSince(
  prev: InkedBoard,
  stored: readonly Element[],
  drawn: readonly Element[],
  index: ReadonlyMap<string, number>,
): { changed: number[]; regions: Rect[] } | null {
  const changed: number[] = [];
  const regions: Rect[] = [];
  let kept = 0;
  let lastAt = -1;
  for (let i = 0; i < stored.length; i += 1) {
    const el = stored[i]!;
    const at = prev.index.get(el.id);
    if (at === undefined) {
      changed.push(i);
      if (isPanel(el)) regions.push(rectOf(el));
    } else {
      if (at < lastAt) return null;
      lastAt = at;
      kept += 1;
      if (prev.stored[at] !== el || prev.drawn[at] !== drawn[i]) {
        changed.push(i);
        const was = prev.stored[at]!;
        if (isPanel(was)) regions.push(rectOf(was));
        if (isPanel(el)) regions.push(rectOf(el));
      }
    }
    if (changed.length > REINK_MAX_CHANGED) return null;
  }
  if (kept < prev.stored.length) {
    let gone = 0;
    for (const was of prev.stored) {
      if (index.has(was.id)) continue;
      gone += 1;
      if (changed.length + gone > REINK_MAX_CHANGED) return null;
      if (isPanel(was)) regions.push(rectOf(was));
    }
  }
  return { changed, regions };
}

/** The changed elements and every element whose centre lies in a dirty region, an affected panel's box made a dirty
 *  region in turn; null past REINK_MAX_SUB. */
function affectedBy(
  board: readonly Element[],
  changed: readonly number[],
  regions: readonly Rect[],
): Set<number> | null {
  const affected = new Set(changed);
  let pending = regions;
  while (pending.length > 0) {
    const next: Rect[] = [];
    for (let i = 0; i < board.length; i += 1) {
      if (affected.has(i)) continue;
      const el = board[i]!;
      const c = centreOf(el);
      if (!pending.some((r) => holds(r, c))) continue;
      affected.add(i);
      if (affected.size > REINK_MAX_SUB) return null;
      if (isPanel(el)) next.push(rectOf(el));
    }
    pending = next;
  }
  return affected;
}

/** `affected` and every panel painted before one of them (or before another such panel) whose box holds its centre:
 *  all a backdrop lookup can read for them. Indices in paint order; null past REINK_MAX_SUB. */
function withSupports(board: readonly Element[], affected: ReadonlySet<number>): number[] | null {
  const sub = new Set(affected);
  const queue = [...affected];
  for (let k = 0; k < queue.length; k += 1) {
    const q = queue[k]!;
    const c = centreOf(board[q]!);
    for (let j = 0; j < q; j += 1) {
      if (sub.has(j)) continue;
      const p = board[j]!;
      if (!isPanel(p) || !holds(rectOf(p), c)) continue;
      sub.add(j);
      if (sub.size > REINK_MAX_SUB) return null;
      queue.push(j);
    }
  }
  return [...sub].sort((a, b) => a - b);
}

/**
 * inkedOnPaper for `stored` drawn as `drawn` on `canvases`, worked out from `prev` (the last run) where it can: only
 * the elements the edit changed, and those whose backdrop it could change, are walked again, on a sub-board of them
 * and every panel behind them; every other element keeps the last run's inked object. The same result as
 * inkedOnPaper on the whole board (paper-reink.test.ts). The run to hand back next time.
 */
export function reinkOnPaper(
  prev: InkedBoard | null,
  stored: readonly Element[],
  drawn: readonly Element[],
  canvases: { stored: string; drawn: string },
): InkedBoard {
  const key = `${canvases.stored}|${canvases.drawn}`;
  const index = new Map<string, number>();
  stored.forEach((el, i) => index.set(el.id, i));
  const whole = (): InkedBoard => ({
    stored,
    drawn,
    inked: inkedOnPaper(stored, drawn, canvases),
    index,
    canvases: key,
  });
  if (!prev || prev.canvases !== key || index.size !== stored.length) return whole();
  const since = changedSince(prev, stored, drawn, index);
  const affected = since && affectedBy(stored, since.changed, since.regions);
  const sub = affected && withSupports(stored, affected);
  if (!affected || !sub) return whole();
  const subInked = sub.length
    ? inkedOnPaper(
        sub.map((i) => stored[i]!),
        sub.map((i) => drawn[i]!),
        canvases,
      )
    : [];
  const at = new Map(sub.map((i, k) => [i, k] as const));
  let walked = false;
  const inked = drawn.map((el, i) => {
    const out = affected.has(i)
      ? subInked[at.get(i)!]!
      : prev.inked[prev.index.get(stored[i]!.id)!]!;
    if (out !== el) walked = true;
    return out;
  });
  return { stored, drawn, inked: walked ? inked : drawn, index, canvases: key };
}
