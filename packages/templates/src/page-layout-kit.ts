// The page layouts' shared kit (docs/specs/007-editor/illustrate-pages.md "Layouts"): element
// factories placed in a page's content box, a headline sized to its box, the heading every layout
// opens with, and the numbered discs a tall page stacks its steps in.
import {
  createImage,
  createPinnedArrow,
  createShape,
  createText,
  LABEL_FONT_PX,
  type Element,
  type ImageElement,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
} from '@livediagram/document';

export type LayoutBox = { x: number; y: number; width: number; height: number };

export type Kit = {
  box: LayoutBox;
  // The box's short side over 100: the unit every size is measured in.
  u: number;
  wide: boolean;
  shape: (
    kind: ShapeKind,
    x: number,
    y: number,
    w: number,
    h: number,
    extra?: Partial<ShapeElement>,
  ) => ShapeElement;
  text: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    extra?: Partial<TextElement>,
  ) => TextElement;
  // A headline fitted to its box (the fit-to-box size), bold.
  title: (x: number, y: number, w: number, h: number, label: string) => TextElement;
  image: (x: number, y: number, w: number, h: number) => ImageElement;
};

// Wider than this many times its height, a box is laid out side by side.
const WIDE_RATIO = 1.15;
// A headline's type: its size as a share of its box's height (the rest is line spacing), and a
// bold glyph's mean advance as a share of the size (generous, so a long title never wraps).
const TITLE_FILL = 0.72;
const GLYPH_WIDTH = 0.6;

export function kit(box: LayoutBox): Kit {
  const r = (n: number) => Math.round(n);
  return {
    box,
    u: Math.min(box.width, box.height) / 100,
    wide: box.width > box.height * WIDE_RATIO,
    shape: (kind, x, y, w, h, extra = {}) => ({
      ...createShape(kind, r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      ...extra,
    }),
    text: (x, y, w, h, label, extra = {}) => ({
      ...createText(r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      label,
      textSize: 'md',
      textAlignX: 'left',
      textAlignY: 'top',
      ...extra,
    }),
    // A headline sized to its box: large type scaled up (textScale, honoured on the canvas and in
    // every export alike) until one line fills the box's height or its width, whichever is first.
    title: (x, y, w, h, label) => {
      const fontPx = Math.min(h * TITLE_FILL, w / (Math.max(1, label.length) * GLYPH_WIDTH));
      return {
        ...createText(r(box.x + x), r(box.y + y)),
        width: r(w),
        height: r(h),
        label,
        textSize: 'lg',
        textScale: Math.round((fontPx / LABEL_FONT_PX.lg) * 100) / 100,
        textBold: true,
        textAlignX: 'left',
        textAlignY: 'middle',
      };
    },
    image: (x, y, w, h) => ({
      ...createImage(r(box.x + x), r(box.y + y)),
      width: r(w),
      height: r(h),
      objectFit: 'cover',
      borderRadius: 'lg',
      aspectLocked: false,
    }),
  };
}

// The headline every layout but the title page opens with, an optional lead line under it, and
// how far down the content starts.
export function heading(k: Kit, label: string, lead?: string): { els: Element[]; top: number } {
  const { u } = k;
  const h = u * 9;
  const els: Element[] = [k.title(0, 0, k.box.width * 0.85, h, label)];
  if (!lead) return { els, top: h + u * 6 };
  els.push(k.text(0, h + u * 2, k.box.width * 0.9, u * 9, lead, { textSize: 'lg' }));
  return { els, top: h + u * 15 };
}

// Numbered discs down the page, a step's name and note beside each, joined by arrows.
export function verticalSteps(
  k: Kit,
  top: number,
  rows: readonly (readonly [string, string])[],
  disc: (i: number) => string,
  discSize: TextElement['textSize'] = 'lg',
): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const rowH = (H - top) / rows.length;
  const d = Math.min(rowH * 0.6, u * 16);
  const els: Element[] = [];
  const discs: ShapeElement[] = [];
  rows.forEach(([name, note], i) => {
    const y = top + i * rowH;
    const c = k.shape('circle', 0, y, d, d, { label: disc(i), textBold: true, textSize: discSize });
    discs.push(c);
    els.push(
      c,
      k.text(d + u * 6, y, W - d - u * 6, u * 7, name, { textSize: 'lg', textBold: true }),
      k.text(d + u * 6, y + u * 8, W - d - u * 6, Math.max(u * 4, rowH - u * 9), note),
    );
  });
  for (let i = 1; i < discs.length; i += 1) {
    els.push(createPinnedArrow(discs[i - 1]!.id, 's', discs[i]!.id, 'n'));
  }
  return els;
}
