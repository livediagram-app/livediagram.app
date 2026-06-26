// Headless SVG renderer for a tab's elements (spec/62 §5). Extracted from the
// editor's export pipeline (apps/live/lib/export-tab.ts) so the SAME element
// drawing serves both the in-app SVG/PNG export AND the MCP worker's inline
// render — one renderer, two callers, no DOM. The per-element drawers
// (svgBoxed / svgArrow / labels) and their pure helpers live here; the in-app
// export keeps only its isometric + backdrop-pattern orchestration on top.
//
// Text measurement degrades to a char-width estimate when there's no DOM
// (Workers / jsdom), so wrapping still works headless.
import {
  angledElbow,
  arrowLabelAnchor,
  arrowPathD,
  curveAnchorPoints,
  curveControlPoint,
} from './arrow-path';
import { arrowStyleOf } from './arrow-style';
import { BORDER_DASH_ARRAY } from './border-style';
import {
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
} from './colors';
import { endpointPosition } from './geometry';
import { hasRichFormatting } from './rich-text';
import type { ArrowElement, BoxedElement, Element, Tab, TextRun } from './index';

export const EXPORT_PADDING = 32;
export const EXPORT_BG = '#ffffff';
export const EXPORT_IMAGE_FILL = '#f1f5f9'; // slate-100 placeholder body
export const EXPORT_IMAGE_STROKE = '#94a3b8'; // slate-400 placeholder dashes
export const EXPORT_IMAGE_LABEL = '#64748b'; // slate-500 alt-text label
export const LABEL_LINE_HEIGHT = 1.25;

// One resolved span of a rich label (run + element defaults).
export type ExportRun = {
  text: string;
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
};

export type ExportLabel = {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
  runs?: ExportRun[];
};

// `image` is a dashed placeholder (a static export can't embed the bitmap);
// `none` is a label-only element (text); the rest carry resolved fill + stroke.
export type ExportShape =
  | { kind: 'image' }
  | { kind: 'ellipse'; fill: string; stroke: string }
  | { kind: 'diamond'; fill: string; stroke: string }
  | { kind: 'rect'; fill: string; stroke: string }
  | { kind: 'none' };

export type BoxedExport = { opacity: number; shape: ExportShape; label: ExportLabel | null };

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// XML-escape for both text nodes and attribute values.
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fontSizeFor(textSize: BoxedElement['textSize']): number {
  return textSize === 'lg' ? 20 : textSize === 'sm' ? 12 : textSize === 'scale' ? 18 : 14;
}

// Horizontal room a label has inside its element (box width minus the ~8px
// inset each side), so long labels wrap inside the element.
export function labelMaxWidth(el: BoxedElement): number {
  return Math.max(8, el.width - 16);
}

// Greedy word-wrap to a max pixel width, preserving explicit newlines.
export function wrapLabel(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let cur = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const w = words[i]!;
      if (measure(`${cur} ${w}`) <= maxWidth) cur += ` ${w}`;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  return out;
}

// A reusable measuring 2D context for the SVG path. Null in non-DOM
// environments (Workers / jsdom), where we fall back to a rough
// character-width estimate so wrapping degrades gracefully.
type MeasureCtx = { measureText: (s: string) => { width: number }; font: string };
let _labelMeasureCtx: MeasureCtx | null | undefined;
export function labelMeasure(size: number, bold: boolean, italic: boolean): (s: string) => number {
  if (_labelMeasureCtx === undefined) {
    // Reach `document` via globalThis so this module typechecks under a no-DOM
    // lib (the api / mcp Workers) and still uses the real canvas measure in the
    // browser. Absent in Workers -> char-width fallback below.
    const doc = (
      globalThis as {
        document?: { createElement(tag: string): { getContext(ctx: string): unknown } };
      }
    ).document;
    _labelMeasureCtx = doc
      ? (doc.createElement('canvas').getContext('2d') as MeasureCtx | null)
      : null;
  }
  const ctx = _labelMeasureCtx;
  if (!ctx) return (s) => s.length * size * 0.55;
  ctx.font = `${bold ? '600' : '400'} ${italic ? 'italic ' : ''}${size}px system-ui, sans-serif`;
  return (s) => ctx.measureText(s).width;
}

// Bounding box of the visible content. Arrows count via free endpoints; boxed
// elements via their rectangle. Empty / degenerate tabs default to a page.
export function contentBounds(elements: Element[]): { x: number; y: number; w: number; h: number } {
  if (elements.length === 0) return { x: 0, y: 0, w: 600, h: 400 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const consider = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const el of elements) {
    if (el.type === 'arrow') {
      if (el.from.kind === 'free') consider(el.from.x, el.from.y);
      if (el.to.kind === 'free') consider(el.to.x, el.to.y);
    } else {
      consider(el.x, el.y);
      consider(el.x + el.width, el.y + el.height);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 600, h: 400 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Resolve a boxed element to its export descriptor: branch decision + resolved
// colours + label, using the SAME element-type defaults the editor renders so
// a theme-deferring element exports with its rendered look.
export function describeBoxedExport(el: BoxedElement): BoxedExport {
  const opacity = el.opacity ?? 1;
  if (el.type === 'image') {
    return {
      opacity,
      shape: { kind: 'image' },
      label: {
        text: el.alt ?? 'Image',
        x: el.x + el.width / 2,
        y: el.y + el.height / 2,
        anchor: 'middle',
        color: EXPORT_IMAGE_LABEL,
        size: 12,
        bold: true,
        italic: false,
      },
    };
  }
  const fill = el.fillColor ?? defaultFillColor(el);
  const stroke = el.strokeColor ?? defaultStrokeColor(el);
  const shape: ExportShape =
    (el.type === 'shape' && el.shape === 'circle') || el.type === 'annotation'
      ? { kind: 'ellipse', fill, stroke }
      : el.type === 'shape' && el.shape === 'diamond'
        ? { kind: 'diamond', fill, stroke }
        : el.type === 'text'
          ? { kind: 'none' }
          : { kind: 'rect', fill, stroke };
  const baseColor = el.textColor ?? defaultTextColor(el);
  const baseSize = fontSizeFor(el.textSize);
  const richText = (el as { richText?: TextRun[] }).richText;
  const runs: ExportRun[] | undefined = hasRichFormatting(richText)
    ? richText!.map((run) => ({
        text: run.text,
        color: run.color ?? baseColor,
        size: run.size ? fontSizeFor(run.size) : baseSize,
        bold: run.bold ?? !!el.textBold,
        italic: run.italic ?? !!el.textItalic,
      }))
    : undefined;
  const label: ExportLabel | null = el.label
    ? {
        text: el.label,
        x:
          el.textAlignX === 'right'
            ? el.x + el.width - 8
            : el.textAlignX === 'left'
              ? el.x + 8
              : el.x + el.width / 2,
        y: el.y + el.height / 2,
        anchor: el.textAlignX === 'right' ? 'end' : el.textAlignX === 'left' ? 'start' : 'middle',
        color: baseColor,
        size: baseSize,
        bold: !!el.textBold,
        italic: !!el.textItalic,
        runs,
      }
    : null;
  return { opacity, shape, label };
}

// Arrowhead reference points (where each head should aim from), honouring
// curve / elbow handles so heads sit tangent to the rendered path.
export function arrowHeadRefs(
  arrow: ArrowElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { toRef: { x: number; y: number }; fromRef: { x: number; y: number } } {
  const style = arrowStyleOf(arrow);
  const pts = arrow.curvePoints;
  if (pts && pts.length > 0 && (style === 'curved' || style === 'angled')) {
    const anchors = curveAnchorPoints(from, to, pts);
    return { toRef: anchors[anchors.length - 1]!, fromRef: anchors[0]! };
  }
  if (style === 'curved') {
    const c = curveControlPoint(from, to, arrow.curveOffset);
    return { toRef: c, fromRef: c };
  }
  if (style === 'angled') {
    const elbow = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
    return { toRef: elbow, fromRef: elbow };
  }
  return { toRef: from, fromRef: to };
}

export function svgLabel(
  text: string,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  color: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): string {
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-family="system-ui, sans-serif" font-size="${fontSize}"` +
    ` font-weight="${bold ? 600 : 400}"${italic ? ' font-style="italic"' : ''}` +
    ` fill="${xmlEscape(color)}" text-anchor="${anchor}" dominant-baseline="central">${xmlEscape(text)}</text>`
  );
}

// A word-wrapped plain label: one anchored <text> with a <tspan> per line.
export function svgWrappedLabel(
  lines: string[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  color: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): string {
  const lineH = fontSize * LABEL_LINE_HEIGHT;
  const firstY = y - ((lines.length - 1) * lineH) / 2;
  const tspans = lines
    .map(
      (line, i) => `<tspan x="${r2(x)}" dy="${i === 0 ? 0 : r2(lineH)}">${xmlEscape(line)}</tspan>`,
    )
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(firstY)}" font-family="system-ui, sans-serif" font-size="${fontSize}"` +
    ` font-weight="${bold ? 600 : 400}"${italic ? ' font-style="italic"' : ''}` +
    ` fill="${xmlEscape(color)}" text-anchor="${anchor}" dominant-baseline="central">${tspans}</text>`
  );
}

// Per-range label: one anchored <text> with a <tspan> per run.
export function svgRichLabel(
  runs: ExportRun[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
): string {
  const spans = runs
    .map(
      (run) =>
        `<tspan fill="${xmlEscape(run.color)}" font-size="${run.size}"` +
        ` font-weight="${run.bold ? 600 : 400}"${run.italic ? ' font-style="italic"' : ''}>` +
        `${xmlEscape(run.text)}</tspan>`,
    )
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-family="system-ui, sans-serif"` +
    ` text-anchor="${anchor}" dominant-baseline="central">${spans}</text>`
  );
}

export function svgBoxed(el: BoxedElement): string {
  const { opacity, shape, label } = describeBoxedExport(el);
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  let shapeStr = '';
  if (shape.kind === 'image') {
    shapeStr =
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6"` +
      ` fill="${EXPORT_IMAGE_FILL}" stroke="${EXPORT_IMAGE_STROKE}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  } else if (shape.kind === 'ellipse') {
    shapeStr = `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(el.width / 2)}" ry="${r2(el.height / 2)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`;
  } else if (shape.kind === 'diamond') {
    shapeStr = `<polygon points="${r2(cx)},${r2(el.y)} ${r2(el.x + el.width)},${r2(cy)} ${r2(cx)},${r2(el.y + el.height)} ${r2(el.x)},${r2(cy)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (shape.kind === 'rect') {
    shapeStr = `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`;
  }
  const labelStr = !label
    ? ''
    : label.runs
      ? svgRichLabel(label.runs, label.x, label.y, label.anchor)
      : svgWrappedLabel(
          wrapLabel(
            label.text,
            labelMaxWidth(el),
            labelMeasure(label.size, label.bold, label.italic),
          ),
          label.x,
          label.y,
          label.anchor,
          label.color,
          label.size,
          label.bold,
          label.italic,
        );
  return `<g${opAttr}>${shapeStr}${labelStr}</g>`;
}

export function svgArrowhead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 8;
  const p1 = `${r2(to.x)},${r2(to.y)}`;
  const p2 = `${r2(to.x - size * Math.cos(angle - Math.PI / 6))},${r2(to.y - size * Math.sin(angle - Math.PI / 6))}`;
  const p3 = `${r2(to.x - size * Math.cos(angle + Math.PI / 6))},${r2(to.y - size * Math.sin(angle + Math.PI / 6))}`;
  return `<polygon points="${p1} ${p2} ${p3}" fill="${xmlEscape(color)}"/>`;
}

export function svgArrow(arrow: ArrowElement, elements: Element[]): string {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const stroke = arrow.strokeColor ?? defaultArrowStrokeColor();
  const lw = arrow.strokeWidth ?? 2;
  const op = arrow.opacity ?? 1;
  const opAttr = op !== 1 ? ` opacity="${r2(op)}"` : '';
  const style = arrowStyleOf(arrow);
  const parts = [`<g${opAttr}>`];
  const d = arrowPathD(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  const dash = BORDER_DASH_ARRAY[arrow.strokeStyle ?? 'solid'];
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  parts.push(
    `<path d="${d}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>`,
  );
  const { toRef, fromRef } = arrowHeadRefs(arrow, from, to);
  const ends = arrow.arrowEnds ?? 'to';
  if (ends === 'to' || ends === 'both') parts.push(svgArrowhead(toRef, to, stroke));
  if (ends === 'from' || ends === 'both') parts.push(svgArrowhead(fromRef, from, stroke));
  if (arrow.label) {
    const anchor = arrowLabelAnchor(
      style,
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    parts.push(
      svgLabel(arrow.label, anchor.x, anchor.y - 6, 'middle', '#0f172a', 12, false, false),
    );
  }
  parts.push('</g>');
  return parts.join('');
}

const isFrameEl = (el: Element): boolean => el.type === 'shape' && el.shape === 'frame';

// Render a tab's elements to a complete SVG string on a solid background, sized
// to the content bounds with padding. Frame sections render behind their
// contents, then boxed elements, then arrows on top. No isometric projection or
// backdrop pattern — those are in-app export extras (apps/live/lib/export-tab).
// This is the renderer the MCP worker rasterises for its inline images.
export function renderElementsToSvg(
  tab: Tab,
  opts: { padding?: number; background?: string } = {},
): string {
  const padding = opts.padding ?? EXPORT_PADDING;
  const bounds = contentBounds(tab.elements);
  const vbX = bounds.x - padding;
  const vbY = bounds.y - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;
  const bg = opts.background ?? tab.backgroundColor ?? EXPORT_BG;
  const ordered = tab.elements.some(isFrameEl)
    ? [...tab.elements.filter(isFrameEl), ...tab.elements.filter((el) => !isFrameEl(el))]
    : tab.elements;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bg)}"/>`,
  ];
  for (const el of ordered) {
    if (el.type !== 'arrow') parts.push(svgBoxed(el));
  }
  for (const el of tab.elements) {
    if (el.type === 'arrow') parts.push(svgArrow(el, tab.elements));
  }
  parts.push('</svg>');
  return parts.join('\n');
}
