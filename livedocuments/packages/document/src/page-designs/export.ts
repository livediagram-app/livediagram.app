// A page's design as exports, thumbnails and previews draw it (docs/specs/011-theme/page-designs.md "Exports and
// thumbnails"): the still frame, on the paper as printed, with the guard's scrims, in the page's canvas coordinates.
// Every export path reads it here, so the PDF, PNG, SVG, PPTX, thumbnails and the MCP's previews agree. Pure.
import { getBuiltInTheme } from '@liveworkspace/element-model/themes';
import { resolveFontStack } from '@liveworkspace/model-core/fonts';
import type { Tab } from '../index';
import { layOutPages, pagesOf, type LaidOutPage } from '../page';
import { designGuard } from './guard';
import { designPalette, type DesignTheme } from './palette';
import { paintPageDesign, pageDesignSvg } from './render';
import { resolvePageDesigns } from './resolve';
import { tabPageDesignOf } from './tuning';

type DesignTab = Pick<Tab, 'elements'> &
  Partial<Pick<Tab, 'theme' | 'font'>> & {
    pages?: unknown;
    pageOrientation?: unknown;
    articles?: unknown;
    pageDesign?: unknown;
  };

/** Whether the page wears a design: its own, or the tab's unless it opts out. */
export function pageWearsDesign(
  tab: { pageDesign?: unknown },
  page: Pick<LaidOutPage, 'design'>,
): boolean {
  if (page.design) return page.design.id !== 'none';
  return !!tabPageDesignOf(tab);
}

/** Whether any page of the tab wears a design. */
export function tabHasPageDesign(tab: DesignTab): boolean {
  return !!tabPageDesignOf(tab) || pagesOf(tab).some((p) => p.design && p.design.id !== 'none');
}

/** The design `page` wears as still SVG markup in canvas coordinates, or '' when it wears none. `paperDark` draws a
 *  page without a fill as dark (only where the screen is copied; an export prints on white). */
export function pageDesignExportSvg(
  tab: DesignTab,
  page: LaidOutPage,
  {
    theme,
    paperDark = false,
    idPrefix = '',
  }: { theme?: DesignTheme; paperDark?: boolean; idPrefix?: string } = {},
): string {
  const tabDesign = tabPageDesignOf(tab);
  if (!tabDesign && !page.design) return '';
  const own = layOutPages(pagesOf(tab));
  // A page an article's estimate adds past the tab's own (the preview's "added as the writing is laid out") wears the
  // tab's design as the page the editor adds will: it is resolved as the next page of the row.
  const row = own.some((p) => p.id === page.id) ? own : [...own, page];
  const r = resolvePageDesigns(tabDesign, row, tab.elements).get(page.id);
  if (!r) return '';
  const laid = row.find((p) => p.id === page.id);
  const palette = designPalette(
    theme ?? getBuiltInTheme(tab.theme),
    page,
    paperDark,
    r.tuning.colors,
  );
  const font = resolveFontStack(tab.font);
  const painted = paintPageDesign({
    design: r.design,
    tuning: r.tuning,
    palette,
    width: page.rect.width,
    height: page.rect.height,
    ...(r.strip ? { strip: r.strip } : {}),
    ...(font ? { font } : {}),
  });
  // The guard reads the elements where the row lays the page; the frame draws where the caller has it.
  const guard = laid ? designGuard(painted, laid.rect, tab.elements) : { scrims: [] };
  const prefix = `${idPrefix}${page.id}-`.replace(/[^a-zA-Z0-9-]/g, '');
  return pageDesignSvg(painted, { x: page.rect.x, y: page.rect.y }, guard.scrims, prefix);
}
