// Which page the Quick Style bar sits on (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the page under
// the centre of most of the styled elements; a selection off every page goes to the nearest page; with nothing styled
// (a marker in hand, the armed Highlighter) the page you are on, else the first. Pure.
import { elementBounds, pageIdOf, type Element, type LaidOutPage } from '@livedesign/design';
import type { QuickStyleView } from './quick-style';

/** Every element the view styles: the theme rows' targets, then the selected marker strokes and highlights. Empty for
 *  a tool in hand. */
export function quickStyleStyledIds(view: QuickStyleView): string[] {
  const pen = view.pen?.subject;
  const highlighter = view.highlighter?.subject;
  return [
    ...view.targetIds,
    ...(pen?.kind === 'strokes' ? pen.ids : []),
    ...(highlighter?.kind === 'strokes' ? highlighter.ids : []),
  ];
}

/** The most elements a selection counts to find its page. */
export const QUICK_STYLE_BAR_SAMPLE = 256;

export function quickStyleBarPage(
  styledIds: readonly string[],
  elements: readonly Element[],
  pages: readonly LaidOutPage[] | null | undefined,
  currentPageId: string | null,
): string | null {
  if (!pages || pages.length === 0) return null;
  // A tool in hand styles its next stroke, which lands where you are.
  if (styledIds.length === 0)
    return pages.some((p) => p.id === currentPageId) ? currentPageId : pages[0]!.id;
  const ids = new Set(styledIds);
  const styled = elements.filter((el) => ids.has(el.id));
  if (styled.length === 0) return null;
  const all = elements as Element[];
  const count = new Map<string, number>();
  // A big selection counts an even spread of at most QUICK_STYLE_BAR_SAMPLE of its elements: each finds its page
  // with a scan of the row, and the majority shows long before every element is counted.
  const step = Math.max(1, Math.ceil(styled.length / QUICK_STYLE_BAR_SAMPLE));
  for (let i = 0; i < styled.length; i += step) {
    const el = styled[i]!;
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
  const b = elementBounds(styled[0]!, all);
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
