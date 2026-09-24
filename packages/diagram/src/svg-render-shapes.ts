// Headless SVG emitters for the shape silhouettes and freehand sketches the
// generic renderer used to flatten into plain rectangles. The silhouettes
// mirror the editor's ShapeSvgOverlay geometry (apps/live
// components/canvas/shape-svg-overlay.tsx) exactly — same viewBoxes, same
// paths — emitted as a nested <svg> positioned over the element box so the
// stretch behaviour (`preserveAspectRatio="none"` for most, `meet` for the
// proportional actor) matches the canvas at any aspect ratio. Keep the two
// in sync when a silhouette changes.
import { BORDER_DASH_ARRAY, BORDER_STROKE_PX } from './border-style';
import type { BoxedElement, FreehandElement, ShapeKind } from './index';
import { r2, xmlEscape } from './svg-render-primitives';
import { codeTheme } from './code-themes';
import { chartPaletteColors } from './chart-palettes';
import { isLaneBand, laneEdgeOfElement, laneSizeOfElement } from './lane-gutter';
import { PIE_PALETTE } from './data-shapes';
import { legendFontPx } from './label-font';

// The kinds this module draws. square / circle / stadium / browser render
// natively in svgBoxed (plain rects / ellipses); diamond has a native
// polygon; the self-drawing data shapes (progress / rail / rating / charts)
// and icons are handled elsewhere.
const SILHOUETTE_KINDS = new Set<string>([
  'parallelogram',
  'hexagon',
  'document',
  'cylinder',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
  'monitor',
  'laptop',
  'phone',
  'tablet',
  'foldable',
  'smartwatch',
  'actor',
]);

export function hasShapeSilhouette(kind: string): boolean {
  return SILHOUETTE_KINDS.has(kind);
}

// The shared outline attributes (fill + user stroke + dash), matching the
// overlay's `common` bundle. vector-effect keeps the stroke weight even
// under the stretched viewBox — supported by browsers and resvg alike.
function mainAttrs(fill: string, stroke: string, strokeWidth: number, dash?: string): string {
  return (
    ` fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"` +
    `${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round" vector-effect="non-scaling-stroke"`
  );
}

// Thin solid detail chrome (device bezels, keys), matching the overlay.
function detailAttrs(stroke: string): string {
  return ` fill="none" stroke="${xmlEscape(stroke)}" stroke-width="0.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
}

// The laptop's generated key grid (see LaptopGlyph in the editor overlay).
function laptopMarkup(fill: string, stroke: string, strokeWidth: number, dash?: string): string {
  const main = mainAttrs(fill, stroke, strokeWidth, dash);
  const detail = detailAttrs(stroke);
  const lid = { x: 8, y: 2, w: 84, h: 60 };
  const insetY = 3;
  const insetX = 3; // headless: no live aspect, use the even default
  const kb = { left: 20, right: 80, top: 69, bottom: 84 };
  const cols = 12;
  const rows = 4;
  const cellW = (kb.right - kb.left) / cols;
  const cellH = (kb.bottom - kb.top) / rows;
  const gapX = cellW * 0.2;
  const gapY = cellH * 0.22;
  const keys: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      keys.push(
        `<rect x="${r2(kb.left + c * cellW + gapX / 2)}" y="${r2(kb.top + r * cellH + gapY / 2)}" width="${r2(cellW - gapX)}" height="${r2(cellH - gapY)}" rx="0.6"${detail}/>`,
      );
    }
  }
  return (
    `<rect x="${lid.x}" y="${lid.y}" width="${lid.w}" height="${lid.h}" rx="4"${main}/>` +
    `<rect x="${lid.x + insetX}" y="${lid.y + insetY}" width="${lid.w - insetX * 2}" height="${lid.h - insetY * 2}" rx="2"${detail}/>` +
    `<rect x="${lid.x + 2}" y="${lid.y + lid.h}" width="${lid.w - 4}" height="3" rx="1.5"${main}/>` +
    `<path d="M 14 66 L 86 66 L 94 96 L 6 96 Z"${main}/>` +
    keys.join('') +
    `<rect x="38" y="85.5" width="24" height="3" rx="0.8"${detail}/>` +
    `<rect x="43" y="90" width="14" height="4" rx="1"${detail}/>`
  );
}

// The silhouette's inner markup in its viewBox space, or null for a kind
// this module doesn't draw.
function silhouetteMarkup(
  kind: ShapeKind,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dash?: string,
): { viewBox: string; preserve: string; markup: string } | null {
  const main = mainAttrs(fill, stroke, strokeWidth, dash);
  const detail = detailAttrs(stroke);
  const stretch = (markup: string) => ({
    viewBox: '0 0 100 100',
    preserve: 'none',
    markup,
  });
  switch (kind) {
    case 'parallelogram':
      return stretch(`<polygon points="20,0 100,0 80,100 0,100"${main}/>`);
    case 'hexagon':
      return stretch(`<polygon points="25,0 75,0 100,50 75,100 25,100 0,50"${main}/>`);
    case 'document':
      return stretch(
        `<path d="M 0 0 L 100 0 L 100 92 C 80 109, 65 79, 50 94 C 35 109, 20 79, 0 94 Z"${main}/>`,
      );
    case 'cylinder':
      return stretch(
        `<path d="M 0 15 L 100 15 L 100 85 A 50 12 0 0 1 0 85 Z"${main}/>` +
          `<ellipse cx="50" cy="15" rx="50" ry="12"${main}/>`,
      );
    case 'cloud':
      return stretch(
        `<path d="M 22.4 100 C 1.7 100, -7.3 71.2, 6.9 55 C -2.2 31.5, 17.2 11.7, 31.4 24.3 C 36.6 -6.3, 70.2 -9.9, 74.1 24.3 C 92.1 11.7, 107.6 38.8, 93.4 58.6 C 107.6 73, 97.3 100, 76.6 100 Z"${main}/>`,
      );
    case 'triangle':
      return stretch(`<polygon points="50,2 98,98 2,98"${main}/>`);
    case 'trapezoid':
      return stretch(`<polygon points="22,4 78,4 98,96 2,96"${main}/>`);
    case 'star':
      return stretch(
        `<polygon points="50,2 61,35 96,35 68,56 78,89 50,69 22,89 32,56 4,35 39,35"${main}/>`,
      );
    case 'speech-bubble':
      return stretch(
        `<path d="M 8 0 L 92 0 A 8 8 0 0 1 100 8 L 100 92 A 8 8 0 0 1 92 100 L 44 100 L 26 120 L 34 100 L 8 100 A 8 8 0 0 1 0 92 L 0 8 A 8 8 0 0 1 8 0 Z"${main}/>`,
      );
    case 'frame':
      // Section container: outline ONLY so the contents show through.
      return stretch(
        `<rect x="1" y="1" width="98" height="98" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} vector-effect="non-scaling-stroke"/>`,
      );
    case 'monitor':
      return stretch(
        `<rect x="1" y="1" width="98" height="80" rx="3"${main}/>` +
          `<path d="M 32 88 L 68 88 L 76 99 L 24 99 Z"${main}/>`,
      );
    case 'laptop':
      return stretch(laptopMarkup(fill, stroke, strokeWidth, dash));
    case 'phone':
      return stretch(
        `<rect x="2" y="2" width="96" height="96" rx="10"${main}/>` +
          `<rect x="6" y="10" width="88" height="80" rx="3"${detail}/>`,
      );
    case 'tablet':
      return stretch(
        `<rect x="2" y="2" width="96" height="96" rx="6"${main}/>` +
          `<rect x="5" y="6" width="90" height="88" rx="3"${detail}/>`,
      );
    case 'foldable':
      return stretch(
        `<rect x="2" y="2" width="96" height="96" rx="5"${main}/>` +
          `<rect x="5" y="6" width="90" height="88" rx="3"${detail}/>` +
          // The crease. It is what says "unfolded" rather than "tablet".
          `<path d="M 50 6 L 50 94"${detail}/>`,
      );
    case 'smartwatch':
      return stretch(
        `<rect x="36" y="0" width="28" height="20"${main}/>` +
          `<rect x="36" y="80" width="28" height="20"${main}/>` +
          `<rect x="76" y="43" width="7" height="14" rx="2"${main}/>` +
          `<rect x="22" y="14" width="56" height="72" rx="14"${main}/>` +
          `<rect x="29" y="21" width="42" height="58" rx="9"${detail}/>`,
      );
    case 'actor': {
      // Proportional stickman (the overlay's `meet` viewBox), open-circle
      // head tinted by the fill.
      const line = ` fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
      return {
        viewBox: '0 0 90 130',
        preserve: 'xMidYMid meet',
        markup:
          `<circle cx="45" cy="22" r="16"${line.replace('fill="none"', `fill="${xmlEscape(fill)}"`)}/>` +
          `<path d="M 45 38 L 45 82"${line}/>` +
          `<path d="M 16 56 L 74 56"${line}/>` +
          `<path d="M 45 82 L 22 112"${line}/>` +
          `<path d="M 45 82 L 68 112"${line}/>`,
      };
    }
    default:
      return null;
  }
}

// A shape's silhouette as a nested <svg> over the element box, or null when
// the kind renders natively. `fill` / `stroke` are the element's resolved
// colours; the border presets ride along like the editor.
export function svgShapeSilhouette(
  el: BoxedElement & { type: 'shape' },
  fill: string,
  stroke: string,
): string | null {
  const strokeWidth = BORDER_STROKE_PX[el.strokeWidth ?? 'medium'] || 2;
  const dash = BORDER_DASH_ARRAY[el.strokeStyle ?? 'solid'] ?? undefined;
  const art = silhouetteMarkup(el.shape, fill, stroke, strokeWidth, dash);
  if (!art) return null;
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"` +
    ` viewBox="${art.viewBox}" preserveAspectRatio="${art.preserve}" overflow="visible">${art.markup}</svg>`
  );
}

// A freehand sketch's real polyline (normalised points scaled to the box),
// closed paths fill like the canvas; open ones render stroke-only.
export function svgFreehandShape(el: FreehandElement, stroke: string, fill: string): string {
  if (el.points.length === 0) return '';
  const pts = el.points.map(
    (p, i) => `${i === 0 ? 'M' : 'L'} ${r2(el.x + p.nx * el.width)} ${r2(el.y + p.ny * el.height)}`,
  );
  const d = pts.join(' ') + (el.closed ? ' Z' : '');
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
// geometry, like the canvas, so it doesn't deform with the box's aspect ratio.
const BROWSER_CHROME_PX = 48;

export function svgBrowserChrome(el: BoxedElement, stroke: string): string {
  const h = Math.min(BROWSER_CHROME_PX, el.height);
  const c = xmlEscape(stroke);
  const midY = el.y + h / 2;
  const dots = [0, 1, 2]
    .map((i) => `<circle cx="${r2(el.x + 22 + i * 18)}" cy="${r2(midY)}" r="6" fill="${c}"/>`)
    .join('');
  const line = ` fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
  // The nav group, on the canvas's own 44x14 grid, placed after the dots.
  const nx = el.x + 78;
  const ny = midY - 7;
  const nav =
    `<g transform="translate(${r2(nx)} ${r2(ny)}) scale(1.27 1.29)">` +
    `<path d="M 7 3 L 3 7 L 7 11"${line}/>` +
    `<path d="M 15 11 L 19 7 L 15 3"${line}/>` +
    `<path d="M 30 4 A 4 4 0 1 1 27 11 M 30 4 L 33 4 M 30 4 L 30 7"${line}/>` +
    `</g>`;
  const pillX = el.x + 150;
  const pillW = Math.max(0, el.x + el.width - 16 - pillX);
  const pill =
    pillW > 8
      ? `<rect x="${r2(pillX)}" y="${r2(midY - 10)}" width="${r2(pillW)}" height="20" rx="10" fill="none" stroke="${c}" stroke-width="1"/>`
      : '';
  const divider = `<path d="M ${r2(el.x)} ${r2(el.y + h)} L ${r2(el.x + el.width)} ${r2(el.y + h)}" stroke="${c}" stroke-width="1"/>`;
  return dots + nav + pill + divider;
}
