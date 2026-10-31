// The browser half of the office exports (docs/specs/020-import-export/blueprints/office-export.md "drawRegion"):
// pictures of some of a page's elements, and of a page's background, drawn by the same canvas renderer as every
// image export so they look exactly as the page does, then encoded as PNG. Fonts are embedded once for the export.

import { exportFontIds, type LaidOutPage, type PageRect, type Tab } from '@livedocuments/document';
import { renderTabToCanvas, type ImageExportOpts } from '../export-tab';
import { embeddedFontFaceCss } from '../export-fonts';
import type { PageDrawer } from './pptx-build';

/** Thrown when the browser will not read a drawn canvas back. */
export class DrawRefused extends Error {
  constructor() {
    super('draw');
    this.name = 'DrawRefused';
  }
}

// Pictures at twice the page's resolution, as the PNG export draws.
const PICTURE_SCALE = 2;
// A background is a whole page: at its own size, it stays a few hundred KB.
const BACKGROUND_SCALE = 1;

async function pngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png');
    } catch {
      resolve(null);
    }
  });
  if (!blob) throw new DrawRefused();
  return new Uint8Array(await blob.arrayBuffer());
}

/** A drawer for the tab: its images and fonts loaded once, shared by every picture. */
export async function pageDrawer(
  tab: Tab,
  opts: Pick<ImageExportOpts, 'images' | 'resolveTabWindow' | 'tabWindowFontIds'>,
): Promise<PageDrawer> {
  const fontCss = await embeddedFontFaceCss([
    ...exportFontIds(tab.elements, tab.font, tab.finish),
    ...(opts.tabWindowFontIds ?? []),
  ]);
  // A deck repeats one animated background: paint it once.
  const motionFrames = new Map();
  const base = { ...opts, fontCss, motionFrames };
  // The page with nothing on it, for its background alone.
  const bare: Tab = { ...tab, elements: [], articles: {} };
  return {
    async region(page: LaidOutPage, ids: ReadonlySet<string>, rect: PageRect) {
      const canvas = await renderTabToCanvas(tab, {
        ...base,
        page,
        only: ids,
        crop: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        scale: PICTURE_SCALE,
      });
      return pngBytes(canvas);
    },
    async background(page: LaidOutPage) {
      const canvas = await renderTabToCanvas(bare, { ...base, page, scale: BACKGROUND_SCALE });
      return pngBytes(canvas);
    },
  };
}
