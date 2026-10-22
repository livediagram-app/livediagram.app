// The logo kit (docs/specs/007-editor/logo-pages.md "Export"): a logo page as one .zip of an SVG,
// PNGs at the common icon sizes and a favicon.ico. The plain paper is see-through. One raster at
// the artboard's full size is drawn and every smaller PNG is stepped down from it (halving, then
// one last high-quality scale), rather than drawing the page ten times.
import type { LaidOutPage, Tab } from '@livediagram/document';
import { sanitizeFilename } from './export-pages';
import { encodeIco } from './ico-writer';
import { exportTabAsSvg, renderTabToCanvas, type ImageExportOpts } from './export-tab';
import { writeZip } from './zip-writer';

export const LOGO_KIT_PNG_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024] as const;
export const LOGO_ICO_SIZES = [16, 32, 48] as const;

/** The kit's file names, in the zip's order. */
export function logoKitFileNames(): string[] {
  return ['logo.svg', ...LOGO_KIT_PNG_SIZES.map((s) => `logo-${s}.png`), 'favicon.ico'];
}

function canvasOf(side: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = side;
  c.height = side;
  return c;
}

/** `source` scaled to a `side` square: halved while that stays above the target, then drawn at
 *  the target with high-quality smoothing, so small sizes stay crisp rather than aliased. */
export function downscale(source: HTMLCanvasElement, side: number): HTMLCanvasElement {
  let current = source;
  while (current.width / 2 >= side * 1.5) {
    const half = canvasOf(Math.round(current.width / 2));
    const ctx = half.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  if (current.width === side) return current;
  const out = canvasOf(side);
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, side, side);
  }
  return out;
}

async function pngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/** The logo page's kit as a zip. `opts` carries the tab's images and embedded fonts. */
export async function exportLogoKit(
  tab: Tab,
  page: LaidOutPage,
  opts: ImageExportOpts = {},
): Promise<Blob> {
  const own = { ...opts, page, transparentPaper: true };
  // Through the SVG download, so the faces it uses travel inside the file.
  const svg = new Uint8Array(await (await exportTabAsSvg(tab, own)).arrayBuffer());
  const full = await renderTabToCanvas(tab, {
    ...own,
    scale: page.rect.width > 0 ? 1024 / page.rect.width : 1,
  });
  const pngs = new Map<number, Uint8Array>();
  for (const size of LOGO_KIT_PNG_SIZES) {
    try {
      pngs.set(size, await pngBytes(downscale(full, size)));
    } catch (e) {
      console.warn(`[logo-kit] raster failed: size=${size}`, e);
      throw e;
    }
  }
  const data = new Map<string, Uint8Array>([
    ['logo.svg', svg],
    ...LOGO_KIT_PNG_SIZES.map((size): [string, Uint8Array] => [
      `logo-${size}.png`,
      pngs.get(size)!,
    ]),
    ['favicon.ico', encodeIco(LOGO_ICO_SIZES.map((size) => ({ size, png: pngs.get(size)! })))],
  ]);
  // In the kit's own order (logoKitFileNames), so the list and the zip cannot drift.
  const files = logoKitFileNames().map((name) => ({ name, data: data.get(name)! }));
  return new Blob([writeZip(files)], { type: 'application/zip' });
}

/** The kit's file name: `<document> - <page name> - Logo Kit.zip`, the page by its name, else its
 *  place ("Page 2"), or no page at all while it is the only one. */
export function logoKitFileName(
  documentName: string,
  page: LaidOutPage,
  pageCount: number,
): string {
  const pageName = page.name ?? (pageCount > 1 ? `Page ${page.index + 1}` : '');
  const base = `${documentName || 'document'}${pageName ? ` - ${pageName}` : ''}`;
  return `${sanitizeFilename(base)} - Logo Kit.zip`;
}
