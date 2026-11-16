// PDF export (docs/specs/013-workspace/folders.md export menu; docs/specs/020-import-export/pdf-export.md): each page's
// SVG export drawn into the PDF as vectors, with real text, by the shared writer (@liveworkspace/vector-export),
// loaded only when a PDF is made. A page the writer can't draw falls back to the canvas render, as every PDF was
// drawn before.
import type { LaidOutPage, Tab } from '@livedesign/design';
import { exportTabAsSvg, renderTabToCanvas, type ImageExportOpts } from './export-tab';
import { embeddedFontFaceCss } from './export-fonts';

// Text in a system stack (no face of its own to draw) is set in Inter, fetched only when a page has such text.
const fallbackFontCss = () => embeddedFontFaceCss(['inter']);

const writer = () => import('@liveworkspace/vector-export/pdf');

export async function exportTabAsPdf(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const { svgPagesToPdf } = await writer();
  const svg = await (await exportTabAsSvg(tab, opts)).text();
  return svgPagesToPdf([{ svg, raster: () => renderTabToCanvas(tab, opts) }], {
    title: tab.name,
    fallbackFontCss,
  });
}

/** A Pages tab's pages as one PDF (docs/specs/007-editor/pages-mode.md "Export"): every page in row order, one PDF
 *  page each at its own size and orientation in print points, each exactly its sheet. */
export async function exportPagesAsPdf(
  tab: Tab,
  pages: readonly LaidOutPage[],
  opts: ImageExportOpts = {},
): Promise<Blob> {
  const { svgPagesToPdf } = await writer();
  // A deck often repeats one animated background: paint it once for the whole PDF.
  const motionFrames = opts.motionFrames ?? new Map();
  const out = [];
  for (const page of pages) {
    const pageOpts = { ...opts, page, motionFrames };
    out.push({
      svg: await (await exportTabAsSvg(tab, pageOpts)).text(),
      raster: () => renderTabToCanvas(tab, pageOpts),
    });
  }
  return svgPagesToPdf(out, { title: tab.name, fallbackFontCss });
}
