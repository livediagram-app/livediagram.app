// The plan's labels as the card panel offers them (docs/specs/026-plan/plan-board.md "Working on a board"): each
// label the plan's cards carry, with how many carry it, most used first. A label lives only while a card carries
// it, so removing its last use forgets it. Counted once per change of the plan's cards (the host memoises it), never
// per keystroke: matching a typed label is a pass over this list alone.
import type { Item } from './item';
import { itemLabels } from './item';
import { isTrashed } from './board';

export interface LabelUse {
  label: string;
  // The plan's cards outside the Trash that carry it.
  count: number;
}

const byName = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  // Labels are distinct, so two never compare equal.
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : 1;
};

// Every label in use, most used first, then A to Z (case aside). Cards in the Trash do not count; archived ones do.
export function labelUsage(items: Iterable<Item>): LabelUse[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (isTrashed(item)) continue;
    // A card holds a label once; a duplicate in its list (older data) counts once.
    for (const l of new Set(itemLabels(item))) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || byName(a.label, b.label));
}

// The plan's spelling of a typed label ("bug" for "Bug"), so a label differing only by case is never made; the
// text as typed when the plan has no such label. The most used spelling wins when the plan has several.
export function planSpellingOf(text: string, uses: readonly LabelUse[]): string {
  const key = text.toLowerCase();
  return uses.find((u) => u.label.toLowerCase() === key)?.label ?? text;
}

export interface LabelMatches {
  // The labels to offer, in order: those starting with the query, then those containing it, each most used first.
  matches: LabelUse[];
  // Whether the query names no plan label (case aside), so it may be created.
  creatable: boolean;
}

// The plan's labels a card may still take, narrowed by what is typed (case aside). An empty query offers them all.
export function matchLabels(
  uses: readonly LabelUse[],
  query: string,
  taken: readonly string[],
): LabelMatches {
  const q = query.trim().replace(/^#/, '').toLowerCase();
  const had = new Set(taken.map((t) => t.toLowerCase()));
  const open = uses.filter((u) => !had.has(u.label.toLowerCase()));
  if (!q) return { matches: open, creatable: false };
  const starts: LabelUse[] = [];
  const within: LabelUse[] = [];
  let exact = had.has(q);
  for (const u of open) {
    const l = u.label.toLowerCase();
    if (l === q) exact = true;
    if (l.startsWith(q)) starts.push(u);
    else if (l.includes(q)) within.push(u);
  }
  return { matches: [...starts, ...within], creatable: !exact };
}
