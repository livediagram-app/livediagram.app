// What each page's design layer draws (docs/specs/011-theme/page-designs.md): the design it wears, drawn for its size,
// palette and place in a strip, with the contrast guard's scrims over the settled elements. Each page keeps its
// previous answer while nothing it shows has changed, so its sheet (memo) skips the render; during a Fine Tune gesture
// only the pages named in `redraw` draw again. Pure but for the bounded last-view memory.
import {
  designGuard,
  designPalette,
  paintPageDesign,
  resolveFontStack,
  resolvePageDesigns,
  type DesignScrim,
  type DesignTheme,
  type Element,
  type LaidOutPage,
  type PageBackground,
  type PageDesign,
  type PaintedDesign,
} from '@livedocuments/document';
import { elementsByPage } from './elements-by-page';

export type PageDesignView = {
  painted: PaintedDesign;
  scrims: readonly DesignScrim[];
  // The texts that would not read on it (warn mode shows them; scrim mode covers them).
  failing: number;
  // What it shows, for reuse.
  key: string;
};

export type PageDesignViewsInput = {
  tabDesign: PageDesign | undefined;
  // The pages drawn, and the whole row (a strip flows over the row).
  pages: readonly LaidOutPage[];
  row: readonly LaidOutPage[];
  elements: readonly Element[];
  theme: DesignTheme;
  // The paper is dark (dark chrome).
  paperDark: boolean;
  tabFont: string | undefined;
  // The background a page shows now (a hover may preview another).
  backgroundOf?: (page: LaidOutPage) => PageBackground | undefined;
  // While a Fine Tune control moves: the pages to redraw (those on screen). Any other page keeps its last view.
  redraw?: ReadonlySet<string>;
};

const EMPTY: ReadonlyMap<string, PageDesignView> = new Map();

// The last view each page answered, by page id, so an unchanged page keeps its object across calls. Bounded: the page
// cap and room for a few tabs.
const LAST_MAX = 240;
const last = new Map<string, PageDesignView>();
function remember(pageId: string, view: PageDesignView): void {
  last.delete(pageId);
  last.set(pageId, view);
  if (last.size > LAST_MAX) last.delete(last.keys().next().value!);
}

/** Every drawn page's design view, by page id, reusing the page's last answer while its view is unchanged. */
export function pageDesignViews(input: PageDesignViewsInput): ReadonlyMap<string, PageDesignView> {
  const { tabDesign, pages, row } = input;
  if (!tabDesign && !row.some((p) => p.design)) return EMPTY;
  const resolved = resolvePageDesigns(tabDesign, row, input.elements);
  if (resolved.size === 0) return EMPTY;
  const onPage = elementsByPage(pages, input.elements);
  const font = resolveFontStack(input.tabFont);
  const out = new Map<string, PageDesignView>();
  for (const page of pages) {
    const r = resolved.get(page.id);
    if (!r) continue;
    const kept = input.redraw && !input.redraw.has(page.id) ? last.get(page.id) : undefined;
    if (kept) {
      out.set(page.id, kept);
      continue;
    }
    const background = input.backgroundOf ? input.backgroundOf(page) : page.background;
    const palette = designPalette(input.theme, { background }, input.paperDark, r.tuning.colors);
    const painted = paintPageDesign({
      design: r.design,
      tuning: r.tuning,
      palette,
      width: page.rect.width,
      height: page.rect.height,
      ...(r.strip ? { strip: r.strip } : {}),
      ...(font ? { font } : {}),
    });
    const guard = designGuard(painted, page.rect, onPage.get(page.id) ?? []);
    const key = [
      painted.key,
      painted.intensity,
      painted.calm,
      painted.grain,
      painted.animate ? painted.speed : 0,
      JSON.stringify(guard.scrims),
      guard.failing.length,
    ].join('#');
    const was = last.get(page.id);
    const view =
      was && was.key === key
        ? was
        : { painted, scrims: guard.scrims, failing: guard.failing.length, key };
    remember(page.id, view);
    out.set(page.id, view);
  }
  return out;
}
