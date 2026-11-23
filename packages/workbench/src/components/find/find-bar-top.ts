// Where the open Find bar's top goes (docs/specs/007-editor/find-and-replace.md "The bar"): under the Toolbar strip,
// unless that would cover a page's title bar (its Style, Text, Background, Lock page and cog), in which case it moves
// down to just under the lowest one it would cover. Pure: FindHost measures, this decides.

export type BarRect = { left: number; top: number; right: number; bottom: number };

// Screen px kept between the bar and a title bar it steps under.
export const FIND_BAR_CLEARANCE = 8;
// At most this many steps down (title bars stacked under one another): a bound, never reached on a real tab.
const MAX_STEPS = 8;

/** The bar's top: `base`, or under every title bar in `avoid` it would otherwise cover, staying above `floor` (the
 *  lowest its bottom may reach); with no room under them it keeps `base`. */
export function findBarTop(
  base: number,
  bar: { left: number; right: number; height: number },
  avoid: readonly BarRect[],
  floor: number,
): number {
  let top = base;
  for (let step = 0; step < MAX_STEPS; step++) {
    let next = top;
    for (const r of avoid) {
      if (r.right <= r.left || r.bottom <= r.top) continue;
      const across = r.left < bar.right && bar.left < r.right;
      const down = r.top < top + bar.height && top < r.bottom;
      if (across && down) next = Math.max(next, r.bottom + FIND_BAR_CLEARANCE);
    }
    if (next === top) break;
    top = next;
  }
  return top + bar.height > floor ? base : top;
}
