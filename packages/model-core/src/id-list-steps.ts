// An ordered list of id'd items (a tab's pages) changing item by item, for every product's model: the changes
// between two versions as id-addressed steps, and applying them to a third, so two people changing different items
// of one list at once both keep theirs. A whole list sent over another one keeps only the last writer's: two
// Editors adding a page in the same second each kept only their own (Work Tracker #669).
//
// A step names its item by id and carries no payload: the payload is the sender's list, which travels anyway (a
// `tab-meta` patch, a saved tab), so the steps stay small enough for a request header. The same steps applied
// by a receiver over its tab and by the api over the stored one give both the same list.

export type IdListStep =
  // An item added or moved: it goes after `after` (null: first), or failing that before `before` (null: last). An
  // item that only changed, in its place, carries neither: it is replaced where it stands.
  | { kind: 'put'; id: string; after?: string | null; before?: string | null }
  | { kind: 'remove'; id: string };

type Item = { id: string };

/** Indexes (into `seq`) of one longest strictly increasing subsequence: O(n log n). */
export function longestIncreasing(seq: readonly number[]): Set<number> {
  const tails: number[] = [];
  const prevOf = new Array<number>(seq.length).fill(-1);
  seq.forEach((v, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]!]! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prevOf[i] = tails[lo - 1]!;
    tails[lo] = i;
  });
  const out = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1]! : -1; i >= 0; i = prevOf[i]!) out.add(i);
  return out;
}

/** The steps that turn `before` into `after`: removals first, then a put for each item that is new, changed or
 *  moved (not among the most items that kept their order), in `after`'s order. `gone` names items the sender may
 *  have sent before without `before` showing them yet (a save still in flight): one of them missing from `after` is
 *  removed too, so an item added and deleted again across two quick saves does not come back. */
export function diffIdList<T extends Item>(
  before: readonly T[],
  after: readonly T[],
  same: (a: T, b: T) => boolean,
  gone: Iterable<string> = [],
): IdListStep[] {
  const steps: IdListStep[] = [];
  const prevIndex = new Map(before.map((item, i) => [item.id, i] as const));
  const nextIds = new Set(after.map((item) => item.id));
  for (const item of before) if (!nextIds.has(item.id)) steps.push({ kind: 'remove', id: item.id });
  for (const id of new Set(gone)) {
    if (!nextIds.has(id) && !prevIndex.has(id)) steps.push({ kind: 'remove', id });
  }
  const keptPositions: number[] = [];
  const keptAt: number[] = [];
  after.forEach((item, i) => {
    const was = prevIndex.get(item.id);
    if (was === undefined) return;
    keptPositions.push(was);
    keptAt.push(i);
  });
  const stayed = new Set([...longestIncreasing(keptPositions)].map((k) => keptAt[k]!));
  after.forEach((item, i) => {
    const was = prevIndex.get(item.id);
    if (was !== undefined && stayed.has(i)) {
      if (!same(before[was]!, item)) steps.push({ kind: 'put', id: item.id });
      return;
    }
    steps.push({
      kind: 'put',
      id: item.id,
      after: i > 0 ? after[i - 1]!.id : null,
      before: i < after.length - 1 ? after[i + 1]!.id : null,
    });
  });
  return steps;
}

/** `steps` applied to `list`, each put's item taken from `items` (the sender's list; a put naming an item it lacks
 *  is skipped). A put whose item `list` lacks (removed here meanwhile) brings it back beside the neighbours it has
 *  in `items`: a change wins over a concurrent removal, so nobody's work goes.
 *
 *  Items added at the same place on both sides converge: after its `after`, a put skips over the items the sender
 *  did not know (absent from `items`) whose id sorts before its own, so every side ends with them in id order. */
export function applyIdListSteps<T extends Item>(
  list: readonly T[],
  steps: readonly IdListStep[],
  items: readonly T[],
): T[] {
  const out = [...list];
  const sent = new Map(items.map((item, i) => [item.id, i] as const));
  for (const step of steps) {
    const at = out.findIndex((x) => x.id === step.id);
    if (step.kind === 'remove') {
      if (at >= 0) out.splice(at, 1);
      continue;
    }
    const i = sent.get(step.id);
    if (i === undefined) continue;
    const item = items[i]!;
    let after = step.after;
    let before = step.before;
    if (after === undefined && before === undefined) {
      if (at >= 0) {
        out[at] = item;
        continue;
      }
      after = i > 0 ? items[i - 1]!.id : null;
      before = i < items.length - 1 ? items[i + 1]!.id : null;
    }
    if (at >= 0) out.splice(at, 1);
    out.splice(placeFor(out, item.id, after, before, sent), 0, item);
  }
  return out;
}

// Where a placed item goes in `out`: after `after`, past the unknown items that sort before it; else before `before`;
// else at the end.
function placeFor<T extends Item>(
  out: readonly T[],
  id: string,
  after: string | null | undefined,
  before: string | null | undefined,
  sent: ReadonlyMap<string, number>,
): number {
  const afterAt = after === null || after === undefined ? -1 : out.findIndex((x) => x.id === after);
  if (after === null || afterAt >= 0) {
    let k = afterAt + 1;
    while (k < out.length && !sent.has(out[k]!.id) && out[k]!.id < id) k++;
    return k;
  }
  if (before === null || before === undefined) return out.length;
  const beforeAt = out.findIndex((x) => x.id === before);
  return beforeAt >= 0 ? beforeAt : out.length;
}

const placeOf = (v: unknown, maxId: number): string | null | undefined | false =>
  v === undefined || v === null ? v : typeof v === 'string' && v.length <= maxId ? v : false;

/** Steps read defensively, from a peer or a request: each id a bounded string, at most `maxSteps` of them, anything
 *  malformed dropped; null when `v` is not a list, or a longer one. What is applied, never the wire value. */
export function parseIdListSteps(v: unknown, maxSteps: number, maxId = 200): IdListStep[] | null {
  if (!Array.isArray(v) || v.length > maxSteps) return null;
  const out: IdListStep[] = [];
  for (const raw of v as unknown[]) {
    const o = raw as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || o.id.length > maxId) continue;
    if (o.kind === 'remove') {
      out.push({ kind: 'remove', id: o.id });
      continue;
    }
    if (o.kind !== 'put') continue;
    const after = placeOf(o.after, maxId);
    const before = placeOf(o.before, maxId);
    if (after === false || before === false) continue;
    out.push({
      kind: 'put',
      id: o.id,
      ...(after !== undefined ? { after } : {}),
      ...(before !== undefined ? { before } : {}),
    });
  }
  return out;
}
