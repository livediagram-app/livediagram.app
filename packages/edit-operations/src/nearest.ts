// Nearest candidates for a refusal (docs/specs/024-agents/blueprints/edit-operations.md "Nearest
// candidates"): a banded edit distance, so a typo in an id, a label or a name finds what was meant
// at a bounded cost.

import type { Element } from '@livediagram/document';
import { labelOf } from './element-text';
import { LABEL_CUT_CHARS, NEAREST_CANDIDATES_MAX, NEAREST_MAX_DISTANCE } from './vocabulary';

// The Levenshtein distance of `a` and `b` when it is at most `max`, else `max + 1`. Only the
// diagonal band of width `2 × max + 1` is filled, so the cost is O(length × max).
export function editDistanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const over = max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => (j <= max ? j : over));
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(over);
    current[0] = i <= max ? i : over;
    let best = current[0];
    for (let j = Math.max(1, i - max); j <= Math.min(b.length, i + max); j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, previous[j]! + 1, current[j - 1]! + 1, over);
      best = Math.min(best, current[j]!);
    }
    if (best > max) return over;
    previous = current;
  }
  return Math.min(previous[b.length]!, over);
}

// The name nearest `word` within `max`, the earlier on a tie; undefined when none is that near.
export function nearestName(
  word: string,
  names: readonly string[],
  max: number,
): string | undefined {
  let found: string | undefined;
  let distance = max + 1;
  for (const name of names) {
    const d = editDistanceWithin(word, name, max);
    if (d < distance) [found, distance] = [name, d];
  }
  return found;
}

// Up to NEAREST_CANDIDATES_MAX elements whose id, or label ignoring case, is within
// NEAREST_MAX_DISTANCE of the selector: nearest first, element order on a tie.
export function nearestElements(selector: string, elements: readonly Element[]): Element[] {
  const query = selector.toLowerCase();
  const scored: { el: Element; distance: number; index: number }[] = [];
  elements.forEach((el, index) => {
    const label = (labelOf(el) ?? '').toLowerCase().slice(0, LABEL_CUT_CHARS);
    const distance = Math.min(
      editDistanceWithin(selector, el.id, NEAREST_MAX_DISTANCE),
      label ? editDistanceWithin(query, label, NEAREST_MAX_DISTANCE) : NEAREST_MAX_DISTANCE + 1,
    );
    if (distance <= NEAREST_MAX_DISTANCE) scored.push({ el, distance, index });
  });
  return scored
    .sort((x, y) => x.distance - y.distance || x.index - y.index)
    .slice(0, NEAREST_CANDIDATES_MAX)
    .map(({ el }) => el);
}
