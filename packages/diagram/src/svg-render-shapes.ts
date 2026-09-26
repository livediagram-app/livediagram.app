// Headless SVG emitters for the shape silhouettes and freehand sketches the
// generic renderer used to flatten into plain rectangles. The silhouettes
// come from the shared geometry table (shape-geometry.ts), the same data the
// editor's ShapeSvgOverlay draws from, emitted as a nested <svg> positioned
// over the element box so the stretch behaviour (`preserveAspectRatio="none"`
// for most, `meet` for the proportional actor) matches the canvas at any
// aspect ratio. A silhouette changes in the table, never here.
import { BORDER_DASH_ARRAY, BORDER_STROKE_PX } from './border-style';
import type { BoxedElement, FreehandElement, ShapeKind } from './index';
import { r2, xmlEscape } from './svg-render-primitives';
import { catmullRomToBezierPath } from './polyline';
import { codeTheme } from './code-themes';
import { chartPaletteColors } from './chart-palettes';
import { isLaneBand, laneEdgeOfElement, laneSizeOfElement } from './lane-gutter';
import { PIE_PALETTE } from './data-shapes';
import { legendFontPx } from './label-font';
import {
  BROWSER_CHROME,
  browserChromeLayout,
  SHAPE_DETAIL_STROKE_PX,
  shapeGeometry,
  type ShapePart,
  type ShapePartRole,
} from './shape-geometry';

// The kinds this module draws: every kind in the geometry table except the
// diamond, which svgBoxed draws as a native polygon at element coordinates
// (from the same table points, see scaledPolygonPoints). square / circle /
// stadium / browser render natively too (plain rects / ellipses); the
// self-drawing data shapes (progress / rail / rating / charts) and icons are
// handled elsewhere.
export function hasShapeSilhouette(kind: string): boolean {
  return kind !== 'diamond' && shapeGeometry(kind as ShapeKind) !== null;
}

// Each role's paint, matching the overlay's props for the same role.
// vector-effect keeps the stroke weight even under the stretched viewBox,
// supported by browsers and resvg alike.
function roleAttrs(
  role: ShapePartRole,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash?: string,
): string {
  const f = xmlEscape(fill);
  const s = xmlEscape(stroke);
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  switch (role) {
    case 'main':
      return ` fill="${f}" stroke="${s}" stroke-width="${strokeWidth}"${d} stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    case 'outline':
      return ` fill="${f}" stroke="${s}" stroke-width="${strokeWidth}"${d} vector-effect="non-scaling-stroke"`;
    case 'detail':
      return ` fill="none" stroke="${s}" stroke-width="${SHAPE_DETAIL_STROKE_PX}" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    case 'limb':
    case 'head':
      return ` fill="${role === 'head' ? f : 'none'}" stroke="${s}" stroke-width="${strokeWidth}"${d} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  }
}

// One table part as markup, in its viewBox space.
export function svgShapePart(
  part: ShapePart,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash?: string,
): string {
  const paint = roleAttrs(part.role, fill, stroke, strokeWidth, dash);
  switch (part.tag) {
    case 'path':
      return `<path d="${part.d}"${paint}/>`;
    case 'polygon':
      return `<polygon points="${part.points}"${paint}/>`;
    case 'rect':
      return (
        `<rect x="${r2(part.x)}" y="${r2(part.y)}" width="${r2(part.width)}" height="${r2(part.height)}"` +
        `${part.rx !== undefined ? ` rx="${r2(part.rx)}"` : ''}${paint}/>`
      );
    case 'ellipse':
      return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}"${paint}/>`;
    case 'circle':
      return `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}"${paint}/>`;
  }
}

// A table polygon's 0..100 points mapped into an element box, for the kinds
// drawn natively at element coordinates rather than as a nested <svg>.
export function scaledPolygonPoints(
  points: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return points
    .split(' ')
    .map((pt) => {
      const [px, py] = pt.split(',').map(Number) as [number, number];
      return `${r2(x + (px / 100) * width)},${r2(y + (py / 100) * height)}`;
    })
    .join(' ');
}

// A shape's silhouette as a nested <svg> over the element box, or null when
// the kind renders natively. `fill` / `stroke` are the element's resolved
// colours; the border presets ride along like the editor.
export function svgShapeSilhouette(
  el: BoxedElement & { type: 'shape' },
  fill: string,
  stroke: string,
): string | null {
  if (!hasShapeSilhouette(el.shape)) return null;
  const geometry = shapeGeometry(el.shape, el.height > 0 ? el.width / el.height : 1);
  if (!geometry) return null;
  const strokeWidth = BORDER_STROKE_PX[el.strokeWidth ?? 'medium'] || 2;
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? 'solid'] ?? undefined;
  const markup = geometry.parts
    .map((part) => svgShapePart(part, fill, stroke, strokeWidth, dash))
    .join('');
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"` +
    ` viewBox="${geometry.viewBox}" preserveAspectRatio="${geometry.preserveAspectRatio}" overflow="visible">${markup}</svg>`
  );
}

// A freehand sketch's real path (normalised points scaled to the box), drawn
// the way FreehandSvg draws it on the canvas: a pen stroke through the same
// Catmull-Rom smoothing, a polygon-tool path (spec/84) with its straight
// edges, and nothing for a lone point. Closed paths fill like the canvas;
// open ones render stroke-only.
export function svgFreehandShape(el: FreehandElement, stroke: string, fill: string): string {
  if (el.points.length < 2) return '';
  const pts = el.points.map((p) => ({ x: el.x + p.nx * el.width, y: el.y + p.ny * el.height }));
  const d = el.straightEdges
    ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p.x)} ${r2(p.y)}`).join(' ') +
      (el.closed ? ' Z' : '')
    : catmullRomToBezierPath(pts, el.closed, r2);
  // Highlighter recipe (spec/81): the marker owns width + translucency
  // (a fixed wide round stroke, multiply blend, never filled); the
  // border presets don't apply. Mirrors FreehandSvg in the editor so
  // thumbnails / MCP renders match the canvas.
  if (el.pen === 'highlighter') {
    return (
      `<path d="${d}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${r2(el.penWidth ?? 14)}"` +
      ` stroke-opacity="0.45" style="mix-blend-mode:multiply"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  const strokeWidth =
    BORDER_STROKE_PX[
      (el as { strokeWidth?: keyof typeof BORDER_STROKE_PX }).strokeWidth ?? 'medium'
    ] || 2;
  const dash =
    BORDER_DASH_ARRAY[
      (el as { strokeStyle?: keyof typeof BORDER_DASH_ARRAY }).strokeStyle ?? 'solid'
    ] ?? undefined;
  const fillAttr = el.closed && fill !== 'transparent' ? xmlEscape(fill) : 'none';
  return (
    `<path d="${d}" fill="${fillAttr}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"` +
    `${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

// Code block (spec/82): the editor card + plain monospace lines, in whichever
// colour scheme the element carries (see code-themes.ts). No syntax
// highlighting here: the tokenizer is deliberately a live-editor chunk, and
// un-highlighted mono is a faithful degrade for a thumbnail.
const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 16;
const CODE_PAD = 12;

// Break one source line to `width` columns, on spaces where there is one and
// mid-token where there is not (a URL or a minified line has no spaces, and
// leaving it long would just run off the card again).
function wrapLine(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > width) {
    const slice = rest.slice(0, width + 1);
    const at = slice.lastIndexOf(' ');
    const cut = at > width * 0.5 ? at : width;
    out.push(rest.slice(0, cut));
    rest = rest.slice(at > width * 0.5 ? cut + 1 : cut);
  }
  out.push(rest);
  return out;
}

export function svgCodeBlockShape(el: BoxedElement & { type: 'shape' }): string {
  const scheme = codeTheme(el.codeTheme);
  const card =
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"` +
    ` rx="8" fill="${xmlEscape(scheme.surface)}" stroke="${xmlEscape(scheme.border)}" stroke-width="1.5"/>`;
  const code = (el.code ?? '').replace(/\r\n/g, '\n');
  const empty = code.trim().length === 0;
  // Clip to the card: whole lines vertically, a crude char cap horizontally
  // (12px mono is ~7.2px per char).
  const maxLines = Math.max(1, Math.floor((el.height - CODE_PAD * 2) / CODE_LINE_HEIGHT));
  const maxChars = Math.max(4, Math.floor((el.width - CODE_PAD * 2) / 7.2));
  const source = empty ? ['// double-click to add code'] : code.split('\n');
  // Wrapping is the element's default (spec/82), so the still render wraps
  // too: clipping a wrapped block at the card edge would show a different
  // amount of code in an export than on the canvas.
  const lines = (
    el.codeWrap === false ? source : source.flatMap((l) => wrapLine(l, maxChars))
  ).slice(0, maxLines);
  const textColor = xmlEscape(empty ? scheme.muted : scheme.text);
  const lineStr = lines
    .map(
      (line, i) =>
        `<text x="${r2(el.x + CODE_PAD)}" y="${r2(el.y + CODE_PAD + CODE_LINE_HEIGHT * i + CODE_FONT_SIZE * 0.85)}"` +
        ` font-family="${CODE_FONT}" font-size="${CODE_FONT_SIZE}" fill="${textColor}"` +
        ` xml:space="preserve">${xmlEscape(line.slice(0, maxChars))}</text>`,
    )
    .join('');
  // Language badge, top-right, hidden for 'plain' (spec/82).
  const lang = el.codeLanguage && el.codeLanguage !== 'plain' ? el.codeLanguage : null;
  const badge = lang
    ? `<text x="${r2(el.x + el.width - CODE_PAD)}" y="${r2(el.y + CODE_PAD + 2)}" font-family="${CODE_FONT}"` +
      ` font-size="10" fill="${xmlEscape(scheme.muted)}" text-anchor="end">${xmlEscape(lang)}</text>`
    : '';
  return card + lineStr + badge;
}

// Checklist (spec/83): the themed card + one square-and-text row per item,
// done rows ticked, struck through, and muted, plus the done-count footer.
const CHECK_ROW_HEIGHT = 26;
const CHECK_BOX_SIZE = 14;
const CHECK_PAD = 12;

export function svgChecklistShape(
  el: BoxedElement & { type: 'shape' },
  fill: string,
  stroke: string,
  textColor: string,
): string {
  const card =
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"` +
    ` rx="8" fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="1.5"/>`;
  const items = el.checklistItems ?? [];
  const maxRows = Math.max(1, Math.floor((el.height - CHECK_PAD * 2) / CHECK_ROW_HEIGHT));
  const maxChars = Math.max(4, Math.floor((el.width - CHECK_PAD * 3 - CHECK_BOX_SIZE) / 7));
  const rows = items
    .slice(0, maxRows)
    .map((item, i) => {
      const rowY = el.y + CHECK_PAD + CHECK_ROW_HEIGHT * i;
      const boxY = rowY + (CHECK_ROW_HEIGHT - CHECK_BOX_SIZE) / 2 - 2;
      const box = item.done
        ? `<rect x="${r2(el.x + CHECK_PAD)}" y="${r2(boxY)}" width="${CHECK_BOX_SIZE}" height="${CHECK_BOX_SIZE}"` +
          ` rx="3" fill="${xmlEscape(stroke)}"/>` +
          `<path d="M ${r2(el.x + CHECK_PAD + 3.2)} ${r2(boxY + 7.4)} l 2.6 2.6 l 5 -5.4"` +
          ` fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<rect x="${r2(el.x + CHECK_PAD)}" y="${r2(boxY)}" width="${CHECK_BOX_SIZE}" height="${CHECK_BOX_SIZE}"` +
          ` rx="3" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="1.5"/>`;
      const text =
        `<text x="${r2(el.x + CHECK_PAD * 2 + CHECK_BOX_SIZE)}" y="${r2(boxY + CHECK_BOX_SIZE - 3)}"` +
        ` font-family="system-ui, sans-serif" font-size="13" fill="${xmlEscape(textColor)}"` +
        `${item.done ? ' text-decoration="line-through" opacity="0.55"' : ''}>` +
        `${xmlEscape(item.text.slice(0, maxChars))}</text>`;
      return box + text;
    })
    .join('');
  const doneCount = items.filter((i) => i.done).length;
  const footer =
    doneCount > 0
      ? `<text x="${r2(el.x + el.width - CHECK_PAD)}" y="${r2(el.y + el.height - 8)}"` +
        ` font-family="system-ui, sans-serif" font-size="10" fill="${xmlEscape(textColor)}"` +
        ` opacity="0.6" text-anchor="end">${doneCount}/${items.length}</text>`
      : '';
  return card + rows + footer;
}

// Legend (spec/53): the themed card + one swatch-and-label row per item. The
// swatch falls back to the chart ramp by index, the same rule the canvas view
// uses, so a legend beside a chart matches it in an export too.
const LEGEND_PAD = 12;

export function svgLegendShape(
  el: BoxedElement & { type: 'shape' },
  fill: string,
  stroke: string,
  textColor: string,
): string {
  const card =
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"` +
    ` rx="8" fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="1.5"/>`;
  const items = el.legendItems ?? [];
  const colors = chartPaletteColors(el.chartPalette) ?? PIE_PALETTE;
  // Text Size (spec/53): the row pitch and the dot scale with the words, the
  // way LegendView's do.
  const fontPx = legendFontPx(el.textSize);
  const dotPx = Math.round(fontPx * 0.75);
  const rowHeight = Math.max(20, Math.round(fontPx * 1.7));
  const maxRows = Math.max(1, Math.floor((el.height - LEGEND_PAD * 2) / rowHeight));
  const maxChars = Math.max(4, Math.floor((el.width - LEGEND_PAD * 3 - dotPx) / (fontPx * 0.54)));
  const rows = items
    .slice(0, maxRows)
    .map((item, i) => {
      const rowY = el.y + LEGEND_PAD + rowHeight * i;
      const midY = rowY + rowHeight / 2;
      const dot =
        `<circle cx="${r2(el.x + LEGEND_PAD + dotPx / 2)}" cy="${r2(midY)}"` +
        ` r="${dotPx / 2}" fill="${xmlEscape(item.color ?? colors[i % colors.length]!)}"/>`;
      const text =
        `<text x="${r2(el.x + LEGEND_PAD * 2 + dotPx)}" y="${r2(midY + fontPx * 0.35)}"` +
        ` font-family="system-ui, sans-serif" font-size="${fontPx}" fill="${xmlEscape(textColor)}">` +
        `${xmlEscape(item.label.slice(0, maxChars))}</text>`;
      return dot + text;
    })
    .join('');
  return card + rows;
}

// A lane's title gutter (spec/119): the tinted strip behind the title, on
// whichever edge the title is pinned to, with the rule where it meets the
// body. Without it an exported swimlane is a plain box with its title
// floating in the middle of the work.
export function svgLaneGutter(el: BoxedElement & { type: 'shape' }, stroke: string): string {
  const edge = laneEdgeOfElement(el);
  const size = Math.min(laneSizeOfElement(el), (isLaneBand(edge) ? el.height : el.width) - 1);
  // An explicit heading colour paints at full strength (you picked it, you
  // get it); with none set it is the 10% wash of the lane's own stroke the
  // canvas falls back to, so a recoloured lane keeps its gutter in the family.
  const fill = el.headerFill ?? stroke;
  const wash = el.headerFill ? '' : ' opacity="0.1"';
  const strip = (x: number, y: number, w: number, h: number) =>
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${xmlEscape(fill)}"${wash}/>`;
  const rule = (x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M ${r2(x1)} ${r2(y1)} L ${r2(x2)} ${r2(y2)}" stroke="${xmlEscape(stroke)}" stroke-width="1"/>`;
  if (edge === 'left')
    return (
      strip(el.x, el.y, size, el.height) + rule(el.x + size, el.y, el.x + size, el.y + el.height)
    );
  if (edge === 'right')
    return (
      strip(el.x + el.width - size, el.y, size, el.height) +
      rule(el.x + el.width - size, el.y, el.x + el.width - size, el.y + el.height)
    );
  if (edge === 'top')
    return (
      strip(el.x, el.y, el.width, size) + rule(el.x, el.y + size, el.x + el.width, el.y + size)
    );
  if (edge === 'bottom')
    return (
      strip(el.x, el.y + el.height - size, el.width, size) +
      rule(el.x, el.y + el.height - size, el.x + el.width, el.y + el.height - size)
    );
  // A centred strip has two seams with the body, not one.
  const left = el.x + el.width / 2 - size / 2;
  return (
    strip(left, el.y, size, el.height) +
    rule(left, el.y, left, el.y + el.height) +
    rule(left + size, el.y, left + size, el.y + el.height)
  );
}

// A browser frame's chrome (spec/09 Devices): the fixed-height strip pinned to
// the top, its three window dots, the nav glyphs and the URL pill. Fixed pixel
// geometry from the shared table (BROWSER_CHROME), laid out the way the
// canvas's flex strip lays it out, so it doesn't deform with the box's aspect.
export function svgBrowserChrome(el: BoxedElement, stroke: string): string {
  const c = BROWSER_CHROME;
  const at = browserChromeLayout();
  const h = Math.min(c.heightPx, el.height);
  const color = xmlEscape(stroke);
  const midY = el.y + h / 2;
  const dots = at.dotX
    .map(
      (dx) =>
        `<circle cx="${r2(el.x + dx + c.dotPx / 2)}" cy="${r2(midY)}" r="${c.dotPx / 2}" fill="${color}"/>`,
    )
    .join('');
  const line = ` fill="none" stroke="${color}" stroke-width="${c.nav.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  // The nav group, on its own viewBox grid, sized and centred like the canvas.
  const nav =
    `<svg x="${r2(el.x + at.navX)}" y="${r2(midY - c.nav.heightPx / 2)}" width="${c.nav.widthPx}" height="${c.nav.heightPx}" viewBox="${c.nav.viewBox}" overflow="visible">` +
    c.nav.paths.map((d) => `<path d="${d}"${line}/>`).join('') +
    `</svg>`;
  const pillX = el.x + at.pillX;
  const pillW = Math.max(0, el.x + el.width - c.padXPx - pillX);
  const pill =
    pillW > 8
      ? `<rect x="${r2(pillX)}" y="${r2(midY - c.pillHeightPx / 2)}" width="${r2(pillW)}" height="${c.pillHeightPx}" rx="${c.pillHeightPx / 2}" fill="none" stroke="${color}" stroke-width="1"/>`
      : '';
  const divider = `<path d="M ${r2(el.x)} ${r2(el.y + h)} L ${r2(el.x + el.width)} ${r2(el.y + h)}" stroke="${color}" stroke-width="1"/>`;
  return dots + nav + pill + divider;
}
