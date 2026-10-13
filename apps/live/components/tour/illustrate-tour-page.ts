// Which page the Illustrate tour runs on (docs/specs/007-editor/illustrate-tour.md "Where it appears"), read from the
// drawn pages as the tour is offered.
import type { PageKind } from '@livediagram/document';
import { pageCog } from './page-tour-dom';
import { isOnScreen } from './tour-dom';

export type TourPage = { pageId: string; kind: PageKind };

// The tour page (docs/specs/007-editor/illustrate-tour.md "Where it appears"): of the pages on screen whose kind has
// not been toured, unlocked and with their cog showing, the one showing the most of itself in the window.
export function pickTourPage(unseen: (kind: PageKind) => boolean): TourPage | null {
  let best: (TourPage & { area: number }) | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-illustrate-page-id]')) {
    const pageId = el.dataset.illustratePageId!;
    const kind = el.dataset.illustratePageKind as PageKind | undefined;
    if (!kind || !unseen(kind) || el.dataset.illustratePageLocked !== undefined) continue;
    if (!isOnScreen(pageCog(pageId))) continue;
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    const area = Math.max(0, w) * Math.max(0, h);
    if (area > 0 && (!best || area > best.area)) best = { pageId, kind, area };
  }
  return best ? { pageId: best.pageId, kind: best.kind } : null;
}
