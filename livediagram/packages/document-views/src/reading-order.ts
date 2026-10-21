// Reading order (docs/specs/024-agents/blueprints/document-views.md "Reading order", VW25): rows top to
// bottom, then left to right; elements without geometry follow in array order.
import type { Element } from '@livediagram/document';
import { boxOf, type Box } from './fields';

export type Placed = { el: Element; index: number };
type Boxed<T> = { item: T; box: Box; index: number };

function byYThenX<T>(a: Boxed<T>, b: Boxed<T>): number {
  return a.box.y - b.box.y || a.box.x - b.box.x || a.index - b.index;
}
function byXThenY<T>(a: Boxed<T>, b: Boxed<T>): number {
  return a.box.x - b.box.x || a.box.y - b.box.y || a.index - b.index;
}

// The rows of the boxed siblings, and the siblings without geometry in array order.
export function rowsOf<T extends Placed>(siblings: readonly T[]): { rows: T[][]; loose: T[] } {
  const boxed: Boxed<T>[] = [];
  const loose: T[] = [];
  for (const item of siblings) {
    const box = boxOf(item.el);
    if (box === null) loose.push(item);
    else boxed.push({ item, box, index: item.index });
  }
  const rows: Boxed<T>[][] = [];
  for (const entry of boxed.sort(byYThenX)) {
    const row = rows.at(-1);
    const first = row?.[0];
    if (row && first && entry.box.y < first.box.y + first.box.height) row.push(entry);
    else rows.push([entry]);
  }
  return {
    rows: rows.map((row) => row.sort(byXThenY).map((entry) => entry.item)),
    loose: [...loose].sort((a, b) => a.index - b.index),
  };
}

export function readingOrder<T extends Placed>(siblings: readonly T[]): T[] {
  const { rows, loose } = rowsOf(siblings);
  return [...rows.flat(), ...loose];
}
