// PDF export (docs/specs/013-workspace/folders.md export menu;
// docs/specs/020-import-export/export-fidelity.md "PDF"): the tab's
// SVG export drawn into the PDF as vectors, with real text, by the shared writer (@liveworkspace/vector-export),
// loaded only when a PDF is made. A tab the writer can't draw falls back to the canvas render, as every PDF was drawn
// before.
import type { Tab } from '@livediagram/document';
import { exportTabAsSvg, renderTabToCanvas, type ImageExportOpts } from './export-tab';
import { embeddedFontFaceCss } from './export-fonts';

// Text in a system stack (no face of its own to draw) is set in Inter, fetched only when a page has such text.
const fallbackFontCss = () => embeddedFontFaceCss(['inter']);

export async function exportTabAsPdf(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const { svgPagesToPdf } = await import('@liveworkspace/vector-export/pdf');
  const svg = await (await exportTabAsSvg(tab, opts)).text();
  return svgPagesToPdf([{ svg, raster: () => renderTabToCanvas(tab, opts) }], {
    title: tab.name,
    fallbackFontCss,
  });
}
