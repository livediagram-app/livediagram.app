// Exporting one page (docs/specs/007-editor/pages-mode.md "Export"): the frame, its background and
// what reaches onto it live in @livedocuments/document (page-frame.ts), shared with an agent's previews.
export {
  PAGE_EXPORT_PAPER as EXPORT_PAPER,
  pageExportFrame,
  type PageExportFrame,
} from '@livedocuments/document';
import { pageDesignExportSvg, type LaidOutPage } from '@livedocuments/document';
import { getTheme } from './themes';

type DesignExportTab = Parameters<typeof pageDesignExportSvg>[0];

/** A page's design as every export draws it (docs/specs/011-theme/page-designs.md "Exports and thumbnails"): the still
 *  frame on the printed paper, in the tab's theme as its light half paints it. '' when the page wears none. */
export function exportPageDesignSvg(
  tab: DesignExportTab,
  page: LaidOutPage,
  idPrefix = '',
): string {
  return pageDesignExportSvg(tab, page, { theme: getTheme(tab.theme, 'light'), idPrefix });
}
