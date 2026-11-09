// Which page the Quick Style bar sits on (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the page under
// the centre of most of the styled elements; a selection off every page goes to the nearest page. Pure.
import { elementBounds, pageIdOf, type Element, type LaidOutPage } from '@livedocuments/document';

/** The most elements a selection counts to find its page. */
export const QUICK_STYLE_BAR_SAMPLE = 256;

export function quickStyleBarPage(
  targetIds: readonly string[],
  elements: readonly Element[],
  pages: readonly LaidOutPage[] | null | undefined,
): string | null {
  if (!pages || pages.length === 0 || targetIds.length === 0) return null;
  const ids = new Set(targetIds);
  const targets = elements.filter((el) => ids.has(el.id));
  if (targets.length === 0) return null;
  const all = elements as Element[];
  const count = new Map<string, number>();
  // A big selection counts an even spread of at most QUICK_STYLE_BAR_SAMPLE of its elements: each finds its page
  // with a scan of the row, and the majority shows long before every element is counted.
  const step = Math.max(1, Math.ceil(targets.length / QUICK_STYLE_BAR_SAMPLE));
  for (let i = 0; i < targets.length; i += step) {
    const el = targets[i]!;
    const id = pageIdOf(el, all, pages);
    if (id) count.set(id, (count.get(id) ?? 0) + 1);
  }
  // Most first; a tie goes to the page first in the row, so the bar never flips between two.
  let best: string | null = null;
  let most = 0;
  for (const page of pages) {
    const n = count.get(page.id) ?? 0;
    if (n > most) {
      best = page.id;
      most = n;
    }
  }
  if (best) return best;
  // Off every page: the page nearest the first styled element's centre.
  const b = elementBounds(targets[0]!, all);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  let nearest = pages[0]!;
  let gap = Infinity;
  for (const page of pages) {
    const r = page.rect;
    const dx = Math.max(r.x - cx, 0, cx - (r.x + r.width));
    const dy = Math.max(r.y - cy, 0, cy - (r.y + r.height));
    const d = dx * dx + dy * dy;
    if (d < gap) {
      gap = d;
      nearest = page;
    }
  }
  return nearest.id;
}
