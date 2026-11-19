// The category flyout's keyboard (each editor's docs/specs/007-editor/toolbar-layout.md "Opening a flyout" and "A
// tile's side panel"), every editor's one copy: the arrows walk the flyout's items by position across its groups, and
// ArrowRight on a tile with a side panel enters the panel, as it enters a submenu.
import type { KeyboardEvent } from 'react';

// An item's place in the flyout, for arrow-key moves: the centre of its box.
type FlyoutPoint = { x: number; y: number };

/** The index the arrow key moves focus to among the flyout's items (in reading order, across its groups), or null
 *  to stay. Left and Right step through the list; Up and Down move to the nearest item in the row above or below,
 *  by position, since the groups' rows do not line up as one grid; Home and End jump to the ends. */
export function flyoutKeyTarget(
  key: string,
  index: number,
  points: readonly FlyoutPoint[],
): number | null {
  const count = points.length;
  const here = points[index];
  if (count === 0 || !here) return null;
  switch (key) {
    case 'ArrowRight':
      return index + 1 < count ? index + 1 : null;
    case 'ArrowLeft':
      return index > 0 ? index - 1 : null;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'ArrowDown':
    case 'ArrowUp': {
      const down = key === 'ArrowDown';
      // The nearest row in that direction (a few px of slack for sub-pixel layout), then its closest item.
      let rowY: number | null = null;
      for (const p of points) {
        const ahead = down ? p.y > here.y + 2 : p.y < here.y - 2;
        if (ahead && (rowY === null || (down ? p.y < rowY : p.y > rowY))) rowY = p.y;
      }
      if (rowY === null) return null;
      let best: number | null = null;
      points.forEach((p, i) => {
        if (Math.abs(p.y - rowY) > 2) return;
        if (best === null || Math.abs(p.x - here.x) < Math.abs(points[best]!.x - here.x)) best = i;
      });
      return best;
    }
    default:
      return null;
  }
}

/** Arrow keys walk the flyout's items (`data-flyout-item`) by position, across its groups. */
export function onFlyoutArrowKey(e: KeyboardEvent<HTMLElement>, body: HTMLElement | null): void {
  const items = [...(body?.querySelectorAll<HTMLElement>('[data-flyout-item]') ?? [])];
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const points = items.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const next = flyoutKeyTarget(e.key, index, points);
  if (next === null) return;
  e.preventDefault();
  items[next]!.focus();
}

/** The side panel's tile under the focus when ArrowRight is pressed: the arrow enters its panel (spec "A tile's side
 *  panel"), as it enters a submenu, rather than stepping to the next tile. */
export function sideRowFor<T extends { id: string }>(
  e: KeyboardEvent<HTMLElement>,
  tiles: readonly T[] | null,
): { def: T; el: HTMLElement } | null {
  if (e.key !== 'ArrowRight' || !(e.target instanceof HTMLElement)) return null;
  const id = e.target.dataset.sideRow;
  const def = id ? tiles?.find((t) => t.id === id) : undefined;
  return def ? { def, el: e.target } : null;
}

/** The side panel's first stop for the keyboard: its first card, or else the first control it holds (a colour, a
 *  search). */
export function firstStop(body: HTMLElement | null): HTMLElement | null {
  return (
    body?.querySelector<HTMLElement>('[data-flyout-item]') ??
    body?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])') ??
    null
  );
}
