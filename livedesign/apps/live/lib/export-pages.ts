// Exporting a Pages tab's pages (docs/specs/007-editor/pages-mode.md "Export"): all
// of them or one, as a PDF, or as PNG / SVG images (one file, or a .zip of every page). Turns the
// dialog's choice into the one file to download.
import { pageLabel, type LaidOutPage, type Tab } from '@livedesign/design';
import { exportTabAsPng, exportTabAsSvg, type ImageExportOpts } from './export-tab';
import { exportPagesAsPdf } from './export-tab-pdf';
import { sanitizeFilename } from '@liveworkspace/model-core/file-name';
import { writeZip } from '@liveworkspace/workbench/lib/zip-writer';
import { tabExportBaseName as sharedTabExportBaseName } from '@liveworkspace/workbench/lib/tab-export-name';

export type PageScope = 'all' | 'one';
export type PageExportFormat = 'pdf' | 'png' | 'svg';

/** Where each format starts: a PDF is every page, an image is one page. */
export const DEFAULT_PAGE_SCOPE: Record<PageExportFormat, PageScope> = {
  pdf: 'all',
  png: 'one',
  svg: 'one',
};

/** A tab export's file name before its extension (docs/specs/020-import-export/export-fidelity.md "File names"):
 *  the shared rule, "design" when nothing safe is left. */
export function tabExportBaseName(
  designName: string,
  tabName: string,
  isSelection: boolean,
): string {
  return sharedTabExportBaseName(designName, tabName, isSelection, 'design');
}

/** A page's label as the export names it (its name, or "Page n", then its size). */
export function exportPageLabel(page: LaidOutPage, count: number): string {
  return pageLabel(page, page.index, Math.max(2, count));
}

/** A page's label made safe for a file name; "page" when nothing safe is left. */
export function pageFileLabel(page: LaidOutPage, count: number): string {
  return sanitizeFilename(exportPageLabel(page, count), 'page');
}

/** The files a zip of every page holds: `NN <label>.<ext>`, in order. */
export function zipEntryName(page: LaidOutPage, count: number, ext: string): string {
  const place = String(page.index + 1).padStart(2, '0');
  return `${place} ${pageFileLabel(page, count)}.${ext}`;
}

/** The file for the chosen pages and format, with its extension. */
export async function exportPages({
  tab,
  pages,
  page,
  scope,
  format,
  opts,
}: {
  tab: Tab;
  pages: readonly LaidOutPage[];
  // The page for One page.
  page: LaidOutPage;
  scope: PageScope;
  format: PageExportFormat;
  opts: ImageExportOpts;
}): Promise<{ blob: Blob; ext: string }> {
  const chosen = scope === 'all' ? pages : [page];
  // A deck often repeats one animated background: paint it once for every page of this export.
  opts = { ...opts, motionFrames: opts.motionFrames ?? new Map() };
  if (format === 'pdf') return { blob: await exportPagesAsPdf(tab, chosen, opts), ext: 'pdf' };
  const render = (p: LaidOutPage) =>
    format === 'png'
      ? exportTabAsPng(tab, { ...opts, page: p, transparentPaper: true })
      : exportTabAsSvg(tab, { ...opts, page: p, transparentPaper: true });
  if (scope === 'one') return { blob: await render(page), ext: format };
  const files = [];
  for (const p of chosen) {
    files.push({
      name: zipEntryName(p, pages.length, format),
      data: new Uint8Array(await (await render(p)).arrayBuffer()),
    });
  }
  return { blob: new Blob([writeZip(files)], { type: 'application/zip' }), ext: 'zip' };
}
