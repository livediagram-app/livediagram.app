// What drawing one SVG page into PDF operators carries along (liveworkspace/docs/specs/013-export/vector-pdf.md "How a page is drawn"): the
// file and its shared resources, the stream being written, and where the current user space sits.
import type { FaceSource } from '../outline-text/font-face-css';
import type { faceOpener } from '../outline-text/outline-element';
import { invert, multiply, type Matrix } from './matrix';
import type { PdfFile } from './pdf-file';
import type { PdfResources } from './pdf-resources';
import type { StructTree } from './struct-tree';
import type { TextItem } from './text-layer';

export type Outliner = { faces: readonly FaceSource[]; open: ReturnType<typeof faceOpener> };

export type SvgContext = {
  file: PdfFile;
  res: PdfResources;
  root: SVGSVGElement;
  // The stream being written: the page's, or a group's or a pattern's.
  out: string[];
  // The current user space in the root's user space (the viewBox's units).
  toRoot: Matrix;
  // The current stream's own space in the root's user space: a pattern's matrix is relative to it.
  baseToRoot: Matrix;
  // The root's user space in PDF points on the page (y up).
  rootToPage: Matrix;
  // The visible area, in the root's user space: fallback pictures are cut to it.
  view: { x: number; y: number; w: number; h: number };
  // Characters for the invisible text layer, in reading order; null while drawing a pattern's tile.
  text: TextItem[] | null;
  // The faces text is outlined in, or null when none are embedded (every text then falls back to a picture).
  outliner: Outliner | null;
  // Pictures already in the file, by their address and the size they were drawn at.
  images: Map<string, { obj: number; width: number; height: number; name: string }>;
  // Glyph forms already in the file (glyph-forms.ts), by face and glyph: their XObject names.
  glyphs: Map<string, string>;
  // Device pixels per CSS pixel for a fallback picture.
  rasterScale: number;
  // The page's embedded faces, taken out of the mounted SVG and given back to each fallback picture.
  fontCss: string;
  // The structure tree, while the page's own stream of a tagged PDF is written outside any figure: a described
  // picture opens a Figure in it. Null in a group's form, a pattern's tile, a figure, or an untagged PDF.
  tags: Pick<StructTree, 'figure'> | null;
  // Inside a figure or a translucent group drawn on a tagged page: the alt texts it holds, joined into its Figure.
  alts: string[] | null;
};

/** The current user space in the current stream's own space: a pattern's or a shading's matrix. */
export function toBase(ctx: SvgContext): Matrix {
  const inv = invert(ctx.baseToRoot);
  return inv ? multiply(inv, ctx.toRoot) : ctx.toRoot;
}

/** A unique element by id inside the page's SVG (never another part of the app's document). */
export function byId(ctx: SvgContext, id: string): Element | null {
  return ctx.root.querySelector(`[id="${id.replace(/["\\]/g, '\\$&')}"]`);
}
