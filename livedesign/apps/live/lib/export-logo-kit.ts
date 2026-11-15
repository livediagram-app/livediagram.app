// The logo kit (docs/specs/007-editor/logo-pages.md "Export"): a logo page as one .zip of an SVG,
// PNGs at the common icon sizes and a favicon.ico. The plain paper is see-through. One raster at
// the artboard's full size is drawn and every smaller PNG is stepped down from it (halving, then
// one last high-quality scale), rather than drawing the page ten times. A template's notes about the
// page are left out of every file. The SVG's text is outlined ("Outlined text"), so it draws the same
// with no font anywhere.
import {
  exportFontIds,
  visibleLayerElements,
  type LaidOutPage,
  type Tab,
} from '@livedesign/design';
import { sanitizeFilename } from '@liveworkspace/model-core/file-name';
import { expandForExport } from './component-registry';
import { embeddedFontFaces } from './export-fonts';
import { encodeIco } from './ico-writer';
import { OutlineError } from './outline-text/outline-error';
import { renderTabToCanvas, renderTabToSvg, type ImageExportOpts } from './export-tab';
import { writeZip } from '@liveworkspace/workbench/lib/zip-writer';

export const LOGO_KIT_PNG_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024] as const;
export const LOGO_ICO_SIZES = [16, 32, 48] as const;

// The face text with none of its own letters in, in every file of the kit ("Outlined text"): the kit's SVG holds
// outlines, so its text needs a face whose file can be fetched, never the reader's system font.
export const LOGO_KIT_FALLBACK_FONT = 'inter';

/** The tab as the kit draws it: less the text a template wrote about its pages (`templateNote`), so
 *  every file holds the logo alone, and lettered in `LOGO_KIT_FALLBACK_FONT` when the tab sets no face.
 *  One pass over the elements; the tab itself when there is nothing to change. */
export function logoKitTab(tab: Tab): Tab {
  const elements = tab.elements.filter((el) => !(el.type === 'text' && el.templateNote));
  if (elements.length === tab.elements.length && tab.font) return tab;
  return { ...tab, elements, font: tab.font ?? LOGO_KIT_FALLBACK_FONT };
}

// The faces the kit tab letters in, as the SVG export works them out (component instances expanded, hidden layers
// out).
function kitFontIds(logo: Tab): string[] {
  const expanded = expandForExport(logo);
  return exportFontIds(
    visibleLayerElements(expanded.elements, expanded.layers),
    expanded.font,
    expanded.finish,
  );
}

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
  const logo = logoKitTab(tab);
  // The faces are fetched once, for the outlines and the rasters alike.
  const faces = await embeddedFontFaces(kitFontIds(logo));
  const own = { ...opts, page, transparentPaper: true, fontCss: faces.css };
  const drawn = renderTabToSvg(logo, own);
  let outlined = drawn;
  if (drawn.includes('<text')) {
    if (faces.missing.length > 0) {
      console.warn('[outline] face not fetched', { face: faces.missing[0] });
      throw new OutlineError('font', faces.missing[0]!);
    }
    // fontkit and the outliner load here, at the press, never with the editor.
    const { outlineSvgText } = await import('./outline-text/outline-svg');
    outlined = await outlineSvgText(drawn, faces.css);
  }
  const svg = new TextEncoder().encode(outlined);
  const full = await renderTabToCanvas(logo, {
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

/** The kit's file name: `<design> - <page name> - Logo Kit.zip`, the page by its name, else its
 *  place ("Page 2"), or no page at all while it is the only one. */
export function logoKitFileName(designName: string, page: LaidOutPage, pageCount: number): string {
  const pageName = page.name ?? (pageCount > 1 ? `Page ${page.index + 1}` : '');
  const base = `${designName || 'design'}${pageName ? ` - ${pageName}` : ''}`;
  return `${sanitizeFilename(base, 'design')} - Logo Kit.zip`;
}
