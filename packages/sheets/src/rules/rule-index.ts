// Which rules cover a cell (blueprint sheet-rules.md "Engine"): each rule bucketed by the columns its range spans,
// built once per layout and rule list, so drawing a visible cell scans only its column's few rules.
import { posRangeOf } from '../layout';
import type { IdRange, SheetLayout } from '../sheet';

type Entry<T> = { rule: T; r1: number; r2: number };
export type RuleIndex<T> = ReadonlyMap<number, readonly Entry<T>[]>;

const INDEXES = new WeakMap<SheetLayout, WeakMap<readonly IdRange[], RuleIndex<IdRange>>>();

// The rules by column, in list order. A rule whose corners are not on the sheet covers nothing.
export function ruleIndex<T extends IdRange>(
  layout: SheetLayout,
  list: readonly T[],
): RuleIndex<T> {
  let byList = INDEXES.get(layout);
  if (!byList) {
    byList = new WeakMap();
    INDEXES.set(layout, byList);
  }
  const known = byList.get(list);
  if (known) return known as RuleIndex<T>;
  const index = new Map<number, Entry<T>[]>();
  for (const rule of list) {
    const p = posRangeOf(layout, rule);
    if (!p) continue;
    for (let c = p.c1; c <= p.c2; c++) {
      const bucket = index.get(c);
      const entry = { rule, r1: p.r1, r2: p.r2 };
      if (bucket) bucket.push(entry);
      else index.set(c, [entry]);
    }
  }
  byList.set(list, index as RuleIndex<IdRange>);
  return index;
}

// The first rule (in list order) covering the cell.
export function firstRuleAt<T>(index: RuleIndex<T>, r: number, c: number): T | null {
  const bucket = index.get(c);
  if (!bucket) return null;
  for (const e of bucket) if (r >= e.r1 && r <= e.r2) return e.rule;
  return null;
}

// Every rule covering the cell, in list order.
export function rulesAt<T>(index: RuleIndex<T>, r: number, c: number): T[] {
  const bucket = index.get(c);
  if (!bucket) return [];
  const out: T[] = [];
  for (const e of bucket) if (r >= e.r1 && r <= e.r2) out.push(e.rule);
  return out;
}
