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
  const strokeWidth =
    BORDER_STROKE_PX[
      (el as { strokeWidth?: keyof typeof BORDER_STROKE_PX }).strokeWidth ?? 'medium'
    ] || 2;
  const dash =
    BORDER_DASH_ARRAY[
      (el as { strokeStyle?: keyof typeof BORDER_DASH_ARRAY }).strokeStyle ?? 'solid'
    ] ?? undefined;
  const pts = el.points.map(
    (p, i) => `${i === 0 ? 'M' : 'L'} ${r2(el.x + p.nx * el.width)} ${r2(el.y + p.ny * el.height)}`,
  );
  const d = pts.join(' ') + (el.closed ? ' Z' : '');
  const fillAttr = el.closed && fill !== 'transparent' ? xmlEscape(fill) : 'none';
  return (
    `<path d="${d}" fill="${fillAttr}" stroke="${xmlEscape(stroke)}" stroke-width="${strokeWidth}"` +
    `${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
