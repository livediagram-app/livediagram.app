// The page tree in the order it is written (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The
// tree"): depth first, siblings as listed, no page deeper than the limit. One walk: every page is placed once.

export type TreeItem = { id: string; parentId: string | null };

export type Placed<T> = {
  item: T;
  /** The page it sits under after flattening, or null at the top level. */
  parent: T | null;
  /** True when its own level was deeper than the limit, so it moved up to the last level. */
  flattened: boolean;
};

/**
 * `items` in tree order. A parent that is not among them reads as none (the page surfaces at the top level, never
 * lost), as does a parent chain that loops. A page deeper than `maxDepth` sits at the last level, after the page it
 * was under.
 */
export function arrangeTree<T extends TreeItem>(items: T[], maxDepth: number): Placed<T>[] {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parentId !== null && ids.has(item.parentId) ? item.parentId : null;
    const list = children.get(parent);
    if (list) list.push(item);
    else children.set(parent, [item]);
  }
  const placed: Placed<T>[] = [];
  const seen = new Set<string>();
  type Frame = { item: T; parent: T | null; depth: number; flattened: boolean };
  const walk = (roots: T[]): void => {
    const stack: Frame[] = roots
      .map((item) => ({ item, parent: null, depth: 1, flattened: false }))
      .reverse();
    for (let frame = stack.pop(); frame; frame = stack.pop()) {
      const { item, parent, depth, flattened } = frame;
      // Only a loop leads back to a page already placed.
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      placed.push({ item, parent, flattened });
      const below = children.get(item.id) ?? [];
      const deeper = depth < maxDepth;
      for (let i = below.length - 1; i >= 0; i--) {
        stack.push({
          item: below[i]!,
          parent: deeper ? item : parent,
          depth: deeper ? depth + 1 : depth,
          flattened: !deeper,
        });
      }
    }
  };
  walk(children.get(null) ?? []);
  // Pages whose parents only lead to each other: each loop surfaces at the top level, from its first page.
  for (const item of items) if (!seen.has(item.id)) walk([item]);
  return placed;
}
