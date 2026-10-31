// Which of a page's elements stay native in a PowerPoint export, and what they become
// (docs/specs/020-import-export/blueprints/office-export.md "nativeSlideItem"): a text element as a text box, a
// basic shape as a preset or custom geometry with its text, each drawn with the colours, faces and sizes the export
// renderer resolves for it (describeBoxedExport), so a slide reads as the page does. Anything a native shape cannot
// say comes back null, and the caller draws it as a picture. Pure.

import {
  borderOf,
  defaultPadding,
  describeBoxedExport,
  drawsStandardLabel,
  finishOf,
  hasWordmarkType,
  LABEL_LINE_HEIGHT,
  labelBodyInset,
  MUTED_RUN_OPACITY,
  PADDING_PX,
  resolvedAccentEdge,
  resolveFinish,
  rotationOf,
  shapePathData,
  shapePolygonVertices,
  supportsShadow,
  type BoxedElement,
  type CanvasSurface,
  type Element,
  type Finish,
  type ShapeKind,
} from '@livedocuments/document';
import { fontFaceName, NO_PAINT, ooxmlColour, type OoxmlColour } from './ooxml-colour';
import type { EmuRect, PptxAlign, PptxLine, PptxParagraph, PptxRun, PptxShape } from './pptx-types';

/** Where a page's px land on its slide: an offset and one scale, EMU per px (and so points per px). */
export type SlidePlacement = { ox: number; oy: number; emuPerPx: number };

export type NativeContext = {
  place: SlidePlacement;
  surface: CanvasSurface;
  tabFont?: string;
  tabFinish?: Finish;
  /** The element's layer's opacity, folded into every colour. */
  layerOpacity?: number;
};

export const EMU_PER_PT = 12_700;

// The kinds drawn as a preset of the same look; the outline kinds (diamond, triangle, hexagon, parallelogram,
// trapezoid, star, cloud, document) are drawn from their own outline instead (shapePolygonVertices,
// shapePathData), so they match exactly.
const PRESET: Partial<Record<ShapeKind, string>> = {
  square: 'rect',
  stadium: 'roundRect',
  circle: 'ellipse',
  cylinder: 'can',
};
const OUTLINE_KINDS: ReadonlySet<ShapeKind> = new Set([
  'diamond',
  'triangle',
  'hexagon',
  'parallelogram',
  'trapezoid',
  'star',
  'cloud',
  'document',
]);

/** An outline kind's silhouette as an SVG path in its 0..100 box. */
export function outlineOf(kind: ShapeKind): string | null {
  const vertices = shapePolygonVertices(kind);
  if (vertices) return `M ${vertices.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
  return shapePathData(kind);
}

// A preset's corner adjust is a share of the shorter side, out of 100,000; half of it is a pill.
const ADJ_FULL = 100_000;
const ADJ_MAX = 50_000;

/** Whether a shape kind has a native counterpart at all. */
export function isNativeShapeKind(kind: ShapeKind): boolean {
  return kind in PRESET || OUTLINE_KINDS.has(kind);
}

export function emuBox(
  place: SlidePlacement,
  r: { x: number; y: number; width: number; height: number },
): EmuRect {
  return {
    x: place.ox + r.x * place.emuPerPx,
    y: place.oy + r.y * place.emuPerPx,
    cx: r.width * place.emuPerPx,
    cy: r.height * place.emuPerPx,
  };
}

const alignOf = (anchor: 'start' | 'middle' | 'end'): PptxAlign =>
  anchor === 'start' ? 'l' : anchor === 'end' ? 'r' : 'ctr';

const withOpacity = (c: OoxmlColour, opacity: number): OoxmlColour => ({
  hex: c.hex,
  alpha: c.alpha * opacity,
});

/** A colour the file can name, folded with an opacity; NO_PAINT stays; null when it cannot. */
function paint(css: string, opacity: number): OoxmlColour | typeof NO_PAINT | null {
  const c = ooxmlColour(css);
  return c === null || c === NO_PAINT ? c : withOpacity(c, opacity);
}

type Label = NonNullable<ReturnType<typeof describeBoxedExport>['label']>;

/** A label as a text body: its runs split into paragraphs at each line break, in the box less its padding.
 *  Null when one of its colours cannot be named. */
function textBodyOf(el: BoxedElement, label: Label, opacity: number, ctx: NativeContext) {
  const ptPerPx = ctx.place.emuPerPx / EMU_PER_PT;
  const font = fontFaceName(label.fontFamily);
  const source = label.runs ?? [
    {
      text: label.text,
      color: label.color,
      size: label.size,
      bold: label.bold,
      italic: label.italic,
    },
  ];
  const paragraphs: PptxParagraph[] = [];
  let current: PptxRun[] = [];
  const align = alignOf(label.anchor);
  let tallest = 0;
  const close = () => {
    paragraphs.push({ align, runs: current, lineHeightPt: 0 });
    current = [];
  };
  for (const r of source) {
    const colour = paint(r.color, opacity * ('muted' in r && r.muted ? MUTED_RUN_OPACITY : 1));
    if (colour === null) return null;
    tallest = Math.max(tallest, r.size);
    const lines = r.text.split(/\r\n|\r|\n/);
    lines.forEach((line, i) => {
      if (i > 0) close();
      current.push({
        text: line,
        sizePt: r.size * ptPerPx,
        colour: colour === NO_PAINT ? null : colour,
        bold: r.bold,
        italic: r.italic,
        underline: !!el.textUnderline,
        strike: !!el.textStrikethrough,
        ...(font ? { font } : {}),
      });
    });
  }
  close();
  const lineHeightPt = tallest * LABEL_LINE_HEIGHT * ptPerPx;
  for (const p of paragraphs) p.lineHeightPt = lineHeightPt;
  const pad = PADDING_PX[el.padding ?? defaultPadding(el)];
  const body = labelBodyInset(el);
  const e = ctx.place.emuPerPx;
  return {
    anchor:
      label.valign === 'top'
        ? ('t' as const)
        : label.valign === 'bottom'
          ? ('b' as const)
          : ('ctr' as const),
    insets: [pad * e, (body.top + pad) * e, pad * e, (body.bottom + pad) * e] as [
      number,
      number,
      number,
      number,
    ],
    paragraphs,
  };
}

/** A border's dash as DrawingML names it: dotted is dots, every other pattern dashes. */
function dashOf(el: BoxedElement): PptxLine['dash'] {
  const style = 'strokeStyle' in el ? el.strokeStyle : undefined;
  if (!style || style === 'solid') return undefined;
  return style === 'dotted' ? 'sysDot' : 'dash';
}

/**
 * The element as a native slide shape, or null when only a picture shows it as the page does. A text element with
 * no text is `'empty'`: nothing to write.
 */
export function nativeSlideItem(
  el: Element,
  ctx: NativeContext,
  name: string,
): PptxShape | 'empty' | null {
  if (el.type !== 'text' && el.type !== 'shape') return null;
  const finish = resolveFinish(finishOf(el), ctx.tabFinish);
  if (supportsShadow(el) && el.shadow) return null;
  if (resolvedAccentEdge(el)) return null;
  const d = describeBoxedExport(el, {
    tabFont: ctx.tabFont,
    tabFinish: ctx.tabFinish,
    surface: ctx.surface,
  });
  const opacity = d.opacity * (ctx.layerOpacity ?? 1);
  const box = emuBox(ctx.place, el);
  const rotation = rotationOf(el);

  if (el.type === 'text') {
    if (hasWordmarkType(el)) return null;
    if (!d.label || !d.label.text.trim()) return 'empty';
    const body = textBodyOf(el, d.label, opacity, ctx);
    if (!body) return null;
    return {
      kind: 'shape',
      name,
      box,
      rotation,
      txBox: true,
      geometry: 'rect',
      fill: null,
      line: null,
      body,
    };
  }

  // A shape: one of the basic kinds, in a finish a native outline can draw, with nothing beside its label.
  if (!isNativeShapeKind(el.shape) || (finish !== 'flexible' && finish !== 'professional'))
    return null;
  if (el.iconId || el.marker || !drawsStandardLabel(el)) return null;
  if (d.shape.kind === 'none' || d.shape.kind === 'image' || d.shape.kind === 'sticker')
    return null;
  const fill = paint(d.shape.fill, opacity);
  const stroke = paint(d.shape.stroke, opacity);
  if (fill === null || stroke === null) return null;
  const border = borderOf(el, finish);
  const line: PptxLine | null =
    stroke !== NO_PAINT && border.width > 0
      ? {
          colour: stroke,
          widthEmu: border.width * ctx.place.emuPerPx,
          ...(dashOf(el) ? { dash: dashOf(el) } : {}),
        }
      : null;
  const body = d.label ? textBodyOf(el, d.label, opacity, ctx) : null;
  if (d.label && !body) return null;
  const shorter = Math.max(1, Math.min(el.width, el.height));
  const outline = OUTLINE_KINDS.has(el.shape) ? outlineOf(el.shape) : null;
  const geometry = outline
    ? 'custom'
    : el.shape === 'square' && border.radius > 0
      ? 'roundRect'
      : PRESET[el.shape]!;
  const adjust =
    el.shape === 'stadium'
      ? ADJ_MAX
      : geometry === 'roundRect'
        ? Math.min(ADJ_MAX, Math.round((border.radius / shorter) * ADJ_FULL))
        : undefined;
  return {
    kind: 'shape',
    name,
    box,
    rotation,
    txBox: false,
    geometry,
    ...(adjust !== undefined ? { adjust } : {}),
    ...(outline ? { outline } : {}),
    fill: fill === NO_PAINT ? null : fill,
    line,
    body,
  };
}
