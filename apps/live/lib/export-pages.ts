// Exporting an Illustrate tab's pages (docs/specs/007-editor/illustrate-pages.md "Export"): all
// of them or one, as a PDF, or as PNG / SVG images (one file, or a .zip of every page). Turns the
// dialog's choice into the one file to download.
import { pageLabel, type LaidOutPage, type Tab } from '@livediagram/document';
import { exportTabAsPng, exportTabAsSvg, type ImageExportOpts } from './export-tab';
import { exportPagesAsPdf } from './export-tab-pdf';
import { writeZip } from './zip-writer';

export type PageScope = 'all' | 'one';
export type PageExportFormat = 'pdf' | 'png' | 'svg';

/** Where each format starts: a PDF is every page, an image is one page. */
export const DEFAULT_PAGE_SCOPE: Record<PageExportFormat, PageScope> = {
  pdf: 'all',
  png: 'one',
  svg: 'one',
};

// Filesystem-safe filename: anything that isn't alphanumeric, a dot, a dash, an underscore or a
// space becomes a dash; runs of dashes collapse and the ends are trimmed, so the name is safe on
// Windows, macOS and Linux.
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._\- ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A page's label as the export names it (its name, or "Page n", then its size). */
export function exportPageLabel(page: LaidOutPage, count: number): string {
  return pageLabel(page, page.index, Math.max(2, count));
}

/** The files a zip of every page holds: `NN <label>.<ext>`, in order. */
export function zipEntryName(page: LaidOutPage, count: number, ext: string): string {
  const place = String(page.index + 1).padStart(2, '0');
  return `${place} ${sanitizeFilename(exportPageLabel(page, count))}.${ext}`;
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
  if (format === 'pdf') return { blob: await exportPagesAsPdf(tab, chosen, opts), ext: 'pdf' };
  const render = (p: LaidOutPage) =>
    format === 'png'
      ? exportTabAsPng(tab, { ...opts, page: p })
      : exportTabAsSvg(tab, { ...opts, page: p });
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
