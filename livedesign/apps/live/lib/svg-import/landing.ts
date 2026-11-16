// Where an SVG import lands (docs/specs/020-import-export/svg-import.md "Where the shapes land"): the page under the
// drop point, else the page someone is on, else the page nearest the middle of the view; its safe area (the page
// less its margin) is the box the import is fitted into.
import { pageAt, pageMargin, type LaidOutPage } from '@livedesign/design';
import type { SvgLandingBox } from './import-svg';

type Rect = { x: number; y: number; width: number; height: number };

// With no page at all (never in Pages mode, but a tab can be read before its pages are), the middle of the view
// takes the import at this share of its size.
const VIEW_SHARE = 0.6;

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** The page an import lands on, if any. */
export function landingPage(
  pages: readonly LaidOutPage[],
  opts: { at?: { x: number; y: number }; currentPageId: string | null; view: Rect | null },
): LaidOutPage | undefined {
  if (opts.at) {
    const under = pageAt(pages, opts.at);
    if (under) return under;
  }
  const current = opts.currentPageId ? pages.find((p) => p.id === opts.currentPageId) : undefined;
  if (current) return current;
  if (opts.view && pages.length) {
    const c = centre(opts.view);
    let best = pages[0]!;
    let bestD = Infinity;
    for (const p of pages) {
      const pc = centre(p.rect);
      const d = Math.hypot(pc.x - c.x, pc.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
  return pages[0];
}

/** The box an import is fitted into: the landing page's safe area, else a share of the view, else a 400 px square
 *  at the origin. */
export function landingBox(page: LaidOutPage | undefined, view: Rect | null): SvgLandingBox {
  if (page) {
    const m = pageMargin(page);
    const r = page.rect;
    return { x: r.x + m, y: r.y + m, width: r.width - 2 * m, height: r.height - 2 * m };
  }
  if (view) {
    const w = view.width * VIEW_SHARE;
    const h = view.height * VIEW_SHARE;
    return {
      x: view.x + (view.width - w) / 2,
      y: view.y + (view.height - h) / 2,
      width: w,
      height: h,
    };
  }
  return { x: -200, y: -200, width: 400, height: 400 };
}
