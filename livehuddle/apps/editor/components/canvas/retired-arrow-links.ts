// Which retired arrows read which elements (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
// part 4): a stored arrow's pinned end reads the element it was pinned to, and an end on another arrow reads that
// arrow. Nothing here writes to an arrow; it only says which arrows to draw again while a drag preview moves what
// they read, so a pinned end follows its element during the drag as it does once the drag lands.

import { isRetiredArrow, type Element } from '@livehuddle/document';

// Element id to the ids of the arrows with an end on it.
export type RetiredArrowLinks = ReadonlyMap<string, readonly string[]>;

function endTarget(end: unknown): string | null {
  if (!end || typeof end !== 'object') return null;
  const e = end as { kind?: unknown; elementId?: unknown; arrowId?: unknown };
  if (e.kind === 'pinned' && typeof e.elementId === 'string') return e.elementId;
  if (e.kind === 'on-arrow' && typeof e.arrowId === 'string') return e.arrowId;
  return null;
}

/** The links on a board, or null when it holds no arrow (the common case: nothing to follow). Linear. */
export function buildRetiredArrowLinks(elements: readonly Element[]): RetiredArrowLinks | null {
  let links: Map<string, string[]> | null = null;
  for (const el of elements) {
    if (!isRetiredArrow(el)) continue;
    links ??= new Map();
    for (const target of new Set([endTarget(el.from), endTarget(el.to)])) {
      if (target === null || target === el.id) continue;
      const list = links.get(target);
      if (list) list.push(el.id);
      else links.set(target, [el.id]);
    }
  }
  return links;
}

/** Every arrow reading any of `ids`, directly or through another arrow's end. Linear in what it visits. */
export function arrowsReading(links: RetiredArrowLinks, ids: Iterable<string>): Set<string> {
  const out = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const arrow of links.get(id) ?? []) {
      if (out.has(arrow)) continue;
      out.add(arrow);
      queue.push(arrow);
    }
  }
  return out;
}
