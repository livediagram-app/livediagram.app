// Every product's PDF export (liveworkspace/docs/specs/013-export/vector-pdf.md): the SVG each page's SVG export already makes, drawn into a
// PDF as vectors. Shapes and lines are paths, pictures stay pictures, text is drawn as outlines in the faces the SVG
// embeds with an invisible text layer over them, link areas lie over the page, and an article's headings and
// paragraphs are tagged. A page the vector path can't draw at all is drawn by the old raster path instead, so no
// export ever comes out worse than a picture of the page.
import { parseInert } from '@liveworkspace/trusted-types';
import { bytesOf, defaultFontkit, registerFaces, type OutlineDeps } from '../outline-text/faces';
import { parseFontFaces } from '../outline-text/font-face-css';
import { faceOpener } from '../outline-text/outline-element';
import type { Fontkit } from '../outline-text/outline-font';
import { invert, matrixOps, num, type Matrix } from './matrix';
import { PdfFile, pdfTextString } from './pdf-file';
import { canvasPixels, putPixels } from './pdf-image';
import { linkAnnotation, type PdfLink } from './pdf-links';
import { pageMedia } from './pdf-page-size';
import { PdfResources } from './pdf-resources';
import { StructTree } from './struct-tree';
import type { Outliner, SvgContext } from './svg-context';
import { parseViewBox } from './svg-transform';
import { withFallbackFace } from './fallback-face';
import { drawElement } from './svg-walk';
import {
  InvisibleFonts,
  mergeLines,
  readingOrder,
  textLayerOps,
  type TextItem,
} from './text-layer';

export type SvgPdfPage = {
  // The page as its SVG export makes it, with its faces embedded.
  svg: string;
  links?: readonly PdfLink[];
  // The page drawn by the raster path, for a page the vector path can't draw.
  raster?: () => Promise<HTMLCanvasElement>;
};

export type SvgPdfOptions = OutlineDeps & {
  // The document's title, shown by a reader in place of the file name.
  title?: string;
  // Device pixels per CSS pixel for an element drawn as a picture.
  rasterScale?: number;
  // The fallback face's @font-face CSS (Inter, its files inlined), for text in a stack the page embeds no face of:
  // asked for once, only when a page has such text (fallback-face.ts).
  fallbackFontCss?: () => Promise<string>;
};

// Fallback pictures at three device pixels per CSS pixel: sharper than the old 2x page, held under the pixel cap.
export const DEFAULT_RASTER_SCALE = 3;

type Faces = { css: string; release: () => void; outliner: Outliner | null };

/** The page's SVG as XML; markup XML refuses (an attribute named twice) is read as the browser shows it inline, by the
 *  HTML parser, which keeps the first of a repeated attribute. */
function parseSvg(svg: string): Element | null {
  const xml = parseInert(svg, 'image/svg+xml');
  if (!xml.getElementsByTagName('parsererror').length) return xml.documentElement;
  return parseInert(svg, 'text/html').body.querySelector('svg');
}

/** The page SVG mounted off screen, its embedded faces taken out of it (they are registered, and given back to the
 *  fallback pictures). */
function mount(host: HTMLElement, svg: string): { root: SVGSVGElement; css: string } {
  const parsed = parseSvg(svg);
  if (parsed?.localName !== 'svg') throw new Error('PDF: the page is not an SVG');
  let css = '';
  for (const style of [...parsed.querySelectorAll('style')]) {
    const text = style.textContent ?? '';
    if (!text.includes('@font-face')) continue;
    css += text;
    style.remove();
  }
  const root = document.importNode(parsed, true) as unknown as SVGSVGElement;
  host.replaceChildren(root);
  return { root, css };
}

function sizeOf(root: SVGSVGElement): {
  cssW: number;
  cssH: number;
  vb: { x: number; y: number; w: number; h: number };
} {
  const vb0 = parseViewBox(root.getAttribute('viewBox'));
  const n = (name: string, d: number) => {
    const v = parseFloat(root.getAttribute(name) ?? '');
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  const cssW = n('width', vb0?.w ?? 300);
  const cssH = n('height', vb0?.h ?? 150);
  return { cssW, cssH, vb: vb0 ?? { x: 0, y: 0, w: cssW, h: cssH } };
}

/** The pages as one PDF. */
export async function svgPagesToPdf(
  pages: readonly SvgPdfPage[],
  opts: SvgPdfOptions = {},
): Promise<Blob> {
  const file = new PdfFile();
  const res = new PdfResources(file);
  const fonts = new InvisibleFonts(file, res);
  const catalog = file.alloc();
  const pagesObj = file.alloc();
  const pageObjs = pages.map(() => file.alloc());
  const tree = pages.some((p) => p.svg.includes('data-pdf-tag=')) ? new StructTree(file) : null;
  const images: SvgContext['images'] = new Map();
  const glyphs: SvgContext['glyphs'] = new Map();
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  // Out of sight by a 0x0 clip and opacity, never visibility:hidden: that is inherited, and hidden text is skipped.
  host.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';
  document.body.appendChild(host);
  let fallback: Promise<string> | null = null;
  const loadFallback = opts.fallbackFontCss
    ? () => (fallback ??= opts.fallbackFontCss!().catch(() => ''))
    : undefined;
  let faces: Faces | null = null;
  let fontkit: Fontkit | null = null;
  const facesFor = async (css: string, hasText: boolean): Promise<Faces> => {
    if (faces && faces.css === css) return faces;
    faces?.release();
    faces = null;
    const sources = parseFontFaces(css);
    if (!hasText || sources.length === 0)
      return (faces = { css, release: () => {}, outliner: null });
    fontkit ??= await (opts.loadFontkit ?? defaultFontkit)();
    const release = await registerFaces(sources);
    return (faces = {
      css,
      release,
      outliner: { faces: sources, open: faceOpener(fontkit, bytesOf) },
    });
  };
  try {
    for (const [i, page] of pages.entries()) {
      const mounted = mount(host, page.svg);
      const { root } = mounted;
      const css = await withFallbackFace(root, mounted.css, loadFallback);
      const { cssW, cssH, vb } = sizeOf(root);
      const { mediaW, mediaH } = pageMedia(cssW, cssH);
      const sx = mediaW / vb.w;
      const sy = mediaH / vb.h;
      const rootToPage: Matrix = [sx, 0, 0, -sy, -vb.x * sx, mediaH + vb.y * sy];
      let content: string;
      const structParents = tree?.beginPage(pageObjs[i]!);
      try {
        const f = await facesFor(css, !!root.querySelector('text'));
        await document.fonts.ready;
        const ctx: SvgContext = {
          file,
          res,
          root,
          out: [],
          toRoot: [1, 0, 0, 1, 0, 0],
          baseToRoot: invert(rootToPage)!,
          rootToPage,
          view: vb,
          text: [] as TextItem[],
          outliner: f.outliner,
          images,
          glyphs,
          rasterScale: opts.rasterScale ?? DEFAULT_RASTER_SCALE,
          fontCss: css,
        };
        await drawElement(ctx, root);
        const drawing = ['q', matrixOps(rootToPage), ...ctx.out, 'Q'].join('\n');
        const lines = mergeLines(readingOrder(ctx.text!));
        const layer = textLayerOps(
          lines,
          fonts,
          tree ? (line, n) => tree.mark(line, `p${i}-${n}`) : undefined,
        );
        content = tree ? `/Artifact BMC\n${drawing}\nEMC\n${layer}` : `${drawing}\n${layer}`;
      } catch (err) {
        if (!page.raster) throw err;
        console.warn('[pdf] page drawn as a picture', err instanceof Error ? err.message : err);
        const img = putPixels(file, canvasPixels(await page.raster()), true);
        content = `q ${num(mediaW)} 0 0 ${num(mediaH)} 0 0 cm /${res.name('XObject', img)} Do Q`;
        if (tree) content = `/Artifact BMC\n${content}\nEMC`;
      }
      const contents = file.putStream(file.alloc(), '', content);
      const annots = (page.links ?? []).map((link) =>
        file.put(
          file.alloc(),
          linkAnnotation(link, (index) => `${pageObjs[index]} 0 R`),
        ),
      );
      file.put(
        pageObjs[i]!,
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${num(mediaW)} ${num(mediaH)}] /Resources ${res.ref} 0 R /Contents ${contents} 0 R${annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(' ')}]` : ''}${tree ? ` /StructParents ${structParents} /Tabs /S` : ''} >>`,
      );
    }
  } finally {
    (faces as Faces | null)?.release();
    host.remove();
  }
  fonts.write();
  res.write();
  tree?.write();
  file.put(
    pagesObj,
    `<< /Type /Pages /Kids [${pageObjs.map((p) => `${p} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';
  let info: number | undefined;
  if (opts.title) info = file.put(file.alloc(), `<< /Title ${pdfTextString(opts.title)} >>`);
  file.put(
    catalog,
    `<< /Type /Catalog /Pages ${pagesObj} 0 R${tree ? ` /MarkInfo << /Marked true >> /StructTreeRoot ${tree.root} 0 R` : ''}${lang ? ` /Lang ${pdfTextString(lang)}` : ''}${opts.title ? ' /ViewerPreferences << /DisplayDocTitle true >>' : ''} >>`,
  );
  const bytes = await file.toBytes(catalog, info);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}
